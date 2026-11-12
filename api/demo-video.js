const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');

// Set DEMO_VIDEO_URL in Vercel, never in this public repository.
module.exports = async function handler(req, res) {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }
  const url = process.env.DEMO_VIDEO_URL;
  if (!url) return res.status(503).end('Video is not configured.');
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.public.blob.vercel-storage.com')) {
      return res.status(503).end('Invalid video configuration.');
    }
    const headers = {};
    if (req.headers.range) headers.Range = req.headers.range;
    const upstream = await fetch(url, { method: req.method, headers, redirect: 'error' });
    if (![200, 206, 416].includes(upstream.status)) return res.status(502).end('Video temporarily unavailable.');
    res.statusCode = upstream.status;
    for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }
    res.setHeader('Cache-Control', 'public, max-age=3600');
    if (req.method === 'HEAD' || !upstream.body) return res.end();
    await pipeline(Readable.fromWeb(upstream.body), res);
  } catch {
    if (!res.headersSent) return res.status(502).end('Video temporarily unavailable.');
    res.destroy();
  }
};
