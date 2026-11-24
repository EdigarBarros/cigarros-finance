/** Valida o diretório central dos ZIPs de planilhas e documentos antes de entregá-los aos leitores. */
const texto = new TextDecoder()
const MAX_ENTRADA = 24 * 1024 * 1024
const MAX_TOTAL = 96 * 1024 * 1024
const MAX_ENTRADAS = 4096

type Entrada = { nome: string; metodo: number; tamanho: number; declarado: number; local: number }

function diretorio(zip: ArrayBuffer): Entrada[] {
  const v = new DataView(zip)
  const b = new Uint8Array(zip)
  const invalido = 'O arquivo compactado não pôde ser lido. Exporte uma nova cópia e tente novamente.'
  let fim = -1
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50 && i + 22 + v.getUint16(i + 20, true) === b.length) {
      fim = i
      break
    }
  }
  if (fim < 0) throw new Error(invalido)
  const quantidade = v.getUint16(fim + 10, true)
  if (quantidade > MAX_ENTRADAS) throw new Error('O arquivo tem muitos itens internos. Importe uma planilha ou documento menor.')
  const inicio = v.getUint32(fim + 16, true)
  const limite = inicio + v.getUint32(fim + 12, true)
  if (limite > fim) throw new Error(invalido)

  const entradas: Entrada[] = []
  let total = 0
  let p = inicio
  for (let n = 0; n < quantidade; n++) {
    if (p + 46 > limite || v.getUint32(p, true) !== 0x02014b50) throw new Error(invalido)
    const lenNome = v.getUint16(p + 28, true)
    const proxima = p + 46 + lenNome + v.getUint16(p + 30, true) + v.getUint16(p + 32, true)
    if (proxima > limite) throw new Error(invalido)
    const declarado = v.getUint32(p + 24, true)
    total += declarado
    if (declarado > MAX_ENTRADA || total > MAX_TOTAL) throw new Error('O arquivo é grande demais ao descompactar. Exporte um período menor.')
    entradas.push({
      nome: texto.decode(b.subarray(p + 46, p + 46 + lenNome)), metodo: v.getUint16(p + 10, true),
      tamanho: v.getUint32(p + 20, true), declarado, local: v.getUint32(p + 42, true),
    })
    p = proxima
  }
  return entradas
}

function dadosDaEntrada(zip: ArrayBuffer, entrada: Entrada) {
  const { local, metodo, tamanho, declarado } = entrada
  const v = new DataView(zip)
  if (local + 30 > v.byteLength || v.getUint32(local, true) !== 0x04034b50) throw new Error('Documento compactado inválido.')
  const inicio = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true)
  if (inicio + tamanho > v.byteLength) throw new Error('Documento compactado inválido.')
  if (metodo !== 0 && metodo !== 8) throw new Error('Este formato de compactação não é compatível.')
  if (metodo === 0 && tamanho !== declarado) throw new Error('Documento compactado inválido.')
  return new Uint8Array(zip, inicio, tamanho)
}

async function inflarComLimite(bruto: Uint8Array<ArrayBuffer>, declarado: number, consumir?: (dados: Uint8Array) => void) {
  const fluxo = new Blob([bruto]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader()
  let total = 0
  try {
    for (;;) {
      const { value, done } = await fluxo.read()
      if (done) break
      total += value.byteLength
      if (total > declarado) throw new Error('O documento excedeu o tamanho declarado ao descompactar.')
      consumir?.(value)
    }
    if (total !== declarado) throw new Error('Documento compactado incompleto.')
  } finally {
    await fluxo.cancel().catch(() => {})
  }
}

/** Confere os tamanhos declarados e reais antes de entregar o ZIP ao leitor de planilhas. */
export async function validarZipImportado(dados: ArrayBuffer) {
  const v = new DataView(dados)
  if (v.byteLength < 4) return
  const assinatura = v.getUint32(0, true)
  if (assinatura !== 0x04034b50 && assinatura !== 0x06054b50) return
  for (const entrada of diretorio(dados)) {
    const bruto = dadosDaEntrada(dados, entrada)
    if (entrada.metodo === 8) await inflarComLimite(bruto, entrada.declarado)
  }
}

/** Conteúdo de um arquivo de dentro do ZIP como texto (null se não existir). */
export async function lerDoZip(zip: ArrayBuffer, caminho: string): Promise<string | null> {
  const entrada = diretorio(zip).find((x) => x.nome === caminho)
  if (!entrada) return null
  const bruto = dadosDaEntrada(zip, entrada)
  if (entrada.metodo === 0) return texto.decode(bruto)
  const decodificador = new TextDecoder()
  const partes: string[] = []
  await inflarComLimite(bruto, entrada.declarado, (dados) => {
    partes.push(decodificador.decode(dados, { stream: true }))
  })
  partes.push(decodificador.decode())
  return partes.join('')
}
