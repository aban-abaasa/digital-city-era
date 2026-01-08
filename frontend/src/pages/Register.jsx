import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { employeeService } from '../services/employeeService';
import { supplierService } from '../services/supplierService';
import { managerService } from '../services/managerService';
import { toast } from 'react-toastify';
import './styles/Register.css';

const Register = () => {
  const [userType, setUserType] = useState('customer');
  const [formData, setFormData] = useState({
    // Common fields
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    
    // Customer fields
    full_name: '',
    date_of_birth: '',
    address: '',
    city: '',
    
    // Employee fields
    employee_id: '',
    department: '',
    role: 'sales_associate',
    hire_date: '',
    
    // Manager fields
    manager_level: 'store_manager',
    access_level: 'standard',
    salary: '',
    
    // Admin fields
    admin_id: '',
    admin_department: 'administration',
    
    // Supplier fields
    company_name: '',
    contact_person: '',
    supplier_code: '',
    tax_id: '',
    bank_account: '',
    payment_terms: 'Net 30',
    country: 'Uganda'
  });
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const { register, employeeRegister, supplierRegister, managerRegister, adminRegister } = useAuth();
  const navigate = useNavigate();

  // Real-time field validation
  const validateField = (fieldName, value) => {
    const currentSchema = validationSchemas[userType];
    
    if (!currentSchema) return null;

    // Check if field is relevant for current user type
    const isRelevantField = currentSchema.required.includes(fieldName) || 
                           Object.keys(currentSchema.custom).includes(fieldName);
    
    if (!isRelevantField) return null;

    // Validate common fields
    if (commonValidation[fieldName]) {
      return commonValidation[fieldName](value);
    }

    // Validate role-specific fields
    if (currentSchema.custom[fieldName]) {
      return currentSchema.custom[fieldName](value);
    }

    return null;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Real-time validation only for relevant fields
    const fieldError = validateField(name, value);
    setErrors(prev => ({
      ...prev,
      [name]: fieldError || ''
    }));
  };

  // Clear errors when user type changes
  const handleUserTypeChange = (newUserType) => {
    setUserType(newUserType);
    setErrors({}); // Clear all errors when switching roles
    
    // Optionally, reset form data to default values for new role
    setFormData(prev => {
      const commonFields = {
        email: prev.email,
        password: prev.password,
        confirmPassword: prev.confirmPassword,
        phone: prev.phone
      };
      
      // Keep only common fields and reset role-specific fields
      return {
        ...prev,
        ...commonFields,
        // Reset role-specific fields to defaults
        full_name: '',
        date_of_birth: '',
        address: '',
        city: '',
        employee_id: '',
        department: '',
        role: 'sales_associate',
        hire_date: '',
        manager_level: 'store_manager',
        access_level: 'standard',
        salary: '',
        admin_id: '',
        admin_department: 'administration',
        company_name: '',
        contact_person: '',
        supplier_code: '',
        tax_id: '',
        bank_account: '',
        payment_terms: 'Net 30',
        country: 'Uganda'
      };
    });
  };

  // Role-specific validation schemas
  const validationSchemas = {
    customer: {
      required: ['email', 'password', 'confirmPassword', 'phone', 'full_name', 'date_of_birth', 'address', 'city'],
      custom: {
        full_name: (value) => !value ? 'Full name is required' : null,
        date_of_birth: (value) => !value ? 'Date of birth is required' : null,
        address: (value) => !value ? 'Address is required' : null,
        city: (value) => !value ? 'City is required' : null
      }
    },
    employee: {
      required: ['email', 'password', 'confirmPassword', 'phone', 'full_name', 'employee_id', 'department', 'role'],
      custom: {
        full_name: (value) => !value ? 'Full name is required' : null,
        employee_id: (value) => !value ? 'Employee ID is required' : null,
        department: (value) => !value ? 'Department is required' : null,
        role: (value) => !value ? 'Role is required' : null,
        hire_date: (value) => value && new Date(value) > new Date() ? 'Hire date cannot be in the future' : null
      }
    },
    manager: {
      required: ['email', 'password', 'confirmPassword', 'phone', 'full_name', 'employee_id', 'department', 'manager_level', 'access_level'],
      custom: {
        full_name: (value) => !value ? 'Full name is required' : null,
        employee_id: (value) => !value ? 'Manager ID is required' : null,
        department: (value) => !value ? 'Department is required' : null,
        manager_level: (value) => !value ? 'Manager level is required' : null,
        access_level: (value) => !value ? 'Access level is required' : null,
        salary: (value) => value && (isNaN(value) || Number(value) < 0) ? 'Salary must be a positive number' : null
      }
    },
    admin: {
      required: ['email', 'password', 'confirmPassword', 'phone', 'full_name', 'admin_id'],
      custom: {
        full_name: (value) => !value ? 'Full name is required' : null,
        admin_id: (value) => !value ? 'Admin ID is required' : null,
        admin_department: (value) => !value ? 'Department is required' : null,
        phone: (value) => {
          if (!value) return 'Phone number is required';
          const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
          return !phoneRegex.test(value) ? 'Invalid phone number format' : null;
        }
      }
    },
    supplier: {
      required: ['email', 'password', 'confirmPassword', 'phone', 'company_name', 'contact_person', 'supplier_code', 'address', 'city'],
      custom: {
        company_name: (value) => !value ? 'Company name is required' : null,
        contact_person: (value) => !value ? 'Contact person is required' : null,
        supplier_code: (value) => {
          if (!value) return 'Supplier code is required';
          if (value.length < 3) return 'Supplier code must be at least 3 characters';
          return null;
        },
        address: (value) => !value ? 'Address is required' : null,
        city: (value) => !value ? 'City is required' : null,
        tax_id: (value) => value && value.length < 5 ? 'Tax ID must be at least 5 characters' : null,
        bank_account: (value) => value && value.length < 10 ? 'Bank account must be at least 10 characters' : null
      }
    }
  };

  // Common validation rules
  const commonValidation = {
    email: (value) => {
      if (!value) return 'Email is required';
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return !emailRegex.test(value) ? 'Invalid email format' : null;
    },
    password: (value) => {
      if (!value) return 'Password is required';
      if (value.length < 8) return 'Password must be at least 8 characters';
      if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
        return 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
      }
      return null;
    },
    confirmPassword: (value) => {
      if (!value) return 'Please confirm your password';
      return value !== formData.password ? 'Passwords do not match' : null;
    },
    phone: (value) => {
      if (!value) return 'Phone number is required';
      const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
      return !phoneRegex.test(value) ? 'Invalid phone number format' : null;
    }
  };

  const validateForm = () => {
    const newErrors = {};
    const currentSchema = validationSchemas[userType];

    if (!currentSchema) {
      console.error(`No validation schema found for user type: ${userType}`);
      return false;
    }

    // Validate common fields
    Object.keys(commonValidation).forEach(field => {
      if (currentSchema.required.includes(field)) {
        const error = commonValidation[field](formData[field]);
        if (error) newErrors[field] = error;
      }
    });

    // Validate role-specific fields
    Object.keys(currentSchema.custom).forEach(field => {
      const error = currentSchema.custom[field](formData[field]);
      if (error) newErrors[field] = error;
    });

    // Additional validations based on user type
    if (userType === 'customer') {
      // Age validation for customers
      if (formData.date_of_birth) {
        const birthDate = new Date(formData.date_of_birth);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        if (age < 13) {
          newErrors.date_of_birth = 'Must be at least 13 years old';
        }
        if (birthDate > today) {
          newErrors.date_of_birth = 'Birth date cannot be in the future';
        }
      }
    }

    if (userType === 'employee' || userType === 'manager') {
      // Employee ID format validation
      if (formData.employee_id && !/^[A-Z]{2,3}\d{3,6}$/.test(formData.employee_id)) {
        newErrors.employee_id = 'Employee ID format: 2-3 letters followed by 3-6 digits (e.g., EMP123456)';
      }
    }

    if (userType === 'admin') {
      // Admin ID format validation
      if (formData.admin_id && !/^ADM\d{3,6}$/.test(formData.admin_id)) {
        newErrors.admin_id = 'Admin ID format: ADM followed by 3-6 digits (e.g., ADM123456)';
      }
    }

    if (userType === 'supplier') {
      // Supplier code format validation
      if (formData.supplier_code && !/^SUP[A-Z0-9]{3,8}$/.test(formData.supplier_code)) {
        newErrors.supplier_code = 'Supplier code format: SUP followed by 3-8 alphanumeric characters (e.g., SUPABC123)';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fix the validation errors');
      return;
    }

    setLoading(true);

    try {
      if (userType === 'customer') {
        // Direct registration for customers
        await register({
          email: formData.email,
          password: formData.password,
          phone: formData.phone,
          full_name: formData.full_name,
          date_of_birth: formData.date_of_birth,
          address: formData.address,
          city: formData.city
        });
        
        toast.success('Account created successfully! Welcome!');
        navigate('/customer-dashboard');
        
      } else if (userType === 'employee') {
        // Employee registration requires manager approval
        const result = await employeeService.register({
          email: formData.email,
          password: formData.password,
          phone: formData.phone,
          full_name: formData.full_name,
          employee_id: formData.employee_id,
          department: formData.department,
          role: formData.role,
          hire_date: formData.hire_date || new Date().toISOString().split('T')[0]
        });
        
        toast.success('Employee registration submitted! Please wait for manager approval.');
        navigate('/login', { 
          state: { 
            message: 'Your registration is pending manager approval. You will be notified once approved.',
            userType: 'employee'
          }
        });
        
      } else if (userType === 'manager') {
        // Manager registration with immediate approval for development
        const result = await managerRegister({
          email: formData.email,
          password: formData.password,
          phone: formData.phone,
          full_name: formData.full_name,
          employee_id: formData.employee_id,
          department: formData.department,
          manager_level: formData.manager_level,
          access_level: formData.access_level,
          hire_date: formData.hire_date || new Date().toISOString().split('T')[0],
          salary: formData.salary
        });
        
        if (result.success) {
          toast.success('Manager account created successfully! Welcome to FAREDEAL.');
          navigate('/manager-portal');
        }
        
      } else if (userType === 'admin') {
        // Admin registration with immediate approval for development
        const result = await adminRegister({
          email: formData.email,
          password: formData.password,
          phone: formData.phone,
          full_name: formData.full_name,
          admin_id: formData.admin_id,
          department: formData.admin_department || 'administration'
        });
        
        if (result.success) {
          toast.success('Admin account created successfully! Welcome to FAREDEAL Administration.');
          
          // Wait a moment for the auth state to update before navigating
          setTimeout(() => {
            navigate('/admin-portal');
          }, 500);
        }
        
      } else if (userType === 'supplier') {
        // Supplier registration requires manager approval
        const result = await supplierService.register({
          email: formData.email,
          password: formData.password,
          phone: formData.phone,
          company_name: formData.company_name,
          contact_person: formData.contact_person,
          supplier_code: formData.supplier_code,
          address: formData.address,
          city: formData.city,
          country: formData.country,
          tax_id: formData.tax_id,
          bank_account: formData.bank_account,
          payment_terms: formData.payment_terms
        });
        
        toast.success('Supplier registration submitted! Please wait for manager approval.');
        navigate('/login', { 
          state: { 
            message: 'Your registration is pending manager approval. You will be notified once approved.',
            userType: 'supplier'
          }
        });
      }
      
    } catch (error) {
      console.error('Registration error:', error);
      toast.error(error.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderCustomerFields = () => (
    <>
      <div className="form-group">
        <label htmlFor="full_name">Full Name *</label>
        <input
          type="text"
          id="full_name"
          name="full_name"
          value={formData.full_name}
          onChange={handleInputChange}
          className={errors.full_name ? 'error' : ''}
          placeholder="Enter your full name"
        />
        {errors.full_name && <span className="error-text">{errors.full_name}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="date_of_birth">Date of Birth *</label>
        <input
          type="date"
          id="date_of_birth"
          name="date_of_birth"
          value={formData.date_of_birth}
          onChange={handleInputChange}
          className={errors.date_of_birth ? 'error' : ''}
        />
        {errors.date_of_birth && <span className="error-text">{errors.date_of_birth}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="address">Address *</label>
        <textarea
          id="address"
          name="address"
          value={formData.address}
          onChange={handleInputChange}
          className={errors.address ? 'error' : ''}
          placeholder="Enter your address"
          rows="3"
        />
        {errors.address && <span className="error-text">{errors.address}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="city">City *</label>
        <input
          type="text"
          id="city"
          name="city"
          value={formData.city}
          onChange={handleInputChange}
          className={errors.city ? 'error' : ''}
          placeholder="Enter your city"
        />
        {errors.city && <span className="error-text">{errors.city}</span>}
      </div>
    </>
  );

  const renderManagerFields = () => (
    <>
      <div className="form-group">
        <label htmlFor="full_name">Full Name *</label>
        <input
          type="text"
          id="full_name"
          name="full_name"
          value={formData.full_name}
          onChange={handleInputChange}
          className={errors.full_name ? 'error' : ''}
          placeholder="Enter your full name"
        />
        {errors.full_name && <span className="error-text">{errors.full_name}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="employee_id">Manager ID *</label>
        <input
          type="text"
          id="employee_id"
          name="employee_id"
          value={formData.employee_id}
          onChange={handleInputChange}
          className={errors.employee_id ? 'error' : ''}
          placeholder="Enter your manager ID"
        />
        {errors.employee_id && <span className="error-text">{errors.employee_id}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="department">Department *</label>
        <select
          id="department"
          name="department"
          value={formData.department}
          onChange={handleInputChange}
          className={errors.department ? 'error' : ''}
        >
          <option value="">Select Department</option>
          <option value="management">Management</option>
          <option value="sales">Sales</option>
          <option value="inventory">Inventory</option>
          <option value="finance">Finance</option>
          <option value="hr">Human Resources</option>
          <option value="operations">Operations</option>
          <option value="it">IT Support</option>
        </select>
        {errors.department && <span className="error-text">{errors.department}</span>}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="manager_level">Manager Level *</label>
          <select
            id="manager_level"
            name="manager_level"
            value={formData.manager_level}
            onChange={handleInputChange}
            className={errors.manager_level ? 'error' : ''}
          >
            <option value="store_manager">Store Manager</option>
            <option value="department_manager">Department Manager</option>
            <option value="district_manager">District Manager</option>
            <option value="regional_manager">Regional Manager</option>
          </select>
          {errors.manager_level && <span className="error-text">{errors.manager_level}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="access_level">Access Level *</label>
          <select
            id="access_level"
            name="access_level"
            value={formData.access_level}
            onChange={handleInputChange}
            className={errors.access_level ? 'error' : ''}
          >
            <option value="standard">Standard Access</option>
            <option value="advanced">Advanced Access</option>
            <option value="full">Full Access</option>
          </select>
          {errors.access_level && <span className="error-text">{errors.access_level}</span>}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="hire_date">Start Date</label>
          <input
            type="date"
            id="hire_date"
            name="hire_date"
            value={formData.hire_date}
            onChange={handleInputChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="salary">Salary (Optional)</label>
          <input
            type="number"
            id="salary"
            name="salary"
            value={formData.salary}
            onChange={handleInputChange}
            placeholder="Enter salary amount"
            min="0"
          />
        </div>
      </div>

      <div className="verification-notice">
        <i className="fas fa-info-circle"></i>
        <p>Manager registrations require super admin approval. This is a higher level of verification that may take additional time to process.</p>
      </div>
    </>
  );

  const renderEmployeeFields = () => (
    <>
      <div className="form-group">
        <label htmlFor="full_name">Full Name *</label>
        <input
          type="text"
          id="full_name"
          name="full_name"
          value={formData.full_name}
          onChange={handleInputChange}
          className={errors.full_name ? 'error' : ''}
          placeholder="Enter your full name"
        />
        {errors.full_name && <span className="error-text">{errors.full_name}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="employee_id">Employee ID *</label>
        <input
          type="text"
          id="employee_id"
          name="employee_id"
          value={formData.employee_id}
          onChange={handleInputChange}
          className={errors.employee_id ? 'error' : ''}
          placeholder="Enter your employee ID"
        />
        {errors.employee_id && <span className="error-text">{errors.employee_id}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="department">Department *</label>
        <select
          id="department"
          name="department"
          value={formData.department}
          onChange={handleInputChange}
          className={errors.department ? 'error' : ''}
        >
          <option value="">Select Department</option>
          <option value="sales">Sales</option>
          <option value="inventory">Inventory</option>
          <option value="finance">Finance</option>
          <option value="hr">Human Resources</option>
          <option value="it">IT Support</option>
          <option value="management">Management</option>
        </select>
        {errors.department && <span className="error-text">{errors.department}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="role">Role *</label>
        <select
          id="role"
          name="role"
          value={formData.role}
          onChange={handleInputChange}
          className={errors.role ? 'error' : ''}
        >
          <option value="sales_associate">Sales Associate</option>
          <option value="cashier">Cashier</option>
          <option value="inventory_manager">Inventory Manager</option>
          <option value="manager">Manager</option>
        </select>
        {errors.role && <span className="error-text">{errors.role}</span>}
      </div>

      <div className="verification-notice">
        <i className="fas fa-info-circle"></i>
        <p>Employee registrations require manager approval. You will receive an email notification once your account is approved.</p>
      </div>
    </>
  );

  const renderSupplierFields = () => (
    <>
      <div className="form-group">
        <label htmlFor="company_name">Company Name *</label>
        <input
          type="text"
          id="company_name"
          name="company_name"
          value={formData.company_name}
          onChange={handleInputChange}
          className={errors.company_name ? 'error' : ''}
          placeholder="Enter company name"
        />
        {errors.company_name && <span className="error-text">{errors.company_name}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="contact_person">Contact Person *</label>
        <input
          type="text"
          id="contact_person"
          name="contact_person"
          value={formData.contact_person}
          onChange={handleInputChange}
          className={errors.contact_person ? 'error' : ''}
          placeholder="Enter contact person name"
        />
        {errors.contact_person && <span className="error-text">{errors.contact_person}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="supplier_code">Supplier Code *</label>
        <input
          type="text"
          id="supplier_code"
          name="supplier_code"
          value={formData.supplier_code}
          onChange={handleInputChange}
          className={errors.supplier_code ? 'error' : ''}
          placeholder="Enter unique supplier code"
        />
        {errors.supplier_code && <span className="error-text">{errors.supplier_code}</span>}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="tax_id">Tax ID</label>
          <input
            type="text"
            id="tax_id"
            name="tax_id"
            value={formData.tax_id}
            onChange={handleInputChange}
            placeholder="Enter tax identification number"
          />
        </div>

        <div className="form-group">
          <label htmlFor="payment_terms">Payment Terms</label>
          <select
            id="payment_terms"
            name="payment_terms"
            value={formData.payment_terms}
            onChange={handleInputChange}
          >
            <option value="Net 15">Net 15 days</option>
            <option value="Net 30">Net 30 days</option>
            <option value="Net 60">Net 60 days</option>
            <option value="COD">Cash on Delivery</option>
          </select>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="address">Address *</label>
        <textarea
          id="address"
          name="address"
          value={formData.address}
          onChange={handleInputChange}
          className={errors.address ? 'error' : ''}
          placeholder="Enter company address"
          rows="3"
        />
        {errors.address && <span className="error-text">{errors.address}</span>}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="city">City *</label>
          <input
            type="text"
            id="city"
            name="city"
            value={formData.city}
            onChange={handleInputChange}
            className={errors.city ? 'error' : ''}
            placeholder="Enter city"
          />
          {errors.city && <span className="error-text">{errors.city}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="country">Country</label>
          <select
            id="country"
            name="country"
            value={formData.country}
            onChange={handleInputChange}
          >
            <option value="Uganda">Uganda</option>
            <option value="Kenya">Kenya</option>
            <option value="Tanzania">Tanzania</option>
            <option value="Rwanda">Rwanda</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      <div className="verification-notice">
        <i className="fas fa-info-circle"></i>
        <p>Supplier registrations require manager approval. You will receive an email notification once your account is verified and approved.</p>
      </div>
    </>
  );

  const renderAdminFields = () => (
    <>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="full_name">Full Name *</label>
          <input
            type="text"
            id="full_name"
            name="full_name"
            value={formData.full_name}
            onChange={handleInputChange}
            className={errors.full_name ? 'error' : ''}
            placeholder="Enter your full name"
          />
          {errors.full_name && <span className="error-text">{errors.full_name}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="admin_id">Admin ID *</label>
          <input
            type="text"
            id="admin_id"
            name="admin_id"
            value={formData.admin_id}
            onChange={handleInputChange}
            className={errors.admin_id ? 'error' : ''}
            placeholder="e.g., ADM-001"
          />
          {errors.admin_id && <span className="error-text">{errors.admin_id}</span>}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="phone">Phone Number *</label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            className={errors.phone ? 'error' : ''}
            placeholder="+256 XXX XXX XXX"
          />
          {errors.phone && <span className="error-text">{errors.phone}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="admin_department">Department</label>
          <select
            id="admin_department"
            name="admin_department"
            value={formData.admin_department}
            onChange={handleInputChange}
          >
            <option value="administration">Administration</option>
            <option value="operations">Operations</option>
            <option value="finance">Finance</option>
            <option value="technology">Technology</option>
            <option value="human_resources">Human Resources</option>
          </select>
        </div>
      </div>

      <div className="admin-notice">
        <i className="fas fa-shield-alt"></i>
        <p><strong>Administrative Access:</strong> Admin accounts have full system access including user management, system settings, and database operations. Please ensure you have authorization to create an admin account.</p>
      </div>
    </>
  );

  return (
    <div className="register-container">
      <div className="register-card">
        <div className="register-header">
          <h1>Create Account</h1>
          <p>Join FAREDEAL and start your journey with us</p>
        </div>

        <div className="user-type-tabs">
          <button
            type="button"
            className={`tab ${userType === 'customer' ? 'active' : ''}`}
            onClick={() => handleUserTypeChange('customer')}
          >
            <i className="fas fa-user"></i>
            Customer
          </button>
          <button
            type="button"
            className={`tab ${userType === 'employee' ? 'active' : ''}`}
            onClick={() => handleUserTypeChange('employee')}
          >
            <i className="fas fa-id-badge"></i>
            Employee
          </button>
          <button
            type="button"
            className={`tab ${userType === 'manager' ? 'active' : ''}`}
            onClick={() => handleUserTypeChange('manager')}
          >
            <i className="fas fa-user-tie"></i>
            Manager
          </button>
          <button
            type="button"
            className={`tab ${userType === 'supplier' ? 'active' : ''}`}
            onClick={() => handleUserTypeChange('supplier')}
          >
            <i className="fas fa-truck"></i>
            Supplier
          </button>
          <button
            type="button"
            className={`tab ${userType === 'admin' ? 'active' : ''}`}
            onClick={() => handleUserTypeChange('admin')}
          >
            <i className="fas fa-user-shield"></i>
            Admin
          </button>
        </div>

        <form onSubmit={handleSubmit} className="register-form">
          {/* Common Fields */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="email">Email Address *</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={errors.email ? 'error' : ''}
                placeholder="Enter your email"
              />
              {errors.email && <span className="error-text">{errors.email}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="phone">Phone Number *</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className={errors.phone ? 'error' : ''}
                placeholder="Enter your phone number"
              />
              {errors.phone && <span className="error-text">{errors.phone}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="password">Password *</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className={errors.password ? 'error' : ''}
                placeholder="Enter your password"
              />
              {errors.password && <span className="error-text">{errors.password}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password *</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className={errors.confirmPassword ? 'error' : ''}
                placeholder="Confirm your password"
              />
              {errors.confirmPassword && <span className="error-text">{errors.confirmPassword}</span>}
            </div>
          </div>

          {/* User Type Specific Fields */}
          {userType === 'customer' && renderCustomerFields()}
          {userType === 'employee' && renderEmployeeFields()}
          {userType === 'manager' && renderManagerFields()}
          {userType === 'supplier' && renderSupplierFields()}
          {userType === 'admin' && renderAdminFields()}

          <button
            type="submit"
            className="register-btn"
            disabled={loading}
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                Creating Account...
              </>
            ) : (
              <>
                <i className="fas fa-user-plus"></i>
                Create {userType.charAt(0).toUpperCase() + userType.slice(1)} Account
              </>
            )}
          </button>
        </form>

        <div className="register-footer">
          <p>
            Already have an account?{' '}
            <Link to="/login" className="login-link">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;