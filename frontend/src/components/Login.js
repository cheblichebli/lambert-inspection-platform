import React, { useState, useEffect } from 'react';
import { authAPI } from '../api';
import { WifiOff, AlertTriangle, Lock } from 'lucide-react';

const ERROR_DISPLAY_MS = 3000; // 3 seconds

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [error, setError] = useState('');
  const [errorType, setErrorType] = useState('');
  const [loading, setLoading] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const isOnline = navigator.onLine;

  // After every error, freeze for 3 seconds then always re-enable
  useEffect(() => {
    if (!frozen) return;

    const timer = setTimeout(() => {
      setFrozen(false);
      setError('');
      setErrorType('');
    }, ERROR_DISPLAY_MS);

    return () => clearTimeout(timer);
  }, [frozen]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isOnline) {
      setError('Cannot login while offline. Please connect to the internet.');
      setErrorType('general');
      setFrozen(true);
      return;
    }

    setLoading(true);

    try {
      const data = await authAPI.login(email, password, keepLoggedIn);
      setError('');
      setErrorType('');
      setFrozen(false);
      onLogin(data.user);
    } catch (err) {
      const message = err.response?.data?.error || 'Login failed. Please try again.';
      const status = err.response?.status;

      if (status === 423) {
        setErrorType('locked');
      } else if (status === 429) {
        setErrorType('rate_limited');
      } else {
        setErrorType('general');
      }

      setError(message);
      setFrozen(true); // Always freeze for 3s, always re-enables after
    } finally {
      setLoading(false);
    }
  };

  const getErrorStyle = () => {
    if (errorType === 'locked') return { backgroundColor: '#fef2f2', borderColor: '#fca5a5', color: '#991b1b' };
    if (errorType === 'rate_limited') return { backgroundColor: '#fff7ed', borderColor: '#fdba74', color: '#92400e' };
    return {};
  };

  const getErrorIcon = () => {
    if (errorType === 'locked') return <Lock size={18} style={{ flexShrink: 0 }} />;
    return <AlertTriangle size={18} style={{ flexShrink: 0 }} />;
  };

  const isDisabled = loading || frozen || !isOnline;

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <img
            src="/lambert-logo-green.png"
            alt="Lambert Electromec"
            style={{ maxWidth: '280px', height: 'auto', marginBottom: '20px' }}
          />
          <p style={{ fontSize: '1.1rem', fontWeight: 500, color: '#64748b' }}>Inspection Platform</p>
        </div>

        {!isOnline && (
          <div className="alert alert-warning">
            <WifiOff size={20} />
            <span>You are currently offline</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@lambertelectromec.com"
              required
              disabled={isDisabled}
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={isDisabled}
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          {error && (
            <div
              className="alert alert-error"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid',
                fontSize: '14px',
                ...getErrorStyle()
              }}
            >
              {getErrorIcon()}
              <span>{error}</span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <input
              type="checkbox"
              id="keepLoggedIn"
              checked={keepLoggedIn}
              onChange={(e) => setKeepLoggedIn(e.target.checked)}
              disabled={isDisabled}
              style={{ width: '16px', height: '16px', accentColor: '#4a9d5f', cursor: 'pointer' }}
            />
            <label
              htmlFor="keepLoggedIn"
              style={{ cursor: 'pointer', fontSize: '0.9rem', color: '#64748b', userSelect: 'none' }}
            >
              Keep me logged in for 7 days
            </label>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={isDisabled}
          >
            {loading ? 'Logging in...' : frozen ? 'Please wait...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
