// ===================================================
// 🧾 RECEIPT COMPONENT
// Professional receipt with print, email, SMS, and PDF export
// ===================================================

import React, { useRef } from 'react';
import { FiPrinter, FiMail, FiDownload, FiX, FiMessageSquare, FiShare2, FiCopy } from 'react-icons/fi';
import { QRCodeCanvas } from 'qrcode.react';
import { toast } from 'react-toastify';
import transactionService from '../services/transactionService';
import receiptGeneratorService from '../services/receiptGeneratorService';
import useSupermarketBranding from '../hooks/useSupermarketBranding';

const Receipt = ({ transaction, receiptData, onClose, supermarketBranding }) => {
  const receiptRef = useRef();
  const loadedBranding = useSupermarketBranding();

  // Use branding or fallback to defaults
  const branding = supermarketBranding || loadedBranding;
  const storeName = branding?.name || 'Your Supermarket';
  const storeLocation = receiptData?.receipt?.location || '';
  const storeType = branding?.typeLabel || 'Store';

  // Invoice vs. receipt: a fully paid sale is a RECEIPT; anything with a
  // balance still owed (unpaid/partial service drop-off, etc.) is an INVOICE.
  const isInvoice = receiptData?.paymentStatus && receiptData.paymentStatus !== 'paid';
  const docLabel = isInvoice ? 'Invoice' : 'Receipt';
  const receiptQrValue = branding?.publicWebsiteUrl || window.location.origin;
  const receiptProofUrl = receiptData?.id && !receiptData?.pendingSync
    ? `${window.location.origin}/invoice/${encodeURIComponent(receiptData.id)}`
    : null;

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
          <title>${docLabel} - ${receiptData.receiptNumber}</title>
          <style>
            @media print {
              @page { 
                size: 80mm 297mm; /* Thermal printer size */
                margin: 0;
              }
              body { margin: 10mm; }
            }
            body {
              font-family: Georgia, 'Times New Roman', serif;
              font-size: 12px;
              line-height: 1.45;
              color: #283044;
              background: #f5f2e9;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            body > div { max-width: 70mm; margin: 0 auto; padding: 8mm 6mm; background: #fffdf8; }
            .receipt-header {
              color: #fffdf8;
              background: #312e81;
              border: 0;
              border-bottom: 3px solid #c4a052;
              padding: 12px 8px;
              margin: -8mm -6mm 8mm;
            }
            .receipt-header .text-gray-600 { color: #e7e5d5 !important; }
            .receipt-header .text-2xl, .receipt-header .text-3xl { color: #fffdf8; font-family: Georgia, 'Times New Roman', serif; }
            .receipt-store-logo { border: 2px solid #e0c476; border-radius: 50%; }
            .receipt-row { border-bottom: 1px dotted #d6c79f; }
            .receipt-item { border-color: #e8e1d0; padding: 5px 4px; }
            .receipt-item:nth-child(even) { background: #faf8f1; }
            .receipt-qr-block { border: 1px solid #c4a052; background: #faf8f1; padding: 8px; break-inside: avoid; }
            .receipt-qr-caption { color: #312e81 !important; font-weight: bold; }
            .receipt-total {
              color: #fffdf8;
              background: #312e81;
              border: 0;
              border-radius: 4px;
              padding: 9px 7px;
              margin-top: 8px;
            }
            .receipt-total span { color: #fffdf8 !important; }
            .receipt-footer {
              color: #312e81;
              border-top: 2px solid #c4a052;
              background: #faf8f1;
              padding: 10px 5px;
            }
            .receipt-logo {
              font-size: 24px;
              font-weight: bold;
            }
            .receipt-store-logo {
              max-width: 60px;
              max-height: 60px;
              display: block;
              margin: 0 auto 8px auto;
              object-fit: cover;
            }
            .receipt-row { display: flex; justify-content: space-between; gap: 8px; padding: 3px 0; }
            .receipt-header, .receipt-footer { text-align: center; }
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
  const handleDownloadPDF = async () => {
    try {
      const items = receiptData.receipt.items || [];
      await receiptGeneratorService.downloadPDFReceipt({
        id: receiptData.id,
        saleNumber: receiptData.receiptNumber,
        transactionId: receiptData.transactionId,
        websiteUrl: receiptQrValue,
        proofUrl: receiptProofUrl,
        createdAt: receiptData.timestamp,
        items: items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.selling_price || item.price || 0
        })),
        subtotal: receiptData.receipt.subtotal,
        tax: receiptData.receipt.tax,
        total: receiptData.receipt.total,
        paymentMethod: receiptData.paymentMethod,
        cashier: receiptData.receipt.cashier,
        paymentStatus: receiptData.paymentStatus,
        amountPaid: receiptData.amountPaid,
        balanceDue: receiptData.balanceDue,
        dueDate: receiptData.dueDate,
        jobStatus: receiptData.jobStatus
      });
      toast.success('📥 PDF downloaded!');
    } catch (error) {
      console.error('PDF download error:', error);
      toast.error('❌ Failed to download PDF');
    }
  };

  // ===================================================
  // EMAIL RECEIPT
  // ===================================================
  const handleEmail = () => {
    const subject = `${docLabel} ${receiptData.receiptNumber} - ${storeName}`;
    const body = `
Thank you for shopping at ${storeName}! 🇺🇬

${docLabel} Number: ${receiptData.receiptNumber}
${receiptProofUrl ? `Verify / track: ${receiptProofUrl}\n` : ''}
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
${isInvoice ? `\nAmount Paid: ${formatCurrency(receiptData.amountPaid)}\nBalance Due: ${formatCurrency(receiptData.balanceDue)}\n` : ''}
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
    const smsText = `${storeName} 🇺🇬\n${docLabel}: ${receiptData.receiptNumber}\nTotal: ${formatCurrency(receiptData.receipt.total)}${isInvoice ? `\nBalance Due: ${formatCurrency(receiptData.balanceDue)}` : ''}\nDate: ${new Date(receiptData.timestamp).toLocaleDateString('en-UG')}\nWebale nyo!`;
    
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
    const whatsappText = `🇺🇬 *${storeName.toUpperCase()} - ${docLabel.toUpperCase()}*\n\n📄 *${docLabel}:* ${receiptData.receiptNumber}\n📅 *Date:* ${new Date(receiptData.timestamp).toLocaleDateString('en-UG')}\n⏰ *Time:* ${new Date(receiptData.timestamp).toLocaleTimeString('en-UG')}\n\n*ITEMS:*\n${receiptData.receipt.items.map(item =>
      `• ${item.name} x${item.quantity} - ${formatCurrency(item.quantity * (item.selling_price || item.price))}`
    ).join('\n')}\n\n💰 *Subtotal:* ${formatCurrency(receiptData.receipt.subtotal)}\n📊 *VAT (18%):* ${formatCurrency(receiptData.receipt.tax)}\n✅ *Total:* ${formatCurrency(receiptData.receipt.total)}\n\n💳 *Payment:* ${receiptData.paymentMethod}${isInvoice ? `\n⚠️ *Balance Due:* ${formatCurrency(receiptData.balanceDue)}` : ''}\n\n*Webale nyo!* 🙏\nThank you for shopping with us!`;
    
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

${docLabel}: ${receiptData.receiptNumber}
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
${isInvoice ? `
Amount Paid:     ${formatCurrency(receiptData.amountPaid)}
BALANCE DUE:     ${formatCurrency(receiptData.balanceDue)}
` : ''}
Payment Method: ${receiptData.paymentMethod}
Transaction ID: ${receiptData.transactionId}
${receiptProofUrl ? `Verify / track: ${receiptProofUrl}\n` : ''}

Webale nyo! (Thank you!)
Visit us again at ${storeName}

${receiptData?.receipt?.phone || branding?.phone ? `Support: ${receiptData?.receipt?.phone || branding?.phone}` : ''}
${branding?.publicWebsiteUrl || ''}
    `.trim();

    navigator.clipboard.writeText(receiptText);
    toast.success('📋 Receipt copied to clipboard!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#10251f]/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div role="dialog" aria-modal="true" aria-label={`${docLabel} ${receiptData.receiptNumber}`} className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[1.75rem] border border-[#e8dfcc] bg-[#fbfaf6] shadow-[0_24px_80px_rgba(12,30,25,0.35)] sm:rounded-[1.75rem]">
        
        {/* Header */}
        <div className={`relative flex items-center justify-between border-t-[5px] ${isInvoice ? 'border-[#c88636] bg-[#293b34]' : 'border-[#d9b66e] bg-[#173d32]'} px-5 py-4 text-white sm:px-7 sm:py-5`}>
          <div className="flex-1">
            <h2 className="flex items-center font-serif text-xl font-bold tracking-tight sm:text-3xl">
              🧾 {docLabel}{isInvoice ? ` (${receiptData.paymentStatus === 'partial' ? 'Partially Paid' : 'Unpaid'})` : ''}
            </h2>
            <p className="mt-1 font-mono text-xs tracking-wide text-[#e7e1d4] sm:text-sm">
              #{receiptData.receiptNumber}
            </p>
            {receiptData.pendingSync && (
              <p className="mt-1 text-xs md:text-sm font-semibold text-amber-100">
                📴 Recorded offline — a real receipt number is assigned once this syncs automatically.
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition-colors flex-shrink-0"
          >
            <FiX className="h-5 w-5 md:h-6 md:w-6" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 border-b border-[#e9e3d7] bg-[#f3f0e8] p-3 sm:grid-cols-4 sm:gap-2.5 sm:p-4">
          <button
            onClick={handlePrint}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#244b3d] bg-[#244b3d] px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#193a30] focus:outline-none focus:ring-2 focus:ring-[#c8a85c] focus:ring-offset-2"
          >
            <FiPrinter className="h-4 w-4" />
            <span>Print</span>
          </button>
          
          <button
            onClick={handleDownloadPDF}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#8b6d35] bg-[#8b6d35] px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#73582b] focus:outline-none focus:ring-2 focus:ring-[#c8a85c] focus:ring-offset-2"
          >
            <FiDownload className="h-4 w-4" />
            <span>Download</span>
          </button>
          
          <button
            onClick={handleEmail}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#9b493e] bg-[#9b493e] px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#823c33] focus:outline-none focus:ring-2 focus:ring-[#c8a85c] focus:ring-offset-2"
          >
            <FiMail className="h-4 w-4" />
            <span>Email</span>
          </button>
          
          <button
            onClick={handleWhatsApp}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#42734c] bg-[#42734c] px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#345d3d] focus:outline-none focus:ring-2 focus:ring-[#c8a85c] focus:ring-offset-2"
          >
            <FiShare2 className="h-4 w-4" />
            <span>WhatsApp</span>
          </button>
          
          <button
            onClick={handleSMS}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#ad7920] bg-[#ad7920] px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#926619] focus:outline-none focus:ring-2 focus:ring-[#c8a85c] focus:ring-offset-2"
          >
            <FiMessageSquare className="h-4 w-4" />
            <span>SMS</span>
          </button>
          
          <button
            onClick={handleCopyText}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#56615f] bg-[#56615f] px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#424c4a] focus:outline-none focus:ring-2 focus:ring-[#c8a85c] focus:ring-offset-2"
          >
            <FiCopy className="h-4 w-4" />
            <span>Copy</span>
          </button>

          {receiptData.id && navigator.share && (
            <button
              onClick={async () => {
                try {
                  await navigator.share({
                    title: `${docLabel} ${receiptData.receiptNumber}`,
                    text: `${docLabel} ${receiptData.receiptNumber} — Total ${formatCurrency(receiptData.receipt.total)}`,
                    url: `${window.location.origin}/invoice/${receiptData.id}`
                  });
                } catch (err) {
                  // User cancelled the native share sheet — nothing to report.
                }
              }}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#454d83] bg-[#454d83] px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#383f70] focus:outline-none focus:ring-2 focus:ring-[#c8a85c] focus:ring-offset-2"
            >
              <FiShare2 className="h-4 w-4" />
              <span>Share</span>
            </button>
          )}
        </div>

        {/* Receipt Content */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top,_#f5f0e4,_#f8f7f2_58%)] p-3 sm:p-6">
          <div ref={receiptRef} className="mx-auto max-w-lg rounded-2xl border border-[#e8dfcc] bg-[#fffefa] px-4 py-5 text-xs text-[#34413b] shadow-[0_8px_30px_rgba(56,47,28,0.08)] sm:px-8 sm:py-7 sm:text-sm">
            {/* Receipt Header */}
            <div className="receipt-header mb-4 border-b border-dashed border-[#cfc4ab] pb-4 text-center sm:mb-5 sm:pb-5">
              {branding?.logoUrl && (
                <img
                  src={branding.logoUrl}
                  alt={storeName}
                  className="receipt-store-logo w-14 h-14 md:w-16 md:h-16 object-cover rounded-xl mx-auto mb-2 shadow-md"
                />
              )}
              <div className="mb-1 font-serif text-2xl font-bold tracking-tight text-[#173d32] sm:text-3xl">{storeName}</div>
              <div className="text-xs md:text-sm text-gray-600 mt-2 space-y-1">
                {storeLocation && <p>{storeLocation}</p>}
                {(receiptData?.receipt?.address || branding?.address) && <p>{receiptData?.receipt?.address || branding?.address}</p>}
                {(receiptData?.receipt?.phone || branding?.phone) && <p>Tel: {receiptData?.receipt?.phone || branding?.phone}</p>}
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
              {receiptData.amountPaid != null && (
                <>
                  <div className="receipt-row flex justify-between">
                    <span>Amount Paid:</span>
                    <span className="text-right">{formatCurrency(receiptData.amountPaid)}</span>
                  </div>
                  {receiptData.changeGiven > 0 && (
                    <div className="receipt-row flex justify-between font-semibold">
                      <span>Change:</span>
                      <span className="text-right">{formatCurrency(receiptData.changeGiven)}</span>
                    </div>
                  )}
                </>
              )}
              {isInvoice && (
                <div className="mt-2 p-2 rounded-lg bg-amber-50 border-2 border-amber-300">
                  <div className="receipt-row flex justify-between font-bold text-amber-900">
                    <span>⚠️ Balance Due:</span>
                    <span className="text-right">{formatCurrency(receiptData.balanceDue)}</span>
                  </div>
                </div>
              )}
              <div className={`receipt-qr-block mt-4 grid gap-3 rounded-2xl border border-[#ddcfaa] bg-[#f8f4e9] p-3 text-center ${receiptProofUrl ? 'sm:grid-cols-2 sm:p-4' : ''}`}>
                {receiptProofUrl && (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-[#e5d9ba] bg-[#fffefa] p-3">
                    <QRCodeCanvas value={receiptProofUrl} size={132} level="M" includeMargin />
                    <p className="receipt-qr-caption text-xs font-semibold text-[#354840]">
                      Verify receipt or track service
                    </p>
                  </div>
                )}
                <div className="flex flex-col items-center gap-2 rounded-xl border border-[#e5d9ba] bg-[#fffefa] p-3">
                  <QRCodeCanvas value={receiptQrValue} size={132} level="M" includeMargin />
                  <p className="receipt-qr-caption text-xs font-semibold text-[#354840]">
                    Visit {storeName}
                  </p>
                </div>
              </div>
              {receiptData.jobStatus && (
                <div className="receipt-row flex justify-between">
                  <span className="font-semibold">Job Status:</span>
                <span className="rounded-full bg-[#f3ead2] px-2.5 py-1 text-right text-[11px] font-bold capitalize text-[#755b22]">{receiptData.jobStatus.replace(/_/g, ' ')}</span>
                </div>
              )}
              <div className="receipt-row flex justify-between text-xs text-gray-500">
                <span>Transaction ID:</span>
                <span className="max-w-[65%] break-all text-right font-mono text-[10px] text-gray-500 sm:text-xs">{receiptData.transactionId}</span>
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
                {branding?.website && <p>{branding.website}</p>}
                {(receiptData?.receipt?.supportEmail || branding?.email) && <p>{receiptData?.receipt?.supportEmail || branding.email}</p>}
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
