'use strict';

/**
 * Tiny timestamped logger - keeps the console output readable without
 * pulling in a logging dependency.
 */

const config = require('../config');

function write(stream, level, args) {
  const line = `[${new Date().toISOString()}] ${level.toUpperCase().padEnd(5)}`;
  stream(line, ...args);
}

module.exports = {
  info: (...args) => write(console.log, 'info', args),
  warn: (...args) => write(console.warn, 'warn', args),
  error: (...args) => write(console.error, 'error', args),
  /* Debug lines are suppressed in production. */
  debug: (...args) => {
    if (config.env !== 'production') write(console.log, 'debug', args);
  },
};
