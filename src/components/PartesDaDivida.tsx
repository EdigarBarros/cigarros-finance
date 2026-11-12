import { useState } from 'react'
import { gerarParcelasDaParte, gruposDasPartes, type Calendario, type EstadoParcela, type SituacaoDivida } from '../lib/dividas'
import { mascarar, paraCampoMoeda } from '../lib/dinheiro'
import { fmtDataCurta, fmtDataLonga, fmtValor, MESES_CURTO, noMeioDaFrase, parseNumero } from '../lib/format'
import type { Dados, NovaParte } from '../lib/useDados'
import type { ParteDivida } from '../lib/types'
import { CampoData } from './Escolhas'
import { Icone } from './Icone'
import { Segmentado } from './ui'
import { tx } from '../lib/textos'

const ROTULO: Record<EstadoParcela, string> = {
  paga: tx('paga'), parcial: tx('pela metade'), atrasada: tx('atrasada'), vence_hoje: tx('vence hoje'), a_vencer: tx('a vencer'),
}
/** "mar/26", como no calendário da dívida. */
const mesAno = (iso: string) => `${noMeioDaFrase(MESES_CURTO[Number(iso.slice(5, 7)) - 1])}/${iso.slice(2, 4)}`

/**
 * As partes de uma dívida (mini-dívidas que formam uma maior: as compras dentro do crédito de uma loja, os itens de um
 * acordo). Cada parte mostra o total e, aberta, as parcelas com a situação do dia em que vencem. Dá para corrigir o valor
 * ou a data de uma parcela (juros e multa já somados pelo credor) e acrescentar partes novas.
 */
export function PartesDaDivida({ s, cal, d, recebe }: {
  s: SituacaoDivida; cal: Calendario | null; d: Pick<Dados, 'partesSemTabela' | 'partesSemInicio' | 'addPartes' | 'updParte' | 'updPartes' | 'delPartes'>; recebe: boolean
}) {
  const partes = s.divida.partes ?? []
  const [aberta, setAberta] = useState<string | null>(null)
  const [nova, setNova] = useState(false)
  if (d.partesSemTabela) {
    return (
      <p className="cc-aviso-migracao">
        <Icone nome="ideia" tamanho={16} />
        <span>{tx('Para dividir uma dívida em partes (as compras dentro de um crédito, por exemplo), rode')} <code>supabase/migracao-21-partes-da-divida.sql</code> {tx('no SQL Editor do Supabase.')}</span>
      </p>
    )
  }
  const grupos = gruposDasPartes(partes)
  // situação de cada dia de vencimento, tirada do calendário da dívida (o pagamento cobre os dias do mais antigo para o mais novo)
  const estadoDoDia = new Map((cal?.parcelas ?? []).map((p) => [p.vencimento, p.estado]))
  const total = grupos.reduce((a, g) => a + g.total, 0)
  // juros de atraso estimados de cada parcela (por id da parte), só no mês de hoje
  const jurosDe = (id: string) => s.atraso?.porParte.get(id) ?? 0

  return (
    <section className="dp">
      <h4 className="dv-ficha-titulo">
        {tx('Do que é feita')} {grupos.length > 0 && <small>{grupos.length === 1 ? tx('1 parte') : tx('{0} partes', grupos.length)} · {fmtValor(total)}</small>}
      </h4>
      {grupos.length > 0 ? (
        <ul className="dp-lista">
          {grupos.map((g, i) => {
            const atrasadas = g.parcelas.filter((p) => estadoDoDia.get(p.vencimento) === 'atrasada').length
            const jurosDoGrupo = g.parcelas.reduce((a, p) => a + jurosDe(p.id), 0)
            const pagas = g.parcelas.filter((p) => estadoDoDia.get(p.vencimento) === 'paga').length
            const chave = g.nome.toLowerCase()
            const abertaAqui = aberta === chave
            return (
              <li key={chave} className={`dp-parte ${abertaAqui ? 'aberta' : ''}`} style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
                <button className="dp-parte-cab" onClick={() => setAberta(abertaAqui ? null : chave)} aria-expanded={abertaAqui}>
                  <span className="dp-parte-nome">
                    <strong>{g.nome || tx('Sem nome')}</strong>
                    <small>
                      {g.parcelas.length === 1 && !g.de
                        ? <>{tx('valor único')} · {recebe ? tx('receber até {0}', fmtDataCurta(g.primeira)) : tx('pagar até {0}', fmtDataCurta(g.primeira))}</>
                        : <>{resumoDoGrupo(g.parcelas, g.de)} · {mesAno(g.primeira) === mesAno(g.ultima) ? mesAno(g.primeira) : tx('{0} a {1}', mesAno(g.primeira), mesAno(g.ultima))}</>}
                      {g.inicio && <> · {tx('desde {0}', fmtDataCurta(g.inicio))}</>}
                    </small>
                  </span>
                  {atrasadas > 0 ? <span className="chip-estado dv atrasada">{atrasadas === 1 ? tx('1 atrasada') : tx('{0} atrasadas', atrasadas)}</span>
                    : pagas === g.parcelas.length ? <span className="chip-estado dv quitada">{recebe ? tx('Recebido') : tx('Quitada')}</span> : null}
                  <span className="dp-parte-valor">{jurosDoGrupo > 0 ? <><s>{fmtValor(g.total)}</s> {fmtValor(g.total + jurosDoGrupo)}</> : fmtValor(g.total)}</span>
                  <Icone nome="abaixo" tamanho={16} />
                </button>
                {abertaAqui && (
                  <Parcelas parcelas={g.parcelas} estadoDoDia={estadoDoDia} d={d} jurosDe={jurosDe} recebe={recebe} inicio={g.inicio} />
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="campo-ajuda">{tx('Essa dívida junta várias compras ou contas, cada uma com as suas parcelas? Adicione cada parte: o calendário e o atraso passam a sair delas.')}</p>
      )}
      {nova
        ? <NovaParteForm comInicio={!d.partesSemInicio} recebe={recebe} aoSalvar={async (ps) => { await d.addPartes(s.divida.id, ps); setNova(false) }} aoCancelar={() => setNova(false)} />
        : <button className="btn dp-adicionar" onClick={() => setNova(true)}><Icone nome="mais" tamanho={15} /> {tx('Adicionar parte')}</button>}
    </section>
  )
}

/** "parcelas 2 a 6 de 6", "1 parcela" ou "5 parcelas". */
function resumoDoGrupo(parcelas: ParteDivida[], de: number | null) {
  const nums = parcelas.map((p) => p.parcela).filter((n): n is number => n != null)
  if (de && nums.length === parcelas.length) {
    const a = Math.min(...nums)
    const b = Math.max(...nums)
    return a === b ? tx('parcela {0} de {1}', a, de) : tx('parcelas {0} a {1} de {2}', a, b, de)
  }
  return parcelas.length === 1 ? tx('1 parcela') : tx('{0} parcelas', parcelas.length)
}

/** As parcelas de uma parte, cada uma com a situação e o lápis para corrigir valor e data. */
function Parcelas({ parcelas, estadoDoDia, d, jurosDe, recebe, inicio }: {
  parcelas: ParteDivida[]; estadoDoDia: Map<string, EstadoParcela>; d: Pick<Dados, 'partesSemInicio' | 'updParte' | 'updPartes' | 'delPartes'>
  jurosDe: (id: string) => number; recebe: boolean; inicio: string | null
}) {
  const [editando, setEditando] = useState<string | null>(null)
  const [apagar, setApagar] = useState(false)
  const [mudandoInicio, setMudandoInicio] = useState(false)
  const [novoInicio, setNovoInicio] = useState(inicio ?? '')
  const unico = parcelas.length === 1 && !parcelas[0].parcelas
  return (
    <div className="dp-parcelas">
      {!d.partesSemInicio && (mudandoInicio ? (
        <div className="dp-inicio editando">
          <span className="campo-rotulo">{tx('Quando começou')}</span>
          <CampoData valor={novoInicio} aoMudar={setNovoInicio} rotulo={tx('Quando começou')} />
          <button className="btn" onClick={() => setMudandoInicio(false)}>{tx('Cancelar')}</button>
          <button className="btn primario" onClick={async () => {
            await d.updPartes(parcelas.map((p) => ({ id: p.id, patch: { inicio: novoInicio || null } })))
            setMudandoInicio(false)
          }}>{tx('Salvar')}</button>
        </div>
      ) : (
        <button className="dp-inicio" onClick={() => { setNovoInicio(inicio ?? ''); setMudandoInicio(true) }}>
          <Icone nome="historico" tamanho={14} />
          <span>{inicio ? tx('Começou em {0}', fmtDataLonga(inicio)) : tx('Quando começou? Toque para dizer')}</span>
          <Icone nome="lapis" tamanho={13} />
        </button>
      ))}
      <ol>
        {parcelas.map((p) => {
          const estado = estadoDoDia.get(p.vencimento) ?? 'a_vencer'
          return editando === p.id ? (
            <EditarParcela key={p.id} p={p} rotuloData={unico ? (recebe ? tx('Combinado receber em') : tx('Combinado pagar em')) : tx('Vencimento')} aoFechar={() => setEditando(null)}
              aoSalvar={async (patch) => { await d.updParte(p.id, patch); setEditando(null) }}
              aoExcluir={async () => { await d.delPartes([p.id]); setEditando(null) }} />
          ) : (
            <li key={p.id} className={estado}>
              <span className="dp-n">{p.parcela && p.parcelas ? tx('{0} de {1}', p.parcela, p.parcelas) : <Icone nome="calendario" tamanho={13} />}</span>
              <span className="dp-data">{fmtDataCurta(p.vencimento)}</span>
              <span className="dp-estado">{ROTULO[estado]}</span>
              <span className="dp-valor">{jurosDe(p.id) > 0
                ? <span title={tx('Estimativa de hoje, com os juros do atraso. Registrado: {0}', fmtValor(p.valor))}><s>{fmtValor(p.valor)}</s> {fmtValor(p.valor + jurosDe(p.id))}</span>
                : fmtValor(p.valor)}</span>
              <button className="icone-btn" onClick={() => setEditando(p.id)} aria-label={tx('Corrigir parcela')}><Icone nome="lapis" tamanho={14} /></button>
            </li>
          )
        })}
      </ol>
      <div className="dp-parcelas-acoes">
        {apagar ? (
          <>
            <span>{(parcelas.length === 1 ? tx('Excluir esta parte e a parcela dela?') : tx('Excluir esta parte e as {0} parcelas dela?', parcelas.length))}</span>
            <button className="btn" onClick={() => setApagar(false)}>{tx('Manter')}</button>
            <button className="btn perigo" onClick={() => void d.delPartes(parcelas.map((p) => p.id))}>{tx('Excluir parte')}</button>
          </>
        ) : (
          <button className="link perigo" onClick={() => setApagar(true)}><Icone nome="lixeira" tamanho={14} /> {tx('Excluir esta parte')}</button>
        )}
      </div>
    </div>
  )
}

/** Corrige uma parcela: o valor (o credor costuma somar juros e multa) e o vencimento. */
function EditarParcela({ p, rotuloData, aoSalvar, aoExcluir, aoFechar }: {
  p: ParteDivida; rotuloData: string; aoSalvar: (patch: Partial<NovaParte>) => Promise<void>; aoExcluir: () => Promise<void>; aoFechar: () => void
}) {
  const [valor, setValor] = useState(paraCampoMoeda(p.valor, 'BRL'))
  const [data, setData] = useState(p.vencimento)
  const n = parseNumero(valor)
  return (
    <li className="dp-editar">
      <label className="campo">
        <span className="campo-rotulo">{tx('Valor')}</span>
        <span className="campo-caixa"><span className="prefixo">R$</span>
          <input autoFocus inputMode="decimal" value={valor} onFocus={(e) => e.target.select()} onChange={(e) => setValor(mascarar(e.target.value))} />
        </span>
      </label>
      <div className="campo">
        <span className="campo-rotulo">{rotuloData}</span>
        <CampoData valor={data} aoMudar={setData} rotulo={rotuloData} />
      </div>
      <div className="dp-editar-acoes">
        <button className="link perigo" onClick={() => void aoExcluir()}><Icone nome="lixeira" tamanho={14} /> {tx('Excluir parcela')}</button>
        <span className="espaco" />
        <button className="btn" onClick={aoFechar}>{tx('Cancelar')}</button>
        <button className="btn primario" disabled={!n || n <= 0 || !data} onClick={() => n && void aoSalvar({ valor: n, vencimento: data })}>{tx('Salvar')}</button>
      </div>
    </li>
  )
}

/**
 * Parte nova, de dois jeitos. Valor único: o nome, quanto é, quando começou e o dia combinado para pagar. Parcelado: o valor
 * de cada parcela, o vencimento da primeira que falta e "da parcela X até a Y". Mostra antes o que vai ser criado.
 */
function NovaParteForm({ comInicio, recebe, aoSalvar, aoCancelar }: {
  comInicio: boolean; recebe: boolean; aoSalvar: (ps: NovaParte[]) => Promise<void>; aoCancelar: () => void
}) {
  const [jeito, setJeito] = useState<'unico' | 'parcelado'>('unico')
  const [nome, setNome] = useState('')
  const [valor, setValor] = useState('')
  const [inicio, setInicio] = useState(hojeIso())
  const [data, setData] = useState('')
  const [da, setDa] = useState('')
  const [ate, setAte] = useState('')
  const [salvando, setSalvando] = useState(false)
  const unico = jeito === 'unico'
  const n = parseNumero(valor)
  const nDa = unico ? null : Number(da) || null
  const nAte = unico ? null : Number(ate) || null
  const erroParcelas = nAte != null && nDa != null && nAte < nDa ? tx('A última parcela não pode vir antes da primeira.')
    : !unico && !nAte && (da || ate) ? tx('Diga até qual parcela vai.') : null
  const erroDatas = comInicio && inicio && data && data < inicio ? (unico ? tx('O dia de pagar não pode vir antes do dia em que começou.') : null) : null
  const pronto = nome.trim() && n && n > 0 && data && !erroParcelas && !erroDatas && (unico || nAte)
  const geradas = pronto ? gerarParcelasDaParte({ nome, valor: n!, vencimento: data, da: nDa, ate: nAte, inicio: comInicio ? inicio || null : null }) : []
  const rotuloData = unico ? (recebe ? tx('Combinado receber em') : tx('Combinado pagar em')) : tx('Vencimento da primeira que falta')
  return (
    <form className="dp-nova" onSubmit={async (e) => {
      e.preventDefault()
      if (!pronto || salvando) return
      setSalvando(true)
      await aoSalvar(geradas)
      setSalvando(false)
    }}>
      <Segmentado rotulo={tx('Como é')} valor={jeito} aoMudar={setJeito}
        opcoes={[{ id: 'unico', nome: tx('Valor único') }, { id: 'parcelado', nome: tx('Parcelado') }]} />
      <label className="campo">
        <span className="campo-rotulo">{tx('De que é')}</span>
        <input autoFocus value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} placeholder={unico ? tx('Ex.: Pão, Uber, empréstimo') : tx('Ex.: Microfone')} />
      </label>
      <div className="form-linha">
        <label className="campo">
          <span className="campo-rotulo">{unico ? tx('Valor') : tx('Valor de cada parcela')}</span>
          <span className="campo-caixa"><span className="prefixo">R$</span>
            <input inputMode="decimal" value={valor} onChange={(e) => setValor(mascarar(e.target.value))} placeholder="0,00" />
          </span>
        </label>
        {comInicio && (
          <div className="campo">
            <span className="campo-rotulo">{tx('Quando começou')}</span>
            <CampoData valor={inicio} aoMudar={setInicio} rotulo={tx('Quando começou')} />
          </div>
        )}
      </div>
      <div className="campo">
        <span className="campo-rotulo">{rotuloData}</span>
        <CampoData valor={data} aoMudar={setData} rotulo={rotuloData} />
      </div>
      {!unico && (
        <div className="form-linha">
          <label className="campo">
            <span className="campo-rotulo">{tx('Da parcela')}</span>
            <input inputMode="numeric" value={da} maxLength={3} onChange={(e) => setDa(e.target.value.replace(/\D/g, ''))} placeholder={tx('Ex.: 1')} />
          </label>
          <label className="campo">
            <span className="campo-rotulo">{tx('Até a parcela')}</span>
            <input inputMode="numeric" value={ate} maxLength={3} onChange={(e) => setAte(e.target.value.replace(/\D/g, ''))} placeholder={tx('Ex.: 6')} />
          </label>
        </div>
      )}
      <p className={`campo-ajuda ${erroParcelas || erroDatas ? 'erro' : ''}`}>
        {erroParcelas ?? erroDatas ?? (geradas.length > 1
          ? tx('Vai criar {0} parcelas de {1}, de {2} a {3}. Depois dá para corrigir o valor de cada uma.', geradas.length, fmtValor(n!), mesAno(geradas[0].vencimento), mesAno(geradas[geradas.length - 1].vencimento))
          : geradas.length === 1 ? (recebe ? tx('Vai criar {0} para receber até {1}.', fmtValor(n!), fmtDataCurta(geradas[0].vencimento)) : tx('Vai criar {0} para pagar até {1}.', fmtValor(n!), fmtDataCurta(geradas[0].vencimento)))
            : unico ? tx('Se o dia combinado passar, anote a nova promessa em "Promessas de pagamento".')
              : tx('Ex.: comprou em 6 vezes e já pagou 1? Da parcela 2 até a 6, com o vencimento da 2ª.'))}
      </p>
      <div className="form-acoes">
        <span className="espaco" />
        <button type="button" className="btn" onClick={aoCancelar}>{tx('Cancelar')}</button>
        <button type="submit" className="btn primario" disabled={!pronto || salvando}><Icone nome="mais" tamanho={15} /> {tx('Adicionar')}</button>
      </div>
    </form>
  )
}

const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
