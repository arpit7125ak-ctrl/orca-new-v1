// stub-ai-service.js
// ---------------------------------------------------------------------------
// A MINIMAL stand-in for the real AI Service, used only for local testing.
//
// WHY THIS EXISTS: without something listening on port 8000, every
// POST /api/v1/analysis immediately fails dispatch (ECONNREFUSED) and the
// analysis lands in `status: failed` before you ever get a chance to send
// progress/result callbacks. That makes it impossible to exercise the
// /internal/v1/progress and /internal/v1/result endpoints realistically.
//
// This stub does the ONE thing the real AI Service must do on receiving
// POST /v1/analysis/execute: accept immediately with 202. It does not
// validate the payload, does not call back with progress, and does not
// produce a result - you still drive those steps yourself via Postman or
// PowerShell, exactly as documented in the Postman guide's Part 8.
//
// Run with:
//   node stub-ai-service.js
//
// This is NOT part of the real backend and should never be deployed. Delete
// it once the real AI Service exists.
// ---------------------------------------------------------------------------

const http = require('http');

const PORT = 8000;

http.createServer((req, res) => {
  console.log(`[stub-ai] ${req.method} ${req.url}`);

  // Drain the request body (even though we ignore its contents) so the
  // connection closes cleanly.
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    if (req.method === 'POST' && req.url === '/v1/analysis/execute') {
      // The one contract-relevant behaviour: 202 Accepted, immediately.
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ accepted: true }));
      return;
    }

    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'stub-ai-service' }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found in stub' }));
  });
}).listen(PORT, () => {
  console.log(`[stub-ai] Fake AI Service listening on http://localhost:${PORT}`);
  console.log('[stub-ai] This is a TEST STUB, not the real AI Service. Delete before production.');
});
