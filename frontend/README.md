# FAREDEAL - Point of Sale System

A modern, full-featured Point of Sale (POS) system built with React, Vite, and Tailwind CSS.

## Features

- **Dashboard** - Overview of sales, orders, customers, and key metrics
- **POS System** - Complete point-of-sale interface for processing transactions
- **Product Management** - Add, edit, view, and manage inventory
- **Sales Tracking** - View and manage sales history
- **Customer Management** - Track customer information and purchase history
- **Employee Management** - Manage staff and roles
- **Supplier Management** - Track supplier information and relationships
- **Inventory Management** - Monitor stock levels and manage inventory
- **Reports** - Analytics and reporting dashboard

## Technology Stack

- **Frontend**: React 19.1.1
- **Build Tool**: Vite 7.1.2
- **Styling**: Tailwind CSS 4.1.12
- **Icons**: React Icons (Feather)
- **Charts**: Recharts 3.1.2
- **Notifications**: React Toastify 11.0.5
- **Routing**: React Router DOM 7.8.2

## Getting Started

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd FAREDEAL/faredeal
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   Navigate to `http://localhost:5173` (or the port shown in terminal)

### Demo Login

The application includes mock authentication for development:
- **Username**: `admin`
- **Password**: `admin`

## Mock Data

The application currently uses a mock API service (`src/services/mockApi.js`) that provides:

- Sample products (iPhones, Samsung phones, MacBooks)
- Mock sales data
- Customer information
- Supplier data
- Employee records
- Dashboard analytics

## Project Structure

```
faredeal/
├── src/
│   ├── components/          # Reusable React components
│   │   ├── Layout.jsx       # Main layout wrapper
│   │   ├── ProtectedRoute.jsx # Route protection
│   │   └── ErrorBoundary.jsx # Error handling
│   ├── contexts/            # React contexts
│   │   └── AuthContext.jsx  # Authentication state
│   ├── pages/               # Main application pages
│   │   ├── Dashboard.jsx    # Main dashboard
│   │   ├── POS.jsx         # Point of sale system
│   │   ├── Products.jsx    # Product management
│   │   ├── Sales.jsx       # Sales history
│   │   ├── Customers.jsx   # Customer management
│   │   ├── Employees.jsx   # Employee management
│   │   ├── Suppliers.jsx   # Supplier management
│   │   ├── Inventory.jsx   # Inventory management
│   │   ├── Reports.jsx     # Analytics and reports
│   │   └── Login.jsx       # Authentication page
│   ├── services/           # API and external services
│   │   └── mockApi.js      # Mock API implementation
│   ├── App.jsx             # Main app component
│   ├── main.jsx            # Application entry point
│   └── index.css           # Global styles
├── public/                 # Static assets
├── package.json            # Dependencies and scripts
├── vite.config.js          # Vite configuration
└── README.md              # This file
```

## Key Features

### Dashboard
- Real-time sales metrics
- Recent sales overview
- Top-selling products
- Low stock alerts
- Quick navigation to all modules

### POS System
- Product search and filtering
- Shopping cart management
- Customer selection
- Multiple payment methods
- Receipt generation
- Real-time inventory updates

### Product Management
- Add/edit/delete products
- Bulk operations
- Category management
- Supplier assignment
- Stock level tracking
- Price management

### Sales Management
- Sales history viewing
- Transaction details
- Customer purchase tracking
- Sales analytics
- Export capabilities

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Development Notes

- The application bypasses authentication during development for easier testing
- Mock API responses simulate real backend behavior with delays
- Error boundaries provide graceful error handling
- Responsive design works on desktop and mobile devices
- Toast notifications provide user feedback for actions

## Customization

### Adding New Products
Products can be added through the Products page or by modifying the mock data in `src/services/mockApi.js`.

### Modifying Mock Data
Edit `src/services/mockApi.js` to customize:
- Product catalog
- Customer information
- Sales history
- Dashboard metrics

### Styling
The application uses Tailwind CSS. Modify styles by:
- Editing existing Tailwind classes in components
- Adding custom CSS in `src/index.css`
- Extending Tailwind configuration

## Production Deployment

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Deploy the `dist` folder** to your web server

3. **Configure backend API** by replacing the mock API service with real API calls

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For questions or support, please refer to the project documentation or create an issue in the repository.