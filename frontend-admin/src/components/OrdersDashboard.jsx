// frontend-admin/src/components/OrdersDashboard.jsx
import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import io from 'socket.io-client'; // Import socket.io-client

// Helper to format currency
const formatCurrency = (amount) => {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount)) return 'N/A';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numericAmount);
};

const BACKEND_URL = 'http://localhost:3001'; // Define your backend URL

function OrdersDashboard() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);
    const [filterStatus, setFilterStatus] = useState('');
    const [socket, setSocket] = useState(null); // State for the socket instance

    const { getToken, logout, authState } = useAuth();

    const fetchOrders = useCallback(async (currentAuthToken) => {
        setLoading(true);
        setError(null);
        let url = `${BACKEND_URL}/api/orders`;
        if (filterStatus) {
            url += `?status=${filterStatus}`;
        }

        if (!currentAuthToken) {
            setError("Authentication token not found for initial fetch.");
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${currentAuthToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({ message: `HTTP error! status: ${response.status}` }));
                if (response.status === 401 || response.status === 403) {
                    setError(`Authentication error: ${errData.message}. Please log in again.`);
                    logout();
                } else {
                    throw new Error(errData.message || `HTTP error! status: ${response.status}`);
                }
                return;
            }
            const data = await response.json();
            setOrders(data);
        } catch (e) {
            setError(e.message);
            console.error("Failed to fetch orders:", e);
        } finally {
            setLoading(false);
        }
    }, [filterStatus, logout]); // Removed getToken from here as token passed as arg

    // Effect for initial data fetching
    useEffect(() => {
        if (authState.isAuthenticated) {
            const currentToken = getToken(); // Get token once
            fetchOrders(currentToken);
        } else {
            setOrders([]);
            setLoading(false);
        }
    }, [authState.isAuthenticated, fetchOrders, getToken]);


    // Effect for Socket.IO connection and event listeners
    useEffect(() => {
        if (!authState.isAuthenticated) {
            // If not authenticated, ensure no socket connection is active
            if (socket) {
                socket.disconnect();
                setSocket(null);
            }
            return;
        }

        // Connect to Socket.IO server
        // You can pass auth token here if your backend socket auth is set up:
        // const newSocket = io(BACKEND_URL, { auth: { token: getToken() } });
        const newSocket = io(BACKEND_URL);
        setSocket(newSocket);
        console.log('Attempting to connect to Socket.IO server...');

        newSocket.on('connect', () => {
            console.log('Socket.IO connected successfully:', newSocket.id);
        });

        newSocket.on('connect_error', (err) => {
            console.error('Socket.IO connection error:', err.message);
            setError(`Socket connection failed: ${err.message}. Real-time updates may not work.`);
        });

        newSocket.on('newOrder', (newOrder) => {
            console.log('Received newOrder event:', newOrder);
            setOrders(prevOrders => {
                // Avoid adding duplicate if it somehow already exists
                if (prevOrders.find(o => o.order_id === newOrder.order_id)) {
                    return prevOrders.map(o => o.order_id === newOrder.order_id ? newOrder : o);
                }
                return [newOrder, ...prevOrders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); // Add to top and sort
            });
             // Optionally, update the modal if the new order is being viewed (less likely for newOrder)
            if (selectedOrderDetails && selectedOrderDetails.order_id === newOrder.order_id) {
                setSelectedOrderDetails(newOrder);
            }
        });

        newSocket.on('orderStatusUpdate', (updatedOrder) => {
            console.log('Received orderStatusUpdate event:', updatedOrder);
            setOrders(prevOrders =>
                prevOrders.map(order =>
                    order.order_id === updatedOrder.order_id ? updatedOrder : order
                ).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) // Re-sort if needed
            );
            // If the updated order is the one being viewed in the modal, update its details
            if (selectedOrderDetails && selectedOrderDetails.order_id === updatedOrder.order_id) {
                setSelectedOrderDetails(updatedOrder);
            }
        });

        // Cleanup on component unmount or when auth changes
        return () => {
            console.log('Disconnecting Socket.IO...');
            newSocket.disconnect();
            setSocket(null);
        };
    }, [authState.isAuthenticated]); // Only re-run if isAuthenticated changes (for connect/disconnect)
                                     // Listeners inside will use the latest state due to how React state works in closures
                                     // or we can add selectedOrderDetails if needed as dependency if its update logic is complex


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
        // Optimistic UI update (optional, can make UI feel faster)
        // setOrders(prevOrders =>
        //     prevOrders.map(order =>
        //         order.order_id === orderId ? { ...order, status: newStatus } : order
        //     )
        // );
        // if (selectedOrderDetails && selectedOrderDetails.order_id === orderId) {
        //     setSelectedOrderDetails(prev => ({ ...prev, status: newStatus }));
        // }

        try {
            const response = await fetch(`${BACKEND_URL}/api/orders/${orderId}/status`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status: newStatus }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({ message: `Failed to update status. Status: ${response.status}` }));
                 // Revert optimistic update if API call fails
                // fetchOrders(token); // Or revert manually
                if (response.status === 401 || response.status === 403) {
                    setError(`Authentication error: ${errData.message}. Please log in again.`);
                    logout();
                } else {
                    throw new Error(errData.message || `Failed to update status`);
                }
                return;
            }
            // No need to call fetchOrders() here if socket event handles the update
            // The backend will emit 'orderStatusUpdate' which will be caught by the socket listener
            console.log(`Status update for order ${orderId} sent successfully. Waiting for socket event.`);
        } catch (err) {
            console.error("Error updating order status:", err);
            alert(`Error: ${err.message}`);
            // fetchOrders(token); // Re-fetch to get consistent state if update failed badly
        }
    };

    if (!authState.isAuthenticated && !loading) {
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
                    onChange={(e) => {
                        setFilterStatus(e.target.value);
                        // Initial fetch will be triggered by useEffect dependency change on fetchOrders -> filterStatus
                    }}
                >
                    {/* ... options ... */}
                    <option value="">All</option>
                    <option value="pending_approval">Pending Approval</option>
                    <option value="approved">Approved</option>
                    <option value="preparing">Preparing</option>
                    <option value="ready">Ready</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                </select>
                <button onClick={() => fetchOrders(getToken())} style={{marginLeft: '10px'}} disabled={loading}>
                    {loading && orders.length > 0 ? 'Refreshing...' : 'Refresh Orders'}
                </button>
            </div>

            {orders.length === 0 && !loading && !error && <p>No orders found{filterStatus ? ` with status: ${filterStatus}` : ''}.</p>}

            <div className="orders-list-container">
                {/* ... mapping orders ... (same as before) */}
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
                // ... modal JSX (same as before, it will use updated selectedOrderDetails state) ...
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
                                {selectedOrderDetails.items.map((item, index) => (
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