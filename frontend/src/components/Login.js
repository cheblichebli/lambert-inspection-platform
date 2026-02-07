import React, { useState } from 'react';
import { authAPI } from '../api';
import { Wifi, WifiOff } from 'lucide-react';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isOnline = navigator.onLine;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isOnline) {
      setError('Cannot login while offline. Please connect to the internet.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const data = await authAPI.login(email, password);
      onLogin(data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Lambert Electromec</h1>
          <p>Inspection Platform</p>
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
              disabled={loading || !isOnline}
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
              disabled={loading || !isOnline}
            />
          </div>

          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={loading || !isOnline}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="login-footer">
          <p className="text-muted">
            Default credentials: admin@lambertelectromec.com / Admin@123
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
