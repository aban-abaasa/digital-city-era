import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import paymentService from '../services/paymentService';
import { 
  FiX, FiCreditCard, FiSmartphone, FiDollarSign, FiWifi, FiShield,
  FiCheck, FiAlertCircle, FiLock, FiZap, FiGift, FiStar, FiHeart,
  FiRefreshCw, FiCheckCircle, FiPhone, FiMail, FiUser, FiCalendar,
  FiTrendingUp, FiPercent, FiClock, FiGlobe, FiAward, FiActivity,
  FiInfo, FiEye, FiEyeOff, FiCamera, FiChevronRight, FiTrendingDown,
  FiBarChart, FiCpu, FiMoon, FiSun
} from 'react-icons/fi';

const PaymentMethods = ({ isOpen, onClose, orderTotal, customerInfo, loyaltyPoints, onPaymentComplete }) => {
  const [selectedMethod, setSelectedMethod] = useState('');
  const [paymentState, setPaymentState] = useState('selecting');
  const [processing, setProcessing] = useState(false);
  const [paymentProgress, setPaymentProgress] = useState(0);
  const [darkMode, setDarkMode] = useState(false);

  // Payment form states
  const [cardDetails, setCardDetails] = useState({
    number: '',
    expiry: '',
    cvv: '',
    name: '',
    showCvv: false
  });
  const [mobileNumber, setMobileNumber] = useState('');
  const [usePoints, setUsePoints] = useState(false);
  const [pointsToUse, setPointsToUse] = useState(0);
  
  // Receipt delivery states
  const [receiptDelivery, setReceiptDelivery] = useState({
    method: 'mobile', // 'mobile', 'email', 'both', 'none'
    email: customerInfo?.email || '',
    phone: customerInfo?.phone || '',
    sendSMS: true,
    sendEmail: false,
    sendWhatsApp: true
  });

  const maxPointsDiscount = Math.min(loyaltyPoints * 0.01, orderTotal * 0.5);
  const finalTotal = usePoints ? orderTotal - pointsToUse * 0.01 : orderTotal;

  const paymentMethods = [
    {
      id: 'mobile_money',
      name: 'Mobile Money',
      icon: FiSmartphone,
      color: 'from-green-500 to-emerald-600',
      description: 'MTN Mobile Money, Airtel Money',
      processingTime: '30 seconds',
      fees: 'Standard telecom rates',
      popularity: 98,
      features: ['Instant', 'Local', 'No Bank Required'],
      logo: '📱',
      badge: 'MOST POPULAR',
      badgeColor: 'bg-green-500'
    },
    {
      id: 'airtel_money',
      name: 'Airtel Money',
      icon: '📶',
      color: 'from-red-500 to-red-700',
      description: 'Direct Airtel Money payment',
      processingTime: '15-30 seconds',
      fees: 'UGX 500 - 2000',
      popularity: 92,
      features: ['Instant', 'Reliable', 'Wide Coverage'],
      logo: '🔴',
      badge: 'RECOMMENDED'
    },
    {
      id: 'card',
      name: 'Credit/Debit Card',
      icon: FiCreditCard,
      color: 'from-blue-500 to-blue-700',
      description: 'Visa, MasterCard, American Express',
      processingTime: '2-3 seconds',
      fees: 'No additional fees',
      popularity: 85,
      features: ['Instant', 'Secure', 'Refundable'],
      logo: '💳'
    },
    {
      id: 'cash',
      name: 'Cash Payment',
      icon: FiDollarSign,
      color: 'from-gray-600 to-gray-800',
      description: 'Pay with cash at checkout',
      processingTime: 'Immediate',
      fees: 'No fees',
      popularity: 75,
      features: ['Immediate', 'Traditional', 'No Technology'],
      logo: '💵'
    }
  ];

  const handleMethodSelect = (methodId) => {
    setSelectedMethod(methodId);
    setPaymentState('details');
  };

  const sendMobileReceipts = async (paymentResult) => {
    const receiptData = {
      orderId: paymentResult.transactionId,
      total: finalTotal,
      timestamp: new Date().toISOString(),
      paymentMethod: selectedMethod,
      customer: customerInfo
    };

    try {
      // Send SMS receipt
      if (receiptDelivery.sendSMS && receiptDelivery.phone) {
        await new Promise(resolve => setTimeout(resolve, 500));
        toast.success(`📱 SMS receipt sent to ${receiptDelivery.phone}!`);
      }

      // Send Email receipt
      if (receiptDelivery.sendEmail && receiptDelivery.email) {
        await new Promise(resolve => setTimeout(resolve, 800));
        toast.success(`📧 Email receipt sent to ${receiptDelivery.email}!`);
      }

      // Send WhatsApp receipt
      if (receiptDelivery.sendWhatsApp && receiptDelivery.phone) {
        await new Promise(resolve => setTimeout(resolve, 1200));
        toast.success(`💬 WhatsApp receipt sent to ${receiptDelivery.phone}!`);
      }

      if (!receiptDelivery.sendSMS && !receiptDelivery.sendEmail && !receiptDelivery.sendWhatsApp) {
        toast.info('🧾 Physical receipt will be printed');
      }
    } catch (error) {
      toast.error('📱 Some receipts failed to send, but payment was successful');
    }
  };

  const handlePayment = async () => {
    setProcessing(true);
    setPaymentProgress(0);

    try {
      // Simulate payment progress
      const progressInterval = setInterval(() => {
        setPaymentProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            return 100;
          }
          return prev + Math.random() * 20;
        });
      }, 500);

      // Process payment based on selected method
      let result;
      const orderInfo = { total: finalTotal, currency: 'UGX' };

      switch (selectedMethod) {
        case 'mobile_money':
          result = await paymentService.processDigitalWallet({
            walletType: 'mtn_mobile_money',
            phoneNumber: mobileNumber,
            biometricAuth: true
          }, orderInfo);
          break;
        case 'airtel_money':
          result = await paymentService.processDigitalWallet({
            walletType: 'airtel_money',
            phoneNumber: mobileNumber,
            biometricAuth: true
          }, orderInfo);
          break;
        case 'card':
          result = await paymentService.processCardPayment(cardDetails, orderInfo);
          break;
        case 'cash':
          result = await paymentService.processCashPayment({
            cashReceived: finalTotal
          }, orderInfo);
          break;
        default:
          throw new Error('Payment method not implemented');
      }

      clearInterval(progressInterval);
      setPaymentProgress(100);

      if (result.success) {
        setPaymentState('success');
        toast.success('Payment processed successfully!');
        
        // Send receipts based on user preferences
        setTimeout(() => {
          sendMobileReceipts(result);
        }, 1000);
        
        setTimeout(() => {
          onPaymentComplete({
            ...result,
            receiptDelivery: receiptDelivery
          });
        }, 2000);
      } else {
        throw new Error(result.error || 'Payment failed');
      }
    } catch (error) {
      setPaymentState('failed');
      toast.error(error.message || 'Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const formatCardNumber = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(' ') : v;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity backdrop-blur-sm" onClick={onClose}></div>

        <div className={`inline-block align-bottom ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full`}>
          {/* Enhanced Header */}
          <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 px-6 py-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-black opacity-10"></div>
            <div className="relative flex items-center justify-between">
              <div className="flex items-center">
                <div className="bg-white bg-opacity-20 rounded-full p-3 mr-4">
                  <FiCreditCard className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white mb-1">
                    💳 Choose Payment Method
                  </h3>
                  <p className="text-blue-100 text-sm flex items-center">
                    <FiShield className="mr-2" />
                    Secure • Fast • Reliable Payment Processing
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="text-white hover:text-gray-200 transition-colors p-2 rounded-full hover:bg-white hover:bg-opacity-10"
                >
                  {darkMode ? <FiSun className="h-5 w-5" /> : <FiMoon className="h-5 w-5" />}
                </button>
                <button
                  onClick={onClose}
                  className="text-white hover:text-gray-200 transition-colors p-2 rounded-full hover:bg-white hover:bg-opacity-10"
                >
                  <FiX className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            {/* Order Summary Bar */}
            <div className="mt-4 bg-white bg-opacity-10 rounded-lg p-3 backdrop-blur-sm">
              <div className="flex justify-between items-center text-white">
                <span className="text-sm">Order Total:</span>
                <span className="text-lg font-bold">UGX {finalTotal.toLocaleString()}</span>
              </div>
              {usePoints && (
                <div className="flex justify-between items-center text-blue-100 text-xs mt-1">
                  <span>Loyalty Discount:</span>
                  <span>-UGX {(pointsToUse * 0.01).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          <div className={`p-6 ${darkMode ? 'bg-gray-800 text-white' : 'bg-gray-50'}`}>
            {paymentState === 'selecting' && (
              <div className="space-y-6">
                {/* Payment Methods Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {paymentMethods.map((method) => {
                    const IconComponent = typeof method.icon === 'string' ? 
                      () => <span className="text-3xl">{method.icon}</span> : 
                      method.icon;
                    
                    return (
                      <div
                        key={method.id}
                        onClick={() => handleMethodSelect(method.id)}
                        className={`relative group p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300 transform hover:scale-[1.02] hover:shadow-xl ${
                          selectedMethod === method.id
                            ? `border-blue-500 shadow-2xl ${darkMode ? 'bg-gray-700' : 'bg-white'}` 
                            : `border-gray-200 hover:border-gray-300 ${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-50'}`
                        }`}
                      >
                        {/* Badge */}
                        {method.badge && (
                          <div className={`absolute -top-3 -right-3 px-3 py-1 text-xs font-bold rounded-full shadow-lg transform rotate-12 ${
                            method.badgeColor || 'bg-gradient-to-r from-green-400 to-green-600'
                          } text-white`}>
                            {method.badge}
                          </div>
                        )}
                        
                        {/* Icon */}
                        <div className={`relative w-16 h-16 rounded-2xl bg-gradient-to-br ${method.color} flex items-center justify-center mb-4 mx-auto shadow-lg`}>
                          <div className="absolute inset-0 bg-white bg-opacity-20 rounded-2xl"></div>
                          <IconComponent className="text-white z-10" size={28} />
                        </div>

                        {/* Method Info */}
                        <div className="text-center mb-4">
                          <h3 className={`font-bold text-lg mb-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                            {method.logo} {method.name}
                          </h3>
                          <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'} mb-2`}>
                            {method.description}
                          </p>
                        </div>

                        {/* Stats */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className={`flex items-center ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                              <FiClock className="h-4 w-4 mr-1" />
                              Speed
                            </span>
                            <span className={`font-semibold ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
                              {method.processingTime}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-sm">
                            <span className={`flex items-center ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                              <FiTrendingUp className="h-4 w-4 mr-1" />
                              Popularity
                            </span>
                            <div className="flex items-center">
                              <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                <div 
                                  className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full"
                                  style={{ width: `${method.popularity}%` }}
                                ></div>
                              </div>
                              <span className={`text-xs font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                {method.popularity}%
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-sm">
                            <span className={`flex items-center ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                              <FiDollarSign className="h-4 w-4 mr-1" />
                              Fees
                            </span>
                            <span className={`font-semibold text-xs ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              {method.fees}
                            </span>
                          </div>
                        </div>

                        {/* Features */}
                        <div className="mt-4 flex flex-wrap gap-1">
                          {method.features.map((feature, index) => (
                            <span
                              key={index}
                              className={`px-2 py-1 text-xs font-medium rounded-full ${
                                darkMode 
                                  ? 'bg-gray-700 text-gray-300' 
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {feature}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {paymentState === 'details' && selectedMethod && (
              <div className="space-y-6">
                <div className="text-center">
                  <h4 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    Payment Details
                  </h4>
                  <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    Enter your {paymentMethods.find(m => m.id === selectedMethod)?.name} details
                  </p>
                </div>

                {/* Payment Forms */}
                {(selectedMethod === 'mobile_money' || selectedMethod === 'airtel_money') && (
                  <div className="space-y-4">
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-700'}`}>
                        Mobile Number
                      </label>
                      <div className="relative">
                        <FiPhone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type="tel"
                          value={mobileNumber}
                          onChange={(e) => setMobileNumber(e.target.value)}
                          placeholder="256 7XX XXX XXX"
                          className={`w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                            darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {selectedMethod === 'card' && (
                  <div className="space-y-4">
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-700'}`}>
                        Card Number
                      </label>
                      <input
                        type="text"
                        value={cardDetails.number}
                        onChange={(e) => setCardDetails({...cardDetails, number: formatCardNumber(e.target.value)})}
                        placeholder="1234 5678 9012 3456"
                        className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white'
                        }`}
                        maxLength="19"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-700'}`}>
                          Expiry Date
                        </label>
                        <input
                          type="text"
                          value={cardDetails.expiry}
                          onChange={(e) => setCardDetails({...cardDetails, expiry: e.target.value})}
                          placeholder="MM/YY"
                          className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                            darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white'
                          }`}
                          maxLength="5"
                        />
                      </div>
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-700'}`}>
                          CVV
                        </label>
                        <input
                          type={cardDetails.showCvv ? "text" : "password"}
                          value={cardDetails.cvv}
                          onChange={(e) => setCardDetails({...cardDetails, cvv: e.target.value})}
                          placeholder="123"
                          className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                            darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white'
                          }`}
                          maxLength="4"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Mobile Receipt Delivery Section */}
                <div className={`p-6 rounded-xl border-2 border-dashed ${darkMode ? 'border-gray-600 bg-gray-700' : 'border-green-200 bg-green-50'}`}>
                  <h4 className={`font-bold text-lg mb-4 flex items-center ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    📱 Mobile Receipt Delivery
                    <span className="ml-2 px-2 py-1 bg-green-500 text-white text-xs rounded-full">
                      ECO-FRIENDLY
                    </span>
                  </h4>
                  
                  <p className={`text-sm mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    🌱 Go paperless! Receive your receipt instantly on your mobile phone via SMS, Email, or WhatsApp.
                  </p>

                  {/* Receipt Delivery Methods */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    {/* SMS Receipt */}
                    <div className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      receiptDelivery.sendSMS 
                        ? 'border-green-500 bg-green-100' 
                        : darkMode ? 'border-gray-600 bg-gray-800 hover:bg-gray-700' : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                    onClick={() => setReceiptDelivery(prev => ({ ...prev, sendSMS: !prev.sendSMS }))}>
                      <div className="text-center">
                        <div className="text-2xl mb-2">📱</div>
                        <h5 className={`font-semibold mb-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>SMS Receipt</h5>
                        <p className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                          Instant delivery via text message
                        </p>
                        <div className="mt-2">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            receiptDelivery.sendSMS 
                              ? 'bg-green-500 text-white' 
                              : darkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-600'
                          }`}>
                            {receiptDelivery.sendSMS ? '✓ Selected' : 'Tap to Enable'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Email Receipt */}
                    <div className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      receiptDelivery.sendEmail 
                        ? 'border-blue-500 bg-blue-100' 
                        : darkMode ? 'border-gray-600 bg-gray-800 hover:bg-gray-700' : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                    onClick={() => setReceiptDelivery(prev => ({ ...prev, sendEmail: !prev.sendEmail }))}>
                      <div className="text-center">
                        <div className="text-2xl mb-2">📧</div>
                        <h5 className={`font-semibold mb-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Email Receipt</h5>
                        <p className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                          Detailed receipt via email
                        </p>
                        <div className="mt-2">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            receiptDelivery.sendEmail 
                              ? 'bg-blue-500 text-white' 
                              : darkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-600'
                          }`}>
                            {receiptDelivery.sendEmail ? '✓ Selected' : 'Tap to Enable'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* WhatsApp Receipt */}
                    <div className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      receiptDelivery.sendWhatsApp 
                        ? 'border-emerald-500 bg-emerald-100' 
                        : darkMode ? 'border-gray-600 bg-gray-800 hover:bg-gray-700' : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                    onClick={() => setReceiptDelivery(prev => ({ ...prev, sendWhatsApp: !prev.sendWhatsApp }))}>
                      <div className="text-center">
                        <div className="text-2xl mb-2">💬</div>
                        <h5 className={`font-semibold mb-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>WhatsApp</h5>
                        <p className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                          Receipt via WhatsApp Business
                        </p>
                        <div className="mt-2">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            receiptDelivery.sendWhatsApp 
                              ? 'bg-emerald-500 text-white' 
                              : darkMode ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-600'
                          }`}>
                            {receiptDelivery.sendWhatsApp ? '✓ Selected' : 'Tap to Enable'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Phone Number */}
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-700'}`}>
                        📱 Mobile Number for Receipt
                      </label>
                      <div className="relative">
                        <FiPhone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type="tel"
                          value={receiptDelivery.phone}
                          onChange={(e) => setReceiptDelivery(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="256 7XX XXX XXX"
                          className={`w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                            darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white'
                          }`}
                        />
                      </div>
                      <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        For SMS and WhatsApp receipts
                      </p>
                    </div>

                    {/* Email Address */}
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-700'}`}>
                        📧 Email Address for Receipt
                      </label>
                      <div className="relative">
                        <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type="email"
                          value={receiptDelivery.email}
                          onChange={(e) => setReceiptDelivery(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="your@email.com"
                          className={`w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                            darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white'
                          }`}
                        />
                      </div>
                      <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        For detailed email receipt
                      </p>
                    </div>
                  </div>

                  {/* Receipt Features */}
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                      <div className="text-2xl mb-1">⚡</div>
                      <div className={`text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        Instant Delivery
                      </div>
                    </div>
                    <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                      <div className="text-2xl mb-1">🌱</div>
                      <div className={`text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        Eco-Friendly
                      </div>
                    </div>
                    <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                      <div className="text-2xl mb-1">🔒</div>
                      <div className={`text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        Secure & Private
                      </div>
                    </div>
                    <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                      <div className="text-2xl mb-1">💾</div>
                      <div className={`text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        Easy to Store
                      </div>
                    </div>
                  </div>

                  {/* Receipt Preview */}
                  {(receiptDelivery.sendSMS || receiptDelivery.sendEmail || receiptDelivery.sendWhatsApp) && (
                    <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-1">
                            📋 Receipt will be sent to:
                          </h5>
                          <div className="space-y-1 text-sm text-gray-700">
                            {receiptDelivery.sendSMS && receiptDelivery.phone && (
                              <div className="flex items-center">
                                <span className="text-green-600 mr-2">📱</span>
                                SMS: {receiptDelivery.phone}
                              </div>
                            )}
                            {receiptDelivery.sendEmail && receiptDelivery.email && (
                              <div className="flex items-center">
                                <span className="text-blue-600 mr-2">📧</span>
                                Email: {receiptDelivery.email}
                              </div>
                            )}
                            {receiptDelivery.sendWhatsApp && receiptDelivery.phone && (
                              <div className="flex items-center">
                                <span className="text-emerald-600 mr-2">💬</span>
                                WhatsApp: {receiptDelivery.phone}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-4xl">✅</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-4">
                  <button
                    onClick={() => setPaymentState('selecting')}
                    className={`flex-1 py-3 px-6 border border-gray-300 rounded-lg font-medium transition-colors ${
                      darkMode 
                        ? 'text-gray-300 border-gray-600 hover:bg-gray-700' 
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Back
                  </button>
                  <button
                    onClick={handlePayment}
                    disabled={processing || 
                      (selectedMethod === 'mobile_money' && !mobileNumber) ||
                      (selectedMethod === 'airtel_money' && !mobileNumber) ||
                      (selectedMethod === 'card' && (!cardDetails.number || !cardDetails.expiry || !cardDetails.cvv))
                    }
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {processing ? (
                      <>
                        <FiRefreshCw className="animate-spin mr-2 h-5 w-5" />
                        Processing...
                      </>
                    ) : (
                      `Pay UGX ${finalTotal.toLocaleString()}`
                    )}
                  </button>
                </div>
              </div>
            )}

            {paymentState === 'success' && (
              <div className="text-center space-y-6">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <FiCheckCircle className="h-12 w-12 text-green-600" />
                </div>
                <div>
                  <h3 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    Payment Successful!
                  </h3>
                  <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    Your payment has been processed successfully.
                  </p>
                </div>
              </div>
            )}

            {paymentState === 'failed' && (
              <div className="text-center space-y-6">
                <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                  <FiAlertCircle className="h-12 w-12 text-red-600" />
                </div>
                <div>
                  <h3 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    Payment Failed
                  </h3>
                  <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    There was an issue processing your payment. Please try again.
                  </p>
                </div>
                <button
                  onClick={() => setPaymentState('selecting')}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Progress Bar */}
            {processing && (
              <div className="mt-6">
                <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                  <span>Processing Payment...</span>
                  <span>{Math.round(paymentProgress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${paymentProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className={`px-6 py-4 border-t ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <div className={`flex items-center space-x-2 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                <FiShield className="h-4 w-4" />
                <span>PCI DSS Compliant • 256-bit SSL Encryption</span>
              </div>
              <div className={`flex items-center space-x-4 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                <span>Powered by FAREDEAL Payments</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentMethods;
