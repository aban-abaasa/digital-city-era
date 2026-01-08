import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import '../styles/animations.css';
import { 
  FiCreditCard, FiSmartphone, FiDollarSign, FiCheck, FiX, FiCamera,
  FiShield, FiUser, FiMail, FiMessageSquare, FiPrinter, FiDownload,
  FiClock, FiMapPin, FiStar, FiHeart, FiGift, FiZap, FiLock,
  FiRefreshCw, FiAlertCircle, FiCheckCircle, FiArrowRight, FiArrowLeft,
  FiWifi, FiActivity, FiTrendingUp, FiAward, FiSettings,
  FiEye, FiPercent
} from 'react-icons/fi';
import DualScannerInterface from '../components/DualScannerInterface';
import BiometricAuth from '../components/BiometricAuth';
import PaymentMethods from '../components/PaymentMethods';
import PaymentSecurity from '../components/PaymentSecurity';
import PaymentAnalytics from '../components/PaymentAnalytics';
import DigitalReceipt from '../components/DigitalReceipt';
import orderService from '../services/orderService';
import customerService from '../services/customerService';
import paymentService from '../services/paymentService';

const CustomerPayment = () => {
  // Order data from cashier
  const [orderData, setOrderData] = useState(null);
  const [orderTotal, setOrderTotal] = useState(0);
  const [orderItems, setOrderItems] = useState([]);
  
  // Payment flow states
  const [currentStep, setCurrentStep] = useState('waiting'); // waiting, scanning, authenticating, paying, processing, complete
  const [customerInfo, setCustomerInfo] = useState(null);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  
  // UI states
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showBiometric, setShowBiometric] = useState(false);
  const [showPaymentMethods, setShowPaymentMethods] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  
  // Payment data
  const [paymentResult, setPaymentResult] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  
  // Load order data - can be from URL params or passed state
  useEffect(() => {
    const loadOrderData = async () => {
      try {
        // Check if order ID is passed in URL params
        const urlParams = new URLSearchParams(window.location.search);
        const orderId = urlParams.get('orderId');
        
        if (orderId) {
          // Load real order from API
          const response = await orderService.getOrder(orderId);
          if (response.success) {
            const order = response.order;
            setOrderData({
              orderId: order._id,
              orderNumber: order.orderNumber,
              cashierId: 'CASH001', // From cashier system
              cashierName: 'Store Cashier',
              timestamp: order.createdAt,
              items: order.items.map(item => ({
                id: item.product,
                name: item.name,
                price: item.unitPrice,
                quantity: item.quantity,
                sku: item.sku,
                image: item.image || '📱'
              })),
              subtotal: order.subtotal,
              tax: order.tax,
              discount: order.discount || 0,
              total: order.total,
              qrCode: `PAY-${order.orderNumber}-${Math.random().toString(36).substr(2, 9)}`
            });
            setOrderTotal(order.total);
            setOrderItems(order.items);
          }
        } else {
          // Fallback to mock data for demo
          const mockOrder = {
            orderId: `ORD-${Date.now()}`,
            orderNumber: `ORD-${Date.now().toString().slice(-6)}`,
            cashierId: 'CASH001',
            cashierName: 'Sarah Johnson',
            timestamp: new Date().toISOString(),
            items: [
              {
                id: 'prod_001',
                name: 'iPhone 15 128GB Black',
                price: 799.99,
                quantity: 1,
                sku: 'APL-IP15-128-BLK',
                image: '📱'
              },
              {
                id: 'prod_002',
                name: 'Wireless Charging Pad',
                price: 49.99,
                quantity: 1,
                sku: 'ACC-WCP-001',
                image: '🔌'
              },
              {
                id: 'prod_003',
                name: 'Phone Case Premium',
                price: 29.99,
                quantity: 2,
                sku: 'ACC-PC-PREM',
                image: '📱'
              }
            ],
            subtotal: 909.96,
            tax: 81.90,
            discount: 0,
            total: 991.86,
            qrCode: `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          };
          
          setOrderData(mockOrder);
          setOrderTotal(mockOrder.total);
          setOrderItems(mockOrder.items);
        }
      } catch (error) {
        console.error('Error loading order:', error);
        toast.error('Failed to load order details');
      }
    };
    
    loadOrderData();
  }, []);

  // Generate QR code for payment
  const generatePaymentQR = () => {
    if (!orderData) return '';
    
    const paymentData = {
      orderId: orderData.orderId,
      total: orderData.total,
      timestamp: orderData.timestamp,
      cashierId: orderData.cashierId,
      qrCode: orderData.qrCode
    };
    
    return btoa(JSON.stringify(paymentData));
  };

  // Handle QR code scan
  const handleQRScanned = (qrData) => {
    try {
      const scannedData = JSON.parse(atob(qrData));
      
      if (scannedData.orderId === orderData.orderId) {
        toast.success('✅ Order verified successfully!');
        setCurrentStep('authenticating');
        setShowQRScanner(false);
        
        // Auto-proceed to biometric after 1 second
        setTimeout(() => {
          setShowBiometric(true);
        }, 1000);
      } else {
        toast.error('❌ Invalid QR code. Please scan the correct order code.');
      }
    } catch {
      toast.error('❌ Failed to read QR code. Please try again.');
    }
  };

  // Handle biometric authentication
  const handleBiometricAuth = async (authResult) => {
    try {
      if (authResult.success && authResult.phone) {
        // Look up customer by phone number
        const customerResponse = await customerService.getByPhone(authResult.phone);
        
        if (customerResponse.success) {
          const customer = customerResponse.customer;
          setCustomerInfo({
            id: customer._id,
            name: `${customer.firstName} ${customer.lastName}`,
            phone: customer.phone,
            email: customer.email,
            membershipLevel: customer.membershipLevel
          });
          setLoyaltyPoints(customer.loyaltyPoints || 0);
          toast.success(`👋 Welcome back, ${customer.firstName}!`);
          setCurrentStep('paying');
          setShowBiometric(false);
          setShowPaymentMethods(true);
        } else {
          throw new Error('Customer not found');
        }
      } else {
        throw new Error('Authentication failed');
      }
    } catch (error) {
      console.error('Biometric auth error:', error);
      toast.error('🔒 Authentication failed. Please try again.');
    }
  };

  // Handle payment completion
  const handlePaymentComplete = async (paymentData) => {
    setCurrentStep('processing');
    setShowPaymentMethods(false);
    setProcessingProgress(0);
    
    try {
      // Enhanced payment processing with real-time validation
      const progressSteps = [15, 35, 55, 75, 90, 100];
      const progressMessages = [
        'Validating payment details...',
        'Contacting payment processor...',
        'Verifying transaction...',
        'Processing payment...',
        'Updating inventory...',
        'Payment completed!'
      ];
      
      for (let i = 0; i < progressSteps.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 800));
        setProcessingProgress(progressSteps[i]);
        
        // Show progress message
        if (progressMessages[i]) {
          console.log(progressMessages[i]);
        }
      }
      
      // Enhanced payment result based on method
      let paymentResult;
      const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
      
      switch (paymentData.method) {
        case 'card':
          // Simulate card processing with realistic responses
          if (paymentData.cardLastFour === '0000') {
            throw new Error('Card declined - Insufficient funds');
          }
          if (paymentData.cardLastFour === '1111') {
            throw new Error('Card declined - Invalid card number');
          }
          
          paymentResult = {
            transactionId,
            authCode: Math.random().toString(36).substr(2, 8).toUpperCase(),
            status: 'success',
            amount: paymentData.amount,
            paymentMethod: 'Credit Card',
            cardBrand: paymentData.cardBrand || 'visa',
            cardLastFour: paymentData.cardLastFour || '****',
            processedAt: new Date(),
            processingTime: '2.3 seconds',
            merchantId: 'FAREDEAL_001',
            acquirer: 'First Data',
            responseCode: '00',
            responseMessage: 'Approved'
          };
          break;
          
        case 'digital_wallet':
          // Simulate digital wallet processing
          paymentResult = {
            transactionId,
            authCode: Math.random().toString(36).substr(2, 8).toUpperCase(),
            status: 'success',
            amount: paymentData.amount,
            paymentMethod: `${paymentData.walletType?.replace('_', ' ').toUpperCase() || 'Digital Wallet'}`,
            walletType: paymentData.walletType,
            deviceId: `DEV-${Math.random().toString(36).substr(2, 8)}`,
            processedAt: new Date(),
            processingTime: '1.1 seconds',
            biometricAuth: true,
            tokenized: true
          };
          break;
          
        case 'crypto':
          // Simulate cryptocurrency processing
          paymentResult = {
            transactionId,
            blockchainHash: `0x${Math.random().toString(16).substr(2, 64)}`,
            status: 'success',
            amount: paymentData.amount,
            paymentMethod: `${paymentData.cryptoCurrency?.toUpperCase() || 'Cryptocurrency'}`,
            cryptoAmount: paymentData.cryptoAmount,
            exchangeRate: paymentData.exchangeRate,
            networkFee: paymentData.amount * 0.001, // 0.1% network fee
            confirmations: 1,
            expectedConfirmations: 6,
            processedAt: new Date(),
            processingTime: '8.7 seconds',
            network: paymentData.network || 'mainnet'
          };
          break;
          
        case 'bnpl':
          // Simulate Buy Now Pay Later processing
          paymentResult = {
            transactionId,
            authCode: Math.random().toString(36).substr(2, 8).toUpperCase(),
            status: 'success',
            amount: paymentData.firstPayment || paymentData.amount / 4,
            totalAmount: paymentData.amount,
            paymentMethod: `${paymentData.provider?.toUpperCase() || 'BNPL'}`,
            installmentPlan: paymentData.installmentPlan,
            nextPaymentDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            processedAt: new Date(),
            processingTime: '3.2 seconds',
            interestRate: 0,
            creditCheck: 'soft'
          };
          break;
          
        case 'bank_transfer':
          // Simulate bank transfer processing
          paymentResult = {
            transactionId,
            achTraceNumber: Math.random().toString().substr(2, 15),
            status: 'pending',
            amount: paymentData.amount,
            paymentMethod: 'Bank Transfer (ACH)',
            bankName: 'Customer Bank',
            accountLast4: paymentData.accountLast4 || '****',
            processingTime: '1-3 business days',
            processedAt: new Date(),
            settlementDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            feeAmount: 0
          };
          break;
          
        case 'gift_card':
          // Simulate gift card processing
          const remainingBalance = Math.max(0, 100 - paymentData.amount); // Assume $100 balance
          paymentResult = {
            transactionId,
            authCode: Math.random().toString(36).substr(2, 8).toUpperCase(),
            status: 'success',
            amount: paymentData.amount,
            paymentMethod: 'Gift Card',
            cardLastFour: paymentData.cardNumber?.slice(-4) || '****',
            remainingBalance,
            processedAt: new Date(),
            processingTime: '0.8 seconds',
            needsAdditionalPayment: remainingBalance < 0
          };
          break;
          
        case 'cash':
          // Simulate cash payment
          paymentResult = {
            transactionId,
            status: 'success',
            amount: paymentData.amount,
            paymentMethod: 'Cash',
            cashReceived: paymentData.cashGiven || paymentData.amount,
            changeGiven: Math.max(0, (paymentData.cashGiven || paymentData.amount) - paymentData.amount),
            processedAt: new Date(),
            processingTime: 'Immediate',
            cashierId: orderData?.cashierId || 'CASH001'
          };
          break;
          
        case 'nfc':
          // Simulate NFC/contactless processing
          paymentResult = {
            transactionId,
            authCode: Math.random().toString(36).substr(2, 8).toUpperCase(),
            status: 'success',
            amount: paymentData.amount,
            paymentMethod: 'Contactless Payment',
            cardLastFour: '****',
            contactless: true,
            processedAt: new Date(),
            processingTime: '0.5 seconds',
            tapVerified: true
          };
          break;
          
        default:
          // Default processing for any other payment method
          paymentResult = {
            transactionId,
            authCode: Math.random().toString(36).substr(2, 8).toUpperCase(),
            status: 'success',
            amount: paymentData.amount,
            paymentMethod: paymentData.method || 'Unknown',
            processedAt: new Date(),
            processingTime: '2.0 seconds'
          };
      }
      
      // Add fraud score and risk assessment
      paymentResult.fraudScore = Math.floor(Math.random() * 30); // Low risk score
      paymentResult.riskLevel = paymentResult.fraudScore < 20 ? 'low' : 'medium';
      
      // Add loyalty points calculation
      const loyaltyPointsEarned = Math.floor(paymentData.amount / 10); // 1 point per $10
      paymentResult.loyaltyPointsEarned = loyaltyPointsEarned;
      
      setPaymentResult(paymentResult);
      
      // Generate enhanced receipt with real-world details
      const receipt = {
        ...orderData,
        payment: paymentResult,
        customer: customerInfo,
        loyaltyPointsEarned,
        loyaltyPointsUsed: paymentData.pointsUsed || 0,
        finalTotal: paymentData.amount,
        taxes: {
          salesTax: orderData.tax || 0,
          taxRate: '8.25%',
          taxableAmount: orderData.subtotal || 0
        },
        store: {
          name: 'FAREDEAL Supermarket',
          address: '123 Main Street, City, State 12345',
          phone: '(555) 123-4567',
          email: 'support@faredeal.com',
          website: 'www.faredeal.com'
        },
        receiptNumber: `RCP-${Date.now()}`,
        printTime: new Date(),
        refundPolicy: 'Items may be returned within 30 days with receipt',
        thankYouMessage: 'Thank you for shopping with FAREDEAL!'
      };
      
      setReceiptData(receipt);
      setCurrentStep('complete');
      
      // Enhanced success feedback
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance('Payment successful! Thank you for shopping with FAREDEAL!');
        utterance.rate = 0.8;
        utterance.pitch = 1.2;
        speechSynthesis.speak(utterance);
      }
      
      // Success vibration pattern
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 300]);
      }
      
      // Show success toast with payment details
      toast.success(
        `🎉 Payment of ${formatCurrency(paymentData.amount)} processed successfully! Transaction ID: ${transactionId.slice(-8)}`,
        { duration: 5000 }
      );
      
      // Auto-show receipt after celebration
      setTimeout(() => {
        setShowReceipt(true);
      }, 2500);
      
      // Send payment confirmation email (simulated)
      if (customerInfo?.email) {
        setTimeout(() => {
          toast.info(`📧 Payment confirmation sent to ${customerInfo.email}`, { duration: 4000 });
        }, 3000);
      }
      
      // Update loyalty points (simulated)
      if (loyaltyPointsEarned > 0) {
        setTimeout(() => {
          toast.success(`⭐ You earned ${loyaltyPointsEarned} loyalty points!`, { duration: 4000 });
        }, 4000);
      }
      
    } catch (error) {
      console.error('Payment error:', error);
      
      // Enhanced error handling with specific error types
      let errorMessage = error.message;
      let errorType = 'generic';
      
      if (error.message.includes('declined')) {
        errorType = 'declined';
        errorMessage = `💳 ${error.message}. Please try a different payment method.`;
      } else if (error.message.includes('network')) {
        errorType = 'network';
        errorMessage = '🌐 Network error. Please check your connection and try again.';
      } else if (error.message.includes('timeout')) {
        errorType = 'timeout';
        errorMessage = '⏱️ Payment timed out. Please try again.';
      } else if (error.message.includes('insufficient')) {
        errorType = 'insufficient';
        errorMessage = '💰 Insufficient funds. Please use a different payment method.';
      } else {
        errorMessage = `❌ ${errorMessage}. Please try again or contact support.`;
      }
      
      // Error vibration pattern
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100, 50, 100]);
      }
      
      toast.error(errorMessage, { duration: 6000 });
      
      // Return to payment method selection
      setCurrentStep('paying');
      setTimeout(() => {
        setShowPaymentMethods(true);
      }, 1000);
    }
  };

  // Reset payment flow
  const resetPaymentFlow = () => {
    setCurrentStep('waiting');
    setCustomerInfo(null);
    setLoyaltyPoints(0);
    setShowQRScanner(false);
    setShowBiometric(false);
    setShowPaymentMethods(false);
    setShowReceipt(false);
    setPaymentResult(null);
    setReceiptData(null);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStepIcon = (step) => {
    switch (step) {
      case 'waiting': return FiClock;
      case 'scanning': return FiCamera;
      case 'authenticating': return FiUser;
      case 'paying': return FiCreditCard;
      case 'processing': return FiRefreshCw;
      case 'complete': return FiCheckCircle;
      default: return FiClock;
    }
  };

  const getStepColor = (step) => {
    switch (step) {
      case 'waiting': return 'text-gray-500';
      case 'scanning': return 'text-blue-500';
      case 'authenticating': return 'text-purple-500';
      case 'paying': return 'text-green-500';
      case 'processing': return 'text-orange-500';
      case 'complete': return 'text-emerald-500';
      default: return 'text-gray-500';
    }
  };

  if (!orderData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Waiting for cashier to complete order...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-10 w-32 h-32 bg-blue-500 rounded-full animate-float"></div>
        <div className="absolute top-40 right-20 w-20 h-20 bg-purple-500 rounded-full animate-float" style={{animationDelay: '1s'}}></div>
        <div className="absolute bottom-20 left-1/4 w-24 h-24 bg-pink-500 rounded-full animate-float" style={{animationDelay: '2s'}}></div>
      </div>

      {/* Header */}
      <div className="bg-white/90 backdrop-blur-sm shadow-lg border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mr-6 shadow-lg">
                <span className="text-3xl animate-bounce">🛍️</span>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  FAREDEAL Payment
                </h1>
                <div className="flex items-center space-x-4 mt-2">
                  <div className="flex items-center text-green-600">
                    <FiShield className="h-4 w-4 mr-1" />
                    <span className="text-sm font-medium">Secure</span>
                  </div>
                  <div className="flex items-center text-blue-600">
                    <FiZap className="h-4 w-4 mr-1" />
                    <span className="text-sm font-medium">Fast</span>
                  </div>
                  <div className="flex items-center text-purple-600">
                    <FiWifi className="h-4 w-4 mr-1" />
                    <span className="text-sm font-medium">Contactless</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-right bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-2xl">
              <p className="text-sm text-gray-600 mb-1">Order #{orderData.orderId.slice(-6)}</p>
              <p className="text-2xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                {formatCurrency(orderTotal)}
              </p>
              <div className="flex items-center justify-end mt-1">
                <FiActivity className="h-3 w-3 text-green-500 mr-1" />
                <span className="text-xs text-green-600 font-medium">Live Session</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 mb-8 border border-gray-200">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Payment Progress</h2>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500 ease-out"
                style={{ 
                  width: `${((['waiting', 'scanning', 'authenticating', 'paying', 'processing', 'complete'].indexOf(currentStep) + 1) / 6) * 100}%` 
                }}
              ></div>
            </div>
          </div>
          
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            {['waiting', 'scanning', 'authenticating', 'paying', 'processing', 'complete'].map((step, index) => {
              const StepIcon = getStepIcon(step);
              const isActive = step === currentStep;
              const isCompleted = ['waiting', 'scanning', 'authenticating', 'paying', 'processing', 'complete'].indexOf(currentStep) > index;
              
              return (
                <div key={step} className="flex flex-col items-center relative">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500 transform ${
                    isActive 
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg scale-110 animate-pulse' 
                      : isCompleted 
                        ? 'bg-green-500 text-white shadow-md scale-105' 
                        : 'bg-gray-200 text-gray-400'
                  }`}>
                    {isCompleted && step !== currentStep ? (
                      <FiCheck className="h-8 w-8" />
                    ) : (
                      <StepIcon className={`h-8 w-8 ${isActive ? 'animate-bounce' : ''}`} />
                    )}
                    
                    {/* Ripple effect for active step */}
                    {isActive && (
                      <div className="absolute inset-0 rounded-2xl bg-blue-500 opacity-25 animate-ping"></div>
                    )}
                  </div>
                  
                  <div className="mt-3 text-center">
                    <p className={`text-sm font-bold transition-colors ${
                      isActive ? getStepColor(step) : isCompleted ? 'text-green-600' : 'text-gray-400'
                    }`}>
                    {step.charAt(0).toUpperCase() + step.slice(1)}
                  </p>
                    
                    {/* Status indicator */}
                    <div className={`mt-1 w-2 h-2 rounded-full mx-auto transition-all ${
                      isActive 
                        ? 'bg-blue-500 animate-pulse' 
                        : isCompleted 
                          ? 'bg-green-500' 
                          : 'bg-gray-300'
                    }`}></div>
                  </div>
                  
                  {/* Connection line */}
                  {index < 5 && (
                    <div className="hidden md:block absolute top-8 left-full w-full h-0.5 bg-gray-200 -translate-x-1/2 z-0">
                      <div className={`h-full transition-all duration-500 ${
                        isCompleted ? 'bg-green-500 w-full' : 'bg-gray-200 w-0'
                      }`}></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Current step description */}
          <div className="mt-8 text-center">
            <div className="inline-flex items-center px-6 py-3 bg-blue-50 rounded-full">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse mr-3"></div>
              <span className="text-blue-700 font-medium">
                {currentStep === 'waiting' && 'Ready to begin payment process'}
                {currentStep === 'scanning' && 'Scanning QR code for order verification'}
                {currentStep === 'authenticating' && 'Verifying your identity'}
                {currentStep === 'paying' && 'Select your payment method'}
                {currentStep === 'processing' && 'Processing your payment securely'}
                {currentStep === 'complete' && 'Payment completed successfully!'}
              </span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 sticky top-6 border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900 flex items-center">
                🛒 Order Summary
              </h3>
                <div className="flex items-center text-blue-600">
                  <FiTrendingUp className="h-4 w-4 mr-1" />
                  <span className="text-sm font-medium">{orderItems.length} items</span>
                </div>
              </div>
              
              <div className="space-y-4 mb-6 max-h-60 overflow-y-auto">
                {orderItems.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl hover:shadow-md transition-shadow">
                    <div className="flex items-center flex-1">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-100 to-purple-100 rounded-xl flex items-center justify-center mr-4">
                        <span className="text-xl">{item.image}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm truncate">{item.name}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                            Qty: {item.quantity}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatCurrency(item.price)} each
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right ml-3">
                      <p className="font-bold text-gray-900 text-lg">{formatCurrency(item.price * item.quantity)}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-200 pt-6">
                <div className="space-y-3 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 flex items-center">
                      <FiDollarSign className="h-4 w-4 mr-1" />
                      Subtotal:
                    </span>
                    <span className="font-bold">{formatCurrency(orderData.subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 flex items-center">
                      <FiActivity className="h-4 w-4 mr-1" />
                      Tax:
                    </span>
                    <span className="font-bold">{formatCurrency(orderData.tax)}</span>
                  </div>
                  {loyaltyPoints > 0 && (
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <span className="text-green-700 flex items-center font-medium">
                        <FiAward className="h-4 w-4 mr-1" />
                        Loyalty Discount:
                      </span>
                      <span className="font-bold text-green-600">-{formatCurrency(loyaltyPoints * 0.01)}</span>
                </div>
                  )}
                </div>
                
                <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-4 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-gray-900">Total:</span>
                    <span className="text-2xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                      {formatCurrency(orderTotal)}
                    </span>
                  </div>
                </div>
              </div>

              {customerInfo && (
                <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200">
                  <div className="flex items-center mb-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mr-3">
                      <FiUser className="h-4 w-4 text-white" />
                    </div>
                    <p className="font-bold text-gray-900">{customerInfo.name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="text-center p-2 bg-white/50 rounded-lg">
                      <div className="font-bold text-purple-600">{loyaltyPoints}</div>
                      <div className="text-gray-600">Current Points</div>
                    </div>
                    <div className="text-center p-2 bg-white/50 rounded-lg">
                      <div className="font-bold text-green-600">+{Math.floor(orderTotal / 10)}</div>
                      <div className="text-gray-600">Points Earned</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Security Badge */}
              <div className="mt-6 flex items-center justify-center p-3 bg-green-50 rounded-xl">
                <FiShield className="h-5 w-5 text-green-600 mr-2" />
                <span className="text-sm font-medium text-green-700">
                  Secured by 256-bit SSL encryption
                </span>
              </div>
            </div>
          </div>

          {/* Payment Interface */}
          <div className="lg:col-span-2">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-gray-200">
              {/* Waiting State */}
              {currentStep === 'waiting' && (
                <div className="text-center animate-fadeIn">
                  <div className="relative mb-8">
                    <div className="w-32 h-32 bg-gradient-to-r from-blue-500 to-purple-500 rounded-3xl flex items-center justify-center mx-auto shadow-2xl animate-float">
                      <FiClock className="h-16 w-16 text-white" />
                    </div>
                    {/* Pulsing rings */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-40 h-40 border-4 border-blue-300 rounded-full animate-ping opacity-30"></div>
                      <div className="absolute w-48 h-48 border-4 border-purple-300 rounded-full animate-ping opacity-20" style={{animationDelay: '0.5s'}}></div>
                    </div>
                  </div>
                  
                  <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to Pay</h2>
                  <p className="text-gray-600 mb-8 text-lg max-w-md mx-auto leading-relaxed">
                    Please scan the QR code displayed on the cashier screen to begin your secure payment process
                  </p>
                  
                  <div className="space-y-4 mb-8">
                    <div className="flex items-center justify-center space-x-6 text-sm text-gray-600">
                      <div className="flex items-center">
                        <FiShield className="h-5 w-5 text-green-500 mr-2" />
                        <span>Secure</span>
                      </div>
                      <div className="flex items-center">
                        <FiZap className="h-5 w-5 text-blue-500 mr-2" />
                        <span>Fast</span>
                      </div>
                      <div className="flex items-center">
                        <FiWifi className="h-5 w-5 text-purple-500 mr-2" />
                        <span>Contactless</span>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => {
                      setCurrentStep('scanning');
                      setShowQRScanner(true);
                    }}
                    className="group inline-flex items-center px-10 py-5 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-2xl hover:from-blue-700 hover:to-purple-700 transform hover:scale-105 transition-all duration-300 shadow-xl hover:shadow-2xl"
                  >
                    <FiCamera className="h-6 w-6 mr-3 group-hover:animate-bounce" />
                    Start Payment Process
                    <FiArrowRight className="h-5 w-5 ml-3 group-hover:translate-x-1 transition-transform" />
                  </button>

                  {/* Help text */}
                  <div className="mt-8 p-4 bg-blue-50 rounded-xl">
                    <p className="text-sm text-blue-700">
                      <FiAlertCircle className="h-4 w-4 inline mr-2" />
                      Look for the QR code on the cashier's screen or receipt
                    </p>
                  </div>
                </div>
              )}

              {/* Processing State */}
              {currentStep === 'processing' && (
                <div className="text-center animate-fadeIn">
                  <div className="relative mb-8">
                    <div className="w-32 h-32 bg-gradient-to-r from-orange-500 to-red-500 rounded-3xl flex items-center justify-center mx-auto shadow-2xl">
                      <FiRefreshCw className="h-16 w-16 text-white animate-spin" />
                    </div>
                    {/* Processing rings */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-40 h-40 border-4 border-orange-300 rounded-full animate-spin opacity-30"></div>
                      <div className="absolute w-48 h-48 border-4 border-red-300 rounded-full animate-spin opacity-20" style={{animationDirection: 'reverse'}}></div>
                    </div>
                  </div>
                  
                  <h2 className="text-3xl font-bold text-gray-900 mb-4">Processing Payment...</h2>
                  <p className="text-gray-600 mb-8 text-lg">Please wait while we process your payment securely</p>
                  
                  {/* Enhanced progress bar */}
                  <div className="w-full bg-gray-200 rounded-full h-4 mb-6 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-orange-500 to-red-500 h-4 rounded-full transition-all duration-1000 ease-out relative"
                      style={{ width: `${processingProgress}%` }}
                    >
                      <div className="absolute inset-0 bg-white/30 animate-pulse"></div>
                    </div>
                  </div>
                  
                  {/* Processing steps */}
                  <div className="space-y-3 mb-8 max-w-md mx-auto">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Verifying payment details</span>
                      <FiCheckCircle className="h-4 w-4 text-green-500" />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Contacting payment processor</span>
                      <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-400">
                      <span>Finalizing transaction</span>
                      <FiClock className="h-4 w-4" />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-center space-x-2 text-sm bg-green-50 p-4 rounded-xl">
                    <FiShield className="h-5 w-5 text-green-600" />
                    <span className="text-green-700 font-medium">Secured by FAREDEAL Payment Gateway</span>
                  </div>

                  {/* Security indicators */}
                  <div className="mt-6 grid grid-cols-3 gap-4 text-xs">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <FiLock className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                      <span className="text-blue-700">256-bit SSL</span>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <FiShield className="h-5 w-5 text-green-600 mx-auto mb-1" />
                      <span className="text-green-700">PCI Compliant</span>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <FiCheckCircle className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                      <span className="text-purple-700">Verified</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Complete State */}
              {currentStep === 'complete' && (
                <div className="text-center animate-bounceIn">
                  {/* Celebration animation */}
                  <div className="relative mb-8">
                    <div className="w-32 h-32 bg-gradient-to-r from-green-500 to-emerald-500 rounded-3xl flex items-center justify-center mx-auto shadow-2xl animate-successPulse">
                      <FiCheckCircle className="h-16 w-16 text-white" />
                    </div>
                    {/* Success rings */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-40 h-40 border-4 border-green-300 rounded-full animate-ping opacity-40"></div>
                      <div className="absolute w-48 h-48 border-4 border-emerald-300 rounded-full animate-ping opacity-30" style={{animationDelay: '0.3s'}}></div>
                      <div className="absolute w-56 h-56 border-4 border-green-200 rounded-full animate-ping opacity-20" style={{animationDelay: '0.6s'}}></div>
                    </div>
                    {/* Floating confetti-like elements */}
                    <div className="absolute inset-0">
                      <div className="absolute top-4 left-4 w-3 h-3 bg-yellow-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="absolute top-6 right-8 w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{animationDelay: '0.3s'}}></div>
                      <div className="absolute bottom-8 left-12 w-4 h-4 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.5s'}}></div>
                      <div className="absolute bottom-4 right-4 w-3 h-3 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.7s'}}></div>
                    </div>
                  </div>
                  
                  <h2 className="text-4xl font-bold text-gray-900 mb-4">
                    🎉 Payment Successful! 🎉
                  </h2>
                  <p className="text-gray-600 mb-8 text-lg">Thank you for shopping with FAREDEAL</p>
                  
                  {paymentResult && (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 mb-8 border border-green-200">
                      <h3 className="font-bold text-green-800 mb-4 flex items-center justify-center">
                        <FiAward className="h-5 w-5 mr-2" />
                        Transaction Details
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="text-center p-4 bg-white/60 rounded-xl">
                          <p className="text-gray-600 text-sm mb-1">Transaction ID</p>
                          <p className="font-mono font-bold text-lg text-gray-900">{paymentResult.transactionId}</p>
                        </div>
                        <div className="text-center p-4 bg-white/60 rounded-xl">
                          <p className="text-gray-600 text-sm mb-1">Authorization Code</p>
                          <p className="font-mono font-bold text-lg text-gray-900">{paymentResult.authCode}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-center text-sm text-green-700">
                        <FiCheckCircle className="h-4 w-4 mr-2" />
                        <span>Payment processed at {new Date().toLocaleTimeString()}</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Action buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto">
                    <button
                      onClick={() => setShowReceipt(true)}
                      className="group inline-flex items-center justify-center px-6 py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      <FiDownload className="h-5 w-5 mr-2 group-hover:animate-bounce" />
                      View Receipt
                    </button>
                    <button
                      onClick={resetPaymentFlow}
                      className="group inline-flex items-center justify-center px-6 py-4 bg-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-400 transform hover:scale-105 transition-all duration-200"
                    >
                      <FiRefreshCw className="h-5 w-5 mr-2 group-hover:animate-spin" />
                      New Transaction
                    </button>
                  </div>

                  {/* Additional success information */}
                  <div className="mt-8 p-4 bg-blue-50 rounded-xl">
                    <div className="flex items-center justify-center space-x-6 text-sm">
                      <div className="flex items-center text-green-600">
                        <FiCheckCircle className="h-4 w-4 mr-1" />
                        <span>Secure</span>
                      </div>
                      <div className="flex items-center text-blue-600">
                        <FiZap className="h-4 w-4 mr-1" />
                        <span>Instant</span>
                      </div>
                      <div className="flex items-center text-purple-600">
                        <FiShield className="h-4 w-4 mr-1" />
                        <span>Protected</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <BiometricAuth
        isOpen={showBiometric}
        onClose={() => setShowBiometric(false)}
        onAuthComplete={handleBiometricAuth}
      />

      <PaymentMethods
        isOpen={showPaymentMethods}
        onClose={() => setShowPaymentMethods(false)}
        orderTotal={orderTotal}
        customerInfo={customerInfo}
        loyaltyPoints={loyaltyPoints}
        onPaymentComplete={handlePaymentComplete}
      />

      <DigitalReceipt
        isOpen={showReceipt}
        onClose={() => setShowReceipt(false)}
        receiptData={receiptData}
      />

      <PaymentSecurity
        isOpen={showSecurity}
        onClose={() => setShowSecurity(false)}
      />

      <PaymentAnalytics
        isOpen={showAnalytics}
        onClose={() => setShowAnalytics(false)}
      />

      {/* Floating Customer Support */}
      <div className="fixed bottom-6 left-6 z-40">
        <button
          className="w-14 h-14 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110 flex items-center justify-center animate-float"
          title="Customer Support"
        >
          <FiHeart className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
};

export default CustomerPayment;



