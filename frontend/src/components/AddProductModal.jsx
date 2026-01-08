/**
 * Add Product Modal - Supabase Connected
 * Reusable component for adding products across all portals
 * Works with Manager, Employee, and Supplier portals
 */

import React, { useState, useEffect } from 'react';
import { 
  FiX, FiSave, FiPackage, FiDollarSign, FiHash, FiTag,
  FiBox, FiTruck, FiMapPin, FiAlertCircle, FiCheck, FiUpload, FiZap, FiCamera
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import inventoryService from '../services/inventorySupabaseService';
import DualScannerInterface from './DualScannerInterface';
import { supabase } from '../services/supabase';

const AddProductModal = ({ isOpen, onClose, onProductAdded, prefilledData = {} }) => {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Quick add mode for fast product entry
  const [quickAddMode, setQuickAddMode] = useState(true);
  
  // Scanner state
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    sku: '',
    barcode: '',
    name: '',
    description: '',
    category_id: '',
    supplier_id: '',
    brand: '',
    cost_price: '',
    selling_price: '',
    tax_rate: '18', // Uganda VAT
    initial_stock: '0',
    minimum_stock: '10',
    maximum_stock: '1000',
    reorder_point: '20',
    location: 'Main Storage',
    warehouse: 'Main Warehouse',
    ...prefilledData
  });

  // Common Uganda supermarket products for quick selection
  const commonProducts = [
    { name: 'Sugar - 1kg', category: 'Groceries', brand: 'Kakira', typical_price: 3500 },
    { name: 'Rice - 1kg', category: 'Groceries', brand: 'Tilda', typical_price: 4500 },
    { name: 'Cooking Oil - 1L', category: 'Groceries', brand: 'Fresh Fri', typical_price: 8500 },
    { name: 'Maize Flour (Posho) - 1kg', category: 'Groceries', brand: 'Nile', typical_price: 2800 },
    { name: 'Salt - 1kg', category: 'Groceries', brand: 'Kensalt', typical_price: 1500 },
    { name: 'Tea Leaves - 250g', category: 'Beverages', brand: 'Lipton', typical_price: 3200 },
    { name: 'Milk - 500ml', category: 'Dairy', brand: 'Lato', typical_price: 2500 },
    { name: 'Bread - 800g', category: 'Bakery', brand: 'Hot Loaf', typical_price: 3500 },
    { name: 'Soap Bar - 800g', category: 'Household', brand: 'Geisha', typical_price: 5000 },
    { name: 'Tissue Paper - 10 Rolls', category: 'Household', brand: 'Rosy', typical_price: 8000 },
  ];

  const [errors, setErrors] = useState({});
  const [calculatedMarkup, setCalculatedMarkup] = useState(0);
  const [calculatedProfit, setCalculatedProfit] = useState(0);

  // Load categories and suppliers
  useEffect(() => {
    if (isOpen) {
      loadFormData();
    }
  }, [isOpen]);

  const loadFormData = async () => {
    try {
      setLoadingData(true);
      let [categoriesData, suppliersData] = await Promise.all([
        inventoryService.getCategories(),
        inventoryService.getSuppliers()
      ]);
      
      // Create default categories if none exist
      if (categoriesData.length === 0) {
        toast.info('Creating default categories...');
        const defaultCategories = [
          { name: 'Groceries', description: 'Basic grocery items', is_active: true, sort_order: 1 },
          { name: 'Beverages', description: 'Drinks and beverages', is_active: true, sort_order: 2 },
          { name: 'Dairy', description: 'Milk and dairy products', is_active: true, sort_order: 3 },
          { name: 'Bakery', description: 'Bread and bakery items', is_active: true, sort_order: 4 },
          { name: 'Household', description: 'Household items and supplies', is_active: true, sort_order: 5 },
          { name: 'Personal Care', description: 'Personal care products', is_active: true, sort_order: 6 },
        ];
        
        for (const cat of defaultCategories) {
          await inventoryService.createCategory(cat);
        }
        
        categoriesData = await inventoryService.getCategories();
        toast.success('✅ Default categories created!');
      }
      
      // Create default supplier if none exist
      if (suppliersData.length === 0) {
        toast.info('Creating default supplier...');
        const defaultSupplier = {
          company_name: 'General Supplier',
          contact_person: 'Store Manager',
          email: 'supplier@store.com',
          phone: '+256-000-000-000',
          address: 'Kampala, Uganda',
          payment_terms: 'Net 30',
          rating: 4.0,
          is_active: true
        };
        
        await inventoryService.createSupplier(defaultSupplier);
        suppliersData = await inventoryService.getSuppliers();
        toast.success('✅ Default supplier created!');
      }
      
      setCategories(categoriesData);
      setSuppliers(suppliersData);
      
      // Set default category and supplier if only one exists
      if (categoriesData.length === 1 && !formData.category_id) {
        setFormData(prev => ({ ...prev, category_id: categoriesData[0].id }));
      }
      if (suppliersData.length === 1 && !formData.supplier_id) {
        setFormData(prev => ({ ...prev, supplier_id: suppliersData[0].id }));
      }
    } catch (error) {
      console.error('Error loading form data:', error);
      toast.error('Failed to load categories and suppliers');
    } finally {
      setLoadingData(false);
    }
  };

  // Calculate markup and profit when prices change
  useEffect(() => {
    const cost = parseFloat(formData.cost_price) || 0;
    const selling = parseFloat(formData.selling_price) || 0;
    
    if (cost > 0) {
      const markup = ((selling - cost) / cost * 100).toFixed(2);
      const profit = selling - cost;
      setCalculatedMarkup(markup);
      setCalculatedProfit(profit);
    } else {
      setCalculatedMarkup(0);
      setCalculatedProfit(0);
    }
  }, [formData.cost_price, formData.selling_price]);

  // Generate SKU automatically
  const generateSKU = () => {
    const prefix = formData.name ? formData.name.substring(0, 3).toUpperCase() : 'PRD';
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const sku = `${prefix}-${random}`;
    setFormData(prev => ({ ...prev, sku }));
  };

  // Quick select common product
  const quickSelectProduct = (product) => {
    const sku = `${product.brand.substring(0, 3).toUpperCase()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    const categoryMatch = categories.find(c => c.name.toLowerCase().includes(product.category.toLowerCase()));
    
    setFormData(prev => ({
      ...prev,
      name: product.name,
      brand: product.brand,
      sku: sku,
      category_id: categoryMatch?.id || prev.category_id,
      cost_price: Math.round(product.typical_price * 0.75).toString(), // 25% markup
      selling_price: product.typical_price.toString(),
      initial_stock: '50'
    }));
    
    toast.success(`Quick filled: ${product.name}`);
  };

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Handle barcode scanned from scanner
  const handleBarcodeScanned = async (barcode) => {
    setShowBarcodeScanner(false);
    
    try {
      // Check if product with this barcode already exists
      const { data: existingProduct, error: searchError } = await supabase
        .from('products')
        .select('id, name, barcode, sku, cost_price, selling_price, tax_rate, category_id')
        .eq('barcode', barcode)
        .maybeSingle();

      if (searchError && searchError.code !== 'PGRST116') {
        console.error('Error searching for product:', searchError);
        toast.error('Error checking for existing product');
        return;
      }

      if (existingProduct) {
        // Product already exists - show details and ask if user wants to edit
        toast.warning(`⚠️ Product already exists: ${existingProduct.name}`);
        toast.info(`SKU: ${existingProduct.sku || 'N/A'} | Price: UGX ${existingProduct.selling_price}`);
        setShowBarcodeScanner(false);
        return;
      }

      // Product doesn't exist - auto-fill the barcode
      setFormData(prev => ({
        ...prev,
        barcode: barcode,
        sku: `SKU-${barcode.substring(0, 8)}`
      }));
      
      toast.success(`✅ Barcode scanned & registered: ${barcode}`);
      toast.info('Please fill in the product details to complete registration');
      
    } catch (error) {
      console.error('Error handling barcode:', error);
      toast.error('Error processing barcode');
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!formData.sku?.trim()) newErrors.sku = 'SKU is required';
    if (!formData.name?.trim()) newErrors.name = 'Product name is required';
    // Category and supplier are now optional
    
    const costPrice = parseFloat(formData.cost_price);
    const sellingPrice = parseFloat(formData.selling_price);
    
    if (isNaN(costPrice) || costPrice < 0) {
      newErrors.cost_price = 'Valid cost price is required';
    }
    if (isNaN(sellingPrice) || sellingPrice < 0) {
      newErrors.selling_price = 'Valid selling price is required';
    }
    if (sellingPrice < costPrice) {
      newErrors.selling_price = 'Selling price should be greater than cost price';
    }

    const stock = parseInt(formData.initial_stock);
    if (isNaN(stock) || stock < 0) {
      newErrors.initial_stock = 'Valid stock quantity is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix all errors before submitting');
      return;
    }

    setLoading(true);

    try {
      // Prepare data for submission
      const productData = {
        sku: formData.sku.trim() || null,
        barcode: formData.barcode?.trim() || null,
        name: formData.name.trim(),
        description: formData.description?.trim() || null,
        category_id: formData.category_id || null,
        supplier_id: formData.supplier_id || null,
        brand: formData.brand?.trim() || null,
        cost_price: parseFloat(formData.cost_price) || 0,
        selling_price: parseFloat(formData.selling_price) || 0,
        tax_rate: parseFloat(formData.tax_rate) || 18,
        initial_stock: parseInt(formData.initial_stock) || 0,
        minimum_stock: parseInt(formData.minimum_stock) || 10,
        maximum_stock: parseInt(formData.maximum_stock) || 1000,
        reorder_point: parseInt(formData.reorder_point) || 20,
        location: formData.location || 'Main Storage',
        warehouse: formData.warehouse || 'Main Warehouse'
      };

      // Create product in Supabase
      const newProduct = await inventoryService.createProduct(productData);

      if (newProduct) {
        toast.success(`✅ Product "${productData.name}" added successfully!`);
        
        // Call parent callback
        if (onProductAdded) {
          onProductAdded(newProduct);
        }

        // Reset form and close modal
        resetForm();
        onClose();
      }
    } catch (error) {
      console.error('Error creating product:', error);
      toast.error('Failed to add product: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      sku: '',
      barcode: '',
      name: '',
      description: '',
      category_id: '',
      supplier_id: '',
      brand: '',
      cost_price: '',
      selling_price: '',
      tax_rate: '18',
      initial_stock: '0',
      minimum_stock: '10',
      maximum_stock: '1000',
      reorder_point: '20',
      location: 'Main Storage',
      warehouse: 'Main Warehouse'
    });
    setErrors({});
    setCalculatedMarkup(0);
    setCalculatedProfit(0);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FiPackage className="h-8 w-8" />
            <div>
              <h2 className="text-2xl font-bold">Add New Product</h2>
              <p className="text-blue-100 text-sm">Add product to inventory with real-time sync</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
          >
            <FiX className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {loadingData ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-gray-500 mt-2">Loading form data...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Quick Add Mode Toggle */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
                <div className="flex items-center space-x-3">
                  <FiZap className="h-5 w-5 text-green-600" />
                  <div>
                    <h4 className="font-semibold text-gray-900">Quick Add Mode</h4>
                    <p className="text-xs text-gray-600">Select from common Uganda products or enter manually</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setQuickAddMode(!quickAddMode)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    quickAddMode 
                      ? 'bg-green-600 text-white' 
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {quickAddMode ? 'Quick Add ON' : 'Manual Entry'}
                </button>
              </div>

              {/* Quick Select Common Products */}
              {quickAddMode && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <FiPackage className="mr-2 h-5 w-5 text-blue-600" />
                    Common Uganda Supermarket Products
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {commonProducts.map((product, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => quickSelectProduct(product)}
                        className="text-left p-3 bg-white border border-gray-200 rounded-lg hover:border-green-500 hover:shadow-md transition-all group"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-sm text-gray-900 group-hover:text-green-600">{product.name}</p>
                            <p className="text-xs text-gray-500">{product.brand}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-semibold text-blue-600">UGX {product.typical_price.toLocaleString()}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-600 mt-3 text-center">
                    💡 Click any product to auto-fill the form with typical prices
                  </p>
                </div>
              )}

              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <FiTag className="mr-2" />
                  Product Details {quickAddMode && <span className="ml-2 text-sm text-green-600">(Auto-filled or customize)</span>}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* SKU */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      SKU * <span className="text-xs text-gray-500">(Product Code)</span>
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        name="sku"
                        value={formData.sku}
                        onChange={handleChange}
                        className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                          errors.sku ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="e.g., PROD-0001"
                      />
                      <button
                        type="button"
                        onClick={generateSKU}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                        title="Generate SKU"
                      >
                        Auto
                      </button>
                    </div>
                    {errors.sku && <p className="text-red-500 text-xs mt-1">{errors.sku}</p>}
                  </div>

                  {/* Barcode */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <FiHash className="inline mr-1" />
                      Barcode <span className="text-xs text-gray-500">(Optional)</span>
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        name="barcode"
                        value={formData.barcode}
                        onChange={handleChange}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., 1234567890123"
                      />
                      <button
                        type="button"
                        onClick={() => setShowBarcodeScanner(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                        title="Scan barcode with camera or barcode gun"
                      >
                        <FiCamera className="h-4 w-4" />
                        <span className="text-xs">Scan</span>
                      </button>
                    </div>
                  </div>

                  {/* Product Name */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                        errors.name ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="e.g., iPhone 15 Pro Max 256GB"
                    />
                    {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                  </div>

                  {/* Brand */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Brand
                    </label>
                    <input
                      type="text"
                      name="brand"
                      value={formData.brand}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Apple"
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category <span className="text-xs text-gray-500">(Optional)</span>
                    </label>
                    <select
                      name="category_id"
                      value={formData.category_id}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Supplier */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <FiTruck className="inline mr-1" />
                      Supplier <span className="text-xs text-gray-500">(Optional)</span>
                    </label>
                    <select
                      name="supplier_id"
                      value={formData.supplier_id}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Supplier</option>
                      {suppliers.map(sup => (
                        <option key={sup.id} value={sup.id}>
                          {sup.company_name} {sup.contact_person && `(${sup.contact_person})`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Description */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      rows="3"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Product description..."
                    />
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <FiDollarSign className="mr-2" />
                  Pricing (UGX)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Cost Price */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cost Price * <span className="text-xs text-gray-500">(Buying)</span>
                    </label>
                    <input
                      type="number"
                      name="cost_price"
                      value={formData.cost_price}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                        errors.cost_price ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="0.00"
                    />
                    {errors.cost_price && <p className="text-red-500 text-xs mt-1">{errors.cost_price}</p>}
                  </div>

                  {/* Selling Price */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Selling Price * <span className="text-xs text-gray-500">(Retail)</span>
                    </label>
                    <input
                      type="number"
                      name="selling_price"
                      value={formData.selling_price}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                        errors.selling_price ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="0.00"
                    />
                    {errors.selling_price && <p className="text-red-500 text-xs mt-1">{errors.selling_price}</p>}
                  </div>

                  {/* Tax Rate */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      VAT Rate (%)
                    </label>
                    <input
                      type="number"
                      name="tax_rate"
                      value={formData.tax_rate}
                      onChange={handleChange}
                      min="0"
                      max="100"
                      step="0.01"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Profit & Markup Display */}
                {(formData.cost_price && formData.selling_price) && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Markup:</span>
                        <span className="ml-2 font-bold text-green-700">{calculatedMarkup}%</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Profit per Unit:</span>
                        <span className="ml-2 font-bold text-green-700">
                          UGX {calculatedProfit.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Inventory Settings */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <FiBox className="mr-2" />
                  Inventory Settings
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Initial Stock */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Initial Stock *
                    </label>
                    <input
                      type="number"
                      name="initial_stock"
                      value={formData.initial_stock}
                      onChange={handleChange}
                      min="0"
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                        errors.initial_stock ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="0"
                    />
                    {errors.initial_stock && <p className="text-red-500 text-xs mt-1">{errors.initial_stock}</p>}
                  </div>

                  {/* Minimum Stock */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Minimum Stock <span className="text-xs text-gray-500">(Alert Level)</span>
                    </label>
                    <input
                      type="number"
                      name="minimum_stock"
                      value={formData.minimum_stock}
                      onChange={handleChange}
                      min="0"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Maximum Stock */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Maximum Stock
                    </label>
                    <input
                      type="number"
                      name="maximum_stock"
                      value={formData.maximum_stock}
                      onChange={handleChange}
                      min="0"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Reorder Point */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reorder Point <span className="text-xs text-gray-500">(Auto-reorder)</span>
                    </label>
                    <input
                      type="number"
                      name="reorder_point"
                      value={formData.reorder_point}
                      onChange={handleChange}
                      min="0"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Location */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <FiMapPin className="inline mr-1" />
                      Storage Location
                    </label>
                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., A1-B2-S3"
                    />
                  </div>

                  {/* Warehouse */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Warehouse
                    </label>
                    <select
                      name="warehouse"
                      value={formData.warehouse}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Main Warehouse">Main Warehouse</option>
                      <option value="Kampala Branch">Kampala Branch</option>
                      <option value="Entebbe Branch">Entebbe Branch</option>
                      <option value="Jinja Branch">Jinja Branch</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t">
            <div className="text-sm text-gray-500">
              <FiAlertCircle className="inline mr-1" />
              Fields marked with * are required
            </div>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || loadingData}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Adding Product...</span>
                  </>
                ) : (
                  <>
                    <FiSave className="h-4 w-4" />
                    <span>Add Product</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
      </div>
      
      {/* Barcode Scanner Modal */}
      {showBarcodeScanner && (
        <DualScannerInterface
          onBarcodeScanned={handleBarcodeScanned}
          onClose={() => setShowBarcodeScanner(false)}
        />
      )}
    </>
  );
};

export default AddProductModal;
