/**
 * Service worker do QR Code Studio.
 *
 * Escrito à mão, sem `next-pwa`: o problema é servir arquivos estáticos do
 * cache, e a biblioteca traria configuração e superfície de manutenção
 * desproporcionais a isso.
 *
 * Depois da primeira visita o gerador funciona sem rede. Isso não é otimização
 * de carregamento — é a tese do produto virando comportamento verificável: se
 * "não depende deste site" é verdade para o arquivo exportado, precisa ser
 * verdade também para a ferramenta que o gerou.
 *
 * O cache leva a versão no nome; a versão só muda quando este arquivo muda.
 */
const VERSAO = 'qrcs-v2';

/**
 * `cache-first` com revalidação em segundo plano.
 *
 * O export é estático e os nomes de arquivo do Next carregam hash, então
 * responder do cache nunca serve conteúdo errado: um deploy novo gera nomes
 * novos. Os documentos HTML, que mantêm o mesmo endereço, são atualizados em
 * segundo plano para a próxima visita.
 */
self.addEventListener('install', (evento) => {
  // Só o essencial para abrir offline; o resto entra conforme for usado.
  evento.waitUntil(
    caches.open(VERSAO).then((cache) => cache.addAll(['/', '/manifest.webmanifest', '/icon.svg'])),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c !== VERSAO).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const requisicao = evento.request;

  // Só GET da própria origem. Nada mais deveria existir neste app, e se algum
  // dia existir, não é o service worker que vai decidir sozinho armazená-lo.
  if (requisicao.method !== 'GET') return;
  if (new URL(requisicao.url).origin !== self.location.origin) return;

  evento.respondWith(
    caches.match(requisicao).then((armazenada) => {
      const rede = fetch(requisicao)
        .then((resposta) => {
          if (resposta.ok) {
            const copia = resposta.clone();
            void caches.open(VERSAO).then((cache) => cache.put(requisicao, copia));
          }
          return resposta;
        })
        .catch(() => armazenada);

      return armazenada ?? rede;
    }),
  );
});
