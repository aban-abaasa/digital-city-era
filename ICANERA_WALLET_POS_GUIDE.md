# IcanEra Wallet POS Integration Guide

## 🎯 Overview
IcanEra Wallet is the **PRIMARY** payment method for SupermartKera POS with **full transaction control**.

---

## 💎 IcanEra Wallet Features

### Core Capabilities
```
✅ RECEIVE payments from customers
✅ SEND payments to suppliers
✅ TRACK all transactions in real-time
✅ VERIFY payments instantly
✅ GENERATE receipts automatically
✅ UPDATE balances automatically
```

### Transaction Types

#### 1. **RECEIVE** (POS Sales - Primary Use)
When a customer pays at the POS:
```javascript
{
  type: 'receive',
  from: 'Customer',
  to: 'Supermarket/Cashier',
  amount: 50000,
  purpose: 'POS Sale',
  status: 'completed'
}
```

#### 2. **SEND** (Future Use)
For refunds or supplier payments:
```javascript
{
  type: 'send',
  from: 'Supermarket',
  to: 'Customer/Supplier',
  amount: 20000,
  purpose: 'Refund/Payment',
  status: 'completed'
}
```

---

## 🔄 Transaction Flow

### Step 1: Customer Checkout
```
Customer adds items → Total calculated → Selects payment method
```

### Step 2: Payment Selection
```
💎 IcanEra Wallet (RECOMMENDED)
💵 Cash (Alternative)
```

### Step 3: IcanEra Wallet Processing
```javascript
// Automatic Processing:
1. Customer confirms payment from their wallet
2. Payment received by supermarket wallet
3. Transaction verified instantly
4. Receipt generated for both parties
5. Inventory updated automatically
6. Balances updated in real-time
```

### Step 4: Completion
```
✅ Transaction Complete
📱 Receipt in both wallets
📊 Transaction history updated
💰 Balances updated
📦 Inventory adjusted
```

---

## 🎨 User Interface

### Payment Modal Priority
```
┌─────────────────────────────────────┐
│  💳 Choose Payment Method           │
│  Total: UGX 50,000                  │
├─────────────────────────────────────┤
│                                     │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│  ┃ 💎 IcanEra Wallet           ┃  │ ← PRIMARY
│  ┃ Digital - Send & Receive    ┃  │
│  ┃ ✓ No Fees ✓ Instant         ┃  │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
│                                     │
│  ┌──────────────────────────────┐  │
│  │ 💵 Cash (UGX)                │  │ ← SECONDARY
│  │ Physical Cash Payment        │  │
│  └──────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

---

## 📊 Transaction Records

### Database Entry
```javascript
{
  // Transaction Identity
  transaction_id: 'ICANERA_1706025600000',
  receipt_number: 'RCP-20250123-001',
  
  // Payment Details
  payment_method: 'icanera_wallet',
  amount: 50000,
  currency: 'UGX',
  fee: 0,
  
  // Parties Involved
  from_user_id: 'customer_uuid',
  from_name: 'John Doe',
  to_user_id: 'cashier_uuid',
  to_name: 'Jane Cashier',
  
  // Transaction Info
  type: 'receive',
  purpose: 'POS Sale',
  status: 'completed',
  verified: true,
  
  // Items Purchased
  items: [
    { name: 'Sugar', qty: 2, price: 5000 },
    { name: 'Rice', qty: 5, price: 8000 }
  ],
  
  // Timestamps
  timestamp: '2025-01-23T10:30:00Z',
  created_at: '2025-01-23T10:30:00Z',
  updated_at: '2025-01-23T10:30:00Z'
}
```

---

## 🔐 Security & Verification

### Transaction Verification
```
1. Customer initiates payment
2. Customer wallet validates balance
3. Payment sent to supermarket wallet
4. Both wallets verify transaction
5. Database records transaction
6. Receipt generated with unique ID
7. Both parties can verify anytime
```

### Audit Trail
```
✓ Complete transaction history
✓ Immutable records
✓ Real-time balance updates
✓ Verifiable by both parties
✓ Admin oversight available
✓ Automatic reconciliation
```

---

## 💰 Balance Management

### Supermarket Wallet
```javascript
{
  balance: 5000000,  // Current balance
  
  // Daily Summary
  today: {
    received: 500000,   // From customers
    sent: 200000,       // To suppliers
    transactions: 45
  },
  
  // Real-time Updates
  last_update: '2025-01-23T10:30:00Z'
}
```

### Customer Wallet
```javascript
{
  balance: 250000,  // Current balance
  
  // Transaction History
  recent: [
    { type: 'send', to: 'SupermartKera', amount: 50000 },
    { type: 'receive', from: 'Salary', amount: 500000 }
  ]
}
```

---

## 📱 Mobile Integration

### Customer App
```
1. Open IcanEra Wallet
2. Select "Pay at Store"
3. Scan QR or Enter Amount
4. Confirm Payment
5. Receive Digital Receipt
```

### Cashier POS
```
1. Ring up items
2. Display total
3. Customer selects IcanEra Wallet
4. Payment received instantly
5. Print/Send receipt
```

---

## 🎯 Benefits Summary

### For Supermarket
| Feature | Benefit |
|---------|---------|
| **Zero Fees** | Keep 100% of payment |
| **Instant Settlement** | Money available immediately |
| **Auto Recording** | No manual entry needed |
| **Easy Reconciliation** | Clear audit trail |
| **Lower Cash Handling** | Reduced security risks |
| **Digital Reports** | Instant analytics |

### For Customers
| Feature | Benefit |
|---------|---------|
| **Fast Checkout** | No cash counting |
| **Digital Receipt** | Never lose receipts |
| **Transaction History** | Track all purchases |
| **Secure** | No physical money |
| **Convenient** | Pay from phone |
| **Rewards Ready** | Future loyalty integration |

### For Cashiers
| Feature | Benefit |
|---------|---------|
| **Simple Process** | Just select payment method |
| **No Change Needed** | No cash drawer errors |
| **Faster Transactions** | Serve more customers |
| **Easy Reconciliation** | Automatic balancing |
| **Less Stress** | No cash handling issues |

---

## 🚀 Quick Start

### For Cashiers
```
1. Ring up items as usual
2. Click "Checkout"
3. Recommend IcanEra Wallet to customer
4. Customer confirms on their phone
5. Payment received ✅
6. Print receipt
7. Next customer!
```

### For Customers (First Time)
```
1. Download IcanEra Wallet app
2. Register & verify account
3. Add funds to wallet
4. Ready to pay at any POS!
```

---

## 🔧 Technical Details

### API Integration
```javascript
// Receive Payment
const receivePayment = async (amount, customerId) => {
  return await icanEraWallet.receive({
    amount: amount,
    currency: 'UGX',
    from: customerId,
    to: supermarketId,
    purpose: 'POS_SALE',
    metadata: {
      items: cartItems,
      cashier: cashierId,
      location: branchId
    }
  });
};
```

### Real-time Updates
```javascript
// Subscribe to wallet updates
icanEraWallet.onTransactionComplete((transaction) => {
  updateBalance(transaction.amount);
  generateReceipt(transaction);
  updateInventory(transaction.items);
  notifyCashier('Payment received!');
});
```

---

## 📈 Reporting

### Daily Reports
- Total received via IcanEra Wallet
- Number of wallet transactions
- Average transaction value
- Peak transaction times
- Customer payment preferences

### Monthly Analytics
- Wallet adoption rate
- Transaction growth
- Customer retention via wallet
- Cash vs Digital ratio
- Revenue by payment method

---

## ❓ FAQ

**Q: What if customer doesn't have IcanEra Wallet?**
A: Cash payment is still available as backup.

**Q: Are there any fees?**
A: Zero fees for both supermarket and customer.

**Q: How fast is the transaction?**
A: Instant - typically under 2 seconds.

**Q: Can transactions be reversed?**
A: Contact admin for refunds through the wallet system.

**Q: Is it secure?**
A: Yes, all transactions are encrypted and verified.

**Q: Can I see transaction history?**
A: Yes, complete history in both POS and wallet app.

---

## 📞 Support

For technical support or integration help:
- Email: support@icanera.com
- Phone: +256 XXX XXX XXX
- Documentation: docs.icanera.com

---

**Last Updated**: January 23, 2025  
**Version**: 2.0 - Full Transaction Control
