import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { inspectionsAPI } from '../api';
import { CheckCircle, XCircle, ArrowLeft, Download } from 'lucide-react';

// ── PDF Export ────────────────────────────────────────────────────────────────
const generateInspectionPDF = async (inspection, formData, templateFields, gpsAddress) => {
  // Fetch logo as base64
  let logoHTML = `<div style="width:52px;height:52px;background:#4a9d5f;border-radius:10px;display:flex;align-items:center;justify-content:center;color:white;font-size:22px;font-weight:900;flex-shrink:0;">L</div>`;
  try {
    const logoUrl = window.location.origin + '/lambert-logo.jpg';
    const resp = await fetch(logoUrl);
    if (resp.ok) {
      const blob = await resp.blob();
      const b64 = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
      logoHTML = `<img src="${b64}" alt="Lambert Logo" style="height:52px;width:auto;object-fit:contain;flex-shrink:0;" />`;
    }
  } catch(e) {}
  const fieldMap = {};
  templateFields.forEach(f => { fieldMap[f.id] = f; });

  const statusColors = { draft: '#64748b', submitted: '#2563eb', approved: '#16a34a', rejected: '#dc2626' };
  const statusColor = statusColors[inspection.status] || '#64748b';

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  // ── Helpers ──────────────────────────────────────────────────────────────
  const getColGroup = (col) => col.includes(' > ') ? col.split(' > ')[0].trim() : null;
  const getColCore = (col) => col.includes(' > ') ? col.split(' > ')[1].trim() : col;
  const getColType = (col) => { const c = getColCore(col); return c.startsWith('check:') ? 'check' : c.startsWith('date:') ? 'date' : 'text'; };
  const getColLabel = (col) => getColCore(col).replace(/^(text:|check:|date:)/, '');

  const renderTableHTML = (field, rows) => {
    if (!rows || !Array.isArray(rows) || rows.length === 0) return '';
    const columns = field.columns || [];
    if (!columns.length) return '';

    const hasGroups = columns.some(col => getColGroup(col) !== null);
    let groupRow = '';
    if (hasGroups) {
      let gi = 0; const headers = [];
      while (gi < columns.length) {
        const grp = getColGroup(columns[gi]);
        let span = 1;
        while (gi + span < columns.length && getColGroup(columns[gi + span]) === grp) span++;
        headers.push(`<th colspan="${span}" style="background:#334155;color:white;text-align:center;padding:7px 10px;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;border:1px solid #475569;">${grp || ''}</th>`);
        gi += span;
      }
      groupRow = `<tr>${headers.join('')}</tr>`;
    }

    const colHeaders = columns.map(col =>
      `<th style="background:#f1f5f9;padding:7px 10px;text-align:${getColType(col) === 'check' ? 'center' : 'left'};font-size:10px;color:#374151;border:1px solid #cbd5e1;white-space:nowrap;">${getColLabel(col)}</th>`
    ).join('');

    const bodyRows = rows.map((row, ri) => {
      const cells = columns.map((col, ci) => {
        const t = getColType(col);
        const v = row[ci];
        let cell = '';
        if (t === 'check') {
          cell = (v === true || v === 'true')
            ? '<span style="color:#16a34a;font-size:14px;font-weight:bold;">✓</span>'
            : '<span style="color:#cbd5e1;">—</span>';
        } else {
          cell = v ? String(v) : '<span style="color:#cbd5e1;">—</span>';
        }
        return `<td style="padding:7px 10px;text-align:${t === 'check' ? 'center' : 'left'};border:1px solid #e2e8f0;font-size:10px;color:#374151;background:${ri % 2 === 0 ? 'white' : '#f8fafc'};">${cell}</td>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    }).join('');

    return `
      <div style="overflow-x:auto;margin-top:8px;">
        <table style="border-collapse:collapse;width:100%;font-size:10px;">
          <thead>${groupRow}<tr>${colHeaders}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>`;
  };

  const renderSignatoriesHTML = (field, rows) => {
    if (!Array.isArray(rows) || rows.length === 0) return '';
    const headers = ['Name','Role','Signature','Date'].map(h =>
      `<th style="background:#f1f5f9;padding:7px 12px;text-align:left;font-size:10px;color:#374151;border:1px solid #cbd5e1;">${h}</th>`
    ).join('');
    const bodyRows = rows.map((row, ri) => `
      <tr style="background:${ri%2===0?'white':'#f8fafc'};">
        <td style="padding:8px 12px;border:1px solid #e2e8f0;font-size:10px;">${row.name||'—'}</td>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;font-size:10px;font-weight:600;">${row.role||'—'}</td>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;font-size:10px;font-family:cursive;">${row.signature||''}</td>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;font-size:10px;">${row.date||'—'}</td>
      </tr>`).join('');
    return `<table style="border-collapse:collapse;width:100%;"><thead><tr>${headers}</tr></thead><tbody>${bodyRows}</tbody></table>`;
  };

  // ── Build form fields HTML ───────────────────────────────────────────────
  let formSections = '';
  const simpleFields = [];

  templateFields.forEach(field => {
    const value = formData[field.id];

    if (field.type === 'note') {
      // Flush pending simple fields first
      if (simpleFields.length) {
        formSections += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:0;">${simpleFields.splice(0).join('')}</div>`;
      }
      formSections += `
        <div style="background:#fffbeb;border:1px solid #fcd34d;border-left:4px solid #f59e0b;border-radius:6px;padding:12px 16px;margin:12px 0;">
          <div style="display:flex;gap:8px;align-items:flex-start;">
            <span style="font-size:13px;flex-shrink:0;">📌</span>
            <p style="margin:0;font-size:10px;color:#92400e;line-height:1.6;">${(field.placeholder || field.label).replace(/\n/g,'<br>')}</p>
          </div>
        </div>`;
      return;
    }

    if (field.type === 'table') {
      if (simpleFields.length) {
        formSections += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:0;">${simpleFields.splice(0).join('')}</div>`;
      }
      if (value && Array.isArray(value) && value.length > 0) {
        formSections += `
          <div style="margin:12px 0;">
            <p style="font-size:10px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">${field.label}</p>
            ${renderTableHTML(field, value)}
          </div>`;
      }
      return;
    }

    if (field.type === 'signatories') {
      if (simpleFields.length) {
        formSections += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:0;">${simpleFields.splice(0).join('')}</div>`;
      }
      const rows = Array.isArray(value) ? value : [];
      if (rows.length > 0) {
        formSections += `
          <div style="margin:12px 0;">
            <p style="font-size:10px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">${field.label}</p>
            ${renderSignatoriesHTML(field, rows)}
          </div>`;
      }
      return;
    }

    if (field.type === 'photo') return;
    if (value === null || value === undefined || value === '') return;

    let displayVal = '';
    if (typeof value === 'boolean' || field.type === 'checkbox') {
      displayVal = (value === true || value === 'true') ? '✓ Yes' : '✗ No';
    } else if (Array.isArray(value)) {
      displayVal = value.join(', ');
    } else {
      displayVal = String(value);
    }

    simpleFields.push(`
      <div style="padding:8px 12px;border-bottom:1px solid #f1f5f9;${simpleFields.length%2===0?'':'border-left:1px solid #f1f5f9;'}">
        <p style="font-size:9px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;margin:0 0 2px;">${field.label}</p>
        <p style="font-size:11px;color:#1e293b;margin:0;">${displayVal}</p>
      </div>`);
  });

  if (simpleFields.length) {
    formSections += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:0;">${simpleFields.join('')}</div>`;
  }

  // ── Photos HTML ──────────────────────────────────────────────────────────
  let photosHTML = '';
  if (inspection.photos && inspection.photos.length > 0) {
    const photoItems = inspection.photos.map(photo => `
      <div style="break-inside:avoid;">
        <img src="${photo.photo_data}" alt="${photo.caption||'Photo'}"
          style="width:100%;height:160px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;display:block;"/>
        ${photo.caption ? `<p style="font-size:9px;color:#64748b;text-align:center;margin:4px 0 0;">${photo.caption}</p>` : ''}
      </div>`).join('');
    photosHTML = `
      <div style="margin-top:20px;padding-top:16px;border-top:2px solid #e2e8f0;">
        <h3 style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 12px;">
          Photos (${inspection.photos.length})
        </h3>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">${photoItems}</div>
      </div>`;
  }

  // ── Signatures HTML ──────────────────────────────────────────────────────
  let sigsHTML = '';
  if (inspection.inspector_signature || inspection.supervisor_signature) {
    const sigs = [];
    if (inspection.inspector_signature) {
      sigs.push(`
        <div>
          <p style="font-size:9px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;margin:0 0 6px;">Inspector Signature</p>
          <div style="border:1px solid #e2e8f0;border-radius:6px;padding:8px;background:#f8fafc;display:inline-block;">
            <img src="${inspection.inspector_signature}" style="max-width:200px;max-height:80px;display:block;"/>
          </div>
          ${inspection.signature_timestamp ? `<p style="font-size:9px;color:#94a3b8;margin:4px 0 0;">Signed: ${fmtDateTime(inspection.signature_timestamp)}</p>` : ''}
        </div>`);
    }
    if (inspection.supervisor_signature) {
      sigs.push(`
        <div>
          <p style="font-size:9px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;margin:0 0 6px;">Supervisor Signature</p>
          <div style="border:1px solid #e2e8f0;border-radius:6px;padding:8px;background:#f8fafc;display:inline-block;">
            <img src="${inspection.supervisor_signature}" style="max-width:200px;max-height:80px;display:block;"/>
          </div>
        </div>`);
    }
    sigsHTML = `
      <div style="margin-top:20px;padding-top:16px;border-top:2px solid #e2e8f0;">
        <div style="display:flex;gap:40px;flex-wrap:wrap;">${sigs.join('')}</div>
      </div>`;
  }

  // ── GPS HTML ─────────────────────────────────────────────────────────────
  let gpsHTML = '';
  if (inspection.gps_latitude && inspection.gps_longitude) {
    const lat = parseFloat(inspection.gps_latitude).toFixed(6);
    const lng = parseFloat(inspection.gps_longitude).toFixed(6);
    const acc = inspection.gps_accuracy ? ` (±${Math.round(inspection.gps_accuracy)}m)` : '';
    gpsHTML = `
      <div style="margin-top:8px;padding:10px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;display:flex;align-items:flex-start;gap:8px;">
        <span style="font-size:14px;flex-shrink:0;">📍</span>
        <div>
          ${gpsAddress ? `<p style="font-size:10px;color:#166534;font-weight:600;margin:0 0 2px;">${gpsAddress}</p>` : ''}
          <p style="font-size:9px;color:#4ade80;margin:0;">${lat}, ${lng}${acc}</p>
        </div>
      </div>`;
  }

  // ── Review section ───────────────────────────────────────────────────────
  let reviewHTML = '';
  if (inspection.review_comments || inspection.reviewer_name) {
    reviewHTML = `
      <div style="margin-top:20px;padding:12px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
        <p style="font-size:10px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px;">Review</p>
        ${inspection.reviewer_name ? `<p style="font-size:10px;color:#4b5563;margin:0 0 4px;"><strong>Reviewed by:</strong> ${inspection.reviewer_name} on ${fmtDateTime(inspection.reviewed_at)}</p>` : ''}
        ${inspection.review_comments ? `<p style="font-size:10px;color:#4b5563;margin:0;"><strong>Comments:</strong> ${inspection.review_comments}</p>` : ''}
      </div>`;
  }

  // ── Full HTML document ───────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Inspection Report - ${inspection.template_title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; background: white; }
    @page {
      size: A4;
      margin: 15mm 15mm 20mm 15mm;
      /* Remove browser-added URL and date headers/footers */
      @top-left { content: ''; }
      @top-right { content: ''; }
      @bottom-left { content: ''; }
      @bottom-right { content: ''; }
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
  </style>
  <script>
    window.onload = function() {
      // Small delay to ensure images load before printing
      setTimeout(function() { window.print(); }, 1200);
    };
  </script>
</head>
<body>

  <!-- Save instructions bar - hidden when printing -->
  <div class="no-print" style="position:fixed;top:0;left:0;right:0;z-index:9999;background:#1e293b;color:white;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;font-family:sans-serif;font-size:13px;">
    <span>📄 Your PDF report is ready. In the print dialog, select <strong>"Save as PDF"</strong> as the destination.</span>
    <button onclick="window.print()" style="background:#4a9d5f;color:white;border:none;padding:6px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">🖨 Print / Save PDF</button>
  </div>
  <div class="no-print" style="height:44px;"></div>

  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:3px solid #4a9d5f;margin-bottom:20px;">
    <div style="display:flex;align-items:center;gap:14px;">
      <div style="width:52px;height:52px;background:#4a9d5f;border-radius:10px;display:flex;align-items:center;justify-content:center;color:white;font-size:22px;font-weight:900;letter-spacing:-1px;flex-shrink:0;">L</div>
      <div>
        <p style="font-size:18px;font-weight:800;color:#1e293b;line-height:1;">LAMBERT ELECTROMEC</p>
        <p style="font-size:10px;color:#64748b;margin-top:2px;letter-spacing:0.04em;">INSPECTION MANAGEMENT PLATFORM</p>
      </div>
    </div>
    <div style="text-align:right;">
      <p style="font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Report Generated</p>
      <p style="font-size:11px;color:#374151;font-weight:600;margin-top:2px;">${fmtDateTime(new Date())}</p>
      <p style="font-size:9px;color:#94a3b8;margin-top:4px;">Ref: INS-${String(inspection.id).padStart(5,'0')}</p>
    </div>
  </div>

  <!-- Title + Status -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
    <div>
      <h1 style="font-size:20px;font-weight:800;color:#0f172a;line-height:1.2;">${inspection.template_title}</h1>
      ${inspection.template_category ? `<p style="font-size:11px;color:#64748b;margin-top:4px;">${inspection.template_category}</p>` : ''}
    </div>
    <span style="display:inline-block;padding:5px 16px;border-radius:20px;background:${statusColor};color:white;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;white-space:nowrap;margin-top:4px;">
      ${inspection.status}
    </span>
  </div>

  <!-- Inspection Meta -->
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:20px;">
    <p style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:12px;">Inspection Details</p>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
      <div>
        <p style="font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:2px;">Inspector</p>
        <p style="font-size:11px;font-weight:600;color:#1e293b;">${inspection.inspector_name || 'Unknown'}</p>
      </div>
      <div>
        <p style="font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:2px;">Location</p>
        <p style="font-size:11px;font-weight:600;color:#1e293b;">${inspection.location || '—'}</p>
      </div>
      <div>
        <p style="font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:2px;">Equipment ID</p>
        <p style="font-size:11px;font-weight:600;color:#1e293b;">${inspection.equipment_id || '—'}</p>
      </div>
      <div>
        <p style="font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:2px;">Date Created</p>
        <p style="font-size:11px;font-weight:600;color:#1e293b;">${fmtDateTime(inspection.created_at)}</p>
      </div>
      ${inspection.submitted_at ? `
      <div>
        <p style="font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:2px;">Submitted</p>
        <p style="font-size:11px;font-weight:600;color:#1e293b;">${fmtDateTime(inspection.submitted_at)}</p>
      </div>` : ''}
      ${inspection.reviewed_at ? `
      <div>
        <p style="font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:2px;">Reviewed</p>
        <p style="font-size:11px;font-weight:600;color:#1e293b;">${fmtDateTime(inspection.reviewed_at)}</p>
      </div>` : ''}
    </div>
    ${gpsHTML}
  </div>

  <!-- Form Data -->
  <div style="margin-bottom:20px;">
    <p style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #e2e8f0;">Form Data</p>
    <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      ${formSections || '<p style="padding:16px;color:#94a3b8;font-size:11px;">No form data recorded.</p>'}
    </div>
  </div>

  ${inspection.notes ? `
  <div style="margin-bottom:20px;padding:12px 16px;background:#fafafa;border:1px solid #e2e8f0;border-radius:8px;">
    <p style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px;">Additional Notes</p>
    <p style="font-size:11px;color:#374151;white-space:pre-wrap;line-height:1.6;">${inspection.notes}</p>
  </div>` : ''}

  ${sigsHTML}
  ${photosHTML}
  ${reviewHTML}

  <!-- Footer -->
  <div style="margin-top:30px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
    <p style="font-size:9px;color:#94a3b8;">Lambert Electromec Limited — Confidential Inspection Report</p>
    <p style="font-size:9px;color:#94a3b8;">INS-${String(inspection.id).padStart(5,'0')} • ${fmtDate(new Date())}</p>
  </div>

</body>
</html>`;

  // Trigger direct download as HTML file (opens in browser as self-contained PDF-ready page)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (inspection.template_title || 'Inspection').replace(/[^a-z0-9]/gi, '_');
  a.href = url;
  a.download = `INS-${String(inspection.id).padStart(5,'0')}_${safeName}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// ── Component ─────────────────────────────────────────────────────────────────
const InspectionDetail = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [inspection, setInspection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviewStatus, setReviewStatus] = useState('');
  const [reviewComments, setReviewComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expandedPhoto, setExpandedPhoto] = useState(null);
  const [gpsAddress, setGpsAddress] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  useEffect(() => { loadInspection(); }, [id]);

  useEffect(() => {
    if (inspection?.gps_latitude && inspection?.gps_longitude) {
      setGpsLoading(true);
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${inspection.gps_latitude}&lon=${inspection.gps_longitude}&format=json`)
        .then(r => r.json())
        .then(data => {
          if (data && data.display_name) {
            setGpsAddress(data.display_name);
          }
        })
        .catch(() => {})
        .finally(() => setGpsLoading(false));
    }
  }, [inspection?.gps_latitude, inspection?.gps_longitude]);

  const loadInspection = async () => {
    try {
      const data = await inspectionsAPI.getById(id);
      setInspection(data);
    } catch (error) {
      console.error('Error loading inspection:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async () => {
    if (!reviewStatus) { alert('Please select approved or rejected'); return; }
    setSubmitting(true);
    try {
      await inspectionsAPI.review(id, reviewStatus, reviewComments);
      alert('Review submitted');
      loadInspection();
    } catch (error) {
      alert('Review failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;
  if (!inspection) return <div>Inspection not found</div>;

  const formData = typeof inspection.data === 'string' ? JSON.parse(inspection.data) : (inspection.data || {});
  const templateFields = (() => {
    try {
      const raw = inspection.template_fields;
      if (!raw) return [];
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e) { return []; }
  })();

  const fieldMap = {};
  templateFields.forEach(f => { fieldMap[f.id] = f; });

  const renderFieldValue = (field, value) => {
    if (value === null || value === undefined || value === '') return null;
    if (field && ['photo','table','note','signatories'].includes(field.type)) return null;
    if ((field && field.type === 'checkbox') || typeof value === 'boolean') {
      const isTrue = value === true || value === 'true';
      return <span style={{ color: isTrue ? '#10b981' : '#ef4444', fontWeight: 500 }}>{isTrue ? '✓ Yes' : '✗ No'}</span>;
    }
    if (Array.isArray(value)) return <span>{value.join(', ')}</span>;
    return <span>{value.toString()}</span>;
  };

  const renderTableField = (field, rows) => {
    if (!rows || !Array.isArray(rows) || rows.length === 0) return null;
    const columns = field.columns || [];
    if (!columns.length) return null;
    const getColGroup = (col) => col.includes(' > ') ? col.split(' > ')[0].trim() : null;
    const getColCore = (col) => col.includes(' > ') ? col.split(' > ')[1].trim() : col;
    const getColType = (col) => { const c = getColCore(col); return c.startsWith('check:') ? 'check' : c.startsWith('date:') ? 'date' : 'text'; };
    const getColLabel = (col) => getColCore(col).replace(/^(text:|check:|date:)/, '');
    const hasGroups = columns.some(col => getColGroup(col) !== null);
    const groupHeaders = [];
    if (hasGroups) {
      let gi = 0;
      while (gi < columns.length) {
        const grp = getColGroup(columns[gi]);
        let span = 1;
        while (gi + span < columns.length && getColGroup(columns[gi + span]) === grp) span++;
        groupHeaders.push({ label: grp || '', span });
        gi += span;
      }
    }
    return (
      <div style={{ overflowX: 'auto', marginTop: '8px' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.875rem', minWidth: '400px' }}>
          <thead>
            {hasGroups && (
              <tr>
                {groupHeaders.map((gh, ghi) => (
                  <th key={ghi} colSpan={gh.span} style={{ border: '1px solid #e2e8f0', padding: '6px 12px', background: '#e2e8f0', color: '#1e293b', fontWeight: 700, textAlign: 'center', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {gh.label}
                  </th>
                ))}
              </tr>
            )}
            <tr>
              {columns.map((col, ci) => (
                <th key={ci} style={{ border: '1px solid #e2e8f0', padding: '8px 12px', background: '#f1f5f9', color: '#374151', fontWeight: 600, whiteSpace: 'nowrap', textAlign: getColType(col) === 'check' ? 'center' : 'left' }}>
                  {getColLabel(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} style={{ background: ri % 2 === 0 ? 'white' : '#f8fafc' }}>
                {columns.map((col, ci) => {
                  const colType = getColType(col);
                  const cellVal = row[ci];
                  return (
                    <td key={ci} style={{ border: '1px solid #e2e8f0', padding: '8px 12px', textAlign: colType === 'check' ? 'center' : 'left', color: '#4b5563' }}>
                      {colType === 'check'
                        ? (cellVal === true || cellVal === 'true'
                            ? <span style={{ color: '#10b981', fontSize: '1.1rem' }}>✓</span>
                            : <span style={{ color: '#cbd5e1' }}>—</span>)
                        : (cellVal || <span style={{ color: '#cbd5e1' }}>—</span>)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const hasGPS = inspection.gps_latitude && inspection.gps_longitude;
  const gpsString = hasGPS
    ? `${parseFloat(inspection.gps_latitude).toFixed(6)}, ${parseFloat(inspection.gps_longitude).toFixed(6)}${inspection.gps_accuracy ? ` (±${Math.round(inspection.gps_accuracy)}m)` : ''}`
    : null;

  const statusColors = { draft: '#64748b', submitted: '#3b82f6', approved: '#10b981', rejected: '#ef4444' };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <button onClick={() => navigate(-1)} className="btn btn-secondary">
          <ArrowLeft size={20} /> Back
        </button>
        <button
          onClick={() => generateInspectionPDF(inspection, formData, templateFields, gpsAddress)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 20px', background: '#4a9d5f', color: 'white',
            border: 'none', borderRadius: '8px', cursor: 'pointer',
            fontSize: '0.9rem', fontWeight: 600, boxShadow: '0 2px 6px rgba(74,157,95,0.3)'
          }}
        >
          <Download size={18} /> Export PDF
        </button>
      </div>

      <div className="inspection-detail">

        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ marginBottom: '8px' }}>{inspection.template_title}</h1>
          <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '12px', background: statusColors[inspection.status] || '#64748b', color: 'white', fontSize: '0.875rem', fontWeight: 600, textTransform: 'capitalize' }}>
            {inspection.status}
          </span>
        </div>

        <div className="detail-section">
          <h2>Information</h2>
          <p><strong>Inspector:</strong> {inspection.inspector_name || 'Unknown'}</p>
          <p><strong>Location:</strong> {inspection.location || 'N/A'}</p>
          <p><strong>Equipment ID:</strong> {inspection.equipment_id || 'N/A'}</p>
          {inspection.created_at && <p><strong>Created:</strong> {new Date(inspection.created_at).toLocaleString()}</p>}
          {inspection.submitted_at && <p><strong>Submitted:</strong> {new Date(inspection.submitted_at).toLocaleString()}</p>}
          {inspection.reviewed_at && <p><strong>Reviewed:</strong> {new Date(inspection.reviewed_at).toLocaleString()} by {inspection.reviewer_name}</p>}
          {inspection.review_comments && <p><strong>Review Comments:</strong> {inspection.review_comments}</p>}
        </div>

        <div className="detail-section">
          <h2>Form Data</h2>
          {Object.entries(formData).map(([key, value]) => {
            const field = fieldMap[key];
            const label = field ? field.label : key;

            if (field && field.type === 'note') {
              return (
                <div key={key} style={{ gridColumn: '1 / -1', marginBottom: '12px' }}>
                  <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderLeft: '4px solid #f59e0b', borderRadius: '6px', padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '1rem', flexShrink: 0 }}>📌</span>
                      <p style={{ margin: 0, fontSize: '0.875rem', color: '#92400e', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{field.placeholder || field.label}</p>
                    </div>
                  </div>
                </div>
              );
            }

            if (field && field.type === 'signatories') {
              const sigRows = Array.isArray(value) ? value : [];
              const roles = field.options && field.options.length > 0 ? field.options : sigRows.map(r => r.role).filter(Boolean);
              const displayRows = roles.length > 0 ? roles.map((role, ri) => sigRows[ri] || { role, name: '', signature: '', date: '' }) : sigRows;
              return (
                <div key={key} style={{ gridColumn: '1 / -1', marginBottom: '16px' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>{field.label}</p>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.875rem' }}>
                      <thead>
                        <tr>{['Name','Role','Signature','Date'].map(h => <th key={h} style={{ border: '1px solid #e2e8f0', padding: '8px 12px', background: '#f1f5f9', color: '#374151', fontWeight: 600, textAlign: 'left' }}>{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {displayRows.map((row, ri) => (
                          <tr key={ri} style={{ background: ri % 2 === 0 ? 'white' : '#f8fafc' }}>
                            <td style={{ border: '1px solid #e2e8f0', padding: '8px 12px', color: '#4b5563' }}>{row.name || <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                            <td style={{ border: '1px solid #e2e8f0', padding: '8px 12px', color: '#374151', fontWeight: 500 }}>{row.role || <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                            <td style={{ border: '1px solid #e2e8f0', padding: '8px 12px', color: '#4b5563', fontFamily: 'cursive' }}>{row.signature || <span style={{ color: '#cbd5e1', fontFamily: 'inherit' }}>—</span>}</td>
                            <td style={{ border: '1px solid #e2e8f0', padding: '8px 12px', color: '#4b5563' }}>{row.date || <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            }

            if (field && field.type === 'table') {
              return (
                <div key={key} style={{ gridColumn: '1 / -1', marginBottom: '16px' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>{label}</p>
                  {renderTableField(field, value)}
                </div>
              );
            }

            var rendered = renderFieldValue(field, value);
            if (rendered === null) return null;
            return (
              <div key={key} style={{ display: 'flex', gap: '8px', padding: '8px 0', borderBottom: '1px solid #f1f5f9', alignItems: 'flex-start' }}>
                <strong style={{ minWidth: '180px', color: '#374151' }}>{label}:</strong>
                <span style={{ color: '#4b5563' }}>{rendered}</span>
              </div>
            );
          })}
        </div>

        {hasGPS && (
          <div className="detail-section">
            <h2>GPS Location</h2>
            {gpsLoading && <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '6px' }}>Resolving address...</p>}
            {gpsAddress && (
              <p style={{ fontSize: '0.95rem', color: '#1e293b', fontWeight: 500, marginBottom: '6px', lineHeight: 1.5 }}>{gpsAddress}</p>
            )}
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '8px' }}>{gpsString}</p>
            <a href={`https://www.google.com/maps?q=${inspection.gps_latitude},${inspection.gps_longitude}`} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', fontSize: '0.875rem' }}>View on Google Maps</a>
          </div>
        )}

        {inspection.inspector_signature && (
          <div className="detail-section">
            <h2>Inspector Signature</h2>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', background: '#f8fafc', display: 'inline-block' }}>
              <img src={inspection.inspector_signature} alt="Inspector Signature" style={{ maxWidth: '300px', maxHeight: '120px', display: 'block' }} />
            </div>
            {inspection.signature_timestamp && <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Signed: {new Date(inspection.signature_timestamp).toLocaleString()}</p>}
          </div>
        )}

        {inspection.supervisor_signature && (
          <div className="detail-section">
            <h2>Supervisor Signature</h2>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', background: '#f8fafc', display: 'inline-block' }}>
              <img src={inspection.supervisor_signature} alt="Supervisor Signature" style={{ maxWidth: '300px', maxHeight: '120px', display: 'block' }} />
            </div>
          </div>
        )}

        {inspection.photos && inspection.photos.length > 0 && (
          <div className="detail-section">
            <h2>Photos ({inspection.photos.length})</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginTop: '12px' }}>
              {inspection.photos.map((photo, idx) => (
                <div key={idx}>
                  <img src={photo.photo_data} alt={photo.caption || `Photo ${idx+1}`} onClick={() => setExpandedPhoto(photo)}
                    style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer', border: '1px solid #e2e8f0', display: 'block' }} />
                  {photo.caption && <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', textAlign: 'center' }}>{photo.caption}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {inspection.notes && (
          <div className="detail-section">
            <h2>Additional Notes</h2>
            <p style={{ whiteSpace: 'pre-wrap', color: '#4b5563' }}>{inspection.notes}</p>
          </div>
        )}

        {inspection.status === 'submitted' && user && ['supervisor', 'admin'].includes(user.role) && (
          <div className="review-section">
            <h2>Review</h2>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <button onClick={() => setReviewStatus('approved')} className="btn btn-success" style={{ outline: reviewStatus === 'approved' ? '3px solid #065f46' : 'none', opacity: reviewStatus && reviewStatus !== 'approved' ? 0.5 : 1 }}>
                <CheckCircle size={20} /> Approve
              </button>
              <button onClick={() => setReviewStatus('rejected')} className="btn btn-error" style={{ outline: reviewStatus === 'rejected' ? '3px solid #7f1d1d' : 'none', opacity: reviewStatus && reviewStatus !== 'rejected' ? 0.5 : 1 }}>
                <XCircle size={20} /> Reject
              </button>
            </div>
            <textarea value={reviewComments} onChange={(e) => setReviewComments(e.target.value)} placeholder="Comments..." className="form-control" style={{ marginBottom: '12px', minHeight: '80px' }} />
            <button onClick={handleReview} disabled={!reviewStatus || submitting} className="btn btn-primary">Submit Review</button>
          </div>
        )}

      </div>

      {expandedPhoto && (
        <div onClick={() => setExpandedPhoto(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, cursor: 'zoom-out', padding: '20px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img src={expandedPhoto.photo_data} alt={expandedPhoto.caption || 'Photo'} style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: '8px' }} />
            {expandedPhoto.caption && <p style={{ color: 'white', textAlign: 'center', marginTop: '8px', fontSize: '14px' }}>{expandedPhoto.caption}</p>}
            <button onClick={() => setExpandedPhoto(null)} style={{ position: 'absolute', top: '-12px', right: '-12px', background: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', color: '#374151' }}>X</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InspectionDetail;
