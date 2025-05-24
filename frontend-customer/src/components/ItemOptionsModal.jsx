// src/components/ItemOptionsModal.jsx
import { useState, useEffect } from 'react';
import './ItemOptionsModal.css'; // We'll create this CSS file

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

function ItemOptionsModal({ item, isOpen, onClose, onAddToCartWithOptions }) {
    const [selectedOptions, setSelectedOptions] = useState({}); // Store as { option_group_name: option_id } or { option_group_name: [option_id1, option_id2] } for multi-select
    const [currentPrice, setCurrentPrice] = useState(0);
    const [quantity, setQuantity] = useState(1);

    useEffect(() => {
        if (item) {
            // Initialize selectedOptions with defaults (e.g., first option in each group)
            const initialSelected = {};
            if (item.options) {
                Object.keys(item.options).forEach(groupName => {
                    // Assuming single select for now (radio buttons)
                    // You might need to distinguish between single-select (radio) and multi-select (checkbox) groups
                    if (item.options[groupName] && item.options[groupName].length > 0) {
                        initialSelected[groupName] = item.options[groupName][0].option_id; // Select the first option by default
                    }
                });
            }
            setSelectedOptions(initialSelected);
            setCurrentPrice(parseFloat(item.base_price)); // Initialize with base price
            setQuantity(1); // Reset quantity when item changes
        }
    }, [item]); // Re-run when the item prop changes

    useEffect(() => {
        if (item && item.options) {
            let calculatedPrice = parseFloat(item.base_price);
            Object.keys(selectedOptions).forEach(groupName => {
                const selectedOptionId = selectedOptions[groupName];
                const optionGroup = item.options[groupName];
                if (optionGroup) {
                    const option = optionGroup.find(opt => opt.option_id === selectedOptionId);
                    if (option) {
                        calculatedPrice += parseFloat(option.additional_price);
                    }
                }
            });
            setCurrentPrice(calculatedPrice);
        }
    }, [selectedOptions, item]);

    if (!isOpen || !item) return null;

    const handleOptionChange = (groupName, optionId, isMultiSelect = false) => {
        setSelectedOptions(prev => {
            const newSelection = { ...prev };
            if (isMultiSelect) {
                // Basic multi-select example (assumes checkboxes for a group)
                const currentGroupSelection = newSelection[groupName] || [];
                if (currentGroupSelection.includes(optionId)) {
                    newSelection[groupName] = currentGroupSelection.filter(id => id !== optionId);
                } else {
                    newSelection[groupName] = [...currentGroupSelection, optionId];
                }
            } else {
                // Single select (radio buttons)
                newSelection[groupName] = optionId;
            }
            return newSelection;
        });
    };

    const handleQuantityChange = (amount) => {
        setQuantity(prev => Math.max(1, prev + amount));
    };

    const handleSubmit = () => {
        const detailedSelectedOptions = [];
        if (item.options) {
             Object.keys(selectedOptions).forEach(groupName => {
                const group = item.options[groupName];
                // Handle single select (option_id directly stored)
                if (group && typeof selectedOptions[groupName] === 'number') {
                    const option = group.find(opt => opt.option_id === selectedOptions[groupName]);
                    if (option) {
                        detailedSelectedOptions.push({
                            option_id: option.option_id,
                            option_group_name: groupName,
                            option_name: option.name,
                            additional_price: option.additional_price
                        });
                    }
                }
                // Handle multi-select (array of option_ids stored)
                else if (group && Array.isArray(selectedOptions[groupName])) {
                    selectedOptions[groupName].forEach(optId => {
                        const option = group.find(opt => opt.option_id === optId);
                        if (option) {
                            detailedSelectedOptions.push({
                                option_id: option.option_id,
                                option_group_name: groupName,
                                option_name: option.name,
                                additional_price: option.additional_price
                            });
                        }
                    });
                }
            });
        }

        onAddToCartWithOptions(item, detailedSelectedOptions, quantity, currentPrice * quantity);
        onClose(); // Close modal after adding
    };


    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>{item.name} - Customize</h2>
                <button className="modal-close-btn" onClick={onClose}>&times;</button>

                {item.options && Object.keys(item.options).map(groupName => (
                    <div key={groupName} className="options-group">
                        <h3>{groupName}</h3>
                        {/* Assuming single select (radio buttons) for simplicity here */}
                        {/* You would need to determine if a group is single/multi-select based on your data or conventions */}
                        {item.options[groupName].map(option => (
                            <label key={option.option_id} className="option-label">
                                <input
                                    type="radio" // Change to "checkbox" for multi-select groups
                                    name={groupName}
                                    value={option.option_id}
                                    checked={selectedOptions[groupName] === option.option_id}
                                    onChange={() => handleOptionChange(groupName, option.option_id)}
                                />
                                {option.name} (+{formatCurrency(option.additional_price)})
                            </label>
                        ))}
                    </div>
                ))}
                {!item.has_options && <p>This item has no additional options.</p>}

                <div className="quantity-selector">
                    <h3>Quantity</h3>
                    <button onClick={() => handleQuantityChange(-1)} disabled={quantity <= 1}>-</button>
                    <span>{quantity}</span>
                    <button onClick={() => handleQuantityChange(1)}>+</button>
                </div>

                <div className="modal-footer">
                    <strong>Total for this item: {formatCurrency(currentPrice * quantity)}</strong>
                    <button className="add-to-cart-modal-btn" onClick={handleSubmit}>
                        Add {quantity} to Order
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ItemOptionsModal;