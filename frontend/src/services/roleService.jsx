import { mockApi } from './mockApi';

// Mock data for initial roles
const defaultRoles = [
  {
    id: 1,
    name: 'Admin',
    description: 'Full system access with all permissions',
    permissions: {
      users: {
        view_users: true,
        create_users: true,
        edit_users: true,
        delete_users: true,
        bulk_actions: true,
        manage_roles: true
      },
      inventory: {
        view_inventory: true,
        add_items: true,
        edit_items: true,
        delete_items: true,
        manage_stock: true,
        view_reports: true
      },
      sales: {
        process_sales: true,
        view_sales: true,
        manage_discounts: true,
        void_sales: true,
        access_reports: true,
        manage_refunds: true
      },
      finance: {
        view_finances: true,
        manage_payments: true,
        handle_refunds: true,
        generate_reports: true,
        manage_expenses: true,
        view_analytics: true
      },
      settings: {
        view_settings: true,
        edit_settings: true,
        manage_integrations: true,
        system_backup: true,
        manage_notifications: true,
        access_logs: true
      }
    },
    created_at: '2025-09-19T10:00:00.000Z',
    updated_at: '2025-09-19T10:00:00.000Z'
  },
  {
    id: 2,
    name: 'Manager',
    description: 'Store management with limited administrative access',
    permissions: {
      users: {
        view_users: true,
        create_users: true,
        edit_users: true,
        delete_users: false,
        bulk_actions: true,
        manage_roles: false
      },
      inventory: {
        view_inventory: true,
        add_items: true,
        edit_items: true,
        delete_items: false,
        manage_stock: true,
        view_reports: true
      },
      sales: {
        process_sales: true,
        view_sales: true,
        manage_discounts: true,
        void_sales: true,
        access_reports: true,
        manage_refunds: false
      },
      finance: {
        view_finances: true,
        manage_payments: true,
        handle_refunds: false,
        generate_reports: true,
        manage_expenses: false,
        view_analytics: true
      },
      settings: {
        view_settings: true,
        edit_settings: false,
        manage_integrations: false,
        system_backup: false,
        manage_notifications: true,
        access_logs: true
      }
    },
    created_at: '2025-09-19T10:00:00.000Z',
    updated_at: '2025-09-19T10:00:00.000Z'
  }
];

class RoleService {
  constructor() {
    this.roles = [...defaultRoles];
  }

  // Get all roles
  async getRoles() {
    try {
      const response = await mockApi.get('/roles');
      return response.data || this.roles;
    } catch (error) {
      console.error('Error fetching roles:', error);
      return this.roles;
    }
  }

  // Get a specific role by ID
  async getRole(id) {
    try {
      const response = await mockApi.get(`/roles/${id}`);
      return response.data || this.roles.find(role => role.id === id);
    } catch (error) {
      console.error(`Error fetching role ${id}:`, error);
      return this.roles.find(role => role.id === id);
    }
  }

  // Create a new role
  async createRole(roleData) {
    try {
      const response = await mockApi.post('/roles', roleData);
      this.roles.push(response.data || roleData);
      return response.data || roleData;
    } catch (error) {
      console.error('Error creating role:', error);
      throw error;
    }
  }

  // Update an existing role
  async updateRole(id, roleData) {
    try {
      const response = await mockApi.put(`/roles/${id}`, roleData);
      const roleIndex = this.roles.findIndex(role => role.id === id);
      if (roleIndex !== -1) {
        this.roles[roleIndex] = { ...this.roles[roleIndex], ...roleData };
      }
      return response.data || this.roles[roleIndex];
    } catch (error) {
      console.error(`Error updating role ${id}:`, error);
      throw error;
    }
  }

  // Delete a role
  async deleteRole(id) {
    try {
      await mockApi.delete(`/roles/${id}`);
      this.roles = this.roles.filter(role => role.id !== id);
      return true;
    } catch (error) {
      console.error(`Error deleting role ${id}:`, error);
      throw error;
    }
  }

  // Assign a role to a user
  async assignRoleToUser(userId, roleId) {
    try {
      const response = await mockApi.post(`/users/${userId}/roles`, { roleId });
      return response.data;
    } catch (error) {
      console.error('Error assigning role:', error);
      throw error;
    }
  }

  // Remove a role from a user
  async removeRoleFromUser(userId, roleId) {
    try {
      await mockApi.delete(`/users/${userId}/roles/${roleId}`);
      return true;
    } catch (error) {
      console.error('Error removing role:', error);
      throw error;
    }
  }

  // Get roles for a specific user
  async getUserRoles(userId) {
    try {
      const response = await mockApi.get(`/users/${userId}/roles`);
      return response.data || [];
    } catch (error) {
      console.error(`Error fetching roles for user ${userId}:`, error);
      return [];
    }
  }

  // Check if a user has specific permissions
  async checkUserPermissions(userId, requiredPermissions) {
    try {
      const userRoles = await this.getUserRoles(userId);
      const rolePermissions = userRoles.map(roleId => 
        this.roles.find(role => role.id === roleId)?.permissions
      ).filter(Boolean);

      return requiredPermissions.every(permission => {
        const [category, action] = permission.split('.');
        return rolePermissions.some(
          permissions => permissions[category]?.[action]
        );
      });
    } catch (error) {
      console.error('Error checking permissions:', error);
      return false;
    }
  }
}

export const roleService = new RoleService();