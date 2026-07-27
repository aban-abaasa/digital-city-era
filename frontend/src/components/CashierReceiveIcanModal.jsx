/**
 * Cashier Receive ICAN Modal - Simplified for POS
 * Auto-fills the purchase amount and shows QR code for customer to pay
 */

import React, { useState, useEffect } from 'react';
import { X, Loader, Copy, Download, CheckCircle } from 'lucide-react';
import { QRCodeCanvas as QRCode } from 'qrcode.react';
import {
  createIcanPaymentRequest,
  getIcanPaymentRequest,
} from '../services/icanPaymentRequestService';
import { formatICAN, ugxToICAN } from '../services/icanWalletService';

const CashierReceiveIcanModal = ({ 
  isOpen, 
  onClose, 
  userId,
  amountUGX,
  orderDescription = '',
  onPaymentReceived = null 
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [qrData, setQrData] = useState(null);
  const [paymentLink, setPaymentLink] = useState('');
  const [paymentReceived, setPaymentReceived] = useState(false);
  const [pollingInterval, setPollingInterval] = useState(null);

  const icanAmount = ugxToICAN(amountUGX);

  // Generate QR code automatically when modal opens
  useEffect(() => {
    console.log('🔍 CashierReceiveIcanModal effect:', { isOpen, qrData, userId, amountUGX });
    if (isOpen && !qrData && userId && amountUGX > 0) {
      console.log('✅ Conditions met, generating payment request');
      generatePaymentRequest();
    }
  }, [isOpen, userId, amountUGX]);

  // Poll for payment completion
  useEffect(() => {
    if (qrData && !paymentReceived) {
      const interval = setInterval(async () => {
        try {
          const request = await getIcanPaymentRequest(qrData.payment_code);
          if (request.status === 'completed') {
            setPaymentReceived(true);
            setSuccessMessage('✅ Payment received successfully!');
            clearInterval(interval);
            
            // Notify parent component
            if (onPaymentReceived) {
              setTimeout(() => {
                onPaymentReceived({
                  paymentCode: qrData.payment_code,
                  icanAmount,
                  amountUGX,
                  transactionId: request.ican_tx_id
                });
              }, 2000);
            }
          }
        } catch (err) {
          // Request might be expired or deleted, ignore
          console.log('Polling error:', err.message);
        }
      }, 3000); // Check every 3 seconds

      setPollingInterval(interval);
      return () => clearInterval(interval);
    }
  }, [qrData, paymentReceived, icanAmount, amountUGX, onPaymentReceived]);

  const generatePaymentRequest = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const request = await createIcanPaymentRequest({
        userId,
        icanAmount,
        description: orderDescription || `Supermarket purchase - UGX ${amountUGX.toLocaleString()}`,
      });
      
      setQrData(request);
      setPaymentLink(request.qrValue);
    } catch (err) {
      setError(err.message || 'Failed to generate payment request');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }
    setQrData(null);
    setPaymentLink('');
    setPaymentReceived(false);
    setError(null);
    setSuccessMessage(null);
    onClose();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(paymentLink);
    setSuccessMessage('Payment code copied!');
    setTimeout(() => setSuccessMessage(null), 2000);
  };

  const handleDownloadQR = () => {
    const qrCodeElement = document.getElementById('qr-code-cashier-download');
    if (qrCodeElement) {
      const link = document.createElement('a');
      link.href = qrCodeElement.toDataURL('image/png');
      link.download = `payment-qr-${qrData.payment_code}.png`;
      link.click();
    }
  };

  if (!isOpen) return null;

  console.log('🎨 Rendering CashierReceiveIcanModal:', { isOpen, loading, paymentReceived, qrData: !!qrData });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-4 sm:p-6 lg:p-10 max-w-md sm:max-w-xl lg:max-w-2xl max-h-[95vh] overflow-y-auto w-full mx-3 sm:mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2">
            💎 IcanEra Payment
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {loading && (
          <div className="text-center py-8">
            <Loader className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Generating payment request...</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
            <p className="text-sm text-red-600">❌ {error}</p>
            <button
              onClick={generatePaymentRequest}
              className="mt-2 text-sm text-blue-600 hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {paymentReceived && (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h4 className="text-2xl font-bold text-green-600 mb-2">Payment Received!</h4>
            <p className="text-gray-600">Transaction completed successfully</p>
          </div>
        )}

        {qrData && !loading && !paymentReceived && (
          <div className="space-y-4">
            {/* Amount Display */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 text-center">
              <p className="text-sm text-gray-600 mb-1">Amount to Pay</p>
              <p className="text-4xl font-bold text-blue-600 mb-2">
                {formatICAN(icanAmount)} ICAN
              </p>
              <p className="text-sm text-gray-500">
                ≈ UGX {amountUGX.toLocaleString()}
              </p>
              {orderDescription && (
                <p className="text-xs text-gray-500 mt-2 border-t border-gray-200 pt-2">
                  {orderDescription}
                </p>
              )}
            </div>

            {/* QR Code */}
            <div className="flex justify-center p-4 sm:p-6 lg:p-8 bg-gray-50 rounded-lg">
              <QRCode
                id="qr-code-cashier-download"
                value={paymentLink}
                size={420}
                className="w-[240px] h-[240px] sm:w-[320px] sm:h-[320px] lg:w-[420px] lg:h-[420px]"
                level="H"
                includeMargin={true}
              />
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-blue-900 mb-2">
                📱 Instructions for Customer:
              </p>
              <ol className="text-sm text-blue-800 space-y-1 ml-4 list-decimal">
                <li>Open your IcanEra Wallet app</li>
                <li>Tap "Send" or "Scan QR"</li>
                <li>Scan this QR code</li>
                <li>Confirm the payment</li>
              </ol>
            </div>

            {/* Payment Code */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Payment Code</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={qrData.payment_code}
                  readOnly
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 text-sm"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-2 bg-blue-100 hover:bg-blue-200 border border-blue-300 rounded-lg text-blue-600 transition-all"
                  title="Copy code"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Customer can enter this code manually if scanning fails
              </p>
            </div>

            {successMessage && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-600">✅ {successMessage}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-4">
              <button
                onClick={handleDownloadQR}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg text-gray-700 text-sm font-medium transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-all"
              >
                Cancel
              </button>
            </div>

            {/* Waiting Indicator */}
            <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
              <Loader className="w-4 h-4 animate-spin" />
              <span>Waiting for customer payment...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CashierReceiveIcanModal;
