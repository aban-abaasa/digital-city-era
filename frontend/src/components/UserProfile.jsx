import React, { useState } from 'react';
import {
  FiUser, FiMail, FiPhone, FiBriefcase, FiMap,
  FiCalendar, FiEdit2, FiUpload, FiCamera, FiCheckCircle,
  FiBadge, FiActivity, FiClock
} from 'react-icons/fi';
import { notificationService } from '../services/notificationService';

const UserProfile = ({ user, onUpdate }) => {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState({
    fullName: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    role: user?.role || '',
    department: user?.department || '',
    location: user?.location || '',
    joinDate: user?.join_date || '',
    avatar: user?.avatar || null
  });

  // Activity logs for demo
  const activityLogs = [
    {
      type: 'login',
      description: 'Logged in successfully',
      time: '2 hours ago',
      icon: FiUser,
      color: 'blue'
    },
    {
      type: 'verification',
      description: 'Email verified',
      time: '1 day ago',
      icon: FiCheckCircle,
      color: 'green'
    },
    {
      type: 'profile',
      description: 'Profile updated',
      time: '3 days ago',
      icon: FiEdit2,
      color: 'purple'
    }
  ];

  const handleUpdate = async () => {
    try {
      setLoading(true);
      // Simulated update
      await new Promise(resolve => setTimeout(resolve, 1500));
      onUpdate?.(userData);
      setEditing(false);
      notificationService.show('Profile updated successfully! 🎉', 'success');
    } catch (error) {
      notificationService.show('Failed to update profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUserData(prev => ({ ...prev, avatar: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 max-w-4xl mx-auto">
      {/* Profile Header */}
      <div className="relative mb-8">
        {/* Cover Image */}
        <div className="h-48 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 relative overflow-hidden">
          <div className="absolute inset-0 bg-black opacity-10"></div>
          <div className="absolute inset-0 bg-grid-pattern opacity-20"></div>
        </div>

        {/* Avatar */}
        <div className="absolute left-8 -bottom-16">
          <div className="relative group">
            <div className="w-32 h-32 rounded-full border-4 border-white overflow-hidden bg-white shadow-lg">
              {userData.avatar ? (
                <img
                  src={userData.avatar}
                  alt={userData.fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                  <FiUser className="h-12 w-12 text-gray-400" />
                </div>
              )}
            </div>
            {editing && (
              <label className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                <FiCamera className="h-8 w-8 text-white" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="absolute right-8 bottom-8 flex items-center space-x-4">
          {editing ? (
            <>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 text-gray-700 bg-white rounded-lg shadow-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 flex items-center space-x-2"
              >
                {loading ? (
                  <>
                    <FiClock className="h-5 w-5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <FiCheckCircle className="h-5 w-5" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 flex items-center space-x-2"
            >
              <FiEdit2 className="h-5 w-5" />
              <span>Edit Profile</span>
            </button>
          )}
        </div>
      </div>

      {/* Profile Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-20">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                label: 'Full Name',
                value: userData.fullName,
                icon: FiUser,
                editable: true,
                field: 'fullName'
              },
              {
                label: 'Email',
                value: userData.email,
                icon: FiMail,
                editable: false,
                field: 'email'
              },
              {
                label: 'Phone',
                value: userData.phone,
                icon: FiPhone,
                editable: true,
                field: 'phone'
              },
              {
                label: 'Role',
                value: userData.role,
                icon: FiBriefcase,
                editable: false,
                field: 'role'
              },
              {
                label: 'Department',
                value: userData.department,
                icon: FiBadge,
                editable: true,
                field: 'department'
              },
              {
                label: 'Location',
                value: userData.location,
                icon: FiMap,
                editable: true,
                field: 'location'
              }
            ].map((item, index) => (
              <div key={index} className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  {item.label}
                </label>
                <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                  <div className="bg-gray-50 px-3 py-2">
                    <item.icon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={item.value}
                    onChange={(e) =>
                      editing &&
                      item.editable &&
                      setUserData(prev => ({ ...prev, [item.field]: e.target.value }))
                    }
                    disabled={!editing || !item.editable}
                    className="flex-1 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Join Date */}
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <FiCalendar className="h-5 w-5" />
            <span>Joined on {new Date(userData.joinDate || Date.now()).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Activity Timeline */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <FiActivity className="h-5 w-5 text-blue-600" />
            <span>Recent Activity</span>
          </h3>

          <div className="space-y-4">
            {activityLogs.map((log, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className={`mt-1 p-2 rounded-lg bg-${log.color}-50`}>
                  <log.icon className={`h-5 w-5 text-${log.color}-600`} />
                </div>
                <div>
                  <p className="text-sm text-gray-900">{log.description}</p>
                  <p className="text-xs text-gray-500">{log.time}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Verification Status */}
          <div className="p-4 rounded-lg bg-green-50 border border-green-100">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-full bg-green-100">
                <FiCheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-800">Verified Account</p>
                <p className="text-xs text-green-600">All verifications complete</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;