'use strict';

/**
 * Central configuration.
 * Every other file reads settings from here - nothing else touches process.env.
 */

const path = require('path');
require('dotenv').config();

/** Read a boolean env var ('true', '1', 'yes', 'on') with a default. */
function bool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

/** Read an integer env var with a default. */
function int(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

const ROOT = path.resolve(__dirname, '..', '..');

const config = {
  root: ROOT,

  env: process.env.NODE_ENV || 'development',
  port: int(process.env.PORT, 5000),

  /* Origins allowed to call the API. ['*'] means: allow any. */
  corsOrigins: (process.env.CORS_ORIGIN || '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  /* Optional: also serve the static website from this same server. */
  staticDir: process.env.STATIC_DIR
    ? path.resolve(ROOT, process.env.STATIC_DIR)
    : '',

  admin: {
    apiKey: process.env.ADMIN_API_KEY || '',
  },

  storage: {
    file: path.resolve(ROOT, process.env.DATA_FILE || './data/enquiries.json'),
  },

  email: {
    enabled: bool(process.env.EMAIL_ENABLED, false),
    apiKey: process.env.RESEND_API_KEY || '',
    from: process.env.MAIL_FROM || 'onboarding@resend.dev',
    to: process.env.MAIL_TO || 'emanshu001@gmail.com',
  },

  /* Enquiry statuses the admin API accepts. */
  statuses: ['new', 'contacted', 'converted', 'closed'],
};

/* True only when there is enough Resend configuration to attempt a send. */
config.email.configured = Boolean(
  config.email.enabled &&
    config.email.apiKey &&
    config.email.to &&
    config.email.from
);

module.exports = config;
