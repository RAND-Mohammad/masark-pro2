const http = require('node:http');

// Development-only, same-origin bridge. Never proxy arbitrary URLs or the email hook.
function createCvDevProxy({ port = 3001, socketPath = process.env.CV_DEV_SOCKET } = {}) {
  return (req, res, next) => {
    const pathname = req.url.split('?')[0];
    if (pathname !== '/api/cv' && !pathname.startsWith('/api/cv/')) return next();
    const routes = { '/api/cv/health': '/health', '/api/cv/analyze-cv': '/analyze-cv', '/api/cv/interview/questions': '/interview/questions', '/api/cv/interview/evaluate': '/interview/evaluate', '/api/cv/jobs': '/jobs' };
    if (!Object.hasOwn(routes, pathname)) {
      res.writeHead(404, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify({ error: 'المسار غير متاح.' }));
    }
    const headers = { ...req.headers, host: socketPath ? 'cv-internal' : `127.0.0.1:${port}`, connection: 'close' };
    const upstream = http.request({
      ...(socketPath ? { socketPath } : { hostname: '127.0.0.1', port }),
      path: routes[pathname] + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''), method: req.method, headers,
    }, response => {
      res.writeHead(response.statusCode, response.headers);
      response.pipe(res);
    });
    upstream.setTimeout(150000, () => upstream.destroy());
    upstream.on('error', () => {
      if (res.destroyed) return;
      if (res.headersSent) return res.destroy();
      res.writeHead(502, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error: 'خدمة تحليل السيرة غير متاحة الآن.' }));
    });
    req.on('aborted', () => upstream.destroy());
    res.on('close', () => upstream.destroy());
    // No body parsing, logging or buffering here; the backend authenticates first.
    req.pipe(upstream);
  };
}
module.exports = { createCvDevProxy };
