// ===================================================
// 🧾 RECEIPT COMPONENT
// Professional receipt with print, email, SMS, and PDF export
// ===================================================

import React, { useRef } from 'react';
import { FiPrinter, FiMail, FiDownload, FiX, FiMessageSquare, FiShare2, FiCopy } from 'react-icons/fi';
import { toast } from 'react-toastify';
import transactionService from '../services/transactionService';
import useSupermarketBranding from '../hooks/useSupermarketBranding';

const Receipt = ({ transaction, receiptData, onClose, supermarketBranding }) => {
  const receiptRef = useRef();
  const loadedBranding = useSupermarketBranding();

  // Use branding or fallback to defaults
  const branding = supermarketBranding || loadedBranding;
  const storeName = branding?.name || 'Your Supermarket';
  const storeLocation = receiptData?.receipt?.location || 'Kampala Main Branch';
  const storeType = branding?.typeLabel || 'Store';

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-UG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // ===================================================
  // PRINT RECEIPT
  // ===================================================
  const handlePrint = async () => {
    try {
      // Log print action
      await transactionService.logReceiptPrint(
        transaction?.id,
        receiptData?.receiptNumber,
        'customer_copy',
        'thermal'
      );

      // Get receipt content
      const printContent = receiptRef.current;
      const printWindow = window.open('', '_blank', 'width=800,height=600');
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Receipt - ${receiptData.receiptNumber}</title>
          <style>
            @media print {
              @page { 
                size: 80mm 297mm; /* Thermal printer size */
                margin: 0;
              }
              body { margin: 10mm; }
            }
            body {
              font-family: 'Courier New', monospace;
              font-size: 12px;
              line-height: 1.4;
              color: #000;
            }
            .receipt-header {
              text-align: center;
              border-bottom: 2px dashed #000;
              padding-bottom: 10px;
              margin-bottom: 10px;
            }
            .receipt-logo {
              font-size: 24px;
              font-weight: bold;
            }
            .receipt-row {
              display: flex;
              justify-content: space-between;
              padding: 2px 0;
            }
            .receipt-item {
              border-bottom: 1px dashed #ccc;
              padding: 5px 0;
            }
            .receipt-total {
              font-weight: bold;
              font-size: 14px;
              border-top: 2px solid #000;
              padding-top: 10px;
              margin-top: 10px;
            }
            .receipt-footer {
              text-align: center;
              border-top: 2px dashed #000;
              padding-top: 10px;
              margin-top: 15px;
              font-size: 10px;
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => window.close(), 100);
            }
          </script>
        </body>
        </html>
      `);
      
      printWindow.document.close();
      toast.success('🖨️ Printing receipt...');
    } catch (error) {
      console.error('Print error:', error);
      toast.error('❌ Failed to print receipt');
    }
  };

  // ===================================================
  // DOWNLOAD AS PDF
  // ===================================================
  const handleDownloadPDF = () => {
    try {
      // Create printable HTML
      const printContent = receiptRef.current.innerHTML;
      const blob = new Blob([`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Receipt - ${receiptData.receiptNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; max-width: 400px; margin: 0 auto; }
            .receipt-header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
            .receipt-row { display: flex; justify-content: space-between; padding: 3px 0; }
            .receipt-total { font-weight: bold; border-top: 2px solid #000; padding-top: 10px; margin-top: 10px; }
            .receipt-footer { text-align: center; border-top: 2px dashed #000; padding-top: 10px; margin-top: 15px; font-size: 11px; }
          </style>
        </head>
        <body>${printContent}</body>
        </html>
      `], { type: 'text/html' });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Receipt-${receiptData.receiptNumber}.html`;
      link.click();
      
      URL.revokeObjectURL(url);
      toast.success('📥 Receipt downloaded!');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('❌ Failed to download receipt');
    }
  };

  // ===================================================
  // EMAIL RECEIPT
  // ===================================================
  const handleEmail = () => {
    const subject = `Receipt ${receiptData.receiptNumber} - ${storeName}`;
    const body = `
Thank you for shopping at ${storeName}! 🇺🇬

Receipt Number: ${receiptData.receiptNumber}
Date: ${formatDate(receiptData.timestamp)}
Cashier: ${receiptData.receipt.cashier}

Items:
${receiptData.receipt.items.map(item => 
  `${item.name} x ${item.quantity} - ${formatCurrency(item.quantity * (item.selling_price || item.price))}`
).join('\n')}

Subtotal: ${formatCurrency(receiptData.receipt.subtotal)}
VAT (18%): ${formatCurrency(receiptData.receipt.tax)}
Total: ${formatCurrency(receiptData.receipt.total)}

Payment Method: ${receiptData.paymentMethod}

Webale nyo! (Thank you!)
Visit us again at ${storeName}
    `.trim();

    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
    toast.info('📧 Opening email client...');
  };

  // ===================================================
  // SMS RECEIPT
  // ===================================================
  const handleSMS = () => {
    const smsText = `${storeName} 🇺🇬\nReceipt: ${receiptData.receiptNumber}\nTotal: ${formatCurrency(receiptData.receipt.total)}\nDate: ${new Date(receiptData.timestamp).toLocaleDateString('en-UG')}\nWebale nyo!`;
    
    // For mobile devices
    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      window.location.href = `sms:?body=${encodeURIComponent(smsText)}`;
    } else {
      // Copy to clipboard for desktop
      navigator.clipboard.writeText(smsText);
      toast.success('📱 SMS text copied to clipboard!');
    }
  };

  // ===================================================
  // SHARE VIA WHATSAPP
  // ===================================================
  const handleWhatsApp = () => {
    const whatsappText = `🇺🇬 *${storeName.toUpperCase()} - RECEIPT*\n\n📄 *Receipt:* ${receiptData.receiptNumber}\n📅 *Date:* ${new Date(receiptData.timestamp).toLocaleDateString('en-UG')}\n⏰ *Time:* ${new Date(receiptData.timestamp).toLocaleTimeString('en-UG')}\n\n*ITEMS:*\n${receiptData.receipt.items.map(item => 
      `• ${item.name} x${item.quantity} - ${formatCurrency(item.quantity * (item.selling_price || item.price))}`
    ).join('\n')}\n\n💰 *Subtotal:* ${formatCurrency(receiptData.receipt.subtotal)}\n📊 *VAT (18%):* ${formatCurrency(receiptData.receipt.tax)}\n✅ *Total:* ${formatCurrency(receiptData.receipt.total)}\n\n💳 *Payment:* ${receiptData.paymentMethod}\n\n*Webale nyo!* 🙏\nThank you for shopping with us!`;
    
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;
    window.open(whatsappUrl, '_blank');
    toast.success('📱 Opening WhatsApp...');
  };

  // ===================================================
  // COPY RECEIPT TEXT
  // ===================================================
  const handleCopyText = () => {
    const receiptText = `
════════════════════════════════
  ${storeName.toUpperCase()} ${storeType.toUpperCase()}
════════════════════════════════

Receipt: ${receiptData.receiptNumber}
Date: ${formatDate(receiptData.timestamp)}
Cashier: ${receiptData.receipt.cashier}
Register: ${receiptData.receipt.register}

────────────────────────────────
ITEMS
────────────────────────────────
${receiptData.receipt.items.map(item => {
  const itemPrice = item.selling_price || item.price;
  return `${item.name}\n  ${item.quantity} x ${formatCurrency(itemPrice)} = ${formatCurrency(item.quantity * itemPrice)}`;
}).join('\n')}

────────────────────────────────
Subtotal:        ${formatCurrency(receiptData.receipt.subtotal)}
VAT (18%):       ${formatCurrency(receiptData.receipt.tax)}
════════════════════════════════
TOTAL:           ${formatCurrency(receiptData.receipt.total)}
════════════════════════════════

Payment Method: ${receiptData.paymentMethod}
Transaction ID: ${receiptData.transactionId}

Webale nyo! (Thank you!)
Visit us again at FAREDEAL Uganda

Support: +256-700-123456
www.faredeal.ug
    `.trim();

    navigator.clipboard.writeText(receiptText);
    toast.success('📋 Receipt copied to clipboard!');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4">
      <div className="bg-white rounded-lg md:rounded-2xl shadow-2xl max-w-2xl w-full max-h-[95vh] md:max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-3 md:p-6 flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-lg md:text-2xl font-bold flex items-center">
              🧾 Receipt
            </h2>
            <p className="text-green-100 mt-1 text-xs md:text-sm">
              #{receiptData.receiptNumber}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition-colors flex-shrink-0"
          >
            <FiX className="h-5 w-5 md:h-6 md:w-6" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-gray-50 border-b grid grid-cols-2 md:grid-cols-4 gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            <FiPrinter className="h-4 w-4" />
            <span>Print</span>
          </button>
          
          <button
            onClick={handleDownloadPDF}
            className="flex items-center justify-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
          >
            <FiDownload className="h-4 w-4" />
            <span>Download</span>
          </button>
          
          <button
            onClick={handleEmail}
            className="flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
          >
            <FiMail className="h-4 w-4" />
            <span>Email</span>
          </button>
          
          <button
            onClick={handleWhatsApp}
            className="flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
          >
            <FiShare2 className="h-4 w-4" />
            <span>WhatsApp</span>
          </button>
          
          <button
            onClick={handleSMS}
            className="flex items-center justify-center space-x-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm"
          >
            <FiMessageSquare className="h-4 w-4" />
            <span>SMS</span>
          </button>
          
          <button
            onClick={handleCopyText}
            className="flex items-center justify-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
          >
            <FiCopy className="h-4 w-4" />
            <span>Copy</span>
          </button>
        </div>

        {/* Receipt Content */}
        <div className="flex-1 overflow-y-auto p-3 md:p-6">
          <div ref={receiptRef} className="max-w-md mx-auto bg-white text-xs md:text-sm">
            {/* Receipt Header */}
            <div className="receipt-header text-center border-b-2 border-dashed border-gray-300 pb-3 md:pb-4 mb-3 md:mb-4">
              <div className="text-2xl md:text-3xl font-bold mb-1 md:mb-2">{storeName}</div>
              <div className="text-xs md:text-sm text-gray-600 mt-2 space-y-1">
                <p>{storeLocation}</p>
                <p>{receiptData?.receipt?.address || 'Plot 123, Kampala Road'}</p>
                <p>Tel: {receiptData?.receipt?.phone || '+256-700-123456'}</p>
                <p>TIN: 1234567890</p>
              </div>
            </div>

            {/* Transaction Details */}
            <div className="mb-3 md:mb-4 text-xs md:text-sm space-y-1">
              <div className="receipt-row flex justify-between">
                <span className="font-semibold">Receipt No:</span>
                <span className="text-right">{receiptData.receiptNumber}</span>
              </div>
              <div className="receipt-row flex justify-between">
                <span className="font-semibold">Date:</span>
                <span className="text-right">{new Date(receiptData.timestamp).toLocaleDateString('en-UG')}</span>
              </div>
              <div className="receipt-row flex justify-between">
                <span className="font-semibold">Time:</span>
                <span className="text-right">{new Date(receiptData.timestamp).toLocaleTimeString('en-UG')}</span>
              </div>
              <div className="receipt-row flex justify-between">
                <span className="font-semibold">Cashier:</span>
                <span className="text-right">{receiptData.receipt.cashier}</span>
              </div>
              <div className="receipt-row flex justify-between">
                <span className="font-semibold">Register:</span>
                <span className="text-right">{receiptData.receipt.register}</span>
              </div>
            </div>

            {/* Items */}
            <div className="border-t-2 border-dashed border-gray-300 pt-3 md:pt-4 mb-3 md:mb-4">
              <div className="font-bold mb-2 text-center text-xs md:text-sm">ITEMS PURCHASED</div>
              {receiptData.receipt.items.map((item, index) => {
                const itemPrice = item.selling_price || item.price;
                const lineTotal = item.quantity * itemPrice;
                return (
                  <div key={index} className="receipt-item mb-2 md:mb-3 pb-2 border-b border-dashed border-gray-200">
                    <div className="font-semibold text-xs md:text-sm line-clamp-2">{item.name}</div>
                    <div className="receipt-row flex justify-between text-xs md:text-sm text-gray-600">
                      <span>{item.quantity} x {formatCurrency(itemPrice)}</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(lineTotal)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Totals */}
            <div className="border-t-2 border-gray-300 pt-3 md:pt-4 space-y-1 md:space-y-2">
              <div className="receipt-row flex justify-between text-xs md:text-sm">
                <span>Subtotal:</span>
                <span>{formatCurrency(receiptData.receipt.subtotal)}</span>
              </div>
              <div className="receipt-row flex justify-between text-xs md:text-sm">
                <span>VAT (18%):</span>
                <span>{formatCurrency(receiptData.receipt.tax)}</span>
              </div>
              <div className="receipt-total flex justify-between text-base md:text-lg font-bold border-t-2 border-gray-800 pt-2">
                <span>TOTAL:</span>
                <span>{formatCurrency(receiptData.receipt.total)}</span>
              </div>
            </div>

            {/* Payment Info */}
            <div className="mt-3 md:mt-4 border-t border-dashed border-gray-300 pt-2 md:pt-3 space-y-1 text-xs md:text-sm">
              <div className="receipt-row flex justify-between">
                <span className="font-semibold">Payment Method:</span>
                <span className="text-right">{receiptData.paymentMethod}</span>
              </div>
              {receiptData.amountPaid && (
                <>
                  <div className="receipt-row flex justify-between">
                    <span>Amount Paid:</span>
                    <span className="text-right">{formatCurrency(receiptData.amount)}</span>
                  </div>
                  {receiptData.changeGiven > 0 && (
                    <div className="receipt-row flex justify-between font-semibold">
                      <span>Change:</span>
                      <span className="text-right">{formatCurrency(receiptData.changeGiven)}</span>
                    </div>
                  )}
                </>
              )}
              <div className="receipt-row flex justify-between text-xs text-gray-500">
                <span>Transaction ID:</span>
                <span className="text-right text-xs truncate">{receiptData.transactionId}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="receipt-footer text-center border-t-2 border-dashed border-gray-300 pt-3 md:pt-4 mt-4 md:mt-6 text-xs md:text-sm">
              <p className="font-bold text-base md:text-lg mb-1 md:mb-2">Webale nyo! 🙏</p>
              <p className="text-gray-600 text-xs md:text-sm">Thank you for shopping with us!</p>
              <p className="text-gray-600 text-xs md:text-sm mt-2">Visit us again at {storeName}</p>
              <p className="text-xs text-gray-500 mt-2 md:mt-3">
                VAT Inclusive • All prices in UGX
              </p>
              <p className="text-xs text-gray-500">
                Exchange & Return within 7 days with receipt
              </p>
              <div className="mt-3 md:mt-4 text-xs text-gray-400 space-y-1">
                <p>{receiptData?.receipt?.website || 'www.' + storeName.toLowerCase().replace(/\s+/g, '') + '.ug'}</p>
                <p>{receiptData?.receipt?.supportEmail || 'support@' + storeName.toLowerCase().replace(/\s+/g, '') + '.ug'}</p>
              </div>
              <div className="mt-3 md:mt-4 text-xl md:text-2xl">
                🇺🇬
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Receipt;
