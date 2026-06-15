import React, { useState, useEffect } from 'react';
import { MIcon } from './Icons';

const API_BASE = 'http://localhost:8000';

export function NotificationsDropdown({ onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const token = sessionStorage.getItem('hb_token');
      const res = await fetch(`${API_BASE}/api/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setNotifications(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      const token = sessionStorage.getItem('hb_token');
      await fetch(`${API_BASE}/api/notifications/${id}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="nav-dropdown">
      <div className="dropdown-header">
        <span className="dropdown-title">Notifications</span>
        <MIcon name="close" className="dropdown-close" onClick={onClose} />
      </div>
      <div className="dropdown-body" style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--hb-outline)' }}>Loading...</div>
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--hb-outline)' }}>No new notifications</div>
        ) : (
          notifications.map(n => (
            <div 
              key={n.id} 
              className="dropdown-item" 
              style={{ opacity: n.is_read ? 0.6 : 1 }}
              onClick={() => !n.is_read && markAsRead(n.id)}
            >
              <MIcon name={n.icon} className="dropdown-icon" />
              <div className="dropdown-text">
                <span className="dropdown-text-title">{n.title}</span>
                <span className="dropdown-text-desc">{n.message}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function SettingsDropdown({ user, onClose }) {
  const [theme, setTheme] = useState(user.theme_preference || 'light');
  const [emailAlerts, setEmailAlerts] = useState(user.email_alerts ?? true);
  const [smsAlerts, setSmsAlerts] = useState(user.sms_alerts ?? false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const updatePreference = async (key, value) => {
    try {
      const token = sessionStorage.getItem('hb_token');
      await fetch(`${API_BASE}/api/user/preferences`, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ [key]: value })
      });
      
      // Update local session
      const updatedUser = { ...user, [key]: value };
      sessionStorage.setItem('hb_user', JSON.stringify(updatedUser));

      if (key === 'theme_preference') {
        if (value === 'dark') document.body.classList.add('dark-theme');
        else document.body.classList.remove('dark-theme');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleThemeToggle = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    updatePreference('theme_preference', newTheme);
  };

  const handleEmailToggle = () => {
    const newVal = !emailAlerts;
    setEmailAlerts(newVal);
    updatePreference('email_alerts', newVal);
  };

  const handleSmsToggle = () => {
    const newVal = !smsAlerts;
    setSmsAlerts(newVal);
    updatePreference('sms_alerts', newVal);
  };

  if (showPasswordModal) {
    return <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />;
  }

  return (
    <div className="nav-dropdown">
      <div className="dropdown-header">
        <span className="dropdown-title">Settings</span>
        <MIcon name="close" className="dropdown-close" onClick={onClose} />
      </div>
      
      <div className="dropdown-item" onClick={handleThemeToggle}>
        <MIcon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} className="dropdown-icon" />
        <div className="dropdown-text" style={{ flex: 1 }}>
          <span className="dropdown-text-title">Appearance</span>
          <span className="dropdown-text-desc">Toggle Dark Mode (Currently {theme})</span>
        </div>
        <div style={{ alignSelf: 'center' }}>
          <MIcon name="toggle_on" style={{ color: theme === 'dark' ? 'var(--hb-primary)' : 'var(--hb-outline)', fontSize: '24px' }} />
        </div>
      </div>
      
      <div className="dropdown-item" onClick={handleEmailToggle}>
        <MIcon name="email" className="dropdown-icon" />
        <div className="dropdown-text" style={{ flex: 1 }}>
          <span className="dropdown-text-title">Email Alerts</span>
          <span className="dropdown-text-desc">{emailAlerts ? 'Enabled' : 'Disabled'}</span>
        </div>
        <div style={{ alignSelf: 'center' }}>
          <MIcon name="toggle_on" style={{ color: emailAlerts ? 'var(--hb-primary)' : 'var(--hb-outline)', fontSize: '24px' }} />
        </div>
      </div>

      <div className="dropdown-item" onClick={handleSmsToggle}>
        <MIcon name="sms" className="dropdown-icon" />
        <div className="dropdown-text" style={{ flex: 1 }}>
          <span className="dropdown-text-title">SMS Alerts</span>
          <span className="dropdown-text-desc">{smsAlerts ? 'Enabled' : 'Disabled'}</span>
        </div>
        <div style={{ alignSelf: 'center' }}>
          <MIcon name="toggle_on" style={{ color: smsAlerts ? 'var(--hb-primary)' : 'var(--hb-outline)', fontSize: '24px' }} />
        </div>
      </div>
      
      <div style={{ borderTop: '1px solid var(--hb-outline-variant)', margin: '4px 0' }}></div>
      
      <div className="dropdown-item" onClick={() => setShowPasswordModal(true)}>
        <MIcon name="security" className="dropdown-icon" />
        <div className="dropdown-text">
          <span className="dropdown-text-title">Change Password</span>
          <span className="dropdown-text-desc">Update your security credentials</span>
        </div>
      </div>
    </div>
  );
}

function ChangePasswordModal({ onClose }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [status, setStatus] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('submitting');
    try {
      const token = sessionStorage.getItem('hb_token');
      const res = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to update');
      }
      
      setStatus('success');
      setTimeout(onClose, 1500);
    } catch (e) {
      setStatus(e.message);
    }
  };

  return (
    <div className="nav-dropdown">
      <div className="dropdown-header">
        <span className="dropdown-title">Change Password</span>
        <MIcon name="arrow_back" className="dropdown-close" onClick={onClose} />
      </div>
      
      {status === 'success' ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--hb-normal-success)' }}>
          Password updated successfully!
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {status && status !== 'submitting' && <div style={{ color: 'var(--hb-error)', fontSize: '12px' }}>{status}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Current Password</label>
            <input 
              type="password" 
              required 
              value={oldPassword} 
              onChange={e => setOldPassword(e.target.value)}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--hb-outline-variant)' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold' }}>New Password</label>
            <input 
              type="password" 
              required 
              value={newPassword} 
              onChange={e => setNewPassword(e.target.value)}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--hb-outline-variant)' }}
            />
          </div>
          <button 
            type="submit" 
            disabled={status === 'submitting'}
            style={{ marginTop: '8px', padding: '10px', background: 'var(--hb-primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            {status === 'submitting' ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      )}
    </div>
  );
}

export function ProfileDropdown({ user, onClose, onLogout }) {
  return (
    <div className="nav-dropdown">
      <div className="dropdown-header">
        <span className="dropdown-title">Profile</span>
        <MIcon name="close" className="dropdown-close" onClick={onClose} />
      </div>
      <div className="dropdown-item" style={{ background: 'transparent', cursor: 'default' }}>
        <MIcon name="account_circle" className="dropdown-icon" style={{ fontSize: '32px' }} />
        <div className="dropdown-text">
          <span className="dropdown-text-title" style={{ fontSize: '16px' }}>{user.name}</span>
          <span className="dropdown-text-desc">{user.email}</span>
          <span className="dropdown-text-desc" style={{ marginTop: '4px', fontWeight: 'bold' }}>Role: {user.role}</span>
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--hb-outline-variant)', margin: '8px 0' }}></div>
      <div className="dropdown-item" onClick={onLogout} style={{ color: 'var(--hb-error)' }}>
        <MIcon name="logout" className="dropdown-icon" style={{ color: 'var(--hb-error)' }} />
        <div className="dropdown-text">
          <span className="dropdown-text-title">Log Out</span>
        </div>
      </div>
    </div>
  );
}
