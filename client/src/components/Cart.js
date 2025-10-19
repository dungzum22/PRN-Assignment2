import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './Cart.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://localhost:7207';

const Cart = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState({});
  const [error, setError] = useState('');
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [itemToRemove, setItemToRemove] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const fetchCart = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/cart`);
      setCart(res.data);
    } catch (err) {
      console.error('Failed to load cart', err);
      setError('Failed to load cart');
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (itemId, quantity) => {
    if (quantity < 1) return;
    setUpdating(prev => ({ ...prev, [itemId]: true }));
    try {
      await axios.put(`${API_BASE_URL}/api/cart/items/${itemId}`, { quantity });
      await fetchCart();
    } catch (err) {
      console.error('Failed to update quantity', err);
      setError('Failed to update item');
    } finally {
      setUpdating(prev => ({ ...prev, [itemId]: false }));
    }
  };

  const removeItem = async (itemId) => {
    if (!itemToRemove) return;
    
    setUpdating(prev => ({ ...prev, [itemToRemove.id]: true }));
    try {
      await axios.delete(`${API_BASE_URL}/api/cart/items/${itemToRemove.id}`);
      await fetchCart();
      setShowRemoveModal(false);
      setItemToRemove(null);
    } catch (err) {
      console.error('Failed to remove item', err);
      setError('Failed to remove item');
    } finally {
      setUpdating(prev => ({ ...prev, [itemToRemove.id]: false }));
    }
  };

  const handleRemoveClick = (item) => {
    setItemToRemove(item);
    setShowRemoveModal(true);
  };

  const handleRemoveCancel = () => {
    setShowRemoveModal(false);
    setItemToRemove(null);
  };

  if (loading) return <div className="loading">Loading cart...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!cart || !cart.items || cart.items.length === 0) {
    return (
      <div className="empty-cart">
        <h3>Your cart is empty</h3>
        <Link to="/" className="btn btn-primary">Continue Shopping</Link>
      </div>
    );
  }

  return (
    <div className="cart-container">
      {/* Remove Item Confirmation Modal */}
      {showRemoveModal && itemToRemove && (
        <div className="modal-overlay" onClick={handleRemoveCancel}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Remove Item</h3>
              <button className="close-button" onClick={handleRemoveCancel}>×</button>
            </div>
            <div className="modal-body">
              <p className="modal-message">
                Are you sure you want to remove <span className="product-name">"{itemToRemove.productName}"</span> from your cart?
              </p>
            </div>
            <div className="modal-actions">
              <button 
                onClick={handleRemoveCancel} 
                className="btn btn-secondary modal-btn"
                disabled={updating[itemToRemove.id]}
              >
                Cancel
              </button>
              <button 
                onClick={removeItem} 
                className="btn btn-danger modal-btn"
                disabled={updating[itemToRemove.id]}
              >
                {updating[itemToRemove.id] ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      <h2>🛒 Your Cart</h2>
      <div className="cart-items">
        {cart.items.map(item => (
          <div key={item.id} className="cart-item">
            <div className="item-info">
              <div className="item-name">{item.productName}</div>
              <div className="item-price">${item.price.toFixed(2)}</div>
            </div>
            <div className="item-controls">
              <div
                className="quantity-controls"
                role="group"
                aria-label={`Quantity for ${item.productName}`}>
                <button
                  aria-label={`Decrease quantity for ${item.productName}`}
                  className="quantity-btn"
                  onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                  disabled={updating[item.id] || item.quantity <= 1}
                >
                  −
                </button>

                <div
                  className="quantity-display"
                  tabIndex={0}
                  role="spinbutton"
                  aria-valuemin={1}
                  aria-valuenow={item.quantity}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      updateQuantity(item.id, item.quantity + 1);
                    } else if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      updateQuantity(item.id, Math.max(1, item.quantity - 1));
                    }
                  }}
                >
                  {updating[item.id] ? '...' : item.quantity}
                </div>

                <button
                  aria-label={`Increase quantity for ${item.productName}`}
                  className="quantity-btn"
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  disabled={updating[item.id]}
                >
                  +
                </button>
              </div>

              <button onClick={() => handleRemoveClick(item)} disabled={updating[item.id]} className="btn btn-danger">Remove</button>
            </div>
            <div className="item-subtotal">${item.subtotal.toFixed(2)}</div>
          </div>
        ))}
      </div>

      <div className="cart-summary">
        <div>Total items: {cart.items.reduce((s, it) => s + it.quantity, 0)}</div>
        <div>Total: ${cart.totalAmount.toFixed(2)}</div>
        <div className="cart-actions">
          <Link to="/checkout" className="btn btn-primary">Proceed to Checkout</Link>
          <Link to="/" className="btn btn-secondary">Continue Shopping</Link>
        </div>
      </div>
    </div>
  );
};

export default Cart;
