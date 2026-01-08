# SendGrid Email Configuration - Troubleshooting Guide

## Current Status ✅ Configuration Valid

Your SendGrid API key and configuration are properly set up. However, email sending failed with **"Forbidden"** error.

### Root Cause
The sender email address `noreply@faredeal.ug` is **not verified** in your SendGrid account.

SendGrid requires you to verify all sender email addresses before using them to send emails.

---

## Solution: Verify Sender Email in SendGrid

### Step 1: Go to SendGrid Dashboard
1. Visit https://app.sendgrid.com
2. Login with your account
3. Look for your project: **faredeal**

### Step 2: Verify Sender Address
1. In the left sidebar, click **Settings**
2. Click **Sender Authentication**
3. You'll see a section called "Authenticate Your Domain" or "Single Sender Verification"
4. Click **"Create New Sender"** button

### Step 3: Add Your Sender
1. Fill in the form:
   - **From Email Address**: `noreply@faredeal.ug`
   - **From Name**: `FAREDEAL Uganda` (optional)
   - **Reply To Email**: (leave blank or enter a support email)
2. Click **Create**

### Step 4: Verify the Email
1. SendGrid will send a verification email to `noreply@faredeal.ug`
2. Check the email inbox/spam folder for noreply@faredeal.ug
3. Click the verification link in the email
4. Wait 1-2 minutes for verification to complete

### Step 5: Test Again
Once verified, your sender email will appear in the "Verified Senders" list.

Then test again:
```bash
node test-email.js
```

---

## Alternative: Use a Personal Email for Testing

If you don't have access to `noreply@faredeal.ug`, you can temporarily use your own email for testing:

### Option 1: Update .env
```env
SENDGRID_FROM_EMAIL=your-email@gmail.com
SENDGRID_FROM_NAME=FAREDEAL Test
```

Then verify `your-email@gmail.com` in SendGrid and test.

### Option 2: Use SendGrid Test Mode
You can also use a test recipient email instead:
```bash
node -e "
import 'dotenv/config.js';
import emailService from './src/services/emailService.js';
(async () => {
  const result = await emailService.sendEmail(
    'your-email@gmail.com',
    'Test Email',
    '<p>This is a test</p>'
  );
  console.log(result);
})();
"
```

---

## Step-by-Step Verification Process

### For `noreply@faredeal.ug`:

**Prerequisites:**
- You must have control of the email address or its mail server
- For domain emails like `noreply@faredeal.ug`, you need access to:
  - The domain's email server
  - Or ask the domain administrator
  - Or use DNS records if self-hosted

**If you own the domain:**
1. Create the email account `noreply@faredeal.ug` in your email server
2. Follow SendGrid verification steps above
3. Check the mailbox for verification email

**If this is a placeholder email:**
- Use your actual email instead
- Or set up a real email on your domain first

---

## Testing Without Email Verification

To test the email service **without verifying** the sender email:

### Use SendGrid's Test Mode
Update `.env` to use a generic test sender:
```env
SENDGRID_FROM_EMAIL=noreply@sendgrid.net
```

Or create a test endpoint that bypasses email:

```javascript
// Add to test-email.js
const testWithoutVerification = async () => {
  console.log('📧 Testing without actual email sending...');
  console.log('✅ Email service initialized');
  console.log('✅ HTML template generated');
  console.log('✅ Would send to: test@example.com');
  console.log('📝 Note: Actual sending requires verified sender email');
};

// Call instead of sendEmail for testing
testWithoutVerification();
```

---

## Quick Checklist

- [ ] API Key is valid (starts with `SG.`)
- [ ] Sender email is verified in SendGrid
- [ ] Sender email matches `SENDGRID_FROM_EMAIL` in .env
- [ ] Test email recipient is a valid email address
- [ ] SendGrid account is active and has email quota

---

## Verification Status Check

To check if your sender is verified:

1. Go to: https://app.sendgrid.com/settings/sender_auth
2. Look for your email in the "Verified Senders" section
3. Status should show **"Verified"** (green checkmark)

If it shows **"Unverified"** or **"Pending"**:
- Complete the email verification step
- Wait for the system to process (usually 1-2 minutes)

---

## Environment Variables Summary

Your current .env:
```env
SENDGRID_API_KEY=your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=noreply@faredeal.ug           ← ⚠️ Needs verification
SENDGRID_FROM_NAME=FAREDEAL Uganda
FRONTEND_URL=http://localhost:5173                 ← Update for production
```

---

## Next Steps

1. ✅ Verify `noreply@faredeal.ug` (or replace with verified email)
2. ✅ Run: `node test-email.js`
3. ✅ Check inbox for test email
4. ✅ Integrate email functions into your app

---

## Support

- **SendGrid Docs**: https://docs.sendgrid.com/
- **API Troubleshooting**: https://docs.sendgrid.com/ui/account-and-settings/troubleshooting-guide
- **Sender Authentication**: https://docs.sendgrid.com/ui/account-and-settings/how-to-set-up-domain-authentication

Need help? Check the SendGrid dashboard activity log:
- Go to: https://app.sendgrid.com/email_activity
- Filter by your test email address
- Look for error messages in the "Response" column
