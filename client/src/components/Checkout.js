import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './Checkout.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

// Require a publishable key via environment variable for production safety.
// During local development, use a .env file with REACT_APP_STRIPE_PUBLIC_KEY set.
const stripePubKey = process.env.REACT_APP_STRIPE_PUBLIC_KEY;
if (!stripePubKey) {
  console.warn('REACT_APP_STRIPE_PUBLIC_KEY is not set. Stripe Elements will not initialize.');
}
const stripePromise = loadStripe(stripePubKey);

function PaymentForm({ cart, paymentIntentId }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication required. Please login again.');
        setProcessing(false);
        return;
      }

      console.log('Starting Stripe payment process...');
      console.log('Payment Intent ID:', paymentIntentId);

      // Confirm payment first (this will redirect away from the page)
      const { error: stripeError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment-success?payment_intent=${paymentIntentId}`,
        },
      });

      // This code only runs if there's an error (no redirect happened)
      if (stripeError) {
        console.error('Stripe payment error:', stripeError);
        setError(stripeError.message);
        setProcessing(false);
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err.response?.data?.message || 'Payment failed');
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className='payment-form'>
      {error && <div className='checkout-error'>🚨 {error}</div>}
      <div className='payment-element-container'><PaymentElement /></div>
      <div className='payment-summary-form'>
        <div className='summary-row'>
          <span>Total:</span>
          <span className='total-amount'>${cart.totalAmount.toFixed(2)}</span>
        </div>
      </div>
      <button type='submit' className='btn btn-primary btn-block' disabled={!stripe || processing}>
        {processing ? '⚡ PROCESSING...' : '💳 PAY NOW'}
      </button>
      <Link to='/cart' className='btn btn-secondary btn-block'>⬅️ BACK</Link>
    </form>
  );
}

const Checkout = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [cart, setCart] = useState(null);
  const [clientSecret, setClientSecret] = useState('');
  const [paymentIntentId, setPaymentIntentId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('stripe'); // 'stripe' or 'cash'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const isCreatingPaymentIntent = useRef(false); // Prevent duplicate payment intent creation

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchCart();
  }, [isAuthenticated, navigate]);

  const fetchCart = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/api/cart`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.data.items || response.data.items.length === 0) {
        navigate('/cart');
        return;
      }
      setCart(response.data);
      
      // Only create payment intent for Stripe payments on initial load
      if (paymentMethod === 'stripe' && !clientSecret && !isCreatingPaymentIntent.current) {
        console.log('fetchCart: Creating payment intent...');
        isCreatingPaymentIntent.current = true; // Mark as creating
        try {
          const paymentResponse = await axios.post(`${API_BASE_URL}/api/payment/create-payment-intent`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          });
          console.log('fetchCart: Payment intent response:', paymentResponse.data);
          setClientSecret(paymentResponse.data.clientSecret);
          setPaymentIntentId(paymentResponse.data.paymentIntentId);
          console.log('fetchCart: Payment intent created:', paymentResponse.data.paymentIntentId);
        } catch (paymentErr) {
          console.error('fetchCart: Error creating payment intent:', paymentErr);
          console.error('fetchCart: Error response:', paymentErr.response?.data);
          setError(`Failed to initialize payment: ${paymentErr.response?.data?.message || paymentErr.message}`);
        } finally {
          isCreatingPaymentIntent.current = false; // Reset flag
        }
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error:', err);
      if (err.response?.status === 401) {
        navigate('/login');
        return;
      }
      setError(err.response?.data?.message || 'Failed to load checkout');
      setLoading(false);
    }
  };

  const handleCashOnDelivery = async () => {
    setProcessing(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      const orderResponse = await axios.post(`${API_BASE_URL}/api/orders`, {
        paymentMethod: 'cash'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const order = orderResponse.data;
      navigate(`/payment-success?order_id=${order.id}&payment_method=cash`);
    } catch (err) {
      console.error('Error creating order:', err);
      setError(err.response?.data?.message || 'Failed to create order');
      setProcessing(false);
    }
  };

  useEffect(() => {
    if (cart && paymentMethod === 'stripe' && !clientSecret && !isCreatingPaymentIntent.current) {
      // Fetch payment intent when switching to Stripe
      console.log('useEffect: Creating payment intent because switched to Stripe');
      isCreatingPaymentIntent.current = true; // Mark as creating
      
      const fetchPaymentIntent = async () => {
        try {
          const token = localStorage.getItem('token');
          if (!token) {
            navigate('/login');
            return;
          }

          console.log('useEffect: Calling create-payment-intent API...');
          const paymentResponse = await axios.post(`${API_BASE_URL}/api/payment/create-payment-intent`, {}, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10000 // 10 second timeout
          });
          console.log('useEffect: Payment intent response:', paymentResponse.data);
          setClientSecret(paymentResponse.data.clientSecret);
          setPaymentIntentId(paymentResponse.data.paymentIntentId);
          console.log('useEffect: Payment intent created:', paymentResponse.data.paymentIntentId);
        } catch (err) {
          console.error('useEffect: Error creating payment intent:', err);
          console.error('useEffect: Error details:', err.response?.data);
          if (err.response?.status === 401) {
            navigate('/login');
            return;
          }
          setError(`Failed to initialize payment: ${err.response?.data?.message || err.message || 'Unknown error'}`);
        } finally {
          isCreatingPaymentIntent.current = false; // Reset flag
        }
      };
      fetchPaymentIntent();
    }
  }, [paymentMethod, cart, clientSecret]);

  if (loading) {
    return (
      <div className='loading-container'>
        <div className='cyber-loader'><div className='loader-ring'></div></div>
        <p className='loading-text'>🚀 LOADING CHECKOUT...</p>
      </div>
    );
  }

  if (error && !cart) {
    return (
      <div className='error-container'>
        <div className='error-content'><h2>🚨 ERROR</h2><p>{error}</p>
        <Link to='/cart' className='btn btn-primary'>⬅️ BACK</Link></div>
      </div>
    );
  }

  const stripeOptions = {
    clientSecret,
    appearance: { theme: 'night', variables: { colorPrimary: '#00ffff', colorBackground: '#0a0a0a', colorText: '#e0e0e0' } }
  };

  return (
    <div className='checkout-container'>
      <div className='checkout-header'><h2>🔒 SECURE CHECKOUT</h2></div>
      <div className='checkout-content'>
        <div className='checkout-main'>
          <div className='checkout-section'>
            <h3>👤 CUSTOMER INFO</h3>
            <div className='info-card'>
              <div className='info-row'><span>Email:</span><span>{user?.email}</span></div>
            </div>
          </div>
          <div className='checkout-section'>
            <h3>📦 ORDER ITEMS</h3>
            <div className='checkout-items'>
              {cart && cart.items.map((item) => (
                <div key={item.id} className='checkout-item'>
                  <div className='checkout-item-details'>
                    <h4>{item.productName}</h4>
                    <p>🔢 Qty: {item.quantity}</p>
                  </div>
                  <div className='checkout-item-price'>${item.price.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>
          <div className='checkout-section'>
            <h3>💳 PAYMENT METHOD</h3>
            <div className='payment-card'>
              <div className='payment-method-selector'>
                <button 
                  type='button'
                  className={`payment-method-btn ${paymentMethod === 'stripe' ? 'active' : ''}`}
                  onClick={() => setPaymentMethod('stripe')}
                >
                  💳 Credit/Debit Card (Stripe)
                </button>
                <button 
                  type='button'
                  className={`payment-method-btn ${paymentMethod === 'cash' ? 'active' : ''}`}
                  onClick={() => setPaymentMethod('cash')}
                >
                  � Cash on Delivery
                </button>
              </div>

              {paymentMethod === 'stripe' && (
                <div className='stripe-payment-section'>
                  <p className='payment-note'> Secure payment via Stripe</p>
                  
                  {error && <div className='checkout-error'>🚨 {error}</div>}
                  
                  {clientSecret ? (
                    <Elements stripe={stripePromise} options={stripeOptions}>
                      <PaymentForm cart={cart} paymentIntentId={paymentIntentId} />
                    </Elements>
                  ) : (
                    <div className='loading-payment'>
                      <div className='cyber-loader'><div className='loader-ring'></div></div>
                      <p>⚡ Initializing payment...</p>
                      <p style={{fontSize: '12px', color: '#888', marginTop: '10px'}}>
                        If this takes too long, try refreshing the page or switching to Cash on Delivery
                      </p>
                    </div>
                  )}
                </div>
              )}

              {paymentMethod === 'cash' && (
                <div className='cash-payment-section'>
                  <p className='payment-note'>💵 Pay cash when your order is delivered</p>
                  <div className='cash-info'>
                    <p>✓ No online payment required</p>
                    <p>✓ Pay at the time of delivery</p>
                    <p>✓ Order will be marked as "Pending"</p>
                  </div>
                  <div className='payment-summary-form'>
                    <div className='summary-row'>
                      <span>Total to Pay on Delivery:</span>
                      <span className='total-amount'>${cart.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                  <button 
                    type='button'
                    className='btn btn-primary btn-block' 
                    onClick={handleCashOnDelivery}
                    disabled={processing}
                  >
                    {processing ? '⚡ PROCESSING...' : '✓ PLACE ORDER'}
                  </button>
                  <Link to='/cart' className='btn btn-secondary btn-block'>⬅️ BACK TO CART</Link>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className='checkout-sidebar'>
          <div className='summary-card'>
            <h3>📊 SUMMARY</h3>
            <div className='summary-row'><span>Items:</span><span>{cart && cart.items.reduce((s,i) => s + i.quantity, 0)}</span></div>
            <div className='summary-row'><span>Total:</span><span>${cart.totalAmount.toFixed(2)}</span></div>
            <div className='security-notice'><p>⚡ Powered by Stripe</p></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
