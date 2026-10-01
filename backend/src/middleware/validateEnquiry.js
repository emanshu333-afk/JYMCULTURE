'use strict';

/**
 * Validates and normalises the body of POST /api/enquiries.
 *
 * On success it replaces req.body with a clean object (only known fields,
 * trimmed, correct types) and calls next(). On failure it forwards a 422
 * HttpError carrying a per-field `details` array so the front-end can show
 * inline messages.
 */

const HttpError = require('../utils/httpError');

const PLAN_IDS = ['1m', '3m', '6m', '8m', '12m'];

const LIMITS = {
  name: 80,
  phone: 20,
  email: 120,
  program: 80,
  time: 80,
  plan: 20,
  message: 2000,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** '' / null / undefined -> undefined; everything else -> trimmed string. */
function str(value) {
  if (value === undefined || value === null) return undefined;
  const s = String(value).trim();
  return s === '' ? undefined : s;
}

/** Loose boolean: accepts true, 'true', 'yes', '1', 'on'. */
function bool(value) {
  if (value === true) return true;
  if (value === undefined || value === null || value === false) return false;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function validateEnquiry(req, res, next) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const details = [];

  /* ---------- name ---------- */
  const name = str(body.name);
  if (!name) {
    details.push({ field: 'name', message: 'Name is required.' });
  } else if (name.length < 2) {
    details.push({ field: 'name', message: 'Name must be at least 2 characters.' });
  } else if (name.length > LIMITS.name) {
    details.push({ field: 'name', message: `Name must be under ${LIMITS.name} characters.` });
  }

  /* ---------- phone ---------- */
  const rawPhone = str(body.phone);
  let phone;
  if (!rawPhone) {
    details.push({ field: 'phone', message: 'Phone number is required.' });
  } else {
    const digits = rawPhone.replace(/\D/g, '');
    /* Accept a 10-digit Indian mobile with optional +91 / 0 prefix, and
       any international number between 10 and 15 digits. */
    const normalized = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
    if (digits.length < 10 || digits.length > 15) {
      details.push({ field: 'phone', message: 'Enter a valid phone number (at least 10 digits).' });
    } else {
      phone = normalized;
    }
  }

  /* ---------- email (optional) ---------- */
  let email;
  const rawEmail = str(body.email);
  if (rawEmail) {
    if (!EMAIL_RE.test(rawEmail)) {
      details.push({ field: 'email', message: 'Enter a valid email address.' });
    } else if (rawEmail.length > LIMITS.email) {
      details.push({ field: 'email', message: `Email must be under ${LIMITS.email} characters.` });
    } else {
      email = rawEmail.toLowerCase();
    }
  }

  /* ---------- program / interest (required) ---------- */
  const program = str(body.program);
  if (!program) {
    details.push({ field: 'program', message: 'Please choose what you are interested in.' });
  } else if (program.length > LIMITS.program) {
    details.push({ field: 'program', message: `Must be under ${LIMITS.program} characters.` });
  }

  /* ---------- optional fields ---------- */
  const time = str(body.time);
  if (time && time.length > LIMITS.time) {
    details.push({ field: 'time', message: `Must be under ${LIMITS.time} characters.` });
  }

  const plan = str(body.plan);
  if (plan && !PLAN_IDS.includes(plan.toLowerCase())) {
    details.push({
      field: 'plan',
      message: `Plan must be one of: ${PLAN_IDS.join(', ')}.`,
    });
  }

  const message = str(body.message);
  if (message && message.length > LIMITS.message) {
    details.push({
      field: 'message',
      message: `Message must be under ${LIMITS.message} characters.`,
    });
  }

  /* Honeypot: bots fill every field they find. Silently treated as spam. */
  if (str(body.company) || str(body.website)) {
    return next(HttpError.badRequest('Submission rejected.', [{ field: 'form', message: 'Spam detected.' }]));
  }

  if (details.length) {
    return next(
      HttpError.validation(
        details.length === 1 ? details[0].message : 'Please correct the highlighted fields.',
        details
      )
    );
  }

  /* Hand the controller a clean, whitelisted payload. */
  req.body = {
    name,
    phone,
    email,
    program,
    time,
    plan: plan ? plan.toLowerCase() : undefined,
    message,
    trial: bool(body.trial) || program.toLowerCase().includes('free'),
    zumba: bool(body.zumba) || time === 'Zumba class (6:00 PM)',
    source: str(body.source) || 'website-contact-form',
  };

  return next();
}

module.exports = validateEnquiry;
module.exports.PLAN_IDS = PLAN_IDS;
