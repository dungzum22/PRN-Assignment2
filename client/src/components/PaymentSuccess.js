import React, { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './PaymentSuccess.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasCreatedOrder = useRef(false); // Prevent duplicate order creation

  const paymentIntentId = searchParams.get('payment_intent');
  const orderId = searchParams.get('order_id');
  const paymentMethod = searchParams.get('payment_method');
  const paymentIntentClientSecret = searchParams.get('payment_intent_client_secret');
  const redirectStatus = searchParams.get('redirect_status');

  useEffect(() => {
    // Check if we just came back from Stripe payment
    if (paymentIntentId && redirectStatus === 'succeeded' && !hasCreatedOrder.current) {
      console.log('Payment succeeded! Creating order...');
      hasCreatedOrder.current = true; // Mark as creating to prevent duplicate
      createOrderFromPayment();
    } else if (orderId && !hasCreatedOrder.current) {
      // Direct access with order ID (cash on delivery flow)
      hasCreatedOrder.current = true;
      fetchOrderDetails();
    } else if (paymentIntentId && !hasCreatedOrder.current) {
      // If we have payment intent but no order ID, fetch latest order
      hasCreatedOrder.current = true;
      fetchLatestOrder();
    } else if (!hasCreatedOrder.current) {
      // No order info at all
      if (!isAuthenticated) {
        navigate('/login');
      } else {
        setLoading(false);
      }
    }
  }, [orderId, paymentIntentId, redirectStatus]);

  const fetchOrderDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No token found in localStorage');
        navigate('/login');
        return;
      }

      console.log('Fetching order with ID:', orderId);
      console.log('Using token:', token.substring(0, 20) + '...');

      // Fetch specific order if orderId is provided
      if (orderId) {
        const response = await axios.get(`${API_BASE_URL}/api/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Order fetched successfully:', response.data);
        setOrder(response.data);
      }
    } catch (err) {
      console.error('Error fetching order:', err);
      console.error('Error response:', err.response);
      if (err.response?.status === 401) {
        console.error('401 Unauthorized - redirecting to login');
        navigate('/login');
      } else if (err.response?.status === 404) {
        console.error('Order not found');
        // Try fetching latest order instead
        fetchLatestOrder();
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchLatestOrder = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No token found in localStorage');
        navigate('/login');
        return;
      }

      console.log('Fetching latest order');
      
      const response = await axios.get(`${API_BASE_URL}/api/orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const orders = response.data;
      console.log('Orders fetched:', orders.length);
      
      if (orders && orders.length > 0) {
        const latestOrder = orders[0];
        console.log('Latest order:', latestOrder);
        
        // If we have a payment intent ID, try to match it
        if (paymentIntentId && latestOrder.paymentIntentId !== paymentIntentId) {
          // Find the order matching the payment intent
          const matchingOrder = orders.find(o => o.paymentIntentId === paymentIntentId);
          if (matchingOrder) {
            console.log('Found matching order by payment intent:', matchingOrder);
            setOrder(matchingOrder);
          } else {
            console.log('No matching order found, using latest');
            setOrder(latestOrder);
          }
        } else {
          setOrder(latestOrder);
        }
      }
    } catch (err) {
      console.error('Error fetching latest order:', err);
      if (err.response?.status === 401) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const createOrderFromPayment = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No token found - redirecting to login');
        navigate('/login');
        return;
      }

      console.log('Creating order for payment intent:', paymentIntentId);

      // Create order with Stripe payment method
      const orderResponse = await axios.post(`${API_BASE_URL}/api/orders`, {
        paymentMethod: 'stripe'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const createdOrder = orderResponse.data;
      console.log('Order created:', createdOrder);

      // Update order with payment intent ID
      await axios.put(`${API_BASE_URL}/api/orders/${createdOrder.id}`, {
        paymentIntentId: paymentIntentId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('Order updated with payment intent ID');

      // Update order status to "paid" since payment was successful
      await axios.put(`${API_BASE_URL}/api/orders/${createdOrder.id}/status`, 
        JSON.stringify('paid'),
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Order status updated to paid');

      // Fetch the complete order details
      const response = await axios.get(`${API_BASE_URL}/api/orders/${createdOrder.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setOrder(response.data);
      console.log('Final order details:', response.data);
    } catch (err) {
      console.error('Error creating order from payment:', err);
      console.error('Error details:', err.response?.data);
      
      if (err.response?.status === 401) {
        navigate('/login');
      } else {
        // Try to fetch the latest order as fallback
        console.log('Fallback: fetching latest order');
        try {
          await fetchLatestOrder();
        } catch (fetchErr) {
          console.error('Error in fallback fetch:', fetchErr);
          setError('Failed to load order details. Please check your orders page.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="cyber-loader">
          <div className="loader-ring"></div>
          <div className="loader-ring"></div>
          <div className="loader-ring"></div>
        </div>
        <p className="loading-text">⚡ PROCESSING PAYMENT...</p>
      </div>
    );
  }

  return (
    <div className="payment-success-container">
      <div className="success-card">
        {error && (
          <div className="error-banner">
            <p>⚠️ {error}</p>
            <Link to="/orders" className="btn btn-secondary">View All Orders</Link>
          </div>
        )}
        
        <div className="success-icon">
          <div className="checkmark-circle">
            <div className="checkmark"></div>
          </div>
        </div>

        <h1 className="success-title">🎉 {paymentMethod === 'cash' ? 'Order Placed!' : 'Payment Successful!'}</h1>
        <p className="success-message">
          {paymentMethod === 'cash' 
            ? 'Your order has been placed successfully. Please pay cash on delivery.' 
            : 'Your order has been placed and payment confirmed.'}
        </p>

        {paymentIntentId && (
          <div className="payment-details">
            <div className="detail-row">
              <span className="detail-label">Payment ID:</span>
              <span className="detail-value">{paymentIntentId}</span>
            </div>
          </div>
        )}

        {order && (
          <div className="order-summary-section">
            <h3>📦 Order Summary</h3>
            <div className="order-info">
              <div className="info-row">
                <span>Order ID:</span>
                <span>#{order.id}</span>
              </div>
              <div className="info-row">
                <span>Status:</span>
                <span className={`status-badge status-${order.status}`}>
                  {order.status === 'pending' && paymentMethod === 'cash' ? '💵 Pending (Cash on Delivery)' : order.status}
                </span>
              </div>
              <div className="info-row">
                <span>Payment Method:</span>
                <span>{order.paymentMethod === 'cash' ? '💵 Cash on Delivery' : '💳 Card Payment'}</span>
              </div>
              <div className="info-row">
                <span>Total Amount:</span>
                <span className="amount">${order.totalAmount.toFixed(2)}</span>
              </div>
              <div className="info-row">
                <span>Order Date:</span>
                <span>{new Date(order.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            {order.items && order.items.length > 0 && (
              <div className="items-list">
                <h4>Items:</h4>
                {order.items.map((item, index) => (
                  <div key={index} className="order-item">
                    <span>{item.productName}</span>
                    <span>×{item.quantity}</span>
                    <span>${item.subtotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="success-actions">
          <Link to="/orders" className="btn btn-primary">
            📦 View My Orders
          </Link>
          <Link to="/" className="btn btn-secondary">
            🏠 Continue Shopping
          </Link>
        </div>

        <div className="success-note">
          <p>
            📧 A confirmation email has been sent to your registered email address.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
