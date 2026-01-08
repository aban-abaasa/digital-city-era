# FAREDEAL Backend System

## Overview
This is the backend system for FAREDEAL Point of Sale (POS) and Business Management System. It provides database management, API services, and business logic for the complete retail solution.

## Features

### 🗄️ Database Management
- **Comprehensive Schema**: Complete database schema for POS operations
- **User Management**: Multi-role user system (Admin, Manager, Employee, Cashier, Customer)
- **Product Management**: Full product catalog with categories and suppliers
- **Inventory Tracking**: Real-time inventory management with automatic updates
- **Sales Processing**: Complete sales transaction processing
- **Business Analytics**: Daily metrics and performance tracking

### 🔐 Security Features
- **Row Level Security (RLS)**: Database-level security policies
- **Role-based Permissions**: Granular access control
- **Data Encryption**: Sensitive data protection
- **Audit Logging**: Complete activity tracking

### 📊 Business Intelligence
- **Real-time Analytics**: Live business metrics
- **Performance Tracking**: Product and employee performance
- **Financial Reports**: Revenue, profit, and financial analytics
- **Inventory Analytics**: Stock levels and movement tracking

## Technology Stack

- **Database**: Supabase (PostgreSQL)
- **Runtime**: Node.js
- **Authentication**: JWT + Supabase Auth
- **ORM**: Supabase Client
- **Environment**: dotenv

## Project Structure

```
backend/
├── database/
│   ├── schema.sql              # Complete database schema
│   ├── migrations/             # Database migrations
│   └── seeds/
│       └── sample-data.sql     # Sample data for development
├── src/
│   ├── database-initializer.js # Database setup utility
│   ├── index.js               # Main application entry
│   ├── config/                # Configuration files
│   ├── routes/                # API route definitions
│   ├── middleware/            # Express middleware
│   ├── models/                # Data models
│   ├── services/              # Business logic services
│   └── utils/                 # Utility functions
├── logs/                      # Application logs
├── .env                       # Environment variables
├── .env.example              # Environment template
├── package.json              # Node.js dependencies
└── README.md                 # This file
```

## Quick Start

### 1. Prerequisites
- Node.js 18+ installed
- Supabase account and project
- Git

### 2. Installation

```bash
# Clone the repository
cd backend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your Supabase credentials
nano .env
```

### 3. Database Setup

#### Option A: Manual Setup (Recommended)
1. Open your Supabase SQL Editor
2. Copy and paste the content from `database/schema.sql`
3. Execute the SQL to create all tables and functions
4. Optionally run `database/seeds/sample-data.sql` for test data

#### Option B: Automated Setup
```bash
# Set your Supabase credentials in .env
npm run init-db
```

### 4. Start the Application

```bash
# Development mode
npm run dev

# Production mode
npm start
```

## Database Schema

### Core Tables
- **users**: User accounts with role-based access
- **categories**: Product categorization
- **suppliers**: Supplier management
- **products**: Product catalog
- **inventory**: Stock levels and tracking
- **sales**: Sales transactions
- **sale_items**: Individual sale line items
- **employees**: Employee management
- **customer_loyalty**: Customer rewards program

### Advanced Features
- **employee_attendance**: Time tracking
- **purchase_orders**: Supply chain management  
- **inventory_movements**: Stock movement history
- **daily_metrics**: Business analytics
- **audit_logs**: Security and compliance
- **system_settings**: Configuration management

### Database Views
- **product_inventory_view**: Combined product and inventory data
- **sales_summary_view**: Sales transaction summaries

## Environment Variables

Create a `.env` file with the following variables:

```env
# Database
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key

# Server
PORT=3001
NODE_ENV=development

# Security
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d

# Business
BUSINESS_NAME=FAREDEAL
BUSINESS_CURRENCY=UGX
BUSINESS_TAX_RATE=18
```

## Default Users

After running the schema, these users are available:

| Role | Email | Password | Description |
|------|-------|----------|-------------|
| Admin | admin@faredeal.co.ug | admin123 | System administrator |
| Manager | manager@faredeal.co.ug | manager123 | Store manager |
| Cashier | cashier@faredeal.co.ug | cashier123 | Point of sale operator |

## API Endpoints (Planned)

### Authentication
- `POST /auth/login` - User authentication
- `POST /auth/logout` - User logout
- `POST /auth/refresh` - Token refresh
- `GET /auth/profile` - Get user profile

### Products & Inventory
- `GET /products` - List products with inventory
- `POST /products` - Create new product
- `PUT /products/:id` - Update product
- `GET /inventory/alerts` - Low stock alerts
- `POST /inventory/adjustment` - Stock adjustment

### Sales & POS
- `POST /sales` - Process sale transaction
- `GET /sales` - Sales history
- `GET /sales/:id` - Sale details
- `POST /sales/:id/refund` - Process refund

### Business Intelligence
- `GET /analytics/dashboard` - Dashboard metrics
- `GET /analytics/sales` - Sales analytics
- `GET /analytics/products` - Product performance
- `GET /reports/daily` - Daily business reports

## Security Features

### Row Level Security (RLS)
- Users can only access their own data
- Role-based data access controls
- Managers can access team data
- Admins have full system access

### Data Protection
- Password hashing with bcrypt
- JWT token authentication
- Input validation and sanitization
- SQL injection prevention

## Business Logic

### Inventory Management
- Automatic stock updates after sales
- Low stock alerts and notifications
- Stock movement tracking
- Automatic reorder point calculations

### Sales Processing
- Multi-payment method support
- Tax calculation and application
- Customer loyalty points
- Receipt generation

### User Management
- Role-based permissions
- Employee attendance tracking
- Customer relationship management
- Supplier relationship management

## Development

### Adding New Features
1. Create database migrations in `database/migrations/`
2. Add API routes in `src/routes/`
3. Implement business logic in `src/services/`
4. Add data models in `src/models/`
5. Update tests and documentation

### Database Migrations
```bash
# Create new migration
touch database/migrations/$(date +%Y%m%d_%H%M%S)_description.sql

# Apply migrations manually in Supabase SQL Editor
```

### Testing
```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## Production Deployment

### Environment Setup
1. Set `NODE_ENV=production`
2. Use strong JWT secrets
3. Configure proper CORS settings
4. Set up SSL/TLS certificates
5. Configure logging and monitoring

### Database Security
1. Enable RLS on all sensitive tables
2. Use service role key securely
3. Set up database backups
4. Monitor for suspicious activity

## Troubleshooting

### Common Issues

1. **Connection Error**
   - Verify Supabase URL and keys
   - Check network connectivity
   - Ensure project is not paused

2. **Permission Denied**
   - Verify RLS policies are correct
   - Check user roles and permissions
   - Ensure proper authentication

3. **Schema Issues**
   - Run schema.sql in correct order
   - Check for naming conflicts
   - Verify foreign key constraints

### Support
- Check logs in `logs/` directory
- Enable debug mode: `LOG_LEVEL=debug`
- Review Supabase dashboard for errors

## License
MIT License - see LICENSE file for details

## Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

---

**FAREDEAL Backend System** - Powering modern retail operations in Uganda and beyond.