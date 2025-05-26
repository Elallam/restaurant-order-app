// frontend-admin/src/components/CategoriesManager.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import './ManagerForms.css'; // Shared styles for forms

function CategoriesManager() {
    const [categories, setCategories] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const { getToken, logout } = useAuth();

    // Form state for adding/editing
    const [isEditing, setIsEditing] = useState(false);
    const [currentCategory, setCurrentCategory] = useState(null); // For storing category being edited
    const [categoryName, setCategoryName] = useState('');
    const [categoryDescription, setCategoryDescription] = useState('');
    const [formError, setFormError] = useState('');

    const API_URL = 'http://localhost:3001/api/menu/categories';

    const fetchCategories = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // This is a public endpoint, but good to be consistent if we add auth later for reads too
            const response = await fetch(API_URL);
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || `Failed to fetch categories. Status: ${response.status}`);
            }
            const data = await response.json();
            setCategories(data);
        } catch (err) {
            setError(err.message);
            console.error("Fetch categories error:", err);
        } finally {
            setIsLoading(false);
        }
    }, []); // No dependencies, API_URL is constant

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    const resetForm = () => {
        setIsEditing(false);
        setCurrentCategory(null);
        setCategoryName('');
        setCategoryDescription('');
        setFormError('');
    };

    const handleEdit = (category) => {
        setIsEditing(true);
        setCurrentCategory(category);
        setCategoryName(category.name);
        setCategoryDescription(category.description || '');
        setFormError('');
        window.scrollTo(0, 0); // Scroll to top where form might be
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError('');
        setIsLoading(true); // Indicate loading for the form submission

        if (!categoryName.trim()) {
            setFormError('Category name cannot be empty.');
            setIsLoading(false);
            return;
        }

        const token = getToken();
        if (!token) {
            setError("Authentication error. Please log in again.");
            logout(); // Log out if token is missing
            setIsLoading(false);
            return;
        }

        const payload = {
            name: categoryName,
            description: categoryDescription,
        };

        const url = isEditing ? `<span class="math-inline">\{API\_URL\}/</span>{currentCategory.category_id}` : API_URL;
        const method = isEditing ? 'PUT' : 'POST';

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
                throw new Error(responseData.message || `Failed to ${isEditing ? 'update' : 'create'} category.`);
            }

            fetchCategories(); // Re-fetch categories to show the new/updated one
            resetForm();
            // Optionally show a success message
        } catch (err) {
            console.error(`Category ${isEditing ? 'update' : 'creation'} error:`, err);
            setFormError(err.message || `An unexpected error occurred.`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (categoryId, categoryName) => {
        if (!window.confirm(`Are you sure you want to delete the category "${categoryName}"? This might affect menu items.`)) {
            return;
        }
        setIsLoading(true);
        setFormError(''); // Clear previous form errors
        setError(''); // Clear general errors

        const token = getToken();
        if (!token) { /* ... auth error handling ... */ }

        try {
            const response = await fetch(`<span class="math-inline">\{API\_URL\}/</span>{categoryId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            const responseData = await response.json();
            if (!response.ok) {
                throw new Error(responseData.message || 'Failed to delete category.');
            }
            fetchCategories(); // Refresh list
            // Optionally show success message
        } catch (err) {
            console.error("Delete category error:", err);
            setError(err.message); // Show error related to delete operation
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <div className="manager-container">
            <h4>{isEditing ? 'Edit Category' : 'Add New Category'}</h4>
            <form onSubmit={handleSubmit} className="manager-form">
                {formError && <p className="error-message form-error">{formError}</p>}
                <div className="form-group">
                    <label htmlFor="categoryName">Name:</label>
                    <input
                        type="text"
                        id="categoryName"
                        value={categoryName}
                        onChange={(e) => setCategoryName(e.target.value)}
                        placeholder="e.g., Appetizers, Main Courses"
                        required
                        disabled={isLoading}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="categoryDescription">Description (Optional):</label>
                    <textarea
                        id="categoryDescription"
                        value={categoryDescription}
                        onChange={(e) => setCategoryDescription(e.target.value)}
                        placeholder="e.g., A brief description of the category"
                        rows="3"
                        disabled={isLoading}
                    />
                </div>
                <div className="form-actions">
                    <button type="submit" className="submit-btn" disabled={isLoading}>
                        {isLoading ? (isEditing ? 'Updating...' : 'Adding...') : (isEditing ? 'Update Category' : 'Add Category')}
                    </button>
                    {isEditing && (
                        <button type="button" className="cancel-btn" onClick={resetForm} disabled={isLoading}>
                            Cancel Edit
                        </button>
                    )}
                </div>
            </form>

            <hr className="form-divider" />

            <h4>Existing Categories</h4>
            {isLoading && categories.length === 0 && <p>Loading categories...</p>}
            {error && <p className="error-message">{error}</p>}
            {!isLoading && !error && categories.length === 0 && <p>No categories found. Add one above!</p>}

            {categories.length > 0 && (
                <ul className="manager-list">
                    {categories.map(cat => (
                        <li key={cat.category_id} className="manager-list-item">
                            <div>
                                <strong>{cat.name}</strong>
                                <p>{cat.description || 'No description'}</p>
                            </div>
                            <div className="item-actions">
                                <button onClick={() => handleEdit(cat)} className="edit-btn">Edit</button>
                                <button onClick={() => handleDelete(cat.category_id, cat.name)} className="delete-btn" disabled={isLoading}>Delete</button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default CategoriesManager;