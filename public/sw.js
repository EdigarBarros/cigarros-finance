// Service worker do OpusCash. Só faz uma coisa: quando o aparelho está sem internet, mostra /offline.html no lugar da
// página de erro do navegador (o app instalado pela Play Store e pela tela de início precisa disso para parecer app).
// Não guarda o app em cache: cada abertura busca a versão publicada, então a atualização automática
// (src/lib/atualizacao.ts) continua igual. Trocou /offline.html ou o que ela usa? Mude o número de CACHE.
const CACHE = 'opuscash-offline-1'
const GUARDAR = ['/offline.html', '/offline.js', '/simbolo.webp']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(GUARDAR)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k)
    // a página começa a ser buscada enquanto o service worker acorda (não deixa a abertura mais lenta)
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable()
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (e) => {
  const q = e.request
  if (q.method === 'GET' && GUARDAR.includes(new URL(q.url).pathname)) {
    e.respondWith(caches.match(q, { ignoreSearch: true }).then((r) => r || fetch(q)))
    return
  }
  if (q.mode !== 'navigate') return
  e.respondWith((async () => {
    try {
      return (await e.preloadResponse) || (await fetch(q))
    } catch {
      return (await caches.match('/offline.html')) || Response.error()
    }
  })())
})
