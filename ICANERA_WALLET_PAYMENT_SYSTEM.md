# 💎 IcanEra Wallet Payment System - Complete Implementation

## Overview
This system ensures that all IcanEra wallet payments across all applications are correctly recorded with:
- ✅ **Amount in local currency** (UGX, KES, TZS, etc.)
- ✅ **Store/Merchant name** (automatically captured)
- ✅ **Business vs Personal classification** (smart auto-detection)
- ✅ **Complete transaction metadata** (currency, exchange rate, wallet address)
- ✅ **Full audit trail** (linked to wallet transactions)

## Database Changes

### New Columns Added to `transactions` Table

```sql
-- Currency & Amount Tracking
currency_code VARCHAR(10) DEFAULT 'UGX'
amount_in_local_currency DECIMAL(15, 2)
ican_amount DECIMAL(15, 6)
exchange_rate DECIMAL(15, 6)

-- Merchant Information
merchant_name VARCHAR(255)
merchant_type VARCHAR(100)

-- Expenditure Classification
expenditure_type VARCHAR(50) DEFAULT 'personal'  -- 'business' or 'personal'
expenditure_category VARCHAR(100)  -- 'groceries', 'bulk_purchase', 'business_supplies', etc.

-- Wallet Integration
wallet_transaction_id UUID
customer_wallet_address VARCHAR(255)

-- Flexible Metadata
metadata_json JSONB
```

## How It Works

### 1. Automatic Amount Capture
```javascript
// Transaction automatically captures:
{
  total_amount: 50000,  // Base amount
  currency_code: 'UGX',  // User's local currency
  amount_in_local_currency: 50000,  // Same as total in local currency
  ican_amount: 50.0,  // Converted to ICAN (50000 / 1000)
  exchange_rate: 1000  // Current ICAN to UGX rate
}
```

### 2. Merchant Name Auto-Detection
```javascript
// System automatically captures:
merchant_name: "SuperMartKera"  // From supermarket table
merchant_type: "supermarket"
store_location: "Kampala Main Branch"
```

### 3. Smart Expenditure Classification

#### Business Purchase Indicators:
- Customer name contains: "Company", "Ltd", "Business", "Enterprise"
- Large purchase: > 500,000 UGX
- Bulk purchase: > 20 items
- Business categories: "office", "supplies", "equipment"

#### Classification Examples:
```javascript
// Personal Purchase
{
  items: 5,
  total: 45000,
  customer: "John Doe"
}
→ expenditure_type: "personal"
→ expenditure_category: "groceries"

// Business Purchase
{
  items: 30,
  total: 850000,
  customer: "ABC Company Ltd"
}
→ expenditure_type: "business"
→ expenditure_category: "business_supplies"
```

## Usage in Applications

### Cashier Portal - Recording Wallet Payment

```javascript
import walletPaymentIntegration from '@/services/walletPaymentIntegration';

// When customer pays with IcanEra Wallet
const handleWalletPayment = async () => {
  const result = await walletPaymentIntegration.recordWalletPayment({
    items: currentTransaction.items,
    subtotal: currentTransaction.subtotal,
    tax: currentTransaction.tax,
    total: currentTransaction.total,
    cashier: cashierProfile,
    customer: { name: customerName },
    register: 'POS-001',
    location: 'Kampala Branch',
    supermarket_id: cashierProfile.supermarket_id,
    walletTransactionId: walletTxnId,  // From wallet service
    customerUserId: customerUserId  // For wallet address lookup
  });

  if (result.success) {
    console.log('✅ Payment recorded:', result.receiptNumber);
    // Show receipt with all details
  }
};
```

### View Transaction History

```javascript
// Get all wallet transactions
const { transactions } = await walletPaymentIntegration.getWalletTransactionHistory(
  userId,
  {
    limit: 100,
    expenditureType: 'business'  // Filter by type
  }
);

// Each transaction includes:
transactions.forEach(txn => {
  console.log({
    receipt: txn.receipt_number,
    merchant: txn.merchant_name,
    amount: `${txn.currency_code} ${txn.amount_in_local_currency}`,
    ican: `${txn.ican_amount} ICAN`,
    type: txn.expenditure_type,  // business or personal
    category: txn.expenditure_category
  });
});
```

### Spending Analytics

```javascript
// Get spending breakdown
const { analytics } = await walletPaymentIntegration.getWalletSpendingAnalytics(
  userId,
  30  // Last 30 days
);

console.log({
  totalSpent: analytics.totalSpent,
  businessSpending: analytics.byType.business.amount,
  personalSpending: analytics.byType.personal.amount,
  topMerchants: analytics.byMerchant,
  topCategories: analytics.byCategory
});
```

### Export for Accounting

```javascript
// Export to CSV
const { data } = await walletPaymentIntegration.exportWalletTransactions(
  userId,
  'csv',
  {
    startDate: '2026-01-01',
    endDate: '2026-01-31',
    expenditureType: 'business'
  }
);

// Download CSV file
const blob = new Blob([data], { type: 'text/csv' });
const url = URL.createObjectURL(blob);
// ... download file
```

## Database Migration

Run this SQL in Supabase SQL Editor:

```bash
# In Supabase Dashboard → SQL Editor → New Query
# Paste and run: FIX_ICANERA_WALLET_TRANSACTIONS_COMPLETE.sql
```

The migration:
1. ✅ Adds all new columns
2. ✅ Creates indexes for performance
3. ✅ Backfills existing data
4. ✅ Creates helper functions
5. ✅ Creates summary view
6. ✅ Grants proper permissions

## View Transaction Details

### Using SQL View
```sql
-- View all wallet transactions with complete details
SELECT * FROM wallet_transaction_summary
WHERE customer_wallet_address IS NOT NULL
ORDER BY created_at DESC
LIMIT 50;
```

### Transaction Record Example
```json
{
  "receipt_number": "RCP-20260131-0042",
  "merchant_name": "SuperMartKera",
  "merchant_type": "supermarket",
  "total_amount": 125000,
  "currency_code": "UGX",
  "amount_in_local_currency": 125000,
  "ican_amount": 125.0,
  "exchange_rate": 1000,
  "expenditure_type": "business",
  "expenditure_category": "bulk_purchase",
  "customer_wallet_address": "ICAN_abc123...",
  "wallet_transaction_id": "uuid-here",
  "items_count": 25,
  "payment_provider": "IcanEra Wallet",
  "created_at": "2026-01-31T10:30:00Z"
}
```

## Classification Rules

### Business Expenditure
Classified as **business** when:
- Customer name contains business keywords
- Total amount > 500,000 UGX
- More than 20 items purchased
- Items from business categories

Categories:
- `business_supplies` - General business purchases
- `bulk_purchase` - Large quantity purchases
- `inventory` - Stock/inventory purchases
- `office_supplies` - Office items

### Personal Expenditure
Classified as **personal** when:
- Small purchases (< 500,000 UGX)
- Few items (< 20)
- Regular customer name
- Standard grocery items

Categories:
- `groceries` - Food and household items
- `utilities` - Bills and services
- `shopping` - General shopping

## Multi-Currency Support

The system automatically handles multiple currencies:

```javascript
// Uganda
currency_code: 'UGX'
exchange_rate: 1000  // 1 ICAN = 1000 UGX

// Kenya
currency_code: 'KES'
exchange_rate: 130  // 1 ICAN = 130 KES

// Tanzania
currency_code: 'TZS'
exchange_rate: 2500  // 1 ICAN = 2500 TZS
```

Exchange rates are fetched live from `ican_currency_rates` table.

## Benefits

### For Users
- 🎯 **Accurate tracking** - Every purchase recorded with full details
- 💰 **Clear amounts** - See exactly what you spent in your currency
- 🏪 **Merchant visibility** - Know where you shopped
- 📊 **Smart categorization** - Business vs personal auto-detected

### For Merchants
- 📈 **Complete records** - Full transaction history
- 💼 **Business insights** - Separate business customers
- 🧾 **Audit trail** - Every transaction linked to wallet
- 📑 **Easy reporting** - Export for accounting

### For Developers
- 🔧 **Easy integration** - Simple service functions
- 🎨 **Flexible** - JSONB metadata for custom fields
- 🚀 **Performant** - Indexed for fast queries
- 🔒 **Secure** - RLS policies maintained

## Testing

### Test Wallet Payment
```javascript
// Test recording a payment
const testPayment = {
  items: [
    { name: 'Bread', price: 3000, quantity: 2 },
    { name: 'Milk', price: 5000, quantity: 1 }
  ],
  subtotal: 11000,
  tax: 1980,
  total: 12980,
  cashier: { id: 'cashier-id', supermarket_id: 'super-id' },
  customer: { name: 'Test Customer' },
  customerUserId: 'customer-user-id'
};

const result = await walletPaymentIntegration.recordWalletPayment(testPayment);
console.log(result);
```

### Verify in Database
```sql
-- Check recent wallet transactions
SELECT 
  receipt_number,
  merchant_name,
  amount_in_local_currency,
  currency_code,
  ican_amount,
  expenditure_type,
  expenditure_category
FROM transactions
WHERE payment_method = 'icanera_wallet'
ORDER BY created_at DESC
LIMIT 10;
```

## Troubleshooting

### Issue: Amount not captured
**Solution:** Ensure `total` is passed and is a number
```javascript
total: parseFloat(totalAmount)  // Must be number, not string
```

### Issue: Merchant name missing
**Solution:** Pass `supermarket_id` or `location`
```javascript
supermarket_id: cashierProfile.supermarket_id
```

### Issue: Wrong currency
**Solution:** Get user's currency from profile
```javascript
const { currencyCode } = await getUserCurrency(userId);
```

### Issue: Classification incorrect
**Solution:** Provide more context in customer name or use manual override
```javascript
expenditureType: 'business',  // Manual override
expenditureCategory: 'inventory'
```

## Support

For issues or questions:
1. Check transaction logs: `console.log` in browser
2. Verify database columns exist
3. Check user has wallet record in `ican_user_wallets`
4. Ensure RLS policies allow access

## Next Steps

1. ✅ Run database migration
2. ✅ Import wallet integration service
3. ✅ Update payment handlers to use new service
4. ✅ Test with sample transactions
5. ✅ Verify data in database
6. 🎉 Deploy to production!
