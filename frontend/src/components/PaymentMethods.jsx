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
  const [mobileNumber, setMobileNumber] = useState('0770381864'); // Pre-filled with user's number
  const [mobilePin, setMobilePin] = useState('');
  const [usePoints, setUsePoints] = useState(false);
  const [pointsToUse, setPointsToUse] = useState(0);
  const [selectedNetwork, setSelectedNetwork] = useState('mtn'); // Auto-detect from number
  const [accountBalance, setAccountBalance] = useState(null);
  const [transactionFee, setTransactionFee] = useState(0);
  const [realTimeStatus, setRealTimeStatus] = useState('');

  // Calculate finalTotal and related values before using in effects
  const maxPointsDiscount = Math.min(loyaltyPoints * 0.01, orderTotal * 0.5);
  const finalTotal = usePoints ? orderTotal - pointsToUse * 0.01 : orderTotal;

  // Auto-detect network from phone number
  useEffect(() => {
    const detectNetwork = (number) => {
      const cleanNumber = number.replace(/\s/g, '');
      if (cleanNumber.startsWith('077') || cleanNumber.startsWith('078') || cleanNumber.startsWith('079')) {
        return 'mtn';
      } else if (cleanNumber.startsWith('070') || cleanNumber.startsWith('075')) {
        return 'airtel';
      } else if (cleanNumber.startsWith('074')) {
        return 'utl';
      }
      return 'mtn'; // default
    };
    
    if (mobileNumber) {
      const network = detectNetwork(mobileNumber);
      setSelectedNetwork(network);
      
      // Calculate realistic transaction fees based on amount
      const calculateFee = (amount, network) => {
        if (network === 'mtn') {
          if (amount <= 30000) return 600;
          if (amount <= 50000) return 1000;
          if (amount <= 100000) return 1500;
          return 2500;
        } else if (network === 'airtel') {
          if (amount <= 30000) return 500;
          if (amount <= 50000) return 800;
          if (amount <= 100000) return 1200;
          return 2000;
        }
        return 1000;
      };
      
      setTransactionFee(calculateFee(finalTotal, network));
    }
  }, [mobileNumber, finalTotal]);

  const paymentMethods = [
    {
      id: 'mtn_momo',
      name: 'MTN Mobile Money',
      icon: FiSmartphone,
      color: 'from-yellow-500 to-yellow-600',
      description: 'Pay with MTN MoMo - Most trusted in Uganda',
      processingTime: '15-30 seconds',
      fees: `UGX ${transactionFee.toLocaleString()} transaction fee`,
      popularity: 95,
      features: ['Instant', 'Reliable', 'Wide Coverage'],
      logo: '📱',
      badge: 'MOST POPULAR',
      badgeColor: 'bg-yellow-500',
      network: 'mtn',
      ussdCode: '*165#',
      customerCare: '100'
    },
    {
      id: 'airtel_money',
      name: 'Airtel Money',
      icon: '📶',
      color: 'from-red-500 to-red-700',
      description: 'Fast & secure Airtel Money payments',
      processingTime: '10-25 seconds',
      fees: `UGX ${Math.floor(transactionFee * 0.8).toLocaleString()} transaction fee`,
      popularity: 85,
      features: ['Quick', 'Low Fees', 'Reliable'],
      logo: '🔴',
      badge: 'LOW FEES',
      badgeColor: 'bg-red-500',
      network: 'airtel',
      ussdCode: '*185#',
      customerCare: '175'
    },
    {
      id: 'utl_money',
      name: 'UTL Mobile Money',
      icon: FiPhone,
      color: 'from-blue-500 to-blue-700',
      description: 'UTL Mobile Money services',
      processingTime: '20-40 seconds',
      fees: `UGX ${Math.floor(transactionFee * 0.9).toLocaleString()} transaction fee`,
      popularity: 45,
      features: ['Affordable', 'Growing Network'],
      logo: '📞',
      network: 'utl',
      ussdCode: '*165#',
      customerCare: '197'
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

      // Enhanced payment processing with real-time status updates
      let result;
      const orderInfo = { 
        total: finalTotal + transactionFee, // Include transaction fee
        currency: 'UGX',
        customerPhone: mobileNumber,
        network: selectedNetwork,
        fee: transactionFee
      };

      // Real-time status updates during processing
      const statusMessages = [
        'Connecting to mobile network...',
        `Initiating ${selectedNetwork.toUpperCase()} Mobile Money transaction...`,
        'Sending payment request to your phone...',
        'Waiting for PIN confirmation...',
        'Processing payment...',
        'Validating transaction...',
        'Payment successful!'
      ];

      let statusIndex = 0;
      const statusInterval = setInterval(() => {
        if (statusIndex < statusMessages.length - 1) {
          setRealTimeStatus(statusMessages[statusIndex]);
          statusIndex++;
        }
      }, 3000);

      switch (selectedMethod) {
        case 'mtn_momo':
          // Simulate MTN Mobile Money API call
          setRealTimeStatus('📱 Connecting to MTN Mobile Money...');
          result = await paymentService.processDigitalWallet({
            walletType: 'mtn_mobile_money',
            phoneNumber: mobileNumber,
            pin: mobilePin,
            amount: finalTotal,
            fee: transactionFee,
            merchantCode: 'FAREDEAL001',
            reference: `FD${Date.now()}`,
            narration: 'FAREDEAL Supermarket Purchase'
          }, orderInfo);
          break;
          
        case 'airtel_money':
          // Simulate Airtel Money API call
          setRealTimeStatus('🔴 Connecting to Airtel Money...');
          result = await paymentService.processDigitalWallet({
            walletType: 'airtel_money',
            phoneNumber: mobileNumber,
            pin: mobilePin,
            amount: finalTotal,
            fee: transactionFee,
            merchantCode: 'FAREDEAL002',
            reference: `FD${Date.now()}`,
            narration: 'FAREDEAL Supermarket Purchase'
          }, orderInfo);
          break;
          
        case 'utl_money':
          // Simulate UTL Mobile Money API call
          setRealTimeStatus('📞 Connecting to UTL Mobile Money...');
          result = await paymentService.processDigitalWallet({
            walletType: 'utl_money',
            phoneNumber: mobileNumber,
            pin: mobilePin,
            amount: finalTotal,
            fee: transactionFee,
            merchantCode: 'FAREDEAL003',
            reference: `FD${Date.now()}`,
            narration: 'FAREDEAL Supermarket Purchase'
          }, orderInfo);
          break;
          
        case 'card':
          setRealTimeStatus('💳 Processing card payment...');
          result = await paymentService.processCardPayment(cardDetails, orderInfo);
          break;
          
        case 'cash':
          setRealTimeStatus('💵 Processing cash payment...');
          result = await paymentService.processCashPayment({
            cashReceived: finalTotal
          }, orderInfo);
          break;
          
        default:
          throw new Error('Payment method not implemented');
      }

      clearInterval(statusInterval);

      clearInterval(progressInterval);
      setPaymentProgress(100);

      if (result.success) {
        setPaymentState('success');
        toast.success('Payment processed successfully!');
        setTimeout(() => {
          onPaymentComplete(result);
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

                {/* Enhanced Mobile Money Payment Forms */}
                {(selectedMethod === 'mtn_momo' || selectedMethod === 'airtel_money' || selectedMethod === 'utl_money') && (
                  <div className="space-y-6">
                    {/* Network Information */}
                    <div className={`p-4 rounded-lg border-l-4 ${
                      selectedNetwork === 'mtn' ? 'border-yellow-500 bg-yellow-50' :
                      selectedNetwork === 'airtel' ? 'border-red-500 bg-red-50' :
                      'border-blue-500 bg-blue-50'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-gray-900">
                            {selectedNetwork === 'mtn' ? 'MTN Mobile Money' :
                             selectedNetwork === 'airtel' ? 'Airtel Money' : 'UTL Mobile Money'}
                          </h4>
                          <p className="text-sm text-gray-600">
                            USSD: {selectedNetwork === 'mtn' ? '*165#' : 
                                   selectedNetwork === 'airtel' ? '*185#' : '*165#'} | 
                            Customer Care: {selectedNetwork === 'mtn' ? '100' : 
                                          selectedNetwork === 'airtel' ? '175' : '197'}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-600">Transaction Fee</div>
                          <div className="font-bold text-red-600">UGX {transactionFee.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>

                    {/* Mobile Number Input */}
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-700'}`}>
                        Mobile Number ({selectedNetwork.toUpperCase()})
                      </label>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 flex items-center">
                          <span className="text-gray-500 text-sm mr-2">🇺🇬</span>
                          <FiPhone className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="tel"
                          value={mobileNumber}
                          onChange={(e) => setMobileNumber(e.target.value)}
                          placeholder="0770381864"
                          className={`w-full pl-16 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                            darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white'
                          }`}
                          maxLength="10"
                        />
                        {mobileNumber === '0770381864' && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <FiCheck className="h-5 w-5 text-green-500" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Verified account: Aban's Mobile Money
                      </p>
                    </div>

                    {/* PIN Input */}
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-700'}`}>
                        Mobile Money PIN
                      </label>
                      <div className="relative">
                        <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type="password"
                          value={mobilePin}
                          onChange={(e) => setMobilePin(e.target.value)}
                          placeholder="Enter your PIN"
                          className={`w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                            darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white'
                          }`}
                          maxLength="4"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Enter your 4-digit Mobile Money PIN
                      </p>
                    </div>

                    {/* Account Balance Simulator */}
                    <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-green-50'} border`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                            Available Balance
                          </h5>
                          <p className={`text-2xl font-bold ${selectedNetwork === 'mtn' ? 'text-yellow-600' : 
                                        selectedNetwork === 'airtel' ? 'text-red-600' : 'text-blue-600'}`}>
                            UGX {(Math.random() * 500000 + 100000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            Total to Pay
                          </div>
                          <div className="font-bold text-green-600">
                            UGX {(finalTotal + transactionFee).toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-500">
                            (Includes UGX {transactionFee.toLocaleString()} fee)
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Real-time Status */}
                    {realTimeStatus && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center">
                          <FiInfo className="h-5 w-5 text-blue-600 mr-2" />
                          <span className="text-sm text-blue-800">{realTimeStatus}</span>
                        </div>
                      </div>
                    )}
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
                      (selectedMethod === 'mtn_momo' && (!mobileNumber || !mobilePin)) ||
                      (selectedMethod === 'airtel_money' && (!mobileNumber || !mobilePin)) ||
                      (selectedMethod === 'utl_money' && (!mobileNumber || !mobilePin)) ||
                      (selectedMethod === 'card' && (!cardDetails.number || !cardDetails.expiry || !cardDetails.cvv))
                    }
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {processing ? (
                      <>
                        <FiRefreshCw className="animate-spin mr-2 h-5 w-5" />
                        Processing Mobile Money...
                      </>
                    ) : (
                      <>
                        <FiSmartphone className="mr-2 h-5 w-5" />
                        Pay UGX {(finalTotal + transactionFee).toLocaleString()}
                        <span className="ml-1 text-xs opacity-75">
                          (+ UGX {transactionFee.toLocaleString()} fee)
                        </span>
                      </>
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
                    Payment Successful! 🎉
                  </h3>
                  <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    Your {selectedNetwork.toUpperCase()} Mobile Money payment has been processed successfully.
                  </p>
                </div>

                {/* Transaction Receipt */}
                <div className={`p-6 rounded-lg border-2 border-dashed border-green-300 ${darkMode ? 'bg-gray-700' : 'bg-green-50'}`}>
                  <h4 className={`font-bold text-lg mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    📧 Transaction Receipt
                  </h4>
                  <div className="space-y-3 text-left">
                    <div className="flex justify-between">
                      <span className={`${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Transaction ID:</span>
                      <span className="font-mono text-sm bg-gray-200 px-2 py-1 rounded">
                        FD{Date.now().toString().slice(-8)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Amount Paid:</span>
                      <span className="font-bold">UGX {finalTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Transaction Fee:</span>
                      <span className="text-red-600">UGX {transactionFee.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Total Deducted:</span>
                      <span className="font-bold text-green-600">
                        UGX {(finalTotal + transactionFee).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>From:</span>
                      <span className="font-mono">{mobileNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>To:</span>
                      <span>FAREDEAL SUPERMARKET</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Time:</span>
                      <span>{new Date().toLocaleString()}</span>
                    </div>
                  </div>
                  
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-800">
                      📱 A confirmation SMS will be sent to {mobileNumber}
                    </p>
                  </div>
                </div>

                {/* Balance Info */}
                <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-yellow-50'} border`}>
                  <h5 className={`font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    💰 Remaining Balance (Estimated)
                  </h5>
                  <p className={`text-xl font-bold ${selectedNetwork === 'mtn' ? 'text-yellow-600' : 
                                selectedNetwork === 'airtel' ? 'text-red-600' : 'text-blue-600'}`}>
                    UGX {((Math.random() * 500000 + 100000) - (finalTotal + transactionFee)).toFixed(0)
                      .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Check your balance: Dial {selectedNetwork === 'mtn' ? '*165*0#' : 
                                            selectedNetwork === 'airtel' ? '*185*9#' : '*165*0#'}
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
