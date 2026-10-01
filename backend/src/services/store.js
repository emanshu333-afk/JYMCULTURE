'use strict';

/**
 * Self-contained enquiry storage.
 *
 * Every enquiry lives in one JSON file (see DATA_FILE in .env). There is no
 * database to install and nothing to migrate - the file is created on first
 * write. Writes are serialised through a queue and committed atomically
 * (write to a temp file, then rename) so two simultaneous submissions can
 * never overwrite each other or leave a half-written file behind.
 *
 * Swapping this for SQLite/Postgres later only means re-implementing the
 * functions exported at the bottom - nothing else in the app needs to change.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const config = require('../config');
const logger = require('../utils/logger');

const FILE = config.storage.file;
const DIR = path.dirname(FILE);
const TMP = `${FILE}.tmp`;

/* ------------------------------------------------------------------ *
 * Low-level file helpers
 * ------------------------------------------------------------------ */

async function ensureDir() {
  await fsp.mkdir(DIR, { recursive: true });
}

/** Read and parse the whole file. Returns [] when missing or unreadable. */
async function readAll() {
  await ensureDir();
  let raw;
  try {
    raw = await fsp.readFile(FILE, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }

  const trimmed = raw.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.enquiries)) return parsed.enquiries;
    throw new Error('Unexpected JSON shape');
  } catch (err) {
    /* Never destroy data: park the bad file next to the original and start fresh. */
    const backup = `${FILE}.corrupt-${Date.now()}`;
    try {
      await fsp.rename(FILE, backup);
      logger.error(`Data file was corrupt (${err.message}). Moved to ${backup} and started a new one.`);
    } catch (renameErr) {
      logger.error(`Data file was corrupt and could not be moved aside: ${renameErr.message}`);
    }
    return [];
  }
}

/** Write the whole array atomically. */
async function writeAll(records) {
  await ensureDir();
  const payload = JSON.stringify(records, null, 2);
  await fsp.writeFile(TMP, payload, 'utf8');
  await fsp.rename(TMP, FILE);
}

/* ------------------------------------------------------------------ *
 * Write queue - makes read-modify-write cycles safe under concurrency
 * ------------------------------------------------------------------ */

let queue = Promise.resolve();

function enqueue(task) {
  const run = queue.then(task, task);
  /* Keep the chain alive even if this task rejects. */
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function newId() {
  return `enq_${crypto.randomBytes(8).toString('hex')}`;
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

/** Insert one enquiry and return the stored record. */
async function insert(data) {
  return enqueue(async () => {
    const all = await readAll();
    const now = new Date().toISOString();

    const record = {
      id: newId(),
      createdAt: now,
      updatedAt: now,
      status: 'new',
      source: data.source || 'website-contact-form',
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      program: data.program,
      time: data.time || null,
      message: data.message || null,
      plan: data.plan || null,
      trial: Boolean(data.trial),
      zumba: Boolean(data.zumba),
      notified: false,
      notifiedAt: null,
      mailError: null,
    };

    all.push(record);
    await writeAll(all);
    logger.info(`Stored enquiry ${record.id} (${record.name} - ${record.program}).`);
    return record;
  });
}

/** Total number of stored enquiries. */
async function count() {
  const all = await readAll();
  return all.length;
}

/**
 * List enquiries with optional filtering, sorting and pagination.
 *
 * @param {object} opts
 * @param {number} [opts.page=1]
 * @param {number} [opts.limit=50]      capped at 200
 * @param {string} [opts.status]        new | contacted | converted | closed
 * @param {string} [opts.q]             free-text search
 * @param {string} [opts.sort]          newest (default) | oldest
 */
async function list(opts = {}) {
  const page = Math.max(1, parseInt(opts.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(opts.limit, 10) || 50));
  const status = (opts.status || '').trim().toLowerCase();
  const q = (opts.q || '').trim().toLowerCase();
  const sort = (opts.sort || 'newest').toLowerCase();

  let items = await readAll();

  if (status) items = items.filter((e) => (e.status || 'new') === status);

  if (q) {
    items = items.filter((e) =>
      [e.name, e.phone, e.email, e.program, e.plan, e.message]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }

  items.sort((a, b) => {
    const at = Date.parse(a.createdAt) || 0;
    const bt = Date.parse(b.createdAt) || 0;
    return sort === 'oldest' ? at - bt : bt - at;
  });

  const total = items.length;
  const start = (page - 1) * limit;

  return {
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
    items: items.slice(start, start + limit),
  };
}

/** Find one enquiry by id, or null. */
async function getById(id) {
  const all = await readAll();
  return all.find((e) => e.id === id) || null;
}

/** Patch a stored enquiry. Used for status changes and email bookkeeping. */
async function update(id, patch) {
  return enqueue(async () => {
    const all = await readAll();
    const idx = all.findIndex((e) => e.id === id);
    if (idx === -1) return null;

    all[idx] = {
      ...all[idx],
      ...patch,
      id: all[idx].id,
      createdAt: all[idx].createdAt,
      updatedAt: new Date().toISOString(),
    };

    await writeAll(all);
    return all[idx];
  });
}

/** Delete one enquiry. Returns true when something was removed. */
async function remove(id) {
  return enqueue(async () => {
    const all = await readAll();
    const next = all.filter((e) => e.id !== id);
    if (next.length === all.length) return false;
    await writeAll(next);
    return true;
  });
}

/** Counts grouped by status - powers the admin dashboard header. */
async function stats() {
  const all = await readAll();
  const byStatus = { new: 0, contacted: 0, converted: 0, closed: 0 };
  for (const e of all) {
    const s = (e.status || 'new').toLowerCase();
    if (byStatus[s] === undefined) byStatus[s] = 0;
    byStatus[s] += 1;
  }
  return {
    total: all.length,
    byStatus,
    trials: all.filter((e) => e.trial).length,
    lastAt: all.length
      ? all.map((e) => e.createdAt).sort().slice(-1)[0]
      : null,
  };
}

module.exports = {
  FILE,
  insert,
  count,
  list,
  getById,
  update,
  remove,
  stats,
};
