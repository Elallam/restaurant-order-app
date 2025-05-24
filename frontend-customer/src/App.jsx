// src/App.jsx
import { useState, useEffect } from 'react';
import './App.css';
import MenuCategories from './components/MenuCategories';
import MenuItemsList from './components/MenuItemsList';
import ItemOptionsModal from './components/ItemOptionsModal';

// Helper function to format currency (can be moved to a utils.js file)
const formatCurrency = (amount) => {
    // Ensure amount is a number before formatting
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount)) {
        // console.warn("formatCurrency received a non-numeric value:", amount);
        return 'N/A'; // Or some other placeholder for invalid numbers
    }
    return new Intl.NumberFormat('en-US', { // Adjust locale as needed
        style: 'currency',
        currency: 'USD' // Adjust currency code as needed (e.g., EUR, GBP)
    }).format(numericAmount);
};

function App() {
    const [tableNumber, setTableNumber] = useState(null);
    const [error, setError] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState(null);
    const [cart, setCart] = useState([]);

    // State for modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentItemForModal, setCurrentItemForModal] = useState(null);

    // State for order submission
    const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
    const [orderSubmissionError, setOrderSubmissionError] = useState(null);
    const [orderSuccessMessage, setOrderSuccessMessage] = useState(null);

    useEffect(() => {
        const queryParams = new URLSearchParams(window.location.search);
        const table = queryParams.get('table');
        if (table) {
            setTableNumber(parseInt(table, 10)); // Ensure tableNumber is a number
        } else {
            setError('Table number not specified in URL. Please scan a valid QR code.');
        }
    }, []); // Empty dependency array means this runs once on mount

    const handleSelectCategory = (categoryId) => {
        setSelectedCategoryId(categoryId);
        // Clear any submission messages when user navigates
        setOrderSuccessMessage(null);
        setOrderSubmissionError(null);
    };

    // Function to open the modal with specific item data
    const openItemOptionsModal = (itemData) => {
        setCurrentItemForModal(itemData);
        setIsModalOpen(true);
    };

    const closeItemOptionsModal = () => {
        setIsModalOpen(false);
        setCurrentItemForModal(null);
    };

    // Handler for adding items with options (from modal)
    const handleAddToCartWithOptions = (item, chosenOptionsArray, quantity, totalPriceWithOptionsMenu) => {
        setOrderSuccessMessage(null); // Clear success message when cart changes
        setOrderSubmissionError(null); // Clear error message
        setCart((prevCart) => {
            // Create a unique ID for the cart line item based on item_id and sorted option_ids
            const optionIdsString = chosenOptionsArray.map(opt => opt.option_id).sort().join('-');
            const cartItemId = `${item.item_id}-${optionIdsString || 'base'}`; // Use 'base' if no options

            const existingItemIndex = prevCart.findIndex(ci => ci.cart_item_id === cartItemId);

            if (existingItemIndex > -1) {
                // Item with same options exists, update quantity and total price
                const updatedCart = [...prevCart];
                const currentCartItem = updatedCart[existingItemIndex];
                currentCartItem.quantity += quantity;
                // The totalPriceWithOptionsMenu is for the *newly added* quantity, so add it to existing
                currentCartItem.item_total_price += totalPriceWithOptionsMenu;
                return updatedCart;
            } else {
                // New item (or new combination of options), add to cart
                const newCartItem = {
                    cart_item_id: cartItemId, // More robust unique ID for cart line
                    item_id: item.item_id,
                    name: item.name,
                    quantity: quantity,
                    base_price: parseFloat(item.base_price),
                    chosen_options: chosenOptionsArray, // This is an array of {option_id, option_group_name, option_name, additional_price}
                    item_total_price: totalPriceWithOptionsMenu
                };
                return [...prevCart, newCartItem];
            }
        });
        // console.log("Item added with options:", item.name, "Options:", chosenOptionsArray, "Qty:", quantity, "Total:", totalPriceWithOptionsMenu);
    };

    // Handler for adding simple items (no options)
    const addSimpleItemToCart = (itemToAdd) => {
        setOrderSuccessMessage(null); // Clear success message
        setOrderSubmissionError(null); // Clear error message
         setCart((prevCart) => {
            const cartItemId = `${itemToAdd.item_id}-base`; // Simple ID for items without options

            const existingItemIndex = prevCart.findIndex(
                (cartItem) => cartItem.cart_item_id === cartItemId
            );

            if (existingItemIndex > -1) {
                const updatedCart = [...prevCart];
                const currentItem = updatedCart[existingItemIndex];
                currentItem.quantity += 1;
                currentItem.item_total_price = currentItem.quantity * currentItem.base_price;
                return updatedCart;
            } else {
                return [
                    ...prevCart,
                    {
                        cart_item_id: cartItemId,
                        item_id: itemToAdd.item_id,
                        name: itemToAdd.name,
                        quantity: 1,
                        base_price: parseFloat(itemToAdd.base_price),
                        chosen_options: [], // No options for simple items
                        item_total_price: parseFloat(itemToAdd.base_price)
                    },
                ];
            }
        });
        // console.log("Simple item added:", itemToAdd.name);
    };

    // --- Function to handle order submission ---
    const handleSubmitOrder = async () => {
        if (cart.length === 0) {
            setOrderSubmissionError("Your cart is empty. Please add items before submitting.");
            return;
        }
        if (!tableNumber) {
            setOrderSubmissionError("Table number is missing. Cannot submit order.");
            return;
        }

        setIsSubmittingOrder(true);
        setOrderSubmissionError(null);
        setOrderSuccessMessage(null);

        const orderPayload = {
            table_number: tableNumber,
            items: cart.map(cartItem => ({
                item_id: cartItem.item_id,
                quantity: cartItem.quantity,
                chosen_options: cartItem.chosen_options.map(opt => ({ option_id: opt.option_id }))
            })),
            // notes: "Any special customer notes here" // Optional: Add a notes field if needed
        };

        try {
            const response = await fetch('http://localhost:3001/api/orders', { // Ensure backend URL is correct
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(orderPayload),
            });

            const responseData = await response.json();

            if (!response.ok) {
                throw new Error(responseData.message || `HTTP error! status: ${response.status}`);
            }

            setOrderSuccessMessage(`Order (ID: ${responseData.order_id}) submitted successfully! The kitchen has been notified.`);
            setCart([]); // Clear the cart on successful submission
        } catch (err) {
            console.error("Failed to submit order:", err);
            setOrderSubmissionError(err.message || "An unexpected error occurred while submitting your order. Please try again.");
        } finally {
            setIsSubmittingOrder(false);
        }
    };

    const cartTotal = cart.reduce((total, item) => total + item.item_total_price, 0);
    const totalCartItems = cart.reduce((acc, item) => acc + item.quantity, 0);

    if (error) {
        return (
          <div className="container error-container">
            <h1>Error</h1>
            <p>{error}</p>
          </div>
        );
    }

    if (!tableNumber && !error) { // Show loading only if no error and no table number yet
        return (
          <div className="container loading-container">
            <h1>Loading Table Information...</h1>
          </div>
        );
    }

    return (
        <div className="container">
            <header className="app-header">
                <h1>Restaurant Menu - Table {tableNumber || 'N/A'}</h1>
                <div className="cart-header-summary">
                    <span>Cart Total: {formatCurrency(cartTotal)}</span>
                    <span> ({totalCartItems} items)</span>
                </div>
            </header>
            <main className="main-content">
                <div className="menu-section">
                    <MenuCategories onSelectCategory={handleSelectCategory} />
                    <MenuItemsList
                        selectedCategoryId={selectedCategoryId}
                        onOpenItemOptionsModal={openItemOptionsModal}
                        onAddSimpleItemToCart={addSimpleItemToCart}
                        tableNumber={tableNumber} // Pass tableNumber if MenuItemsList needs it (e.g. for error messages)
                    />
                </div>
                <aside className="cart-sidebar">
                    <h2>Your Order</h2>
                    {orderSubmissionError && <p className="message error-message">{orderSubmissionError}</p>}
                    {orderSuccessMessage && <p className="message success-message">{orderSuccessMessage}</p>}

                    {!orderSuccessMessage && cart.length === 0 && !orderSubmissionError && (
                        <p>Your cart is empty.</p>
                    )}

                    {!orderSuccessMessage && cart.length > 0 && (
                        <>
                            <ul>
                                {cart.map((cartItem) => (
                                    <li key={cartItem.cart_item_id} className="cart-item-summary">
                                        <div className="cart-item-info">
                                            <strong>{cartItem.name}</strong> (x{cartItem.quantity})
                                            {cartItem.chosen_options && cartItem.chosen_options.length > 0 && (
                                                <ul className="cart-item-options-display">
                                                    {cartItem.chosen_options.map(opt => (
                                                        <li key={`${cartItem.cart_item_id}-${opt.option_id}`}>
                                                            {opt.option_name} (+{formatCurrency(opt.additional_price)})
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                        <span className="cart-item-price">{formatCurrency(cartItem.item_total_price)}</span>
                                    </li>
                                ))}
                            </ul>
                            <div className="cart-total-final">
                                <strong>Total: {formatCurrency(cartTotal)}</strong>
                                <button
                                    className="submit-order-btn"
                                    onClick={handleSubmitOrder}
                                    disabled={isSubmittingOrder || cart.length === 0 || !!orderSuccessMessage} // Disable also if order just succeeded
                                >
                                    {isSubmittingOrder ? 'Submitting...' : 'Submit Order'}
                                </button>
                            </div>
                        </>
                    )}
                </aside>
            </main>
            <footer className="app-footer">
                <p>&copy; {new Date().getFullYear()} Your Restaurant Name</p>
            </footer>

            <ItemOptionsModal
                item={currentItemForModal}
                isOpen={isModalOpen}
                onClose={closeItemOptionsModal}
                onAddToCartWithOptions={handleAddToCartWithOptions}
            />
        </div>
    );
}

export default App;
