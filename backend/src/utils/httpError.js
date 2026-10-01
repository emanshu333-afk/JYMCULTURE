'use strict';

/**
 * An error that carries an HTTP status code and an optional machine-readable
 * code plus per-field details (used by the validator).
 */

class HttpError extends Error {
  constructor(status, message, options = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = options.code || null;
    this.details = options.details || null;
    this.expose = options.expose !== false;
  }

  static badRequest(message, details) {
    return new HttpError(400, message, { code: 'BAD_REQUEST', details });
  }

  static validation(message, details) {
    return new HttpError(422, message, { code: 'VALIDATION_ERROR', details });
  }

  static unauthorized(message = 'Invalid or missing API key.') {
    return new HttpError(401, message, { code: 'UNAUTHORIZED' });
  }

  static notFound(message = 'Not found.') {
    return new HttpError(404, message, { code: 'NOT_FOUND' });
  }

  static serviceUnavailable(message, code) {
    return new HttpError(503, message, { code: code || 'SERVICE_UNAVAILABLE' });
  }
}

module.exports = HttpError;
