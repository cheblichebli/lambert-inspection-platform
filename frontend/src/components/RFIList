import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { rfiAPI } from '../api';
import { Plus } from 'lucide-react';

const STATUS_META = {
  draft:                          { label: 'Draft',                color: '#64748b', bg: '#f1f5f9' },
  submitted:                      { label: 'Submitted',             color: '#3b82f6', bg: '#eff6ff' },
  in_review:                      { label: 'In Review',             color: '#8b5cf6', bg: '#f5f3ff' },
  approved:                       { label: 'Approved',              color: '#10b981', bg: '#f0fdf4' },
  approved_commented_resubmit:    { label: 'Approved — Resubmit',   color: '#f59e0b', bg: '#fffbeb' },
  approved_commented_no_resubmit: { label: 'Approved w/ Comments',  color: '#0ea5e9', bg: '#f0f9ff' },
  rejected:                       { label: 'Rejected',              color: '#dc2626', bg: '#fef2f2' },
};

const TYPE_COLOR = { Mechanical: '#0ea5e9', Electrical: '#f59e0b' };

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const RFIList = ({ user }) => {
  const navigate = useNavigate();
  const [rfis, setRfis] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [typeFilter, setTypeFilter] = useState('');

  const isSupervisor = ['admin', 'supervisor'].includes(user?.role);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const filters = {};
      if (typeFilter) filters.type = typeFilter;
      const [data, statsData] = await Promise.all([
        rfiAPI.getAll(filters),
        rfiAPI.getStats(),
      ]);
      setRfis(data);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load RFIs:', err);
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = rfis.filter(r => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return ['submitted', 'in_review'].includes(r.status);
    if (activeTab === 'approved') return ['approved', 'approved_commented_no_resubmit'].includes(r.status);
    if (activeTab === 'action') return ['approved_commented_resubmit', 'rejected'].includes(r.status);
    if (activeTab === 'draft') return r.status === 'draft';
    return true;
  });

  const tabs = [
    { key: 'all',      label: 'All',            count: parseInt(stats.total || 0) },
    { key: 'pending',  label: 'Pending Review',  count: parseInt(stats.submitted || 0) + parseInt(stats.in_review || 0) },
    { key: 'approved', label: 'Approved',        count: parseInt(stats.approved || 0) + parseInt(stats.approved_commented || 0) },
    { key: 'action',   label: 'Action Required', count: parseInt(stats.resubmit || 0) + parseInt(stats.rejected || 0) },
    { key: 'draft',    label: 'Drafts',          count: parseInt(stats.draft || 0) },
  ];

  return (
    <div className="page-container">
      <div className="page-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1>Request for Inspection (RFI)</h1>
          <p style={{ color: '#64748b', marginTop: '4px', fontSize: '0.9rem' }}>
            {isSupervisor
              ? 'Review and process incoming RFIs from the execution team.'
              : 'Submit and track inspection requests for QC processing.'}
          </p>
        </div>
        <button
          onClick={() => navigate('/rfi/new')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#4a9d5f', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}
        >
          <Plus size={18} /> New RFI
        </button>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Mechanical', value: stats.mechanical || 0, color: TYPE_COLOR.Mechanical, bg: '#f0f9ff' },
          { label: 'Electrical', value: stats.electrical || 0, color: TYPE_COLOR.Electrical, bg: '#fffbeb' },
          { label: 'In Review',  value: parseInt(stats.submitted || 0) + parseInt(stats.in_review || 0), color: '#8b5cf6', bg: '#f5f3ff' },
          { label: 'Approved',   value: parseInt(stats.approved || 0) + parseInt(stats.approved_commented || 0), color: '#10b981', bg: '#f0fdf4' },
          { label: 'Rejected',   value: stats.rejected || 0, color: '#dc2626', bg: '#fef2f2' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}30`, borderRadius: '10px', padding: '14px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color, margin: 0, lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '4px 0 0', fontWeight: 500 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '4px', borderBottom: '2px solid #e2e8f0' }}>
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: '0.875rem', fontWeight: activeTab === tab.key ? 700 : 400,
              color: activeTab === tab.key ? '#4a9d5f' : '#64748b',
              borderBottom: activeTab === tab.key ? '2px solid #4a9d5f' : '2px solid transparent',
              marginBottom: '-2px', borderRadius: '4px 4px 0 0'
            }}>
              {tab.label}
              {tab.count > 0 && (
                <span style={{ marginLeft: '6px', background: activeTab === tab.key ? '#4a9d5f' : '#e2e8f0', color: activeTab === tab.key ? 'white' : '#64748b', borderRadius: '10px', padding: '1px 7px', fontSize: '0.7rem', fontWeight: 700 }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="form-control"
          style={{ width: 'auto', padding: '6px 12px', fontSize: '0.875rem' }}
        >
          <option value="">All Types</option>
          <option value="Mechanical">Mechanical</option>
          <option value="Electrical">Electrical</option>
        </select>
      </div>

      {/* RFI cards */}
      {loading ? (
        <div className="loading-container"><div className="spinner"></div></div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
          <p style={{ fontSize: '2rem', marginBottom: '8px' }}>📋</p>
          <p style={{ fontWeight: 600, color: '#64748b' }}>No RFIs in this category</p>
          <button onClick={() => navigate('/rfi/new')} style={{ marginTop: '16px', padding: '8px 20px', background: '#4a9d5f', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
            Submit First RFI
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
          {filtered.map(rfi => {
            const meta = STATUS_META[rfi.status] || STATUS_META.draft;
            const typeColor = TYPE_COLOR[rfi.type] || '#64748b';
            const needsAction = ['approved_commented_resubmit', 'rejected'].includes(rfi.status);
            return (
              <div
                key={rfi.id}
                onClick={() => navigate(`/rfi/${rfi.id}`)}
                style={{
                  background: 'white', border: `1px solid ${needsAction ? '#fca5a5' : '#e2e8f0'}`,
                  borderLeft: `4px solid ${needsAction ? '#ef4444' : typeColor}`,
                  borderRadius: '10px', padding: '14px 18px', cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'box-shadow 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, background: typeColor + '20', color: typeColor, border: `1px solid ${typeColor}40` }}>
                        {rfi.type}
                      </span>
                      <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 600, background: meta.bg, color: meta.color, border: `1px solid ${meta.color}30` }}>
                        {meta.label}
                      </span>
                      {rfi.cycle > 1 && (
                        <span style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }}>
                          Cycle {rfi.cycle}
                        </span>
                      )}
                      {rfi.ncr_triggered && (
                        <span style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' }}>
                          NCR Issued
                        </span>
                      )}
                    </div>
                    <p style={{ fontWeight: 700, color: '#1e293b', margin: '0 0 2px', fontSize: '0.95rem' }}>
                      {rfi.rfi_number || `RFI #${rfi.id}`}
                      {rfi.description ? ` — ${rfi.description.slice(0, 80)}${rfi.description.length > 80 ? '…' : ''}` : ''}
                    </p>
                    <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                      <span><strong>Stage:</strong> {rfi.stage}</span>
                      {rfi.location && <span><strong>Location:</strong> {rfi.location}</span>}
                      {rfi.system && <span><strong>System:</strong> {rfi.system}</span>}
                      <span><strong>Initiated by:</strong> {rfi.initiated_by_name || '—'}</span>
                      {rfi.assigned_to_name && <span><strong>QC Engineer:</strong> {rfi.assigned_to_name}</span>}
                      <span><strong>Created:</strong> {fmtDate(rfi.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RFIList;
