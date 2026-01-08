import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { 
  FiX, FiSave, FiPackage, FiDollarSign, FiHash, FiMapPin,
  FiTruck, FiTag, FiInfo, FiImage, FiPlus, FiTrash2, FiCamera,
  FiUpload, FiZap, FiCalendar, FiTrendingUp, FiStar
} from 'react-icons/fi';
import inventoryService from '../services/inventoryApiService';

const ProductModal = ({ isOpen, onClose, product, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: '',
    brand: '',
    description: '',
    price: '',
    cost: '',
    stock: '',
    minStock: '',
    maxStock: '',
    barcode: '',
    location: '',
    weight: '',
    dimensions: { length: '', width: '', height: '' },
    supplier: { id: '', name: '', contact: '' },
    tags: [],
    expiryDate: '',
    images: []
  });

  const [loading, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [newTag, setNewTag] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      loadData();
      if (product) {
        setFormData({
          ...product,
          price: product.price?.toString() || '',
          cost: product.cost?.toString() || '',
          stock: product.stock?.toString() || '',
          minStock: product.minStock?.toString() || '',
          maxStock: product.maxStock?.toString() || '',
          weight: product.weight?.toString() || '',
          dimensions: product.dimensions || { length: '', width: '', height: '' },
          supplier: product.supplier || { id: '', name: '', contact: '' },
          tags: product.tags || [],
          images: product.images || []
        });
      } else {
        resetForm();
      }
    }
  }, [isOpen, product]);

  const loadData = async () => {
    try {
      const [categoriesRes, suppliersRes] = await Promise.all([
        inventoryService.getCategories(),
        inventoryService.getSuppliers()
      ]);
      setCategories(categoriesRes.categories);
      setSuppliers(suppliersRes.suppliers);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      sku: `SKU-${Date.now()}`,
      category: '',
      brand: '',
      description: '',
      price: '',
      cost: '',
      stock: '',
      minStock: '10',
      maxStock: '100',
      barcode: '',
      location: '',
      weight: '',
      dimensions: { length: '', width: '', height: '' },
      supplier: { id: '', name: '', contact: '' },
      tags: [],
      expiryDate: '',
      images: []
    });
    setErrors({});
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) newErrors.name = 'Product name is required';
    if (!formData.sku.trim()) newErrors.sku = 'SKU is required';
    if (!formData.category) newErrors.category = 'Category is required';
    if (!formData.price || parseFloat(formData.price) <= 0) newErrors.price = 'Valid price is required';
    if (!formData.cost || parseFloat(formData.cost) <= 0) newErrors.cost = 'Valid cost is required';
    if (formData.stock === '' || parseInt(formData.stock) < 0) newErrors.stock = 'Valid stock quantity is required';
    
    if (parseFloat(formData.price) <= parseFloat(formData.cost)) {
      newErrors.price = 'Price must be higher than cost';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      const productData = {
        ...formData,
        price: parseFloat(formData.price),
        cost: parseFloat(formData.cost),
        stock: parseInt(formData.stock),
        minStock: parseInt(formData.minStock),
        maxStock: parseInt(formData.maxStock),
        weight: parseFloat(formData.weight) || 0,
        dimensions: {
          length: parseFloat(formData.dimensions.length) || 0,
          width: parseFloat(formData.dimensions.width) || 0,
          height: parseFloat(formData.dimensions.height) || 0
        }
      };

      const response = await inventoryService.saveProduct(productData);
      if (response.success) {
        onSave && onSave(response.data);
        onClose();
      }
    } catch (error) {
      toast.error('Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleDimensionChange = (dimension, value) => {
    setFormData(prev => ({
      ...prev,
      dimensions: { ...prev.dimensions, [dimension]: value }
    }));
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const generateBarcode = () => {
    const barcode = Math.floor(Math.random() * 9000000000000) + 1000000000000;
    handleInputChange('barcode', barcode.toString());
    toast.success('Barcode generated!');
  };

  const generateSKU = () => {
    const sku = `${formData.category.toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-6)}`;
    handleInputChange('sku', sku);
    toast.success('SKU generated!');
  };

  const calculateProfitMargin = () => {
    const price = parseFloat(formData.price) || 0;
    const cost = parseFloat(formData.cost) || 0;
    if (cost > 0) {
      return (((price - cost) / price) * 100).toFixed(2);
    }
    return '0.00';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <FiPackage className="h-6 w-6 text-white mr-3" />
                <h3 className="text-xl font-bold text-white">
                  {product ? '✏️ Edit Product' : '🆕 Add New Product'}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <FiX className="h-6 w-6" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Basic Info */}
              <div className="lg:col-span-2 space-y-6">
                {/* Product Identity */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <FiTag className="h-5 w-5 mr-2 text-blue-600" />
                    Product Identity
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Product Name *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          errors.name ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="Enter product name"
                      />
                      {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        SKU *
                      </label>
                      <div className="flex">
                        <input
                          type="text"
                          value={formData.sku}
                          onChange={(e) => handleInputChange('sku', e.target.value)}
                          className={`flex-1 px-3 py-2 border rounded-l-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                            errors.sku ? 'border-red-500' : 'border-gray-300'
                          }`}
                          placeholder="SKU-123456"
                        />
                        <button
                          type="button"
                          onClick={generateSKU}
                          className="px-3 py-2 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 transition-colors"
                        >
                          <FiZap className="h-4 w-4" />
                        </button>
                      </div>
                      {errors.sku && <p className="text-red-500 text-xs mt-1">{errors.sku}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Category *
                      </label>
                      <select
                        value={formData.category}
                        onChange={(e) => handleInputChange('category', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          errors.category ? 'border-red-500' : 'border-gray-300'
                        }`}
                      >
                        <option value="">Select category</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.icon} {cat.name}
                          </option>
                        ))}
                      </select>
                      {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Brand
                      </label>
                      <input
                        type="text"
                        value={formData.brand}
                        onChange={(e) => handleInputChange('brand', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Brand name"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Product description..."
                    />
                  </div>
                </div>

                {/* Pricing */}
                <div className="bg-green-50 rounded-xl p-4">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <FiDollarSign className="h-5 w-5 mr-2 text-green-600" />
                    Pricing & Profit
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Selling Price * ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.price}
                        onChange={(e) => handleInputChange('price', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          errors.price ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="0.00"
                      />
                      {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cost Price * ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.cost}
                        onChange={(e) => handleInputChange('cost', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          errors.cost ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="0.00"
                      />
                      {errors.cost && <p className="text-red-500 text-xs mt-1">{errors.cost}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Profit Margin
                      </label>
                      <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg flex items-center">
                        <FiTrendingUp className="h-4 w-4 text-green-600 mr-2" />
                        <span className="font-bold text-green-600">
                          {calculateProfitMargin()}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Inventory */}
                <div className="bg-blue-50 rounded-xl p-4">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <FiPackage className="h-5 w-5 mr-2 text-blue-600" />
                    Inventory Management
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Current Stock *
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.stock}
                        onChange={(e) => handleInputChange('stock', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          errors.stock ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="0"
                      />
                      {errors.stock && <p className="text-red-500 text-xs mt-1">{errors.stock}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Minimum Stock
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.minStock}
                        onChange={(e) => handleInputChange('minStock', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="10"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Maximum Stock
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.maxStock}
                        onChange={(e) => handleInputChange('maxStock', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="100"
                      />
                    </div>
                  </div>
                </div>

                {/* Advanced Options Toggle */}
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <FiInfo className="h-4 w-4 mr-2" />
                    {showAdvanced ? 'Hide' : 'Show'} Advanced Options
                  </button>
                </div>

                {/* Advanced Options */}
                {showAdvanced && (
                  <div className="space-y-6 animate-fadeIn">
                    {/* Barcode & Location */}
                    <div className="bg-purple-50 rounded-xl p-4">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <FiHash className="h-5 w-5 mr-2 text-purple-600" />
                        Barcode & Location
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Barcode
                          </label>
                          <div className="flex">
                            <input
                              type="text"
                              value={formData.barcode}
                              onChange={(e) => handleInputChange('barcode', e.target.value)}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="123456789012"
                            />
                            <button
                              type="button"
                              onClick={generateBarcode}
                              className="px-3 py-2 bg-purple-600 text-white rounded-r-lg hover:bg-purple-700 transition-colors"
                            >
                              <FiZap className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Storage Location
                          </label>
                          <div className="relative">
                            <FiMapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                            <input
                              type="text"
                              value={formData.location}
                              onChange={(e) => handleInputChange('location', e.target.value)}
                              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="A1-01-001"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Physical Properties */}
                    <div className="bg-orange-50 rounded-xl p-4">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">
                        📏 Physical Properties
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Weight (kg)
                          </label>
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            value={formData.weight}
                            onChange={(e) => handleInputChange('weight', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="0.000"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Length (mm)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={formData.dimensions.length}
                            onChange={(e) => handleDimensionChange('length', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="0.0"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Width (mm)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={formData.dimensions.width}
                            onChange={(e) => handleDimensionChange('width', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="0.0"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Height (mm)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={formData.dimensions.height}
                            onChange={(e) => handleDimensionChange('height', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="0.0"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Supplier Info */}
                    <div className="bg-teal-50 rounded-xl p-4">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <FiTruck className="h-5 w-5 mr-2 text-teal-600" />
                        Supplier Information
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Supplier
                          </label>
                          <select
                            value={formData.supplier.id}
                            onChange={(e) => {
                              const supplier = suppliers.find(s => s.id === e.target.value);
                              handleInputChange('supplier', supplier || { id: '', name: '', contact: '' });
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="">Select supplier</option>
                            {suppliers.map((supplier) => (
                              <option key={supplier.id} value={supplier.id}>
                                {supplier.name} - ⭐ {supplier.rating}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Expiry Date
                          </label>
                          <div className="relative">
                            <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                            <input
                              type="date"
                              value={formData.expiryDate ? formData.expiryDate.split('T')[0] : ''}
                              onChange={(e) => handleInputChange('expiryDate', e.target.value ? `${e.target.value}T23:59:59Z` : '')}
                              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="bg-pink-50 rounded-xl p-4">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">
                        🏷️ Tags
                      </h4>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {formData.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => removeTag(tag)}
                              className="ml-2 text-blue-600 hover:text-blue-800"
                            >
                              <FiX className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex">
                        <input
                          type="text"
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Add a tag..."
                        />
                        <button
                          type="button"
                          onClick={addTag}
                          className="px-4 py-2 bg-pink-600 text-white rounded-r-lg hover:bg-pink-700 transition-colors"
                        >
                          <FiPlus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column - Quick Actions & Preview */}
              <div className="space-y-6">
                {/* Quick Stats */}
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-4 border border-blue-100">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <FiStar className="h-5 w-5 mr-2 text-yellow-500" />
                    Quick Stats
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Profit Margin:</span>
                      <span className="font-bold text-green-600">{calculateProfitMargin()}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Stock Status:</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        parseInt(formData.stock) === 0 ? 'bg-red-100 text-red-800' :
                        parseInt(formData.stock) <= parseInt(formData.minStock) ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {parseInt(formData.stock) === 0 ? 'Out of Stock' :
                         parseInt(formData.stock) <= parseInt(formData.minStock) ? 'Low Stock' :
                         'In Stock'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Category:</span>
                      <span className="text-sm font-medium">
                        {categories.find(c => c.id === formData.category)?.name || 'Not selected'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Image Upload Placeholder */}
                <div className="bg-gray-50 rounded-xl p-4 border-2 border-dashed border-gray-300">
                  <div className="text-center">
                    <FiImage className="mx-auto h-12 w-12 text-gray-400" />
                    <h4 className="mt-2 text-sm font-medium text-gray-900">Product Images</h4>
                    <p className="mt-1 text-xs text-gray-500">Upload product photos</p>
                    <div className="mt-4 flex justify-center space-x-2">
                      <button
                        type="button"
                        className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <FiUpload className="h-4 w-4 mr-1" />
                        Upload
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <FiCamera className="h-4 w-4 mr-1" />
                        Camera
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">
                    ⚡ Quick Actions
                  </h4>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={generateSKU}
                      className="w-full text-left px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      🎲 Generate SKU
                    </button>
                    <button
                      type="button"
                      onClick={generateBarcode}
                      className="w-full text-left px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      📊 Generate Barcode
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="w-full text-left px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      ⚙️ {showAdvanced ? 'Hide' : 'Show'} Advanced
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 flex items-center justify-between pt-6 border-t border-gray-200">
              <div className="text-sm text-gray-500">
                * Required fields
              </div>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center px-6 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <FiSave className="h-4 w-4 mr-2" />
                      {product ? 'Update Product' : 'Create Product'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProductModal;
