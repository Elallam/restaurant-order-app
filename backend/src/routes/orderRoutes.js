// backend/src/routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController'); // We'll create this next
const { protect, authorize } = require('../middleware/authMiddleware'); // Import the middleware

// --- Protected Admin Routes ---
// GET all orders (for kitchen/manager)
// Only 'admin' or 'kitchen_staff' can access this
router.get('/', protect, authorize('admin', 'kitchen_staff'), orderController.getAllOrders);

// GET a specific order by ID (for kitchen/manager)
router.get('/:orderId', protect, authorize('admin', 'kitchen_staff'), orderController.getOrderById);

// PUT to update order status (for kitchen/manager)
// Example: Only 'admin' can update status, or 'admin' and 'kitchen_staff'
router.put('/:orderId/status', protect, authorize('admin', 'kitchen_staff'), orderController.updateOrderStatus);
// POST a new order
router.post('/', orderController.createOrder);

module.exports = router;