import React, { useState } from 'react';
import { authAPI } from '../api';
import { WifiOff, AlertTriangle, Lock } from 'lucide-react';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [error, setError] = useState('');
  const [errorType, setErrorType] = useState(''); // 'locked', 'rate_limited', 'general'
  const [loading, setLoading] = useState(false);
  const isOnline = navigator.onLine;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isOnline) {
      setError('Cannot login while offline. Please connect to the internet.');
      setErrorType('general');
      return;
    }

    // Don't clear error here — only clear it after we get a response
    setLoading(true);

    try {
      const data = await authAPI.login(email, password, keepLoggedIn);
      // Success — clear any previous error and proceed
      setError('');
      setErrorType('');
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
              onChange={(e) => {
                setEmail(e.target.value);
                // Only clear error when user edits email, not password
                // so the error stays visible while they retype their password
                if (errorType !== 'locked') {
                  setError('');
                  setErrorType('');
                }
              }}
              placeholder="your.email@lambertelectromec.com"
              required
              disabled={loading || !isOnline}
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
              disabled={loading || !isOnline || errorType === 'locked'}
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

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px'
          }}>
            <input
              type="checkbox"
              id="keepLoggedIn"
              checked={keepLoggedIn}
              onChange={(e) => setKeepLoggedIn(e.target.checked)}
              disabled={loading || !isOnline}
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
            disabled={loading || !isOnline || errorType === 'locked'}
          >
            {loading ? 'Logging in...' : errorType === 'locked' ? 'Account Locked' : 'Login'}
          </button>

          {errorType === 'locked' && (
            <p style={{ textAlign: 'center', fontSize: '13px', color: '#64748b', marginTop: '12px' }}>
              Contact your administrator to unlock your account.
            </p>
          )}
        </form>
      </div>
    </div>
  );
};

export default Login;
