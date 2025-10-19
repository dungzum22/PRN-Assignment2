import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://localhost:7207';

const ProductForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    imageUrl: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isEditing) {
      fetchProduct();
    }
  }, [id, isEditing]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/products/${id}`);
      const product = response.data;
      setFormData({
        name: product.name,
        description: product.description,
        price: product.price.toString(),
        imageUrl: product.imageUrl || ''
      });
      setLoading(false);
    } catch (err) {
      setError('Failed to fetch product');
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation
    if (!formData.name.trim() || !formData.description.trim() || !formData.price) {
      setError('Please fill in all required fields');
      setLoading(false);
      return;
    }

    if (isNaN(formData.price) || parseFloat(formData.price) <= 0) {
      setError('Please enter a valid price');
      setLoading(false);
      return;
    }

    const productData = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      price: parseFloat(formData.price),
      imageUrl: formData.imageUrl.trim() || null
    };

    try {
      if (isEditing) {
        await axios.put(`${API_BASE_URL}/api/products/${id}`, {
          ...productData,
          id: parseInt(id)
        });
      } else {
        await axios.post(`${API_BASE_URL}/api/products`, productData);
      }
      navigate('/');
    } catch (err) {
      setError(`Failed to ${isEditing ? 'update' : 'create'} product`);
      setLoading(false);
    }
  };

  if (loading && isEditing) return <div className="loading">Loading product...</div>;

  return (
    <div className="form-container">
      <div className="form-wrapper">
        <h2>🎬 {isEditing ? 'EDIT PRODUCT' : 'CREATE PRODUCT'} 🎬</h2>

        <div className="form-image-section">
          <div className="image-preview-box">
            {formData.imageUrl ? (
              <div className="image-preview">
                <img src={formData.imageUrl} alt="Preview" />
              </div>
            ) : (
              <div className="image-preview-placeholder">🎬</div>
            )}
          </div>
        </div>

        <div className="form-fields-section">
          {error && <div className="error-message">🚨 {error}</div>}

          <form onSubmit={handleSubmit} className="product-form">
            <div className="form-group">
              <label htmlFor="name">🎞️ PRODUCT NAME *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter product name..."
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">📽️ DESCRIPTION *</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Enter detailed description..."
                rows="3"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="price">🎟️ PRICE ($) *</label>
              <input
                type="number"
                id="price"
                name="price"
                value={formData.price}
                onChange={handleChange}
                placeholder="0.00"
                step="0.01"
                min="0"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="imageUrl">🎬 IMAGE URL</label>
              <input
                type="url"
                id="imageUrl"
                name="imageUrl"
                value={formData.imageUrl}
                onChange={handleChange}
                placeholder="https://example.com/image.jpg"
              />
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? '⏳ PROCESSING...' : (isEditing ? '💾 UPDATE PRODUCT' : '🎬 CREATE PRODUCT')}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/')}
              >
                ❌ CANCEL
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProductForm;