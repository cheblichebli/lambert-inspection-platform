import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { rfiAPI, projectsAPI } from '../api';
import { Download, FileSpreadsheet, X } from 'lucide-react';

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
  const [exporting, setExporting] = useState(false);

  // Per-column filters
  const [colFilters, setColFilters] = useState({
    type: '', phase_of_work: '', tc_level: '', system: '', sub_system: '',
    component: '', as_built: '', floor: '', location: '', status: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, proj] = await Promise.all([
        rfiAPI.getAll({}),
        projectsAPI.getAll(),
      ]);
      setRfis(data);
      setProjects(proj);
    } catch (err) {
      console.error('Failed to load RFI log:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setColFilter = (key, val) => setColFilters(f => ({ ...f, [key]: val }));
  const clearFilters = () => setColFilters({
    type: '', phase_of_work: '', tc_level: '', system: '', sub_system: '',
    component: '', as_built: '', floor: '', location: '', status: '',
  });

  // Distinct values for the structured-field dropdowns (derived from loaded data)
  const distinct = useMemo(() => {
    const uniq = (key) => [...new Set(rfis.map(r => r[key]).filter(Boolean))].sort();
    return {
      type: uniq('type'),
      phase_of_work: uniq('phase_of_work'),
      tc_level: uniq('tc_level'),
      system: uniq('system'),
      sub_system: uniq('sub_system'),
      component: uniq('component'),
      floor: uniq('floor'),
    };
  }, [rfis]);

  const filtered = rfis.filter(r => {
    if (selectedProject && String(r.project_id) !== String(selectedProject)) return false;
    if (colFilters.type && r.type !== colFilters.type) return false;
    if (colFilters.phase_of_work && r.phase_of_work !== colFilters.phase_of_work) return false;
    if (colFilters.tc_level && r.tc_level !== colFilters.tc_level) return false;
    if (colFilters.system && r.system !== colFilters.system) return false;
    if (colFilters.sub_system && r.sub_system !== colFilters.sub_system) return false;
    if (colFilters.component && r.component !== colFilters.component) return false;
    if (colFilters.status && r.status !== colFilters.status) return false;
    if (colFilters.as_built) {
      const ab = r.as_built ? 'YES' : 'NO';
      if (ab !== colFilters.as_built) return false;
    }
    if (colFilters.floor && r.floor !== colFilters.floor) return false;
    if (colFilters.location && !String(r.location || '').toLowerCase().includes(colFilters.location.toLowerCase())) return false;
    return true;
  });

  const hasActiveFilters = selectedProject || Object.values(colFilters).some(Boolean);
  const selectedProjectData = projects.find(p => String(p.id) === String(selectedProject));

  const exportToExcel = async () => {
    setExporting(true);
    try {
      const projectName = selectedProjectData?.name || 'All Projects';
      const mainContractor = selectedProjectData?.main_contractor || '';
      const mepSub = selectedProjectData?.mep_subcontractor || 'Lambert Electromec';
      const preparedBy = user?.full_name || '';
      const typeForRef = colFilters.type === 'Electrical' ? 'ELEC' : 'MECH';

      const headers = [
        'RFI REF#', 'PHASE OF WORK', 'T&C Level', 'MAIN MEPF SYSTEM', 'SUB-SYSTEM',
        'SPECIFIC COMPONENT', 'DRAWING NO.', 'AS-BUILT', 'DESCRIPTION', 'FLOOR', 'LOCATION',
        'DATE OF SUBMISSION', 'STATUS', 'REPLY DATE', 'COMMENTS', 'REVISION'
      ];

      const rows = filtered.map(r => [
        r.rfi_number || `RFI-${r.id}`,
        r.phase_of_work || '',
        r.tc_level || '',
        r.system || '',
        r.sub_system || '',
        r.component || '',
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

      const csvLines = [
        `LAMBERT ELECTROMEC,,,,,,,,LEM-QLT-${typeForRef}-L01`,
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
      const filename = `RFI-Log-${colFilters.type || 'All'}-${projectName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
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
  const filterCellStyle = {
    padding: '4px 6px', background: '#334155', borderRight: '1px solid #475569',
  };
  const filterInputStyle = {
    width: '100%', padding: '4px 6px', fontSize: '0.72rem', borderRadius: '4px',
    border: '1px solid #475569', background: '#1e293b', color: 'white', minWidth: '90px',
  };

  // Dropdown filter cell
  const FilterSelect = ({ col, options }) => (
    <th style={filterCellStyle}>
      <select value={colFilters[col]} onChange={e => setColFilter(col, e.target.value)} style={filterInputStyle}>
        <option value="">All</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </th>
  );
  // Text-search filter cell
  const FilterText = ({ col }) => (
    <th style={filterCellStyle}>
      <input type="text" value={colFilters[col]} onChange={e => setColFilter(col, e.target.value)} placeholder="Search…" style={filterInputStyle} />
    </th>
  );
  const FilterBlank = () => <th style={filterCellStyle}></th>;

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

      {/* Top-level controls */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} className="form-control" style={{ width: 'auto', minWidth: '200px', fontSize: '0.875rem' }}>
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {hasActiveFilters && (
          <button onClick={() => { clearFilters(); setSelectedProject(''); }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
            <X size={14} /> Clear Filters
          </button>
        )}
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
              LEM-QLT-{colFilters.type === 'Electrical' ? 'ELEC' : 'MECH'}-L01 · EDITION 1
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
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: selectedProjectData ? '0 0 8px 8px' : '8px', border: '1px solid #e2e8f0', borderTop: selectedProjectData ? 'none' : '1px solid #e2e8f0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', minWidth: '1500px' }}>
            <thead>
              <tr>
                <th style={thStyle}>RFI REF#</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Phase of Work</th>
                <th style={thStyle}>T&C Level</th>
                <th style={thStyle}>Main MEPF System</th>
                <th style={thStyle}>Sub-System</th>
                <th style={thStyle}>Specific Component</th>
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
              {/* Per-column filter row */}
              <tr>
                <FilterBlank />
                <FilterSelect col="type" options={distinct.type} />
                <FilterSelect col="phase_of_work" options={distinct.phase_of_work} />
                <FilterSelect col="tc_level" options={distinct.tc_level} />
                <FilterSelect col="system" options={distinct.system} />
                <FilterSelect col="sub_system" options={distinct.sub_system} />
                <FilterSelect col="component" options={distinct.component} />
                <FilterBlank />
                <FilterSelect col="as_built" options={['YES', 'NO']} />
                <FilterBlank />
                <FilterSelect col="floor" options={distinct.floor} />
                <FilterText col="location" />
                <FilterBlank />
                <FilterSelect col="status" options={Object.keys(STATUS_META)} />
                <FilterBlank />
                <FilterBlank />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={16} style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                    <FileSpreadsheet size={40} style={{ marginBottom: '12px', opacity: 0.4 }} />
                    <p style={{ fontWeight: 600, color: '#64748b', margin: 0 }}>No RFIs match the current filters</p>
                  </td>
                </tr>
              ) : filtered.map((rfi, idx) => {
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
                    <td style={tdStyle}>{rfi.type || '—'}</td>
                    <td style={tdStyle}>{rfi.phase_of_work || '—'}</td>
                    <td style={tdStyle}>{rfi.tc_level || '—'}</td>
                    <td style={tdStyle}>{rfi.system || '—'}</td>
                    <td style={tdStyle}>{rfi.sub_system || '—'}</td>
                    <td style={tdStyle}>{rfi.component || '—'}</td>
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
