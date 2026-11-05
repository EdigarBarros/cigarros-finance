// Textos da página sem internet no idioma escolhido no app (cookie googtrans, veja src/lib/idioma.ts).
// Inglês e espanhol têm tradução nossa; os outros idiomas ficam em português, porque o tradutor do Google precisa de internet.
try {
  var m = document.cookie.match(/(?:^|;\s*)googtrans=\/[^/;]*\/([^;]+)/)
  var idioma = m ? m[1].slice(0, 2) : ''
  var textos = {
    en: ['You are offline', 'OpusCash needs a connection to show your data. Your entries are still saved.', 'Try again'],
    es: ['Estás sin internet', 'OpusCash necesita conexión para mostrar tus datos. Tus movimientos siguen guardados.', 'Intentar de nuevo'],
  }[idioma]
  if (textos) {
    document.documentElement.lang = idioma
    document.getElementById('titulo').textContent = textos[0]
    document.getElementById('texto').textContent = textos[1]
    document.getElementById('botao').textContent = textos[2]
  }
} catch { /* sem cookie ou sem a página: fica em português */ }
// volta sozinho quando a conexão voltar
addEventListener('online', function () { location.href = '/' })
