import { toast } from 'react-toastify';

/**
 * Notification Service
 * Provides a simple interface for showing toast notifications
 */
class NotificationService {
  /**
   * Show a notification
   * @param {string} message - The message to display
   * @param {string} type - The type: 'success', 'error', 'warning', 'info'
   * @param {object} options - Additional toast options
   */
  show(message, type = 'info', options = {}) {
    const defaultOptions = {
      position: 'top-right',
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      ...options
    };

    switch (type.toLowerCase()) {
      case 'success':
        toast.success(message, defaultOptions);
        break;
      case 'error':
        toast.error(message, defaultOptions);
        break;
      case 'warning':
        toast.warning(message, defaultOptions);
        break;
      case 'info':
        toast.info(message, defaultOptions);
        break;
      default:
        toast(message, defaultOptions);
    }
  }

  /**
   * Show a success notification
   */
  success(message, options = {}) {
    this.show(message, 'success', options);
  }

  /**
   * Show an error notification
   */
  error(message, options = {}) {
    this.show(message, 'error', options);
  }

  /**
   * Show a warning notification
   */
  warning(message, options = {}) {
    this.show(message, 'warning', options);
  }

  /**
   * Show an info notification
   */
  info(message, options = {}) {
    this.show(message, 'info', options);
  }

  /**
   * Show a loading notification
   */
  loading(message) {
    return toast.loading(message);
  }

  /**
   * Update a notification
   */
  update(toastId, options) {
    toast.update(toastId, options);
  }

  /**
   * Dismiss a notification
   */
  dismiss(toastId) {
    toast.dismiss(toastId);
  }

  /**
   * Dismiss all notifications
   */
  dismissAll() {
    toast.dismiss();
  }
}

// Create and export a singleton instance
export const notificationService = new NotificationService();

// Also export the class for testing
export default NotificationService;
