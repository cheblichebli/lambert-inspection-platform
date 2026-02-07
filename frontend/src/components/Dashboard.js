import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { inspectionsAPI } from '../api';
import { 
  ClipboardCheck, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock,
  Plus 
} from 'lucide-react';

const Dashboard = ({ user }) => {
  const [stats, setStats] = useState(null);
  const [recentInspections, setRecentInspections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load stats (online only)
      if (navigator.onLine && ['admin', 'supervisor'].includes(user.role)) {
        const statsData = await inspectionsAPI.getStats();
        setStats(statsData);
      }

      // Load recent inspections
      const inspections = await inspectionsAPI.getAll({ limit: 5 });
      setRecentInspections(inspections.slice(0, 5));
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      draft: { icon: <Clock size={16} />, className: 'badge-warning', label: 'Draft' },
      submitted: { icon: <FileText size={16} />, className: 'badge-info', label: 'Submitted' },
      approved: { icon: <CheckCircle size={16} />, className: 'badge-success', label: 'Approved' },
      rejected: { icon: <XCircle size={16} />, className: 'badge-error', label: 'Rejected' },
    };
    return badges[status] || badges.draft;
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Welcome, {user.fullName}</h1>
          <p className="text-muted">Role: {user.role.toUpperCase()}</p>
        </div>
        
        {user.role === 'inspector' && (
          <Link to="/inspections/new" className="btn btn-primary">
            <Plus size={20} />
            New Inspection
          </Link>
        )}
      </div>

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon stat-total">
              <ClipboardCheck size={32} />
            </div>
            <div className="stat-content">
              <p className="stat-label">Total Inspections</p>
              <p className="stat-value">{stats.total_count}</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-pending">
              <Clock size={32} />
            </div>
            <div className="stat-content">
              <p className="stat-label">Pending Review</p>
              <p className="stat-value">{stats.submitted_count}</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-approved">
              <CheckCircle size={32} />
            </div>
            <div className="stat-content">
              <p className="stat-label">Approved</p>
              <p className="stat-value">{stats.approved_count}</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-rejected">
              <XCircle size={32} />
            </div>
            <div className="stat-content">
              <p className="stat-label">Rejected</p>
              <p className="stat-value">{stats.rejected_count}</p>
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-section">
        <div className="section-header">
          <h2>Recent Inspections</h2>
          <Link to="/inspections" className="btn btn-secondary btn-sm">
            View All
          </Link>
        </div>

        {recentInspections.length === 0 ? (
          <div className="empty-state">
            <ClipboardCheck size={48} />
            <p>No inspections yet</p>
            {user.role === 'inspector' && (
              <Link to="/inspections/new" className="btn btn-primary">
                Create First Inspection
              </Link>
            )}
          </div>
        ) : (
          <div className="inspections-list">
            {recentInspections.map((inspection) => {
              const badge = getStatusBadge(inspection.status);
              return (
                <Link
                  key={inspection.id}
                  to={`/inspections/${inspection.id}`}
                  className="inspection-card"
                >
                  <div className="inspection-header">
                    <h3>{inspection.template_title || 'Inspection'}</h3>
                    <span className={`badge ${badge.className}`}>
                      {badge.icon}
                      {badge.label}
                    </span>
                  </div>
                  <div className="inspection-details">
                    {inspection.location && (
                      <p className="text-muted">📍 {inspection.location}</p>
                    )}
                    {inspection.equipment_id && (
                      <p className="text-muted">🔧 {inspection.equipment_id}</p>
                    )}
                    <p className="text-muted">
                      By: {inspection.inspector_name || 'Unknown'}
                    </p>
                    <p className="text-muted">
                      {new Date(inspection.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="quick-links">
        <h2>Quick Links</h2>
        <div className="links-grid">
          <Link to="/inspections" className="quick-link-card">
            <ClipboardCheck size={32} />
            <span>All Inspections</span>
          </Link>
          
          {user.role === 'inspector' && (
            <Link to="/inspections/new" className="quick-link-card">
              <Plus size={32} />
              <span>New Inspection</span>
            </Link>
          )}
          
          {['admin', 'supervisor'].includes(user.role) && (
            <Link to="/forms" className="quick-link-card">
              <FileText size={32} />
              <span>Form Templates</span>
            </Link>
          )}
          
          {user.role === 'admin' && (
            <Link to="/users" className="quick-link-card">
              <FileText size={32} />
              <span>User Management</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
