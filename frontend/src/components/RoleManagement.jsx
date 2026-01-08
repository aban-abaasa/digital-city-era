import React, { useState, useEffect } from 'react';
import {
  FiShield, FiLock, FiPlus, FiEdit2, FiTrash2,
  FiSave, FiX, FiCheck, FiRefreshCw, FiAlertTriangle
} from 'react-icons/fi';
import { notificationService } from '../services/notificationService';
import { roleService } from '../services/roleService';

const RoleManagement = ({ onRoleChange }) => {
  const [roles, setRoles] = useState([]);
  const [editingRole, setEditingRole] = useState(null);
  const [showAddRole, setShowAddRole] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedRoles = await roleService.getRoles();
      setRoles(fetchedRoles);
    } catch (error) {
      console.error('Error loading roles:', error);
      setError('Failed to load roles');
      notificationService.show('Failed to load roles', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      setLoading(true);
      const fetchedRoles = await roleService.getRoles();
      setRoles(fetchedRoles);
    } catch (error) {
      notificationService.show('Failed to load roles', 'error');
    } finally {
      setLoading(false);
    }

  // Default permissions structure
  const permissionCategories = {
    users: [
      'view_users',
      'create_users',
      'edit_users',
      'delete_users',
      'bulk_actions',
      'manage_roles'
    ],
    inventory: [
      'view_inventory',
      'add_items',
      'edit_items',
      'delete_items',
      'manage_stock',
      'view_reports'
    ],
    sales: [
      'process_sales',
      'view_sales',
      'manage_discounts',
      'void_sales',
      'access_reports',
      'manage_refunds'
    ],
    finance: [
      'view_finances',
      'manage_payments',
      'handle_refunds',
      'generate_reports',
      'manage_expenses',
      'view_analytics'
    ],
    settings: [
      'view_settings',
      'edit_settings',
      'manage_integrations',
      'system_backup',
      'manage_notifications',
      'access_logs'
    ]
  };

  const handleSaveRole = async (role) => {
    try {
      setLoading(true);
      
      // If it's a new role
      if (!role.id) {
        const newRole = await roleService.createRole({
          name: role.name,
          description: role.description,
          permissions: role.permissions
        });
        setRoles([...roles, newRole]);
        onRoleChange?.('create', newRole);
      } else {
        // Update existing role
        const updatedRole = await roleService.updateRole(role.id, {
          name: role.name,
          description: role.description,
          permissions: role.permissions
        });
        const updatedRoles = roles.map(r =>
          r.id === role.id ? updatedRole : r
        );
        setRoles(updatedRoles);
        onRoleChange?.('update', updatedRole);
      }

      setEditingRole(null);
      setShowAddRole(false);
      notificationService.show('Role saved successfully! 🎉', 'success');
    } catch (error) {
      console.error('Error saving role:', error);
      notificationService.show('Failed to save role', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRole = async (roleId) => {
    try {
      setLoading(true);
      await roleService.deleteRole(roleId);
      const updatedRoles = roles.filter(r => r.id !== roleId);
      setRoles(updatedRoles);
      onRoleChange?.('delete', { id: roleId });
      notificationService.show('Role deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting role:', error);
      notificationService.show('Failed to delete role', 'error');
    } finally {
      setLoading(false);
    }
  };

  const RoleForm = ({ role, onSave, onCancel }) => {
    const [formData, setFormData] = useState(
      role || {
        name: '',
        description: '',
        permissions: Object.fromEntries(
          Object.keys(permissionCategories).map(category => [
            category,
            permissionCategories[category].reduce(
              (acc, permission) => ({ ...acc, [permission]: false }),
              {}
            )
          ])
        )
      }
    );

    return (
      <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Role Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData(prev => ({ ...prev, name: e.target.value }))
              }
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Enter role name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData(prev => ({ ...prev, description: e.target.value }))
              }
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              rows="3"
              placeholder="Describe the role's responsibilities"
            />
          </div>
        </div>

        {/* Permissions */}
        <div className="space-y-6">
          <h3 className="text-lg font-medium text-gray-900">Permissions</h3>
          
          {Object.entries(permissionCategories).map(([category, permissions]) => (
            <div key={category} className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-900 capitalize">
                  {category} Permissions
                </h4>
                <button
                  onClick={() => {
                    const allChecked = permissions.every(
                      p => formData.permissions[category][p]
                    );
                    setFormData(prev => ({
                      ...prev,
                      permissions: {
                        ...prev.permissions,
                        [category]: permissions.reduce(
                          (acc, p) => ({ ...acc, [p]: !allChecked }),
                          {}
                        )
                      }
                    }));
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {permissions.every(p => formData.permissions[category][p])
                    ? 'Uncheck All'
                    : 'Check All'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {permissions.map(permission => (
                  <label
                    key={permission}
                    className="relative flex items-start py-2"
                  >
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="select-none font-medium text-gray-700">
                        {permission
                          .split('_')
                          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                          .join(' ')}
                      </div>
                    </div>
                    <div className="ml-3 flex h-5 items-center">
                      <input
                        type="checkbox"
                        checked={formData.permissions[category][permission]}
                        onChange={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            permissions: {
                              ...prev.permissions,
                              [category]: {
                                ...prev.permissions[category],
                                [permission]: e.target.checked
                              }
                            }
                          }))
                        }
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(formData)}
            disabled={!formData.name || loading}
            className="px-4 py-2 text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
          >
            {loading ? (
              <>
                <FiRefreshCw className="h-5 w-5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <FiSave className="h-5 w-5" />
                <span>Save Role</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <FiShield className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Role Management</h2>
              <p className="text-sm text-gray-600">
                Manage user roles and permissions
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowAddRole(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 flex items-center space-x-2"
          >
            <FiPlus className="h-5 w-5" />
            <span>Add New Role</span>
          </button>
        </div>
      </div>

      {/* Role Form */}
      {(showAddRole || editingRole) && (
        <RoleForm
          role={editingRole}
          onSave={handleSaveRole}
          onCancel={() => {
            setEditingRole(null);
            setShowAddRole(false);
          }}
        />
      )}

      {/* Roles List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roles.map(role => (
          <div
            key={role.id}
            className="bg-white rounded-xl shadow-sm p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <FiLock className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {role.name}
                </h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setEditingRole(role)}
                  className="p-2 text-gray-400 hover:text-blue-600"
                >
                  <FiEdit2 className="h-5 w-5" />
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this role?')) {
                      handleDeleteRole(role.id);
                    }
                  }}
                  className="p-2 text-gray-400 hover:text-red-600"
                >
                  <FiTrash2 className="h-5 w-5" />
                </button>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-4">{role.description}</p>

            {/* Permission Summary */}
            <div className="space-y-3">
              {Object.entries(role.permissions).map(([category, permissions]) => {
                const activePermissions = Object.values(permissions).filter(Boolean).length;
                const totalPermissions = Object.keys(permissions).length;
                
                return (
                  <div key={category} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 capitalize">{category}</span>
                      <span className="text-gray-900 font-medium">
                        {activePermissions}/{totalPermissions}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{
                          width: `${(activePermissions / totalPermissions) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Role Meta */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>Created {new Date(role.created_at).toLocaleDateString()}</span>
                <span>Updated {new Date(role.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {roles.length === 0 && !showAddRole && (
        <div className="text-center py-12">
          <div className="flex justify-center">
            <div className="p-3 bg-blue-50 rounded-full">
              <FiShield className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No roles yet</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new role</p>
          <button
            onClick={() => setShowAddRole(true)}
            className="mt-4 px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
          >
            Add Your First Role
          </button>
        </div>
      )}
    </div>
  );
};

export default RoleManagement;