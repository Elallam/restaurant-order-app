// frontend-admin/src/App.jsx
import './App.css'; // Main admin styles
import { useAuth } from './context/AuthContext';
import LoginPage from './components/LoginPage';
import OrdersDashboard from './Components/OrdersDashboard';
function App() {
  const { authState, logout } = useAuth();

  return (
    <div className="admin-app-container">
      <header className="admin-app-header">
        <h1>Restaurant Admin Panel</h1>
        {authState.isAuthenticated && authState.user && (
          <div className="user-info">
            <span>Welcome, {authState.user.username} ({authState.user.role})!</span>
            <button onClick={logout} className="logout-btn">Logout</button>
          </div>
        )}
      </header>
      <main>
        {authState.isAuthenticated ? <OrdersDashboard /> : <LoginPage />}
      </main>
      <footer className="admin-app-footer">
        <p>&copy; {new Date().getFullYear()} Your Restaurant Name - Admin Panel</p>
      </footer>
    </div>
  );
}

export default App;