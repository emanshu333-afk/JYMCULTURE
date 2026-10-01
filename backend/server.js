'use strict';

/**
 * ==================================================================
 *  JYM CULTURE GYM & SPA - enquiry / booking backend
 * ==================================================================
 *  Express API that receives the website's contact + trial-booking form,
 *  validates it, stores it in a JSON file and emails a notification to the
 *  gym's inbox.
 *
 *  Run it with:   npm start
 * ==================================================================
 */

const fs = require('fs');
const path = require('path');

const express = require('express');
const cors = require('cors');

const config = require('./src/config');
const logger = require('./src/utils/logger');
const store = require('./src/services/store');
const mailer = require('./src/services/mailer');
const enquiryRoutes = require('./src/routes/enquiryRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const { notFound, errorHandler } = require('./src/middleware/errorHandler');

const app = express();

/* Behind a reverse proxy (Render, Railway, nginx) this makes req.ip correct. */
app.set('trust proxy', 1);
app.disable('x-powered-by');

/* ------------------------------------------------------------------ *
 * CORS - the website is served from a different origin than the API
 * ------------------------------------------------------------------ */
const allowAnyOrigin = config.corsOrigins.includes('*');

app.use(
  cors({
    origin(origin, callback) {
      /* No origin = curl, Postman, a server-to-server call: always allow. */
      if (!origin || allowAnyOrigin) return callback(null, true);
      if (config.corsOrigins.includes(origin)) return callback(null, true);
      /* Refuse politely: the browser blocks it, the server does not 500. */
      logger.warn(`Blocked CORS request from origin ${origin}`);
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization'],
    maxAge: 86400,
  })
);

/* ------------------------------------------------------------------ *
 * Body parsing + request logging
 * ------------------------------------------------------------------ */
app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: false, limit: '32kb' }));

app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    logger.debug(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - started}ms)`);
  });
  next();
});

/* ------------------------------------------------------------------ *
 * Routes
 * ------------------------------------------------------------------ */

/** Health check - handy for uptime monitors and for verifying a deploy. */
app.get('/api/health', async (req, res) => {
  let total = null;
  try {
    total = await store.count();
  } catch (err) {
    logger.error(`Health check could not read the store: ${err.message}`);
  }

  res.json({
    success: true,
    status: 'ok',
    service: 'jym-culture-gym-backend',
    version: require('./package.json').version,
    env: config.env,
    uptimeSeconds: Math.round(process.uptime()),
    time: new Date().toISOString(),
    storage: {
      file: path.relative(config.root, store.FILE),
      total,
    },
    email: {
      enabled: config.email.enabled,
      configured: config.email.configured,
      to: config.email.to,
    },
  });
});

/** The endpoint the website form posts to. */
app.use('/api/enquiries', enquiryRoutes);

/** Admin listing / management, protected by ADMIN_API_KEY. */
app.use('/api/admin', adminRoutes);

/** Friendly root so hitting the server in a browser is not a 404. */
app.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'JYM CULTURE GYM & SPA - Enquiry API',
    docs: 'See README.md',
    endpoints: {
      health: 'GET /api/health',
      createEnquiry: 'POST /api/enquiries',
      listEnquiries: 'GET /api/admin/enquiries  (x-api-key required)',
      stats: 'GET /api/admin/stats  (x-api-key required)',
    },
  });
});

/* ------------------------------------------------------------------ *
 * Optional: serve the static website from this same server.
 * Set STATIC_DIR in .env (e.g. ../webpages/jym-culture-gym_v6).
 * ------------------------------------------------------------------ */
if (config.staticDir && fs.existsSync(config.staticDir)) {
  app.use(express.static(config.staticDir));
  logger.info(`Also serving the website from ${config.staticDir}`);
} else if (config.staticDir) {
  logger.warn(`STATIC_DIR is set to ${config.staticDir} but that folder does not exist - skipping.`);
}

/* ------------------------------------------------------------------ *
 * Fallbacks - must come last
 * ------------------------------------------------------------------ */
app.use(notFound);
app.use(errorHandler);

/* ------------------------------------------------------------------ *
 * Start
 * ------------------------------------------------------------------ */
const server = app.listen(config.port, () => {
  logger.info('==================================================');
  logger.info('  JYM CULTURE GYM & SPA - enquiry API is running');
  logger.info('==================================================');
  logger.info(`  Local:      http://localhost:${config.port}`);
  logger.info(`  Health:     http://localhost:${config.port}/api/health`);
  logger.info(`  Enquiries:  POST http://localhost:${config.port}/api/enquiries`);
  logger.info(`  Admin list: GET  http://localhost:${config.port}/api/admin/enquiries`);
  logger.info(`  Data file:  ${store.FILE}`);
  logger.info(`  CORS:       ${allowAnyOrigin ? 'any origin' : config.corsOrigins.join(', ')}`);
  logger.info(`  Admin key:  ${config.admin.apiKey ? 'configured' : 'NOT SET (admin routes disabled)'}`);
  logger.info('--------------------------------------------------');

  /* Check email configuration in the background so boot is never delayed. */
  mailer.verify().catch((err) => logger.error(`Email configuration check failed: ${err.message}`));
});

/* ------------------------------------------------------------------ *
 * Graceful shutdown - let in-flight requests finish before exiting
 * ------------------------------------------------------------------ */
function shutdown(signal) {
  logger.info(`${signal} received - shutting down gracefully...`);
  server.close(() => {
    logger.info('Server closed. Bye.');
    process.exit(0);
  });
  /* Do not hang forever on a stuck connection. */
  setTimeout(() => process.exit(1), 10000).unref();
}

['SIGINT', 'SIGTERM'].forEach((sig) => process.on(sig, () => shutdown(sig)));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection:', reason);
});

module.exports = app;
