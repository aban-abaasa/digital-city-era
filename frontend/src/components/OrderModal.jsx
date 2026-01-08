import React, { useState, useEffect } from 'react';
import { FiX, FiPlus, FiMinus, FiMessageSquare, FiMail, FiDownload, FiSend, FiPackage, FiCalendar, FiCheck, FiLoader } from 'react-icons/fi';
import orderService from '../services/orderService';
import orderApiService from '../services/orderApiService';
import { toast } from 'react-toastify';

const OrderModal = ({ isOpen, onClose, supplier }) => {
  const [orderItems, setOrderItems] = useState([]);
  const [newItem, setNewItem] = useState({
    name: '',
    quantity: 1,
    unit: 'pcs',
    unitPrice: 0
  });
  const [orderDetails, setOrderDetails] = useState({
    requestedDeliveryDate: '',
    notes: '',
    orderType: 'standard'
  });
  const [activeTab, setActiveTab] = useState('create');
  const [isCreating, setIsCreating] = useState(false);
  const [isSending, setIsSending] = useState({ sms: false, email: false });
  const [createdOrder, setCreatedOrder] = useState(null);

  // Common Ugandan products for quick selection
  const commonProducts = [
    { name: 'Ugandan Coffee Beans', unit: 'kg', suggestedPrice: 8000 },
    { name: 'Fresh Matooke', unit: 'bunches', suggestedPrice: 4000 },
    { name: 'White Rice', unit: 'bags', suggestedPrice: 120000 },
    { name: 'Cooking Oil', unit: 'liters', suggestedPrice: 4500 },
    { name: 'Sugar', unit: 'kg', suggestedPrice: 3500 },
    { name: 'Posho (Maize Flour)', unit: 'kg', suggestedPrice: 2800 },
    { name: 'Fresh Fish', unit: 'kg', suggestedPrice: 12000 },
    { name: 'Dairy Milk', unit: 'liters', suggestedPrice: 2500 }
  ];

  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setOrderItems([]);
      setNewItem({ name: '', quantity: 1, unit: 'pcs', unitPrice: 0 });
      setOrderDetails({
        requestedDeliveryDate: '',
        notes: '',
        orderType: 'standard'
      });
      setActiveTab('create');
      setCreatedOrder(null);
      setIsCreating(false);
      setIsSending({ sms: false, email: false });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const addItem = () => {
    if (!newItem.name || newItem.unitPrice <= 0) {
      toast.error('Please fill in item name and price');
      return;
    }

    const item = {
      id: Date.now(),
      ...newItem,
      totalPrice: newItem.quantity * newItem.unitPrice
    };

    setOrderItems([...orderItems, item]);
    setNewItem({ name: '', quantity: 1, unit: 'pcs', unitPrice: 0 });
  };

  const removeItem = (itemId) => {
    setOrderItems(orderItems.filter(item => item.id !== itemId));
  };

  const updateItemQuantity = (itemId, quantity) => {
    if (quantity < 1) return;
    setOrderItems(orderItems.map(item => 
      item.id === itemId 
        ? { ...item, quantity, totalPrice: quantity * item.unitPrice }
        : item
    ));
  };

  const selectCommonProduct = (product) => {
    setNewItem({
      name: product.name,
      quantity: 1,
      unit: product.unit,
      unitPrice: product.suggestedPrice
    });
  };

  const calculateTotals = () => {
    const subtotal = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const tax = subtotal * 0.18; // 18% VAT in Uganda
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const generateOrderData = () => {
    const { subtotal, tax, total } = calculateTotals();
    const orderNumber = `ORD-${Date.now()}`;
    
    return {
      orderNumber,
      createdAt: new Date().toISOString(),
      supplier: supplier,
      items: orderItems,
      subtotal,
      tax,
      total,
      requestedDeliveryDate: orderDetails.requestedDeliveryDate,
      notes: orderDetails.notes,
      orderType: orderDetails.orderType
    };
  };

  const handleCreateOrder = async () => {
    if (orderItems.length === 0) {
      toast.error('Please add at least one item to the order');
      return;
    }

    setIsCreating(true);
    try {
      const orderData = generateOrderData();
      const createdOrderData = await orderApiService.createOrder(orderData);
      
      setCreatedOrder(createdOrderData);
      setActiveTab('send');
      
      // Auto-scroll to send tab content
      setTimeout(() => {
        const sendTabContent = document.querySelector('[data-tab="send"]');
        if (sendTabContent) {
          sendTabContent.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
      
    } catch (error) {
      console.error('Failed to create order:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSendSMS = async () => {
    if (!createdOrder && orderItems.length === 0) {
      toast.error('Please create an order first');
      return;
    }

    if (!supplier?.phone) {
      toast.error('Supplier phone number not available');
      return;
    }

    setIsSending(prev => ({ ...prev, sms: true }));
    try {
      const orderData = createdOrder || generateOrderData();
      
      // Use both API service and original service for comprehensive functionality
      await Promise.all([
        orderApiService.sendOrderSMS(orderData, supplier.phone),
        orderService.sendOrderViaSMS(orderData, supplier.phone)
      ]);
      
    } catch (error) {
      console.error('Failed to send SMS:', error);
    } finally {
      setIsSending(prev => ({ ...prev, sms: false }));
    }
  };

  const handleSendEmail = async () => {
    if (!createdOrder && orderItems.length === 0) {
      toast.error('Please create an order first');
      return;
    }

    if (!supplier?.email) {
      toast.error('Supplier email not available');
      return;
    }

    setIsSending(prev => ({ ...prev, email: true }));
    try {
      const orderData = createdOrder || generateOrderData();
      
      // Use both API service and original service for comprehensive functionality
      await Promise.all([
        orderApiService.sendOrderEmail(orderData, supplier.email),
        orderService.sendOrderViaEmail(orderData, supplier.email)
      ]);
      
    } catch (error) {
      console.error('Failed to send email:', error);
    } finally {
      setIsSending(prev => ({ ...prev, email: false }));
    }
  };

  const handleDownloadPDF = async () => {
    if (!createdOrder && orderItems.length === 0) {
      toast.error('Please create an order first');
      return;
    }

    const orderData = createdOrder || generateOrderData();
    try {
      const pdfResult = await orderService.generateOrderPDF(orderData);
      if (pdfResult.success) {
        // Create a download link for the PDF
        const link = document.createElement('a');
        link.href = pdfResult.pdfUrl;
        link.download = pdfResult.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Order PDF downloaded successfully!');
      } else {
        throw new Error('Failed to generate PDF');
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate PDF');
    }
  };

  const { subtotal, tax, total } = calculateTotals();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 via-blue-600 to-purple-600 p-6 text-white rounded-t-2xl flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
              <FiPackage className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">📋 Create Purchase Order</h2>
              <p className="text-green-100">Supplier: {supplier?.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white hover:text-gray-200 bg-white/20 p-2 rounded-lg">
            <FiX className="h-6 w-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          <button
            className={`flex-1 py-3 text-center font-medium text-sm transition-all ${
              activeTab === 'create' ? 'border-b-2 border-green-600 text-green-700 bg-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
            onClick={() => setActiveTab('create')}
          >
            <FiPackage className="inline-block mr-2" /> Create Order
          </button>
          <button
            className={`flex-1 py-3 text-center font-medium text-sm transition-all ${
              activeTab === 'send' ? 'border-b-2 border-green-600 text-green-700 bg-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
            onClick={() => setActiveTab('send')}
          >
            <FiSend className="inline-block mr-2" /> Send Order
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {activeTab === 'create' && (
            <div className="space-y-6">
              {/* Quick Product Selection */}
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">🛒 Quick Product Selection</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {commonProducts.map((product, index) => (
                    <button
                      key={index}
                      onClick={() => selectCommonProduct(product)}
                      className="p-3 bg-white rounded-lg border-2 border-gray-200 hover:border-green-500 hover:bg-green-50 transition-all text-left"
                    >
                      <p className="font-bold text-sm text-gray-800">{product.name}</p>
                      <p className="text-xs text-gray-600">{formatCurrency(product.suggestedPrice)}/{product.unit}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Add New Item */}
              <div className="bg-gradient-to-br from-green-50 to-teal-50 rounded-xl p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">➕ Add Item</h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Item Name</label>
                    <input
                      type="text"
                      value={newItem.name}
                      onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="Enter item name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={newItem.quantity}
                      onChange={(e) => setNewItem({...newItem, quantity: parseInt(e.target.value) || 1})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Unit</label>
                    <select
                      value={newItem.unit}
                      onChange={(e) => setNewItem({...newItem, unit: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="pcs">Pieces</option>
                      <option value="kg">Kilograms</option>
                      <option value="liters">Liters</option>
                      <option value="bags">Bags</option>
                      <option value="bunches">Bunches</option>
                      <option value="boxes">Boxes</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Unit Price (UGX)</label>
                    <input
                      type="number"
                      min="0"
                      value={newItem.unitPrice}
                      onChange={(e) => setNewItem({...newItem, unitPrice: parseFloat(e.target.value) || 0})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <button
                    onClick={addItem}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold transition-all"
                  >
                    <FiPlus className="inline h-4 w-4 mr-2" />
                    Add Item
                  </button>
                </div>
              </div>

              {/* Order Items */}
              {orderItems.length > 0 && (
                <div className="bg-white rounded-xl border-2 border-gray-200">
                  <div className="p-4 bg-gray-50 border-b">
                    <h3 className="text-lg font-bold text-gray-800">📦 Order Items ({orderItems.length})</h3>
                  </div>
                  <div className="p-4">
                    <div className="space-y-3">
                      {orderItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <p className="font-bold text-gray-800">{item.name}</p>
                            <p className="text-sm text-gray-600">{formatCurrency(item.unitPrice)} per {item.unit}</p>
                          </div>
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                              className="p-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                            >
                              <FiMinus className="h-4 w-4" />
                            </button>
                            <span className="font-bold text-lg px-3">{item.quantity}</span>
                            <button
                              onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                              className="p-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                            >
                              <FiPlus className="h-4 w-4" />
                            </button>
                            <div className="text-right min-w-[100px]">
                              <p className="font-bold text-green-600">{formatCurrency(item.totalPrice)}</p>
                            </div>
                            <button
                              onClick={() => removeItem(item.id)}
                              className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                            >
                              <FiX className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Totals */}
                    <div className="mt-6 p-4 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Subtotal:</span>
                          <span className="font-bold">{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Tax (18%):</span>
                          <span className="font-bold">{formatCurrency(tax)}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold border-t pt-2">
                          <span>Total:</span>
                          <span className="text-green-600">{formatCurrency(total)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Order Details */}
              <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">📋 Order Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Requested Delivery Date</label>
                    <input
                      type="date"
                      value={orderDetails.requestedDeliveryDate}
                      onChange={(e) => setOrderDetails({...orderDetails, requestedDeliveryDate: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Order Type</label>
                    <select
                      value={orderDetails.orderType}
                      onChange={(e) => setOrderDetails({...orderDetails, orderType: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="standard">Standard Order</option>
                      <option value="urgent">Urgent Order</option>
                      <option value="bulk">Bulk Order</option>
                      <option value="recurring">Recurring Order</option>
                    </select>
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Special Instructions</label>
                  <textarea
                    value={orderDetails.notes}
                    onChange={(e) => setOrderDetails({...orderDetails, notes: e.target.value})}
                    rows="3"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Any special instructions or notes for the supplier..."
                  />
                </div>
              </div>

              {/* Create Order Button */}
              {orderItems.length > 0 && !createdOrder && (
                <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-xl p-6 text-center">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">🚀 Ready to Create Order</h3>
                  <p className="text-gray-600 mb-4">
                    {orderItems.length} items • Total: {formatCurrency(total)}
                  </p>
                  <button
                    onClick={handleCreateOrder}
                    disabled={isCreating}
                    className="px-8 py-4 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-xl hover:from-green-700 hover:to-blue-700 font-bold text-lg transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {isCreating ? (
                      <>
                        <FiLoader className="inline h-5 w-5 mr-2 animate-spin" />
                        Creating Order...
                      </>
                    ) : (
                      <>
                        <FiCheck className="inline h-5 w-5 mr-2" />
                        Create Order
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Order Created Success */}
              {createdOrder && (
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border-2 border-green-200">
                  <div className="text-center">
                    <div className="bg-green-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FiCheck className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-green-800 mb-2">✅ Order Created Successfully!</h3>
                    <p className="text-green-700 mb-4">
                      Order <span className="font-mono font-bold">{createdOrder.orderNumber}</span> has been created and is ready to send.
                    </p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-green-600 font-medium">Order ID:</p>
                        <p className="font-mono text-green-800">{createdOrder.id}</p>
                      </div>
                      <div>
                        <p className="text-green-600 font-medium">Status:</p>
                        <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-bold">
                          {createdOrder.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'send' && (
            <div className="space-y-6" data-tab="send">
              {orderItems.length === 0 ? (
                <div className="text-center py-12">
                  <FiPackage className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-xl font-bold text-gray-600 mb-2">No Items Added</h3>
                  <p className="text-gray-500 mb-4">Please add items to your order before sending</p>
                  <button
                    onClick={() => setActiveTab('create')}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold"
                  >
                    Add Items
                  </button>
                </div>
              ) : (
                <>
                  {/* Order Summary */}
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">📊 Order Summary</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">{orderItems.length}</p>
                        <p className="text-gray-600">Items</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">{formatCurrency(total)}</p>
                        <p className="text-gray-600">Total Value</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-purple-600">{supplier?.name}</p>
                        <p className="text-gray-600">Supplier</p>
                      </div>
                    </div>
                  </div>

                  {/* Send Options */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* SMS */}
                    <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-blue-200">
                      <div className="text-center">
                        <FiMessageSquare className="h-12 w-12 mx-auto mb-4 text-blue-600" />
                        <h4 className="text-lg font-bold text-gray-800 mb-2">📱 Send via SMS</h4>
                        <p className="text-gray-600 text-sm mb-4">
                          Quick order summary to supplier's phone
                        </p>
                        <p className="text-sm text-gray-500 mb-4">
                          To: {supplier?.phone}
                        </p>
                        <button
                          onClick={handleSendSMS}
                          disabled={isSending.sms}
                          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSending.sms ? (
                            <>
                              <FiLoader className="inline h-4 w-4 mr-2 animate-spin" />
                              Sending SMS...
                            </>
                          ) : (
                            <>
                              <FiMessageSquare className="inline h-4 w-4 mr-2" />
                              Send SMS
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Email */}
                    <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-green-200">
                      <div className="text-center">
                        <FiMail className="h-12 w-12 mx-auto mb-4 text-green-600" />
                        <h4 className="text-lg font-bold text-gray-800 mb-2">📧 Send via Email</h4>
                        <p className="text-gray-600 text-sm mb-4">
                          Detailed order with full specifications
                        </p>
                        <p className="text-sm text-gray-500 mb-4">
                          To: {supplier?.email}
                        </p>
                        <button
                          onClick={handleSendEmail}
                          disabled={isSending.email}
                          className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSending.email ? (
                            <>
                              <FiLoader className="inline h-4 w-4 mr-2 animate-spin" />
                              Sending Email...
                            </>
                          ) : (
                            <>
                              <FiMail className="inline h-4 w-4 mr-2" />
                              Send Email
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* PDF */}
                    <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-purple-200">
                      <div className="text-center">
                        <FiDownload className="h-12 w-12 mx-auto mb-4 text-purple-600" />
                        <h4 className="text-lg font-bold text-gray-800 mb-2">📄 Download PDF</h4>
                        <p className="text-gray-600 text-sm mb-4">
                          Professional PDF for printing/records
                        </p>
                        <p className="text-sm text-gray-500 mb-4">
                          Format: A4 PDF
                        </p>
                        <button
                          onClick={handleDownloadPDF}
                          className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 font-bold transition-all"
                        >
                          <FiDownload className="inline h-4 w-4 mr-2" />
                          Download PDF
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderModal;
