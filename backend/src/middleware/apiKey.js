'use strict';

/**
 * Protects the admin routes with a shared secret.
 *
 * The key is read from ADMIN_API_KEY in .env and may be supplied as:
 *   - header  x-api-key: <key>
 *   - header  Authorization: Bearer <key>
 *
 * If no key is configured the route refuses to serve rather than silently
 * allowing everyone in.
 */

const crypto = require('crypto');

const config = require('../config');
const HttpError = require('../utils/httpError');

/** Constant-time comparison so the key cannot be guessed byte by byte. */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function extractKey(req) {
  const header = req.get('x-api-key');
  if (header) return header.trim();

  const auth = req.get('authorization') || '';
  if (/^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, '').trim();

  return '';
}

module.exports = function apiKey(req, res, next) {
  if (!config.admin.apiKey) {
    return next(
      HttpError.serviceUnavailable(
        'Admin API is not available: ADMIN_API_KEY is not set in .env.',
        'ADMIN_KEY_NOT_CONFIGURED'
      )
    );
  }

  const supplied = extractKey(req);
  if (!supplied || !safeEqual(supplied, config.admin.apiKey)) {
    return next(HttpError.unauthorized('Invalid or missing API key. Send it as the x-api-key header.'));
  }

  return next();
};
