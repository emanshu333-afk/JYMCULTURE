'use strict';

/**
 * End-to-end smoke test.
 *
 * Start the server in one terminal (npm start), then in another run:
 *
 *     npm run smoke
 *
 * It submits a sample enquiry through the real endpoint, then reads it back
 * through the admin API. Requires Node 18+ (uses the built-in fetch).
 *
 * Override the target with:  BASE_URL=http://localhost:4000 npm run smoke
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = (process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, '');

/* Read ADMIN_API_KEY from .env so the admin step works without extra setup. */
function readAdminKey() {
  if (process.env.ADMIN_API_KEY) return process.env.ADMIN_API_KEY;
  try {
    const env = fs.readFileSync(path.resolve(__dirname, '..', '.env'), 'utf8');
    const line = env.split(/\r?\n/).find((l) => l.trim().startsWith('ADMIN_API_KEY='));
    return line ? line.split('=').slice(1).join('=').trim() : '';
  } catch (_) {
    return '';
  }
}

const ADMIN_KEY = readAdminKey();

let passed = 0;
let failed = 0;

function check(label, ok, extra = '') {
  if (ok) {
    passed += 1;
    console.log(`  \u2713 ${label}${extra ? ` ${extra}` : ''}`);
  } else {
    failed += 1;
    console.log(`  \u2717 ${label}${extra ? ` ${extra}` : ''}`);
  }
}

async function main() {
  console.log(`\nSmoke test against ${BASE_URL}\n`);

  /* 1 - health ------------------------------------------------------ */
  const health = await fetch(`${BASE_URL}/api/health`);
  const healthBody = await health.json();
  check('GET /api/health returns 200', health.status === 200);
  check('health reports ok', healthBody.status === 'ok', `(email configured: ${healthBody.email?.configured})`);

  /* 2 - valid submission -------------------------------------------- */
  const valid = await fetch(`${BASE_URL}/api/enquiries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Smoke Test',
      phone: '9996224486',
      email: 'smoke@example.com',
      program: 'Free 1-Day Trial',
      time: 'Zumba class (6:00 PM)',
      plan: '12m',
      message: 'Created by scripts/smoke-test.js',
    }),
  });
  const validBody = await valid.json();
  check('POST /api/enquiries returns 201', valid.status === 201, `(got ${valid.status})`);
  check('response carries an id', Boolean(validBody.data && validBody.data.id), validBody.data?.id || '');
  check('plan echoed back', validBody.data?.plan === '12m');

  const createdId = validBody.data && validBody.data.id;

  /* 3 - validation rejects a bad payload ---------------------------- */
  const invalid = await fetch(`${BASE_URL}/api/enquiries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'A', phone: '123', email: 'not-an-email' }),
  });
  const invalidBody = await invalid.json();
  check('invalid payload returns 422', invalid.status === 422, `(got ${invalid.status})`);
  check('error lists field details', Array.isArray(invalidBody.error?.details) && invalidBody.error.details.length >= 3);

  /* 4 - admin protection -------------------------------------------- */
  const noKey = await fetch(`${BASE_URL}/api/admin/enquiries`);
  check('admin without a key returns 401', noKey.status === 401, `(got ${noKey.status})`);

  const wrongKey = await fetch(`${BASE_URL}/api/admin/enquiries`, { headers: { 'x-api-key': 'definitely-wrong' } });
  check('admin with a wrong key returns 401', wrongKey.status === 401, `(got ${wrongKey.status})`);

  if (ADMIN_KEY) {
    const list = await fetch(`${BASE_URL}/api/admin/enquiries?limit=5`, { headers: { 'x-api-key': ADMIN_KEY } });
    const listBody = await list.json();
    check('admin with the right key returns 200', list.status === 200, `(got ${list.status})`);
    check('list contains the enquiry we created', listBody.items?.some((e) => e.id === createdId));

    const stats = await fetch(`${BASE_URL}/api/admin/stats`, { headers: { 'x-api-key': ADMIN_KEY } });
    check('GET /api/admin/stats returns 200', stats.status === 200);

    if (createdId) {
      const patched = await fetch(`${BASE_URL}/api/admin/enquiries/${createdId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ADMIN_KEY },
        body: JSON.stringify({ status: 'contacted' }),
      });
      const patchedBody = await patched.json();
      check('PATCH status returns 200 and applies', patched.status === 200 && patchedBody.data?.status === 'contacted');

      const removed = await fetch(`${BASE_URL}/api/admin/enquiries/${createdId}`, {
        method: 'DELETE',
        headers: { 'x-api-key': ADMIN_KEY },
      });
      check('DELETE returns 200 and cleans up', removed.status === 200);
    }
  } else {
    console.log('  ! ADMIN_API_KEY not found in .env - skipping the admin checks');
  }

  /* 5 - 404 --------------------------------------------------------- */
  const missing = await fetch(`${BASE_URL}/api/nope`);
  check('unknown route returns 404', missing.status === 404);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\nSmoke test could not run:', err.message);
  console.error('Is the server running?  npm start\n');
  process.exit(1);
});
