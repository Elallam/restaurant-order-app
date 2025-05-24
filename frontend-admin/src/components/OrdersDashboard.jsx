// frontend-admin/src/components/OrdersDashboard.jsx
import { useState, useEffect, useCallback } from 'react'; // Added useCallback
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext'; // Import useAuth

// Helper to format currency
const formatCurrency = (amount) => {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount)) return 'N/A';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numericAmount);
};

function OrdersDashboard() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);
    const [filterStatus, setFilterStatus] = useState('');

    const { getToken, logout, authState } = useAuth(); // Get getToken and logout from AuthContext

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        setError(null);
        let url = 'http://localhost:3001/api/orders';
        if (filterStatus) {
            url += `?status=${filterStatus}`;
        }

        const token = getToken(); // Get the token
        if (!token) {
            setError("Authentication token not found. Please log in again.");
            setLoading(false);
            // Optionally logout or redirect to login
            // logout();
            return;
        }

        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`, // Add Authorization header
                    'Content-Type': 'application/json' // Good practice, though not always needed for GET
                }
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({ message: `HTTP error! status: ${response.status}` }));
                if (response.status === 401 || response.status === 403) { // Unauthorized or Forbidden
                    setError(`Authentication error: ${errData.message}. Please log in again.`);
                    logout(); // Log out user if token is invalid/expired
                } else {
                    throw new Error(errData.message || `HTTP error! status: ${response.status}`);
                }
                return; // Stop further execution in case of error
            }
            const data = await response.json();
            setOrders(data);
        } catch (e) {
            setError(e.message);
            console.error("Failed to fetch orders:", e);
        } finally {
            setLoading(false);
        }
    }, [filterStatus, getToken, logout]); // Dependencies for useCallback

    useEffect(() => {
        if (authState.isAuthenticated) { // Only fetch if authenticated
            fetchOrders();
            // Optional: Set up polling to refresh orders periodically
            const intervalId = setInterval(fetchOrders, 30000); // Refresh every 30 seconds
            return () => clearInterval(intervalId); // Cleanup interval on component unmount
        } else {
            setOrders([]); // Clear orders if not authenticated
            setLoading(false);
        }
    }, [fetchOrders, authState.isAuthenticated]); // Dependency on fetchOrders and isAuthenticated

    const handleViewDetails = (order) => {
        setSelectedOrderDetails(order);
    };

    const handleUpdateStatus = async (orderId, newStatus) => {
        const token = getToken();
        if (!token) {
            alert("Authentication error. Please log in again.");
            logout();
            return;
        }

        try {
            const response = await fetch(`http://localhost:3001/api/orders/${orderId}/status`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`, // Add Authorization header
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status: newStatus }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({ message: `Failed to update status. Status: ${response.status}` }));
                if (response.status === 401 || response.status === 403) {
                    setError(`Authentication error: ${errData.message}. Please log in again.`);
                    logout();
                } else {
                    throw new Error(errData.message || `Failed to update status`);
                }
                return;
            }
            // Refresh orders list to show updated status
            fetchOrders();
            // If the updated order was the one being viewed in the modal, update its status too
            if (selectedOrderDetails && selectedOrderDetails.order_id === orderId) {
                setSelectedOrderDetails(prev => ({ ...prev, status: newStatus }));
            }
        } catch (err) {
            console.error("Error updating order status:", err);
            alert(`Error: ${err.message}`);
            // setError could be used here too for a less intrusive error message
        }
    };

    // If not authenticated, don't render the dashboard contents (App.jsx handles showing Login)
    if (!authState.isAuthenticated && !loading) {
         // This component shouldn't normally be rendered if not authenticated due to App.jsx logic,
         // but this is an extra safeguard.
        return <p>Please log in to view the dashboard.</p>;
    }

    if (loading && orders.length === 0) return <p>Loading orders...</p>;
    if (error && !loading) return <p className="error-message">Error: {error}</p>;


    return (
        <div className="orders-dashboard">
            <div className="orders-filter">
                <label htmlFor="statusFilter">Filter by status: </label>
                <select
                    id="statusFilter"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                >
                    <option value="">All</option>
                    <option value="pending_approval">Pending Approval</option>
                    <option value="approved">Approved</option>
                    <option value="preparing">Preparing</option>
                    <option value="ready">Ready</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                </select>
                <button onClick={fetchOrders} style={{marginLeft: '10px'}}>Refresh Orders</button>
            </div>

            {orders.length === 0 && !loading && !error && <p>No orders found{filterStatus ? ` with status: ${filterStatus}` : ''}.</p>}

            <div className="orders-list-container">
                {orders.map(order => (
                    <div key={order.order_id} className={`order-card status-${order.status.replace('_', '-')}`}>
                        <h3>Order ID: {order.order_id} (Table: {order.table_number})</h3>
                        <p>Status: <span className="order-status-badge">{order.status.replace(/_/g, ' ')}</span></p>
                        <p>Total: {formatCurrency(order.total_amount)}</p>
                        <p>Received: {format(new Date(order.created_at), 'Pp')}</p>
                        <button onClick={() => handleViewDetails(order)}>View Details</button>
                        <div className="status-actions">
                            {order.status === 'pending_approval' && (
                                <button onClick={() => handleUpdateStatus(order.order_id, 'approved')}>Approve</button>
                            )}
                            {order.status === 'approved' && (
                                <button onClick={() => handleUpdateStatus(order.order_id, 'preparing')}>Start Preparing</button>
                            )}
                            {order.status === 'preparing' && (
                                <button onClick={() => handleUpdateStatus(order.order_id, 'ready')}>Mark Ready</button>
                            )}
                             {order.status === 'ready' && (
                                <button onClick={() => handleUpdateStatus(order.order_id, 'completed')}>Mark Completed</button>
                            )}
                            {(order.status !== 'completed' && order.status !== 'cancelled') && (
                                 <button onClick={() => handleUpdateStatus(order.order_id, 'cancelled')} className="cancel-btn">Cancel Order</button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {selectedOrderDetails && (
                <div className="order-details-modal-overlay" onClick={() => setSelectedOrderDetails(null)}>
                    <div className="order-details-modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2>Order Details (ID: {selectedOrderDetails.order_id})</h2>
                        <p><strong>Table:</strong> {selectedOrderDetails.table_number}</p>
                        <p><strong>Status:</strong> {selectedOrderDetails.status.replace(/_/g, ' ')}</p>
                        <p><strong>Total:</strong> {formatCurrency(selectedOrderDetails.total_amount)}</p>
                        <p><strong>Received:</strong> {format(new Date(selectedOrderDetails.created_at), 'Pp')}</p>
                        {selectedOrderDetails.notes && <p><strong>Notes:</strong> {selectedOrderDetails.notes}</p>}
                        <h4>Items:</h4>
                        {selectedOrderDetails.items && selectedOrderDetails.items.length > 0 ? (
                            <ul>
                                {selectedOrderDetails.items.map((item, index) => ( // Added index for key if order_item_id isn't always unique/present
                                    <li key={item.order_item_id || index}>
                                        {item.item_name || 'N/A'} (x{item.quantity}) - {formatCurrency(item.sub_total)}
                                        {item.chosen_options && item.chosen_options.length > 0 && (
                                            <ul className="chosen-options-list">
                                                {item.chosen_options.map((opt, optIndex) => (
                                                    <li key={opt.option_id || optIndex}>{opt.option_name} (+{formatCurrency(opt.additional_price)})</li>
                                                ))}
                                            </ul>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        ) : <p>No items listed for this order.</p>}
                        <button onClick={() => setSelectedOrderDetails(null)} className="close-modal-btn">Close</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default OrdersDashboard;