try {
  // cada conta do aparelho tem o seu tema (src/lib/contas.ts): vale o da conta aberta, senão o de antes
  var t = null
  for (var i = 0; i < localStorage.length; i++) {
    var k = localStorage.key(i)
    if (k && /^sb-.+-auth-token$/.test(k)) {
      var s = JSON.parse(localStorage.getItem(k) || 'null')
      if (s && s.user && s.user.id) t = localStorage.getItem('opuscash-tema@' + s.user.id)
    }
  }
  if (!t) t = localStorage.getItem('opuscash-tema')
  if (t !== 'claro' && t !== 'escuro') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro'
  document.documentElement.dataset.tema = t
} catch (e) {}
// As fontes do Google chegam em segundo plano: o texto aparece na hora com a fonte do aparelho e troca quando elas chegam
// (o link nasce com media="print" para não travar a primeira pintura).
try {
  var f = document.getElementById('fontes')
  if (f) {
    var ligar = function () { f.media = 'all' }
    f.addEventListener('load', ligar)
    if (f.sheet) ligar()
  }
} catch (e) {}
