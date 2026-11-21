/**
 * Entregar um arquivo gerado no aparelho (o backup) onde o download pelo navegador não é confiável: o iPhone e o iPad
 * (Safari, Chrome e o app salvo na tela inicial usam o mesmo motor). Lá o `download` de um link criado depois de esperar
 * o banco responder é ignorado em silêncio: o toque que a pessoa deu "venceu" enquanto o arquivo era montado.
 * Por isso o arquivo fica pronto e a pessoa toca de novo (`ArquivoPronto` em components/): esse segundo toque abre a
 * folha de compartilhar do sistema ("Salvar em Arquivos", AirDrop, e-mail...).
 */
import { useSyncExternalStore } from 'react'

export interface ArquivoPronto { nome: string; blob: Blob; titulo: string }

let atual: ArquivoPronto | null = null
const ouvintes = new Set<() => void>()
const avisar = () => ouvintes.forEach((f) => f())

export const oferecerArquivo = (a: ArquivoPronto) => { atual = a; avisar() }
export const dispensarArquivo = () => { atual = null; avisar() }
export const useArquivoPronto = () => useSyncExternalStore((f) => { ouvintes.add(f); return () => { ouvintes.delete(f) } }, () => atual)

/** iPhone e iPad (o iPad novo se apresenta como Mac, mas tem toque). */
export const noIOS = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** Chamado no toque da pessoa. Devolve false se o aparelho não deixou (a tela mostra o que fazer). */
export async function entregarArquivo(a: ArquivoPronto): Promise<boolean> {
  const arquivo = new File([a.blob], a.nome, { type: a.blob.type })
  try {
    if (navigator.canShare?.({ files: [arquivo] })) {
      await navigator.share({ files: [arquivo], title: a.titulo })
      return true
    }
  } catch (e) {
    // fechar a folha sem escolher nada não é erro
    if ((e as Error | undefined)?.name === 'AbortError') return true
  }
  // sem compartilhar: o link de download (num toque da própria pessoa o navegador deixa)
  const url = URL.createObjectURL(a.blob)
  const link = document.createElement('a')
  link.href = url
  link.download = a.nome
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return true
}
