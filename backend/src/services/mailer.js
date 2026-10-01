'use strict';

/**
 * Email notification for new enquiries (Nodemailer over SMTP).
 *
 * Deliberately fault-tolerant: if SMTP is not configured - or the send fails -
 * the enquiry is still stored and the API still returns success. The failure
 * is recorded on the record (mailError) so it can be retried or noticed later,
 * and logged to the console.
 */

const nodemailer = require('nodemailer');

const config = require('../config');
const logger = require('../utils/logger');

let transporter = null;

/** Build (once) and return the SMTP transport, or null when unconfigured. */
function getTransporter() {
  if (transporter) return transporter;
  if (!config.email.configured) return null;

  transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: { user: config.email.user, pass: config.email.pass },
    connectionTimeout: config.email.timeoutMs,
    greetingTimeout: config.email.timeoutMs,
    socketTimeout: config.email.timeoutMs,
  });

  return transporter;
}

/** Check the SMTP credentials at boot so misconfiguration shows up early. */
async function verify() {
  const t = getTransporter();
  if (!t) {
    logger.warn('Email notifications are OFF (SMTP not configured). Enquiries are still stored.');
    return false;
  }
  try {
    await t.verify();
    logger.info(`SMTP ready - notifications will be sent to ${config.email.to}`);
    return true;
  } catch (err) {
    logger.error(`SMTP verification failed: ${err.message}`);
    logger.error('Enquiries will still be stored, but email notifications will fail until .env is fixed.');
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stamp(iso) {
  try {
    return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  } catch (_) {
    return iso;
  }
}

function buildSubject(e) {
  const tag = e.trial ? 'FREE TRIAL' : e.plan ? 'PLAN' : 'ENQUIRY';
  return `[JYM Culture] ${tag} - ${e.name} (${e.program})`;
}

function buildText(e) {
  const lines = [
    'New enquiry from the JYM Culture website',
    '=========================================',
    `Name      : ${e.name}`,
    `Phone     : ${e.phone}`,
    `Email     : ${e.email || '-'}`,
    `Interest  : ${e.program}`,
    `Plan      : ${e.plan || '-'}`,
    `Trial     : ${e.trial ? 'Yes - FREE 1-Day Trial' : 'No'}`,
    `Zumba     : ${e.zumba ? 'Yes - 6:00 PM class' : 'No'}`,
    `Time slot : ${e.time || 'Any'}`,
    `Message   : ${e.message || '-'}`,
    '-----------------------------------------',
    `Received  : ${stamp(e.createdAt)} (IST)`,
    `Record ID : ${e.id}`,
  ];
  return lines.join('\n');
}

function buildHtml(e) {
  const row = (label, value) =>
    `<tr>` +
    `<td style="padding:10px 16px;border-bottom:1px solid #ece9f6;color:#6b6480;font-size:13px;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;vertical-align:top">${esc(label)}</td>` +
    `<td style="padding:10px 16px;border-bottom:1px solid #ece9f6;color:#171522;font-size:15px;font-weight:600">${esc(value)}</td>` +
    `</tr>`;

  const badge = e.trial
    ? `<div style="display:inline-block;background:#8b5cf6;color:#fff;padding:6px 14px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">🎁 Free 1-Day Trial</div>`
    : `<div style="display:inline-block;background:#171522;color:#c4a6ff;padding:6px 14px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Website Enquiry</div>`;

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f2fb;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(23,21,34,.10)">
    <tr>
      <td style="background:#0d0b14;padding:26px 24px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:.04em">JYM CULTURE</div>
        <div style="font-size:11px;color:#c4a6ff;letter-spacing:.28em;text-transform:uppercase;margin-top:4px">Gym &amp; Spa · Ambala</div>
      </td>
    </tr>
    <tr>
      <td style="padding:26px 24px 8px">
        <div style="font-size:19px;font-weight:700;color:#171522;margin-bottom:10px">New enquiry from the website</div>
        ${badge}
      </td>
    </tr>
    <tr>
      <td style="padding:12px 8px 4px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${row('Name', e.name)}
          ${row('Phone', e.phone)}
          ${row('Email', e.email || '-')}
          ${row('Interested in', e.program)}
          ${row('Plan', e.plan || '-')}
          ${row('Free trial', e.trial ? 'Yes' : 'No')}
          ${row('Zumba class', e.zumba ? 'Yes - 6:00 PM' : 'No')}
          ${row('Preferred time', e.time || 'Any')}
          ${row('Message', e.message || '-')}
          ${row('Received', `${stamp(e.createdAt)} (IST)`)}
          ${row('Record ID', e.id)}
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:22px 24px 28px">
        <a href="tel:${esc(e.phone)}" style="display:inline-block;background:#8b5cf6;color:#ffffff;text-decoration:none;padding:13px 26px;border-radius:999px;font-weight:700;font-size:14px;letter-spacing:.04em">📞 Call ${esc(e.name)}</a>
        <p style="color:#6b6480;font-size:12px;margin:16px 0 0">Sent automatically by the JYM Culture website backend.</p>
      </td>
    </tr>
  </table>
</body></html>`;
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

/**
 * Send the notification email for one stored enquiry.
 *
 * @returns {Promise<{sent:boolean, reason?:string, messageId?:string}>}
 *          Never throws - the caller always continues.
 */
async function sendEnquiryNotification(enquiry) {
  const t = getTransporter();

  if (!t) {
    logger.warn(`Enquiry ${enquiry.id} stored, but email notification is disabled (SMTP not configured).`);
    return { sent: false, reason: 'smtp-not-configured' };
  }

  try {
    const info = await t.sendMail({
      from: config.email.from,
      to: config.email.to,
      replyTo: enquiry.email || undefined,
      subject: buildSubject(enquiry),
      text: buildText(enquiry),
      html: buildHtml(enquiry),
    });

    logger.info(`Notification for ${enquiry.id} sent to ${config.email.to} (${info.messageId}).`);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    logger.error(`Could not send notification for ${enquiry.id}: ${err.message}`);
    return { sent: false, reason: err.message };
  }
}

module.exports = {
  verify,
  sendEnquiryNotification,
};
