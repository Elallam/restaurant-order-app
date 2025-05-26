// frontend-admin/src/components/ItemOptionsEditorModal.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import './ManagerForms.css'; // Shared form styles
import './ItemOptionsEditorModal.css'; // Specific modal styles

const API_BASE_URL = 'http://localhost:3001/api/menu';

function ItemOptionsEditorModal({ item, isOpen, onClose }) {
    const [options, setOptions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null); // General error for the modal
    const { getToken, logout } = useAuth();

    // Form state for adding/editing an option
    const [isEditingOption, setIsEditingOption] = useState(false);
    const [currentOption, setCurrentOption] = useState(null);
    const [optionGroupName, setOptionGroupName] = useState('');
    const [optionName, setOptionName] = useState('');
    const [optionAdditionalPrice, setOptionAdditionalPrice] = useState('');
    const [formError, setFormError] = useState(''); // Specific error for the form

    const fetchItemWithOptions = useCallback(async () => {
        if (!item || !item.item_id) return;
        setIsLoading(true);
        setError(null);
        try {
            // Fetch the item again to get its latest options
            // Our GET /api/menu/items/:itemId endpoint already includes grouped options
            const response = await fetch(`<span class="math-inline">\{API\_BASE\_URL\}/items/</span>{item.item_id}`);
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || `Failed to fetch item options. Status: ${response.status}`);
            }
            const detailedItem = await response.json();
            // The options are expected to be grouped like: { "Size": [{...}], "Toppings": [{...}] }
            // We need to flatten this for easier list management and then re-group for display if needed,
            // or directly use the grouped structure. Let's try to flatten for the list.
            const flattenedOptions = [];
            if (detailedItem.options) {
                Object.keys(detailedItem.options).forEach(group => {
                    detailedItem.options[group].forEach(opt => {
                        flattenedOptions.push({ ...opt, option_group_name: group, item_id: item.item_id });
                    });
                });
            }
            setOptions(flattenedOptions);
        } catch (err) {
            setError(err.message);
            console.error("Fetch item options error:", err);
        } finally {
            setIsLoading(false);
        }
    }, [item]);

    useEffect(() => {
        if (isOpen && item) {
            fetchItemWithOptions();
        } else {
            // Reset when modal is closed or item is not available
            setOptions([]);
            resetOptionForm();
        }
    }, [isOpen, item, fetchItemWithOptions]);


    const resetOptionForm = () => {
        setIsEditingOption(false);
        setCurrentOption(null);
        setOptionGroupName('');
        setOptionName('');
        setOptionAdditionalPrice('');
        setFormError('');
    };

    const handleEditOption = (option) => {
        setIsEditingOption(true);
        setCurrentOption(option);
        setOptionGroupName(option.option_group_name);
        setOptionName(option.name || option.option_name); // API returns 'name' inside option group
        setOptionAdditionalPrice(String(option.additional_price || 0));
        setFormError('');
    };

    const handleOptionSubmit = async (e) => {
        e.preventDefault();
        setFormError('');
        if (!optionGroupName.trim() || !optionName.trim()) {
            setFormError('Option Group and Name are required.');
            return;
        }
        const price = parseFloat(optionAdditionalPrice);
        if (optionAdditionalPrice !== '' && (isNaN(price) || price < 0) ) {
             setFormError('Additional Price must be a valid non-negative number or empty for 0.');
             return;
        }


        setIsLoading(true);
        const token = getToken();
        if (!token) { setError("Authentication error."); logout(); setIsLoading(false); return; }

        const payload = {
            option_group_name: optionGroupName,
            option_name: optionName,
            additional_price: optionAdditionalPrice === '' ? 0.00 : price,
        };

        const url = isEditingOption
            ? `<span class="math-inline">\{API\_BASE\_URL\}/options/</span>{currentOption.option_id}`
            : `<span class="math-inline">\{API\_BASE\_URL\}/items/</span>{item.item_id}/options`;
        const method = isEditingOption ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });
            const responseData = await response.json();
            if (!response.ok) {
                throw new Error(responseData.message || `Failed to ${isEditingOption ? 'update' : 'create'} option.`);
            }
            fetchItemWithOptions(); // Re-fetch all options for the item
            resetOptionForm();
        } catch (err) {
            console.error(`Option ${isEditingOption ? 'update' : 'creation'} error:`, err);
            setFormError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteOption = async (optionId, optionDesc) => {
        if (!window.confirm(`Are you sure you want to delete the option "${optionDesc}"?`)) {
            return;
        }
        setIsLoading(true);
        setFormError(''); setError(null); // Clear errors
        const token = getToken();
        if (!token) { /* ... auth error handling ... */ }

        try {
            const response = await fetch(`<span class="math-inline">\{API\_BASE\_URL\}/options/</span>{optionId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            const responseData = await response.json();
            if (!response.ok) {
                throw new Error(responseData.message || 'Failed to delete option.');
            }
            fetchItemWithOptions(); // Refresh list
        } catch (err) {
            console.error("Delete option error:", err);
            // Display this error near the list or as a general modal error
            setError(err.message); // Set general modal error for delete issues
        } finally {
            setIsLoading(false);
        }
    };


    if (!isOpen || !item) return null;

    // Group options for display
    const groupedDisplayOptions = options.reduce((acc, opt) => {
        (acc[opt.option_group_name] = acc[opt.option_group_name] || []).push(opt);
        return acc;
    }, {});


    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content item-options-editor-modal" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close-btn" onClick={onClose}>&times;</button>
                <h3>Manage Options for: {item.name}</h3>
                {error && <p className="error-message">{error}</p>}

                <div className="manager-container option-form-container">
                    <h4>{isEditingOption ? 'Edit Option' : 'Add New Option'}</h4>
                    <form onSubmit={handleOptionSubmit} className="manager-form compact-form">
                        {formError && <p className="error-message form-error">{formError}</p>}
                        <div className="form-group">
                            <label htmlFor="optionGroupName">Group Name:</label>
                            <input type="text" id="optionGroupName" value={optionGroupName} onChange={(e) => setOptionGroupName(e.target.value)} required placeholder="e.g., Size, Toppings" disabled={isLoading}/>
                        </div>
                        <div className="form-group">
                            <label htmlFor="optionName">Option Name:</label>
                            <input type="text" id="optionName" value={optionName} onChange={(e) => setOptionName(e.target.value)} required placeholder="e.g., Large, Extra Cheese" disabled={isLoading}/>
                        </div>
                        <div className="form-group">
                            <label htmlFor="optionAdditionalPrice">Additional Price (Optional):</label>
                            <input type="number" id="optionAdditionalPrice" value={optionAdditionalPrice} onChange={(e) => setOptionAdditionalPrice(e.target.value)} step="0.01" min="0" placeholder="0.00" disabled={isLoading}/>
                        </div>
                        <div className="form-actions">
                            <button type="submit" className="submit-btn" disabled={isLoading}>
                                {isLoading ? (isEditingOption ? 'Updating...' : 'Adding...') : (isEditingOption ? 'Update Option' : 'Add Option')}
                            </button>
                            {isEditingOption && (
                                <button type="button" className="cancel-btn" onClick={resetOptionForm} disabled={isLoading}>Cancel Edit</button>
                            )}
                        </div>
                    </form>
                </div>

                <hr className="form-divider" />
                <h4>Existing Options for {item.name}</h4>
                {isLoading && options.length === 0 && <p>Loading options...</p>}
                {!isLoading && !error && options.length === 0 && <p>No options defined for this item yet.</p>}

                {Object.keys(groupedDisplayOptions).map(groupName => (
                    <div key={groupName} className="option-group-display">
                        <h5>{groupName}</h5>
                        <ul className="manager-list options-list">
                            {groupedDisplayOptions[groupName].map(opt => (
                                <li key={opt.option_id} className="manager-list-item option-item">
                                    <span>{opt.name || opt.option_name} (+{formatCurrency(opt.additional_price)})</span>
                                    <div className="item-actions">
                                        <button onClick={() => handleEditOption(opt)} className="edit-btn small-btn">Edit</button>
                                        <button onClick={() => handleDeleteOption(opt.option_id, `${groupName} - ${opt.name || opt.option_name}`)} className="delete-btn small-btn" disabled={isLoading}>Del</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default ItemOptionsEditorModal;