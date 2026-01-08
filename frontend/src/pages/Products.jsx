import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  FiPackage, 
  FiPlus,
  FiSearch,
  FiFilter, 
  FiEdit,
  FiTrash2,
  FiEye,
  FiAlertTriangle,
  FiMapPin,
  FiCalendar,
  FiFlag,
  FiTruck,
  FiStar,
  FiAward,
  FiShield,
  FiSun,
  FiDroplet,
  FiDollarSign,
  FiPercent,
  FiBarChart2,
  FiTrendingUp,
  FiRefreshCw,
  FiCheck,
  FiX,
  FiClock,
  FiTarget
} from 'react-icons/fi';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [localFilter, setLocalFilter] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    brand: '',
    sku: '',
    barcode: '',
    price: '',
    cost: '',
    stock: '',
    minStock: '',
    maxStock: '',
    unit: 'piece',
    weight: '',
    supplier: '',
    tags: '',
    countryOfOrigin: 'Uganda',
    expiryDate: '',
  });

  // Enhanced form state
  const [formErrors, setFormErrors] = useState({});
  const [autoGenerateSKU, setAutoGenerateSKU] = useState(true);
  const [autoGenerateBarcode, setAutoGenerateBarcode] = useState(true);
  const [formStep, setFormStep] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchSuppliers();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/products');
      setProducts(response.data.products || []);
    } catch (error) {
      console.error('Failed to fetch products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get('/api/products/categories/list');
      setCategories(response.data.categories || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      setCategories([]);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await axios.get('/api/suppliers');
      setSuppliers(response.data.suppliers || []);
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
      setSuppliers([]);
    }
  };

  // Helper functions for enhanced functionality
  const generateSKU = (name, brand, weight) => {
    if (!name || !brand) return '';
    const nameCode = name.substring(0, 2).toUpperCase();
    const brandCode = brand.substring(0, 2).toUpperCase();
    const weightCode = weight ? `-${weight.toUpperCase()}` : '';
    return `${brandCode}-${nameCode}${weightCode}`;
  };

  const generateBarcode = () => {
    // Generate Ugandan-style barcode starting with 600
    const prefix = '600';
    const middle = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    const checksum = Math.floor(Math.random() * 10);
    return `${prefix}${middle}${checksum}`;
  };

  const calculateProfitMargin = (price, cost) => {
    if (!price || !cost || price <= 0) return 0;
    return Math.round(((price - cost) / price) * 100);
  };



  const suggestPrice = (cost, marginPercent = 25) => {
    if (!cost || cost <= 0) return 0;
    return Math.round(cost / (1 - marginPercent / 100));
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.name.trim()) errors.name = 'Product name is required';
    if (!formData.brand.trim()) errors.brand = 'Brand is required';
    if (!formData.category) errors.category = 'Category is required';
    if (!formData.price || parseFloat(formData.price) <= 0) errors.price = 'Valid price is required';
    if (!formData.cost || parseFloat(formData.cost) <= 0) errors.cost = 'Valid cost is required';
    if (!formData.stock || parseInt(formData.stock) < 0) errors.stock = 'Valid stock quantity is required';
    
    // Validate profit margin
    const margin = calculateProfitMargin(parseFloat(formData.price), parseFloat(formData.cost));
    if (margin < 0) errors.price = 'Selling price must be higher than cost price';
    if (margin < 5) errors.price = 'Profit margin seems too low (less than 5%)';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fix the form errors before submitting');
      return;
    }

    setSaving(true);
    try {
      const productData = {
        ...formData,
        price: parseFloat(formData.price),
        cost: parseFloat(formData.cost),
        stock: parseInt(formData.stock),
        minStock: parseInt(formData.minStock),
        maxStock: parseInt(formData.maxStock),
        tags: (formData.tags || '').split(',').map(tag => tag.trim()).filter(tag => tag),
      };

      if (showEditModal) {
        await axios.put(`/api/products/${selectedProduct._id}`, productData);
        toast.success('🎉 Product updated successfully!');
      } else {
        await axios.post('/api/products', productData);
        toast.success('🎉 New product added successfully!');
      }

      fetchProducts();
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;

    try {
      await axios.delete(`/api/products/${productId}`);
      toast.success('Product deleted successfully');
      fetchProducts();
    } catch {
      toast.error('Failed to delete product');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: '',
      brand: '',
      sku: '',
      barcode: '',
      price: '',
      cost: '',
      stock: '',
      minStock: '',
      maxStock: '',
      unit: 'piece',
      weight: '',
      supplier: '',
      tags: '',
      countryOfOrigin: 'Uganda',
      expiryDate: '',
    });
    setFormErrors({});
    setFormStep(1);
    setAutoGenerateSKU(true);
    setAutoGenerateBarcode(true);
    setShowAddModal(false);
    setShowEditModal(false);
    setSelectedProduct(null);
  };

  // Smart form handlers
  const handleFormDataChange = (field, value) => {
    const newFormData = { ...formData, [field]: value };
    
    // Auto-generate SKU when name, brand, or weight changes
    if (autoGenerateSKU && (field === 'name' || field === 'brand' || field === 'weight')) {
      newFormData.sku = generateSKU(
        field === 'name' ? value : formData.name,
        field === 'brand' ? value : formData.brand,
        field === 'weight' ? value : formData.weight
      );
    }

    // Auto-generate barcode when SKU is generated
    if (autoGenerateBarcode && field === 'sku' && !formData.barcode) {
      newFormData.barcode = generateBarcode();
    }

    // Suggest pricing when cost changes
    if (field === 'cost' && value && !formData.price) {
      const suggestedPrice = suggestPrice(parseFloat(value), 25);
      newFormData.price = suggestedPrice.toString();
    }

    setFormData(newFormData);

    // Clear specific field error when user starts typing
    if (formErrors[field]) {
      setFormErrors({ ...formErrors, [field]: null });
    }
  };

  const openEditModal = (product) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      category: product.category,
      brand: product.brand,
      sku: product.sku,
      barcode: product.barcode || '',
      price: (product.price || 0).toString(),
      cost: (product.cost || 0).toString(),
      stock: (product.stock || 0).toString(),
      minStock: (product.minStock || 0).toString(),
      maxStock: (product.maxStock || 0).toString(),
      unit: product.unit,
      weight: product.weight || '',
      supplier: product.supplier?._id || '',
      tags: product.tags?.join(', ') || '',
      countryOfOrigin: product.countryOfOrigin || 'Uganda',
      expiryDate: product.expiryDate || '',
    });
    
    // Disable auto-generation for existing products
    setAutoGenerateSKU(false);
    setAutoGenerateBarcode(false);
    setFormErrors({});
    setFormStep(1);
    setShowEditModal(true);
  };

  const openAddModal = () => {
    resetForm();
    setAutoGenerateSKU(true);
    setAutoGenerateBarcode(true);
    setShowAddModal(true);
  };

  const openViewModal = (product) => {
    setSelectedProduct(product);
    setShowViewModal(true);
  };

  // Filter products
  const filteredProducts = (products || []).filter(product => {
    if (!product) return false;
    
    const matchesSearch = 
      (product.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.brand || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.sku || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = !categoryFilter || product.category === categoryFilter;
    const matchesLocal = !localFilter || product.countryOfOrigin === 'Uganda';
    
    return matchesSearch && matchesCategory && matchesLocal;
  });

  // Get expiry status
  const getExpiryStatus = (expiryDate) => {
    if (!expiryDate) return null;
    
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { status: 'expired', days: Math.abs(diffDays), color: 'text-red-600 bg-red-100' };
    if (diffDays <= 7) return { status: 'critical', days: diffDays, color: 'text-red-600 bg-red-100' };
    if (diffDays <= 30) return { status: 'warning', days: diffDays, color: 'text-yellow-600 bg-yellow-100' };
    return { status: 'good', days: diffDays, color: 'text-green-600 bg-green-100' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Header with Ugandan Theme */}
      <div className="bg-gradient-to-r from-yellow-400 via-red-500 to-black p-8 rounded-2xl text-white relative overflow-hidden">
        {/* Ugandan flag colors background elements */}
        <div className="absolute top-0 left-0 w-full h-1/3 bg-black opacity-20"></div>
        <div className="absolute top-1/3 left-0 w-full h-1/3 bg-yellow-500 opacity-20"></div>
        <div className="absolute top-2/3 left-0 w-full h-1/3 bg-red-600 opacity-20"></div>
        
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold flex items-center mb-2">
              <FiPackage className="mr-3 w-8 h-8" />
              Product Management
              <span className="ml-3 text-lg bg-white/20 px-3 py-1 rounded-full">
                🇺🇬 Uganda
              </span>
            </h1>
            <p className="text-white/90 flex items-center text-lg">
              Manage your supermarket inventory with local market insights
              <span className="ml-4 bg-yellow-500/20 px-3 py-1 rounded-full text-sm">
                Local Focus
              </span>
          </p>
        </div>
        <button
            onClick={openAddModal}
            className="mt-4 lg:mt-0 bg-white/10 backdrop-blur-sm text-white px-6 py-3 rounded-lg hover:bg-white/20 transition-all duration-300 flex items-center space-x-2 group"
        >
            <FiPlus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
            <span>Add New Product</span>
        </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <FiSearch className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search products, brands, or SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full border border-gray-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          
          <div>
          <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Categories</option>
              {(categories || []).map(category => (
              <option key={category} value={category}>
                  {category}
              </option>
            ))}
          </select>
          </div>
          
          <div className="flex items-center">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={localFilter}
                onChange={(e) => setLocalFilter(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              />
              <span className="ml-2 text-sm text-gray-700 flex items-center">
                🇺🇬 Local Products Only
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <FiPackage className="mr-2 text-blue-500" />
            Products ({filteredProducts.length})
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price (UGX)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Origin</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(filteredProducts || []).map((product) => {
                const expiryStatus = getExpiryStatus(product.expiryDate);
                return (
                <tr key={product._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                            <FiPackage className="h-5 w-5 text-white" />
                        </div>
                      </div>
                      <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 flex items-center">
                          {product.name}
                            {product.countryOfOrigin === 'Uganda' && (
                              <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                                🇺🇬 Local
                              </span>
                            )}
                        </div>
                        <div className="text-sm text-gray-500">
                            {product.brand} • SKU: {product.sku}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {product.category}
                    </span>
                  </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(product.price || 0)}
                      </div>
                      <div className="text-sm text-gray-500">
                        Cost: {formatCurrency(product.cost || 0)}
                      </div>
                  </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {product.stock || 0} {product.unit}
                      </div>
                      <div className="text-xs text-gray-500">
                        Min: {product.minStock} • Max: {product.maxStock}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                      {expiryStatus ? (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${expiryStatus.color}`}>
                          {expiryStatus.status === 'expired' ? (
                            <>
                              <FiAlertTriangle className="w-3 h-3 mr-1" />
                              Expired
                            </>
                          ) : expiryStatus.status === 'critical' ? (
                            <>
                              <FiAlertTriangle className="w-3 h-3 mr-1" />
                              {expiryStatus.days}d left
                            </>
                          ) : expiryStatus.status === 'warning' ? (
                            <>
                              <FiClock className="w-3 h-3 mr-1" />
                              {expiryStatus.days}d left
                            </>
                          ) : (
                            `${expiryStatus.days}d left`
                          )}
                    </span>
                      ) : (
                        <span className="text-gray-400 text-xs">No expiry</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        {product.countryOfOrigin === 'Uganda' ? '🇺🇬' : 
                         product.countryOfOrigin === 'Kenya' ? '🇰🇪' :
                         product.countryOfOrigin === 'Tanzania' ? '🇹🇿' : '🌍'}
                        <span className="ml-1">{product.countryOfOrigin || 'Unknown'}</span>
                      </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center space-x-2">
                      <button
                        onClick={() => openViewModal(product)}
                          className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded"
                          title="View Details"
                      >
                          <FiEye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEditModal(product)}
                          className="text-green-600 hover:text-green-900 p-1 hover:bg-green-50 rounded"
                          title="Edit Product"
                      >
                          <FiEdit className="w-4 h-4" />
                      </button>
                      <button
                          onClick={() => deleteProduct(product._id)}
                          className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded"
                          title="Delete Product"
                      >
                          <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Enhanced Creative Add/Edit Modal with Smart Features */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-60 overflow-y-auto h-full w-full z-50 backdrop-blur-sm">
          <div className="relative top-10 mx-auto p-6 border w-11/12 max-w-6xl shadow-2xl rounded-2xl bg-white">
            {/* Enhanced Header */}
            <div className="flex items-center justify-between pb-6 border-b border-gray-200">
              <div className="flex items-center space-x-4">
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-3 rounded-full">
                  <FiPackage className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 flex items-center">
                    {showEditModal ? '✏️ Edit Product' : '✨ Add New Product'}
              </h3>
                  <p className="text-sm text-gray-600 flex items-center mt-1">
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs mr-2">
                      🇺🇬 Made for Uganda
                    </span>
                    {showEditModal ? 'Update product information' : 'Create a new product for your supermarket'}
                  </p>
                </div>
              </div>
              
              {/* Step Indicator */}
              <div className="flex items-center space-x-2">
                <div className="flex space-x-2">
                  {[1, 2, 3].map(step => (
                    <div
                      key={step}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                        formStep >= step
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {formStep > step ? <FiCheck className="w-4 h-4" /> : step}
                    </div>
                  ))}
                </div>
                <button
                  onClick={resetForm}
                  className="ml-4 text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-6">
              {/* Smart Suggestions Panel */}
              {formStep === 1 && !showEditModal && (
                <div className="mb-6 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-4">
                  <h4 className="font-medium text-yellow-800 flex items-center mb-3">
                    <FiStar className="mr-2" />
                    🇺🇬 Popular Ugandan Products - Quick Start
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { name: 'Blue Band Margarine', category: 'Dairy & Spreads', brand: 'Blue Band' },
                      { name: 'Mukwano Cooking Oil', category: 'Cooking Oils', brand: 'Mukwano' },
                      { name: 'Fresh Milk', category: 'Dairy & Spreads', brand: 'Fresh Dairy' },
                      { name: 'Capital Sugar', category: 'Condiments & Spices', brand: 'Capital' },
                    ].map((suggested, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          handleFormDataChange('name', suggested.name);
                          handleFormDataChange('category', suggested.category);
                          handleFormDataChange('brand', suggested.brand);
                        }}
                        className="text-left p-2 bg-white rounded-lg border border-yellow-200 hover:bg-yellow-50 transition-colors text-xs"
                      >
                        <div className="font-medium text-yellow-800">{suggested.name}</div>
                        <div className="text-yellow-600">{suggested.brand}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Step 1: Basic Information */}
                {formStep === 1 && (
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-blue-50 rounded-xl p-6">
                      <h4 className="font-bold text-blue-900 flex items-center mb-4">
                        <FiPackage className="mr-2 text-blue-600" />
                        Step 1: Basic Product Information
                      </h4>
                      
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                            onChange={(e) => handleFormDataChange('name', e.target.value)}
                            className={`block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                              formErrors.name ? 'border-red-300 ring-red-500' : ''
                            }`}
                            placeholder="e.g., Blue Band Margarine"
                          />
                          {formErrors.name && (
                            <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>
                          )}
                  </div>

                  <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Brand *</label>
                    <input
                      type="text"
                      required
                      value={formData.brand}
                            onChange={(e) => handleFormDataChange('brand', e.target.value)}
                            className={`block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                              formErrors.brand ? 'border-red-300 ring-red-500' : ''
                            }`}
                            placeholder="e.g., Mukwano, Fresh Dairy"
                          />
                          {formErrors.brand && (
                            <p className="mt-1 text-xs text-red-600">{formErrors.brand}</p>
                          )}
                  </div>

                  <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                          <select
                            required
                            value={formData.category}
                            onChange={(e) => handleFormDataChange('category', e.target.value)}
                            className={`block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                              formErrors.category ? 'border-red-300 ring-red-500' : ''
                            }`}
                          >
                            <option value="">Select Category</option>
                            {(categories || []).map(category => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                          {formErrors.category && (
                            <p className="mt-1 text-xs text-red-600">{formErrors.category}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Weight/Size</label>
                          <input
                            type="text"
                            value={formData.weight}
                            onChange={(e) => handleFormDataChange('weight', e.target.value)}
                            className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g., 500g, 2L, 5kg"
                          />
                        </div>
                      </div>

                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Product Description *</label>
                        <textarea
                          required
                          rows={3}
                          value={formData.description}
                          onChange={(e) => handleFormDataChange('description', e.target.value)}
                          className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Describe the product, its features, and benefits..."
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: SKU and Identification */}
                {formStep === 2 && (
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-green-50 rounded-xl p-6">
                      <h4 className="font-bold text-green-900 flex items-center mb-4">
                        <FiBarChart2 className="mr-2 text-green-600" />
                        Step 2: Product Identification & Codes
                      </h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-sm font-medium text-gray-700">SKU (Stock Keeping Unit) *</label>
                            <button
                              type="button"
                              onClick={() => {
                                const newSKU = generateSKU(formData.name, formData.brand, formData.weight);
                                handleFormDataChange('sku', newSKU);
                                setAutoGenerateSKU(true);
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                            >
                              <FiRefreshCw className="w-3 h-3 mr-1" />
                              Auto-generate
                            </button>
                          </div>
                    <input
                      type="text"
                      required
                      value={formData.sku}
                            onChange={(e) => {
                              handleFormDataChange('sku', e.target.value);
                              setAutoGenerateSKU(false);
                            }}
                            className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g., BB-MARG-500G"
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            {autoGenerateSKU ? '🤖 Auto-generated based on product details' : '✏️ Custom SKU'}
                          </p>
                  </div>

                  <div>
                          <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">Barcode</label>
                            <button
                              type="button"
                              onClick={() => {
                                const newBarcode = generateBarcode();
                                handleFormDataChange('barcode', newBarcode);
                                setAutoGenerateBarcode(true);
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                            >
                              <FiRefreshCw className="w-3 h-3 mr-1" />
                              Generate UG
                            </button>
                          </div>
                    <input
                      type="text"
                      value={formData.barcode}
                            onChange={(e) => {
                              handleFormDataChange('barcode', e.target.value);
                              setAutoGenerateBarcode(false);
                            }}
                            className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                            placeholder="600XXXXXXXX"
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            {autoGenerateBarcode ? '🇺🇬 Ugandan barcode format (600...)' : '✏️ Custom barcode'}
                          </p>
                  </div>

                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Country of Origin</label>
                          <select
                            value={formData.countryOfOrigin}
                            onChange={(e) => handleFormDataChange('countryOfOrigin', e.target.value)}
                            className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="Uganda">🇺🇬 Uganda (Local Product)</option>
                            <option value="Kenya">🇰🇪 Kenya</option>
                            <option value="Tanzania">🇹🇿 Tanzania</option>
                            <option value="South Africa">🇿🇦 South Africa</option>
                            <option value="Other">🌍 Other Country</option>
                          </select>
                        </div>

                  <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Unit Type</label>
                          <select
                            required
                            value={formData.unit}
                            onChange={(e) => handleFormDataChange('unit', e.target.value)}
                            className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="piece">Piece</option>
                            <option value="kg">Kilogram (kg)</option>
                            <option value="liter">Liter (L)</option>
                            <option value="pack">Pack</option>
                            <option value="bag">Bag</option>
                            <option value="bottle">Bottle</option>
                            <option value="packet">Packet</option>
                            <option value="can">Can</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                          <input
                            type="date"
                            value={formData.expiryDate}
                            onChange={(e) => handleFormDataChange('expiryDate', e.target.value)}
                            className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                            min={new Date().toISOString().split('T')[0]}
                          />
                          <p className="mt-1 text-xs text-gray-500">Leave blank for non-perishable items</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Simplified Working Form */}
                <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column */}
                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-900 border-b pb-2">Basic Information</h4>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) => handleFormDataChange('name', e.target.value)}
                          className={`block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                            formErrors.name ? 'border-red-300' : ''
                          }`}
                          placeholder="e.g., Blue Band Margarine"
                        />
                        {formErrors.name && <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Brand *</label>
                        <input
                          type="text"
                          required
                          value={formData.brand}
                          onChange={(e) => handleFormDataChange('brand', e.target.value)}
                          className={`block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                            formErrors.brand ? 'border-red-300' : ''
                          }`}
                          placeholder="e.g., Mukwano, Fresh Dairy"
                        />
                        {formErrors.brand && <p className="mt-1 text-xs text-red-600">{formErrors.brand}</p>}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                    <select
                      required
                      value={formData.category}
                          onChange={(e) => handleFormDataChange('category', e.target.value)}
                          className={`block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                            formErrors.category ? 'border-red-300' : ''
                          }`}
                    >
                      <option value="">Select Category</option>
                          {(categories || []).map(category => (
                        <option key={category} value={category}>
                              {category}
                        </option>
                      ))}
                    </select>
                        {formErrors.category && <p className="mt-1 text-xs text-red-600">{formErrors.category}</p>}
                  </div>

                      <div className="grid grid-cols-2 gap-3">
                  <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Weight/Size</label>
                          <input
                            type="text"
                            value={formData.weight}
                            onChange={(e) => handleFormDataChange('weight', e.target.value)}
                            className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g., 500g, 2L"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
                    <select
                      required
                      value={formData.unit}
                            onChange={(e) => handleFormDataChange('unit', e.target.value)}
                            className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="piece">Piece</option>
                      <option value="kg">Kilogram</option>
                      <option value="liter">Liter</option>
                      <option value="pack">Pack</option>
                            <option value="bag">Bag</option>
                            <option value="bottle">Bottle</option>
                    </select>
                  </div>
                      </div>

                  <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                        <textarea
                          required
                          rows={3}
                          value={formData.description}
                          onChange={(e) => handleFormDataChange('description', e.target.value)}
                          className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Describe the product..."
                        />
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-900 border-b pb-2">SKU & Identification</h4>
                      
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-sm font-medium text-gray-700">SKU *</label>
                          <button
                            type="button"
                            onClick={() => {
                              const newSKU = generateSKU(formData.name, formData.brand, formData.weight);
                              handleFormDataChange('sku', newSKU);
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            🔄 Auto-generate
                          </button>
                        </div>
                    <input
                          type="text"
                      required
                          value={formData.sku}
                          onChange={(e) => handleFormDataChange('sku', e.target.value)}
                          className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          placeholder="e.g., BB-MARG-500G"
                    />
                  </div>

                  <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-sm font-medium text-gray-700">Barcode</label>
                          <button
                            type="button"
                            onClick={() => handleFormDataChange('barcode', generateBarcode())}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            🇺🇬 Generate UG
                          </button>
                        </div>
                        <input
                          type="text"
                          value={formData.barcode}
                          onChange={(e) => handleFormDataChange('barcode', e.target.value)}
                          className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          placeholder="600XXXXXXXX"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Country of Origin</label>
                        <select
                          value={formData.countryOfOrigin}
                          onChange={(e) => handleFormDataChange('countryOfOrigin', e.target.value)}
                          className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="Uganda">🇺🇬 Uganda</option>
                          <option value="Kenya">🇰🇪 Kenya</option>
                          <option value="Tanzania">🇹🇿 Tanzania</option>
                          <option value="Other">🌍 Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                        <input
                          type="date"
                          value={formData.expiryDate}
                          onChange={(e) => handleFormDataChange('expiryDate', e.target.value)}
                          className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          min={new Date().toISOString().split('T')[0]}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                        <select
                          value={formData.supplier}
                          onChange={(e) => handleFormDataChange('supplier', e.target.value)}
                          className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Select Supplier</option>
                          {(suppliers || []).map(supplier => (
                            <option key={supplier._id} value={supplier._id}>
                              {supplier.name} {supplier.isLocal && '🇺🇬'}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                        <input
                          type="text"
                          value={formData.tags}
                          onChange={(e) => handleFormDataChange('tags', e.target.value)}
                          className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          placeholder="local-favorite, cooking, popular"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Pricing Section */}
                  <div className="mt-8 pt-6 border-t border-gray-200">
                    <h4 className="font-medium text-gray-900 mb-4">💰 Pricing & Inventory (UGX)</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price (UGX) *</label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500 text-sm">UGX</span>
                    <input
                      type="number"
                              step="100"
                      required
                      value={formData.cost}
                              onChange={(e) => handleFormDataChange('cost', e.target.value)}
                              className={`pl-12 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                                formErrors.cost ? 'border-red-300' : ''
                              }`}
                              placeholder="6800"
                    />
                  </div>
                          {formErrors.cost && <p className="mt-1 text-xs text-red-600">{formErrors.cost}</p>}
                        </div>

                  <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price (UGX) *</label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500 text-sm">UGX</span>
                            <input
                              type="number"
                              step="100"
                              required
                              value={formData.price}
                              onChange={(e) => handleFormDataChange('price', e.target.value)}
                              className={`pl-12 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                                formErrors.price ? 'border-red-300' : ''
                              }`}
                              placeholder="8500"
                            />
                          </div>
                          {formErrors.price && <p className="mt-1 text-xs text-red-600">{formErrors.price}</p>}
                          
                          {/* Quick Margin Suggestions */}
                          {formData.cost && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {[20, 25, 30, 35].map(margin => {
                                const suggestedPrice = suggestPrice(parseFloat(formData.cost), margin);
                                return (
                                  <button
                                    key={margin}
                                    type="button"
                                    onClick={() => handleFormDataChange('price', suggestedPrice.toString())}
                                    className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full hover:bg-blue-200"
                                  >
                                    {margin}% = {formatCurrency(suggestedPrice)}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Stock *</label>
                    <input
                      type="number"
                      required
                      value={formData.stock}
                              onChange={(e) => handleFormDataChange('stock', e.target.value)}
                              className={`block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                                formErrors.stock ? 'border-red-300' : ''
                              }`}
                              placeholder="100"
                            />
                            {formErrors.stock && <p className="mt-1 text-xs text-red-600">{formErrors.stock}</p>}
                  </div>
                  <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Min *</label>
                    <input
                      type="number"
                      required
                      value={formData.minStock}
                              onChange={(e) => handleFormDataChange('minStock', e.target.value)}
                              className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                              placeholder="20"
                    />
                  </div>
                  <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Max *</label>
                    <input
                      type="number"
                      required
                      value={formData.maxStock}
                              onChange={(e) => handleFormDataChange('maxStock', e.target.value)}
                              className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                              placeholder="500"
                    />
                  </div>
                        </div>

                        {/* Live Profit Calculator */}
                        {formData.price && formData.cost && (
                          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4 border border-green-200">
                                                         <h5 className="font-medium text-green-900 mb-2 flex items-center">
                               <FiDollarSign className="mr-2" />
                               Profit Calculator
                             </h5>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                                <div className="text-gray-600">Profit per Unit</div>
                                <div className="font-bold text-green-600">
                                  {formatCurrency(parseFloat(formData.price) - parseFloat(formData.cost))}
                  </div>
                </div>
                <div>
                                <div className="text-gray-600">Margin</div>
                                <div className="font-bold text-blue-600">
                                  {calculateProfitMargin(parseFloat(formData.price), parseFloat(formData.cost))}%
                </div>
                </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Form Actions */}
                  <div className="mt-8 pt-6 border-t border-gray-200 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={resetForm}
                      className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                      disabled={saving}
                      className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all duration-200 flex items-center"
                    >
                      {saving ? (
                        <>
                          <FiClock className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <FiCheck className="w-4 h-4 mr-2" />
                          {showEditModal ? '✏️ Update Product' : '✨ Add Product'}
                        </>
                      )}
                  </button>
                </div>
            </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedProduct && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between pb-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <FiEye className="mr-2 text-blue-500" />
                Product Details
              </h3>
              <button
                onClick={() => setShowViewModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                  <span className="text-sm font-medium text-gray-500">Name:</span>
                  <p className="text-gray-900">{selectedProduct.name}</p>
                  </div>
                  <div>
                  <span className="text-sm font-medium text-gray-500">Brand:</span>
                  <p className="text-gray-900">{selectedProduct.brand}</p>
                  </div>
                  <div>
                  <span className="text-sm font-medium text-gray-500">Category:</span>
                  <p className="text-gray-900">{selectedProduct.category}</p>
                  </div>
                  <div>
                  <span className="text-sm font-medium text-gray-500">SKU:</span>
                  <p className="text-gray-900 font-mono">{selectedProduct.sku}</p>
                  </div>
                  <div>
                  <span className="text-sm font-medium text-gray-500">Price:</span>
                  <p className="text-gray-900 font-semibold">{formatCurrency(selectedProduct.price || 0)}</p>
                  </div>
                  <div>
                  <span className="text-sm font-medium text-gray-500">Stock:</span>
                  <p className="text-gray-900">{selectedProduct.stock || 0} {selectedProduct.unit}</p>
                  </div>
                  <div>
                  <span className="text-sm font-medium text-gray-500">Country:</span>
                  <p className="text-gray-900">{selectedProduct.countryOfOrigin || 'Not specified'}</p>
                  </div>
                  <div>
                  <span className="text-sm font-medium text-gray-500">Supplier:</span>
                  <p className="text-gray-900">{selectedProduct.supplier?.name || 'Not assigned'}</p>
                  </div>
                </div>
              
                <div>
                <span className="text-sm font-medium text-gray-500">Description:</span>
                <p className="text-gray-900 mt-1">{selectedProduct.description}</p>
                </div>
              
              {selectedProduct.tags && selectedProduct.tags.length > 0 && (
                  <div>
                  <span className="text-sm font-medium text-gray-500">Tags:</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {selectedProduct.tags.map((tag, index) => (
                      <span key={index} className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                  </div>
                )}
            </div>
            
            <div className="mt-6 flex justify-end">
                  <button
                onClick={() => setShowViewModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                  >
                    Close
                  </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Utility function for formatting currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export default Products;