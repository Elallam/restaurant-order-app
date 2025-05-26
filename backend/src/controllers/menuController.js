// backend/src/controllers/menuController.js
const db = require('../config/db'); // Import the database configuration

exports.getAllCategories = async (req, res) => {
  try {
    const result = await db.query('SELECT category_id, name, description FROM categories ORDER BY name');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Error fetching categories', error: error.message });
  }
};

exports.getAllMenuItems = async (req, res) => {
  const { categoryId } = req.query; // e.g., /api/menu/items?categoryId=1

  try {
    let queryString = `
      SELECT item_id, category_id, name, description, base_price, image_url, is_available 
      FROM MenuItems 
      WHERE is_available = TRUE`; // We usually only want to show available items to customers

    const queryParams = [];

    if (categoryId) {
      // Ensure categoryId is a number to prevent SQL injection if not using parameterized queries properly elsewhere
      // Though pg library handles parameterization well with $1, $2 etc.
      const catId = parseInt(categoryId);
      if (isNaN(catId)) {
        return res.status(400).json({ message: 'Invalid categoryId format.' });
      }
      queryString += ' AND category_id = $1';
      queryParams.push(catId);
    }

    queryString += ' ORDER BY name'; // Always a good idea to have a consistent order

    const result = await db.query(queryString, queryParams);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({ message: 'Error fetching menu items', error: error.message });
  }
};

exports.getMenuItemById = async (req, res) => {
    const { itemId } = req.params;
    const parsedItemId = parseInt(itemId);

    if (isNaN(parsedItemId)) {
        return res.status(400).json({ message: 'Invalid item ID format.' });
    }

    try {
        // Fetch item details
        const itemResult = await db.query(
            `SELECT item_id, category_id, name, description, base_price, image_url, is_available 
             FROM MenuItems 
             WHERE item_id = $1`, // We'll fetch even if not available, frontend can decide based on is_available
            [parsedItemId]
        );

        if (itemResult.rows.length === 0) {
            return res.status(404).json({ message: 'Menu item not found.' });
        }

        const item = itemResult.rows[0];

        // Fetch associated options for this item
        const optionsResult = await db.query(
            `SELECT option_id, item_id, option_group_name, option_name, additional_price 
             FROM MenuItemOptions 
             WHERE item_id = $1 
             ORDER BY option_group_name, option_name`,
            [parsedItemId]
        );

        // Group options by option_group_name for easier frontend consumption
        const groupedOptions = optionsResult.rows.reduce((acc, option) => {
            const group = option.option_group_name;
            if (!acc[group]) {
                acc[group] = [];
            }
            acc[group].push({
                option_id: option.option_id,
                name: option.option_name,
                additional_price: parseFloat(option.additional_price) // Ensure it's a number
            });
            return acc;
        }, {});

        // Add the (grouped) options to the item object
        item.options = groupedOptions;
        // Also add a simple flag if options exist
        item.has_options = optionsResult.rows.length > 0;


        res.status(200).json(item);
    } catch (error) {
        console.error('Error fetching menu item by ID:', error);
        res.status(500).json({ message: 'Error fetching menu item', error: error.message });
    }
};

// --- Create a new Category ---
exports.createCategory = async (req, res) => {
    const { name, description } = req.body;

    if (!name) {
        return res.status(400).json({ message: 'Category name is required.' });
    }

    try {
        // Check if category with the same name already exists (optional, but good for usability)
        const existingCategory = await db.query('SELECT * FROM Categories WHERE name = $1', [name]);
        if (existingCategory.rows.length > 0) {
            return res.status(409).json({ message: 'A category with this name already exists.' });
        }

        const result = await db.query(
            'INSERT INTO Categories (name, description) VALUES ($1, $2) RETURNING *',
            [name, description || null] // Use null if description is not provided
        );
        res.status(201).json({ message: 'Category created successfully', category: result.rows[0] });
    } catch (error) {
        console.error('Error creating category:', error);
        res.status(500).json({ message: 'Failed to create category.', error: error.message });
    }
};

// --- Update an existing Category ---
exports.updateCategory = async (req, res) => {
    const { categoryId } = req.params;
    const { name, description } = req.body;
    const parsedCategoryId = parseInt(categoryId);

    if (isNaN(parsedCategoryId)) {
        return res.status(400).json({ message: 'Invalid category ID format.' });
    }
    if (!name) {
        return res.status(400).json({ message: 'Category name is required for update.' });
    }

    try {
        // Check if another category (excluding the current one) has the new name (optional)
        const existingCategory = await db.query('SELECT * FROM Categories WHERE name = $1 AND category_id != $2', [name, parsedCategoryId]);
        if (existingCategory.rows.length > 0) {
            return res.status(409).json({ message: 'Another category with this name already exists.' });
        }

        const result = await db.query(
            'UPDATE Categories SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE category_id = $3 RETURNING *',
            [name, description === undefined ? null : description, parsedCategoryId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Category not found.' });
        }
        res.status(200).json({ message: 'Category updated successfully', category: result.rows[0] });
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({ message: 'Failed to update category.', error: error.message });
    }
};

// --- Delete a Category ---
exports.deleteCategory = async (req, res) => {
    const { categoryId } = req.params;
    const parsedCategoryId = parseInt(categoryId);

    if (isNaN(parsedCategoryId)) {
        return res.status(400).json({ message: 'Invalid category ID format.' });
    }

    // Important: Decide what happens to MenuItems in this category.
    // Option 1: Prevent deletion if items exist (current MenuItems table has ON DELETE SET NULL for category_id)
    // Option 2: Delete items (ON DELETE CASCADE - more destructive, be careful)
    // Option 3: Set items' category_id to NULL (current behavior of the schema)

    try {
        // Check if any menu items are currently in this category
        // If you want to prevent deletion if items exist, uncomment and adapt this:
        // const itemsInCategory = await db.query('SELECT COUNT(*) AS item_count FROM MenuItems WHERE category_id = $1', [parsedCategoryId]);
        // if (itemsInCategory.rows[0].item_count > 0) {
        //     return res.status(400).json({
        //         message: `Cannot delete category: ${itemsInCategory.rows[0].item_count} menu item(s) belong to it. Reassign items first or set their category to null.`
        //     });
        // }
        // Because our MenuItems table uses 'ON DELETE SET NULL' for category_id, deleting a category
        // will set the category_id of associated menu items to NULL. This is often acceptable.

        const result = await db.query('DELETE FROM Categories WHERE category_id = $1 RETURNING *', [parsedCategoryId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Category not found.' });
        }
        res.status(200).json({ message: 'Category deleted successfully', category: result.rows[0] });
    } catch (error) {
        console.error('Error deleting category:', error);
        // Check for foreign key constraint violation if you change item deletion behavior
        // if (error.code === '23503') { // PostgreSQL foreign key violation error code
        //    return res.status(400).json({ message: 'Cannot delete category as it has associated menu items. Please reassign or delete items first.' });
        // }
        res.status(500).json({ message: 'Failed to delete category.', error: error.message });
    }
};

// --- Create a new Menu Item ---
exports.createMenuItem = async (req, res) => {
    const { name, description, base_price, category_id, image_url, is_available } = req.body;

    // Basic Validation
    if (!name || base_price === undefined || category_id === undefined) {
        return res.status(400).json({ message: 'Name, base_price, and category_id are required.' });
    }
    if (typeof parseFloat(base_price) !== 'number' || parseFloat(base_price) < 0) {
        return res.status(400).json({ message: 'Base price must be a non-negative number.' });
    }
    if (typeof parseInt(category_id) !== 'number') {
        return res.status(400).json({ message: 'Category ID must be a number.' });
    }

    try {
        // Check if category exists
        const categoryExists = await db.query('SELECT 1 FROM Categories WHERE category_id = $1', [category_id]);
        if (categoryExists.rows.length === 0) {
            return res.status(400).json({ message: 'Invalid category_id: Category does not exist.' });
        }

        const result = await db.query(
            `INSERT INTO MenuItems (name, description, base_price, category_id, image_url, is_available)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [
                name,
                description || null,
                parseFloat(base_price),
                parseInt(category_id),
                image_url || null,
                is_available === undefined ? true : Boolean(is_available) // Default is_available to true
            ]
        );
        // Optional: Emit an event if menu changes affect real-time displays (e.g., customer menu)
        // const io = getIO();
        // io.emit('menuItemCreated', result.rows[0]);
        res.status(201).json({ message: 'Menu item created successfully', menuItem: result.rows[0] });
    } catch (error) {
        console.error('Error creating menu item:', error);
        res.status(500).json({ message: 'Failed to create menu item.', error: error.message });
    }
};

// --- Update an existing Menu Item ---
exports.updateMenuItem = async (req, res) => {
    const { itemId } = req.params;
    const { name, description, base_price, category_id, image_url, is_available } = req.body;
    const parsedItemId = parseInt(itemId);

    if (isNaN(parsedItemId)) {
        return res.status(400).json({ message: 'Invalid menu item ID format.' });
    }

    // Fetch existing item to compare and construct update query
    try {
        const currentItemResult = await db.query('SELECT * FROM MenuItems WHERE item_id = $1', [parsedItemId]);
        if (currentItemResult.rows.length === 0) {
            return res.status(404).json({ message: 'Menu item not found.' });
        }
        const currentItem = currentItemResult.rows[0];

        // Prepare values for update, using existing values if new ones aren't provided
        const newName = name !== undefined ? name : currentItem.name;
        const newDescription = description !== undefined ? description : currentItem.description;
        const newBasePrice = base_price !== undefined ? parseFloat(base_price) : parseFloat(currentItem.base_price);
        const newCategoryId = category_id !== undefined ? parseInt(category_id) : currentItem.category_id;
        const newImageUrl = image_url !== undefined ? image_url : currentItem.image_url;
        const newIsAvailable = is_available !== undefined ? Boolean(is_available) : currentItem.is_available;

        if (newBasePrice < 0) {
            return res.status(400).json({ message: 'Base price must be a non-negative number.' });
        }
        if (newCategoryId !== currentItem.category_id) { // if category is being changed, check if new one exists
            const categoryExists = await db.query('SELECT 1 FROM Categories WHERE category_id = $1', [newCategoryId]);
            if (categoryExists.rows.length === 0) {
                return res.status(400).json({ message: 'Invalid new category_id: Category does not exist.' });
            }
        }

        const result = await db.query(
            `UPDATE MenuItems SET 
             name = $1, description = $2, base_price = $3, category_id = $4, 
             image_url = $5, is_available = $6, updated_at = CURRENT_TIMESTAMP 
             WHERE item_id = $7 RETURNING *`,
            [newName, newDescription, newBasePrice, newCategoryId, newImageUrl, newIsAvailable, parsedItemId]
        );

        // Optional: Emit an event
        // const io = getIO();
        // io.emit('menuItemUpdated', result.rows[0]);
        res.status(200).json({ message: 'Menu item updated successfully', menuItem: result.rows[0] });
    } catch (error) {
        console.error('Error updating menu item:', error);
        res.status(500).json({ message: 'Failed to update menu item.', error: error.message });
    }
};

// --- Delete a Menu Item ---
exports.deleteMenuItem = async (req, res) => {
    const { itemId } = req.params;
    const parsedItemId = parseInt(itemId);

    if (isNaN(parsedItemId)) {
        return res.status(400).json({ message: 'Invalid menu item ID format.' });
    }

    try {
        // Our OrderItems table has ON DELETE RESTRICT for item_id.
        // This means PostgreSQL will prevent deleting an item if it's part of any order.
        // We should let this database constraint handle it and catch the specific error.

        // Also, MenuItemOptions has ON DELETE CASCADE, so options for this item will be auto-deleted.

        const result = await db.query('DELETE FROM MenuItems WHERE item_id = $1 RETURNING *', [parsedItemId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Menu item not found.' });
        }
        // Optional: Emit an event
        // const io = getIO();
        // io.emit('menuItemDeleted', { item_id: parsedItemId });
        res.status(200).json({ message: 'Menu item deleted successfully', menuItem: result.rows[0] });
    } catch (error) {
        console.error('Error deleting menu item:', error);
        if (error.code === '23503') { // PostgreSQL foreign key violation (from OrderItems)
            return res.status(400).json({
                message: 'Cannot delete menu item: It has been ordered previously. Consider marking it as unavailable instead.'
            });
        }
        res.status(500).json({ message: 'Failed to delete menu item.', error: error.message });
    }
};


// --- Create a new Menu Item Option ---
exports.createMenuItemOption = async (req, res) => {
    const { itemId } = req.params; // Get item_id from URL parameter
    const { option_group_name, option_name, additional_price } = req.body;
    const parsedItemId = parseInt(itemId);

    if (isNaN(parsedItemId)) {
        return res.status(400).json({ message: 'Invalid menu item ID format.' });
    }
    if (!option_group_name || !option_name) {
        return res.status(400).json({ message: 'Option group name and option name are required.' });
    }
    const parsedAdditionalPrice = additional_price === undefined || additional_price === null || additional_price === '' ? 0.00 : parseFloat(additional_price);
    if (isNaN(parsedAdditionalPrice) || parsedAdditionalPrice < 0) {
        return res.status(400).json({ message: 'Additional price must be a non-negative number.' });
    }

    try {
        // Check if the parent menu item exists
        const itemExists = await db.query('SELECT 1 FROM MenuItems WHERE item_id = $1', [parsedItemId]);
        if (itemExists.rows.length === 0) {
            return res.status(404).json({ message: 'Menu item not found. Cannot add option.' });
        }

        // Check for duplicate option (item_id, group_name, option_name must be unique)
        const duplicateCheck = await db.query(
            'SELECT 1 FROM MenuItemOptions WHERE item_id = $1 AND option_group_name = $2 AND option_name = $3',
            [parsedItemId, option_group_name, option_name]
        );
        if (duplicateCheck.rows.length > 0) {
            return res.status(409).json({ message: 'This option (name and group) already exists for this menu item.' });
        }


        const result = await db.query(
            `INSERT INTO MenuItemOptions (item_id, option_group_name, option_name, additional_price)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [parsedItemId, option_group_name, option_name, parsedAdditionalPrice]
        );

        // Optional: Emit an event if menu changes affect real-time displays
        // const io = getIO();
        // io.emit('menuItemOptionCreated', result.rows[0]);
        res.status(201).json({ message: 'Menu item option created successfully', menuItemOption: result.rows[0] });
    } catch (error) {
        console.error('Error creating menu item option:', error);
        res.status(500).json({ message: 'Failed to create menu item option.', error: error.message });
    }
};

// --- Update an existing Menu Item Option ---
exports.updateMenuItemOption = async (req, res) => {
    const { optionId } = req.params;
    const { option_group_name, option_name, additional_price } = req.body;
    const parsedOptionId = parseInt(optionId);

    if (isNaN(parsedOptionId)) {
        return res.status(400).json({ message: 'Invalid option ID format.' });
    }

    // At least one field must be provided for an update
    if (option_group_name === undefined && option_name === undefined && additional_price === undefined) {
        return res.status(400).json({ message: 'No update data provided. Please provide option_group_name, option_name, or additional_price.' });
    }

    try {
        const currentOptionResult = await db.query('SELECT * FROM MenuItemOptions WHERE option_id = $1', [parsedOptionId]);
        if (currentOptionResult.rows.length === 0) {
            return res.status(404).json({ message: 'Menu item option not found.' });
        }
        const currentOption = currentOptionResult.rows[0];

        const newOptionGroupName = option_group_name !== undefined ? option_group_name : currentOption.option_group_name;
        const newOptionName = option_name !== undefined ? option_name : currentOption.option_name;
        const newAdditionalPrice = additional_price !== undefined ?
            (additional_price === null || additional_price === '' ? 0.00 : parseFloat(additional_price)) :
            parseFloat(currentOption.additional_price);

        if (isNaN(newAdditionalPrice) || newAdditionalPrice < 0) {
             return res.status(400).json({ message: 'Additional price must be a non-negative number.' });
        }

        // Check for duplicate if name or group name is changed
        if ((option_group_name !== undefined || option_name !== undefined) &&
            (newOptionGroupName !== currentOption.option_group_name || newOptionName !== currentOption.option_name)) {
            const duplicateCheck = await db.query(
                'SELECT 1 FROM MenuItemOptions WHERE item_id = $1 AND option_group_name = $2 AND option_name = $3 AND option_id != $4',
                [currentOption.item_id, newOptionGroupName, newOptionName, parsedOptionId]
            );
            if (duplicateCheck.rows.length > 0) {
                return res.status(409).json({ message: 'Another option with this name and group already exists for this menu item.' });
            }
        }

        const result = await db.query(
            `UPDATE MenuItemOptions SET 
             option_group_name = $1, option_name = $2, additional_price = $3, updated_at = CURRENT_TIMESTAMP 
             WHERE option_id = $4 RETURNING *`,
            [newOptionGroupName, newOptionName, newAdditionalPrice, parsedOptionId]
        );

        // Optional: Emit an event
        // const io = getIO();
        // io.emit('menuItemOptionUpdated', result.rows[0]);
        res.status(200).json({ message: 'Menu item option updated successfully', menuItemOption: result.rows[0] });
    } catch (error) {
        console.error('Error updating menu item option:', error);
        res.status(500).json({ message: 'Failed to update menu item option.', error: error.message });
    }
};

// --- Delete a Menu Item Option ---
exports.deleteMenuItemOption = async (req, res) => {
    const { optionId } = req.params;
    const parsedOptionId = parseInt(optionId);

    if (isNaN(parsedOptionId)) {
        return res.status(400).json({ message: 'Invalid option ID format.' });
    }

    try {
        // Note: We need to consider if this option has been used in any past OrderItems.
        // The `chosen_options` in `OrderItems` is JSONB, so there's no direct FK constraint from DB.
        // For simplicity now, we'll allow deletion. For a production system, you might want to prevent
        // deletion of options that are part of historical orders or "soft delete" them.

        const result = await db.query('DELETE FROM MenuItemOptions WHERE option_id = $1 RETURNING *', [parsedOptionId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Menu item option not found.' });
        }

        // Optional: Emit an event
        // const io = getIO();
        // io.emit('menuItemOptionDeleted', { option_id: parsedOptionId, item_id: result.rows[0].item_id });
        res.status(200).json({ message: 'Menu item option deleted successfully', menuItemOption: result.rows[0] });
    } catch (error) {
        console.error('Error deleting menu item option:', error);
        res.status(500).json({ message: 'Failed to delete menu item option.', error: error.message });
    }
};