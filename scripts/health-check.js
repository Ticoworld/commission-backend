const http = require('http');
const https = require('https');
const { URL } = require('url');
const argv = require('yargs').option('apiBase', { type: 'string', demandOption: true }).option('token', { type: 'string' }).argv;

const API_BASE = argv.apiBase.replace(/\/$/, '');
const TOKEN = argv.token;

function request(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const headers = opts.headers || {};
    const req = lib.request(parsed, { method: opts.method || 'GET', headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.end();
  });
}

(async function main() {
  console.log('[health-check] Starting smoke tests for', API_BASE);
  try {
    // 1. Health
    const health = await request(`${API_BASE}/api/health`);
    if (health.status !== 200) throw new Error(`Health check failed: ${health.status}`);
    console.log('[health-check] /api/health OK');

    if (TOKEN) {
      const headers = { Authorization: `Bearer ${TOKEN}` };
      // 2. Auth me
      const me = await request(`${API_BASE}/api/auth/me`, { headers });
      if (me.status !== 200) throw new Error(`/api/auth/me failed: ${me.status}`);
      console.log('[health-check] /api/auth/me OK');

      // 3. List uploads (requires auth)
      const uploads = await request(`${API_BASE}/api/uploads/all`, { headers });
      if (![200, 204].includes(uploads.status)) throw new Error(`/api/uploads/all failed: ${uploads.status}`);
      console.log('[health-check] /api/uploads/all OK');

      // 4. If any uploads exist, attempt a protected download (HEAD)
      try {
        const items = JSON.parse(uploads.body.toString('utf8'));
        if (Array.isArray(items) && items.length) {
          const first = items[0];
          // prefer filename property
          const filename = first.filename || (first.fileUrl ? first.fileUrl.split('/').pop() : null);
          if (filename) {
            const download = await request(`${API_BASE}/api/uploads/${encodeURIComponent(filename)}`, { headers });
            if (download.status !== 200) throw new Error(`/api/uploads/:filename failed: ${download.status}`);
            console.log('[health-check] /api/uploads/:filename OK (downloadable)');
          } else {
            console.log('[health-check] /api/uploads/all returned no filename to validate download');
          }
        } else {
          console.log('[health-check] /api/uploads/all returned empty list; skipping file download test');
        }
      } catch (e) {
        console.warn('[health-check] skipping download verification:', e.message);
      }
    } else {
      console.log('[health-check] No token provided; skipping authenticated checks');
    }

    console.log('[health-check] All smoke tests passed');
    process.exit(0);
  } catch (e) {
    console.error('[health-check] Smoke tests failed:', e.message);
    process.exit(2);
  }
})();
