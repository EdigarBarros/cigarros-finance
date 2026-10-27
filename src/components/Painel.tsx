import { useMemo, useRef, useState } from 'react'
import { resumoMes, totalCaixa } from '../lib/calc'
import { fmtBRL, MESES } from '../lib/format'
import { supabase } from '../lib/supabase'
import { useDados } from '../lib/useDados'
import { Anual } from './Anual'
import { CaixaQuadro } from './CaixaQuadro'
import { Dividas } from './Dividas'
import { ListaLancamentos } from './ListaLancamentos'
import { Metricas, MetaUsd } from './Metricas'
import { Resumo } from './Resumo'

const hoje = new Date()

export function Painel({ userId, email }: { userId: string; email: string }) {
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)
  const arquivo = useRef<HTMLInputElement>(null)
  const d = useDados(userId, ano)

  const doMes = <T extends { mes: number }>(xs: T[], m: number) => xs.filter((x) => x.mes === m)
  const porMes = useMemo(
    () =>
      MESES.map((_, i) => {
        const m = i + 1
        const l = doMes(d.lancs, m)
        const dv = doMes(d.dividas, m)
        const meta = d.meses.find((x) => x.mes === m)
        const vazio = !l.length && !dv.length && !totalCaixa(meta) && !meta?.investimentos && !meta?.usd
        return vazio ? null : resumoMes(l, dv, meta)
      }),
    [d.lancs, d.dividas, d.meses],
  )

  const lancsMes = doMes(d.lancs, mes)
  const dividasMes = doMes(d.dividas, mes)
  const metaMes = d.meses.find((x) => x.mes === mes)
  const r = resumoMes(lancsMes, dividasMes, metaMes)
  const saidas = (conta: string) => lancsMes.filter((l) => l.tipo === 'saida' && l.conta === conta)

  const irPara = (a: number, m: number) => {
    if (m < 1) [a, m] = [a - 1, 12]
    if (m > 12) [a, m] = [a + 1, 1]
    setAno(a)
    setMes(m)
  }

  const importar = async (f: File) => {
    setOcupado('Lendo planilha…')
    try {
      // A biblioteca de planilhas é pesada; só baixa quando alguém importa ou exporta.
      const { lerPlanilha, gravarImportacao } = await import('../lib/planilha')
      const meses = await lerPlanilha(f)
      if (!meses.length) {
        alert('Não encontrei abas de mês (ex.: OUTUBRO26) com dados nessa planilha.')
        return
      }
      const lista = meses.map((m) => `${MESES[m.mes - 1]}/${m.ano}: ${m.lancs.length} lançamentos, ${m.dividas.length} dívidas`).join('\n')
      if (!confirm(`Encontrei ${meses.length} meses:\n\n${lista}\n\nOs dados desses meses no site serão SUBSTITUÍDOS pelos da planilha. Continuar?`)) return
      setOcupado('Gravando no banco…')
      await gravarImportacao(userId, meses)
      const ultimo = meses[meses.length - 1]
      if (ultimo.ano === ano) await d.recarregar()
      irPara(ultimo.ano, ultimo.mes)
    } catch (e) {
      d.setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setOcupado(null)
      if (arquivo.current) arquivo.current.value = ''
    }
  }

  const exportar = async () => {
    setOcupado('Gerando backup…')
    try {
      const { exportarBackup } = await import('../lib/planilha')
      await exportarBackup()
    } catch (e) {
      d.setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setOcupado(null)
    }
  }

  const copiar = async () => {
    setOcupado('Copiando…')
    await d.copiarMesAnterior(mes)
    setOcupado(null)
  }

  const chave = `${ano}-${mes}`
  const mesVazioDeDividasECaixa = !dividasMes.length && !totalCaixa(metaMes)

  return (
    <div className="app">
      <header className="topo">
        <button className="seta" onClick={() => irPara(ano, mes - 1)} aria-label="Mês anterior">‹</button>
        <h1>
          CONTROLE FINANCEIRO <span>{MESES[mes - 1]}/{ano}</span>
        </h1>
        <button className="seta" onClick={() => irPara(ano, mes + 1)} aria-label="Próximo mês">›</button>
        <div className="menu">
          <button className="menu-botao" onClick={() => setMenu(!menu)} aria-expanded={menu}>☰</button>
          {menu && (
            <div className="menu-lista" onClick={() => setMenu(false)}>
              <span className="menu-email">{email}</span>
              <button onClick={() => arquivo.current?.click()}>Importar planilha (.xlsx)</button>
              <button onClick={exportar}>Exportar backup (.xlsx)</button>
              <button onClick={() => supabase.auth.signOut()}>Sair</button>
            </div>
          )}
        </div>
        <input
          ref={arquivo}
          type="file"
          accept=".xlsx,.xlsm,.xls"
          hidden
          onChange={(e) => e.target.files?.[0] && importar(e.target.files[0])}
        />
      </header>

      {d.erro && (
        <div className="erro" role="alert">
          Erro: {d.erro} <button onClick={() => d.setErro(null)}>ok</button>
        </div>
      )}
      {(ocupado || d.carregando) && <div className="carregando">{ocupado ?? 'Carregando…'}</div>}

      <main className="grade">
        <div className="col col-entradas">
          <ListaLancamentos
            key={`e-${chave}`} titulo="ENTRADAS" tema="entrada" tipo="entrada" conta="principal" ano={ano} mes={mes}
            itens={lancsMes.filter((l) => l.tipo === 'entrada')} onAdd={d.addLanc} onUpd={d.updLanc} onDel={d.delLanc}
          />
          <p className="obs">OBS: não esquecer de contabilizar dinheiro de papel</p>
        </div>

        <div className="col col-saidas">
          <ListaLancamentos
            key={`s-${chave}`} titulo="SAÍDAS" tema="saida" tipo="saida" conta="principal" ano={ano} mes={mes}
            itens={saidas('principal')} onAdd={d.addLanc} onUpd={d.updLanc} onDel={d.delLanc}
          />
          <ListaLancamentos
            key={`n-${chave}`} titulo="NUBANK" tema="nubank" tipo="saida" conta="nubank" ano={ano} mes={mes} cabecalho={false}
            itens={saidas('nubank')} onAdd={d.addLanc} onUpd={d.updLanc} onDel={d.delLanc}
          />
          <ListaLancamentos
            key={`i-${chave}`} titulo="INTER" tema="inter" tipo="saida" conta="inter" ano={ano} mes={mes} cabecalho={false}
            itens={saidas('inter')} onAdd={d.addLanc} onUpd={d.updLanc} onDel={d.delLanc}
          />
          <div className="total-geral">
            <span>TOTAL</span>
            <span>{fmtBRL(r.saidas)}</span>
          </div>
        </div>

        <div className="col col-painel">
          <Resumo
            r={r}
            onInvestimentos={(investimentos) => d.salvarMes(mes, { investimentos })}
            onUsd={(usd) => d.salvarMes(mes, { usd })}
          />
          <Anual ano={ano} mesAtual={mes} porMes={porMes} onMes={setMes} />
          {mesVazioDeDividasECaixa && !d.carregando && (
            <button className="copiar" onClick={copiar}>
              ⤓ Trazer dívidas e caixa de {MESES[(mes + 10) % 12]}
            </button>
          )}
          <Dividas
            ano={ano} mes={mes} itens={dividasMes} onAdd={d.addDivida} onUpd={d.updDivida} onDel={d.delDivida}
          />
          <CaixaQuadro mes={metaMes} onChange={(caixa) => d.salvarMes(mes, { caixa })} />
          <div className="duas">
            <Metricas r={r} mes={mes} />
            <MetaUsd r={r} onMeta={(meta_usd) => d.salvarMes(mes, { meta_usd })} />
          </div>
        </div>
      </main>

      <nav className="abas">
        <select value={ano} onChange={(e) => setAno(Number(e.target.value))} aria-label="Ano">
          {Array.from({ length: 7 }, (_, i) => hoje.getFullYear() - 4 + i).map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        {MESES.map((m, i) => (
          <button key={m} className={i + 1 === mes ? 'ativa' : porMes[i] ? 'com-dados' : ''} onClick={() => setMes(i + 1)}>
            {m}{String(ano).slice(2)}
          </button>
        ))}
      </nav>
    </div>
  )
}
