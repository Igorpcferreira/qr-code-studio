/**
 * Servidor estatico minimo para servir `out/` — o mesmo artefato que vai para a Vercel.
 *
 * Existe em vez de uma dependencia (`serve`, `http-server`) por dois motivos: aquele
 * pacote arrastava vulnerabilidades transitivas para um projeto que so precisa devolver
 * arquivos de uma pasta, e o E2E precisa exercitar exatamente o export estatico —
 * nao o servidor de desenvolvimento.
 */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join, normalize, extname, resolve } from 'node:path';

const ROOT = resolve(process.argv[2] ?? 'out');
const PORT = Number(process.env.PORT ?? 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.wasm': 'application/wasm',
};

/** Resolve uma URL para um arquivo, cobrindo `trailingSlash: true` e o 404 do export. */
async function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0] ?? '/');
  const safe = normalize(clean).replace(/^(\.\.[/\\])+/, '');
  const base = join(ROOT, safe);

  for (const candidate of [base, join(base, 'index.html'), `${base}.html`]) {
    if (!candidate.startsWith(ROOT)) continue;
    try {
      const info = await stat(candidate);
      if (info.isFile()) return candidate;
    } catch {
      // tenta o proximo candidato
    }
  }
  return null;
}

const server = createServer(async (req, res) => {
  const file = await resolveFile(req.url ?? '/');

  if (!file) {
    const notFound = await resolveFile('/404');
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    if (notFound) return createReadStream(notFound).pipe(res);
    return res.end('404');
  }

  res.writeHead(200, {
    'content-type': MIME[extname(file)] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log(`QR Code Studio (export estatico) em http://localhost:${PORT}`);
});
