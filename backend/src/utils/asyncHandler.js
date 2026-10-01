'use strict';

/**
 * Wraps an async route handler so a rejected promise is forwarded to the
 * Express error handler instead of hanging the request.
 */

module.exports = function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
