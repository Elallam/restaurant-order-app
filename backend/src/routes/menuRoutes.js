// backend/src/routes/menuRoutes.js
const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController'); // We'll create this next

// GET all categories
router.get('/categories', menuController.getAllCategories);

// GET all menu items (optionally filter by category)
router.get('/items', menuController.getAllMenuItems);

// GET a specific menu item by ID
router.get('/items/:itemId', menuController.getMenuItemById);

// (Later we'll add POST, PUT, DELETE for admin functions)

module.exports = router;