import React, { useState, useEffect, useRef } from 'react';
import { authAPI } from '../api';
import { WifiOff, AlertTriangle, Lock } from 'lucide-react';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [error, setError] = useState('');
  const [errorType, setErrorType] = useState('');
  const [loading, setLoading] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const timerRef = useRef(null);
  const isOnline = navigator.onLine;

  // When error is set, freeze the form and start the countdown timer
  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!error) {
      setFrozen(false);
      return;
    }

    // Freeze immediately when error appears
    setFrozen(true);

    // Locked accounts: 5 seconds. All other errors: 3 seconds.
    const delay = errorType === 'locked' ? 5000 : 3000;

    timerRef.current = setTimeout(() => {
      setError('');
      setErrorType('');
      setFrozen(false);
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [error]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isOnline) {
      setError('Cannot login while offline. Please connect to the internet.');
      setErrorType('general');
      return;
    }

    setLoading(true);

    try {
      const data = await authAPI.login(email, password, keepLoggedIn);
      if (timerRef.current) clearTimeout(timerRef.current);
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

      // Set error AFTER errorType so the useEffect reads the correct type
      // Use setTimeout 0 to ensure errorType state has settled before error triggers the effect
      setTimeout(() => setError(message), 0);

    } finally {
      setLoading(false);
    }
  };

  const getErrorStyle = () => {
    if (errorType === 'locked') return { backgroundColor: '#fef2f2', borderColor: '#fca5a5', color: '#991b1b' };
    if (errorType === 'rate_limited') return { backgroundColor: '#fff7ed', borderColor: '#fdba74', color: '#92400e' };
    return { backgroundColor: '#fef2f2', borderColor: '#fca5a5', color: '#991b1b' };
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
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid',
                fontSize: '14px',
                marginBottom: '16px',
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
