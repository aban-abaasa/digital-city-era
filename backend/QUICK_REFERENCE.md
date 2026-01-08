# FAREDEAL Backend - Quick Reference Guide

## 🚀 Quick Start Commands

```bash
# Start server with health checks
npm start

# Start server directly
npm run start:direct

# Development mode (auto-reload)
npm run dev

# Check server health
npm run health
```

## 📡 Base URL
```
http://localhost:3001/api
```

## 🔑 Test Credentials

### Admin Account
- **Email:** admin@faredeal.co.ug
- **Password:** admin123
- **Role:** Administrator
- **Permissions:** Full system access

### Manager Account
- **Email:** manager@faredeal.co.ug
- **Password:** manager123
- **Role:** Manager
- **Permissions:** Store management

### Cashier Account
- **Email:** cashier@faredeal.co.ug
- **Password:** cashier123
- **Role:** Cashier
- **Permissions:** POS operations

## 📋 Common API Calls

### 1. Health Check
```powershell
Invoke-WebRequest -Uri "http://localhost:3001/api/health"
```

### 2. API Information
```powershell
Invoke-WebRequest -Uri "http://localhost:3001/api/info"
```

### 3. Login
```powershell
$loginBody = @{
    email = "admin@faredeal.co.ug"
    password = "admin123"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" `
    -Method POST `
    -Body $loginBody `
    -ContentType "application/json"

# Save the token
$token = $response.token
```

### 4. Get Products
```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/products" `
    -Method GET `
    -Headers @{Authorization = "Bearer $token"}
```

### 5. Get Employees
```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/employees" `
    -Method GET `
    -Headers @{Authorization = "Bearer $token"}
```

### 6. Dashboard Analytics
```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/analytics/dashboard" `
    -Method GET `
    -Headers @{Authorization = "Bearer $token"}
```

### 7. Portal Configuration
```powershell
# Get configuration
Invoke-RestMethod -Uri "http://localhost:3001/api/portal/config" -Method GET

# Update configuration
$configBody = @{
    config = @{
        companyName = "FAREDEAL Uganda"
        adminPortal = "Admin Control Center"
        currency = "UGX"
    }
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3001/api/portal/config" `
    -Method PUT `
    -Body $configBody `
    -ContentType "application/json"
```

### 8. Employee Access Control
```powershell
# Get access status
Invoke-RestMethod -Uri "http://localhost:3001/api/employees/access" -Method GET

# Update employee access
$accessBody = @{
    status = "disabled"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3001/api/employees/emp001/access" `
    -Method PUT `
    -Body $accessBody `
    -ContentType "application/json"

# Bulk update
$bulkBody = @{
    employeeIds = @("emp001", "emp002", "emp003")
    status = "active"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3001/api/employees/access/bulk" `
    -Method POST `
    -Body $bulkBody `
    -ContentType "application/json"
```

### 9. Payment Operations
```powershell
# Get payment history
Invoke-RestMethod -Uri "http://localhost:3001/api/payments?status=pending" -Method GET

# Create payment
$paymentBody = @{
    orderId = "ord-12345"
    amount = 50000
    currency = "UGX"
    paymentMethod = "mobile_money"
    mobileNumber = "+256700000000"
    network = "MTN"
    reference = "REF-001"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3001/api/payments" `
    -Method POST `
    -Body $paymentBody `
    -ContentType "application/json"

# Update payment status
$statusBody = @{
    status = "completed"
    transactionId = "TXN-12345"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3001/api/payments/payment-id/status" `
    -Method PUT `
    -Body $statusBody `
    -ContentType "application/json"
```

## 🔍 Troubleshooting

### Server won't start
```bash
# Check if port 3001 is in use
netstat -ano | findstr :3001

# Kill the process if needed
taskkill /PID <process_id> /F

# Restart server
npm start
```

### Database connection issues
1. Check `.env` file has correct Supabase credentials
2. Verify Supabase project is not paused
3. Check network connectivity
4. Review Supabase dashboard for errors

### API errors
1. Check server logs in console
2. Verify request format (JSON)
3. Check authentication token
4. Verify endpoint URL

## 📊 Response Formats

### Success Response
```json
{
  "success": true,
  "data": {},
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "error": "Error message",
  "timestamp": "2025-10-08T10:30:00Z",
  "path": "/api/endpoint"
}
```

## 🎯 Status Codes

- `200` - OK (Success)
- `201` - Created (Resource created successfully)
- `400` - Bad Request (Invalid input)
- `401` - Unauthorized (Authentication required)
- `404` - Not Found (Resource doesn't exist)
- `500` - Internal Server Error (Server issue)
- `503` - Service Unavailable (Database/service down)

## 📝 Notes

- Server runs on port 3001 by default
- All API endpoints start with `/api`
- Authentication uses JWT tokens
- Database is Supabase (PostgreSQL)
- Server logs all requests with timestamps
- Slow requests (>1s) are highlighted in logs

## 🔗 Resources

- **Supabase Dashboard:** https://app.supabase.com
- **API Documentation:** See UPDATE_SUMMARY.md
- **Environment Config:** See .env.example
- **Database Schema:** See database/schema.sql

---

**Quick Help:** For detailed documentation, see UPDATE_SUMMARY.md
