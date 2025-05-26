// frontend-admin/src/components/MenuManagementPage.jsx
import React from 'react';
import CategoriesManager from './CategoriesManager';
import ItemsManager from './ItemsManager'; // Import ItemsManager
// import OptionsManager from './OptionsManager'; // For later
import './MenuManagementPage.css';

function MenuManagementPage() {
    return (
        <div className="menu-management-page">
            <h2>Menu Management</h2>
            <p>Manage your restaurant's menu categories, items, and options from here.</p>
            <hr />
            <div className="management-section">
                <CategoriesManager />
            </div>

            <hr />
            <div className="management-section">
                {/* <h3>Menu Items</h3> Remove if ItemsManager has its own title */}
                <ItemsManager /> {/* Use the ItemsManager component */}
            </div>

            {/*
            <hr />
            <div className="management-section">
                <h3>Item Options</h3>
                <p><em>Item options management UI will go here.</em></p>
            </div>
            */}
        </div>
    );
}

export default MenuManagementPage;