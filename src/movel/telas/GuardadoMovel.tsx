/**
 * Dinheiro guardado no celular: o topo desliza do total (bancos, investimentos e outras moedas) para uma página por banco,
 * na cor dele. Ações: novo banco, "Continua igual" (saldos herdados), investimentos e metas. Embaixo: os bancos (tocar abre
 * o banco, com conta, caixinha e reserva para atualizar e os lançamentos do mês), a reserva de emergência, como o total tem
 * mudado e os investimentos e outras moedas. Contas e peças vêm de pages/Patrimonio.tsx (`useGuardado`), as mesmas do
 * computador.
 */
import { useState } from 'react'
import { BancoIcone } from '../../components/BancoIcone'
import { IconeCategoria } from '../../components/IconeCategoria'
import { Icone } from '../../components/Icone'
import { Colunas } from '../../components/Vitrine'
import { caixaDoBanco } from '../../lib/calc'
import { SEM_CATEGORIA } from '../../lib/categorias'
import { fmtDataCurta, fmtValor, mesEAno, MESES_CURTO, noMeioDaFrase } from '../../lib/format'
import { fmtCurto } from '../../lib/visuais'
import { tx } from '../../lib/textos'
import type { Banco } from '../../lib/types'
import { CartoesDoBanco, ExtrasDoGuardado, FormBanco, ReservaDeEmergencia, SaldosDoBanco, useGuardado } from '../../pages/Patrimonio'
import type { Ctx } from '../../pages/contexto'
import { BotoesDeAcao, CarrosselDeDicas, CartaoWidget, HeroDeslizante, IconeRedondo, LinhaDeLista, type Acao, type Dica, type PaginaDoHero } from '../primitivas'
import type { Tom } from '../tom'

const SEM_BANCO = 'sem'

export function GuardadoMovel({ c, aoMudarTom }: { c: Ctx; aoMudarTom: (t: Tom, cor?: string) => void }) {
  const { v } = c
  const g = useGuardado(c)
  const { bancos, caixa, herdado, confirmar, lancsDe, soma, semBanco, total, anterior, janela, tendencia } = g
  const [aberto, setAberto] = useState<string | null>(c.bancoAberto)
  const [gerenciar, setGerenciar] = useState<Banco | 'novo' | null>(null)
  const nivel = c.perfil.detalhe
  const dicaHerdado: Dica[] = herdado ? [{
    id: 'herdado', icone: 'calendario', titulo: tx('Os saldos vêm de {0}.', mesEAno(herdado[0], herdado[1])),
    texto: tx('Se nada mudou, confirme; se mudou, toque no banco e edite.'), botao: { texto: tx('Continua igual'), acao: confirmar },
  }] : []

  // ---------- um banco aberto ----------
  if (aberto) {
    const banco = bancos.find((b) => b.id === aberto)
    const ls = lancsDe(aberto).sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''))
    const ent = soma(ls, 'entrada')
    const sai = soma(ls, 'saida')
    const pagina: PaginaDoHero = banco
      ? { id: banco.id, tom: 'cor', cor: banco.cor, rotulo: banco.nome, valor: fmtValor(caixaDoBanco(caixa, banco.id)), sub: tx('Entrou {0} · saiu {1}', fmtValor(ent), fmtValor(sai)) }
      : { id: SEM_BANCO, tom: 'guardado', rotulo: tx('Lançamentos sem banco'), valor: fmtValor(ent - sai), sub: tx('Entrou {0} · saiu {1}', fmtValor(ent), fmtValor(sai)) }
    return (
      <div className="pagina guardado-movel">
        <HeroDeslizante key={aberto} paginas={[pagina]} aoMudar={(p) => aoMudarTom(p.tom, p.cor)} />
        <BotoesDeAcao acoes={[
          { id: 'voltar', icone: 'esq', rotulo: tx('Todos'), acao: () => setAberto(null) },
          ...(banco ? [{ id: 'editar', icone: 'lapis', rotulo: tx('Editar banco'), acao: () => setGerenciar(banco) }] : []),
          ...(banco && herdado ? [{ id: 'igual', icone: 'check', rotulo: tx('Continua igual'), acao: confirmar }] : []),
        ]} />
        {banco && <CarrosselDeDicas dicas={dicaHerdado} />}
        <div className="widgets-movel pecas-do-computador">
          {banco && <SaldosDoBanco c={c} g={g} banco={banco} />}
          {banco && <CartoesDoBanco c={c} banco={banco} />}
          <CartaoWidget titulo={ls.length === 1 ? tx('1 lançamento') : tx('{0} lançamentos', ls.length)}>
            {ls.length ? ls.map((l) => {
              const k = c.categoriaDe(l) ?? SEM_CATEGORIA
              return (
                <LinhaDeLista key={l.id} icone={<IconeRedondo cor={k.cor}><IconeCategoria emoji={k.icone} tamanho={20} /></IconeRedondo>}
                  titulo={l.descricao || (l.tipo === 'entrada' ? tx('Entrada') : tx('Saída'))} sub={[l.data ? fmtDataCurta(l.data) : null, k.nome].filter(Boolean).join(' · ')}
                  valor={`${l.tipo === 'entrada' ? '+' : '−'}${fmtValor(l.valor)}`} tomValor={l.tipo === 'entrada' ? 'entrada' : undefined}
                  aoTocar={() => c.editarLancamento(l)} />
              )
            }) : <p className="widget-vazio">{banco ? tx('Nenhum lançamento no {0} neste mês.', banco.nome) : tx('Nenhum lançamento sem banco neste mês.')}</p>}
          </CartaoWidget>
        </div>
        {gerenciar && <FormBanco c={c} banco={gerenciar === 'novo' ? undefined : gerenciar} aoFechar={() => setGerenciar(null)} aoExcluir={() => setAberto(null)} />}
      </div>
    )
  }

  // ---------- todos os bancos ----------
  const variacao = anterior > 0 && Math.abs(total - anterior) >= 0.01 && c.mes > 1
    ? (total > anterior
      ? tx('{0} a mais que em {1}', fmtValor(total - anterior), noMeioDaFrase(MESES_CURTO[c.mes - 2]))
      : tx('{0} a menos que em {1}', fmtValor(anterior - total), noMeioDaFrase(MESES_CURTO[c.mes - 2])))
    : undefined
  const paginas: PaginaDoHero[] = [
    { id: 'total', tom: 'guardado', rotulo: tx('Tudo o que você tem'), valor: fmtValor(total), sub: variacao ?? (total > 0 ? undefined : tx('Atualize os saldos abaixo para ver tudo junto aqui.')) },
    ...(v.bancos ? bancos.map((b) => {
      const ls = lancsDe(b.id)
      return {
        id: b.id, tom: 'cor' as const, cor: b.cor, rotulo: b.nome, valor: fmtValor(caixaDoBanco(caixa, b.id)),
        sub: tx('Entrou {0} · saiu {1}', fmtValor(soma(ls, 'entrada')), fmtValor(soma(ls, 'saida'))),
        pilula: { texto: tx('Ver o banco'), acao: () => setAberto(b.id) },
      }
    }) : []),
  ]
  const acoes: Acao[] = [
    ...(v.bancos ? [{ id: 'novo', icone: 'mais', rotulo: tx('Novo banco'), acao: () => setGerenciar('novo') }] : []),
    ...(herdado && v.bancos ? [{ id: 'igual', icone: 'check', rotulo: tx('Continua igual'), acao: confirmar }] : []),
    ...(v.investimentos ? [{ id: 'invest', icone: 'investir', rotulo: tx('Invest'), acao: () => c.irPara('invest') }] : []),
    ...(v.metas ? [{ id: 'metas', icone: 'meta', rotulo: tx('Metas'), acao: () => c.irPara('metas') }] : []),
  ]

  return (
    <div className="pagina guardado-movel">
      <HeroDeslizante paginas={paginas} aoMudar={(p) => aoMudarTom(p.tom, p.cor)} />
      {acoes.length > 0 && <BotoesDeAcao acoes={acoes} />}
      {v.bancos && <CarrosselDeDicas dicas={dicaHerdado} />}

      <div className="widgets-movel">
        {v.bancos && !bancos.length && (
          <CartaoWidget titulo={tx('Seu dinheiro guardado começa aqui')}>
            <p className="widget-nota">{tx('Bancos são opcionais: servem para ver cada um separado e guardar quanto tem em conta, caixinha e reserva.')}</p>
            <button className="btn primario" onClick={() => setGerenciar('novo')}><Icone nome="mais" tamanho={16} /> {tx('Adicionar o primeiro banco')}</button>
          </CartaoWidget>
        )}
        {v.bancos && (bancos.length > 0 || semBanco.length > 0) && (
          <CartaoWidget titulo={tx('Bancos')}>
            {bancos.map((b) => {
              const ls = lancsDe(b.id)
              return (
                <LinhaDeLista key={b.id} icone={<span className="icone-banco-movel"><BancoIcone nome={b.nome} cor={b.cor} tamanho={44} /></span>}
                  titulo={b.nome} sub={tx('Entrou {0} · saiu {1}', fmtValor(soma(ls, 'entrada')), fmtValor(soma(ls, 'saida')))}
                  valor={caixa[b.id] ? fmtValor(caixaDoBanco(caixa, b.id)) : tx('Não informado')}
                  aoTocar={() => setAberto(b.id)} />
              )
            })}
            {semBanco.length > 0 && (
              <LinhaDeLista icone={<IconeRedondo icone="carteira" />} titulo={tx('Sem banco')}
                sub={semBanco.length === 1 ? tx('1 lançamento') : tx('{0} lançamentos', semBanco.length)} aoTocar={() => setAberto(SEM_BANCO)} />
            )}
          </CartaoWidget>
        )}
        <div className="pecas-do-computador widgets-movel">
          {v.bancos && <ReservaDeEmergencia c={c} g={g} />}
        </div>
        {nivel !== 'simples' && tendencia.valores.filter((x) => x !== null).length > 1 && (
          <CartaoWidget titulo={tx('Como tem mudado')}>
            <div className="colunas-movel">
              <Colunas cor="var(--caixa)" altura={110} formato={fmtCurto}
                itens={janela.map((m, i) => ({ rotulo: noMeioDaFrase(MESES_CURTO[m - 1]).slice(0, 3), valor: Math.max(0, tendencia.valores[i] ?? 0), destaque: m === c.mes }))} />
            </div>
          </CartaoWidget>
        )}
        <div className="pecas-do-computador widgets-movel">
          <ExtrasDoGuardado c={c} g={g} />
        </div>
      </div>

      {gerenciar && <FormBanco c={c} banco={gerenciar === 'novo' ? undefined : gerenciar} aoFechar={() => setGerenciar(null)} />}
    </div>
  )
}
