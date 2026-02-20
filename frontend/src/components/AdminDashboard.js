import React, { useState, useEffect } from 'react';
import { AlertTriangle, Database, Users, FileText, Camera, HardDrive, Trash2 } from 'lucide-react';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showResetModal, setShowResetModal] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetResult, setResetResult] = useState(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await fetch('/api/system/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const executeHardReset = async () => {
    if (confirmationCode !== 'RESET_EVERYTHING') {
      alert('Invalid confirmation code. You must type exactly: RESET_EVERYTHING');
      return;
    }

    const finalConfirm = window.confirm(
      '🔴 FINAL WARNING 🔴\n\n' +
      'This will DELETE:\n' +
      `• ${stats?.total_users - 1 || 0} users (keeping only your admin account)\n` +
      `• ${stats?.forms || 0} form templates\n` +
      `• ${stats?.inspections || 0} inspections\n` +
      `• ${stats?.photos || 0} photos\n\n` +
      'This action CANNOT be undone!\n\n' +
      'Are you ABSOLUTELY sure?'
    );

    if (!finalConfirm) {
      return;
    }

    setResetLoading(true);

    try {
      const response = await fetch('/api/system/hard-reset', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ confirmationCode })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Reset failed');
      }

      setResetResult(data);
      setShowResetModal(false);
      setConfirmationCode('');
      
      // Reload stats
      setTimeout(() => {
        loadStats();
      }, 1000);

      alert('✅ HARD RESET COMPLETE!\n\nPlatform has been reset to factory settings.');

    } catch (error) {
      alert(`❌ Reset failed: ${error.message}`);
    } finally {
      setResetLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Admin Dashboard</h1>
        <button 
          onClick={() => setShowResetModal(true)}
          className="btn btn-error"
          style={{ backgroundColor: '#dc2626' }}
        >
          <Trash2 size={20} />
          Hard Reset Platform
        </button>
      </div>

      {/* System Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <Users size={32} color="#3b82f6" />
          <div className="stat-content">
            <h3>{stats?.total_users || 0}</h3>
            <p>Total Users</p>
            <div className="stat-breakdown">
              <span>Admins: {stats?.admins || 0}</span>
              <span>Inspectors: {stats?.inspectors || 0}</span>
              <span>Supervisors: {stats?.supervisors || 0}</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <FileText size={32} color="#10b981" />
          <div className="stat-content">
            <h3>{stats?.forms || 0}</h3>
            <p>Form Templates</p>
            <div className="stat-breakdown">
              <span>Active: {stats?.active_forms || 0}</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <Database size={32} color="#f59e0b" />
          <div className="stat-content">
            <h3>{stats?.inspections || 0}</h3>
            <p>Inspections</p>
            <div className="stat-breakdown">
              <span>Submitted: {stats?.submitted_inspections || 0}</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <Camera size={32} color="#8b5cf6" />
          <div className="stat-content">
            <h3>{stats?.photos || 0}</h3>
            <p>Photos</p>
          </div>
        </div>

        <div className="stat-card">
          <HardDrive size={32} color="#64748b" />
          <div className="stat-content">
            <h3>{stats?.database_size || 'N/A'}</h3>
            <p>Database Size</p>
          </div>
        </div>
      </div>

      {/* Recent Reset Result */}
      {resetResult && (
        <div className="reset-result">
          <h3>✅ Last Reset Results</h3>
          <div className="result-grid">
            <div>
              <strong>Deleted:</strong>
              <ul>
                <li>{resetResult.deleted.users} users</li>
                <li>{resetResult.deleted.forms} forms</li>
                <li>{resetResult.deleted.inspections} inspections</li>
                <li>{resetResult.deleted.photos} photos</li>
              </ul>
            </div>
            <div>
              <strong>Remaining:</strong>
              <ul>
                <li>{resetResult.after.users} user (admin)</li>
                <li>{resetResult.after.forms} forms</li>
                <li>{resetResult.after.inspections} inspections</li>
                <li>{resetResult.after.photos} photos</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Hard Reset Modal */}
      {showResetModal && (
        <div className="modal">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header" style={{ borderBottom: '3px solid #dc2626' }}>
              <AlertTriangle size={32} color="#dc2626" />
              <h2 style={{ color: '#dc2626' }}>⚠️ HARD RESET WARNING ⚠️</h2>
            </div>

            <div className="modal-body">
              <div className="warning-box">
                <h3>This will permanently DELETE:</h3>
                <ul style={{ fontSize: '16px', lineHeight: '2' }}>
                  <li>✗ <strong>{stats?.total_users - 1 || 0} users</strong> (all except you)</li>
                  <li>✗ <strong>{stats?.forms || 0} form templates</strong></li>
                  <li>✗ <strong>{stats?.inspections || 0} inspections</strong></li>
                  <li>✗ <strong>{stats?.photos || 0} photos</strong></li>
                </ul>

                <h3 style={{ marginTop: '20px', color: '#10b981' }}>What will remain:</h3>
                <ul style={{ fontSize: '16px', lineHeight: '2' }}>
                  <li>✓ Your admin account only</li>
                  <li>✓ Database structure (tables, columns)</li>
                  <li>✓ Application code</li>
                </ul>
              </div>

              <div style={{ 
                backgroundColor: '#fef3c7', 
                padding: '15px', 
                borderRadius: '8px',
                marginTop: '20px',
                border: '2px solid #f59e0b'
              }}>
                <p style={{ margin: 0, fontWeight: 'bold', color: '#92400e' }}>
                  ⚠️ THIS ACTION CANNOT BE UNDONE ⚠️
                </p>
                <p style={{ margin: '10px 0 0 0', color: '#92400e' }}>
                  Make sure you have exported any data you want to keep before proceeding.
                </p>
              </div>

              <div className="form-group" style={{ marginTop: '20px' }}>
                <label style={{ fontWeight: 'bold' }}>
                  Type <code style={{ 
                    backgroundColor: '#fee2e2', 
                    padding: '2px 6px', 
                    borderRadius: '4px',
                    color: '#dc2626'
                  }}>RESET_EVERYTHING</code> to confirm:
                </label>
                <input
                  type="text"
                  value={confirmationCode}
                  onChange={(e) => setConfirmationCode(e.target.value)}
                  placeholder="Type: RESET_EVERYTHING"
                  className="form-control"
                  style={{ 
                    marginTop: '10px',
                    fontFamily: 'monospace',
                    fontSize: '16px'
                  }}
                />
              </div>
            </div>

            <div className="modal-actions">
              <button 
                onClick={() => {
                  setShowResetModal(false);
                  setConfirmationCode('');
                }}
                className="btn btn-secondary"
                disabled={resetLoading}
              >
                Cancel (Safe)
              </button>
              <button 
                onClick={executeHardReset}
                className="btn btn-error"
                disabled={confirmationCode !== 'RESET_EVERYTHING' || resetLoading}
                style={{ 
                  backgroundColor: '#dc2626',
                  opacity: confirmationCode !== 'RESET_EVERYTHING' ? 0.5 : 1
                }}
              >
                {resetLoading ? 'Resetting...' : '🔴 DELETE EVERYTHING'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
