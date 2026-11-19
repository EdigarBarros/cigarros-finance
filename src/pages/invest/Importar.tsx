/**
 * Importar um arquivo de investimentos e revisar o que ficou pendente (a leitura é de lib/invest/importar.ts).
 *
 * O caminho: escolher o arquivo → o app lê e cruza com a carteira → a pessoa confere a prévia (o que é novo, o que já foi
 * importado, o que parece repetido, os investimentos que serão criados e o que não foi entendido) → só o que ela deixar
 * marcado é gravado. O que não foi entendido fica guardado na importação até ser registrado à mão ou descartado por ela.
 */
import { useRef, useState } from 'react'
import { confirmar } from '../../lib/avisos'
import { hojeLocal } from '../../lib/cartoes'
import { fmtDataCurta, fmtValor } from '../../lib/format'
import { conciliar, lerArquivoDeInvestimentos, type ArquivoLido, type Previa } from '../../lib/invest/importar'
import { CLASSES, infoClasse, nomeOperacao, type Ativo, type Classe } from '../../lib/invest/tipos'
import type { NovaOperacao } from '../../lib/useInvest'
import { registrarErro } from '../../lib/erros'
import { tx } from '../../lib/textos'
import { CampoData } from '../../components/Escolhas'
import { Icone } from '../../components/Icone'
import { Modal } from '../../components/ui'
import type { Ctx } from '../contexto'
import { type AcoesInvest } from './apoio'
import { fmtQtd } from './formatos'

type Passo = { em: 'escolher' } | { em: 'lendo' } | { em: 'previa'; lido: ArquivoLido & { hash: string }; nome: string } | { em: 'gravando' }
  | { em: 'pronto'; importadas: number; repetidas: number; pendentes: number; precos: number; ativos: number }

export function ImportarArquivo({ c, aoFechar, aoVerPendencias }: { c: Ctx; aoFechar: () => void; aoVerPendencias: () => void }) {
  const inv = c.invest.d
  const [passo, setPasso] = useState<Passo>({ em: 'escolher' })
  const [erro, setErro] = useState<string | null>(null)
  const [fora, setFora] = useState<Set<string>>(new Set())
  const [classes, setClasses] = useState<Record<string, Classe>>({})
  const [dataDaPosicao, setDataDaPosicao] = useState(hojeLocal())
  const arquivo = useRef<HTMLInputElement>(null)

  const ler = async (f: File) => {
    setErro(null)
    setPasso({ em: 'lendo' })
    try {
      const lido = await lerArquivoDeInvestimentos(f)
      if (!lido.linhas.length && !lido.posicoes.length && !lido.pendentes.length) {
        setPasso({ em: 'escolher' })
        return setErro(tx('Não encontrei operações nem posições nesse arquivo. O app lê os extratos de Movimentação, Negociação e Posição da B3 e planilhas com as colunas data, operação, ativo, quantidade, preço e valor.'))
      }
      if (lido.dataDaPosicao) setDataDaPosicao(lido.dataDaPosicao)
      setFora(new Set())
      setClasses({})
      setPasso({ em: 'previa', lido, nome: f.name.slice(0, 200) })
    } catch (e) {
      registrarErro(e, tx('invest importar'))
      setPasso({ em: 'escolher' })
      setErro(e instanceof Error ? e.message : tx('Não consegui ler esse arquivo.'))
    }
  }

  const previa: Previa | null = passo.em === 'previa' ? conciliar(passo.lido, inv.ativos, inv.operacoes, inv.precos, dataDaPosicao) : null
  const jaImportado = passo.em === 'previa' ? inv.importacoes.find((i) => i.hash === passo.lido.hash) : undefined
  const idDaLinha = (i: number) => `l${i}`
  const idDaPosicao = (i: number) => `p${i}`
  // repetido já vem desmarcado; o que só parece repetido também, para a pessoa decidir
  const marcada = (id: string, estado: string) => (estado === 'nova' ? !fora.has(id) : fora.has(`+${id}`))
  const alternar = (id: string, estado: string) => {
    const k = estado === 'nova' ? id : `+${id}`
    const n = new Set(fora)
    if (n.has(k)) n.delete(k)
    else n.add(k)
    setFora(n)
  }

  const gravar = async () => {
    if (passo.em !== 'previa' || !previa) return
    const { lido, nome } = passo
    if (lido.posicoes.length && (!dataDaPosicao || dataDaPosicao > hojeLocal())) return setErro(tx('Diga de que dia é a posição (não pode ser no futuro).'))
    const linhas = previa.linhas.map((l, i) => ({ ...l, id: idDaLinha(i) })).filter((l) => l.estado !== 'repetida' && marcada(l.id, l.estado))
    const posicoes = previa.posicoes.map((p, i) => ({ ...p, id: idDaPosicao(i) })).filter((p) => p.estado === 'nova' && marcada(p.id, p.estado))
    setPasso({ em: 'gravando' })
    try {
      // 1) os investimentos que ainda não existem (só os que têm alguma linha marcada)
      const precisa = new Set([...linhas.filter((l) => l.novoAtivo).map((l) => l.ativo), ...posicoes.filter((p) => p.novoAtivo).map((p) => p.ativo)])
      const criados = new Map<string, Ativo>()
      for (const n of previa.novosAtivos.filter((x) => precisa.has(x.id))) {
        const classe = classes[n.id] ?? n.classe
        const porValor = infoClasse(classe).porValor
        const a = await inv.addAtivo({
          nome: n.nome, codigo: porValor ? null : n.codigo, classe, subclasse: classe === 'renda_fixa' ? n.subclasse ?? 'outro' : null, por_valor: porValor,
          instituicao: n.instituicao, banco_id: null, moeda: null, emissor: n.emissor, setor: null, indexador: null, taxa: null, vencimento: porValor ? n.vencimento : null,
          liquidez: null, liquidez_dias: null, obs: null,
        })
        if (!a) throw new Error(tx('Não consegui criar {0}. Nada mais foi gravado.', n.codigo ?? n.nome))
        criados.set(n.id, a)
      }
      const ativoDe = (id: string) => criados.get(id) ?? inv.ativos.find((a) => a.id === id)
      // 2) o registro da importação, com o que não foi entendido e o que a pessoa deixou de fora
      const deixadas = previa.linhas.map((l, i) => ({ ...l, id: idDaLinha(i) })).filter((l) => l.estado === 'nova' && !marcada(l.id, l.estado))
      const pendentes = [...previa.pendentes, ...deixadas.map((l) => ({ onde: l.linha.onde, texto: l.linha.texto, motivo: tx('Você deixou esta linha de fora ao importar.') }))]
      const imp = await inv.addImportacao({ arquivo: nome, hash: lido.hash, formato: lido.formato, instituicao: lido.instituicao, linhas: lido.total, importadas: 0, repetidas: 0, pendentes })
      if (!imp) throw new Error(tx('Não consegui registrar a importação. Nenhuma operação foi gravada.'))
      // 3) as operações (o banco recusa as repetidas pela chave)
      const novas: NovaOperacao[] = []
      for (const l of linhas) {
        const a = ativoDe(l.ativo)
        if (!a) continue
        const x = l.linha
        novas.push({
          ativo_id: a.id, tipo: x.tipo, subtipo: x.subtipo, data: x.data, quantidade: a.por_valor ? null : x.quantidade, preco: a.por_valor ? null : x.preco, valor: x.valor,
          custos: x.custos, impostos: x.impostos, fator: null, moeda: null, cotacao: null, banco_id: null, mexe_saldo: false, lancamento_id: null,
          origem: 'importacao', importacao_id: imp.id, chave: x.chave, obs: null,
        })
      }
      let precos = 0
      for (const p of posicoes) {
        const a = ativoDe(p.ativo)
        if (!a) continue
        const x = p.posicao
        if (p.efeito === 'posicao-inicial') {
          novas.push({
            ativo_id: a.id, tipo: 'ajuste', subtipo: null, data: dataDaPosicao, quantidade: a.por_valor ? null : x.quantidade, preco: a.por_valor ? null : x.preco, valor: x.valor,
            custos: 0, impostos: 0, fator: null, moeda: null, cotacao: null, banco_id: null, mexe_saldo: false, lancamento_id: null,
            origem: 'posicao', importacao_id: imp.id, chave: p.chave, obs: tx('Posição inicial pelo arquivo: o custo de aquisição é o valor do dia, não o que você pagou.'),
          })
        } else {
          const natureza = !a.por_valor && x.preco !== null ? 'preco' as const : 'saldo' as const
          if (await inv.salvarPreco({ ativo_id: a.id, data: dataDaPosicao, natureza, valor: natureza === 'preco' ? x.preco! : x.valor, moeda: null, fonte: 'importacao' })) precos++
        }
      }
      const r = await inv.addOperacoes(novas)
      if (r.erro) throw new Error(r.erro)
      const repetidas = r.repetidas + previa.linhas.filter((l) => l.estado === 'repetida').length
      void inv.updImportacao(imp.id, { importadas: r.gravadas.length, repetidas })
      setPasso({ em: 'pronto', importadas: r.gravadas.length, repetidas, pendentes: pendentes.length, precos, ativos: criados.size })
    } catch (e) {
      registrarErro(e, tx('invest gravar importacao'))
      setErro(e instanceof Error ? e.message : String(e))
      setPasso({ em: 'previa', lido, nome })
      void inv.recarregar()
    }
  }

  const aGravar = previa
    ? previa.linhas.filter((l, i) => l.estado !== 'repetida' && marcada(idDaLinha(i), l.estado)).length + previa.posicoes.filter((p, i) => p.estado === 'nova' && marcada(idDaPosicao(i), p.estado)).length
    : 0
  return (
    <Modal titulo={tx('Importar investimentos')} aoFechar={aoFechar} tamanho="grande">
      <div className="inv-importar">
        {passo.em === 'escolher' && (
          <>
            <p>{tx('Traga as operações de uma vez, em vez de digitar uma a uma. O app lê:')}</p>
            <ul className="inv-vazio-passos">
              <li><Icone nome="check" tamanho={15} /> {tx('Extratos da B3 (Área do Investidor): Movimentação, Negociação e Posição, em Excel.')}</li>
              <li><Icone nome="check" tamanho={15} /> {tx('Planilha ou CSV com as colunas data, operação, ativo, quantidade, preço e valor.')}</li>
              <li><Icone nome="relogio" tamanho={15} /> {tx('PDF: leitura parcial. Só entra a linha que traz data, operação, código e valores juntos; o resto fica para você revisar.')}</li>
            </ul>
            <p className="inv-nota">{tx('Você confere tudo antes de gravar. O mesmo arquivo importado duas vezes não duplica nada, e o que o app não entender fica guardado, sem sumir.')}</p>
            {erro && <p className="form-erro">{erro}</p>}
            <div className="form-acoes">
              <button className="btn" onClick={aoFechar}>{tx('Cancelar')}</button>
              <button className="btn primario" onClick={() => arquivo.current?.click()}><Icone nome="importar" tamanho={16} /> {tx('Escolher o arquivo')}</button>
            </div>
            <input ref={arquivo} type="file" accept=".xlsx,.xls,.xlsm,.ods,.csv,.txt,.tsv,.pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void ler(f) }} />
          </>
        )}
        {(passo.em === 'lendo' || passo.em === 'gravando') && (
          <section className="inv-carregando" aria-busy="true"><span className="inv-carregando-barra" /><span>{passo.em === 'lendo' ? tx('Lendo o arquivo…') : tx('Gravando…')}</span></section>
        )}
        {passo.em === 'previa' && previa && (
          <>
            <p className="inv-previa-resumo">
              <b>{passo.nome}</b> · {passo.lido.formato}{passo.lido.instituicao ? ` · ${passo.lido.instituicao}` : ''}
            </p>
            {jaImportado && <div className="alerta inv-aviso" role="status"><span>{tx('Este mesmo arquivo já foi importado em {0}. O que já entrou aparece como repetido e não será gravado de novo.', fmtDataCurta(jaImportado.created_at.slice(0, 10)))}</span></div>}
            {previa.novosAtivos.length > 0 && (
              <section className="inv-previa-bloco">
                <h4>{previa.novosAtivos.length === 1 ? tx('1 investimento novo será criado') : tx('{0} investimentos novos serão criados', previa.novosAtivos.length)}</h4>
                <p className="inv-nota">{tx('Confira o tipo de cada um: o app só consegue deduzir pelo nome.')}</p>
                <ul className="inv-previa-ativos">
                  {previa.novosAtivos.map((n) => (
                    <li key={n.id}>
                      <span><b>{n.codigo ?? n.nome}</b>{n.codigo && <small>{n.nome}</small>}</span>
                      <select value={classes[n.id] ?? n.classe} onChange={(e) => setClasses({ ...classes, [n.id]: e.target.value as Classe })} aria-label={tx('Tipo de {0}', n.codigo ?? n.nome)}>
                        {CLASSES.map((x) => <option key={x.id} value={x.id}>{x.nome()}</option>)}
                      </select>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {previa.linhas.length > 0 && (
              <section className="inv-previa-bloco">
                <h4>{tx('Operações ({0})', previa.linhas.length)}</h4>
                <ul className="inv-previa-linhas">
                  {previa.linhas.map((l, i) => {
                    const id = idDaLinha(i)
                    const x = l.linha
                    const porValor = infoClasse(classes[l.ativo] ?? x.classe).porValor
                    return (
                      <li key={id} className={l.estado}>
                        <label>
                          <input type="checkbox" checked={l.estado !== 'repetida' && marcada(id, l.estado)} disabled={l.estado === 'repetida'} onChange={() => alternar(id, l.estado)} />
                          <span className="inv-op-data">{fmtDataCurta(x.data)}</span>
                          <span className="inv-op-texto">
                            <b>{nomeOperacao(x.tipo, porValor)} · {x.codigo ?? x.nome}</b>
                            <small>{[x.quantidade !== null && x.preco !== null ? `${fmtQtd(x.quantidade)} × ${fmtValor(x.preco)}` : null, x.onde,
                              l.estado === 'repetida' ? tx('já importada') : l.estado === 'parecida' ? tx('parece repetida: já existe uma operação igual') : null].filter(Boolean).join(' · ')}</small>
                            {l.aviso && <small className="inv-previa-aviso"><Icone nome="sino" tamanho={12} /> {l.aviso}</small>}
                          </span>
                          <b className="inv-op-valor">{fmtValor(x.valor)}</b>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
            {previa.posicoes.length > 0 && (
              <section className="inv-previa-bloco">
                <h4>{tx('Posição ({0})', previa.posicoes.length)}</h4>
                <label className="campo"><span className="campo-rotulo">{tx('A posição é de que dia?')}</span><CampoData valor={dataDaPosicao} aoMudar={setDataDaPosicao} rotulo={tx('Dia da posição')} max={hojeLocal()} obrigatorio /></label>
                <ul className="inv-previa-linhas">
                  {previa.posicoes.map((p, i) => {
                    const id = idDaPosicao(i)
                    const x = p.posicao
                    return (
                      <li key={id} className={p.estado}>
                        <label>
                          <input type="checkbox" checked={p.estado === 'nova' && marcada(id, p.estado)} disabled={p.estado === 'repetida'} onChange={() => alternar(id, p.estado)} />
                          <span className="inv-op-texto">
                            <b>{x.codigo ?? x.nome}</b>
                            <small>{p.estado === 'repetida' ? tx('já importada') : p.efeito === 'preco' ? tx('atualiza o valor deste investimento') : tx('cria o investimento com esta posição inicial (custo = valor do dia)')}</small>
                          </span>
                          <b className="inv-op-valor">{fmtValor(x.valor)}</b>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
            {previa.pendentes.length > 0 && (
              <section className="inv-previa-bloco">
                <h4>{previa.pendentes.length === 1 ? tx('1 linha não foi entendida') : tx('{0} linhas não foram entendidas', previa.pendentes.length)}</h4>
                <p className="inv-nota">{tx('Elas não entram agora, mas ficam guardadas em "linhas para revisar": você registra à mão ou descarta depois.')}</p>
                <ul className="inv-pendentes">
                  {previa.pendentes.slice(0, 30).map((p, i) => <li key={i}><small>{p.onde}</small><span>{p.texto}</span><em>{p.motivo}</em></li>)}
                </ul>
                {previa.pendentes.length > 30 && <p className="inv-nota">{tx('E mais {0}.', previa.pendentes.length - 30)}</p>}
              </section>
            )}
            {erro && <p className="form-erro">{erro}</p>}
            <div className="form-acoes">
              <button className="btn" onClick={() => { setErro(null); setPasso({ em: 'escolher' }) }}>{tx('Escolher outro arquivo')}</button>
              <button className="btn primario" disabled={!aGravar && !previa.pendentes.length} onClick={() => void gravar()}>
                {aGravar ? (aGravar === 1 ? tx('Importar 1 linha') : tx('Importar {0} linhas', aGravar)) : tx('Guardar só as pendentes')}
              </button>
            </div>
          </>
        )}
        {passo.em === 'pronto' && (
          <>
            <section className="inv-vazio pequeno">
              <span className="inv-vazio-icone"><Icone nome="check" tamanho={28} /></span>
              <h2>{tx('Importação concluída')}</h2>
              <ul className="inv-legenda larga">
                <li><span>{tx('Operações gravadas')}</span><b>{passo.importadas}</b></li>
                {passo.ativos > 0 && <li><span>{tx('Investimentos criados')}</span><b>{passo.ativos}</b></li>}
                {passo.precos > 0 && <li><span>{tx('Valores atualizados')}</span><b>{passo.precos}</b></li>}
                {passo.repetidas > 0 && <li><span>{tx('Repetidas, não gravadas de novo')}</span><b>{passo.repetidas}</b></li>}
                {passo.pendentes > 0 && <li><span>{tx('Guardadas para revisar')}</span><b>{passo.pendentes}</b></li>}
              </ul>
            </section>
            <div className="form-acoes">
              {passo.pendentes > 0 && <button className="btn" onClick={aoVerPendencias}>{tx('Revisar as pendentes')}</button>}
              <button className="btn primario" onClick={aoFechar}>{tx('Ver a carteira')}</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

/** As linhas que ficaram para revisar, por arquivo: registrar à mão (a linha some ao salvar) ou descartar, sempre por decisão da pessoa. */
export function Pendencias({ c, aoFechar, acoes }: { c: Ctx; aoFechar: () => void; acoes: AcoesInvest }) {
  const inv = c.invest.d
  const com = inv.importacoes.filter((i) => i.pendentes.length)
  const descartarTodas = async (id: string, n: number) => {
    if (await confirmar(tx('Descartar as {0} linhas pendentes deste arquivo? Elas saem da lista e não viram operação.', n), { titulo: tx('Descartar pendentes'), botao: tx('Descartar'), perigo: true })) void inv.updImportacao(id, { pendentes: [] })
  }
  return (
    <Modal titulo={tx('Linhas para revisar')} aoFechar={aoFechar} tamanho="grande">
      <div className="inv-importar">
        {!com.length && <p className="quadro-vazio">{tx('Nada pendente: tudo o que foi importado está resolvido.')}</p>}
        {com.map((imp) => (
          <section key={imp.id} className="inv-previa-bloco">
            <h4>{imp.arquivo} <small>{fmtDataCurta(imp.created_at.slice(0, 10))}</small></h4>
            <ul className="inv-pendentes">
              {imp.pendentes.map((p, i) => (
                <li key={`${p.onde}${i}`}>
                  <small>{p.onde}</small><span>{p.texto}</span><em>{p.motivo}</em>
                  <span className="inv-pendente-acoes">
                    <button className="btn" disabled={!inv.ativos.length} onClick={() => acoes.novaOperacao({ pendente: { importacaoId: imp.id, linha: p } })}><Icone nome="lapis" tamanho={14} /> {tx('Registrar à mão')}</button>
                    <button className="link" onClick={() => inv.resolverPendente(imp.id, p)}>{tx('Descartar')}</button>
                  </span>
                </li>
              ))}
            </ul>
            {imp.pendentes.length > 1 && <button className="link" onClick={() => void descartarTodas(imp.id, imp.pendentes.length)}>{tx('Descartar todas deste arquivo')}</button>}
          </section>
        ))}
        <div className="form-acoes"><button className="btn primario" onClick={aoFechar}>{tx('Fechar')}</button></div>
      </div>
    </Modal>
  )
}
