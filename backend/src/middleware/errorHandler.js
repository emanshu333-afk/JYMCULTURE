'use strict';

const config = require('../config');
const logger = require('../utils/logger');

/** 404 for anything that did not match a route. */
function notFound(req, res, next) {
  next({ status: 404, code: 'NOT_FOUND', message: `Route not found: ${req.method} ${req.originalUrl}` });
}

/** Central error handler - always answers with the same JSON envelope. */
function errorHandler(err, req, res, _next) {
  let status = err.status || err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Something went wrong.';
  let details = err.details || null;

  /* Errors thrown by express.json() before any route ran. */
  if (err.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Request body is not valid JSON.';
    details = null;
  } else if (err.type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request body is too large.';
    details = null;
  }

  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${status}`, err.stack || err.message);
  } else {
    logger.warn(`${req.method} ${req.originalUrl} -> ${status} (${code}) ${message}`);
  }

  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      /* Internal messages are only exposed outside production. */
      ...(status >= 500 && config.env === 'production' ? { message: 'Internal server error.' } : {}),
    },
  });
}

module.exports = { notFound, errorHandler };
