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