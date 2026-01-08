import { apiService } from './apiService';
import { supabase } from './supabaseClient';

export const notificationService = {
  // Create a notification
  create: async (notificationData) => {
    try {
      const notification = {
        user_id: notificationData.user_id,
        type: notificationData.type, // 'verification_approved', 'verification_rejected', 'registration_submitted'
        title: notificationData.title,
        message: notificationData.message,
        data: notificationData.data || {}, // Additional data like user_type, request_id, etc.
        is_read: false,
        created_at: new Date().toISOString()
      };

      const result = await apiService.post('notifications', notification);
      
      // TODO: In a real app, you might want to send push notifications or emails here
      console.log('Notification created:', result);
      
      return result;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  },

  // Get notifications for a user
  getForUser: async (userId, limit = 20) => {
    try {
      const notifications = await apiService.get('notifications', {
        filters: { user_id: userId },
        orderBy: { column: 'created_at', ascending: false },
        limit: limit
      });

      return notifications.data || [];
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }
  },

  // Mark notification as read
  markAsRead: async (notificationId) => {
    try {
      const result = await apiService.put('notifications', notificationId, {
        is_read: true,
        read_at: new Date().toISOString()
      });

      return result;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  },

  // Mark all notifications as read for a user
  markAllAsRead: async (userId) => {
    try {
      // Get all unread notifications for the user
      const unreadNotifications = await apiService.get('notifications', {
        filters: { 
          user_id: userId,
          is_read: false
        }
      });

      // Mark each as read
      const updatePromises = unreadNotifications.data.map(notification =>
        this.markAsRead(notification.id)
      );

      await Promise.all(updatePromises);
      
      return { success: true, count: unreadNotifications.data.length };
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  },

  // Get unread count for a user
  getUnreadCount: async (userId) => {
    try {
      const result = await apiService.get('notifications', {
        filters: { 
          user_id: userId,
          is_read: false
        },
        count: true
      });

      return result.count || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  },

  // Delete a notification
  delete: async (notificationId) => {
    try {
      const result = await apiService.delete('notifications', notificationId);
      return result;
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  },

  // Notification helpers for specific events
  
  // Send verification approval notification
  sendVerificationApproval: async (userId, userType, approverName) => {
    return await this.create({
      user_id: userId,
      type: 'verification_approved',
      title: 'Account Approved! 🎉',
      message: `Your ${userType} account has been approved by ${approverName}. You can now log in and access all features.`,
      data: {
        user_type: userType,
        approver: approverName,
        action_required: false
      }
    });
  },

  // Send verification rejection notification
  sendVerificationRejection: async (userId, userType, reason, rejectorName) => {
    return await this.create({
      user_id: userId,
      type: 'verification_rejected',
      title: 'Account Registration Update',
      message: `Your ${userType} account registration was not approved. Reason: ${reason}. You can submit a new registration if needed.`,
      data: {
        user_type: userType,
        rejector: rejectorName,
        reason: reason,
        action_required: true
      }
    });
  },

  // Send registration submission notification to managers
  sendRegistrationSubmission: async (managerId, userType, applicantName, applicantData) => {
    return await this.create({
      user_id: managerId,
      type: 'registration_submitted',
      title: `New ${userType.charAt(0).toUpperCase() + userType.slice(1)} Registration`,
      message: `${applicantName} has submitted a ${userType} registration request. Please review and approve/reject the application.`,
      data: {
        user_type: userType,
        applicant_name: applicantName,
        applicant_data: applicantData,
        action_required: true
      }
    });
  },

  // Send account status change notification
  sendAccountStatusChange: async (userId, oldStatus, newStatus, userType) => {
    const statusMessages = {
      'pending_approval': 'is pending approval',
      'approved': 'has been approved',
      'rejected': 'was rejected',
      'suspended': 'has been suspended',
      'active': 'is now active'
    };

    return await this.create({
      user_id: userId,
      type: 'account_status_change',
      title: 'Account Status Update',
      message: `Your ${userType} account status ${statusMessages[newStatus] || `changed to ${newStatus}`}.`,
      data: {
        user_type: userType,
        old_status: oldStatus,
        new_status: newStatus,
        action_required: newStatus === 'rejected' || newStatus === 'suspended'
      }
    });
  },

  // Real-time notification subscription (using Supabase realtime)
  subscribeToUserNotifications: (userId, callback) => {
    const subscription = supabase
      .channel(`notifications:user_id=eq.${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        callback
      )
      .subscribe();

    return subscription;
  },

  // Unsubscribe from real-time notifications
  unsubscribe: (subscription) => {
    supabase.removeChannel(subscription);
  },

  // Simple notification display method for immediate user feedback
  show: (message, type = 'info') => {
    // For now, use console.log and alert for development
    // In production, you'd want to use a toast library like react-hot-toast
    const styles = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    const icon = styles[type] || styles.info;
    console.log(`${icon} ${message}`);
    
    // Create a simple toast-like notification
    if (typeof window !== 'undefined') {
      // Create notification element
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : type === 'warning' ? '#ffc107' : '#007bff'};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        max-width: 350px;
        word-wrap: break-word;
        animation: slideIn 0.3s ease-out;
      `;
      
      notification.innerHTML = `${icon} ${message}`;
      document.body.appendChild(notification);
      
      // Remove after 5 seconds
      setTimeout(() => {
        if (notification.parentNode) {
          notification.style.animation = 'slideOut 0.3s ease-in';
          setTimeout(() => {
            notification.remove();
          }, 300);
        }
      }, 5000);
      
      // Add click to dismiss
      notification.addEventListener('click', () => {
        notification.remove();
      });
    }
  }
};

export default notificationService;