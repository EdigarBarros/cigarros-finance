/**
 * Leitor mínimo de ZIP (o .docx do Word é um ZIP com XML dentro). Lê o diretório central e descompacta com o
 * `DecompressionStream` do próprio navegador, sem biblioteca. Só o necessário para tirar um arquivo de dentro.
 */
const texto = new TextDecoder()

async function inflar(dados: Uint8Array): Promise<Uint8Array> {
  const fluxo = new Blob([dados as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(fluxo).arrayBuffer())
}

/** Conteúdo de um arquivo de dentro do ZIP como texto (null se não existir). */
export async function lerDoZip(zip: ArrayBuffer, caminho: string): Promise<string | null> {
  const v = new DataView(zip)
  const b = new Uint8Array(zip)
  // fim do diretório central: assinatura 0x06054b50, procurada de trás para frente
  let fim = -1
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { fim = i; break }
  }
  if (fim < 0) throw new Error('O arquivo não parece um documento do Word (.docx).')
  const total = v.getUint16(fim + 10, true)
  let p = v.getUint32(fim + 16, true)
  for (let n = 0; n < total; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) break
    const metodo = v.getUint16(p + 10, true)
    const tamanho = v.getUint32(p + 20, true)
    const lenNome = v.getUint16(p + 28, true)
    const lenExtra = v.getUint16(p + 30, true)
    const lenComent = v.getUint16(p + 32, true)
    const local = v.getUint32(p + 42, true)
    const nome = texto.decode(b.subarray(p + 46, p + 46 + lenNome))
    if (nome === caminho) {
      const inicio = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true)
      const bruto = b.subarray(inicio, inicio + tamanho)
      return texto.decode(metodo === 0 ? bruto : await inflar(bruto))
    }
    p += 46 + lenNome + lenExtra + lenComent
  }
  return null
}
