// frontend-admin/src/App.jsx
import { useState } from 'react'; // Added useState
import './App.css';
import { useAuth } from './context/AuthContext';
import LoginPage from './components/LoginPage';
import OrdersDashboard from './components/OrdersDashboard';
import MenuManagementPage from './components/MenuManagementPage'; // Import MenuManagementPage

function App() {
  const { authState, logout } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard' or 'menu'

  const renderView = () => {
    if (!authState.isAuthenticated) {
      return <LoginPage />;
    }
    switch (currentView) {
      case 'menu':
        return <MenuManagementPage />;
      case 'dashboard':
      default:
        return <OrdersDashboard />;
    }
  };

  return (
    <div className="admin-app-container">
      <header className="admin-app-header">
        <h1>Restaurant Admin Panel</h1>
        {authState.isAuthenticated && authState.user && (
          <div className="user-info">
            <span>Welcome, {authState.user.username} ({authState.user.role})!</span>
            <nav className="admin-nav">
                <button
                    onClick={() => setCurrentView('dashboard')}
                    className={currentView === 'dashboard' ? 'active' : ''}
                >
                    Order Dashboard
                </button>
                <button
                    onClick={() => setCurrentView('menu')}
                    className={currentView === 'menu' ? 'active' : ''}
                >
                    Menu Management
                </button>
            </nav>
            <button onClick={logout} className="logout-btn">Logout</button>
          </div>
        )}
      </header>
      <main>
        {renderView()}
      </main>
      <footer className="admin-app-footer">
        <p>&copy; {new Date().getFullYear()} Your Restaurant Name - Admin Panel</p>
      </footer>
    </div>
  );
}

export default App;