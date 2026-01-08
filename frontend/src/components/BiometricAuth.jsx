import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import {
  FiEye, FiUser, FiShield, FiCheck, FiX, FiLoader,
  FiAlertCircle, FiRefreshCw, FiLock, FiUnlock, FiCamera
} from 'react-icons/fi';

const BiometricAuth = ({ isOpen, onClose, onAuthComplete }) => {
  const [authStep, setAuthStep] = useState('select'); // select, fingerprint, face, processing, success, error
  const [selectedMethod, setSelectedMethod] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const maxAttempts = 3;

  // Mock customer data for demo
  const mockCustomerData = {
    id: 'CUST_12345',
    name: 'John Doe',
    email: 'john.doe@email.com',
    phone: '+1 (555) 123-4567',
    loyaltyPoints: 250,
    memberSince: '2022-03-15',
    tier: 'Gold',
    preferredPayment: 'Apple Pay',
    avatar: '👤'
  };

  useEffect(() => {
    if (isOpen) {
      setAuthStep('select');
      setSelectedMethod('');
      setLoading(false);
      setProgress(0);
      setAttempts(0);
    }
  }, [isOpen]);

  const handleMethodSelect = (method) => {
    setSelectedMethod(method);
    setAuthStep(method);
    startAuthentication(method);
  };

  const startAuthentication = async (method) => {
    setLoading(true);
    setProgress(0);
    setAttempts(prev => prev + 1);

    try {
      // Simulate biometric scanning progress
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            return 100;
          }
          return prev + 10;
        });
      }, 200);

      // Simulate authentication delay
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      clearInterval(progressInterval);
      setProgress(100);

      // Simulate success/failure (90% success rate)
      const isSuccess = Math.random() > 0.1;
      
      if (isSuccess) {
        setAuthStep('success');
        setLoading(false);
        
        // Play success sound
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance('Authentication successful');
          utterance.rate = 0.8;
          speechSynthesis.speak(utterance);
        }
        
        toast.success(`🔓 ${method === 'fingerprint' ? 'Fingerprint' : 'Face'} authentication successful!`);
        
        // Return customer data after short delay
        setTimeout(() => {
          onAuthComplete({
            success: true,
            method,
            customerData: mockCustomerData,
            timestamp: new Date().toISOString()
          });
        }, 1500);
        
      } else {
        setAuthStep('error');
        setLoading(false);
        toast.error(`❌ ${method === 'fingerprint' ? 'Fingerprint' : 'Face'} authentication failed. Please try again.`);
      }
      
    } catch (error) {
      setAuthStep('error');
      setLoading(false);
      toast.error('Authentication failed. Please try again.');
    }
  };

  const handleRetry = () => {
    if (attempts >= maxAttempts) {
      toast.error('Maximum authentication attempts reached. Please contact support.');
      onClose();
      return;
    }
    
    startAuthentication(selectedMethod);
  };

  const handleSkip = () => {
    // Allow proceeding without biometric auth (guest checkout)
    onAuthComplete({
      success: true,
      method: 'guest',
      customerData: {
        id: 'GUEST_' + Date.now(),
        name: 'Guest Customer',
        email: '',
        phone: '',
        loyaltyPoints: 0,
        memberSince: new Date().toISOString(),
        tier: 'Guest',
        preferredPayment: 'Card',
        avatar: '👤'
      },
      timestamp: new Date().toISOString()
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <FiShield className="h-8 w-8 mr-3" />
              <div>
                <h2 className="text-xl font-bold">Biometric Authentication</h2>
                <p className="text-purple-100 text-sm">Secure identity verification</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-purple-200 transition-colors"
            >
              <FiX className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          
          {/* Method Selection */}
          {authStep === 'select' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FiLock className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Choose Authentication Method</h3>
                <p className="text-gray-600 text-sm">Select your preferred biometric authentication method</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => handleMethodSelect('fingerprint')}
                  className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all duration-200 flex items-center"
                >
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
                    <FiCamera className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">Fingerprint Scan</p>
                    <p className="text-sm text-gray-500">Quick and secure fingerprint authentication</p>
                  </div>
                </button>

                <button
                  onClick={() => handleMethodSelect('face')}
                  className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 flex items-center"
                >
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                    <FiEye className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">Face Recognition</p>
                    <p className="text-sm text-gray-500">Advanced facial recognition technology</p>
                  </div>
                </button>
              </div>

              <div className="border-t pt-4">
                <button
                  onClick={handleSkip}
                  className="w-full text-gray-500 hover:text-gray-700 text-sm font-medium"
                >
                  Skip Authentication (Continue as Guest)
                </button>
              </div>
            </div>
          )}

          {/* Fingerprint Authentication */}
          {authStep === 'fingerprint' && (
            <div className="text-center space-y-6">
              <div className="relative">
                <div className={`w-32 h-32 rounded-full border-4 flex items-center justify-center mx-auto transition-all duration-500 ${
                  loading 
                    ? 'border-purple-500 bg-purple-50 animate-pulse' 
                    : 'border-gray-300 bg-gray-50'
                }`}>
                  <FiCamera className={`h-16 w-16 transition-colors duration-500 ${
                    loading ? 'text-purple-600 animate-bounce' : 'text-gray-400'
                  }`} />
                </div>
                
                {loading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-36 h-36 border-4 border-transparent border-t-purple-500 rounded-full animate-spin"></div>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  {loading ? 'Scanning Fingerprint...' : 'Place Your Finger'}
                </h3>
                <p className="text-gray-600 text-sm">
                  {loading 
                    ? 'Please keep your finger steady on the scanner' 
                    : 'Place your finger on the scanner when ready'
                  }
                </p>
              </div>

              {loading && (
                <div className="space-y-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-500">{progress}% Complete</p>
                </div>
              )}

              <div className="text-xs text-gray-400">
                Attempt {attempts} of {maxAttempts}
              </div>
            </div>
          )}

          {/* Face Authentication */}
          {authStep === 'face' && (
            <div className="text-center space-y-6">
              <div className="relative">
                <div className={`w-32 h-32 rounded-full border-4 flex items-center justify-center mx-auto transition-all duration-500 ${
                  loading 
                    ? 'border-blue-500 bg-blue-50 animate-pulse' 
                    : 'border-gray-300 bg-gray-50'
                }`}>
                  <FiEye className={`h-16 w-16 transition-colors duration-500 ${
                    loading ? 'text-blue-600 animate-bounce' : 'text-gray-400'
                  }`} />
                </div>
                
                {loading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-36 h-36 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  {loading ? 'Scanning Face...' : 'Look at the Camera'}
                </h3>
                <p className="text-gray-600 text-sm">
                  {loading 
                    ? 'Please look directly at the camera and remain still' 
                    : 'Position your face in front of the camera'
                  }
                </p>
              </div>

              {loading && (
                <div className="space-y-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-500">{progress}% Complete</p>
                </div>
              )}

              <div className="text-xs text-gray-400">
                Attempt {attempts} of {maxAttempts}
              </div>
            </div>
          )}

          {/* Success State */}
          {authStep === 'success' && (
            <div className="text-center space-y-6">
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <FiCheck className="h-12 w-12 text-green-600" />
              </div>
              
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Authentication Successful!</h3>
                <p className="text-gray-600 text-sm">Welcome back, {mockCustomerData.name}</p>
              </div>

              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Loyalty Points:</span>
                  <span className="font-bold text-green-600">{mockCustomerData.loyaltyPoints}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-gray-600">Member Tier:</span>
                  <span className="font-bold text-purple-600">{mockCustomerData.tier}</span>
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {authStep === 'error' && (
            <div className="text-center space-y-6">
              <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <FiAlertCircle className="h-12 w-12 text-red-600" />
              </div>
              
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Authentication Failed</h3>
                <p className="text-gray-600 text-sm">
                  {selectedMethod === 'fingerprint' 
                    ? 'Fingerprint not recognized. Please try again.' 
                    : 'Face not recognized. Please try again.'
                  }
                </p>
              </div>

              <div className="space-y-3">
                {attempts < maxAttempts && (
                  <button
                    onClick={handleRetry}
                    className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center"
                  >
                    <FiRefreshCw className="h-5 w-5 mr-2" />
                    Try Again ({maxAttempts - attempts} attempts left)
                  </button>
                )}
                
                <button
                  onClick={handleSkip}
                  className="w-full bg-gray-300 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-400 transition-colors"
                >
                  Continue as Guest
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default BiometricAuth;
