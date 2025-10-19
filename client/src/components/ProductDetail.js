import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://localhost:7207';

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/products/${id}`);
      setProduct(response.data);
      setLoading(false);
    } catch (err) {
      setError('Product not found');
      setLoading(false);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      await axios.delete(`${API_BASE_URL}/api/products/${id}`);
      setShowDeleteModal(false);
      navigate('/');
    } catch (err) {
      setError('Failed to delete product');
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="cyber-loader">
          <div className="loader-ring"></div>
          <div className="loader-ring"></div>
          <div className="loader-ring"></div>
        </div>
        <p className="loading-text">🔍 SCANNING DATABASE...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-content">
          <h2>🚨 ERROR DETECTED</h2>
          <p>{error}</p>
          <Link to="/" className="btn btn-primary">
            ⬅️ RETURN TO GRID
          </Link>
        </div>
      </div>
    );
  }

  if (!product) return <div className="error">Product not found</div>;

  return (
    <div className="product-detail-wrapper">
      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={handleDeleteCancel}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Confirmation</h3>
              <button className="close-button" onClick={handleDeleteCancel}>×</button>
            </div>
            <div className="modal-body">
              <p className="modal-message">
                Are you sure you want to delete the product <span className="product-name">"{product.name}"</span>?
              </p>
            </div>
            <div className="modal-actions">
              <button 
                onClick={handleDeleteCancel} 
                className="btn btn-secondary modal-btn"
                disabled={deleting}
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteConfirm} 
                className="btn btn-danger modal-btn"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="product-detail-container">
        {/* Breadcrumb Navigation */}
        <nav className="breadcrumb">
          <Link to="/" className="breadcrumb-link">🏠 HOME</Link>
          <span className="breadcrumb-separator">▶</span>
          <span className="breadcrumb-current">📦 {product.name}</span>
        </nav>

        <div className="product-detail-grid">
          {/* Product Image Section */}
          <div className="product-image-section">
            <div className="image-container">
              {product.imageUrl ? (
                <img 
                  src={product.imageUrl} 
                  alt={product.name}
                  className="product-image-large"
                />
              ) : (
                <div className="no-image-large">
                  <div className="no-image-icon">📷</div>
                  <p>IMAGE NOT FOUND</p>
                  <small>No visual data available</small>
                </div>
              )}
            </div>
            
            {/* Image Overlay Info */}
            <div className="image-overlay">
              <div className="overlay-content">
                <span className="product-id">ID: #{product.id}</span>
                <span className="product-status">🟢 ACTIVE</span>
              </div>
            </div>
          </div>

          {/* Product Information Section */}
          <div className="product-info-section">
            <div className="product-header">
              <h1 className="product-title">⚡ {product.name}</h1>
              <div className="price-section">
                <span className="price-label">PRICE</span>
                <span className="price-value">💰 ${parseFloat(product.price).toFixed(2)}</span>
              </div>
            </div>

            <div className="product-description">
              <h3 className="section-title">📋 PRODUCT DESCRIPTION</h3>
              <div className="description-content">
                <p>{product.description}</p>
              </div>
            </div>

            {/* Product Metadata */}
            <div className="product-metadata">
              <div className="metadata-section">
                <h4 className="metadata-title">📊 DATABASE INFO</h4>
                <div className="metadata-grid">
                  <div className="metadata-item">
                    <span className="metadata-label">📅 CREATED:</span>
                    <span className="metadata-value">{new Date(product.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="metadata-item">
                    <span className="metadata-label">🔄 MODIFIED:</span>
                    <span className="metadata-value">{new Date(product.updatedAt).toLocaleDateString()}</span>
                  </div>
                  <div className="metadata-item">
                    <span className="metadata-label">🆔 RECORD ID:</span>
                    <span className="metadata-value">#{product.id}</span>
                  </div>
                  <div className="metadata-item">
                    <span className="metadata-label">💾 STATUS:</span>
                    <span className="metadata-value status-active">ACTIVE</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="action-section">
              <h4 className="section-title">⚙️ ACTIONS</h4>
              <div className="action-buttons">
                {/* Only show Edit and Delete buttons to authenticated users */}
                {isAuthenticated && (
                  <>
                    <Link 
                      to={`/products/edit/${product.id}`} 
                      className="btn btn-primary action-btn"
                    >
                      <span className="btn-icon">✏️</span>
                      <span className="btn-text">EDIT PRODUCT</span>
                    </Link>
                    
                    <button 
                      onClick={handleDeleteClick}
                      className="btn btn-danger action-btn"
                      disabled={deleting}
                    >
                      <span className="btn-icon">🗑️</span>
                      <span className="btn-text">DELETE PRODUCT</span>
                    </button>
                  </>
                )}
                
                <Link 
                  to="/" 
                  className="btn btn-secondary action-btn"
                >
                  <span className="btn-icon">⬅️</span>
                  <span className="btn-text">BACK TO GRID</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;