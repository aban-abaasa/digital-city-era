import { supabase, handleSupabaseError } from './supabaseClient';
import { apiService } from './apiService';

export const customerService = {
  // Register new customer
  register: async (customerData) => {
    try {
      // First create auth user
      const { data: authUser, error: authError } = await supabase.auth.signUp({
        phone: customerData.phone,
        password: customerData.password,
        options: {
          data: {
            full_name: customerData.full_name,
            phone: customerData.phone
          }
        }
      });

      if (authError) throw handleSupabaseError(authError);

      // Then create customer record
      const customerRecord = {
        id: authUser.user.id,
        full_name: customerData.full_name,
        phone: customerData.phone,
        email: customerData.email,
        date_of_birth: customerData.date_of_birth,
        gender: customerData.gender,
        preferred_language: customerData.preferred_language || 'en',
        registration_date: new Date().toISOString().split('T')[0],
        is_active: true,
        customer_type: 'individual'
      };

      const customer = await apiService.post('customers', customerRecord);

      return {
        user: authUser.user,
        customer: customer,
        session: authUser.session
      };
    } catch (error) {
      throw error;
    }
  },

  // Login customer
  login: async (phone, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        phone: phone,
        password: password
      });

      if (error) throw handleSupabaseError(error);

      // Get customer details
      const customer = await apiService.getById('customers', data.user.id);

      return {
        user: data.user,
        customer: customer,
        session: data.session
      };
    } catch (error) {
      throw error;
    }
  },

  // Get customer by phone for biometric auth
  getByPhone: async (phone) => {
    try {
      const result = await apiService.get('customers', {
        filters: { phone: phone },
        limit: 1
      });

      if (!result.data || result.data.length === 0) {
        throw { message: 'Customer not found', code: 404 };
      }

      return result.data[0];
    } catch (error) {
      throw error;
    }
  },

  // Verify customer biometric data
  verifyBiometric: async (customerId, biometricData) => {
    try {
      // Get customer with biometric data
      const customer = await apiService.getById('customers', customerId, {
        select: 'id, full_name, phone, biometric_data'
      });

      if (!customer) {
        throw { message: 'Customer not found', code: 404 };
      }

      // Compare biometric data (this would be more sophisticated in real implementation)
      const isValid = customer.biometric_data === biometricData;

      return {
        isValid,
        customer: isValid ? customer : null
      };
    } catch (error) {
      throw error;
    }
  },

  // Update customer profile
  updateProfile: async (customerId, data) => {
    try {
      const customer = await apiService.put('customers', customerId, data);
      return customer;
    } catch (error) {
      throw error;
    }
  },

  // Get customer loyalty information
  getLoyaltyPoints: async (customerId) => {
    try {
      // Get customer loyalty membership with program details
      const membership = await apiService.get('customer_loyalty_memberships', {
        filters: { customer_id: customerId },
        select: `
          *,
          loyalty_programs (
            id,
            name,
            points_per_ugx,
            welcome_bonus_points
          ),
          loyalty_tiers (
            id,
            name,
            min_points,
            benefits,
            multiplier
          )
        `,
        limit: 1
      });

      if (!membership.data || membership.data.length === 0) {
        return {
          points_balance: 0,
          tier: null,
          program: null,
          lifetime_points: 0
        };
      }

      return membership.data[0];
    } catch (error) {
      throw error;
    }
  },

  // Use loyalty points
  useLoyaltyPoints: async (customerId, points, description = 'Points redemption') => {
    try {
      // Create points transaction
      const transaction = {
        customer_id: customerId,
        transaction_type: 'redemption',
        points: -Math.abs(points), // Make sure it's negative for redemption
        description: description,
        transaction_date: new Date().toISOString()
      };

      const result = await apiService.post('loyalty_point_transactions', transaction);
      
      // Update customer loyalty membership balance
      const membership = await apiService.get('customer_loyalty_memberships', {
        filters: { customer_id: customerId },
        limit: 1
      });

      if (membership.data && membership.data.length > 0) {
        const currentBalance = membership.data[0].points_balance;
        await apiService.put('customer_loyalty_memberships', membership.data[0].id, {
          points_balance: currentBalance - Math.abs(points)
        });
      }

      return result;
    } catch (error) {
      throw error;
    }
  },

  // Get customer order history
  getOrderHistory: async (customerId) => {
    try {
      const orders = await apiService.get('orders', {
        filters: { customer_id: customerId },
        select: `
          *,
          order_items (
            id,
            product_id,
            quantity,
            unit_price,
            products (
              id,
              name,
              sku
            )
          )
        `,
        orderBy: { column: 'created_at', ascending: false }
      });

      return orders.data || [];
    } catch (error) {
      throw error;
    }
  },

  // Create guest checkout
  createGuestCheckout: async (guestData) => {
    try {
      // Create a temporary customer record for guest checkout
      const guestCustomer = {
        full_name: guestData.full_name,
        phone: guestData.phone,
        email: guestData.email,
        customer_type: 'guest',
        registration_date: new Date().toISOString().split('T')[0],
        is_active: true
      };

      const customer = await apiService.post('customers', guestCustomer);
      return customer;
    } catch (error) {
      throw error;
    }
  },

  // Get customer addresses
  getCustomerAddresses: async (customerId) => {
    try {
      const addresses = await apiService.get('customer_addresses', {
        filters: { customer_id: customerId },
        orderBy: { column: 'is_default', ascending: false }
      });

      return addresses.data || [];
    } catch (error) {
      throw error;
    }
  },

  // Add customer address
  addCustomerAddress: async (customerId, addressData) => {
    try {
      const address = {
        customer_id: customerId,
        ...addressData
      };

      // If this is marked as default, unset other default addresses
      if (address.is_default) {
        await apiService.patch('customer_addresses', 
          { is_default: false }, 
          { customer_id: customerId }
        );
      }

      const result = await apiService.post('customer_addresses', address);
      return result;
    } catch (error) {
      throw error;
    }
  },

  // Update customer address
  updateCustomerAddress: async (addressId, addressData) => {
    try {
      // If this is marked as default, unset other default addresses for this customer
      if (addressData.is_default) {
        const address = await apiService.getById('customer_addresses', addressId);
        if (address) {
          await apiService.patch('customer_addresses', 
            { is_default: false }, 
            { customer_id: address.customer_id }
          );
        }
      }

      const result = await apiService.put('customer_addresses', addressId, addressData);
      return result;
    } catch (error) {
      throw error;
    }
  },

  // Delete customer address
  deleteCustomerAddress: async (addressId) => {
    try {
      const result = await apiService.delete('customer_addresses', addressId);
      return result;
    } catch (error) {
      throw error;
    }
  }
};

export default customerService;




