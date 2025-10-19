import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './Orders.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://localhost:7207';

const Orders = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [expandedOrder, setExpandedOrder] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    // Check for success message from checkout
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      // Clear the state
      window.history.replaceState({}, document.title);
    }

    fetchOrders();
  }, [isAuthenticated, navigate, location.state]);

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/orders`);
      setOrders(response.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError('Failed to load orders');
      setLoading(false);
    }
  };

  const toggleOrderDetails = (orderId) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { icon: '⏳', color: '#d4af37', label: 'Pending' },
      paid: { icon: '✅', color: '#c4956f', label: 'Paid' },
      shipped: { icon: '🚚', color: '#8b7355', label: 'Shipped' },
      delivered: { icon: '📦', color: '#c4956f', label: 'Delivered' },
      cancelled: { icon: '❌', color: '#a85c3a', label: 'Cancelled' }
    };

    const config = statusConfig[status] || statusConfig.pending;
    
    return (
      <span className="status-badge" style={{ borderColor: config.color, color: config.color }}>
        {config.icon} {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="cinema-loader">
          <div className="loader-ring"></div>
          <div className="loader-ring"></div>
          <div className="loader-ring"></div>
        </div>
        <p className="loading-text">📦 LOADING ORDERS...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-content">
          <h2>🚨 ERROR</h2>
          <p>{error}</p>
          <Link to="/" className="btn btn-primary">⬅️ BACK TO STORE</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="orders-container">
      <div className="orders-header">
        <h2>📦 MY ORDERS</h2>
      </div>

      {successMessage && (
        <div className="success-message">
          ✅ {successMessage}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="empty-orders">
          <div className="empty-orders-icon">📦</div>
          <h3>No orders yet</h3>
          <p>Start shopping to create your first order!</p>
          <Link to="/" className="btn btn-primary">
            ⚡ BROWSE PRODUCTS
          </Link>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map((order) => (
            <div key={order.id} className="order-card">
              <div className="order-header" onClick={() => toggleOrderDetails(order.id)}>
                <div className="order-header-info">
                  <div className="order-id-section">
                    <h3>Order #{order.id}</h3>
                    {getStatusBadge(order.status)}
                  </div>
                  <div className="order-meta">
                    <span className="order-date">
                      📅 {new Date(order.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    <span className="order-total">
                      💰 ${order.totalAmount.toFixed(2)}
                    </span>
                    <span className="order-items-count">
                      📦 {order.items.reduce((sum, item) => sum + item.quantity, 0)} items
                    </span>
                  </div>
                </div>
                <button className="expand-btn">
                  {expandedOrder === order.id ? '▲' : '▼'}
                </button>
              </div>

              {expandedOrder === order.id && (
                <div className="order-details">
                  <div className="order-items">
                    {order.items.map((item) => (
                      <div key={item.id} className="order-item">
                        <div className="order-item-info">
                          <h4>{item.productName}</h4>
                          <p className="order-item-price">
                            ${item.price.toFixed(2)} × {item.quantity}
                          </p>
                        </div>
                        <div className="order-item-subtotal">
                          ${item.subtotal.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="order-summary">
                    <div className="summary-row">
                      <span>Subtotal:</span>
                      <span>${order.totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="summary-row">
                      <span>Shipping:</span>
                      <span className="free-badge">FREE</span>
                    </div>
                    <div className="summary-divider"></div>
                    <div className="summary-row summary-total">
                      <span>Total:</span>
                      <span>${order.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Orders;
