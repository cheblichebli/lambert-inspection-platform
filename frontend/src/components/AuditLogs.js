import React, { useState, useEffect } from 'react';
import { Shield, Calendar, User, Activity, RefreshCw, Filter } from 'lucide-react';
import { systemAPI } from '../api';
import './AuditLogs.css';

const ACTION_TYPES = [
  { value: '', label: 'All Actions' },
  { value: 'inspections.created',        label: '📋 Inspection Created' },
  { value: 'inspections.updated',        label: '✏️ Inspection Updated' },
  { value: 'inspections.submitted',      label: '📤 Inspection Submitted' },
  { value: 'inspections.approved',       label: '✅ Inspection Approved' },
  { value: 'inspections.rejected',       label: '❌ Inspection Rejected' },
  { value: 'inspections.deleted',        label: '🗑️ Inspection Deleted' },
  { value: 'inspections.signed',         label: '✍️ Signature Added' },
  { value: 'inspections.photos_uploaded',label: '📷 Photos Uploaded' },
  { value: 'users.created',             label: '👤 User Created' },
  { value: 'users.updated',             label: '👤 User Updated' },
  { value: 'users.deleted',             label: '👤 User Deleted' },
  { value: 'users.password_changed',    label: '🔑 Password Changed' },
  { value: 'users.list_viewed',         label: '👁️ User List Viewed' },
];

const ROLES = [
  { value: '',           label: 'All Roles' },
  { value: 'admin',      label: 'Admin' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'inspector',  label: 'Inspector' },
];

const ACTION_COLORS = {
  'inspections.created':         '#3b82f6',
  'inspections.updated':         '#6366f1',
  'inspections.submitted':       '#f59e0b',
  'inspections.approved':        '#10b981',
  'inspections.rejected':        '#ef4444',
  'inspections.deleted':         '#dc2626',
  'inspections.signed':          '#8b5cf6',
  'inspections.photos_uploaded': '#0ea5e9',
  'users.created':               '#10b981',
  'users.updated':               '#3b82f6',
  'users.deleted':               '#ef4444',
  'users.password_changed':      '#f59e0b',
  'users.list_viewed':           '#64748b',
};

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [auditUsers, setAuditUsers] = useState([]);

  // Filters
  const [filterUser, setFilterUser]     = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterRole, setFilterRole]     = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo]     = useState('');

  const limit = 50;

  useEffect(() => {
    loadAuditUsers();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [page, filterUser, filterAction, filterRole, filterDateFrom, filterDateTo]);

  const loadAuditUsers = async () => {
    try {
      // Always load ALL users (not just those with audit entries)
      // so new users appear in the filter dropdown immediately
      const { usersAPI } = await import('../api');
      const data = await usersAPI.getAll();
      const normalized = data.map(u => ({
        user_id:    u.id,
        user_name:  u.full_name,
        user_email: u.email,
      }));
      setAuditUsers(normalized);
    } catch (err) {
      console.error('Failed to load audit users', err);
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const filters = {
        limit: limit.toString(),
        offset: (page * limit).toString()
      };
      if (filterUser)     filters.userId   = filterUser;
      if (filterAction)   filters.action   = filterAction;
      if (filterRole)     filters.role     = filterRole;
      if (filterDateFrom) filters.dateFrom = filterDateFrom;
      if (filterDateTo)   filters.dateTo   = filterDateTo;

      const data = await systemAPI.getAuditLogs(filters);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetFilters = () => {
    setFilterUser('');
    setFilterAction('');
    setFilterRole('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setPage(0);
  };

  const handleFilterChange = (setter) => (e) => {
    setter(e.target.value);
    setPage(0);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  };

  const formatActionLabel = (action) => {
    const found = ACTION_TYPES.find(a => a.value === action);
    return found ? found.label : action;
  };

  const cleanIP = (ip) => ip ? ip.replace('::ffff:', '') : 'N/A';

  const getActionBadge = (action) => (
    <span style={{
      backgroundColor: ACTION_COLORS[action] || '#6366f1',
      color: 'white',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: '500',
      whiteSpace: 'nowrap'
    }}>
      {formatActionLabel(action)}
    </span>
  );

  const formatDetails = (details, action) => {
    if (!details) return <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>;
    try {
      const d = typeof details === 'string' ? JSON.parse(details) : details;

      const rows = [];
      if (d.templateTitle)  rows.push(`Form: ${d.templateTitle}`);
      if (d.location)       rows.push(`Location: ${d.location}`);
      if (d.equipmentId)    rows.push(`Equipment: ${d.equipmentId}`);
      if (d.photoCount)     rows.push(`Photos: ${d.photoCount}`);
      if (d.signatureType)  rows.push(`Signed by: ${d.signatureType}`);
      if (d.reviewComments) rows.push(`Comments: ${d.reviewComments}`);
      if (d.fieldsUpdated)  rows.push(`Fields updated: ${d.fieldsUpdated}`);
      if (d.email)          rows.push(d.email);
      if (d.role)           rows.push(`Role: ${d.role}`);
      if (d.deletedEmail)   rows.push(d.deletedEmail);
      if (d.count !== undefined) rows.push(`${d.count} users`);

      if (rows.length === 0) return <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>;

      return (
        <div style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.6' }}>
          {rows.map((r, i) => <div key={i}>{r}</div>)}
        </div>
      );
    } catch {
      return <span style={{ fontSize: '12px', color: '#64748b' }}>{String(details)}</span>;
    }
  };

  const totalPages = Math.ceil(total / limit);
  const hasActiveFilters = filterUser || filterAction || filterRole || filterDateFrom || filterDateTo;

  const selectStyle = {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    fontSize: '0.875rem',
    background: 'white',
    cursor: 'pointer',
    minWidth: '200px'
  };

  const inputStyle = {
    ...selectStyle,
    minWidth: '140px'
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Audit Logs</h1>
          <p style={{ color: '#64748b', marginTop: '8px' }}>
            Complete activity trail — {total} total events
          </p>
        </div>
        <button onClick={loadLogs} className="btn btn-secondary">
          <RefreshCw size={20} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div style={{
        background: 'white',
        borderRadius: '8px',
        padding: '16px 20px',
        marginBottom: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        alignItems: 'flex-end'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b' }}>
          <Filter size={16} />
          <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Filters</span>
        </div>

        {/* User dropdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>User</label>
          <select style={selectStyle} value={filterUser} onChange={handleFilterChange(setFilterUser)}>
            <option value="">All Users</option>
            {auditUsers.map(u => (
              <option key={u.user_id} value={u.user_id}>
                {u.user_name} ({u.user_email})
              </option>
            ))}
          </select>
        </div>

        {/* Action type dropdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Action Type</label>
          <select style={selectStyle} value={filterAction} onChange={handleFilterChange(setFilterAction)}>
            {ACTION_TYPES.map(a => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>

        {/* Role dropdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Role</label>
          <select style={selectStyle} value={filterRole} onChange={handleFilterChange(setFilterRole)}>
            {ROLES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        {/* Date from */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>From Date</label>
          <input type="date" style={inputStyle} value={filterDateFrom}
            onChange={handleFilterChange(setFilterDateFrom)} />
        </div>

        {/* Date to */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>To Date</label>
          <input type="date" style={inputStyle} value={filterDateTo}
            onChange={handleFilterChange(setFilterDateTo)} />
        </div>

        {/* Reset */}
        {hasActiveFilters && (
          <button onClick={resetFilters} className="btn btn-secondary btn-sm"
            style={{ alignSelf: 'flex-end' }}>
            Clear Filters
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading audit logs...</p>
        </div>
      ) : (
        <>
          <div className="audit-logs-table">
            <table style={{ tableLayout: 'fixed', width: '100%' }}>
              <colgroup>
                <col style={{ width: '16%' }} />  {/* Date & Time */}
                <col style={{ width: '18%' }} />  {/* User */}
                <col style={{ width: '8%'  }} />  {/* Role */}
                <col style={{ width: '16%' }} />  {/* Action */}
                <col style={{ width: '30%' }} />  {/* Details */}
                <col style={{ width: '12%' }} />  {/* IP Address */}
              </colgroup>
              <thead>
                <tr>
                  <th><Calendar size={14} /> Date & Time</th>
                  <th><User size={14} /> User</th>
                  <th>Role</th>
                  <th><Activity size={14} /> Action</th>
                  <th><Shield size={14} /> Details</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                      No audit logs found for the selected filters
                    </td>
                  </tr>
                ) : (
                  logs.map(log => (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '8px' }}>
                        {formatDate(log.created_at)}
                      </td>
                      <td style={{ overflow: 'hidden' }}>
                        <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.user_name || 'Unknown'}</div>
                        <div style={{ fontSize: '12px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.user_email || 'N/A'}</div>
                      </td>
                      <td>
                        <span style={{
                          fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
                          padding: '2px 6px', borderRadius: '4px',
                          background: log.user_role === 'admin' ? '#fee2e2' :
                                      log.user_role === 'supervisor' ? '#fef3c7' : '#dbeafe',
                          color: log.user_role === 'admin' ? '#991b1b' :
                                 log.user_role === 'supervisor' ? '#92400e' : '#1e40af'
                        }}>
                          {log.user_role || '—'}
                        </span>
                      </td>
                      <td>{getActionBadge(log.action)}</td>
                      <td>
                        {log.entity_type && log.entity_id && (
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '3px' }}>
                            {log.entity_type} #{log.entity_id}
                          </div>
                        )}
                        {formatDetails(log.details, log.action)}
                      </td>
                      <td style={{ fontSize: '12px', color: '#64748b' }}>
                        {cleanIP(log.ip_address)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0} className="btn btn-secondary">
                Previous
              </button>
              <span style={{ margin: '0 20px', color: '#64748b' }}>
                Page {page + 1} of {totalPages}
              </span>
              <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1} className="btn btn-secondary">
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
