/**
 * Email Service - SendGrid Integration
 * Handles all email notifications for FAREDEAL
 */

import sgMail from '@sendgrid/mail';

class EmailService {
  constructor() {
    this.apiKey = process.env.SENDGRID_API_KEY;
    this.fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@faredeal.ug';
    this.fromName = process.env.SENDGRID_FROM_NAME || 'FAREDEAL Uganda';
    
    if (!this.apiKey) {
      console.warn('⚠️  SendGrid API key not configured. Email service disabled.');
      this.enabled = false;
      return;
    }
    
    sgMail.setApiKey(this.apiKey);
    this.enabled = true;
    console.log('✅ Email service initialized with SendGrid');
  }

  /**
   * Send a basic email
   */
  async sendEmail(to, subject, htmlContent, textContent = '') {
    if (!this.enabled) {
      console.warn('⚠️  Email service disabled, skipping email send');
      return { success: false, message: 'Email service not configured' };
    }

    try {
      const msg = {
        to,
        from: {
          email: this.fromEmail,
          name: this.fromName
        },
        subject,
        text: textContent || subject,
        html: htmlContent
      };

      await sgMail.send(msg);
      console.log(`✅ Email sent to ${to}: ${subject}`);
      return { success: true, message: 'Email sent successfully' };
    } catch (error) {
      console.error('❌ Error sending email:', error.message);
      return { success: false, message: error.message };
    }
  }

  /**
   * Send admin signup confirmation email
   */
  async sendAdminSignupEmail(email, fullName, adminLink) {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px; }
            .header { background-color: #2ecc71; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { padding: 20px; }
            .button { background-color: #2ecc71; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block; margin-top: 10px; }
            .footer { background-color: #f4f4f4; padding: 10px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to FAREDEAL Admin Portal</h1>
            </div>
            <div class="content">
              <p>Hello <strong>${fullName}</strong>,</p>
              <p>Your admin account has been successfully created on FAREDEAL Uganda's management system.</p>
              
              <h3>Account Details:</h3>
              <ul>
                <li>Email: ${email}</li>
                <li>Role: Administrator</li>
                <li>Status: Active</li>
              </ul>

              <p>You can now access the admin portal and manage:</p>
              <ul>
                <li>📦 Products & Inventory</li>
                <li>📊 Orders & Sales</li>
                <li>👥 User Management</li>
                <li>💰 Financial Reports</li>
                <li>⚙️ System Settings</li>
              </ul>

              <a href="${adminLink}" class="button">Access Admin Portal</a>

              <h3>Security Tips:</h3>
              <ul>
                <li>Never share your login credentials</li>
                <li>Use a strong, unique password</li>
                <li>Enable two-factor authentication if available</li>
              </ul>

              <p>If you didn't request this account or have any questions, please contact support.</p>
              
              <p>Best regards,<br>
              <strong>FAREDEAL Uganda Team</strong></p>
            </div>
            <div class="footer">
              <p>&copy; 2025 FAREDEAL Uganda. All rights reserved.</p>
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail(
      email,
      'Admin Account Created - FAREDEAL Uganda',
      htmlContent
    );
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email, resetLink, fullName = 'User') {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px; }
            .header { background-color: #e74c3c; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { padding: 20px; }
            .button { background-color: #e74c3c; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block; margin-top: 10px; }
            .warning { background-color: #fff3cd; border: 1px solid #ffc107; padding: 10px; border-radius: 4px; color: #856404; margin: 10px 0; }
            .footer { background-color: #f4f4f4; padding: 10px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <p>Hello <strong>${fullName}</strong>,</p>
              <p>We received a request to reset your FAREDEAL account password.</p>

              <div class="warning">
                <strong>⚠️ Important:</strong> This link will expire in 24 hours for security purposes.
              </div>

              <p>Click the button below to reset your password:</p>
              <a href="${resetLink}" class="button">Reset Password</a>

              <p style="margin-top: 20px; color: #666;">Or copy and paste this link in your browser:<br>
              <code style="background-color: #f4f4f4; padding: 10px; display: block; word-break: break-all;">${resetLink}</code></p>

              <div class="warning" style="margin-top: 20px;">
                <strong>Didn't request this?</strong> If you didn't request a password reset, please ignore this email or contact support immediately if you believe your account is at risk.
              </div>

              <p>Best regards,<br>
              <strong>FAREDEAL Uganda Security Team</strong></p>
            </div>
            <div class="footer">
              <p>&copy; 2025 FAREDEAL Uganda. All rights reserved.</p>
              <p>This is an automated security message.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail(
      email,
      'Password Reset Request - FAREDEAL Uganda',
      htmlContent
    );
  }

  /**
   * Send order confirmation email
   */
  async sendOrderConfirmationEmail(email, orderNumber, orderDetails, fullName = 'Customer') {
    const itemsHtml = (orderDetails.items || []).map(item => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">UGX ${item.unitPrice.toLocaleString()}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">UGX ${item.lineTotal.toLocaleString()}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px; }
            .header { background-color: #3498db; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { padding: 20px; }
            .order-info { background-color: #ecf0f1; padding: 15px; border-radius: 4px; margin: 10px 0; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            .summary { background-color: #ecf0f1; padding: 10px; text-align: right; font-weight: bold; }
            .footer { background-color: #f4f4f4; padding: 10px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Order Confirmation</h1>
            </div>
            <div class="content">
              <p>Hello <strong>${fullName}</strong>,</p>
              <p>Thank you for your order! We've received it and will process it shortly.</p>

              <div class="order-info">
                <p><strong>Order Number:</strong> ${orderNumber}</p>
                <p><strong>Order Date:</strong> ${new Date().toLocaleDateString('en-UG')}</p>
                <p><strong>Status:</strong> Processing</p>
              </div>

              <h3>Order Items:</h3>
              <table>
                <thead style="background-color: #3498db; color: white;">
                  <tr>
                    <th style="padding: 10px; text-align: left;">Product</th>
                    <th style="padding: 10px; text-align: center;">Qty</th>
                    <th style="padding: 10px; text-align: right;">Unit Price</th>
                    <th style="padding: 10px; text-align: right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>

              <div class="order-info">
                <p style="margin: 5px 0;"><strong>Subtotal:</strong> UGX ${(orderDetails.subtotal || 0).toLocaleString()}</p>
                <p style="margin: 5px 0;"><strong>Tax (${orderDetails.taxRate || 18}%):</strong> UGX ${(orderDetails.taxAmount || 0).toLocaleString()}</p>
                <p style="margin: 5px 0;"><strong>Discount:</strong> UGX ${(orderDetails.discountAmount || 0).toLocaleString()}</p>
                <p style="margin: 5px 0; font-size: 18px; color: #27ae60;"><strong>Total: UGX ${(orderDetails.totalAmount || 0).toLocaleString()}</strong></p>
              </div>

              <h3>What's Next?</h3>
              <ul>
                <li>We'll process your order within 24 hours</li>
                <li>You'll receive a shipping notification via email</li>
                <li>You can track your order anytime from your account</li>
              </ul>

              <p>If you have any questions, please contact our support team.</p>
              
              <p>Best regards,<br>
              <strong>FAREDEAL Uganda Team</strong></p>
            </div>
            <div class="footer">
              <p>&copy; 2025 FAREDEAL Uganda. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail(
      email,
      `Order Confirmation #${orderNumber} - FAREDEAL Uganda`,
      htmlContent
    );
  }

  /**
   * Send shipment notification email
   */
  async sendShipmentNotificationEmail(email, orderNumber, trackingNumber, estimatedDelivery, fullName = 'Customer') {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px; }
            .header { background-color: #27ae60; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { padding: 20px; }
            .tracking-box { background-color: #ecf0f1; padding: 15px; border-radius: 4px; margin: 10px 0; border-left: 4px solid #27ae60; }
            .footer { background-color: #f4f4f4; padding: 10px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚚 Your Order Has Shipped!</h1>
            </div>
            <div class="content">
              <p>Hello <strong>${fullName}</strong>,</p>
              <p>Great news! Your order has been dispatched and is on its way to you.</p>

              <div class="tracking-box">
                <p><strong>Order Number:</strong> ${orderNumber}</p>
                <p><strong>Tracking Number:</strong> <code style="background-color: white; padding: 5px;">${trackingNumber}</code></p>
                <p><strong>Estimated Delivery:</strong> ${estimatedDelivery}</p>
              </div>

              <h3>How to Track Your Order:</h3>
              <p>You can track your shipment using the tracking number above. Carriers typically provide tracking updates within 24 hours.</p>

              <h3>What to Expect:</h3>
              <ul>
                <li>📍 Real-time tracking updates</li>
                <li>📞 Contact information for the courier</li>
                <li>⏰ Estimated delivery window</li>
              </ul>

              <p><strong>Delivery Instructions:</strong> Please ensure someone is available to receive the package or provide clear delivery instructions to the courier.</p>

              <p>If you have any questions about your shipment, please contact our support team with your order number.</p>
              
              <p>Best regards,<br>
              <strong>FAREDEAL Uganda Logistics Team</strong></p>
            </div>
            <div class="footer">
              <p>&copy; 2025 FAREDEAL Uganda. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail(
      email,
      `Your Order #${orderNumber} Has Shipped - FAREDEAL Uganda`,
      htmlContent
    );
  }

  /**
   * Send employee profile approval email
   */
  async sendProfileApprovalEmail(email, fullName, role, dashboardLink) {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px; }
            .header { background-color: #16a085; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { padding: 20px; }
            .button { background-color: #16a085; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block; margin-top: 10px; }
            .footer { background-color: #f4f4f4; padding: 10px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Profile Approved!</h1>
            </div>
            <div class="content">
              <p>Hello <strong>${fullName}</strong>,</p>
              <p>Congratulations! Your profile has been approved and you can now access the FAREDEAL system.</p>

              <h3>Your Account Details:</h3>
              <ul>
                <li>Email: ${email}</li>
                <li>Role: ${role.charAt(0).toUpperCase() + role.slice(1)}</li>
                <li>Status: ✅ Approved & Active</li>
              </ul>

              <p>You now have access to:</p>
              <ul>
                <li>📊 Dashboard & Analytics</li>
                <li>📦 Inventory Management</li>
                <li>💰 Orders & Payments</li>
                <li>👤 Profile Management</li>
              </ul>

              <a href="${dashboardLink}" class="button">Access Dashboard</a>

              <p style="margin-top: 20px;">If you have any questions or need assistance, please contact our support team.</p>
              
              <p>Best regards,<br>
              <strong>FAREDEAL Uganda Admin Team</strong></p>
            </div>
            <div class="footer">
              <p>&copy; 2025 FAREDEAL Uganda. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail(
      email,
      'Your Profile Has Been Approved - FAREDEAL Uganda',
      htmlContent
    );
  }
}

// Create singleton instance
const emailService = new EmailService();

export default emailService;
