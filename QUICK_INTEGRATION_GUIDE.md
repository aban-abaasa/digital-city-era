# Quick Integration Guide - IcanEra Wallet Payments

## Step-by-Step Integration

### 1. Run Database Migration (REQUIRED FIRST)

In Supabase SQL Editor:
```sql
-- Copy and run: backend/database/migrations/FIX_ICANERA_WALLET_TRANSACTIONS_COMPLETE.sql
```

### 2. Import Wallet Service in Cashier Portal

```javascript
// At top of CashierPortal.jsx
import walletPaymentIntegration from '../services/walletPaymentIntegration';
```

### 3. Update Payment Processing Function

Find the wallet payment handler and replace with:

```javascript
const handleIcanWalletPayment = async (walletTransactionId, customerUserId) => {
  setPaymentProcessing(true);
  
  try {
    // Record payment with complete details
    const result = await walletPaymentIntegration.recordWalletPayment({
      items: currentTransaction.items,
      subtotal: currentTransaction.subtotal,
      tax: currentTransaction.tax,
      total: currentTransaction.total,
      cashier: {
        id: cashierProfile.user_id,
        name: cashierProfile.name,
        supermarket_id: cashierProfile.supermarket_id
      },
      customer: {
        name: 'IcanEra Wallet Customer'
      },
      register: cashierProfile.register || 'POS-001',
      location: cashierProfile.location || 'Kampala Branch',
      supermarket_id: cashierProfile.supermarket_id,
      walletTransactionId: walletTransactionId,
      customerUserId: customerUserId
    });

    if (result.success) {
      toast.success('✅ Payment successful!');
      
      // Show receipt
      setReceiptData({
        ...result.transaction,
        items: currentTransaction.items,
        merchant: result.transaction.merchant_name,
        currency: result.transaction.currency_code,
        icanAmount: result.transaction.ican_amount
      });
      setShowReceiptModal(true);
      
      // Clear current transaction
      clearTransaction();
    } else {
      toast.error('Payment failed: ' + result.error);
    }
  } catch (error) {
    console.error('Payment error:', error);
    toast.error('Payment processing failed');
  } finally {
    setPaymentProcessing(false);
  }
};
```

### 4. Update Receipt Component

Add currency and merchant display to Receipt.jsx:

```javascript
// In Receipt.jsx
<div className="receipt-header">
  <h2>{receiptData.merchant_name || 'Supermarket'}</h2>
  <p>{receiptData.store_location}</p>
</div>

<div className="receipt-amount">
  <p>Total: {receiptData.currency_code} {receiptData.amount_in_local_currency?.toLocaleString()}</p>
  <p>≈ {receiptData.ican_amount?.toFixed(2)} ICAN</p>
</div>

<div className="receipt-classification">
  <p>Type: {receiptData.expenditure_type === 'business' ? '🏢 Business' : '👤 Personal'}</p>
  <p>Category: {receiptData.expenditure_category}</p>
</div>
```

### 5. Add Transaction History View

```javascript
// Add to CashierPortal.jsx
const [walletHistory, setWalletHistory] = useState([]);

const loadWalletHistory = async () => {
  const result = await walletPaymentIntegration.getWalletTransactionHistory(
    cashierProfile.user_id,
    { limit: 50 }
  );
  
  if (result.success) {
    setWalletHistory(result.transactions);
  }
};

// Call on mount
useEffect(() => {
  loadWalletHistory();
}, [cashierProfile.user_id]);

// Display in UI
<div className="wallet-history">
  <h3>IcanEra Wallet Transactions</h3>
  {walletHistory.map(txn => (
    <div key={txn.id} className="transaction-item">
      <span>{txn.receipt_number}</span>
      <span>{txn.merchant_name}</span>
      <span>{txn.currency_code} {txn.amount_in_local_currency}</span>
      <span className={txn.expenditure_type === 'business' ? 'business' : 'personal'}>
        {txn.expenditure_type}
      </span>
    </div>
  ))}
</div>
```

### 6. Optional: Add Spending Analytics

```javascript
const [spendingAnalytics, setSpendingAnalytics] = useState(null);

const loadAnalytics = async () => {
  const result = await walletPaymentIntegration.getWalletSpendingAnalytics(
    cashierProfile.user_id,
    30  // Last 30 days
  );
  
  if (result.success) {
    setSpendingAnalytics(result.analytics);
  }
};

// Display
{spendingAnalytics && (
  <div className="spending-summary">
    <h3>Last 30 Days</h3>
    <p>Total: UGX {spendingAnalytics.totalSpent.toLocaleString()}</p>
    <p>Business: UGX {spendingAnalytics.byType.business.amount.toLocaleString()}</p>
    <p>Personal: UGX {spendingAnalytics.byType.personal.amount.toLocaleString()}</p>
  </div>
)}
```

## Testing Checklist

- [ ] Database migration completed successfully
- [ ] Wallet service imported without errors
- [ ] Payment processing captures amount correctly
- [ ] Currency displayed correctly (UGX, etc.)
- [ ] Merchant name shows in transaction
- [ ] Classification (business/personal) works
- [ ] Receipt shows all details
- [ ] Transaction history loads
- [ ] Analytics calculate correctly

## Verification Query

Run in Supabase SQL Editor to verify:

```sql
-- Check recent wallet transactions have all fields
SELECT 
  receipt_number,
  merchant_name,
  amount_in_local_currency,
  currency_code,
  ican_amount,
  exchange_rate,
  expenditure_type,
  expenditure_category,
  customer_wallet_address,
  created_at
FROM transactions
WHERE payment_method = 'icanera_wallet'
ORDER BY created_at DESC
LIMIT 5;
```

Expected result: All columns should have values (not NULL).

## Common Issues

### 1. "Column does not exist" error
**Fix:** Run the database migration SQL first

### 2. Amount shows as 0
**Fix:** Ensure `total` is passed as a number:
```javascript
total: parseFloat(currentTransaction.total)
```

### 3. Merchant name is "Unknown Store"
**Fix:** Pass `supermarket_id`:
```javascript
supermarket_id: cashierProfile.supermarket_id
```

### 4. Currency shows as UGX for all users
**Fix:** This is expected! Get user's currency from profile:
```javascript
// In getUserCurrency function
const { data } = await supabase
  .from('ican_user_profiles')
  .select('currency')
  .eq('user_id', userId)
  .single();
```

## Files Modified

1. ✅ `backend/database/migrations/FIX_ICANERA_WALLET_TRANSACTIONS_COMPLETE.sql` - New
2. ✅ `frontend/src/services/walletPaymentIntegration.js` - New
3. ✅ `frontend/src/services/transactionService.js` - Enhanced
4. 🔄 `frontend/src/pages/CashierPortal.jsx` - Update payment handler
5. 🔄 `frontend/src/components/Receipt.jsx` - Add currency/merchant display

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify database migration completed
3. Check Supabase logs for RLS policy issues
4. Test with simple transaction first

## Ready to Deploy? ✅

Once all tests pass:
1. Commit changes to git
2. Deploy backend SQL migration
3. Deploy frontend code
4. Verify in production with test transaction
5. Monitor logs for any issues

---

**Need help?** Check `ICANERA_WALLET_PAYMENT_SYSTEM.md` for full documentation.
