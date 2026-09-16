import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, 'dist');
const PORT = 5173;
const BACKEND_URL = 'http://localhost:4000';

const app = express();

// 1. Proxy API, Health, and SSE streams to Backend on Port 4000
const proxyToBackend = (req, res) => {
  const targetUrl = new URL(req.originalUrl || req.url, BACKEND_URL);
  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port,
    path: targetUrl.pathname + targetUrl.search,
    method: req.method,
    headers: {
      ...req.headers,   
      host: `localhost:${targetUrl.port}`,
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      res.status(502).json({ error: 'Backend proxy error', details: err.message });
    }
  });

  req.pipe(proxyReq, { end: true });
};

// Route API and health endpoints to proxy
app.use('/api', proxyToBackend);
app.use('/health', proxyToBackend);

// 2. Serve static files from dist/
app.use(express.static(DIST));

// 3. Fallback to index.html for Single Page Application routing
app.use((req, res) => {
  const indexPath = path.join(DIST, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Dist not found. Please run build first.');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ORCA Maritime Frontend (Express) active on http://localhost:${PORT}`);
});
