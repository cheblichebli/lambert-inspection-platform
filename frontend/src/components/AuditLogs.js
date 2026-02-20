import React, { useState, useEffect } from 'react';
import { Shield, Calendar, User, Activity, Search, RefreshCw } from 'lucide-react';
import { systemAPI } from '../api';
import './AuditLogs.css';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchAction, setSearchAction] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const limit = 50;

  useEffect(() => {
    loadLogs();
  }, [page, searchAction]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const filters = {
        limit: limit.toString(),
        offset: (page * limit).toString()
      };

      if (searchAction) {
        filters.action = searchAction;
      }

      const data = await systemAPI.getAuditLogs(filters);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getActionBadge = (action) => {
    const colors = {
      'users.created': '#10b981',
      'users.deleted': '#ef4444',
      'users.updated': '#3b82f6',
      'users.password_changed': '#f59e0b',
      'users.viewed': '#64748b',
      'users.list_viewed': '#64748b'
    };

    const color = colors[action] || '#6366f1';

    return (
      <span style={{
        backgroundColor: color,
        color: 'white',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: '500'
      }}>
        {action}
      </span>
    );
  };

  const formatDetails = (details) => {
    if (!details) return null;
    
    try {
      const parsed = typeof details === 'string' ? JSON.parse(details) : details;
      return (
        <pre style={{
          fontSize: '12px',
          backgroundColor: '#f8fafc',
          padding: '8px',
          borderRadius: '4px',
          overflow: 'auto',
          maxHeight: '100px'
        }}>
          {JSON.stringify(parsed, null, 2)}
        </pre>
      );
    } catch {
      return <span>{String(details)}</span>;
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Audit Logs</h1>
          <p style={{ color: '#64748b', marginTop: '8px' }}>
            Complete activity trail - {total} total events
          </p>
        </div>
        <button onClick={loadLogs} className="btn btn-secondary">
          <RefreshCw size={20} />
          Refresh
        </button>
      </div>

      {/* Search Filter */}
      <div className="audit-filters">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="Filter by action (e.g., users.deleted, users.created)"
            value={searchAction}
            onChange={(e) => {
              setSearchAction(e.target.value);
              setPage(0);
            }}
            className="form-control"
          />
        </div>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading audit logs...</p>
        </div>
      ) : (
        <>
          <div className="audit-logs-table">
            <table>
              <thead>
                <tr>
                  <th><Calendar size={16} /> Date & Time</th>
                  <th><User size={16} /> User</th>
                  <th><Activity size={16} /> Action</th>
                  <th><Shield size={16} /> Details</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                      No audit logs found
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id}>
                      <td>{formatDate(log.created_at)}</td>
                      <td>
                        <div>
                          <div style={{ fontWeight: '500' }}>{log.user_name || 'Unknown'}</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{log.user_email || 'N/A'}</div>
                        </div>
                      </td>
                      <td>{getActionBadge(log.action)}</td>
                      <td>
                        {log.entity_type && (
                          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                            {log.entity_type} #{log.entity_id}
                          </div>
                        )}
                        {formatDetails(log.details)}
                      </td>
                      <td style={{ fontSize: '12px', color: '#64748b' }}>
                        {log.ip_address || 'N/A'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="btn btn-secondary"
              >
                Previous
              </button>
              <span style={{ margin: '0 20px', color: '#64748b' }}>
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="btn btn-secondary"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AuditLogs;
