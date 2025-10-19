import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProductList from './components/ProductList';
import ProductDetail from './components/ProductDetail';
import ProductForm from './components/ProductForm';
import Login from './components/Login';
import Register from './components/Register';
import Cart from './components/Cart';
import Checkout from './components/Checkout';
import Orders from './components/Orders';
import PaymentSuccess from './components/PaymentSuccess';
import './App.css';

function NavigationBar() {
  const { user, logout, isAuthenticated } = useAuth();

  return (
    <nav className="navbar">
      <div className="nav-container">
        <h1 className="nav-logo">
          <Link to="/">🎬 SHOP NEW 🎬</Link>
        </h1>
        <ul className="nav-menu">
          <li className="nav-item">
            <Link to="/" className="nav-link">🏠 Home</Link>
          </li>
          {isAuthenticated ? (
            <>
              <li className="nav-item">
                <Link to="/cart" className="nav-link">🛒 Cart</Link>
              </li>
              <li className="nav-item">
                <Link to="/orders" className="nav-link">📦 Orders</Link>
              </li>
              <li className="nav-item">
                <Link to="/products/new" className="nav-link">➕ Add Product</Link>
              </li>
              <li className="nav-item nav-user">
                <span className="user-email">👤 {user?.fullName}</span>
              </li>
              <li className="nav-item">
                <button onClick={logout} className="nav-link logout-btn">
                  🚪 Logout
                </button>
              </li>
            </>
          ) : (
            <>
              <li className="nav-item">
                <Link to="/login" className="nav-link">🔑 Login</Link>
              </li>
              <li className="nav-item">
                <Link to="/register" className="nav-link">📝 Register</Link>
              </li>
            </>
          )}
        </ul>
      </div>
    </nav>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <NavigationBar />

          <main className="main-content">
            <Routes>
              <Route path="/" element={<ProductList />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/payment-success" element={<PaymentSuccess />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/products/new" element={<ProductForm />} />
              <Route path="/products/edit/:id" element={<ProductForm />} />
              <Route path="/products/:id" element={<ProductDetail />} />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;