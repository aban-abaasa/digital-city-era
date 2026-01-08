import React, { useState } from 'react';
import { 
  FiX, 
  FiDownload, 
  FiPrinter, 
  FiMail, 
  FiMessageSquare, 
  FiCheck,
  FiSend,
  FiPhone,
  FiAtSign,
  FiFileText,
  FiSmartphone
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import receiptService from '../services/receiptService';

const ReceiptModal = ({ isOpen, onClose, saleData }) => {
  const [activeTab, setActiveTab] = useState('preview');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen || !saleData) return null;

  const handleSendSMS = async () => {
    if (!customerPhone.trim()) {
      toast.error('📱 Please enter customer phone number');
      return;
    }

    setIsLoading(true);
    try {
      const result = await receiptService.sendSMSReceipt(customerPhone, saleData);
      if (result.success) {
        toast.success(`📱 ${result.message}`);
        setCustomerPhone('');
      }
    } catch (error) {
      toast.error('❌ Failed to send SMS receipt');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!customerEmail.trim()) {
      toast.error('📧 Please enter customer email address');
      return;
    }

    if (!customerEmail.includes('@')) {
      toast.error('📧 Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    try {
      const result = await receiptService.sendEmailReceipt(customerEmail, saleData);
      if (result.success) {
        toast.success(`📧 ${result.message}`);
        setCustomerEmail('');
      }
    } catch (error) {
      toast.error('❌ Failed to send email receipt');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    setIsLoading(true);
    try {
      const result = await receiptService.downloadPDFReceipt(saleData);
      if (result.success) {
        toast.success(`📄 ${result.message}`);
      }
    } catch (error) {
      toast.error('❌ Failed to generate PDF receipt');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    try {
      const result = receiptService.printReceipt(saleData);
      if (result.success) {
        toast.success(`🖨️ ${result.message}`);
      }
    } catch (error) {
      toast.error('❌ Failed to open print dialog');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const receiptData = receiptService.generateReceiptData(saleData);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                <FiFileText className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">🇺🇬 Receipt Options</h2>
                <p className="text-purple-100">Receipt #{receiptData.receiptNumber}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="bg-white/20 hover:bg-white/30 p-2 rounded-lg transition-all"
            >
              <FiX className="h-6 w-6" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-4 mt-6">
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-6 py-3 rounded-xl font-bold transition-all ${
                activeTab === 'preview'
                  ? 'bg-white text-purple-600 shadow-lg'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              <FiFileText className="inline h-5 w-5 mr-2" />
              Preview
            </button>
            <button
              onClick={() => setActiveTab('send')}
              className={`px-6 py-3 rounded-xl font-bold transition-all ${
                activeTab === 'send'
                  ? 'bg-white text-purple-600 shadow-lg'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              <FiSend className="inline h-5 w-5 mr-2" />
              Send Receipt
            </button>
            <button
              onClick={() => setActiveTab('download')}
              className={`px-6 py-3 rounded-xl font-bold transition-all ${
                activeTab === 'download'
                  ? 'bg-white text-purple-600 shadow-lg'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              <FiDownload className="inline h-5 w-5 mr-2" />
              Download & Print
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {activeTab === 'preview' && (
            <div className="space-y-6">
              {/* Receipt Preview */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-xl border-2 border-gray-200">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-800">🇺🇬 FareDeal Uganda</h3>
                  <p className="text-gray-600">Your Trusted Local Store</p>
                  <p className="text-sm text-gray-500">Kampala, Uganda | +256 700 123 456</p>
                </div>

                <div className="border-t border-gray-300 pt-4 mb-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p><strong>Receipt:</strong> {receiptData.receiptNumber}</p>
                      <p><strong>Date:</strong> {receiptData.date}</p>
                    </div>
                    <div>
                      <p><strong>Cashier:</strong> {receiptData.cashier}</p>
                      {receiptData.customer && (
                        <p><strong>Customer:</strong> {receiptData.customer.firstName} {receiptData.customer.lastName}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-300 pt-4 mb-4">
                  <h4 className="font-bold mb-3">🛒 Items:</h4>
                  <div className="space-y-2">
                    {receiptData.items.map((item, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <div className="flex-1">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-gray-600">
                            {item.quantity} × {formatCurrency(item.price)}
                          </p>
                        </div>
                        <p className="font-bold">{formatCurrency(item.quantity * item.price)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-gray-300 pt-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>💰 Subtotal:</span>
                      <span>{formatCurrency(receiptData.subtotal)}</span>
                    </div>
                    {receiptData.tax > 0 && (
                      <div className="flex justify-between">
                        <span>📊 VAT (18%):</span>
                        <span>{formatCurrency(receiptData.tax)}</span>
                      </div>
                    )}
                    {receiptData.discount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>🎉 Loyalty Discount:</span>
                        <span>-{formatCurrency(receiptData.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold border-t pt-2">
                      <span>💳 TOTAL:</span>
                      <span>{formatCurrency(receiptData.total)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>💰 Payment:</span>
                      <span>{receiptData.paymentMethod.toUpperCase()}</span>
                    </div>
                    {receiptData.change > 0 && (
                      <div className="flex justify-between">
                        <span>💵 Change:</span>
                        <span>{formatCurrency(receiptData.change)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {receiptData.loyaltyPointsEarned > 0 && (
                  <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded-lg text-center">
                    <p className="font-bold text-yellow-800">
                      ⭐ You earned {receiptData.loyaltyPointsEarned} loyalty points!
                    </p>
                  </div>
                )}

                <div className="text-center mt-6 pt-4 border-t border-gray-300">
                  <p className="font-bold text-gray-800">🙏 Webale nyo! (Thank you!)</p>
                  <p className="text-sm text-gray-600">Come back soon! 😊</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'send' && (
            <div className="space-y-6">
              {/* SMS Receipt */}
              <div className="bg-gradient-to-br from-green-50 to-blue-50 p-6 rounded-xl border-2 border-green-200">
                <div className="flex items-center mb-4">
                  <FiSmartphone className="h-6 w-6 text-green-600 mr-3" />
                  <h3 className="text-xl font-bold text-gray-800">📱 Send SMS Receipt</h3>
                </div>
                <p className="text-gray-600 mb-4">
                  Send a concise receipt via SMS to the customer's phone number.
                </p>
                <div className="flex space-x-3">
                  <div className="flex-1 relative">
                    <FiPhone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="tel"
                      placeholder="Customer phone number (+256...)"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <button
                    onClick={handleSendSMS}
                    disabled={isLoading || !customerPhone.trim()}
                    className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold transition-all"
                  >
                    {isLoading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <FiMessageSquare className="inline h-5 w-5 mr-2" />
                        Send SMS
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Email Receipt */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl border-2 border-purple-200">
                <div className="flex items-center mb-4">
                  <FiMail className="h-6 w-6 text-purple-600 mr-3" />
                  <h3 className="text-xl font-bold text-gray-800">📧 Send Email Receipt</h3>
                </div>
                <p className="text-gray-600 mb-4">
                  Send a detailed, beautifully formatted receipt via email.
                </p>
                <div className="flex space-x-3">
                  <div className="flex-1 relative">
                    <FiAtSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      placeholder="Customer email address"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                  <button
                    onClick={handleSendEmail}
                    disabled={isLoading || !customerEmail.trim()}
                    className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold transition-all"
                  >
                    {isLoading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <FiMail className="inline h-5 w-5 mr-2" />
                        Send Email
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'download' && (
            <div className="space-y-6">
              {/* Download PDF */}
              <div className="bg-gradient-to-br from-red-50 to-orange-50 p-6 rounded-xl border-2 border-red-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center mb-2">
                      <FiDownload className="h-6 w-6 text-red-600 mr-3" />
                      <h3 className="text-xl font-bold text-gray-800">📄 Download PDF Receipt</h3>
                    </div>
                    <p className="text-gray-600">
                      Download a professional PDF receipt for records or sharing.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadPDF}
                    disabled={isLoading}
                    className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold transition-all"
                  >
                    {isLoading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <FiDownload className="inline h-5 w-5 mr-2" />
                        Download PDF
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Print Receipt */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border-2 border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center mb-2">
                      <FiPrinter className="h-6 w-6 text-blue-600 mr-3" />
                      <h3 className="text-xl font-bold text-gray-800">🖨️ Print Receipt</h3>
                    </div>
                    <p className="text-gray-600">
                      Print the receipt directly to your default printer.
                    </p>
                  </div>
                  <button
                    onClick={handlePrint}
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold transition-all"
                  >
                    <FiPrinter className="inline h-5 w-5 mr-2" />
                    Print Receipt
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-gray-50 px-6 py-4 border-t">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              💡 Tip: Customers love receiving digital receipts!
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-bold transition-all"
            >
              <FiCheck className="inline h-4 w-4 mr-2" />
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceiptModal;
