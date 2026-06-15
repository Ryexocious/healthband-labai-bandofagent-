import React, { useState } from 'react';
import { MIcon } from './Icons';

export default function Login({ onLoginSuccess }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('PATIENT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';
      const body = isRegistering ? { email, password, name, role } : { email, password };
      
      const response = await fetch(`http://localhost:8000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Authentication failed');
      
      sessionStorage.setItem('hb_token', data.access_token);
      sessionStorage.setItem('hb_user', JSON.stringify(data.user));
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <MIcon name="health_and_safety" />
          <h1>HealthBand</h1>
          <p>Clinical Intelligence System</p>
        </div>
        
        {error && (
          <div className="login-error">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="login-form">
          {isRegistering && (
            <div className="login-input-group">
              <label>Full Name</label>
              <input 
                type="text" required 
                value={name} onChange={e => setName(e.target.value)} 
              />
            </div>
          )}
          
          <div className="login-input-group">
            <label>Email Address</label>
            <input 
              type="email" required 
              value={email} onChange={e => setEmail(e.target.value)} 
            />
          </div>
          
          <div className="login-input-group">
            <label>Password</label>
            <input 
              type="password" required 
              value={password} onChange={e => setPassword(e.target.value)} 
            />
          </div>
          
          {isRegistering && (
            <div className="login-input-group">
              <label>Account Role</label>
              <div className="login-radio-group">
                <label>
                  <input type="radio" value="PATIENT" checked={role === 'PATIENT'} onChange={() => setRole('PATIENT')} />
                  <span>Patient</span>
                </label>
                <label>
                  <input type="radio" value="DOCTOR" checked={role === 'DOCTOR'} onChange={() => setRole('DOCTOR')} />
                  <span>Doctor</span>
                </label>
              </div>
            </div>
          )}
          
          <button 
            type="submit" 
            disabled={loading}
            className="btn-primary"
          >
            {loading ? 'Processing...' : isRegistering ? 'Create Account' : 'Sign In'}
          </button>
        </form>
        
        <div className="login-footer">
          {isRegistering ? 'Already have an account?' : "Don't have an account?"}
          <button onClick={() => setIsRegistering(!isRegistering)}>
            {isRegistering ? 'Sign In' : 'Register'}
          </button>
        </div>
      </div>
    </div>
  );
}
