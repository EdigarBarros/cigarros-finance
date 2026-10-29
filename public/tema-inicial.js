try {
  var t = localStorage.getItem('opuscash-tema')
  if (t !== 'claro' && t !== 'escuro') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro'
  document.documentElement.dataset.tema = t
} catch (e) {}
