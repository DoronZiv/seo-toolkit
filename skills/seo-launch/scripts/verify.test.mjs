// Self-test for verify.mjs: spins up a healthy site and a broken one, asserts the verdicts.
//   node verify.test.mjs
import http from 'node:http';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

function serve(handler) {
  return new Promise((resolve) => {
    const s = http.createServer(handler);
    s.listen(0, '127.0.0.1', () => resolve({ s, url: `http://127.0.0.1:${s.address().port}` }));
  });
}

const goodPage = (u) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Acme Plumbing in Haifa</title>
<meta name="viewport" content="width=device-width">
<meta name="description" content="Emergency and scheduled plumbing in Haifa and the surrounding area, fixed prices, same-day visits.">
<link rel="canonical" href="${u}/">
<meta property="og:title" content="Acme"><meta property="og:description" content="Plumbing"><meta property="og:url" content="${u}/">
<meta property="og:image" content="${u}/og.png"><meta property="og:image:width" content="1"><meta property="og:image:height" content="1">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Acme","logo":"${u}/logo.png"}</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-TEST123456"></script>
</head><body><h1>Acme</h1></body></html>`;

const good = await serve((req, res) => {
  const u = `http://${req.headers.host}`;
  const send = (code, type, body) => { res.writeHead(code, { 'content-type': type }); res.end(body); };
  if (req.url === '/') return send(200, 'text/html', goodPage(u));
  if (req.url === '/about') return send(200, 'text/html', goodPage(u));
  if (req.url === '/og.png') return send(200, 'image/png', PNG);
  if (req.url === '/robots.txt') return send(200, 'text/plain', `User-agent: *\nAllow: /\nSitemap: ${u}/sitemap.xml\n`);
  if (req.url === '/sitemap.xml') return send(200, 'application/xml', `<urlset><url><loc>${u}/</loc></url><url><loc>${u}/about</loc></url></urlset>`);
  if (req.url === '/abc123.txt') return send(200, 'text/plain', 'abc123\n');
  return send(404, 'text/html', 'not found');
});

const bad = await serve((req, res) => {
  const u = `http://${req.headers.host}`;
  const send = (code, type, body) => { res.writeHead(code, { 'content-type': type }); res.end(body); };
  if (req.url === '/') return send(200, 'text/html', `<html><head><meta name="robots" content="noindex">
<meta property="og:image" content="/og.png"><script type="application/ld+json">{broken json</script></head><body></body></html>`);
  if (req.url === '/og.png') return send(200, 'image/png', Buffer.alloc(0));
  if (req.url === '/robots.txt') return send(200, 'text/plain', 'User-agent: *\nDisallow: /\n');
  if (req.url === '/sitemap.xml') return send(200, 'application/xml', `<urlset><url><loc>${u}/</loc></url><url><loc>${u}/gone</loc></url></urlset>`);
  if (req.url === '/abc123.txt') return send(200, 'text/plain', 'wrong-key');
  return send(200, 'text/html', 'soft 404 page');
});

const run = (url, extra = []) =>
  new Promise((resolve) =>
    execFile(process.execPath, [join(here, 'verify.mjs'), url, '--json', ...extra], (err, stdout) =>
      resolve({ code: err ? err.code : 0, out: JSON.parse(stdout) })));

const status = (out, id, page = '/') => out.results.find((r) => r.id === id && r.page === page)?.status;

let failed = 0;
const check = (name, fn) => { try { fn(); console.log(`ok   ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}\n     ${e.message.split('\n')[0]}`); } };

const g = await run(good.url, ['--indexnow-key=abc123', '--page=/about']);
check('good site: exit 0, no FAIL', () => { assert.equal(g.code, 0); assert.equal(g.out.summary.fail, 0); });
check('good site: sitemap urls, og-image, jsonld, indexnow, analytics pass', () => {
  for (const id of ['sitemap', 'sitemap-urls', 'og-image', 'jsonld', 'indexnow', 'analytics', 'noindex', 'canonical', '404']) assert.equal(status(g.out, id), 'PASS', id);
});
check('good site: extra page /about is checked', () => assert.equal(status(g.out, 'title', '/about'), 'PASS'));

const b = await run(bad.url, ['--indexnow-key=abc123']);
check('bad site: exit 1', () => assert.equal(b.code, 1));
check('bad site: catches noindex', () => assert.equal(status(b.out, 'noindex'), 'FAIL'));
check('bad site: catches 0-byte og:image', () => assert.equal(status(b.out, 'og-image'), 'FAIL'));
check('bad site: catches broken JSON-LD', () => assert.equal(status(b.out, 'jsonld'), 'FAIL'));
check('bad site: catches whole-site robots block', () => assert.equal(status(b.out, 'robots'), 'FAIL'));
check('bad site: catches wrong IndexNow key file', () => assert.equal(status(b.out, 'indexnow'), 'FAIL'));
check('bad site: flags soft 404', () => assert.equal(status(b.out, '404'), 'WARN'));
check('bad site: missing title is FAIL', () => assert.equal(status(b.out, 'title'), 'FAIL'));

// apex that redirects every request to the good site (like example.com -> www.example.com)
const apex = await serve((req, res) => { res.writeHead(308, { location: `${good.url}${req.url}` }); res.end(); });
const a = await run(apex.url);
check('apex redirect: canonical and sitemap host judged against the final host', () => {
  assert.equal(status(a.out, 'canonical'), 'PASS');
  assert.equal(status(a.out, 'sitemap'), 'PASS');
  assert.notEqual(status(a.out, 'sitemap-host'), 'WARN');
});

good.s.close();
bad.s.close();
apex.s.close();
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
