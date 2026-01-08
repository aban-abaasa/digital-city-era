import React, { useState, useEffect } from 'react';
import { 
  FiShoppingCart, FiCreditCard, FiDollarSign, FiSmartphone, FiX, FiPlus, FiMinus,
  FiSearch, FiUser, FiTag, FiPercent, FiCheckCircle, FiPrinter, FiMail,
  FiTrash2, FiEdit, FiRefreshCw, FiPackage, FiHash,
  FiClock, FiCalendar, FiMapPin, FiPhone, FiMail as FiEmail, FiShield
} from 'react-icons/fi';
import { toast } from 'react-toastify';

const AdvancedPOS = ({ isOpen, onClose }) => {
  const [currentCart, setCurrentCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(8.5);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  const [products] = useState([
    { id: 1, name: 'iPhone 15 Pro Max', price: 1199.99, category: 'Electronics', stock: 15, image: '📱' },
    { id: 2, name: 'AirPods Pro 3rd Gen', price: 249.99, category: 'Audio', stock: 8, image: '🎧' },
    { id: 3, name: 'MacBook Air M2', price: 1299.99, category: 'Computers', stock: 5, image: '💻' },
    { id: 4, name: 'Apple Watch Series 9', price: 399.99, category: 'Wearables', stock: 12, image: '⌚' },
    { id: 5, name: 'iPad Pro 12.9"', price: 1099.99, category: 'Tablets', stock: 7, image: '📱' },
    { id: 6, name: 'Samsung Galaxy S24', price: 999.99, category: 'Electronics', stock: 10, image: '📱' }
  ]);

  const [customers] = useState([
    { id: 1, name: 'John Smith', phone: '+1 (555) 123-4567', email: 'john@email.com', loyaltyPoints: 1250 },
    { id: 2, name: 'Sarah Johnson', phone: '+1 (555) 987-6543', email: 'sarah@email.com', loyaltyPoints: 890 },
    { id: 3, name: 'Mike Wilson', phone: '+1 (555) 456-7890', email: 'mike@email.com', loyaltyPoints: 2100 }
  ]);

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const cartTotal = currentCart.reduce((total, item) => total + (item.price * item.quantity), 0);
  const discountAmount = (cartTotal * discount) / 100;
  const taxAmount = ((cartTotal - discountAmount) * tax) / 100;
  const finalTotal = cartTotal - discountAmount + taxAmount;

  const addToCart = (product) => {
    const existingItem = currentCart.find(item => item.id === product.id);
    if (existingItem) {
      setCurrentCart(cart =>
        cart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCurrentCart(cart => [...cart, { ...product, quantity: 1 }]);
    }
    toast.success(`${product.name} added to cart`);
  };

  const updateQuantity = (id, quantity) => {
    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }
    setCurrentCart(cart =>
      cart.map(item =>
        item.id === id ? { ...item, quantity } : item
      )
    );
  };

  const removeFromCart = (id) => {
    setCurrentCart(cart => cart.filter(item => item.id !== id));
    toast.info('Item removed from cart');
  };

  const clearCart = () => {
    setCurrentCart([]);
    setSelectedCustomer(null);
    setDiscount(0);
    toast.info('Cart cleared');
  };

  const processPayment = async () => {
    if (currentCart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    setIsProcessing(true);
    
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    toast.success('Payment processed successfully!');
    
    // Generate receipt
    const receipt = {
      id: `RCP-${Date.now()}`,
      date: new Date().toLocaleString(),
      items: currentCart,
      subtotal: cartTotal,
      discount: discountAmount,
      tax: taxAmount,
      total: finalTotal,
      paymentMethod,
      customer: selectedCustomer
    };
    
    console.log('Receipt:', receipt);
    
    // Clear cart and reset
    clearCart();
    setIsProcessing(false);
  };

  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
    setShowCustomerModal(false);
    toast.success(`Customer ${customer.name} selected`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <FiShoppingCart className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-3xl font-bold">Advanced POS System</h2>
                <p className="text-blue-100">Point of Sale Management</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <FiX className="h-8 w-8" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Products */}
          <div className="w-2/3 flex flex-col">
            {/* Search and Customer */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex space-x-4 mb-4">
                <div className="flex-1 relative">
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={() => setShowCustomerModal(true)}
                  className="flex items-center space-x-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  <FiUser className="h-5 w-5" />
                  <span>{selectedCustomer ? selectedCustomer.name : 'Select Customer'}</span>
                </button>
              </div>
            </div>

            {/* Products Grid */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProducts.map(product => (
                  <div
                    key={product.id}
                    className="bg-white border border-gray-200 rounded-2xl p-4 hover:shadow-lg transition-all duration-200 cursor-pointer"
                    onClick={() => addToCart(product)}
                  >
                    <div className="text-center">
                      <div className="text-4xl mb-3">{product.image}</div>
                      <h3 className="font-bold text-gray-900 mb-2">{product.name}</h3>
                      <p className="text-sm text-gray-600 mb-2">{product.category}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-green-600">${product.price}</span>
                        <span className="text-sm text-gray-500">Stock: {product.stock}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel - Cart and Payment */}
          <div className="w-1/3 border-l border-gray-200 flex flex-col">
            {/* Cart Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">Shopping Cart</h3>
                <button
                  onClick={clearCart}
                  className="text-red-500 hover:text-red-700 transition-colors"
                >
                  <FiTrash2 className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-6">
              {currentCart.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🛒</div>
                  <p className="text-gray-500">Cart is empty</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {currentCart.map(item => (
                    <div key={item.id} className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">{item.image}</div>
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-900">{item.name}</h4>
                          <p className="text-sm text-gray-600">${item.price}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300 transition-colors"
                          >
                            <FiMinus className="h-4 w-4" />
                          </button>
                          <span className="w-8 text-center font-bold">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300 transition-colors"
                          >
                            <FiPlus className="h-4 w-4" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-red-500 hover:text-red-700 transition-colors"
                        >
                          <FiX className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-2 text-right">
                        <span className="font-bold text-gray-900">
                          ${(item.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payment Summary */}
            <div className="border-t border-gray-200 p-6">
              <div className="space-y-3 mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-bold">${cartTotal.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Discount ({discount}%)</span>
                  <span className="font-bold text-green-600">-${discountAmount.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax ({tax}%)</span>
                  <span className="font-bold">${taxAmount.toFixed(2)}</span>
                </div>
                
                <div className="border-t border-gray-200 pt-3">
                  <div className="flex justify-between">
                    <span className="text-lg font-bold text-gray-900">Total</span>
                    <span className="text-lg font-bold text-gray-900">${finalTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Discount Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Discount %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Payment Method */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'card', label: 'Card', icon: FiCreditCard },
                    { id: 'cash', label: 'Cash', icon: FiDollarSign },
                    { id: 'mobile', label: 'Mobile', icon: FiSmartphone },
                    { id: 'loyalty', label: 'Loyalty', icon: FiTag }
                  ].map(method => (
                    <button
                      key={method.id}
                      onClick={() => setPaymentMethod(method.id)}
                      className={`flex items-center justify-center space-x-2 p-3 rounded-lg border-2 transition-colors ${
                        paymentMethod === method.id
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <method.icon className="h-4 w-4" />
                      <span className="text-sm font-medium">{method.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Process Payment Button */}
              <button
                onClick={processPayment}
                disabled={currentCart.length === 0 || isProcessing}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-xl font-bold text-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {isProcessing ? (
                  <>
                    <FiRefreshCw className="h-5 w-5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <FiCheckCircle className="h-5 w-5" />
                    <span>Process Payment - ${finalTotal.toFixed(2)}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Customer Selection Modal */}
        {showCustomerModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-60 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold text-gray-900">Select Customer</h3>
                  <button
                    onClick={() => setShowCustomerModal(false)}
                    className="text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <FiX className="h-6 w-6" />
                  </button>
                </div>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-96">
                <div className="space-y-3">
                  {customers.map(customer => (
                    <div
                      key={customer.id}
                      onClick={() => handleCustomerSelect(customer)}
                      className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-gray-900">{customer.name}</h4>
                          <p className="text-sm text-gray-600">{customer.phone}</p>
                          <p className="text-sm text-gray-600">{customer.email}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-blue-600">{customer.loyaltyPoints} points</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdvancedPOS;
