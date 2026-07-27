# SupermartKera Cashier - IcanEra Receive Modal Debugging Guide

## Issue
User reported that clicking "IcanEra Wallet" payment opens the full wallet instead of just the receive modal.

## Fixes Applied

### 1. Added `user_id` to cashierProfile
**Problem:** Modal needs auth user ID to create payment requests
**Fix:** Added `user_id: user.id` when loading cashier profile

**Location:** `frontend/src/pages/CushierPortal.jsx`
```javascript
setCashierProfile({
  id: cashierData.id,
  user_id: user.id, // Auth user ID for wallet operations
  name: cashierData.full_name || 'Cashier',
  // ... rest of profile
});
```

### 2. Updated Payment Method Description
**Change:** Made it clear this is "Receive Only"
```javascript
{
  id: 'icanera_wallet',
  name: 'IcanEra Wallet',
  icon: '💎',
  description: 'Receive Payment - Customer Scans QR Code', // Changed from "Send & Receive"
  features: ['receive'], // Changed from ['send', 'receive', 'track', 'verify']
}
```

### 3. Added Debug Logging
Added console logs to trace the flow:

**In processPayment():**
- Logs when function is called with payment method ID
- Logs when IcanEra condition is triggered
- Logs current user_id and transaction total
- Logs when modal state is set

**In CashierReceiveIcanModal:**
- Logs when component renders
- Logs when useEffect triggers
- Logs modal state changes

## How to Debug

### 1. Open Browser Console
- Press F12 or right-click → Inspect
- Go to Console tab

### 2. Test the Flow
1. Log in as cashier
2. Add items to cart
3. Click "Checkout"
4. Click "💎 IcanEra Wallet"

### 3. Check Console Output
You should see:
```
🔔 processPayment called with: icanera_wallet
💎 Opening IcanEra Wallet receive modal...
💎 Current user_id: <uuid>
💎 Transaction total: 50000
💎 Modal state set to true
🔍 CashierReceiveIcanModal effect: {isOpen: true, qrData: null, userId: "<uuid>", amountUGX: 50000}
✅ Conditions met, generating payment request
🎨 Rendering CashierReceiveIcanModal: {isOpen: true, loading: true, paymentReceived: false, qrData: false}
```

## Expected Behavior

### ✅ Correct Flow:
1. User clicks "IcanEra Wallet" payment
2. Payment modal closes
3. Receive modal opens with:
   - Loading spinner (briefly)
   - QR code (once generated)
   - Amount in ICAN
   - Payment instructions
   - "Waiting for payment..." indicator

### ❌ If Full Wallet Opens Instead:
This means the ICANWalletPage tab is being activated somehow. Check:
1. Is there an onClick handler on the payment button that's different?
2. Is activeTab being set to 'ican-wallet'?
3. Check browser console for errors

## Troubleshooting

### Issue: Modal doesn't open
**Check:**
- Console shows "💎 Opening IcanEra Wallet receive modal..."?
- `showIcanReceiveModal` state is set to true?
- `cashierProfile.user_id` is not null?
- `currentTransaction.total` is > 0?

**Fix:** Look at console logs to see which condition fails

### Issue: Modal opens but no QR code
**Check:**
- Console shows "✅ Conditions met, generating payment request"?
- Any errors in console about payment_requests table?
- Is Supabase connected?

**Fix:**
1. Check Supabase connection
2. Verify `payment_requests` table exists
3. Check RLS policies allow INSERT for authenticated users

### Issue: QR code shows but payment not detected
**Check:**
- Is customer using correct wallet app?
- Is customer scanning correct QR code?
- Is polling working? (should check every 3 seconds)

**Fix:**
1. Check network tab for RPC calls
2. Verify `getIcanPaymentRequest` is being called
3. Check customer's wallet has sufficient balance

### Issue: Full wallet opens instead
**Likely Cause:** Something else is triggering `setActiveTab('ican-wallet')`

**Debug Steps:**
1. Search for `setActiveTab('ican-wallet')` in code
2. Check if IcanCoinBadge `onOpen` is being triggered
3. Add logging to see what's calling it

**Quick Fix:**
```javascript
// In CushierPortal.jsx, find:
<IcanCoinBadge onOpen={() => setActiveTab('ican-wallet')} />

// Add logging:
<IcanCoinBadge onOpen={() => {
  console.log('⚠️ IcanCoinBadge onOpen triggered!');
  setActiveTab('ican-wallet');
}} />
```

## Files with Changes

### Modified:
1. `frontend/src/pages/CushierPortal.jsx`
   - Added `user_id` to cashierProfile
   - Updated payment method description
   - Added debug logging to processPayment
   - Renders CashierReceiveIcanModal

2. `frontend/src/components/CashierReceiveIcanModal.jsx`
   - Added debug logging to useEffect
   - Added render logging

### Created (from previous step):
1. `frontend/src/services/icanPaymentRequestService.js`
2. `frontend/src/components/CashierReceiveIcanModal.jsx`

## Testing Checklist

- [ ] Console shows debug logs when clicking IcanEra Wallet
- [ ] Payment modal closes when IcanEra Wallet is clicked
- [ ] Receive modal opens with loading spinner
- [ ] QR code appears within ~2 seconds
- [ ] Amount is correctly displayed in ICAN
- [ ] Payment code is shown
- [ ] Customer can scan QR with mobile wallet
- [ ] Payment is detected automatically
- [ ] Transaction saves successfully
- [ ] Receipt is generated
- [ ] Inventory is updated

## Next Steps

1. **Test the flow** with debug logging enabled
2. **Share console output** if issue persists
3. **Check network tab** for any failed API calls
4. **Verify Supabase tables** exist and have proper RLS policies

## Production Deployment

Once working correctly:
1. Remove debug console.log statements
2. Test with real customer wallet
3. Verify payment completion flow end-to-end
4. Test error scenarios (no internet, insufficient balance, etc.)

---

**Last Updated:** 2026-07-26
**Status:** Debugging version deployed with extensive logging
