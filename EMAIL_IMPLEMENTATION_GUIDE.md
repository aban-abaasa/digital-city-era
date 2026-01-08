# Email Integration in Application Code

## Overview
This guide shows how to integrate the email service into your existing application flows.

---

## 1. Admin Signup Email Integration

### Location: `frontend/src/pages/AdminAuth.jsx`

Add email sending after successful user creation:

```jsx
// Import email notification function
import { sendAdminSignupEmail } from '../../../backend/src/services/emailNotifications.js';

// In your signup handler, after successful user creation:
if (data.user) {
  try {
    console.log('📧 Sending signup confirmation email...');
    
    // Send confirmation email
    const { sendAdminSignupEmail } = require('../../../backend/src/services/emailNotifications.js');
    
    await sendAdminSignupEmail(
      formData.email,
      formData.fullName
    );
    
    console.log('✅ Confirmation email sent');
  } catch (emailError) {
    console.warn('⚠️ Email notification failed (non-critical):', emailError.message);
    // Continue even if email fails
  }
}

// Show success message
notificationService.show(
  '✅ Admin account created! Check your email for details.',
  'success'
);
```

---

## 2. Order Confirmation Email Integration

### Location: Create a new service `frontend/src/services/orderEmailService.js`

```javascript
import { sendOrderConfirmationEmail } from '../../backend/src/services/emailNotifications.js';

export const notifyOrderConfirmation = async (order, customerEmail, customerName) => {
  try {
    console.log('📧 Sending order confirmation email...');
    
    const orderDetails = {
      items: order.items || [],
      subtotal: order.subtotal || 0,
      tax_rate: order.tax_rate || 18,
      tax_amount: order.tax_amount || 0,
      discount_amount: order.discount_amount || 0,
      total_amount: order.total_amount || 0
    };

    const result = await sendOrderConfirmationEmail(
      customerEmail,
      customerName,
      orderDetails
    );

    if (result.success) {
      console.log('✅ Order confirmation email sent');
      return true;
    } else {
      console.warn('⚠️ Email failed:', result.message);
      return false;
    }
  } catch (error) {
    console.warn('⚠️ Email error:', error.message);
    return false;
  }
};
```

### Using in Order Creation:

```jsx
// In your order creation component
import { notifyOrderConfirmation } from '../services/orderEmailService.js';

const handleCreateOrder = async (orderData) => {
  try {
    // Create order in database
    const createdOrder = await supabase
      .from('orders')
      .insert([orderData])
      .select()
      .single();

    if (createdOrder.error) throw createdOrder.error;

    // Send confirmation email (non-blocking)
    await notifyOrderConfirmation(
      createdOrder.data,
      customer.email,
      customer.full_name
    );

    toast.success('✅ Order created and confirmation email sent');
  } catch (error) {
    toast.error('Failed to create order: ' + error.message);
  }
};
```

---

## 3. Password Reset Email Integration

### Location: Add to your auth/password reset handler

```javascript
import { sendPasswordResetEmail } from '../services/emailNotifications.js';

export const handlePasswordReset = async (email, fullName) => {
  try {
    // Generate reset token
    const resetToken = crypto.randomUUID();
    
    // Save token to database with expiry
    await supabase
      .from('password_reset_tokens')
      .insert({
        user_email: email,
        token: resetToken,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });

    // Send reset email
    const result = await sendPasswordResetEmail(
      email,
      fullName,
      resetToken
    );

    if (result.success) {
      console.log('✅ Password reset email sent');
      return { success: true, message: 'Reset link sent to your email' };
    } else {
      console.warn('⚠️ Email failed:', result.message);
      return { success: false, message: 'Could not send reset email' };
    }
  } catch (error) {
    console.error('Error:', error);
    return { success: false, message: 'Error processing reset request' };
  }
};
```

---

## 4. Shipment Notification Integration

### Location: Create `frontend/src/services/shipmentService.js`

```javascript
import { sendShipmentNotificationEmail } from '../../backend/src/services/emailNotifications.js';

export const notifyShipment = async (order, trackingNumber) => {
  try {
    console.log('📧 Sending shipment notification...');

    // Calculate estimated delivery (example: 3-5 business days)
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 4);
    const estimatedDelivery = `${deliveryDate.toLocaleDateString('en-UG')}`;

    const result = await sendShipmentNotificationEmail(
      order.customer_email,
      order.customer_name,
      order.order_number,
      trackingNumber,
      estimatedDelivery
    );

    if (result.success) {
      console.log('✅ Shipment notification sent');
      return true;
    } else {
      console.warn('⚠️ Email failed:', result.message);
      return false;
    }
  } catch (error) {
    console.warn('⚠️ Shipment email error:', error.message);
    return false;
  }
};
```

### Using when marking order as shipped:

```javascript
import { notifyShipment } from '../services/shipmentService.js';

const handleMarkAsShipped = async (order, trackingNumber) => {
  try {
    // Update order status
    const { error: updateError } = await supabase
      .from('orders')
      .update({ 
        delivery_status: 'shipped',
        delivery_date: new Date().toISOString()
      })
      .eq('id', order.id);

    if (updateError) throw updateError;

    // Send shipment notification
    await notifyShipment(order, trackingNumber);

    toast.success('✅ Order marked as shipped. Customer notified.');
  } catch (error) {
    toast.error('Failed: ' + error.message);
  }
};
```

---

## 5. Profile Approval Email Integration

### Location: Add to admin approval handler

```javascript
import { sendProfileApprovalEmail } from '../services/emailNotifications.js';

export const approveUserProfile = async (userId, userData) => {
  try {
    // Update user profile status
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        profile_completed: true,
        is_active: true,
        approved_at: new Date().toISOString(),
        approved_by: currentAdminId
      })
      .eq('id', userId);

    if (updateError) throw updateError;

    // Send approval email
    const result = await sendProfileApprovalEmail(
      userData.email,
      userData.full_name,
      userData.role
    );

    if (result.success) {
      console.log('✅ Approval email sent');
      toast.success('User approved and notified');
    } else {
      console.warn('⚠️ Email failed but user approved');
      toast.warning('User approved but email failed');
    }
  } catch (error) {
    toast.error('Failed to approve user: ' + error.message);
  }
};
```

---

## 6. Backend API Endpoint (Optional)

### Location: Create `backend/src/api/email-endpoints.js`

If you want to send emails via API:

```javascript
import express from 'express';
import { sendAdminSignupEmail, sendOrderConfirmationEmail } from '../services/emailNotifications.js';

const router = express.Router();

// Send admin signup email
router.post('/api/emails/admin-signup', async (req, res) => {
  try {
    const { email, fullName } = req.body;

    if (!email || !fullName) {
      return res.status(400).json({ error: 'Email and fullName required' });
    }

    const result = await sendAdminSignupEmail(email, fullName);

    if (result.success) {
      res.json({ success: true, message: 'Email sent' });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send order confirmation email
router.post('/api/emails/order-confirmation', async (req, res) => {
  try {
    const { email, customerName, order } = req.body;

    const result = await sendOrderConfirmationEmail(
      email,
      customerName,
      order
    );

    if (result.success) {
      res.json({ success: true, message: 'Email sent' });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

Then import and use in your main server:

```javascript
import emailRouter from './src/api/email-endpoints.js';
app.use(emailRouter);
```

---

## Error Handling Best Practices

### Pattern 1: Non-blocking (Recommended for signup/orders)
```javascript
// Try to send email but don't fail the main operation
try {
  await sendEmail(...);
  console.log('✅ Email sent');
} catch (error) {
  console.warn('⚠️ Email failed (non-critical):', error.message);
  // Continue anyway
}

// Show success to user regardless
toast.success('✅ Order created!');
```

### Pattern 2: Logging for retry
```javascript
try {
  await sendEmail(...);
} catch (error) {
  // Log for manual retry later
  await logEmailFailure({
    recipient: email,
    error: error.message,
    timestamp: new Date()
  });
  
  console.warn('Email failed, logged for retry');
}
```

### Pattern 3: Queue-based (For high volume)
```javascript
// Add to queue for background processing
const emailQueue = [];

async function queueEmail(emailData) {
  emailQueue.push(emailData);
  // Process queue periodically
}

setInterval(async () => {
  while (emailQueue.length > 0) {
    const emailData = emailQueue.shift();
    try {
      await sendEmail(emailData);
    } catch (error) {
      emailQueue.push(emailData); // Re-queue on failure
    }
  }
}, 5000);
```

---

## Testing Integration

### Test Admin Signup Email
```bash
node test-email.js
```

### Test with Actual Email
```javascript
// Temporarily add this to test-email.js
import { sendAdminSignupEmail } from './src/services/emailNotifications.js';

const result = await sendAdminSignupEmail(
  'your-real-email@gmail.com',  // Use your email
  'John Doe'
);
console.log('Result:', result);
```

---

## Environment Variables Reference

```env
# SendGrid Configuration
SENDGRID_API_KEY=your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=noreply@faredeal.ug        # Must be verified
SENDGRID_FROM_NAME=FAREDEAL Uganda

# Frontend URLs for email links
FRONTEND_URL=http://localhost:5173              # Dev
# FRONTEND_URL=https://faredeal.ug              # Production

# Optional: Email settings
EMAIL_RETRY_ATTEMPTS=3                          # Retry failed sends
EMAIL_RETRY_DELAY=5000                          # Delay in ms
EMAIL_QUEUE_ENABLED=true                        # Use queue for reliability
```

---

## Checklist for Implementation

- [ ] Verify sender email in SendGrid
- [ ] Copy email integration code from this guide
- [ ] Test with `node test-email.js`
- [ ] Add to AdminAuth signup flow
- [ ] Add to Order creation flow
- [ ] Add to Password reset flow
- [ ] Add to Shipment updates
- [ ] Add to Profile approval flow
- [ ] Test with real emails
- [ ] Monitor SendGrid activity log
- [ ] Deploy to production
- [ ] Update FRONTEND_URL for production

---

**Email integration is ready to implement! Follow the patterns above for each use case.** 📧
