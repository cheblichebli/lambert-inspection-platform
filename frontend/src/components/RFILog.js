import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { rfiAPI, projectsAPI } from '../api';
import { Download, FileSpreadsheet } from 'lucide-react';

const STATUS_META = {
  draft:                          { label: 'Draft',                color: '#64748b' },
  submitted:                      { label: 'Submitted',             color: '#3b82f6' },
  in_review:                      { label: 'In Review',             color: '#8b5cf6' },
  approved:                       { label: 'Approved',              color: '#10b981' },
  approved_commented_resubmit:    { label: 'Appr. — Resubmit',     color: '#f59e0b' },
  approved_commented_no_resubmit: { label: 'Appr. w/ Comments',    color: '#0ea5e9' },
  rejected:                       { label: 'Rejected',              color: '#dc2626' },
};

const fmtDate = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const RFILog = ({ user }) => {
  const navigate = useNavigate();
  const [rfis, setRfis] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const filters = {};
      if (typeFilter) filters.type = typeFilter;
      const [data, proj] = await Promise.all([
        rfiAPI.getAll(filters),
        projectsAPI.getAll(),
      ]);
      setRfis(data);
      setProjects(proj);
    } catch (err) {
      console.error('Failed to load RFI log:', err);
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = rfis.filter(r => {
    if (selectedProject && String(r.project_id) !== String(selectedProject)) return false;
    return true;
  });

  const selectedProjectData = projects.find(p => String(p.id) === String(selectedProject));

  const exportToExcel = async () => {
    setExporting(true);
    try {
      // Build CSV content matching Lambert's RFI log format
      const projectName = selectedProjectData?.name || 'All Projects';
      const mainContractor = selectedProjectData?.main_contractor || '';
      const mepSub = selectedProjectData?.mep_subcontractor || 'Lambert Electromec';
      const preparedBy = user?.full_name || '';

      const headers = [
        'RFI REF#', 'PHASE OF WORK', 'T&C Level', 'SYSTEM', 'SUB-SYSTEM',
        'DRAWING NO.', 'AS-BUILT', 'DESCRIPTION', 'FLOOR', 'LOCATION',
        'DATE OF SUBMISSION', 'STATUS', 'REPLY DATE', 'COMMENTS', 'REVISION'
      ];

      const rows = filtered.map(r => [
        r.rfi_number || `RFI-${r.id}`,
        r.phase_of_work || '',
        r.tc_level || '',
        r.system || '',
        r.sub_system || '',
        r.drawing_no || '',
        r.as_built ? 'YES' : 'NO',
        r.description || '',
        r.floor || '',
        r.location || '',
        fmtDate(r.submitted_at),
        STATUS_META[r.status]?.label || r.status,
        fmtDate(r.reply_date),
        r.qc_comments || '',
        r.cycle > 1 ? String(r.cycle - 1) : '0',
      ]);

      // Build CSV with Lambert header block
      const csvLines = [
        `LAMBERT ELECTROMEC,,,,,,,,LEM-QLT-${typeFilter === 'Electrical' ? 'ELEC' : 'MECH'}-L01`,
        `Request For Inspection Log,,,,,,,,EDITION 1`,
        `,,,,,,,,Effective Date`,
        `Project Title,,,${projectName}`,
        `Main Contractor,,,${mainContractor}`,
        `MEP Sub Contractor,,,${mepSub},,,,,,,,Prepared BY,${preparedBy}`,
        `INSPECTION REQUEST LOG`,
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ];

      const csvContent = csvLines.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filename = `RFI-Log-${typeFilter || 'All'}-${projectName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const thStyle = {
    padding: '10px 12px', background: '#1e293b', color: 'white',
    fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.05em', textAlign: 'left', whiteSpace: 'nowrap',
    borderRight: '1px solid #334155',
  };
  const tdStyle = {
    padding: '8px 12px', fontSize: '0.8rem', color: '#374151',
    borderBottom: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9',
    whiteSpace: 'nowrap', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis',
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0 }}>RFI Inspection Log</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '4px 0 0' }}>
            Lambert Electromec — Request for Inspection Register
          </p>
        </div>
        <button
          onClick={exportToExcel}
          disabled={exporting || filtered.length === 0}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#4a9d5f', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', opacity: filtered.length === 0 ? 0.5 : 1 }}
        >
          <Download size={16} />
          {exporting ? 'Exporting...' : 'Export to Excel'}
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} className="form-control" style={{ width: 'auto', minWidth: '200px', fontSize: '0.875rem' }}>
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="form-control" style={{ width: 'auto', fontSize: '0.875rem' }}>
          <option value="">All Types</option>
          <option value="Mechanical">Mechanical</option>
          <option value="Electrical">Electrical</option>
        </select>
        <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: 'auto' }}>
          {filtered.length} RFI{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Lambert-style header block */}
      {selectedProjectData && (
        <div style={{ background: '#1e293b', color: 'white', borderRadius: '8px 8px 0 0', padding: '12px 16px', fontSize: '0.8rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <strong>LAMBERT ELECTROMEC</strong> — Request For Inspection Log
            </div>
            <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#94a3b8' }}>
              LEM-QLT-{typeFilter === 'Electrical' ? 'ELEC' : 'MECH'}-L01 · EDITION 1
            </div>
          </div>
          <div style={{ display: 'flex', gap: '32px', marginTop: '8px', fontSize: '0.75rem', color: '#cbd5e1', flexWrap: 'wrap' }}>
            <span><strong style={{ color: 'white' }}>Project:</strong> {selectedProjectData.name}</span>
            {selectedProjectData.main_contractor && <span><strong style={{ color: 'white' }}>Main Contractor:</strong> {selectedProjectData.main_contractor}</span>}
            <span><strong style={{ color: 'white' }}>MEP Sub:</strong> {selectedProjectData.mep_subcontractor || 'Lambert Electromec'}</span>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="loading-container"><div className="spinner"></div></div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8', background: 'white', border: '1px solid #e2e8f0', borderRadius: selectedProjectData ? '0 0 8px 8px' : '8px' }}>
          <FileSpreadsheet size={40} style={{ marginBottom: '12px', opacity: 0.4 }} />
          <p style={{ fontWeight: 600, color: '#64748b' }}>No RFIs found</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: selectedProjectData ? '0 0 8px 8px' : '8px', border: '1px solid #e2e8f0', borderTop: selectedProjectData ? 'none' : '1px solid #e2e8f0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', minWidth: '1200px' }}>
            <thead>
              <tr>
                <th style={thStyle}>RFI REF#</th>
                <th style={thStyle}>Phase of Work</th>
                <th style={thStyle}>T&C Level</th>
                <th style={thStyle}>System</th>
                <th style={thStyle}>Sub-System</th>
                <th style={thStyle}>Drawing No.</th>
                <th style={thStyle}>As-Built</th>
                <th style={{ ...thStyle, maxWidth: '250px' }}>Description</th>
                <th style={thStyle}>Floor</th>
                <th style={thStyle}>Location</th>
                <th style={thStyle}>Submission Date</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Reply Date</th>
                <th style={{ ...thStyle, borderRight: 'none' }}>Revision</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((rfi, idx) => {
                const statusMeta = STATUS_META[rfi.status] || { label: rfi.status, color: '#64748b' };
                return (
                  <tr
                    key={rfi.id}
                    onClick={() => navigate(`/rfi/${rfi.id}`)}
                    style={{ cursor: 'pointer', background: idx % 2 === 0 ? 'white' : '#f8fafc' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                    onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'white' : '#f8fafc'}
                  >
                    <td style={{ ...tdStyle, fontWeight: 700, color: '#1e293b' }}>{rfi.rfi_number || `RFI-${rfi.id}`}</td>
                    <td style={tdStyle}>{rfi.phase_of_work || '—'}</td>
                    <td style={tdStyle}>{rfi.tc_level || '—'}</td>
                    <td style={tdStyle}>{rfi.system || '—'}</td>
                    <td style={tdStyle}>{rfi.sub_system || '—'}</td>
                    <td style={tdStyle}>{rfi.drawing_no || '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, background: rfi.as_built ? '#f0fdf4' : '#f1f5f9', color: rfi.as_built ? '#10b981' : '#64748b' }}>
                        {rfi.as_built ? 'YES' : 'NO'}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, maxWidth: '250px' }} title={rfi.description}>{rfi.description || '—'}</td>
                    <td style={tdStyle}>{rfi.floor || '—'}</td>
                    <td style={tdStyle}>{rfi.location || '—'}</td>
                    <td style={tdStyle}>{fmtDate(rfi.submitted_at)}</td>
                    <td style={tdStyle}>
                      <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 600, background: statusMeta.color + '15', color: statusMeta.color, border: `1px solid ${statusMeta.color}30` }}>
                        {statusMeta.label}
                      </span>
                    </td>
                    <td style={tdStyle}>{fmtDate(rfi.reply_date)}</td>
                    <td style={{ ...tdStyle, borderRight: 'none', textAlign: 'center' }}>{rfi.cycle > 1 ? rfi.cycle - 1 : 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default RFILog;
