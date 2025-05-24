// backend/src/controllers/orderController.js
const db = require('../config/db');

exports.createOrder = async (req, res) => {
    const { table_number, items, notes } = req.body; // items is an array from the client

    // --- Basic Validation ---
    if (!table_number || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'Missing table_number or items, or items is not a valid array.' });
    }
    if (typeof table_number !== 'number' || table_number <= 0) {
        return res.status(400).json({ message: 'Invalid table_number.'});
    }

    const client = await db.pool.connect(); // Get a client from the pool for transaction

    try {
        await client.query('BEGIN'); // Start transaction

        let calculatedOrderTotalAmount = 0;

        // --- Create the Order record first to get an order_id ---
        const orderInsertQuery = `
            INSERT INTO Orders (table_number, status, total_amount, notes) 
            VALUES ($1, $2, $3, $4) RETURNING order_id, created_at`;
        // We'll put a placeholder for total_amount and update it later
        const orderResult = await client.query(orderInsertQuery, [table_number, 'pending_approval', 0, notes]);
        const orderId = orderResult.rows[0].order_id;
        const orderCreatedAt = orderResult.rows[0].created_at;


        // --- Process each item in the order ---
        for (const item of items) {
            if (!item.item_id || !item.quantity || item.quantity <= 0) {
                await client.query('ROLLBACK'); // Rollback transaction
                return res.status(400).json({ message: `Invalid item_id or quantity for item: ${item.item_id || 'unknown'}` });
            }

            // 1. Fetch the base item details from DB (SECURITY: always use server-side prices)
            const menuItemResult = await client.query('SELECT name, base_price, is_available FROM MenuItems WHERE item_id = $1', [item.item_id]);
            if (menuItemResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ message: `Menu item with ID ${item.item_id} not found.` });
            }
            if (!menuItemResult.rows[0].is_available) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: `Menu item '${menuItemResult.rows[0].name}' is currently unavailable.` });
            }
            const basePrice = parseFloat(menuItemResult.rows[0].base_price);
            let itemSubTotal = basePrice;

            // 2. Process chosen_options (if any) and validate them
            const chosenOptionsDetails = []; // To store validated options with their prices
            if (item.chosen_options && Array.isArray(item.chosen_options)) {
                for (const chosenOption of item.chosen_options) {
                    if (!chosenOption.option_id) {
                         await client.query('ROLLBACK');
                         return res.status(400).json({ message: `Missing option_id for an option in item ${item.item_id}.` });
                    }
                    const optionResult = await client.query(
                        'SELECT option_group_name, option_name, additional_price FROM MenuItemOptions WHERE option_id = $1 AND item_id = $2',
                        [chosenOption.option_id, item.item_id]
                    );
                    if (optionResult.rows.length === 0) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ message: `Invalid option_id ${chosenOption.option_id} for item_id ${item.item_id}.` });
                    }
                    const optionDb = optionResult.rows[0];
                    itemSubTotal += parseFloat(optionDb.additional_price);
                    chosenOptionsDetails.push({
                        option_id: chosenOption.option_id, // Store the ID for reference
                        option_group_name: optionDb.option_group_name,
                        option_name: optionDb.option_name,
                        additional_price: parseFloat(optionDb.additional_price)
                    });
                }
            }
            itemSubTotal *= item.quantity; // Total for this item including quantity

            // 3. Insert into OrderItems
            const orderItemInsertQuery = `
                INSERT INTO OrderItems (order_id, item_id, quantity, price_at_order_time, chosen_options, sub_total)
                VALUES ($1, $2, $3, $4, $5, $6)`;
            await client.query(orderItemInsertQuery, [
                orderId,
                item.item_id,
                item.quantity,
                basePrice, // Price of the base item at the time of order
                JSON.stringify(chosenOptionsDetails), // Store the validated and priced options
                itemSubTotal
            ]);

            calculatedOrderTotalAmount += itemSubTotal; // Add to grand total
        }

        // --- Update the Order with the correct total_amount ---
        await client.query('UPDATE Orders SET total_amount = $1 WHERE order_id = $2', [calculatedOrderTotalAmount, orderId]);

        await client.query('COMMIT'); // Finalize transaction

        res.status(201).json({
            message: 'Order created successfully!',
            order_id: orderId,
            table_number: table_number,
            status: 'pending_approval',
            total_amount: calculatedOrderTotalAmount,
            notes: notes,
            created_at: orderCreatedAt
            // You might want to return the full order details including items here by re-fetching
        });

    } catch (error) {
        await client.query('ROLLBACK'); // Rollback on any error
        console.error('Error creating order:', error);
        res.status(500).json({ message: 'Failed to create order.', error: error.message });
    } finally {
        client.release(); // Release client back to the pool
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
        res.status(200).json({ message: `Order ${orderId} status updated to ${status}`, order: result.rows[0] });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ message: 'Error updating order status', error: error.message });
    }
};