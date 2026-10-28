/** Lado da foto de perfil guardada (px). Pequena de propósito: fica no banco como texto e aparece em tamanho de avatar. */
const LADO = 192

/**
 * Lê a imagem escolhida, recorta o quadrado do meio e reduz para uma JPEG pequena (uns 10–20 KB), pronta para guardar
 * como data URL. Falha com uma mensagem legível quando o arquivo não é uma imagem que o navegador sabe abrir.
 */
export async function reduzirFoto(arquivo: File): Promise<string> {
  if (!arquivo.type.startsWith('image/')) throw new Error('Escolha uma imagem (JPG, PNG, WEBP…).')
  const url = URL.createObjectURL(arquivo)
  try {
    const img = await new Promise<HTMLImageElement>((ok, falha) => {
      const i = new Image()
      i.onload = () => ok(i)
      i.onerror = () => falha(new Error('Não consegui abrir essa imagem. Tente outra.'))
      i.src = url
    })
    const lado = Math.min(img.naturalWidth, img.naturalHeight)
    const tela = document.createElement('canvas')
    tela.width = tela.height = LADO
    const ctx = tela.getContext('2d')
    if (!ctx) throw new Error('Seu navegador não deixou preparar a foto.')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, 0, 0, LADO, LADO)
    return tela.toDataURL('image/jpeg', 0.86)
  } finally {
    URL.revokeObjectURL(url)
  }
}
