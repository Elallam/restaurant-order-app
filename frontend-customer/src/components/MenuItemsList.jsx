// src/components/MenuItemsList.jsx
import { useState, useEffect } from 'react';

// Helper function to format currency (can be moved to a utils.js file if used in multiple places)
const formatCurrency = (amount) => {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount)) {
        return 'N/A';
    }
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(numericAmount);
};

function MenuItemsList({ selectedCategoryId, onOpenItemOptionsModal, onAddSimpleItemToCart }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [categoryName, setCategoryName] = useState('All Menu Items'); // To display current category name

    useEffect(() => {
        const fetchItemsAndCategoryName = async () => {
            setLoading(true);
            setError(null);
            let itemsUrl = `http://localhost:3001/api/menu/items`;
            if (selectedCategoryId) {
                itemsUrl += `?categoryId=${selectedCategoryId}`;
                // Optionally fetch category name if you want to display it
                try {
                    const catResponse = await fetch(`http://localhost:3001/api/menu/categories`); // This fetches all, could be more specific
                    if(catResponse.ok) {
                        const allCategories = await catResponse.json();
                        const currentCat = allCategories.find(c => c.category_id === selectedCategoryId);
                        if (currentCat) setCategoryName(currentCat.name);
                        else setCategoryName('Selected Category');
                    } else {
                         setCategoryName('Selected Category');
                    }
                } catch (catErr) {
                    console.error("Failed to fetch category name:", catErr);
                    setCategoryName('Selected Category');
                }

            } else {
                setCategoryName('All Menu Items');
            }

            try {
                const response = await fetch(itemsUrl);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status} fetching items from ${itemsUrl}`);
                }
                const data = await response.json();
                setItems(data);
            } catch (e) {
                setError(e.message);
                console.error("Failed to fetch menu items:", e);
            } finally {
                setLoading(false);
            }
        };

        fetchItemsAndCategoryName();
    }, [selectedCategoryId]);

    const handleInitiateAddToCart = async (itemFromList) => {
        try {
            setLoading(true); // Indicate loading while fetching details
            const response = await fetch(`http://localhost:3001/api/menu/items/${itemFromList.item_id}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch item details: ${response.status}`);
            }
            const detailedItem = await response.json();
            setLoading(false); // Done loading details

            if (detailedItem.has_options && detailedItem.options && Object.keys(detailedItem.options).length > 0) {
                onOpenItemOptionsModal(detailedItem);
            } else {
                onAddSimpleItemToCart(detailedItem);
            }
        } catch (err) {
            setLoading(false); // Ensure loading is false on error
            console.error("Error initiating add to cart:", err);
            alert(`Error: Could not get item details. ${err.message}`);
        }
    };

    if (loading && items.length === 0) return <p className="loading-text">Loading menu items...</p>; // Show loading only if no items yet
    if (error) return <p className="error-text">Error loading menu items: {error}</p>;

    return (
        <div className="menu-items-container">
            <h2>{categoryName}</h2>
            {loading && <p className="loading-text small-loading">Updating items...</p>} {/* Small loading indicator for updates */}
            {!loading && items.length === 0 ? (
                <p>No items found in this category.</p>
            ) : (
                <ul className="menu-items-list">
                    {items.map((item) => (
                        <li key={item.item_id} className={`menu-item ${!item.is_available ? 'unavailable-item' : ''}`}>
                            {item.image_url && (
                                <img
                                    src={`http://localhost:3001/${item.image_url}`}
                                    alt={item.name}
                                    className="menu-item-image"
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                />
                            )}
                            <div className="menu-item-details">
                                <h3>{item.name}</h3>
                                <p className="item-description">{item.description}</p>
                                <p className="item-price">{formatCurrency(item.base_price)}</p>
                            </div>
                            <button
                                onClick={() => handleInitiateAddToCart(item)}
                                className="add-to-order-btn"
                                disabled={!item.is_available || loading} // Disable also if another item detail is being fetched
                            >
                                {item.is_available ? 'Add to Order' : 'Unavailable'}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default MenuItemsList;

