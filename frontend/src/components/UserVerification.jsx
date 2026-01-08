import React, { useState, useEffect } from 'react';
import {
  FiUser, FiMail, FiPhone, FiShield, FiCheckCircle,
  FiXCircle, FiClock, FiRefreshCw, FiAlertCircle
} from 'react-icons/fi';
import { notificationService } from '../services/notificationService';

const UserVerification = ({ user, onVerificationComplete }) => {
  const [verificationStep, setVerificationStep] = useState('identity');
  const [verificationData, setVerificationData] = useState({
    email: user?.email || '',
    phone: user?.phone || '',
    idNumber: '',
    otp: '',
    verified: false
  });
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [timer, setTimer] = useState(30);

  useEffect(() => {
    let interval;
    if (otpSent && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpSent, timer]);

  const sendOTP = async () => {
    try {
      setLoading(true);
      // Simulate OTP sending
      await new Promise(resolve => setTimeout(resolve, 1500));
      setOtpSent(true);
      setTimer(30);
      notificationService.show('OTP sent successfully! Check your phone and email.', 'success');
    } catch (error) {
      notificationService.show('Failed to send OTP. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    try {
      setLoading(true);
      // Simulate OTP verification
      await new Promise(resolve => setTimeout(resolve, 1500));
      if (verificationData.otp === '123456') {
        setVerificationStep('complete');
        setVerificationData(prev => ({ ...prev, verified: true }));
        notificationService.show('Verification completed successfully! 🎉', 'success');
        onVerificationComplete?.();
      } else {
        throw new Error('Invalid OTP');
      }
    } catch (error) {
      notificationService.show(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const renderIdentityVerification = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center mb-4">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center">
            <FiShield className="h-10 w-10 text-blue-600" />
          </div>
        </div>
        <h3 className="text-xl font-bold text-gray-900">Identity Verification</h3>
        <p className="text-gray-600 mt-2">Please verify your identity to continue</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <div className="bg-gray-50 px-4 py-3">
              <FiMail className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="email"
              value={verificationData.email}
              onChange={(e) => setVerificationData(prev => ({ ...prev, email: e.target.value }))}
              className="flex-1 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your email"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <div className="bg-gray-50 px-4 py-3">
              <FiPhone className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="tel"
              value={verificationData.phone}
              onChange={(e) => setVerificationData(prev => ({ ...prev, phone: e.target.value }))}
              className="flex-1 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your phone number"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">ID Number</label>
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <div className="bg-gray-50 px-4 py-3">
              <FiUser className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={verificationData.idNumber}
              onChange={(e) => setVerificationData(prev => ({ ...prev, idNumber: e.target.value }))}
              className="flex-1 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your ID number"
            />
          </div>
        </div>
      </div>

      <button
        onClick={() => {
          sendOTP();
          setVerificationStep('otp');
        }}
        disabled={loading || !verificationData.email || !verificationData.phone || !verificationData.idNumber}
        className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
      >
        {loading ? (
          <>
            <FiRefreshCw className="h-5 w-5 animate-spin" />
            <span>Verifying...</span>
          </>
        ) : (
          <>
            <FiShield className="h-5 w-5" />
            <span>Continue to Verification</span>
          </>
        )}
      </button>
    </div>
  );

  const renderOTPVerification = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center mb-4">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center">
            <FiMail className="h-10 w-10 text-blue-600" />
          </div>
        </div>
        <h3 className="text-xl font-bold text-gray-900">OTP Verification</h3>
        <p className="text-gray-600 mt-2">
          Enter the OTP sent to your phone and email
        </p>
        {timer > 0 && (
          <p className="text-sm text-gray-500 mt-2">
            Resend OTP in {timer} seconds
          </p>
        )}
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-6 gap-2">
          {Array(6).fill('').map((_, index) => (
            <input
              key={index}
              type="text"
              maxLength={1}
              value={verificationData.otp[index] || ''}
              onChange={(e) => {
                const otp = verificationData.otp.split('');
                otp[index] = e.target.value;
                setVerificationData(prev => ({ ...prev, otp: otp.join('') }));
                if (e.target.value && e.target.nextElementSibling) {
                  e.target.nextElementSibling.focus();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && !e.target.value && e.target.previousElementSibling) {
                  e.target.previousElementSibling.focus();
                }
              }}
              className="w-full h-12 text-center text-2xl font-bold rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ))}
        </div>

        <div className="flex justify-between items-center">
          <button
            onClick={() => setVerificationStep('identity')}
            className="text-gray-600 hover:text-gray-900 text-sm font-medium"
          >
            ← Back
          </button>
          <button
            onClick={sendOTP}
            disabled={timer > 0 || loading}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Resend OTP
          </button>
        </div>
      </div>

      <button
        onClick={verifyOTP}
        disabled={loading || verificationData.otp.length !== 6}
        className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
      >
        {loading ? (
          <>
            <FiRefreshCw className="h-5 w-5 animate-spin" />
            <span>Verifying...</span>
          </>
        ) : (
          <>
            <FiCheckCircle className="h-5 w-5" />
            <span>Verify OTP</span>
          </>
        )}
      </button>
    </div>
  );

  const renderComplete = () => (
    <div className="text-center space-y-6">
      <div className="flex items-center justify-center mb-8">
        <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center animate-bounce">
          <FiCheckCircle className="h-10 w-10 text-green-600" />
        </div>
      </div>
      <h3 className="text-xl font-bold text-gray-900">Verification Complete!</h3>
      <p className="text-gray-600">
        Your identity has been successfully verified. You can now access all features.
      </p>
      <div className="flex justify-center">
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
        >
          Continue to Dashboard
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-auto">
      {/* Progress Indicator */}
      <div className="flex items-center justify-between mb-8">
        {['identity', 'otp', 'complete'].map((step, index) => (
          <div key={step} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                verificationStep === step
                  ? 'bg-blue-600 text-white'
                  : index < ['identity', 'otp', 'complete'].indexOf(verificationStep)
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-400'
              }`}
            >
              {index < ['identity', 'otp', 'complete'].indexOf(verificationStep) ? (
                <FiCheckCircle className="h-5 w-5" />
              ) : (
                <span>{index + 1}</span>
              )}
            </div>
            {index < 2 && (
              <div
                className={`w-full h-1 mx-2 rounded ${
                  index < ['identity', 'otp', 'complete'].indexOf(verificationStep)
                    ? 'bg-green-600'
                    : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Content */}
      {verificationStep === 'identity' && renderIdentityVerification()}
      {verificationStep === 'otp' && renderOTPVerification()}
      {verificationStep === 'complete' && renderComplete()}
    </div>
  );
};

export default UserVerification;