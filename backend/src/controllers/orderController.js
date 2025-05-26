// backend/src/controllers/orderController.js
const db = require('../config/db');
const { getIO } = require('../socketManager'); // Import getIO

exports.createOrder = async (req, res) => {
    const { table_number, items, notes } = req.body; // items is an array from the client

    // --- Basic Validation ---
    if (!table_number || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'Missing table_number or items, or items is not a valid array.' });
    }
    if (typeof table_number !== 'number' || table_number <= 0) {
        return res.status(400).json({ message: 'Invalid table_number.'});
    }

    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');
        let calculatedOrderTotalAmount = 0;

        const orderInsertQuery = `
            INSERT INTO Orders (table_number, status, total_amount, notes)
            VALUES ($1, $2, $3, $4) RETURNING order_id, table_number, status, total_amount, notes, created_at, updated_at`;
        const orderResult = await client.query(orderInsertQuery, [table_number, 'pending_approval', 0, notes]);
        const orderId = orderResult.rows[0].order_id;
        let newOrderDataForEmit = { ...orderResult.rows[0] }; // Initial order data

        const createdOrderItems = []; // To aggregate items for the emitted order

        for (const item of items) {
            // ... (validation for item.item_id, item.quantity) ...

            const menuItemResult = await client.query('SELECT item_id, name, base_price, is_available FROM MenuItems WHERE item_id = $1', [item.item_id]);
            // ... (error handling if item not found or unavailable) ...
            const basePrice = parseFloat(menuItemResult.rows[0].base_price);
            let itemSubTotal = basePrice;
            const chosenOptionsDetails = [];

            if (item.chosen_options && Array.isArray(item.chosen_options)) {
                for (const chosenOption of item.chosen_options) {
                    // ... (validation for chosenOption.option_id) ...
                    const optionResult = await client.query(
                        'SELECT option_id, option_group_name, option_name, additional_price FROM MenuItemOptions WHERE option_id = $1 AND item_id = $2',
                        [chosenOption.option_id, item.item_id]
                    );
                    // ... (error handling if option invalid) ...
                    const optionDb = optionResult.rows[0];
                    itemSubTotal += parseFloat(optionDb.additional_price);
                    chosenOptionsDetails.push({
                        option_id: optionDb.option_id,
                        option_group_name: optionDb.option_group_name,
                        option_name: optionDb.option_name,
                        additional_price: parseFloat(optionDb.additional_price)
                    });
                }
            }
            itemSubTotal *= item.quantity;
            calculatedOrderTotalAmount += itemSubTotal;

            const orderItemInsertQuery = `
                INSERT INTO OrderItems (order_id, item_id, quantity, price_at_order_time, chosen_options, sub_total)
                VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`; // RETURNING * to get the full item
            const newOrderItemResult = await client.query(orderItemInsertQuery, [
                orderId, item.item_id, item.quantity, basePrice, JSON.stringify(chosenOptionsDetails), itemSubTotal
            ]);
            // Add menu item name to the order item for easier display on client
            const fullOrderItem = {
                ...newOrderItemResult.rows[0],
                item_name: menuItemResult.rows[0].name // Add item_name here
            };
            createdOrderItems.push(fullOrderItem);
        }

        await client.query('UPDATE Orders SET total_amount = $1 WHERE order_id = $2', [calculatedOrderTotalAmount, orderId]);
        newOrderDataForEmit.total_amount = calculatedOrderTotalAmount; // Update total amount
        newOrderDataForEmit.items = createdOrderItems; // Attach formatted items

        await client.query('COMMIT');

        // --- Emit 'newOrder' event via Socket.IO ---
        try {
            const io = getIO();
            io.emit('newOrder', newOrderDataForEmit); // Send the full order data with items
            console.log('Emitted newOrder event for order ID:', orderId);
        } catch (socketError) {
            console.error("Socket.IO newOrder emit error:", socketError.message);
            // Continue without failing the HTTP request if socket emit fails
        }
        // --- End Emit ---

        res.status(201).json({
            message: 'Order created successfully!',
            order_id: orderId,
            // ... (rest of the response based on newOrderDataForEmit or just order_id)
            order: newOrderDataForEmit // Send back the enriched order data
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating order:', error);
        res.status(500).json({ message: 'Failed to create order.', error: error.message });
    } finally {
        client.release();
    }
};

// --- Basic GET Endpoints (for Kitchen/Manager) ---
exports.getAllOrders = async (req, res) => {
    // Add filtering by status, date range etc. later
    const { status } = req.query;
    try {
        let queryString = `
            SELECT o.order_id, o.table_number, o.status, o.total_amount, o.notes, o.created_at,
                   json_agg(
                       json_build_object(
                           'order_item_id', oi.order_item_id,
                           'item_id', oi.item_id,
                           'item_name', mi.name, -- Get item name
                           'quantity', oi.quantity,
                           'price_at_order_time', oi.price_at_order_time,
                           'chosen_options', oi.chosen_options,
                           'sub_total', oi.sub_total
                       ) ORDER BY oi.order_item_id
                   ) AS items
            FROM Orders o
            LEFT JOIN OrderItems oi ON o.order_id = oi.order_id
            LEFT JOIN MenuItems mi ON oi.item_id = mi.item_id`;

        const queryParams = [];
        if (status) {
            queryString += ' WHERE o.status = $1';
            queryParams.push(status);
        }
        queryString += ' GROUP BY o.order_id ORDER BY o.created_at DESC';


        const result = await db.query(queryString, queryParams);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ message: 'Error fetching orders', error: error.message });
    }
};

exports.getOrderById = async (req, res) => {
    const { orderId } = req.params;
    try {
        const result = await db.query(
            `SELECT o.order_id, o.table_number, o.status, o.total_amount, o.notes, o.created_at,
                    json_agg(
                        json_build_object(
                            'order_item_id', oi.order_item_id,
                            'item_id', oi.item_id,
                            'item_name', mi.name,
                            'quantity', oi.quantity,
                            'price_at_order_time', oi.price_at_order_time,
                            'chosen_options', oi.chosen_options,
                            'sub_total', oi.sub_total
                        ) ORDER BY oi.order_item_id
                    ) AS items
             FROM Orders o
             LEFT JOIN OrderItems oi ON o.order_id = oi.order_id
             LEFT JOIN MenuItems mi ON oi.item_id = mi.item_id
             WHERE o.order_id = $1
             GROUP BY o.order_id`, [orderId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching order by ID:', error);
        res.status(500).json({ message: 'Error fetching order', error: error.message });
    }
};

exports.updateOrderStatus = async (req, res) => {
    const { orderId } = req.params;
    const { status } = req.body;

    // Add validation for allowed statuses
    const allowedStatuses = ['pending_approval', 'approved', 'preparing', 'ready', 'completed', 'cancelled'];
    if (!status || !allowedStatuses.includes(status)) {
        return res.status(400).json({ message: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}` });
    }

        try {
        const result = await db.query(
            'UPDATE Orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE order_id = $2 RETURNING *',
            [status, orderId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Order not found to update.' });
        }

        const updatedOrder = result.rows[0];

        // --- Fetch order items to include in the emit for complete data ---
        const itemsResult = await db.query(
           `SELECT oi.order_item_id, oi.item_id, mi.name as item_name, oi.quantity, oi.price_at_order_time, oi.chosen_options, oi.sub_total
            FROM OrderItems oi
            JOIN MenuItems mi ON oi.item_id = mi.item_id
            WHERE oi.order_id = $1 ORDER BY oi.order_item_id`,
            [orderId]
        );
        updatedOrder.items = itemsResult.rows;
        // --- End fetch order items ---


        // --- Emit 'orderStatusUpdate' event via Socket.IO ---
        try {
            const io = getIO();
            io.emit('orderStatusUpdate', updatedOrder); // Send the full updated order data
            console.log('Emitted orderStatusUpdate event for order ID:', orderId, 'to status:', status);
        } catch (socketError) {
            console.error("Socket.IO orderStatusUpdate emit error:", socketError.message);
        }
        // --- End Emit ---

        res.status(200).json({ message: `Order ${orderId} status updated to ${status}`, order: updatedOrder });
    } catch (error) {
        // ... (error handling) ...
        console.error('Error updating order status:', error);
        res.status(500).json({ message: 'Error updating order status', error: error.message });
    }
};