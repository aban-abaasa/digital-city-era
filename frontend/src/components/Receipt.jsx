// ===================================================
// 🧾 RECEIPT COMPONENT
// Classic paper receipt with print, email, SMS, and PDF export.
// Actions are one slim row (Print / Download / Share); the rest of the
// sharing options and the secondary sections fold away to keep the paper
// front and centre on a phone.
// ===================================================

import React, { useRef, useState } from 'react';
import { FiPrinter, FiMail, FiDownload, FiX, FiMessageSquare, FiShare2, FiCopy, FiChevronDown } from 'react-icons/fi';
import { QRCodeCanvas } from 'qrcode.react';
import { toast } from 'react-toastify';
import transactionService from '../services/transactionService';
import receiptGeneratorService from '../services/receiptGeneratorService';
import useSupermarketBranding from '../hooks/useSupermarketBranding';
import { formatPaymentMethod } from '../utils/paymentMethod';
import './Receipt.css';
// The same stylesheet, as a string, for the print window.
import receiptCss from './Receipt.css?inline';
import { useBackLayer } from '../hooks/useBackLayer';

const ACTION_BTN = 'flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c8a85c] focus-visible:ring-offset-1';
const SHARE_TILE = 'flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border border-[#ddd2b6] bg-white px-1 py-2 text-[11px] font-semibold text-[#173d32] transition hover:bg-[#f3ecd8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c8a85c]';

// A paper-receipt section whose body folds away. The body stays in the DOM
// (hidden by CSS only) so printing can always show it in full.
const Section = ({ id, title, meta, open, onToggle, children }) => (
  <section className={`rc-section${open ? '' : ' is-collapsed'}`}>
    <button type="button" className="rc-section-head" onClick={onToggle} aria-expanded={open} aria-controls={id}>
      <span className="rc-section-title">{title}</span>
      {meta && <span className="rc-section-meta">{meta}</span>}
      <FiChevronDown className="rc-chev" aria-hidden="true" data-no-print />
    </button>
    <div className="rc-section-body" id={id}>
      <div className="rc-section-inner">{children}</div>
    </div>
  </section>
);

const Receipt = ({ transaction, receiptData, onClose, supermarketBranding }) => {
  useBackLayer(true, onClose);
  const receiptRef = useRef();
  const loadedBranding = useSupermarketBranding();

  // Use branding or fallback to defaults
  const branding = supermarketBranding || loadedBranding;
  const storeName = branding?.name || 'Your Supermarket';
  const storeLocation = receiptData?.receipt?.location || '';
  const storeType = branding?.typeLabel || 'Store';
  const storeAddress = receiptData?.receipt?.address || branding?.address;
  const storePhone = receiptData?.receipt?.phone || branding?.phone;
  const supportEmail = receiptData?.receipt?.supportEmail || branding?.email;
  // 'ican' / 'cash_ugx' ids and display names alike, as one readable label ('' if none was recorded).
  const paymentLabel = formatPaymentMethod(receiptData?.paymentMethod);

  // Invoice vs. receipt: a fully paid sale is a RECEIPT; anything with a
  // balance still owed (unpaid/partial service drop-off, etc.) is an INVOICE.
  const isInvoice = receiptData?.paymentStatus && receiptData.paymentStatus !== 'paid';
  const docLabel = isInvoice ? 'Invoice' : 'Receipt';
  const receiptQrValue = branding?.publicWebsiteUrl || window.location.origin;
  const receiptProofUrl = receiptData?.id && !receiptData?.pendingSync
    ? `${window.location.origin}/invoice/${encodeURIComponent(receiptData.id)}`
    : null;

  // Everything people need is visible up front; the QR codes and transaction
  // id fold away, except on an invoice where the QR is how the job is tracked.
  const [shareOpen, setShareOpen] = useState(false);
  const [openSections, setOpenSections] = useState({ items: true, verify: Boolean(isInvoice) });
  const toggleSection = (key) => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  const items = receiptData?.receipt?.items || [];
  const canNativeShare = Boolean(receiptData?.id && navigator.share);

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

      // Print a copy of the paper rather than the live node: every section
      // expanded, no on-screen toggles, and QR canvases swapped for images
      // (a canvas is blank once serialized to HTML).
      const livePaper = receiptRef.current;
      const paper = livePaper.cloneNode(true);
      const liveCanvases = livePaper.querySelectorAll('canvas');
      paper.querySelectorAll('canvas').forEach((canvas, index) => {
        const img = document.createElement('img');
        img.src = liveCanvases[index].toDataURL('image/png');
        img.alt = 'QR code';
        canvas.replaceWith(img);
      });
      paper.querySelectorAll('.is-collapsed').forEach((el) => el.classList.remove('is-collapsed'));
      paper.querySelectorAll('[data-no-print]').forEach((el) => el.remove());

      const printWindow = window.open('', '_blank', 'width=800,height=600');

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${docLabel} - ${receiptData.receiptNumber}</title>
          <style>
            ${receiptCss}
            @page {
              size: 80mm 297mm; /* Thermal printer size */
              margin: 0;
            }
            html, body {
              margin: 0;
              background: #fff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            body { padding: 4mm 0; }
            .rc-paper { max-width: 76mm; padding: 2mm 5mm; font-size: 11px; filter: none; }
            .rc-paper::before, .rc-paper::after { display: none; }
            .rc-section-head { cursor: default; }
            .rc-section-body, .rc-chev { transition: none; }
          </style>
        </head>
        <body>
          ${paper.outerHTML}
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
        // The PDF service falls back to 'cash' for a missing method, which
        // would mislabel a wallet sale; say so honestly instead.
        paymentMethod: paymentLabel || 'Not recorded',
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

${paymentLabel ? `Payment Method: ${paymentLabel}` : ''}
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
    ).join('\n')}\n\n💰 *Subtotal:* ${formatCurrency(receiptData.receipt.subtotal)}\n📊 *VAT (18%):* ${formatCurrency(receiptData.receipt.tax)}\n✅ *Total:* ${formatCurrency(receiptData.receipt.total)}${paymentLabel ? `\n\n💳 *Payment:* ${paymentLabel}` : ''}${isInvoice ? `\n⚠️ *Balance Due:* ${formatCurrency(receiptData.balanceDue)}` : ''}\n\n*Webale nyo!* 🙏\nThank you for shopping with us!`;
    
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
${paymentLabel ? `Payment Method: ${paymentLabel}` : ''}
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

  // ===================================================
  // NATIVE SHARE SHEET
  // ===================================================
  const handleNativeShare = async () => {
    try {
      await navigator.share({
        title: `${docLabel} ${receiptData.receiptNumber}`,
        text: `${docLabel} ${receiptData.receiptNumber} — Total ${formatCurrency(receiptData.receipt.total)}`,
        url: `${window.location.origin}/invoice/${receiptData.id}`
      });
    } catch {
      // User cancelled the native share sheet — nothing to report.
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#10251f]/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div role="dialog" aria-modal="true" aria-label={`${docLabel} ${receiptData.receiptNumber}`} className="flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] border border-[#e8dfcc] bg-[#fbfaf6] shadow-[0_24px_80px_rgba(12,30,25,0.35)] sm:rounded-[1.75rem]">

        {/* Header */}
        <div className={`flex items-center justify-between gap-3 border-t-[5px] ${isInvoice ? 'border-[#c88636] bg-[#293b34]' : 'border-[#d9b66e] bg-[#173d32]'} px-4 py-3 text-white sm:px-6`}>
          <div className="min-w-0">
            <h2 className="font-serif text-lg font-bold leading-tight sm:text-2xl">
              {docLabel}
              {isInvoice && (
                <span className="ml-2 rounded-full bg-white/15 px-2 py-0.5 align-middle font-sans text-[11px] font-semibold">
                  {receiptData.paymentStatus === 'partial' ? 'Partially paid' : 'Unpaid'}
                </span>
              )}
            </h2>
            <p className="truncate font-mono text-xs tracking-wide text-[#e7e1d4]">
              #{receiptData.receiptNumber}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex-shrink-0 rounded-full p-2 text-white transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d9b66e]"
          >
            <FiX className="h-5 w-5 md:h-6 md:w-6" />
          </button>
        </div>

        {receiptData.pendingSync && (
          <p className="bg-amber-100 px-4 py-1.5 text-xs font-semibold text-amber-900 sm:px-6">
            📴 Recorded offline — a real receipt number is assigned once this syncs automatically.
          </p>
        )}

        {/* Actions: three buttons, the rest of the sharing options fold under Share */}
        <div className="border-b border-[#e3dac3] bg-[#f6f2e8]">
          <div className="flex items-center gap-2 px-3 py-2 sm:px-5">
            <button
              onClick={handlePrint}
              className={`${ACTION_BTN} border-[#173d32] bg-[#173d32] text-white hover:bg-[#10291f]`}
            >
              <FiPrinter className="h-4 w-4" />
              <span>Print</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              className={`${ACTION_BTN} border-[#d2c5a3] bg-white text-[#173d32] hover:bg-[#f3ecd8]`}
            >
              <FiDownload className="h-4 w-4" />
              <span>Download</span>
            </button>
            <button
              onClick={() => setShareOpen((open) => !open)}
              aria-expanded={shareOpen}
              aria-controls="receipt-share-options"
              className={`${ACTION_BTN} border-[#d2c5a3] bg-white text-[#173d32] hover:bg-[#f3ecd8]`}
            >
              <FiShare2 className="h-4 w-4" />
              <span>Share</span>
              <FiChevronDown className={`h-3.5 w-3.5 transition-transform ${shareOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {shareOpen && (
            <div id="receipt-share-options" className={`grid gap-1.5 px-3 pb-2.5 sm:px-5 ${canNativeShare ? 'grid-cols-5' : 'grid-cols-4'}`}>
              <button onClick={() => { handleWhatsApp(); setShareOpen(false); }} className={SHARE_TILE}>
                <FiShare2 className="h-4 w-4 text-[#42734c]" />
                <span>WhatsApp</span>
              </button>
              <button onClick={() => { handleEmail(); setShareOpen(false); }} className={SHARE_TILE}>
                <FiMail className="h-4 w-4 text-[#9b493e]" />
                <span>Email</span>
              </button>
              <button onClick={() => { handleSMS(); setShareOpen(false); }} className={SHARE_TILE}>
                <FiMessageSquare className="h-4 w-4 text-[#ad7920]" />
                <span>SMS</span>
              </button>
              <button onClick={() => { handleCopyText(); setShareOpen(false); }} className={SHARE_TILE}>
                <FiCopy className="h-4 w-4 text-[#56615f]" />
                <span>Copy</span>
              </button>
              {canNativeShare && (
                <button onClick={() => { handleNativeShare(); setShareOpen(false); }} className={SHARE_TILE}>
                  <FiShare2 className="h-4 w-4 text-[#454d83]" />
                  <span>More…</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Receipt paper */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#ece6d6] px-3 pb-[calc(1.75rem+env(safe-area-inset-bottom))] pt-6 sm:px-6">
          <div ref={receiptRef} className="rc-paper">
            {/* Store header */}
            <header className="rc-head">
              {branding?.logoUrl && <img src={branding.logoUrl} alt={storeName} className="rc-logo" />}
              <h3 className="rc-store">{storeName}</h3>
              {storeLocation && <p className="rc-sub">{storeLocation}</p>}
              {storeAddress && <p className="rc-sub">{storeAddress}</p>}
              {storePhone && <p className="rc-sub">Tel: {storePhone}</p>}
              <p className="rc-doc">— {docLabel} —</p>
            </header>

            <hr className="rc-rule" />

            {/* Transaction details */}
            <div>
              <div className="rc-row">
                <span className="rc-label">{docLabel} No:</span>
                <span className="rc-value">{receiptData.receiptNumber}</span>
              </div>
              <div className="rc-row">
                <span className="rc-label">Date:</span>
                <span className="rc-value">{new Date(receiptData.timestamp).toLocaleDateString('en-UG')}</span>
              </div>
              <div className="rc-row">
                <span className="rc-label">Time:</span>
                <span className="rc-value">{new Date(receiptData.timestamp).toLocaleTimeString('en-UG')}</span>
              </div>
              <div className="rc-row">
                <span className="rc-label">Cashier:</span>
                <span className="rc-value">{receiptData.receipt.cashier}</span>
              </div>
              <div className="rc-row">
                <span className="rc-label">Register:</span>
                <span className="rc-value">{receiptData.receipt.register}</span>
              </div>
            </div>

            <hr className="rc-rule" />

            {/* Items */}
            <Section
              id="receipt-items"
              title="Items Purchased"
              meta={`${items.length} ${items.length === 1 ? 'item' : 'items'}`}
              open={openSections.items}
              onToggle={() => toggleSection('items')}
            >
              {items.map((item, index) => {
                const itemPrice = item.selling_price || item.price;
                const lineTotal = item.quantity * itemPrice;
                return (
                  <div key={index} className="rc-item">
                    <div className="rc-item-name">{item.name}</div>
                    <div className="rc-item-line">
                      <span>{item.quantity} x {formatCurrency(itemPrice)}</span>
                      <strong>{formatCurrency(lineTotal)}</strong>
                    </div>
                  </div>
                );
              })}
            </Section>

            <hr className="rc-rule" />

            {/* Totals */}
            <div>
              <div className="rc-row">
                <span className="rc-label">Subtotal:</span>
                <span className="rc-value">{formatCurrency(receiptData.receipt.subtotal)}</span>
              </div>
              <div className="rc-row">
                <span className="rc-label">VAT (18%):</span>
                <span className="rc-value">{formatCurrency(receiptData.receipt.tax)}</span>
              </div>
              <div className="rc-total">
                <span>TOTAL</span>
                <span>{formatCurrency(receiptData.receipt.total)}</span>
              </div>
            </div>

            <hr className="rc-rule" />

            {/* Payment */}
            <div>
              {paymentLabel && (
                <div className="rc-row">
                  <span className="rc-label">Payment Method:</span>
                  <span className="rc-value">{paymentLabel}</span>
                </div>
              )}
              {receiptData.amountPaid != null && (
                <>
                  <div className="rc-row">
                    <span className="rc-label">Amount Paid:</span>
                    <span className="rc-value">{formatCurrency(receiptData.amountPaid)}</span>
                  </div>
                  {receiptData.changeGiven > 0 && (
                    <div className="rc-row">
                      <span className="rc-label">Change:</span>
                      <span className="rc-value">{formatCurrency(receiptData.changeGiven)}</span>
                    </div>
                  )}
                </>
              )}
              {isInvoice && (
                <div className="rc-due">
                  <span>⚠️ Balance Due:</span>
                  <span>{formatCurrency(receiptData.balanceDue)}</span>
                </div>
              )}
              {receiptData.jobStatus && (
                <div className="rc-row">
                  <span className="rc-label">Job Status:</span>
                  <span className="rc-chip">{receiptData.jobStatus.replace(/_/g, ' ')}</span>
                </div>
              )}
            </div>

            <hr className="rc-rule" />

            {/* Verification */}
            <Section
              id="receipt-verify"
              title="Verify"
              meta="QR · Transaction ID"
              open={openSections.verify}
              onToggle={() => toggleSection('verify')}
            >
              <div className="rc-qr-grid">
                {receiptProofUrl && (
                  <div className="rc-qr">
                    <QRCodeCanvas value={receiptProofUrl} size={132} level="M" includeMargin />
                    <p className="rc-qr-caption">Verify receipt or track service</p>
                  </div>
                )}
                <div className="rc-qr">
                  <QRCodeCanvas value={receiptQrValue} size={132} level="M" includeMargin />
                  <p className="rc-qr-caption">Visit {storeName}</p>
                </div>
              </div>
              <div className="rc-row rc-tx">
                <span className="rc-label">Transaction ID:</span>
                <span className="rc-value">{receiptData.transactionId}</span>
              </div>
            </Section>

            <hr className="rc-rule" />

            {/* Footer */}
            <footer className="rc-foot">
              <p className="rc-thanks">Webale nyo! 🙏</p>
              <p className="rc-fine">Thank you for shopping with us!</p>
              <p className="rc-fine">Visit us again at {storeName}</p>
              <p className="rc-fine">VAT Inclusive • All prices in UGX</p>
              <p className="rc-fine">Exchange &amp; Return within 7 days with receipt</p>
              {branding?.website && <p className="rc-fine">{branding.website}</p>}
              {supportEmail && <p className="rc-fine">{supportEmail}</p>}
              <p className="rc-fine">🇺🇬</p>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Receipt;
