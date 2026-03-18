const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = 'Lambert Inspection Platform <onboarding@resend.dev>';
const APP_URL = process.env.APP_URL || 'https://lambert-inspection-platform.vercel.app';

// ── Shared styles ─────────────────────────────────────────────────────────────
const baseStyle = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  max-width: 600px;
  margin: 0 auto;
  background: #ffffff;
`;

const headerStyle = `
  background: #4a9d5f;
  padding: 28px 32px;
  border-radius: 8px 8px 0 0;
`;

const bodyStyle = `
  padding: 28px 32px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-top: none;
`;

const footerStyle = `
  padding: 16px 32px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-top: none;
  border-radius: 0 0 8px 8px;
  font-size: 12px;
  color: #94a3b8;
  text-align: center;
`;

const btnStyle = `
  display: inline-block;
  padding: 12px 24px;
  background: #4a9d5f;
  color: white;
  text-decoration: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 14px;
  margin-top: 20px;
`;

const labelStyle = `
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
  margin-bottom: 2px;
`;

const valueStyle = `
  font-size: 15px;
  color: #1e293b;
  margin-bottom: 12px;
`;

const dividerStyle = `
  border: none;
  border-top: 1px solid #e2e8f0;
  margin: 20px 0;
`;

function layout(title, content) {
  return `
    <div style="${baseStyle}">
      <div style="${headerStyle}">
        <img src="${APP_URL}/lambert-logo-white.png" alt="Lambert Electromec" style="height:40px;width:auto;" />
      </div>
      <div style="${bodyStyle}">
        <h2 style="margin:0 0 20px;font-size:20px;color:#1e293b;">${title}</h2>
        ${content}
      </div>
      <div style="${footerStyle}">
        Lambert Electromec Digital Inspection Platform &nbsp;·&nbsp;
        This is an automated notification — please do not reply to this email.
      </div>
    </div>
  `;
}

function field(label, value) {
  return `
    <p style="${labelStyle}">${label}</p>
    <p style="${valueStyle}">${value || '—'}</p>
  `;
}

// ── 1. Inspection submitted → supervisors + admins ────────────────────────────
async function sendInspectionSubmitted({ toEmails, inspectorName, templateTitle, location, equipmentId, inspectionId }) {
  if (!toEmails || toEmails.length === 0) return;
  const url = `${APP_URL}/inspections/${inspectionId}`;
  const html = layout('New Inspection Submitted', `
    <p style="color:#4b5563;margin-bottom:20px;">
      A new inspection has been submitted and is awaiting your review.
    </p>
    ${field('Inspector', inspectorName)}
    ${field('Form', templateTitle)}
    ${field('Location', location)}
    ${field('Equipment ID', equipmentId)}
    <hr style="${dividerStyle}" />
    <a href="${url}" style="${btnStyle}">Review Inspection</a>
  `);

  try {
    await resend.emails.send({
      from: FROM,
      to: toEmails,
      subject: `New Inspection Submitted — ${templateTitle}`,
      html,
    });
  } catch (err) {
    console.error('Email error (inspection submitted):', err);
  }
}

// ── 2. Inspection approved → inspector ───────────────────────────────────────
async function sendInspectionApproved({ toEmail, inspectorName, templateTitle, location, reviewerName, comments, inspectionId }) {
  if (!toEmail) return;
  const url = `${APP_URL}/inspections/${inspectionId}`;
  const html = layout('Inspection Approved ✓', `
    <p style="color:#4b5563;margin-bottom:20px;">
      Hi ${inspectorName}, your inspection has been <strong style="color:#16a34a;">approved</strong>.
    </p>
    ${field('Form', templateTitle)}
    ${field('Location', location)}
    ${field('Reviewed by', reviewerName)}
    ${comments ? field('Comments', comments) : ''}
    <hr style="${dividerStyle}" />
    <a href="${url}" style="${btnStyle}">View Inspection</a>
  `);

  try {
    await resend.emails.send({
      from: FROM,
      to: toEmail,
      subject: `Inspection Approved — ${templateTitle}`,
      html,
    });
  } catch (err) {
    console.error('Email error (inspection approved):', err);
  }
}

// ── 3. Inspection rejected → inspector ───────────────────────────────────────
async function sendInspectionRejected({ toEmail, inspectorName, templateTitle, location, reviewerName, comments, inspectionId }) {
  if (!toEmail) return;
  const url = `${APP_URL}/inspections/${inspectionId}`;
  const html = layout('Inspection Rejected', `
    <p style="color:#4b5563;margin-bottom:20px;">
      Hi ${inspectorName}, your inspection has been <strong style="color:#dc2626;">rejected</strong>.
    </p>
    ${field('Form', templateTitle)}
    ${field('Location', location)}
    ${field('Reviewed by', reviewerName)}
    ${field('Rejection reason', comments || 'No comments provided')}
    <hr style="${dividerStyle}" />
    <a href="${url}" style="${btnStyle}">View Inspection</a>
  `);

  try {
    await resend.emails.send({
      from: FROM,
      to: toEmail,
      subject: `Inspection Rejected — ${templateTitle}`,
      html,
    });
  } catch (err) {
    console.error('Email error (inspection rejected):', err);
  }
}

// ── 4. CAPA assigned → responsible user ──────────────────────────────────────
async function sendCapaAssigned({ toEmail, assigneeName, title, description, priority, dueDate, createdByName, inspectionId }) {
  if (!toEmail) return;
  const url = `${APP_URL}/capa`;
  const priorityColors = { critical: '#dc2626', major: '#d97706', minor: '#64748b' };
  const priorityColor = priorityColors[priority] || '#64748b';
  const html = layout('Corrective Action Assigned to You', `
    <p style="color:#4b5563;margin-bottom:20px;">
      Hi ${assigneeName}, a corrective action has been assigned to you and requires your attention.
    </p>
    ${field('Issue', title)}
    ${description ? field('Description', description) : ''}
    <p style="${labelStyle}">Priority</p>
    <p style="font-size:15px;color:${priorityColor};font-weight:700;text-transform:capitalize;margin-bottom:12px;">${priority}</p>
    ${dueDate ? field('Due Date', new Date(dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })) : ''}
    ${field('Assigned by', createdByName)}
    <hr style="${dividerStyle}" />
    <a href="${url}" style="${btnStyle}">View Corrective Actions</a>
  `);

  try {
    await resend.emails.send({
      from: FROM,
      to: toEmail,
      subject: `CAPA Assigned — ${title}`,
      html,
    });
  } catch (err) {
    console.error('Email error (CAPA assigned):', err);
  }
}

// ── 5. CAPA closed → supervisor who created it ────────────────────────────────
async function sendCapaClosed({ toEmail, supervisorName, title, assigneeName, evidenceNote, closedByName }) {
  if (!toEmail) return;
  const url = `${APP_URL}/capa`;
  const html = layout('Corrective Action Closed ✓', `
    <p style="color:#4b5563;margin-bottom:20px;">
      Hi ${supervisorName}, a corrective action you raised has been closed.
    </p>
    ${field('Issue', title)}
    ${field('Actioned by', assigneeName)}
    ${field('Closed by', closedByName)}
    ${evidenceNote ? field('Evidence note', evidenceNote) : ''}
    <hr style="${dividerStyle}" />
    <a href="${url}" style="${btnStyle}">View Corrective Actions</a>
  `);

  try {
    await resend.emails.send({
      from: FROM,
      to: toEmail,
      subject: `CAPA Closed — ${title}`,
      html,
    });
  } catch (err) {
    console.error('Email error (CAPA closed):', err);
  }
}

// ── 6. Welcome email → new user ───────────────────────────────────────────────
async function sendWelcomeEmail({ toEmail, fullName, role, temporaryPassword }) {
  if (!toEmail) return;
  const html = layout('Welcome to Lambert Inspection Platform', `
    <p style="color:#4b5563;margin-bottom:20px;">
      Hi ${fullName}, your account has been created on the Lambert Electromec Digital Inspection Platform.
    </p>
    ${field('Email', toEmail)}
    ${field('Role', role.charAt(0).toUpperCase() + role.slice(1))}
    ${field('Temporary Password', `<code style="background:#f1f5f9;padding:2px 8px;border-radius:4px;font-family:monospace;">${temporaryPassword}</code>`)}
    <hr style="${dividerStyle}" />
    <p style="color:#64748b;font-size:14px;margin-bottom:16px;">
      Please log in and change your password as soon as possible.
    </p>
    <a href="${APP_URL}/login" style="${btnStyle}">Log In Now</a>
  `);

  try {
    await resend.emails.send({
      from: FROM,
      to: toEmail,
      subject: 'Your Lambert Inspection Platform Account',
      html,
    });
  } catch (err) {
    console.error('Email error (welcome):', err);
  }
}

// ── 7. Password reset → user ──────────────────────────────────────────────────
async function sendPasswordReset({ toEmail, fullName, resetToken }) {
  if (!toEmail) return;
  const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`;
  const html = layout('Password Reset Request', `
    <p style="color:#4b5563;margin-bottom:20px;">
      Hi ${fullName}, we received a request to reset your password.
    </p>
    <p style="color:#4b5563;margin-bottom:20px;">
      Click the button below to set a new password. This link expires in <strong>1 hour</strong>.
    </p>
    <a href="${resetUrl}" style="${btnStyle}">Reset My Password</a>
    <hr style="${dividerStyle}" />
    <p style="color:#94a3b8;font-size:13px;">
      If you did not request a password reset, you can safely ignore this email.
    </p>
  `);

  try {
    await resend.emails.send({
      from: FROM,
      to: toEmail,
      subject: 'Reset Your Password — Lambert Inspection Platform',
      html,
    });
  } catch (err) {
    console.error('Email error (password reset):', err);
  }
}

// ── 8. Schedule created → assigned inspector ──────────────────────────────────
async function sendScheduleAssigned({ toEmail, inspectorName, scheduleTitle, frequency, startDate, endDate, location, equipmentId, formTitle, notes, createdByName }) {
  if (!toEmail) return;
  const url = `${APP_URL}/schedule`;
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : null;
  const freqLabel = frequency === 'daily' ? 'Daily' : 'One-time';
  const dateStr = frequency === 'daily'
    ? `${fmtDate(startDate)} → ${fmtDate(endDate)}`
    : fmtDate(startDate);

  const html = layout('New Inspection Schedule Assigned to You', `
    <p style="color:#4b5563;margin-bottom:20px;">
      Hi ${inspectorName}, a new inspection schedule has been assigned to you.
    </p>
    ${field('Schedule', scheduleTitle)}
    ${field('Frequency', freqLabel)}
    ${field('Date', dateStr)}
    ${formTitle ? field('Form Template', formTitle) : ''}
    ${location ? field('Location', location) : ''}
    ${equipmentId ? field('Equipment ID', equipmentId) : ''}
    ${notes ? field('Instructions', notes) : ''}
    ${field('Assigned by', createdByName)}
    <hr style="${dividerStyle}" />
    <a href="${url}" style="${btnStyle}">View My Schedule</a>
  `);

  try {
    await resend.emails.send({
      from: FROM,
      to: toEmail,
      subject: `New Inspection Schedule — ${scheduleTitle}`,
      html,
    });
  } catch (err) {
    console.error('Email error (schedule assigned):', err);
  }
}

module.exports = {
  sendInspectionSubmitted,
  sendInspectionApproved,
  sendInspectionRejected,
  sendCapaAssigned,
  sendCapaClosed,
  sendWelcomeEmail,
  sendPasswordReset,
  sendScheduleAssigned,
};
