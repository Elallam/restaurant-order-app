// src/components/MenuCategories.jsx
import { useState, useEffect } from 'react';

function MenuCategories({ onSelectCategory }) { // Pass a function to handle category selection
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        // Ensure your backend URL is correct, including the port
        const response = await fetch('http://localhost:3001/api/menu/categories');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setCategories(data);
      } catch (e) {
        setError(e.message);
        console.error("Failed to fetch categories:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []); // Empty dependency array means this runs once on mount

  if (loading) return <p>Loading categories...</p>;
  if (error) return <p>Error loading categories: {error}</p>;

  return (
    <nav className="categories-nav">
      <h2>Categories</h2>
      {categories.length === 0 ? (
        <p>No categories found.</p>
      ) : (
        <ul>
          {categories.map((category) => (
            <li key={category.category_id}>
              <button onClick={() => onSelectCategory(category.category_id)}>
                {category.name}
              </button>
              {/* <p>{category.description}</p> */}
            </li>
          ))}
           <li>
              <button onClick={() => onSelectCategory(null)}>
                All Items
              </button>
            </li>
        </ul>
      )}
    </nav>
  );
}

export default MenuCategories;