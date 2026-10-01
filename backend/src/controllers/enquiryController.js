'use strict';

/**
 * Enquiry controllers.
 * The validator has already cleaned req.body by the time these run.
 */

const config = require('../config');
const store = require('../services/store');
const mailer = require('../services/mailer');
const logger = require('../utils/logger');
const HttpError = require('../utils/httpError');

/**
 * POST /api/enquiries  (public)
 * 1. validate (middleware)  2. store  3. email notification  4. respond 201
 */
async function createEnquiry(req, res) {
  const data = req.body;

  const record = await store.insert(data);

  /* The email is best-effort: a failure never fails the request. */
  const mail = await mailer.sendEnquiryNotification(record);

  /* Remember the outcome on the record so nothing is silently lost. */
  await store.update(record.id, {
    notified: mail.sent,
    notifiedAt: mail.sent ? new Date().toISOString() : null,
    mailError: mail.sent ? null : mail.reason || null,
  });

  logger.info(`New enquiry accepted: ${record.id}${record.trial ? ' [FREE TRIAL]' : ''}`);

  res.status(201).json({
    success: true,
    message: record.trial
      ? "Thanks! Your free 1-day trial request is in. Our team will call you shortly to confirm your slot."
      : 'Thanks! Your enquiry is in. Our team will call you back shortly.',
    data: {
      id: record.id,
      createdAt: record.createdAt,
      status: record.status,
      name: record.name,
      program: record.program,
      plan: record.plan,
      trial: record.trial,
      notificationSent: mail.sent,
    },
  });
}

/** GET /api/enquiries  (admin) - paginated, filterable list. */
async function listEnquiries(req, res) {
  const { page, limit, status, q, sort } = req.query;
  const result = await store.list({ page, limit, status, q, sort });
  res.json({ success: true, ...result });
}

/** GET /api/admin/enquiries/:id  (admin) */
async function getEnquiry(req, res) {
  const record = await store.getById(req.params.id);
  if (!record) throw HttpError.notFound(`No enquiry with id ${req.params.id}`);
  res.json({ success: true, data: record });
}

/** PATCH /api/admin/enquiries/:id  (admin) - update the status. */
async function updateEnquiry(req, res) {
  const { status } = req.body || {};

  if (!status || !config.statuses.includes(String(status).toLowerCase())) {
    throw HttpError.validation('Invalid status.', [
      { field: 'status', message: `Status must be one of: ${config.statuses.join(', ')}.` },
    ]);
  }

  const updated = await store.update(req.params.id, {
    status: String(status).toLowerCase(),
  });

  if (!updated) throw HttpError.notFound(`No enquiry with id ${req.params.id}`);
  res.json({ success: true, data: updated });
}

/** DELETE /api/admin/enquiries/:id  (admin) */
async function deleteEnquiry(req, res) {
  const removed = await store.remove(req.params.id);
  if (!removed) throw HttpError.notFound(`No enquiry with id ${req.params.id}`);
  res.json({ success: true, message: `Enquiry ${req.params.id} deleted.` });
}

/** GET /api/admin/stats  (admin) - quick dashboard numbers. */
async function getStats(req, res) {
  const stats = await store.stats();
  res.json({ success: true, data: stats });
}

/** GET /api/admin/enquiries/export.csv  (admin) - spreadsheet export. */
async function exportCsv(req, res) {
  const { items } = await store.list({ limit: 200, sort: 'newest' });

  const columns = [
    'id',
    'createdAt',
    'status',
    'name',
    'phone',
    'email',
    'program',
    'plan',
    'trial',
    'zumba',
    'time',
    'message',
    'notified',
  ];

  const cell = (value) => {
    if (value === null || value === undefined) return '';
    const s = String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows = [
    columns.join(','),
    ...items.map((e) => columns.map((c) => cell(e[c])).join(',')),
  ];

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="jym-culture-enquiries.csv"');
  res.send(rows.join('\n'));
}

module.exports = {
  createEnquiry,
  listEnquiries,
  getEnquiry,
  updateEnquiry,
  deleteEnquiry,
  getStats,
  exportCsv,
};
