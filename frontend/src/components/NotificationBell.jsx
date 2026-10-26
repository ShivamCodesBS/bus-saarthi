import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, Check, Clock, AlertTriangle, MessageSquare, CheckCircle2, Eye, GitMerge } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';

const NotificationBell = ({ user, token }) => {
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    refetch,
  } = useNotifications({
    limit: 50,
    autoRefresh: true,
    refreshInterval: 30000,
    token,
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        if (!buttonRef.current || !buttonRef.current.contains(event.target)) {
          setShowDropdown(false);
        }
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [showNotifications, setShowNotifications] = useState(false);

  const handleToggle = () => {
    setShowDropdown(prev => !prev);
  };

  const handleClose = () => {
    setShowDropdown(false);
  };

  const handleMarkAsRead = async (id) => {
    await markAsRead([id]);
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
  };

  const formatNotificationTime = (createdAt) => {
    if (!createdAt) return 'Just now';
    const date = new Date(createdAt);
    if (isNaN(date.getTime())) return createdAt;
    
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'sos':
        return <AlertTriangle size={18} className="text-red-500" />;
      case 'grievance':
        return <MessageSquare size={18} className="text-orange-500" />;
      case 'broadcast':
        return <Bell size={18} className="text-blue-500" />;
      case 'merge':
        return <GitMerge size={18} className="text-purple-500" />;
      default:
        return <Bell size={18} className="text-slate-500" />;
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'sos':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300';
      case 'grievance':
        return 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-900/50 text-orange-700 dark:text-orange-300';
      case 'broadcast':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/50 text-blue-700 dark:text-blue-300';
      case 'merge':
        return 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-900/50 text-purple-700 dark:text-purple-300';
      default:
        return 'bg-slate-50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-900/50 text-slate-700 dark:text-slate-300';
    }
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setShowNotifications(!showNotifications)}
        className={`relative bg-transparent border-none cursor-pointer p-1.5 rounded-xl transition-all duration-200 ${
          unreadCount > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
        }`}
        aria-label="Notifications"
        aria-expanded={showNotifications}
      >
        <Bell size={24} className={unreadCount > 0 ? 'animate-bell-ring' : ''} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse border-2 border-white dark:border-slate-900">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {showNotifications && (
        <div
          ref={dropdownRef}
          className="absolute top-full right-0 mt-2 w-96 bg-white dark:bg-slate-900 shadow-2xl rounded-2xl border border-slate-200 dark:border-slate-700 z-50 animate-fade-in overflow-hidden"
          role="menu"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Bell size={20} className="text-blue-600" />
              Notifications
              {unreadCount > 0 && (
                <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} unread
                </span>
              )}
            </h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={async () => {
                    await markAllAsRead();
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close notifications"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-[450px] overflow-y-auto">
            {isLoading ? (
              <div className="p-6 text-center text-slate-500">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm">Loading notifications...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell size={32} className="mx-auto mb-2 text-slate-400" />
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No notifications</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">You're all caught up!</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-700/50">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                      !notification.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                    }`}
                    onClick={() => !notification.read && handleMarkAsRead(notification.id)}
                  >
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                        {notification.icon || (
                          <div className={`w-5 h-5 ${notification.type === 'sos' ? 'text-red-500' : notification.type === 'grievance' ? 'text-orange-500' : 'text-blue-500'}`}>
                            {notification.icon || '🔔'}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`font-semibold text-sm truncate ${!notification.read ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                            {notification.title}
                          </p>
                          <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">
                            {formatNotificationTime(notification.created_at)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                        {!notification.read && (
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkAsRead(notification.id);
                              }}
                              className="px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                            >
                              Mark as read
                            </button>
                          </div>
                        )}
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <button
                onClick={() => navigate('/notifications')}
                className="w-full text-center text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;