/**
 * Admin Email Notification Handler
 * Sends confirmation emails when admin accounts are created
 */

import emailService from './emailService.js';

/**
 * Send admin signup confirmation email
 * Call this after successful admin creation in AdminAuth.jsx
 * 
 * Example usage:
 * const { sendAdminSignupEmail } = require('./adminEmailHandler');
 * await sendAdminSignupEmail(email, fullName);
 */
async function sendAdminSignupEmail(email, fullName) {
  const adminLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin-auth`;
  
  return emailService.sendAdminSignupEmail(email, fullName, adminLink);
}

/**
 * Send profile approval email to users
 */
async function sendProfileApprovalEmail(email, fullName, role) {
  const dashboardLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard`;
  
  return emailService.sendProfileApprovalEmail(email, fullName, role, dashboardLink);
}

/**
 * Send password reset email
 */
async function sendPasswordResetEmail(email, fullName, resetToken) {
  const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
  
  return emailService.sendPasswordResetEmail(email, resetLink, fullName);
}

/**
 * Send order confirmation email
 */
async function sendOrderConfirmationEmail(email, fullName, order) {
  const orderDetails = {
    items: order.items || [],
    subtotal: order.subtotal || 0,
    taxRate: order.tax_rate || 18,
    taxAmount: order.tax_amount || 0,
    discountAmount: order.discount_amount || 0,
    totalAmount: order.total_amount || 0
  };

  return emailService.sendOrderConfirmationEmail(email, order.order_number, orderDetails, fullName);
}

/**
 * Send shipment notification email
 */
async function sendShipmentNotificationEmail(email, fullName, orderNumber, trackingNumber, estimatedDelivery) {
  return emailService.sendShipmentNotificationEmail(email, orderNumber, trackingNumber, estimatedDelivery, fullName);
}

export {
  sendAdminSignupEmail,
  sendProfileApprovalEmail,
  sendPasswordResetEmail,
  sendOrderConfirmationEmail,
  sendShipmentNotificationEmail
};
