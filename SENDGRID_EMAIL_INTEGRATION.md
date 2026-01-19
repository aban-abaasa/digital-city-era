# SendGrid Email Integration Guide

## Overview
Your FAREDEAL application now has email capabilities using SendGrid. This enables automated notifications for admin signups, password resets, order confirmations, and more.

## Setup Complete ✅

### Configuration
- **API Key**: Added to `.env` file
- **From Email**: noreply@faredeal.ug
- **Service**: Ready to use

### Files Created
1. **backend/src/services/emailService.js** - Core SendGrid service
2. **backend/src/services/emailNotifications.js** - Email notification handlers
3. **Updated**: backend/package.json (added @sendgrid/mail)

---

## Installation

Before using the email service, install dependencies:

```bash
cd backend
npm install
```

This will install `@sendgrid/mail` v8.1.0

---

## Available Email Types

### 1. Admin Signup Confirmation
Sent when a new admin account is created.

```javascript
const { sendAdminSignupEmail } = require('./src/services/emailNotifications');

await sendAdminSignupEmail('admin@example.com', 'John Doe');
```

**Includes:**
- Welcome message
- Account activation link
- Role & permissions info
- Security tips

---

### 2. Password Reset Email
Sent when user requests password reset.

```javascript
const { sendPasswordResetEmail } = require('./src/services/emailNotifications');

const resetToken = 'your-reset-token-here';
await sendPasswordResetEmail('user@example.com', 'John Doe', resetToken);
```

**Includes:**
- Reset link (24-hour expiry)
- Security warning
- Contact support option

---

### 3. Profile Approval Email
Sent when admin approves a user's profile.

```javascript
const { sendProfileApprovalEmail } = require('./src/services/emailNotifications');

await sendProfileApprovalEmail('user@example.com', 'John Doe', 'employee');
```

**Includes:**
- Approval confirmation
- Dashboard access link
- Account details

---

### 4. Order Confirmation Email
Sent after order is placed.

```javascript
const { sendOrderConfirmationEmail } = require('./src/services/emailNotifications');

const order = {
  order_number: 'ORD-2025-001',
  items: [
    { name: 'Product 1', quantity: 2, unitPrice: 50000, lineTotal: 100000 }
  ],
  subtotal: 100000,
  tax_rate: 18,
  tax_amount: 18000,
  discount_amount: 0,
  total_amount: 118000
};

await sendOrderConfirmationEmail('customer@example.com', 'Customer Name', order);
```

**Includes:**
- Order number & date
- Item list with prices
- Total with tax breakdown
- Next steps info

---

### 5. Shipment Notification Email
Sent when order is shipped.

```javascript
const { sendShipmentNotificationEmail } = require('./src/services/emailNotifications');

await sendShipmentNotificationEmail(
  'customer@example.com',
  'Customer Name',
  'ORD-2025-001',
  'TRK-123456789',
  '3-5 business days'
);
```

**Includes:**
- Tracking number
- Estimated delivery date
- Tracking instructions
- Courier contact info

---

## Integration with Admin Signup

To send email when admin signs up, modify **AdminAuth.jsx**:

```jsx
// Add after user record is created successfully
import { sendAdminSignupEmail } from '../services/emailNotifications';

// In the signup handler, after user creation:
if (data.user) {
  try {
    console.log('📧 Sending signup confirmation email...');
    await sendAdminSignupEmail(formData.email, formData.fullName);
    console.log('✅ Email sent successfully');
  } catch (emailError) {
    console.warn('⚠️ Email failed (non-critical):', emailError.message);
    // Don't fail signup if email fails
  }
}
```

---

## Integration with Order System

To send order confirmation emails automatically:

```jsx
// In your order creation logic
const { sendOrderConfirmationEmail } = require('./src/services/emailNotifications');

// After order is created in database:
await sendOrderConfirmationEmail(
  customer.email,
  customer.full_name,
  orderFromDatabase
);
```

---

## Testing Email Service

### Option 1: Send Test Email via Node Script

Create a file `test-email.js`:

```javascript
require('dotenv').config();
const { sendAdminSignupEmail } = require('./src/services/emailNotifications');

async function testEmail() {
  console.log('🧪 Testing email service...\n');
  
  const result = await sendAdminSignupEmail(
    'test@example.com',
    'Test User'
  );
  
  if (result.success) {
    console.log('✅ Email sent successfully!');
  } else {
    console.error('❌ Email failed:', result.message);
  }
}

testEmail();
```

Run it:
```bash
node test-email.js
```

### Option 2: Check SendGrid Dashboard

1. Go to https://app.sendgrid.com
2. Navigate to **Activity** → **Email Activity**
3. Look for your test emails in the activity log

---

## Email Configuration

### Update From Email Address

To use a verified sender address (recommended), update `.env`:

```env
SENDGRID_FROM_EMAIL=contact@yourcompany.com
SENDGRID_FROM_NAME=FAREDEAL Support
```

**Note:** The email address must be verified in SendGrid dashboard first.

### Verify Sender Email in SendGrid

1. Go to https://app.sendgrid.com/settings/sender_auth
2. Click "Create New Sender"
3. Enter your email details
4. Follow verification steps
5. Use verified email in `.env`

---

## Environment Variables

Current setup in `.env`:

```env
# Email Configuration (SendGrid)
SENDGRID_API_KEY=your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=noreply@digitalcityera.ug
SENDGRID_FROM_NAME=DIGITAL CITY ERA

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:5173
```

Update `FRONTEND_URL` for production:
```env
FRONTEND_URL=https://faredeal.ug
```

---

## Email Templates

All templates are pre-built and styled. They include:

- ✅ Responsive mobile-friendly design
- ✅ Professional branding
- ✅ Proper HTML formatting
- ✅ Security best practices
- ✅ Clear call-to-action buttons
- ✅ UGX currency formatting
- ✅ Date/time formatting

### Customizing Templates

To modify email templates, edit `backend/src/services/emailService.js`:

```javascript
// Example: Change header color
// Find this line in the template:
// background-color: #2ecc71;

// Change to your preferred color:
// background-color: #your-color;
```

---

## Error Handling

Emails are non-blocking - if email fails, the main operation continues:

```javascript
try {
  await sendAdminSignupEmail(email, fullName);
  console.log('✅ Email sent');
} catch (error) {
  // Log but don't fail signup
  console.warn('⚠️ Email failed:', error.message);
}
```

---

## Rate Limits

SendGrid Free tier limits:
- **100 emails per day**

For higher limits, upgrade your SendGrid account or contact SendGrid support.

---

## Troubleshooting

### Email Not Sending
1. Check API key is correct in `.env`
2. Verify `SENDGRID_FROM_EMAIL` is a verified sender
3. Check SendGrid Activity log for errors
4. Ensure recipient email is valid

### Service Disabled Error
```
⚠️ Email service disabled, skipping email send
```

**Fix**: Add `SENDGRID_API_KEY` to `.env`

### SMTP Authentication Error
```
Email service initialization failed
```

**Fix**: Verify API key format starts with `SG.`

---

## NextSteps

1. ✅ Install SendGrid package:
   ```bash
   cd backend && npm install
   ```

2. ✅ Test email service:
   ```bash
   node test-email.js
   ```

3. ✅ Integrate into signup/order flows

4. ✅ Verify sender email in SendGrid dashboard

5. ✅ Update `FRONTEND_URL` for production

---

## API Reference

### emailService.sendEmail()
```javascript
await emailService.sendEmail(
  to,           // recipient email
  subject,      // email subject
  htmlContent,  // HTML email body
  textContent   // plain text fallback
);
```

### emailService.sendAdminSignupEmail()
```javascript
await emailService.sendAdminSignupEmail(
  email,      // admin email
  fullName,   // admin full name
  adminLink   // admin portal URL
);
```

### emailService.sendOrderConfirmationEmail()
```javascript
await emailService.sendOrderConfirmationEmail(
  email,          // customer email
  orderNumber,    // order ID
  orderDetails,   // { items, subtotal, taxAmount, totalAmount }
  fullName        // customer name
);
```

---

## Support

For SendGrid documentation:
- https://docs.sendgrid.com/
- https://sendgrid.com/docs/for-developers/sending-email/api-getting-started/

For email service issues:
- Check console logs for detailed error messages
- Review SendGrid activity log
- Verify API key and sender configuration

---

**Email integration is now live! 🚀**
