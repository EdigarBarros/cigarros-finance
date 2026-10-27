import { useState } from 'react'
import { caixaDoBanco, somaCaixa } from '../lib/calc'
import { COR } from '../lib/charts'
import { fmtMoeda, fmtValor, MESES_NOME, simbolo } from '../lib/format'
import { converter, infoMoeda } from '../lib/moedas'
import { BANCOS_CONHECIDOS, bancoConhecido, CORES_LIVRES, NOME_TIPO_CAIXA } from '../lib/rotulos'
import { TIPOS_CAIXA, type Banco, type TipoCaixa } from '../lib/types'
import { Icone } from '../components/Icone'
import { ItemLancamento } from '../components/ItemLancamento'
import { CampoValor, Cartao, Kpi, Modal, Progresso, Vazio } from '../components/ui'
import type { Ctx } from './contexto'

const SEM_BANCO = 'sem'

/** Meu dinheiro: cada banco (com detalhe individual), investimentos e outras moedas, conforme os módulos ligados. */
export function Patrimonio(c: Ctx) {
  const { v } = c
  const [aberto, setAberto] = useState<string | null>(c.bancoAberto)
  const [gerenciar, setGerenciar] = useState<Banco | 'novo' | null>(null)
  const bancos = c.d.bancos
  const caixa = c.mesEf.caixa
  const herdado = c.mesEf.herdadoDe
  // Ao gravar o mês, o que ele herdou (caixa e moedas) passa a ser dele.
  const salvarCaixa = (id: string, t: TipoCaixa, valor: number) =>
    c.d.salvarMes(c.ano, c.mes, { caixa: { ...caixa, [id]: { ...caixa[id], [t]: valor } }, moedas: c.mesEf.moedas })
  const salvarMoeda = (m: string, valor: number) =>
    c.d.salvarMes(c.ano, c.mes, { caixa, moedas: { ...c.mesEf.moedas, [m]: valor } })
  const confirmar = () => c.d.salvarMes(c.ano, c.mes, { caixa, moedas: c.mesEf.moedas })

  const lancsDe = (id: string) =>
    c.lancsMes.filter((l) => (id === SEM_BANCO ? !l.banco_id || !bancos.some((b) => b.id === l.banco_id) : l.banco_id === id))
  const soma = (ls: typeof c.lancsMes, t: 'entrada' | 'saida') => ls.filter((l) => l.tipo === t).reduce((a, l) => a + l.valor, 0)

  const faixaHerdado = herdado && (
    <div className="faixa-herdado">
      <span>Os saldos vêm de <b>{MESES_NOME[herdado[1] - 1].toLowerCase()}/{herdado[0]}</b>. Se nada mudou, confirme; se mudou, edite.</span>
      <button className="btn" onClick={confirmar}><Icone nome="check" tamanho={16} /> Continua igual</button>
    </div>
  )

  // ---------- detalhe de um banco ----------
  if (aberto) {
    const banco = bancos.find((b) => b.id === aberto)
    const ls = lancsDe(aberto).sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''))
    const ent = soma(ls, 'entrada')
    const sai = soma(ls, 'saida')
    const nome = banco?.nome ?? 'Sem banco'
    const cor = banco?.cor ?? '#55555f'
    return (
      <div className="pagina">
        <header className="pagina-topo">
          <div>
            <button className="link voltar" onClick={() => setAberto(null)}><Icone nome="esq" tamanho={16} /> Todos os bancos</button>
            <h1><i className="marcador grande" style={{ background: cor }} />{nome}</h1>
            <p className="sub">{MESES_NOME[c.mes - 1]} de {c.ano}</p>
          </div>
          {banco && <button className="btn" onClick={() => setGerenciar(banco)}>Editar banco</button>}
        </header>
        <div className="kpis">
          {banco && <Kpi rotulo="Saldo guardado" valor={fmtValor(caixaDoBanco(caixa, banco.id))} cor={cor} />}
          <Kpi rotulo="Entrou" valor={fmtValor(ent)} cor={COR.entradas} />
          <Kpi rotulo="Saiu" valor={fmtValor(sai)} cor={COR.saidas} />
          <Kpi rotulo="Resultado no mês" valor={fmtValor(ent - sai)} cor={COR.fluxo} />
        </div>
        {banco && (
          <>
            {faixaHerdado}
            <Cartao titulo="Saldo guardado">
              <div className="campos campos-linha">
                {TIPOS_CAIXA.map((t) => (
                  <CampoValor key={t} rotulo={NOME_TIPO_CAIXA[t]} valor={caixa[banco.id]?.[t] ?? 0} aoSalvar={(v) => salvarCaixa(banco.id, t, v)} />
                ))}
              </div>
            </Cartao>
          </>
        )}
        <Cartao titulo={`Lançamentos (${ls.length})`}>
          {ls.length ? (
            <ul className="lista-lanc">
              {ls.map((l) => <ItemLancamento key={l.id} l={l} aoClicar={() => c.editarLancamento(l)} />)}
            </ul>
          ) : (
            <Vazio>Nenhum lançamento {banco ? `no ${nome}` : 'sem banco'} neste mês.</Vazio>
          )}
        </Cartao>
        {gerenciar && <FormBanco c={c} banco={gerenciar === 'novo' ? undefined : gerenciar} aoFechar={() => setGerenciar(null)} aoExcluir={() => setAberto(null)} />}
      </div>
    )
  }

  // ---------- todos os bancos ----------
  const semBanco = lancsDe(SEM_BANCO)
  const cartoes = [
    ...bancos.map((b) => ({ id: b.id, nome: b.nome, cor: b.cor, guardado: caixaDoBanco(caixa, b.id), ls: lancsDe(b.id) })),
    ...(semBanco.length ? [{ id: SEM_BANCO, nome: 'Sem banco', cor: '#55555f', guardado: null as number | null, ls: semBanco }] : []),
  ]

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div>
          <h1>Meu dinheiro</h1>
          <p className="sub">
            Como está em {MESES_NOME[c.mes - 1].toLowerCase()}/{c.ano}.{v.bancos && ' Toque num banco para ver só ele.'}
          </p>
        </div>
        {v.bancos && <button className="btn primario" onClick={() => setGerenciar('novo')}><Icone nome="mais" tamanho={16} /> Novo banco</button>}
      </header>

      {v.bancos && <>
      <div className="kpis">
        <Kpi rotulo="Total guardado" valor={fmtValor(somaCaixa(caixa))} cor={COR.caixa}
          delta={c.anterior?.caixa ? (c.r.caixa - c.anterior.caixa) / c.anterior.caixa : null} />
        {TIPOS_CAIXA.map((t) => (
          <Kpi key={t} rotulo={NOME_TIPO_CAIXA[t]} valor={fmtValor(bancos.reduce((a, b) => a + (caixa[b.id]?.[t] ?? 0), 0))} cor={COR.caixa} />
        ))}
      </div>

      {faixaHerdado}

      {!bancos.length && (
        <Cartao>
          <Vazio>
            Você ainda não cadastrou bancos. Eles são opcionais: servem para ver cada banco separado e guardar o saldo de cada um.<br />
            <button className="link" onClick={() => setGerenciar('novo')}>Cadastrar o primeiro banco</button>
          </Vazio>
        </Cartao>
      )}

      <div className="grade-bancos">
        {cartoes.map((x) => {
          const ent = soma(x.ls, 'entrada')
          const sai = soma(x.ls, 'saida')
          return (
            <button key={x.id} className="cartao banco-cartao" style={{ '--c': x.cor } as React.CSSProperties} onClick={() => setAberto(x.id)}>
              <span className="banco-cartao-nome"><i className="marcador" />{x.nome}</span>
              <strong className="banco-cartao-saldo">{x.guardado === null ? `${x.ls.length} lançamentos` : fmtValor(x.guardado)}</strong>
              <span className="banco-cartao-rot">{x.guardado === null ? 'sem banco definido' : 'guardado'}</span>
              <span className="banco-cartao-mov">
                <span style={{ color: COR.entradas }}>+{fmtValor(ent)}</span>
                <span style={{ color: COR.saidas }}>−{fmtValor(sai)}</span>
              </span>
            </button>
          )
        })}
      </div>
      </>}

      {(v.investimentos || v.moedas) && (
        <div className="grade-cartoes">
          {v.investimentos && (
            <Cartao titulo={<><i className="marcador" style={{ background: COR.investimentos }} />Investimentos</>}>
              <div className="campos">
                <CampoValor rotulo="Quanto você tem investido neste mês" prefixo={simbolo()} valor={c.r.investimentos}
                  aoSalvar={(investimentos) => c.d.salvarMes(c.ano, c.mes, { investimentos })} />
              </div>
              <p className="dica">Aceita contas: <code>=1500+320</code></p>
            </Cartao>
          )}
          {v.moedas && (
            <Cartao titulo={<><i className="marcador" style={{ background: COR.usd }} />Outras moedas</>}
              acao={<strong>≈ {fmtValor(c.r.moedasConvertido)}</strong>}>
              <div className="campos">
                {c.perfil.moedas.map((m) => {
                  const conv = converter(c.mesEf.moedas[m] ?? 0, m, c.taxas)
                  return (
                    <div key={m} className="campo">
                      <CampoValor rotulo={`${infoMoeda(m).bandeira} ${infoMoeda(m).nome}`} prefixo={simbolo(m)} valor={c.mesEf.moedas[m] ?? 0}
                        aoSalvar={(valor) => salvarMoeda(m, valor)} />
                      <span className="campo-ajuda">
                        {conv === null ? 'Sem cotação agora.' : `≈ ${fmtValor(conv)} · 1 ${m} = ${fmtValor(c.taxas[m])} hoje`}
                      </span>
                    </div>
                  )
                })}
                {c.perfil.moedas.includes('USD') && (
                  <CampoValor rotulo="Meta em dólar (vale para os próximos meses)" prefixo="US$" valor={c.r.metaUsd}
                    aoSalvar={(meta_usd) => c.d.salvarMes(c.ano, c.mes, { meta_usd })} />
                )}
              </div>
              {c.perfil.moedas.includes('USD') && c.r.metaUsd > 0 && (
                <div className="meta">
                  <Progresso valor={c.r.usd} total={c.r.metaUsd} cor={COR.usd} />
                  <p className="barras-sub">
                    {c.r.usd >= c.r.metaUsd ? 'Meta batida! 🎉' : `Faltam ${fmtMoeda(c.r.metaUsd - c.r.usd, 'USD')} · ${Math.round((c.r.usd / c.r.metaUsd) * 100)}% concluído`}
                  </p>
                </div>
              )}
              <p className="dica">Cotação do dia por <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">ExchangeRate-API</a>. Para mudar as moedas, use <button className="link" onClick={c.personalizar}>Personalizar painel</button>.</p>
            </Cartao>
          )}
        </div>
      )}

      {gerenciar && <FormBanco c={c} banco={gerenciar === 'novo' ? undefined : gerenciar} aoFechar={() => setGerenciar(null)} />}
    </div>
  )
}

function FormBanco({ c, banco, aoFechar, aoExcluir }: { c: Ctx; banco?: Banco; aoFechar: () => void; aoExcluir?: () => void }) {
  const [nome, setNome] = useState(banco?.nome ?? '')
  const [cor, setCor] = useState(banco?.cor ?? CORES_LIVRES[c.d.bancos.length % CORES_LIVRES.length])
  const [mexeuCor, setMexeuCor] = useState(Boolean(banco))
  const jaTem = new Set(c.d.bancos.map((b) => b.nome.toLowerCase()))
  const sugestoes = BANCOS_CONHECIDOS.filter((b) => !jaTem.has(b.nome.toLowerCase()))

  const salvar = async () => {
    const n = nome.trim()
    if (!n) return
    if (banco) await c.d.updBanco(banco.id, { nome: n, cor })
    else await c.d.addBanco(n, cor)
    aoFechar()
  }

  return (
    <Modal titulo={banco ? 'Editar banco' : 'Novo banco'} aoFechar={aoFechar}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); void salvar() }}>
        {!banco && sugestoes.length > 0 && (
          <div className="campo">
            <span className="campo-rotulo">Escolha rápida</span>
            <div className="chips">
              {sugestoes.map((b) => (
                <button key={b.nome} type="button" className={`chip ${nome === b.nome ? 'ativo' : ''}`} style={{ '--c': b.cor } as React.CSSProperties}
                  onClick={() => { setNome(b.nome); setCor(b.cor) }}>
                  <i className="marcador" />{b.nome}
                </button>
              ))}
            </div>
          </div>
        )}
        <label className="campo">
          <span className="campo-rotulo">Nome</span>
          <input autoFocus={Boolean(banco)} value={nome} placeholder="Ex.: Nubank, Itaú, Dinheiro…"
            onChange={(e) => { setNome(e.target.value); const k = bancoConhecido(e.target.value); if (k && !mexeuCor) setCor(k.cor) }} />
        </label>
        <div className="campo">
          <span className="campo-rotulo">Cor</span>
          <div className="chips">
            {[...new Set([cor, ...CORES_LIVRES, ...BANCOS_CONHECIDOS.map((b) => b.cor)])].slice(0, 14).map((k) => (
              <button key={k} type="button" className={`cor ${cor === k ? 'ativo' : ''}`} style={{ background: k }} aria-label={k}
                onClick={() => { setCor(k); setMexeuCor(true) }} />
            ))}
          </div>
        </div>
        <div className="form-acoes">
          {banco && (
            <button type="button" className="btn perigo" onClick={() => {
              if (confirm(`Excluir "${banco.nome}"? Os lançamentos dele continuam, só ficam sem banco.`)) {
                void c.d.delBanco(banco.id)
                aoExcluir?.()
                aoFechar()
              }
            }}>Excluir</button>
          )}
          <span className="espaco" />
          <button type="button" className="btn" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn primario">Salvar</button>
        </div>
      </form>
    </Modal>
  )
}

