import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const esRef = useRef(null);
  const reconnectTimer = useRef(null);
  const reconnectDelay = useRef(1000); // start at 1s, doubles on each failure

  // ── Initial load: fetch all existing unread notifications ──────────────────
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data || []);
      }
    } catch { /* ignore — SSE will keep us up to date */ }
  }, []);

  // ── Mark one notification as read ─────────────────────────────────────────
  const markRead = async (id) => {
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'POST',
        credentials: 'include',
      });
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch { }
  };

  // ── Mark all notifications as read ────────────────────────────────────────
  const markAllRead = async () => {
    try {
      await fetch(`/api/notifications/read-all`, {
        method: 'POST',
        credentials: 'include',
      });
      setNotifications([]);
    } catch { }
  };

  // ── SSE connection ────────────────────────────────────────────────────────
  const openSSE = useCallback(() => {
    // Don't double-open
    if (esRef.current && esRef.current.readyState !== EventSource.CLOSED) return;

    const es = new EventSource('/api/notifications/stream', { withCredentials: true });
    esRef.current = es;

    es.addEventListener('notification', (e) => {
      try {
        const notif = JSON.parse(e.data);
        // Prepend new notification to the top of the list (dedup by id)
        setNotifications(prev => {
          if (prev.some(n => n.id === notif.id)) return prev;
          return [notif, ...prev];
        });
        // Reset backoff on successful message
        reconnectDelay.current = 1000;
      } catch { /* malformed payload — ignore */ }
    });

    // 'ping' events are heartbeats — nothing to do
    es.addEventListener('ping', () => { });

    es.onerror = () => {
      es.close();
      esRef.current = null;

      // Exponential back-off reconnect (max 30s)
      const delay = Math.min(reconnectDelay.current, 30000);
      reconnectDelay.current = Math.min(delay * 2, 30000);
      reconnectTimer.current = setTimeout(openSSE, delay);
    };
  }, []);

  useEffect(() => {
    // 1. Load existing notifications immediately
    fetchNotifications();
    // 2. Open the real-time SSE stream
    openSSE();

    return () => {
      // Cleanup on unmount
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
    };
  }, [fetchNotifications, openSSE]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      showNotifications,
      setShowNotifications,
      markRead,
      markAllRead,
      fetchNotifications
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}