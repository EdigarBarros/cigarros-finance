/*
 * Avisos, confirmações e perguntas do app, no lugar do alert(), confirm() e prompt() do navegador (que abriam a caixa
 * cinza do sistema). Aparecem na janela do app (components/Avisos.tsx): no computador no meio da tela, no celular sobem
 * como folha.
 *
 *   if (!(await confirmar('Excluir este lançamento?', { botao: 'Excluir', perigo: true }))) return
 *   await avisar('Não encontrei abas de mês…')
 *   const nome = await perguntar('Nome do banco:')
 */

export interface Pedido {
  tipo: 'aviso' | 'confirmacao' | 'pergunta'
  texto: string
  titulo?: string
  botao?: string
  perigo?: boolean
  placeholder?: string
  cancelar?: string
  responder: (v: boolean | string | null) => void
}

let fila: Pedido[] = []
const ouvintes = new Set<() => void>()
const mudou = () => ouvintes.forEach((f) => f())
let montado = false

/** Para a janela (components/Avisos.tsx): o pedido da vez, e como avisar que mudou ou que foi respondido. */
export const filaDeAvisos = {
  ouvir: (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f) } },
  atual: () => fila[0] as Pedido | undefined,
  responder: (v: boolean | string | null) => { const p = fila[0]; fila = fila.slice(1); mudou(); p?.responder(v) },
  tamanho: () => fila.length,
}

function pedir(p: Omit<Pedido, 'responder'>) {
  if (!montado) {
    montado = true
    // a janela só é baixada na primeira vez que o app pergunta ou avisa algo
    void Promise.all([import('react'), import('react-dom/client'), import('../components/Avisos')]).then(([{ createElement }, { createRoot }, { Janelas }]) => {
      const div = document.createElement('div')
      document.body.appendChild(div)
      createRoot(div).render(createElement(Janelas))
    })
  }
  return new Promise<boolean | string | null>((responder) => {
    fila = [...fila, { ...p, responder }]
    mudou()
  })
}

export interface OpcoesConfirmar { titulo?: string; botao?: string; perigo?: boolean; /** Texto do outro botão (padrão: Cancelar). */ cancelar?: string }

/** Pergunta sim ou não. `perigo`: o botão de confirmar sai vermelho (excluir, apagar, substituir). */
export const confirmar = (texto: string, o: OpcoesConfirmar = {}) => pedir({ tipo: 'confirmacao', texto, ...o }) as Promise<boolean>
/** Só um recado, com um botão de OK. */
export const avisar = (texto: string, titulo?: string) => pedir({ tipo: 'aviso', texto, titulo }).then(() => undefined)
/** Pede um texto curto. Devolve null se a pessoa cancelar. */
export const perguntar = (texto: string, o: { titulo?: string; placeholder?: string; botao?: string } = {}) =>
  pedir({ tipo: 'pergunta', texto, ...o }) as Promise<string | null>
