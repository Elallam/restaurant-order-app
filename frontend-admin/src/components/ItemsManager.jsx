// frontend-admin/src/components/ItemsManager.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import './ManagerForms.css';
// We will create ItemOptionsEditorModal next
import ItemOptionsEditorModal from './ItemOptionsEditorModal';

const API_BASE_URL = 'http://localhost:3001/api/menu';
const formatCurrency = (amount) => { /* ... same as before ... */ };

function ItemsManager() {
    // ... (all existing state: items, categories, isLoading, error, form states) ...
    const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false);
    const [selectedItemForOptions, setSelectedItemForOptions] = useState(null);

    const { getToken, logout } = useAuth(); // Keep this

    // ... (fetchCategories, fetchItems, resetForm, handleEdit, handleSubmit, handleDelete functions remain mostly the same) ...
    // Ensure fetchItems updates the items list which might be passed to the modal or re-fetched by modal

    const fetchCategories = useCallback(async () => {
        setIsLoading(true); // Indicate loading for categories as well
        try {
            const response = await fetch(`${API_BASE_URL}/categories`);
            if (!response.ok) throw new Error('Failed to fetch categories');
            const data = await response.json();
            setCategories(data);
        } catch (err) {
            console.error("Fetch categories error for dropdown:", err);
            setError(prev => `${prev || ''} Failed to load categories. `);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchItems = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/items`);
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || `Failed to fetch items. Status: ${response.status}`);
            }
            const data = await response.json();
            const enrichedItems = data.map(item => {
                const category = categories.find(cat => cat.category_id === item.category_id);
                return { ...item, category_name: category ? category.name : 'N/A' };
            });
            setItems(enrichedItems);
        } catch (err) {
            setError(err.message);
            console.error("Fetch items error:", err);
        } finally {
            setIsLoading(false);
        }
    }, [categories]);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    useEffect(() => {
        if (categories.length > 0) {
            fetchItems();
        }
    }, [categories, fetchItems]);


    const resetForm = () => {
        setIsEditing(false);
        setCurrentItem(null);
        setItemName('');
        setItemDescription('');
        setItemBasePrice('');
        setItemCategoryId(categories.length > 0 ? categories[0].category_id : '');
        setItemImageUrl('');
        setItemIsAvailable(true);
        setFormError('');
    };

    const handleEdit = (item) => {
        setIsEditing(true);
        setCurrentItem(item);
        setItemName(item.name);
        setItemDescription(item.description || '');
        setItemBasePrice(String(item.base_price));
        setItemCategoryId(String(item.category_id));
        setItemImageUrl(item.image_url || '');
        setItemIsAvailable(item.is_available);
        setFormError('');
        window.scrollTo(0, 0);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError('');
        if (!itemName.trim() || !itemBasePrice.trim() || !itemCategoryId) { /* ... */ }
        if (isNaN(parseFloat(itemBasePrice)) || parseFloat(itemBasePrice) < 0) { /* ... */ }

        setIsLoading(true);
        const token = getToken();
        if (!token) { setError("Authentication error."); logout(); setIsLoading(false); return; }

        const payload = { /* ... */ };
        const url = isEditing ? `<span class="math-inline">\{API\_BASE\_URL\}/items/</span>{currentItem.item_id}` : `${API_BASE_URL}/items`;
        const method = isEditing ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, { /* ... */ });
            // ... (rest of submit logic)
            if (!response.ok) {
                const responseData = await response.json().catch(() => ({}));
                throw new Error(responseData.message || `Failed to ${isEditing ? 'update' : 'create'} item.`);
            }
            fetchItems();
            resetForm();
        } catch (err) { /* ... */ } finally { setIsLoading(false); }
    };

    const handleDelete = async (itemId, itemName) => {
        if (!window.confirm(`Are you sure you want to delete "${itemName}"?`)) return;
        // ... (rest of delete logic)
        setIsLoading(true);
        const token = getToken();
        if (!token) { setError("Authentication error."); logout(); setIsLoading(false); return; }
        try {
            const response = await fetch(`<span class="math-inline">\{API\_BASE\_URL\}/items/</span>{itemId}`, { /* ... */ });
            if (!response.ok) {
                const responseData = await response.json().catch(() => ({}));
                throw new Error(responseData.message || 'Failed to delete item.');
            }
            fetchItems();
        } catch (err) { /* ... */ } finally { setIsLoading(false); }
    };


    const openOptionsModal = (item) => {
        setSelectedItemForOptions(item);
        setIsOptionsModalOpen(true);
    };

    const closeOptionsModal = () => {
        setIsOptionsModalOpen(false);
        setSelectedItemForOptions(null);
        fetchItems(); // Re-fetch items in case options changed which might affect how items are displayed/used
    };

    return (
        <div className="manager-container">
            {/* ... Item Add/Edit Form ... (same as before) */}
            <h4>{isEditing ? 'Edit Menu Item' : 'Add New Menu Item'}</h4>
            <form onSubmit={handleSubmit} className="manager-form">
                {formError && <p className="error-message form-error">{formError}</p>}
                <div className="form-group">
                    <label htmlFor="itemName">Name:</label>
                    <input type="text" id="itemName" value={itemName} onChange={(e) => setItemName(e.target.value)} required disabled={isLoading} />
                </div>
                <div className="form-group">
                    <label htmlFor="itemDescription">Description:</label>
                    <textarea id="itemDescription" value={itemDescription} onChange={(e) => setItemDescription(e.target.value)} rows="3" disabled={isLoading} />
                </div>
                <div className="form-group">
                    <label htmlFor="itemBasePrice">Base Price:</label>
                    <input type="number" id="itemBasePrice" value={itemBasePrice} onChange={(e) => setItemBasePrice(e.target.value)} step="0.01" min="0" required disabled={isLoading} />
                </div>
                <div className="form-group">
                    <label htmlFor="itemCategoryId">Category:</label>
                    <select id="itemCategoryId" value={itemCategoryId} onChange={(e) => setItemCategoryId(e.target.value)} required disabled={isLoading || categories.length === 0}>
                        <option value="" disabled>{categories.length === 0 ? "Loading categories..." : "Select a category"}</option>
                        {categories.map(cat => (
                            <option key={cat.category_id} value={cat.category_id}>{cat.name}</option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label htmlFor="itemImageUrl">Image URL (Optional):</label>
                    <input type="url" id="itemImageUrl" value={itemImageUrl} onChange={(e) => setItemImageUrl(e.target.value)} placeholder="https://example.com/image.jpg" disabled={isLoading} />
                </div>
                <div className="form-group">
                    <label htmlFor="itemIsAvailable" className="checkbox-label">
                        <input type="checkbox" id="itemIsAvailable" checked={itemIsAvailable} onChange={(e) => setItemIsAvailable(e.target.checked)} disabled={isLoading} />
                        Is Available
                    </label>
                </div>
                <div className="form-actions">
                    <button type="submit" className="submit-btn" disabled={isLoading}>
                        {isLoading ? (isEditing ? 'Updating...' : 'Adding...') : (isEditing ? 'Update Item' : 'Add Item')}
                    </button>
                    {isEditing && (
                        <button type="button" className="cancel-btn" onClick={resetForm} disabled={isLoading}>Cancel Edit</button>
                    )}
                </div>
            </form>

            <hr className="form-divider" />

            <h4>Existing Menu Items</h4>
            {/* ... Loading/Error/No Items messages ... (same as before) */}
            {isLoading && items.length === 0 && <p>Loading items...</p>}
            {error && <p className="error-message">{error}</p>}
            {!isLoading && !error && items.length === 0 && <p>No menu items found. Add one above!</p>}


            {items.length > 0 && (
                <ul className="manager-list">
                    {items.map(item => (
                        <li key={item.item_id} className="manager-list-item">
                            <div className="item-main-info">
                                <strong>{item.name}</strong>
                                {/* ... other item info ... */}
                                <span className="item-category">Category: {item.category_name || 'N/A'}</span>
                                <p className="item-price">Price: {formatCurrency(item.base_price)}</p>
                                <p className="item-availability">Available: {item.is_available ? 'Yes' : 'No'}</p>
                            </div>
                            <div className="item-actions">
                                <button onClick={() => handleEdit(item)} className="edit-btn">Edit</button>
                                <button
                                    onClick={() => openOptionsModal(item)} // Open options modal
                                    className="options-btn" // New class for styling
                                >
                                    Manage Options
                                </button>
                                <button onClick={() => handleDelete(item.item_id, item.name)} className="delete-btn" disabled={isLoading}>Delete</button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {/* Modal for managing options */}
            {selectedItemForOptions && (
                <ItemOptionsEditorModal
                    item={selectedItemForOptions}
                    isOpen={isOptionsModalOpen}
                    onClose={closeOptionsModal}
                />
            )}
        </div>
    );
}

export default ItemsManager;