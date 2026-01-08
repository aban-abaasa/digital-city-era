import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'react-toastify';
import { 
  FiX, FiDownload, FiMail, FiMessageSquare, FiPrinter, FiShare2,
  FiCheckCircle, FiStar, FiGift, FiHeart, FiCalendar, FiMapPin,
  FiUser, FiCreditCard, FiShield, FiZap, FiClock, FiHash, FiRefreshCw,
  FiSend, FiCheck, FiPhone, FiSmartphone, FiFileText, FiImage,
  FiCopy, FiExternalLink, FiWifi, FiBluetooth, FiMonitor, FiSave
} from 'react-icons/fi';

const DigitalReceipt = ({ isOpen, onClose, receiptData }) => {
  const [emailAddress, setEmailAddress] = useState(receiptData?.customer?.email || '');
  const [phoneNumber, setPhoneNumber] = useState(receiptData?.customer?.phone || '');
  const [sending, setSending] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState('email');
  const [deliveryStatus, setDeliveryStatus] = useState({});
  const [receiptFormat, setReceiptFormat] = useState('standard');
  const [includeQR, setIncludeQR] = useState(true);
  const [includeLoyalty, setIncludeLoyalty] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [receiptTheme, setReceiptTheme] = useState('modern');
  const receiptRef = useRef(null);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Animation effect on mount
  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 600);
    }
  }, [isOpen]);

  if (!receiptData) return null;

  const {
    orderId,
    items,
    subtotal,
    tax,
    total,
    payment,
    customer,
    loyaltyPointsEarned,
    loyaltyPointsUsed,
    timestamp,
    cashierId,
    cashierName,
    store
  } = receiptData;

  // Enhanced receipt delivery functions
  const generateEnhancedReceiptHTML = () => {
    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Receipt #${orderId}</title>
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
          }
          .receipt-container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            overflow: hidden;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          }
          .receipt-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            position: relative;
          }
          .receipt-header::before {
            content: '';
            position: absolute;
            bottom: -10px;
            left: 0;
            width: 100%;
            height: 20px;
            background: white;
            border-radius: 50% 50% 0 0 / 100% 100% 0 0;
          }
          .store-logo {
            width: 80px;
            height: 80px;
            background: white;
            border-radius: 50%;
            margin: 0 auto 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2em;
            color: #667eea;
          }
          .receipt-body {
            padding: 30px;
          }
          .order-info {
            background: #f8f9ff;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 25px;
            border-left: 5px solid #667eea;
          }
          .items-section {
            margin: 25px 0;
          }
          .item {
            display: flex;
            justify-content: space-between;
            padding: 15px;
            border-bottom: 1px solid #eee;
            align-items: center;
          }
          .item:hover {
            background: #f8f9ff;
            border-radius: 8px;
          }
          .total-section {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 25px;
            border-radius: 10px;
            margin: 25px 0;
          }
          .loyalty-section {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            text-align: center;
          }
          .qr-code {
            text-align: center;
            margin: 20px 0;
            padding: 20px;
            background: #f8f9ff;
            border-radius: 10px;
          }
          .footer {
            text-align: center;
            padding: 30px;
            background: #f8f9ff;
            border-top: 3px solid #667eea;
          }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <div class="receipt-header">
            <div class="store-logo">🛒</div>
            <h1>FAREDEAL POS</h1>
            <p>Thank you for shopping with us!</p>
          </div>
          
          <div class="receipt-body">
            <div class="order-info">
              <h3>📋 Order Information</h3>
              <p><strong>Order ID:</strong> #${orderId}</p>
              <p><strong>Date:</strong> ${new Date(timestamp).toLocaleString()}</p>
              <p><strong>Cashier:</strong> ${cashierName || 'System'}</p>
              ${customer ? `<p><strong>Customer:</strong> ${customer.name}</p>` : ''}
            </div>

            <div class="items-section">
              <h3>🛍️ Items Purchased</h3>
              ${items.map(item => `
                <div class="item">
                  <div>
                    <strong>${item.name}</strong><br>
                    <small>${item.quantity} × UGX ${item.price.toLocaleString()}</small>
                  </div>
                  <div><strong>UGX ${(item.quantity * item.price).toLocaleString()}</strong></div>
                </div>
              `).join('')}
            </div>

            <div class="total-section">
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span>Subtotal:</span>
                <span>UGX ${subtotal.toLocaleString()}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span>Tax:</span>
                <span>UGX ${tax.toLocaleString()}</span>
              </div>
              <hr style="margin: 15px 0; border: 1px solid rgba(255,255,255,0.3);">
              <div style="display: flex; justify-content: space-between; font-size: 1.3em; font-weight: bold;">
                <span>Total:</span>
                <span>UGX ${total.toLocaleString()}</span>
              </div>
            </div>

            ${loyaltyPointsEarned || loyaltyPointsUsed ? `
              <div class="loyalty-section">
                <h3>⭐ Loyalty Points</h3>
                ${loyaltyPointsEarned ? `<p>Points Earned: <strong>+${loyaltyPointsEarned}</strong></p>` : ''}
                ${loyaltyPointsUsed ? `<p>Points Used: <strong>-${loyaltyPointsUsed}</strong></p>` : ''}
              </div>
            ` : ''}

            ${includeQR ? `
              <div class="qr-code">
                <h3>📱 Receipt QR Code</h3>
                <div style="width: 120px; height: 120px; background: #ddd; margin: 0 auto; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                  QR Code
                </div>
                <p><small>Scan to view receipt online</small></p>
              </div>
            ` : ''}
          </div>

          <div class="footer">
            <p><strong>FAREDEAL POS System</strong></p>
            <p>Visit us again soon! 😊</p>
            <p><small>This is a digital receipt. Please keep for your records.</small></p>
          </div>
        </div>
      </body>
      </html>
    `;
    return receiptHTML;
  };

  // Generate PDF receipt
  const generatePDFReceipt = async () => {
    try {
      setSending(true);
      const receiptHTML = generateEnhancedReceiptHTML();
      
      // Create a new window for PDF generation
      const printWindow = window.open('', '_blank');
      printWindow.document.write(receiptHTML);
      printWindow.document.close();
      
      // Wait for content to load then print
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
        toast.success('📄 PDF receipt generated successfully!');
      }, 1000);
      
    } catch (error) {
      toast.error('📄 Failed to generate PDF receipt');
      console.error('PDF generation error:', error);
    } finally {
      setSending(false);
    }
  };

  // Send receipt via email
  const sendEmailReceipt = async () => {
    try {
      setSending(true);
      setDeliveryStatus(prev => ({ ...prev, email: 'sending' }));
      
      const receiptHTML = generateEnhancedReceiptHTML();
      
      // Simulate API call to email service
      const emailData = {
        to: emailAddress,
        subject: `Receipt #${orderId} - FAREDEAL POS`,
        html: receiptHTML,
        attachments: [
          {
            filename: `receipt-${orderId}.pdf`,
            content: 'base64-encoded-pdf-content',
            contentType: 'application/pdf'
          }
        ]
      };
      
      // Simulate email sending
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // In a real implementation, you would call your email API here
      // await fetch('/api/send-email', { method: 'POST', body: JSON.stringify(emailData) });
      
      setDeliveryStatus(prev => ({ ...prev, email: 'sent' }));
      toast.success(`📧 Receipt sent to ${emailAddress}!`);
      
    } catch (error) {
      setDeliveryStatus(prev => ({ ...prev, email: 'failed' }));
      toast.error('📧 Failed to send email receipt');
      console.error('Email sending error:', error);
    } finally {
      setSending(false);
    }
  };

  // Send receipt via SMS
  const sendSMSReceipt = async () => {
    try {
      setSending(true);
      setDeliveryStatus(prev => ({ ...prev, sms: 'sending' }));
      
      const smsMessage = `
🛒 FAREDEAL POS Receipt #${orderId}

📅 ${new Date(timestamp).toLocaleDateString()}
💰 Total: UGX ${total.toLocaleString()}
💳 Payment: ${payment.method}

${items.slice(0, 3).map(item => `• ${item.name} x${item.quantity}`).join('\n')}
${items.length > 3 ? `...and ${items.length - 3} more items` : ''}

${loyaltyPointsEarned ? `⭐ Earned ${loyaltyPointsEarned} points!` : ''}

Thank you for shopping with us! 😊

View full receipt: https://faredeal.pos/receipt/${orderId}
      `.trim();
      
      // Simulate SMS API call
      const smsData = {
        to: phoneNumber,
        message: smsMessage,
        from: 'FAREDEAL'
      };
      
      // Simulate SMS sending
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // In a real implementation, you would call your SMS API here
      // await fetch('/api/send-sms', { method: 'POST', body: JSON.stringify(smsData) });
      
      setDeliveryStatus(prev => ({ ...prev, sms: 'sent' }));
      toast.success(`📱 Receipt sent to ${phoneNumber}!`);
      
    } catch (error) {
      setDeliveryStatus(prev => ({ ...prev, sms: 'failed' }));
      toast.error('📱 Failed to send SMS receipt');
      console.error('SMS sending error:', error);
    } finally {
      setSending(false);
    }
  };

  // Send receipt via WhatsApp
  const sendWhatsAppReceipt = async () => {
    try {
      setSending(true);
      setDeliveryStatus(prev => ({ ...prev, whatsapp: 'sending' }));
      
      const whatsappMessage = `
🛒 *FAREDEAL POS Receipt*
📋 Order #${orderId}

📅 Date: ${new Date(timestamp).toLocaleDateString()}
💰 Total: *UGX ${total.toLocaleString()}*
💳 Payment: ${payment.method}

*Items Purchased:*
${items.map(item => `• ${item.name} ×${item.quantity} - UGX ${(item.quantity * item.price).toLocaleString()}`).join('\n')}

${loyaltyPointsEarned ? `⭐ *You earned ${loyaltyPointsEarned} loyalty points!*\n` : ''}

Thank you for shopping with us! 😊

_This is an automated message from FAREDEAL POS_
      `.trim();
      
      // Create WhatsApp link
      const whatsappURL = `https://api.whatsapp.com/send?phone=${phoneNumber.replace(/\D/g, '')}&text=${encodeURIComponent(whatsappMessage)}`;
      
      // Open WhatsApp link
      window.open(whatsappURL, '_blank');
      
      // Simulate delivery confirmation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setDeliveryStatus(prev => ({ ...prev, whatsapp: 'sent' }));
      toast.success(`💬 WhatsApp receipt prepared for ${phoneNumber}!`);
      
    } catch (error) {
      setDeliveryStatus(prev => ({ ...prev, whatsapp: 'failed' }));
      toast.error('💬 Failed to prepare WhatsApp receipt');
      console.error('WhatsApp sending error:', error);
    } finally {
      setSending(false);
    }
  };

  // Send to multiple channels
  const sendToAllChannels = async () => {
    if (!emailAddress && !phoneNumber) {
      toast.error('Please provide at least one contact method');
      return;
    }

    const promises = [];
    
    if (emailAddress) {
      promises.push(sendEmailReceipt());
    }
    
    if (phoneNumber) {
      promises.push(sendSMSReceipt());
      promises.push(sendWhatsAppReceipt());
    }
    
    try {
      await Promise.all(promises);
      toast.success('🎉 Receipt sent via all available channels!');
    } catch (error) {
      toast.warning('⚠️ Some receipts may not have been delivered');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const generateStyledReceiptHTML = () => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>FAREDEAL Receipt - ${orderId}</title>
        <style>
          body { font-family: 'Arial', sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
          .receipt { max-width: 400px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { text-align: center; border-bottom: 2px dashed #ccc; padding-bottom: 15px; margin-bottom: 15px; }
          .logo { font-size: 24px; font-weight: bold; color: #2563eb; margin-bottom: 5px; }
          .store-info { font-size: 12px; color: #666; }
          .order-info { margin-bottom: 15px; }
          .items { border-bottom: 1px dashed #ccc; padding-bottom: 15px; margin-bottom: 15px; }
          .item { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
          .item-name { flex: 1; }
          .item-price { font-weight: bold; }
          .totals { margin-bottom: 15px; }
          .total-line { display: flex; justify-content: space-between; margin-bottom: 5px; }
          .total-line.final { font-weight: bold; font-size: 16px; border-top: 1px solid #ccc; padding-top: 5px; }
          .payment-info { border-top: 1px dashed #ccc; padding-top: 15px; margin-bottom: 15px; font-size: 14px; }
          .loyalty-info { background: #f0f9ff; padding: 10px; border-radius: 5px; margin-bottom: 15px; }
          .footer { text-align: center; font-size: 12px; color: #666; border-top: 1px dashed #ccc; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <div class="logo">🛍️ FAREDEAL</div>
            <div class="store-info">
              Your Premium Shopping Destination<br>
              📍 123 Commerce Street, City, State 12345<br>
              📞 (555) 123-SHOP | 🌐 www.faredeal.com
            </div>
          </div>
          
          <div class="order-info">
            <div><strong>Order #:</strong> ${orderId}</div>
            <div><strong>Date:</strong> ${formatDate(timestamp)}</div>
            <div><strong>Cashier:</strong> ${cashierName} (${cashierId})</div>
            ${customer ? `<div><strong>Customer:</strong> ${customer.name}</div>` : ''}
          </div>
          
          <div class="items">
            ${items.map(item => `
              <div class="item">
                <div class="item-name">
                  ${item.name}<br>
                  <small style="color: #666;">SKU: ${item.sku} × ${item.quantity}</small>
                </div>
                <div class="item-price">${formatCurrency(item.price * item.quantity)}</div>
              </div>
            `).join('')}
          </div>
          
          <div class="totals">
            <div class="total-line">
              <span>Subtotal:</span>
              <span>${formatCurrency(subtotal)}</span>
            </div>
            <div class="total-line">
              <span>Tax:</span>
              <span>${formatCurrency(tax)}</span>
            </div>
            ${loyaltyPointsUsed > 0 ? `
              <div class="total-line" style="color: #059669;">
                <span>Loyalty Discount:</span>
                <span>-${formatCurrency(loyaltyPointsUsed * 0.01)}</span>
              </div>
            ` : ''}
            <div class="total-line final">
              <span>Total Paid:</span>
              <span>${formatCurrency(total)}</span>
            </div>
          </div>
          
          <div class="payment-info">
            <div><strong>Payment Method:</strong> ${payment.paymentMethod.charAt(0).toUpperCase() + payment.paymentMethod.slice(1)}</div>
            <div><strong>Transaction ID:</strong> ${payment.transactionId}</div>
            <div><strong>Auth Code:</strong> ${payment.authCode}</div>
            ${payment.cardLast4 ? `<div><strong>Card:</strong> ****${payment.cardLast4}</div>` : ''}
            ${payment.change > 0 ? `<div><strong>Change Given:</strong> ${formatCurrency(payment.change)}</div>` : ''}
          </div>
          
          ${customer && loyaltyPointsEarned > 0 ? `
            <div class="loyalty-info">
              <div style="font-weight: bold; color: #2563eb; margin-bottom: 5px;">🎉 Loyalty Rewards</div>
              <div>Points Earned: <strong>${loyaltyPointsEarned}</strong></div>
              <div>Total Points: <strong>${customer.loyaltyPoints + loyaltyPointsEarned}</strong></div>
              <div style="font-size: 11px; color: #666; margin-top: 5px;">
                Next reward at ${Math.ceil((customer.loyaltyPoints + loyaltyPointsEarned) / 100) * 100} points!
              </div>
            </div>
          ` : ''}
          
          <div class="footer">
            <div style="margin-bottom: 10px;">
              <strong>Thank you for shopping with FAREDEAL!</strong>
            </div>
            <div>
              Return Policy: 30 days with receipt<br>
              Customer Service: support@faredeal.com<br>
              Follow us: @faredeal
            </div>
            <div style="margin-top: 10px; font-size: 10px;">
              Receipt generated on ${new Date().toLocaleString()}
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const handleSendReceipt = async () => {
    if (deliveryMethod === 'email' && !emailAddress) {
      toast.error('Please enter an email address');
      return;
    }
    
    if (deliveryMethod === 'sms' && !phoneNumber) {
      toast.error('Please enter a phone number');
      return;
    }

    setSending(true);
    
    try {
      // Simulate sending receipt
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (deliveryMethod === 'email') {
        toast.success(`📧 Receipt sent to ${emailAddress}!`);
      } else {
        toast.success(`📱 Receipt sent to ${phoneNumber}!`);
      }
      
      // Clear inputs
      setEmailAddress('');
      setPhoneNumber('');
      
    } catch (error) {
      toast.error('Failed to send receipt. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleDownloadPDF = () => {
    // Create a new window with the receipt HTML
    const printWindow = window.open('', '_blank');
    printWindow.document.write(generateStyledReceiptHTML());
    printWindow.document.close();
    
    // Trigger print dialog
    setTimeout(() => {
      printWindow.print();
    }, 500);
    
    toast.success('📄 Receipt ready for download/print!');
  };

  const handleShareReceipt = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `FAREDEAL Receipt - ${orderId}`,
          text: `Receipt for order ${orderId} - Total: ${formatCurrency(total)}`,
          url: window.location.href
        });
        toast.success('Receipt shared successfully!');
      } catch (error) {
        // User cancelled sharing
      }
    } else {
      // Fallback: copy to clipboard
      const receiptText = `
FAREDEAL Receipt
Order: ${orderId}
Date: ${formatDate(timestamp)}
Total: ${formatCurrency(total)}
Thank you for shopping with us!
      `.trim();
      
      navigator.clipboard.writeText(receiptText);
      toast.success('Receipt details copied to clipboard!');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          {/* Header */}
          <div className="bg-gradient-to-r from-green-600 to-blue-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <FiCheckCircle className="h-6 w-6 text-white mr-3" />
                <div>
                  <h3 className="text-xl font-bold text-white">
                    🧾 Digital Receipt
                  </h3>
                  <p className="text-green-100 text-sm">
                    Order #{orderId.slice(-6)} • {formatDate(timestamp)}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <FiX className="h-6 w-6" />
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* Receipt Preview */}
            <div ref={receiptRef} className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-6 mb-6 max-w-md mx-auto">
              {/* Store Header */}
              <div className="text-center border-b-2 border-dashed border-gray-300 pb-4 mb-4">
                <div className="text-2xl font-bold text-blue-600 mb-2">🛍️ FAREDEAL</div>
                <div className="text-xs text-gray-600">
                  Your Premium Shopping Destination<br/>
                  📍 123 Commerce Street, City, State 12345<br/>
                  📞 (555) 123-SHOP | 🌐 www.faredeal.com
                </div>
              </div>

              {/* Order Info */}
              <div className="mb-4 text-sm">
                <div className="flex justify-between mb-1">
                  <span>Order #:</span>
                  <span className="font-mono font-bold">{orderId}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span>Date:</span>
                  <span>{formatDate(timestamp)}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span>Cashier:</span>
                  <span>{cashierName} ({cashierId})</span>
                </div>
                {customer && (
                  <div className="flex justify-between mb-1">
                    <span>Customer:</span>
                    <span>{customer.name}</span>
                  </div>
                )}
              </div>

              {/* Items */}
              <div className="border-b border-dashed border-gray-300 pb-4 mb-4">
                {items.map((item, index) => (
                  <div key={index} className="flex justify-between items-start mb-2 text-sm">
                    <div className="flex-1">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-gray-500">
                        SKU: {item.sku} × {item.quantity}
                      </div>
                    </div>
                    <div className="font-bold ml-2">
                      {formatCurrency(item.price * item.quantity)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="mb-4 text-sm">
                <div className="flex justify-between mb-1">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span>Tax:</span>
                  <span>{formatCurrency(tax)}</span>
                </div>
                {loyaltyPointsUsed > 0 && (
                  <div className="flex justify-between mb-1 text-green-600">
                    <span>Loyalty Discount:</span>
                    <span>-{formatCurrency(loyaltyPointsUsed * 0.01)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t border-gray-300 pt-2">
                  <span>Total Paid:</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Payment Info */}
              <div className="border-t border-dashed border-gray-300 pt-4 mb-4 text-sm">
                <div className="flex justify-between mb-1">
                  <span>Payment Method:</span>
                  <span className="capitalize">{payment.paymentMethod}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span>Transaction ID:</span>
                  <span className="font-mono text-xs">{payment.transactionId}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span>Auth Code:</span>
                  <span className="font-mono">{payment.authCode}</span>
                </div>
                {payment.cardLast4 && (
                  <div className="flex justify-between mb-1">
                    <span>Card:</span>
                    <span>****{payment.cardLast4}</span>
                  </div>
                )}
                {payment.change > 0 && (
                  <div className="flex justify-between mb-1">
                    <span>Change Given:</span>
                    <span>{formatCurrency(payment.change)}</span>
                  </div>
                )}
              </div>

              {/* Loyalty Info */}
              {customer && loyaltyPointsEarned > 0 && (
                <div className="bg-blue-50 rounded-lg p-3 mb-4">
                  <div className="font-bold text-blue-800 mb-2 text-center">🎉 Loyalty Rewards</div>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Points Earned:</span>
                      <span className="font-bold text-green-600">+{loyaltyPointsEarned}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Points:</span>
                      <span className="font-bold">{customer.loyaltyPoints + loyaltyPointsEarned}</span>
                    </div>
                    <div className="text-xs text-gray-600 text-center mt-2">
                      Next reward at {Math.ceil((customer.loyaltyPoints + loyaltyPointsEarned) / 100) * 100} points!
                    </div>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="text-center border-t border-dashed border-gray-300 pt-4 text-xs text-gray-600">
                <div className="font-bold mb-2">Thank you for shopping with FAREDEAL!</div>
                <div className="space-y-1">
                  <div>Return Policy: 30 days with receipt</div>
                  <div>Customer Service: support@faredeal.com</div>
                  <div>Follow us: @faredeal</div>
                </div>
                <div className="mt-3 text-xs text-gray-400">
                  Receipt generated on {new Date().toLocaleString()}
                </div>
              </div>
            </div>

            {/* Delivery Options */}
            <div className="bg-gray-50 rounded-xl p-6">
              <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
                <FiShare2 className="h-5 w-5 mr-2 text-blue-600" />
                Share Your Receipt
              </h4>

              {/* Delivery Method Selection */}
              <div className="flex space-x-4 mb-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="deliveryMethod"
                    value="email"
                    checked={deliveryMethod === 'email'}
                    onChange={(e) => setDeliveryMethod(e.target.value)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-700">📧 Email</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="deliveryMethod"
                    value="sms"
                    checked={deliveryMethod === 'sms'}
                    onChange={(e) => setDeliveryMethod(e.target.value)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-700">📱 SMS</span>
                </label>
              </div>

              {/* Email Input */}
              {deliveryMethod === 'email' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="flex">
                    <input
                      type="email"
                      value={emailAddress}
                      onChange={(e) => setEmailAddress(e.target.value)}
                      placeholder={customer?.email || "your@email.com"}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={handleSendReceipt}
                      disabled={sending}
                      className="px-4 py-2 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {sending ? (
                        <FiRefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <FiMail className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* SMS Input */}
              {deliveryMethod === 'sms' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <div className="flex">
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder={customer?.phone || "+1 (555) 123-4567"}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={handleSendReceipt}
                      disabled={sending}
                      className="px-4 py-2 bg-green-600 text-white rounded-r-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {sending ? (
                        <FiRefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <FiMessageSquare className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={handleDownloadPDF}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  <FiDownload className="h-4 w-4 mr-2" />
                  Download PDF
                </button>
                
                <button
                  onClick={() => window.print()}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  <FiPrinter className="h-4 w-4 mr-2" />
                  Print
                </button>
                
                <button
                  onClick={handleShareReceipt}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <FiShare2 className="h-4 w-4 mr-2" />
                  Share
                </button>
              </div>

              {/* Additional Info */}
              <div className="mt-4 text-xs text-gray-500 text-center">
                <div className="flex items-center justify-center space-x-4">
                  <span className="flex items-center">
                    <FiShield className="h-3 w-3 mr-1" />
                    Secure Delivery
                  </span>
                  <span className="flex items-center">
                    <FiClock className="h-3 w-3 mr-1" />
                    Instant Receipt
                  </span>
                  <span className="flex items-center">
                    <FiZap className="h-3 w-3 mr-1" />
                    Eco-Friendly
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DigitalReceipt;
