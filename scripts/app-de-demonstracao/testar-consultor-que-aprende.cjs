// O consultor que aprende (lib/jurosAprendido.ts, lib/sinais.ts, lib/naHora.ts): o plano do mês no topo do Consultor e
// o atalho na Início; o jeito de falar (gentil, direto, sem filtro) muda o chamado; conferir com o banco pergunta qual
// número é, grava a pista (migração 44), mostra "O que aprendi com o banco" e troca a regra só com confirmação; o consultor
// fala na hora de parcelar no cartão. No celular: o plano no topo e sem rolagem para o lado. Nada pode dar erro na página.
// Uso (depois do build com fake.supabase.co do README desta pasta): node scripts/app-de-demonstracao/testar-consultor-que-aprende.cjs
// Com FOTOS=pasta, salva capturas.
const path = require('path')
const R = path.join(__dirname, '..', '..')
const { iniciar } = require(R + '/scripts/app-de-demonstracao/servidor-falso.cjs')
const demo = require(R + '/scripts/app-de-demonstracao/dados-de-demonstracao.cjs')
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA ') + m); if (!c) process.exitCode = 1 }
const esperar = (p, ms = 700) => p.waitForTimeout(ms)
const FOTOS = process.env.FOTOS
const foto = async (p, nome, inteira = false) => { if (FOTOS) await p.screenshot({ path: path.join(FOTOS, nome + '.png'), fullPage: inteira }) }
const pad = (n) => String(n).padStart(2, '0')
const dia = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const diasAtras = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return dia(d) }

/** A Marina com uma dívida nova da semana passada (o Empréstimo pessoal cobra 4,2% ao mês) e uma conferência de 10 dias atrás. */
function dados() {
  const d = structuredClone(demo.dados)
  const uid = d.bancos[0].user_id
  d.dividas.push({ id: 'd-0009-4000-8000-000000000000', user_id: uid, descricao: 'Crédito da loja', valor_parcela: 150, sentido: 'devo', pessoa: 'Loja', inicio: diasAtras(-20), total_parcelas: 6, moeda: null, created_at: `${diasAtras(5)}T10:00:00Z` })
  d.divida_saldos.push({ id: 'ds-0009', user_id: uid, divida_id: 'd-0009-4000-8000-000000000000', data: diasAtras(5), saldo: 900 })
  d.divida_conferencias = [{ id: 'cf-1', user_id: uid, divida_id: 'd-0002-4000-8000-000000000000', data: diasAtras(10), antes: 100, depois: 100, origem: 'conferir', juros_estimado: 0, qual_valor: 'total', created_at: `${diasAtras(10)}T10:00:00Z` }]
  return d
}

;(async () => {
  for (const tema of ['escuro', 'claro']) {
    const t = await iniciar({ perfil: { ...demo.perfil, detalhe: 'equilibrado', tema }, dados: dados(), porta: 5000 + Math.floor(Math.random() * 60), dpr: 1 })
    const p = t.page
    const erros = []
    p.on('pageerror', (e) => erros.push(e.message))
    await p.addInitScript((x) => { try { localStorage.setItem('opuscash-tema', x) } catch { /* */ } }, tema)
    try {
      // ---------- Consultor no computador ----------
      await p.setViewportSize({ width: 1440, height: 900 })
      await p.goto(t.url + '#/analise'); await esperar(p, 2600)
      const ordem = await p.evaluate(() => {
        const pj = document.querySelector('.pj-cartao'), m = document.querySelector('.an-manchete')
        return Boolean(pj && m && (pj.compareDocumentPosition(m) & Node.DOCUMENT_POSITION_FOLLOWING))
      })
      ok(ordem, `${tema}: o plano do mês vem antes da manchete do Consultor`)
      ok(await p.locator('.pj-cartao.destaque').count() === 1, `${tema}: o cartão do plano está em destaque`)
      ok(await p.locator('.an-firmeza').count() === 1, `${tema}: "Como eu falo com você" aparece`)
      const chamado = async () => (await p.locator('.vis-chamado').allTextContents()).join(' | ')
      const direto = await chamado()
      ok(direto.length > 0, `${tema}: as descobertas novas trazem o chamado (${direto.slice(0, 90)}…)`)
      await p.locator('.an-firmeza button', { hasText: 'Sem filtro' }).click(); await esperar(p, 900)
      const semFiltro = await chamado()
      ok(semFiltro !== direto && semFiltro.includes('Marina,'), `${tema}: "Sem filtro" muda o chamado e chama pelo nome`)
      const titulos = await p.locator('.peca h3').allTextContents()
      ok(titulos.slice(0, 3).includes('Dívida nova em cima de dívida'), `${tema}: "Dívida nova em cima de dívida" está entre os primeiros cartões (${titulos.slice(0, 4).join(' · ')})`)
      ok(t.db.perfis[0].consultor?.firmeza === 'sem-filtro', `${tema}: a escolha fica guardada na memória do consultor`)
      await foto(p, `${tema}-consultor`, true)

      // ---------- Início: o atalho abre o Consultor já com a mesa ----------
      await p.goto(t.url + '#/inicio'); await esperar(p, 1800)
      const faixa = p.locator('.dica-movel', { hasText: 'Planeje o mês' })
      ok(await faixa.count() === 1, `${tema}: a Início tem o atalho do plano do mês`)
      await faixa.getByRole('button', { name: 'Planejar o mês' }).click(); await esperar(p, 1600)
      ok(await p.locator('.pj-entrada').count() > 0, `${tema}: o atalho abre a mesa do Planejar o mês`)
      await p.keyboard.press('Escape'); await esperar(p, 600)

      // ---------- Dívidas: conferir com o banco e aprender ----------
      await p.goto(t.url + '#/dividas'); await esperar(p, 1500)
      await p.locator('.dv-cartao-corpo', { hasText: 'Empréstimo pessoal' }).first().click(); await esperar(p, 800)
      const ficha = p.getByRole('dialog')
      await ficha.getByRole('button', { name: 'Conferi com o banco' }).click(); await esperar(p, 400)
      ok(await ficha.locator('.dv-conferir-qual .segmentado').count() === 1, `${tema}: a conferência pergunta qual número o banco mostra`)
      const campo = ficha.locator('.dv-conferir input[inputmode="decimal"]')
      const estimado = await campo.inputValue()
      const n = Number(estimado.replace(/\./g, '').replace(',', '.'))
      ok(await ficha.getByRole('button', { name: 'Bateu com o banco' }).count() === 1, `${tema}: com o valor estimado, o botão diz "Bateu com o banco"`)
      await campo.fill(`${Math.round(n + 50)},00`)
      await ficha.getByRole('button', { name: 'Salvar valor do banco' }).click(); await esperar(p, 900)
      const gravada = t.db.divida_conferencias.find((c) => c.id !== 'cf-1')
      ok(gravada && gravada.qual_valor === 'total' && typeof gravada.juros_estimado === 'number' && 'dias_juros' in gravada, `${tema}: a conferência grava a pista dos juros (${JSON.stringify(t.db.divida_conferencias.map((c) => [c.id, c.qual_valor, c.juros_estimado, c.dias_juros]))})`)
      const aprendi = ficha.locator('.dv-aprendi')
      ok(await aprendi.count() === 1 && /por dia/.test(await aprendi.textContent()), `${tema}: "O que aprendi com o banco" mostra quanto cresce por dia`)
      await foto(p, `${tema}-aprendi`)
      await aprendi.getByRole('button', { name: 'Usar a taxa que calculei' }).click(); await esperar(p, 300)
      ok(!t.db.dividas.find((x) => x.id === 'd-0002-4000-8000-000000000000').atraso_juros_mes, `${tema}: a taxa não muda sem confirmar`)
      await aprendi.getByRole('button', { name: 'Trocar a regra' }).click(); await esperar(p, 700)
      ok(Number(t.db.dividas.find((x) => x.id === 'd-0002-4000-8000-000000000000').atraso_juros_mes) > 0, `${tema}: confirmando, a regra da dívida passa a ser a do banco`)
      await p.keyboard.press('Escape'); await esperar(p, 500)

      // ---------- na hora de parcelar no cartão ----------
      await p.goto(t.url + '#/cartoes'); await esperar(p, 1500)
      await p.locator('button', { hasText: 'Itaú Click' }).last().click(); await esperar(p, 900)
      await p.getByRole('button', { name: 'Nova compra' }).first().click(); await esperar(p, 700)
      const form = p.getByRole('dialog')
      await form.locator('input[inputmode="decimal"]').first().fill('1200,00')
      await form.locator('.campo', { hasText: 'Em quantas vezes?' }).locator('.escolha-gatilho').click(); await esperar(p, 300)
      await p.getByRole('option', { name: '6x', exact: true }).click()
      await esperar(p, 500)
      ok(await form.locator('.aviso-consultor').count() === 1, `${tema}: o consultor fala na hora de parcelar (${(await form.locator('.aviso-consultor').textContent().catch(() => '')).slice(0, 80)}…)`)
      await foto(p, `${tema}-parcelar`)
      await p.keyboard.press('Escape')

      // ---------- celular ----------
      await p.setViewportSize({ width: 390, height: 844 })
      await p.goto(t.url + '#/analise'); await esperar(p, 2400)
      ok(await p.locator('.consultor-movel .pj-cartao').count() === 1, `${tema}: no celular, o plano aparece no Consultor`)
      const largura = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      ok(largura <= 1, `${tema}: no celular, nada passa da largura da tela (${largura}px)`)
      await foto(p, `${tema}-celular`, true)
      ok(!erros.length, `${tema}: nenhum erro na página${erros.length ? ` (${erros.join(' | ')})` : ''}`)
    } catch (e) {
      ok(false, `${tema}: ${e.message}`)
    } finally {
      await t.fechar()
    }
  }
})()
