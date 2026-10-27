import { useEffect, useMemo, useRef, useState } from 'react'
import { mesEfetivo, resumoMes } from '../lib/calc'
import { situacaoDividas, type SituacaoDivida } from '../lib/dividas'
import { MESES_NOME } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { Lancamento, Tipo } from '../lib/types'
import { useMobile } from '../lib/useMobile'
import { useDados } from '../lib/useDados'
import { Ano } from '../pages/Ano'
import type { Ctx, Pagina } from '../pages/contexto'
import { Dividas } from '../pages/Dividas'
import { Inicio } from '../pages/Inicio'
import { Lancamentos } from '../pages/Lancamentos'
import { Patrimonio } from '../pages/Patrimonio'
import { FormLancamento } from './Formularios'
import { Icone } from './Icone'

const PAGINAS: { id: Pagina; nome: string; icone: string }[] = [
  { id: 'inicio', nome: 'Visão geral', icone: 'inicio' },
  { id: 'lancamentos', nome: 'Lançamentos', icone: 'lista' },
  { id: 'dividas', nome: 'Dívidas', icone: 'divida' },
  { id: 'patrimonio', nome: 'Bancos', icone: 'carteira' },
  { id: 'ano', nome: 'Ano', icone: 'ano' },
]

const paginaDoHash = (): Pagina => {
  const h = location.hash.replace('#/', '') as Pagina
  return PAGINAS.some((p) => p.id === h) ? h : 'inicio'
}

const hoje = new Date()

export function Painel({ userId, email }: { userId: string; email: string }) {
  const [pagina, setPagina] = useState<Pagina>(paginaDoHash)
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [form, setForm] = useState<{ inicial?: Lancamento; tipo?: Tipo; preset?: Partial<Lancamento> } | null>(null)
  const [menu, setMenu] = useState(false)
  const [bancoAberto, setBancoAberto] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const arquivo = useRef<HTMLInputElement>(null)
  const d = useDados(userId, ano)
  const mobile = useMobile()

  useEffect(() => {
    const aoMudar = () => setPagina(paginaDoHash())
    window.addEventListener('hashchange', aoMudar)
    return () => window.removeEventListener('hashchange', aoMudar)
  }, [])
  // Ao trocar de mês, os blocos da página saem do desfoque de novo (mesma animação da entrada).
  const primeiraVez = useRef(true)
  useEffect(() => {
    if (primeiraVez.current) {
      primeiraVez.current = false
      return
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    document.querySelectorAll<HTMLElement>('.pagina > *').forEach((el, i) =>
      el.animate(
        [{ opacity: 0.35, filter: 'blur(8px)', transform: 'translateY(6px)' }, { opacity: 1, filter: 'none', transform: 'none' }],
        { duration: 500, delay: Math.min(i, 6) * 35, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' },
      ),
    )
  }, [mes, ano])

  // Mantém a aba do mês aberto visível quando a barra de meses rola (celular).
  useEffect(() => {
    const aba = document.querySelector('.abas-meses .ativo') as HTMLElement | null
    const barra = aba?.parentElement
    if (aba && barra) barra.scrollTo({ left: aba.offsetLeft - barra.clientWidth / 2 + aba.clientWidth / 2, behavior: 'smooth' })
  }, [mes, pagina])

  const irPara = (p: Pagina) => {
    setBancoAberto(null)
    location.hash = `/${p}`
    setPagina(p)
    window.scrollTo({ top: 0 })
  }

  // Cada mês é calculado com dívidas e caixa contínuos: nada precisa ser copiado à mão.
  const porMesCompleto = useMemo(() => {
    const agora = hoje.getFullYear() * 12 + hoje.getMonth() + 1
    return MESES_NOME.map((_, i) => {
      const m = i + 1
      const l = d.lancs.filter((x) => x.mes === m)
      const sit = situacaoDividas(d.dividas, d.saldos, d.pagamentos, ano, m)
      const ef = mesEfetivo(d.meses, ano, m)
      const temProprio = d.meses.some((x) => x.ano === ano && x.mes === m)
      // Meses futuros sem lançamentos ficam em branco, como na planilha.
      const vazio = !l.length && !temProprio && (ano * 12 + m > agora || (!sit.length && !ef.herdadoDe))
      return { sit, ef, resumo: vazio ? null : resumoMes(l, sit, ef) }
    })
  }, [d.lancs, d.dividas, d.saldos, d.pagamentos, d.meses, ano])
  const porMes = porMesCompleto.map((x) => x.resumo)

  const lancsMes = d.lancs.filter((l) => l.mes === mes)
  const { sit: situacao, ef: mesEf } = porMesCompleto[mes - 1]
  const dividasAbertas = situacao.filter((s) => s.restante > 0).map((s) => s.divida)

  const mudarMes = (delta: number) => {
    let [a, m] = [ano, mes + delta]
    if (m < 1) [a, m] = [a - 1, 12]
    if (m > 12) [a, m] = [a + 1, 1]
    setAno(a)
    setMes(m)
  }

  const tarefa = async (msg: string, fn: () => Promise<unknown>) => {
    setOcupado(msg)
    try {
      await fn()
    } catch (e) {
      d.setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setOcupado(null)
    }
  }

  const importar = (f: File) =>
    tarefa('Lendo planilha…', async () => {
      // A biblioteca de planilhas é pesada; só baixa quando alguém importa ou exporta.
      const { lerPlanilha, gravarImportacao } = await import('../lib/planilha')
      const meses = await lerPlanilha(f)
      if (arquivo.current) arquivo.current.value = ''
      if (!meses.length) return alert('Não encontrei abas de mês (ex.: OUTUBRO26) com dados nessa planilha.')
      const lista = meses.map((m) => `${MESES_NOME[m.mes - 1]}/${m.ano}: ${m.lancs.length} lançamentos`).join('\n')
      if (!confirm(`Encontrei ${meses.length} meses:\n\n${lista}\n\nOs dados desses meses no app serão SUBSTITUÍDOS pelos da planilha. Continuar?`)) return
      setOcupado('Gravando…')
      await gravarImportacao(userId, meses)
      const ultimo = meses[meses.length - 1]
      if (ultimo.ano === ano) await d.recarregar()
      setAno(ultimo.ano)
      setMes(ultimo.mes)
    })

  const pagarDivida = (s: SituacaoDivida) =>
    setForm({
      preset: {
        tipo: 'saida', categoria: 'divida', divida_id: s.divida.id,
        descricao: `${s.divida.descricao} – parcela`,
        valor: Math.min(s.divida.valor_parcela ?? s.restante, s.restante),
      },
    })

  const ctx: Ctx = {
    ano, mes, d, lancsMes, situacao, mesEf, porMes, mobile,
    r: resumoMes(lancsMes, situacao, mesEf),
    anterior: mes > 1 ? porMes[mes - 2] : null,
    irPara,
    irParaMes: setMes,
    novoLancamento: (tipo) => setForm({ tipo }),
    editarLancamento: (l) => setForm({ inicial: l }),
    pagarDivida,
    bancoAberto,
    abrirBanco: (id) => {
      irPara('patrimonio')
      setBancoAberto(id ?? 'sem')
    },
  }

  return (
    <div className="app">
      <aside className="lateral">
        <div className="marca"><span className="marca-logo" />Controle Financeiro</div>
        <nav>
          {PAGINAS.map((p) => (
            <button key={p.id} className={pagina === p.id ? 'ativo' : ''} onClick={() => irPara(p.id)}>
              <Icone nome={p.icone} /> {p.nome}
            </button>
          ))}
        </nav>
        <div className="lateral-rodape">
          <button onClick={() => arquivo.current?.click()}><Icone nome="importar" /> Importar planilha</button>
          <button onClick={() => tarefa('Gerando backup…', async () => (await import('../lib/planilha')).exportarBackup())}>
            <Icone nome="exportar" /> Exportar backup
          </button>
          <button onClick={() => supabase.auth.signOut()}><Icone nome="sair" /> Sair</button>
          <span className="email">{email}</span>
        </div>
      </aside>

      <div className="conteudo">
        <header className="barra">
          <div className="seletor-mes">
            <button className="icone-btn" onClick={() => mudarMes(-1)} aria-label="Mês anterior"><Icone nome="esq" /></button>
            <span>{MESES_NOME[mes - 1]} <small>{ano}</small></span>
            <button className="icone-btn" onClick={() => mudarMes(1)} aria-label="Próximo mês"><Icone nome="dir" /></button>
          </div>
          <nav className="abas-meses" aria-label="Meses">
            {MESES_NOME.map((m, i) => (
              <button
                key={m}
                className={`${i + 1 === mes ? 'ativo' : ''} ${porMes[i] ? 'com-dados' : ''}`}
                onClick={() => setMes(i + 1)}
                aria-current={i + 1 === mes ? 'page' : undefined}
              >
                {m.slice(0, 3).toUpperCase()}
              </button>
            ))}
          </nav>
          {(ocupado || d.carregando) && <span className="carregando">{ocupado ?? 'Carregando…'}</span>}
          <div className="menu-movel">
            <button className="icone-btn" onClick={() => setMenu(!menu)} aria-label="Menu" aria-expanded={menu}><Icone nome="menu" /></button>
            {menu && (
              <div className="menu-lista" onClick={() => setMenu(false)}>
                <span className="email">{email}</span>
                <button onClick={() => arquivo.current?.click()}><Icone nome="importar" /> Importar planilha</button>
                <button onClick={() => tarefa('Gerando backup…', async () => (await import('../lib/planilha')).exportarBackup())}>
                  <Icone nome="exportar" /> Exportar backup
                </button>
                <button onClick={() => supabase.auth.signOut()}><Icone nome="sair" /> Sair</button>
              </div>
            )}
          </div>
        </header>

        {d.erro && (
          <div className="alerta" role="alert">
            Algo deu errado: {d.erro}
            <button className="link" onClick={() => d.setErro(null)}>Fechar</button>
          </div>
        )}

        {pagina === 'inicio' && <Inicio {...ctx} />}
        {pagina === 'lancamentos' && <Lancamentos {...ctx} />}
        {pagina === 'dividas' && <Dividas {...ctx} />}
        {pagina === 'patrimonio' && <Patrimonio key={bancoAberto ?? 'todos'} {...ctx} />}
        {pagina === 'ano' && <Ano {...ctx} />}
      </div>

      <button className="fab" onClick={() => setForm({})} aria-label="Novo lançamento"><Icone nome="mais" tamanho={26} /></button>

      <nav className="abas-movel">
        {PAGINAS.map((p) => (
          <button key={p.id} className={pagina === p.id ? 'ativo' : ''} onClick={() => irPara(p.id)}>
            <Icone nome={p.icone} /> <span>{p.nome.replace('Visão geral', 'Início')}</span>
          </button>
        ))}
      </nav>

      <input ref={arquivo} type="file" accept=".xlsx,.xlsm,.xls" hidden onChange={(e) => e.target.files?.[0] && importar(e.target.files[0])} />

      {form && (
        <FormLancamento
          key={form.inicial?.id ?? form.preset?.divida_id ?? 'novo'}
          ano={ano}
          mes={mes}
          inicial={form.inicial}
          tipoInicial={form.tipo}
          preset={form.preset}
          historico={d.lancs}
          dividas={dividasAbertas}
          bancos={d.bancos}
          aoNovoBanco={d.addBanco}
          aoSalvar={(l, id) => (id ? d.updLanc(id, l) : d.addLanc(l))}
          aoExcluir={d.delLanc}
          aoFechar={() => setForm(null)}
        />
      )}
    </div>
  )
}
