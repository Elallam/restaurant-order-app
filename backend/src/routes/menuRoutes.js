// backend/src/routes/menuRoutes.js
const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const { protect, authorize } = require('../middleware/authMiddleware');

// --- Public GET routes ---
router.get('/categories', menuController.getAllCategories);
router.get('/items', menuController.getAllMenuItems);
router.get('/items/:itemId', menuController.getMenuItemById);

// --- Protected Admin/Manager routes for Menu Item Management ---
router.post(
    '/items', // Note: this route is POST /api/menu/items
    protect,
    authorize('admin'),
    menuController.createMenuItem
);

router.put(
    '/items/:itemId', // Note: this route is PUT /api/menu/items/:itemId
    protect,
    authorize('admin'),
    menuController.updateMenuItem
);

router.delete(
    '/items/:itemId', // Note: this route is DELETE /api/menu/items/:itemId
    protect,
    authorize('admin'),
    menuController.deleteMenuItem
);

// (We will add routes for MenuItemOptions management here later)

// --- Protected Admin/Manager routes for Category Management ---
// ... (existing POST, PUT, DELETE for categories) ...
router.post('/categories', protect, authorize('admin'), menuController.createCategory);
router.put('/categories/:categoryId', protect, authorize('admin'), menuController.updateCategory);
router.delete('/categories/:categoryId', protect, authorize('admin'), menuController.deleteCategory);

// --- Protected Admin/Manager routes for Menu Item Management ---
// ... (existing POST, PUT, DELETE for items) ...
router.post('/items', protect, authorize('admin'), menuController.createMenuItem);
router.put('/items/:itemId', protect, authorize('admin'), menuController.updateMenuItem);
router.delete('/items/:itemId', protect, authorize('admin'), menuController.deleteMenuItem);

// --- Protected Admin/Manager routes for Menu Item Option Management ---
router.post(
    '/items/:itemId/options', // Create an option for a specific item
    protect,
    authorize('admin'),
    menuController.createMenuItemOption
);

router.put(
    '/options/:optionId',    // Update a specific option by its own ID
    protect,
    authorize('admin'),
    menuController.updateMenuItemOption
);

router.delete(
    '/options/:optionId',  // Delete a specific option by its own ID
    protect,
    authorize('admin'),
    menuController.deleteMenuItemOption
);


module.exports = router;