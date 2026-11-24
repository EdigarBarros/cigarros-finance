// A página offline usa a mesma preferência de idioma do site.
try {
  var cookie = document.cookie
  var atual = cookie.match(/(?:^|;\s*)opuscash-idioma=([a-z]+)(?:;|$)/)
  var legado = cookie.match(/(?:^|;\s*)googtrans=\/pt\/([a-z]+)(?:;|$)/)
  var idioma = (atual || legado || [])[1]
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
