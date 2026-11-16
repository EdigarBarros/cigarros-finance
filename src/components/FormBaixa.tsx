import { useState } from 'react'
import { COR } from '../lib/charts'
import { dataDaBaixa, type SituacaoConta } from '../lib/contasFixas'
import { casasDaMoeda, mascarar, paraCampoMoeda } from '../lib/dinheiro'
import { fmtMoeda, fmtValor, MESES_NOME, noMeioDaFrase, parseNumero, simbolo } from '../lib/format'
import { cotacaoInvertida } from '../lib/moedas'
import { tx } from '../lib/textos'
import type { Ctx } from '../pages/contexto'
import { CampoCotacao } from './CampoCotacao'
import { CampoData } from './Escolhas'
import { EscolhaBanco } from './Formularios'
import { Modal } from './ui'

/**
 * "Paguei" / "Recebi" com o valor, o dia e o banco à vista para conferir (a conta de luz muda todo mês). Abre pelo lápis da
 * tela Contas do mês e pelo "Marcar como paga" da Início no jeito simples. A baixa vale só para este mês.
 */
export function FormBaixa({ c, s, aoFechar, conferir }: {
  c: Ctx; s: SituacaoConta; aoFechar: () => void
  /**
   * Aberto pelo "Marcar como paga" da Início do equilibrado: o botão diz "Marcar como paga" e, sem mudar valor, dia nem
   * banco, a baixa segue o caminho normal (que pergunta se um lançamento que já existe é o pagamento, em vez de lançar de novo).
   */
  conferir?: boolean
}) {
  const entrada = s.conta.tipo === 'entrada'
  const moeda = s.moeda ?? c.perfil.moeda
  const [valor, setValor] = useState(paraCampoMoeda(s.valorNativo, moeda))
  // a cotação combinada da conta (se houver) já vem preenchida; dá para trocar pela que valeu no dia do pagamento
  const [cotacao, setCotacao] = useState<number | null>(s.conta.cotacao ?? null)
  const dataInicial = dataDaBaixa(s.conta, c.ano, c.mes)
  const [data, setData] = useState(dataInicial)
  // o banco de costume da conta já vem marcado; trocar aqui muda só este pagamento
  const [bancoId, setBancoId] = useState(s.conta.banco_id ?? '')
  const comBancos = c.v.bancos && c.d.bancos.length > 0
  const [erro, setErro] = useState<string | null>(null)
  const mm = String(c.mes).padStart(2, '0')
  const ultimo = new Date(c.ano, c.mes, 0).getDate()

  const salvar = () => {
    const n = parseNumero(valor)
    if (!n || n <= 0) return setErro(tx('Informe um valor maior que zero.'))
    if (!data || data.slice(0, 7) !== `${c.ano}-${mm}`) return setErro(tx('Escolha uma data dentro de {0}.', noMeioDaFrase(MESES_NOME[c.mes - 1])))
    // campo de cotação vazio = a de hoje, a mesma que a tela mostra (senão cairia na combinada da conta sem ninguém ver)
    const taxa = s.moeda ? cotacao ?? c.taxas[s.moeda] : undefined
    if (s.moeda && !taxa) return setErro(tx('Não há cotação de hoje para {0}. Informe a cotação que você pagou.', s.moeda))
    if (s.moeda && cotacaoInvertida(taxa, s.moeda, c.perfil.moeda, c.taxas)) return setErro(tx('A cotação parece estar ao contrário (o valor ficaria centenas de vezes maior ou menor). Toque em “Desvirar” ou confira.'))
    if (conferir && !s.moeda && n === s.valorNativo && data === dataInicial && bancoId === (s.conta.banco_id ?? '')) c.pagarConta(s)
    else c.pagarConta(s, { valor: n, data, ...(comBancos ? { banco_id: bancoId || null } : {}), ...(s.moeda && taxa ? { cotacao: taxa } : {}) })
    aoFechar()
  }

  return (
    <Modal titulo={s.conta.descricao} aoFechar={aoFechar}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); salvar() }}>
        <label className="valor-grande" style={{ '--c': entrada ? COR.entradas : COR.saidas } as React.CSSProperties}>
          <span>{simbolo(moeda)}</span>
          <input autoFocus inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => { setValor(mascarar(e.target.value, casasDaMoeda(moeda))); setErro(null) }} aria-label={tx('Valor')} />
        </label>
        {s.moeda && (
          <div className="cotacao">
            <CampoCotacao moeda={s.moeda} principal={c.perfil.moeda} taxaDia={c.taxas[s.moeda]} valor={cotacao} aoMudar={(t) => { setCotacao(t); setErro(null) }} />
            <span className="campo-ajuda">
              {parseNumero(valor) && (cotacao ?? c.taxas[s.moeda]) ? <>≈ <b>{fmtValor(parseNumero(valor)! * (cotacao ?? c.taxas[s.moeda]))}</b> {tx('na sua moeda.')} </> : null}
              {s.conta.cotacao && cotacao === s.conta.cotacao ? tx('Cotação combinada na conta; troque se pagou por outra.') : cotacao ? tx('Cotação que você informou.') : c.taxas[s.moeda] ? tx('Cotação de hoje; troque se pagou por outra.') : tx('Sem cotação automática agora: informe a que você pagou.')}
            </span>
          </div>
        )}
        <label className="campo">
          <span className="campo-rotulo">{entrada ? tx('Dia em que recebeu') : tx('Dia em que pagou')}</span>
          <CampoData valor={data} aoMudar={setData} obrigatorio rotulo={entrada ? tx('Dia em que recebeu') : tx('Dia em que pagou')}
            min={`${c.ano}-${mm}-01`} max={`${c.ano}-${mm}-${String(ultimo).padStart(2, '0')}`} />
          <span className="campo-ajuda">{tx('O valor de costume é {0}. Aqui você muda só para este mês.', fmtMoeda(s.conta.valor, moeda))}</span>
        </label>
        {comBancos && (
          <EscolhaBanco bancos={c.d.bancos} valor={bancoId} aoMudar={setBancoId} aoNovoBanco={c.d.addBanco} />
        )}
        {erro && <p className="form-erro">{erro}</p>}
        <div className="form-acoes">
          <span className="espaco" />
          <button type="button" className="btn" onClick={aoFechar}>{tx('Cancelar')}</button>
          <button type="submit" className="btn primario">{conferir ? (entrada ? tx('Marcar como recebida') : tx('Marcar como paga')) : entrada ? tx('Recebi') : tx('Paguei')}</button>
        </div>
      </form>
    </Modal>
  )
}
