// Início do computador: a faixa do topo sempre verde com o selo do estado do mês, e a grade de cartões que se encaixam
// como bloquinhos (src/movel/GradeDoComputador.tsx). Confere: nenhum cartão em cima do outro nem fora da grade; no Arrumar,
// puxar o canto muda o tamanho ao vivo (o cartão segue o mouse, a lista ganha linhas, nada de tarefa longa travando a tela),
// o tamanho fica guardado depois de recarregar, arrastar um cartão para cima de outro troca os dois de lugar, as setas na
// alça mudam o tamanho e Delete volta ao de sempre; o resumo do mês largo põe os quatro números numa fileira.
// Uso (depois do build com fake.supabase.co do README desta pasta): node scripts/app-de-demonstracao/testar-grade-pc.cjs
// Com FOTOS=pasta, salva capturas.
const path = require('path')
const R = path.join(__dirname, '..', '..')
const { iniciar } = require(R + '/scripts/app-de-demonstracao/servidor-falso.cjs')
const demo = require(R + '/scripts/app-de-demonstracao/dados-de-demonstracao.cjs')
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA ') + m); if (!c) process.exitCode = 1 }
const esperar = (p, ms = 700) => p.waitForTimeout(ms)
const FOTOS = process.env.FOTOS
const foto = async (p, nome) => { if (FOTOS) await p.screenshot({ path: path.join(FOTOS, nome + '.png'), fullPage: true }) }

/** Os retângulos dos cartões, relativos à grade. */
const caixas = (p) => p.evaluate(() => {
  const g = document.querySelector('.widgets-pc').getBoundingClientRect()
  return [...document.querySelectorAll('.widgets-pc .widget-celula')].map((e) => {
    const b = e.getBoundingClientRect()
    return { id: e.dataset.cartao, x: b.left - g.left, y: b.top - g.top, w: b.width, h: b.height, gw: g.width, gh: g.height }
  })
})
const sobrepostos = (cs) => {
  const r = []
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
    const a = cs[i], b = cs[j]
    if (a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1) r.push(a.id + '×' + b.id)
  }
  return r
}
const foraDaGrade = (cs) => cs.filter((c) => c.x < -1 || c.x + c.w > c.gw + 1 || c.y + c.h > c.gh + 1).map((c) => c.id)
/** Linhas cortadas na borda: nos cartões de altura escolhida, toda linha visível tem de estar inteira dentro do corpo. */
const cortadas = (p) => p.evaluate(() => [...document.querySelectorAll('.widgets-pc .fixo .widget-corpo')].flatMap((c) => {
  const r = c.getBoundingClientRect()
  return [...c.children].filter((f) => getComputedStyle(f).visibility !== 'hidden').filter((f) => {
    const b = f.getBoundingClientRect()
    return b.bottom > r.bottom + 1 || b.right > r.right + 1 || b.left < r.left - 1
  }).map(() => c.closest('.widget-celula').dataset.cartao)
}))
const arrumacao = (p) => p.evaluate(() => {
  const k = Object.keys(localStorage).find((x) => x.startsWith('opuscash-celular-'))
  return k ? JSON.parse(localStorage.getItem(k)).inicio : null
})

;(async () => {
  for (const tema of ['escuro', 'claro']) {
    const t = await iniciar({ perfil: { ...demo.perfil, detalhe: 'detalhado', tema }, dados: demo.dados, porta: 4900 + Math.floor(Math.random() * 60), dpr: 1 })
    const p = t.page
    try {
      await p.setViewportSize({ width: 1440, height: 900 })
      await p.goto(t.url + '#/inicio'); await esperar(p, 2600)

      // ---------- a faixa do topo ----------
      const faixa = await p.evaluate(() => ({ t: document.querySelector('.faixa-pc')?.dataset.t, selo: document.querySelector('.faixa-pc .selo-do-mes')?.textContent ?? null }))
      ok(faixa.t === 'sobra', `${tema}: a faixa do topo fica no verde da marca (data-t=${faixa.t})`)
      ok(Boolean(faixa.selo), `${tema}: o estado do mês aparece escrito no selo ("${faixa.selo}")`)

      // ---------- a grade ----------
      let cs = await caixas(p)
      ok(cs.length >= 8, `${tema}: ${cs.length} cartões na grade`)
      ok(sobrepostos(cs).length === 0, `${tema}: nenhum cartão em cima de outro ${sobrepostos(cs).join(' ')}`)
      ok(foraDaGrade(cs).length === 0, `${tema}: nenhum cartão fora da grade ${foraDaGrade(cs).join(' ')}`)
      ok(await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${tema}: sem rolagem de lado`)
      const ev = cs.find((c) => c.id === 'evolucao'), rs = cs.find((c) => c.id === 'resumo-mes')
      ok(ev && rs && Math.abs(ev.y - rs.y) < 2 && Math.abs(ev.h - rs.h) < 2, `${tema}: o resumo do mês ao lado do gráfico, da mesma altura`)
      await foto(p, `grade-${tema}`)

      // ---------- Arrumar: puxar o canto ----------
      await p.getByRole('button', { name: 'Arrumar' }).click(); await esperar(p, 600)
      ok(await p.locator('.alca-tamanho').count() === cs.length, `${tema}: cada cartão ganha a alça do canto`)
      const antesContas = cs.find((c) => c.id === 'contas')
      const linhasAntes = await p.locator('[data-cartao="contas"] .linha-movel').count()
      const alca = p.locator('[data-cartao="contas"] .alca-tamanho')
      await alca.scrollIntoViewIfNeeded(); await esperar(p, 300)
      const b = await alca.boundingBox()
      await p.evaluate(() => {
        window.__longas = 0; window.__quadros = 0
        new PerformanceObserver((l) => { window.__longas += l.getEntries().filter((e) => e.duration > 50).length }).observe({ type: 'longtask', buffered: false })
        const conta = () => { window.__quadros++; if (document.documentElement.classList.contains('arrastando-cartao')) requestAnimationFrame(conta) }
        window.__contar = () => requestAnimationFrame(conta)
      })
      await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
      await p.mouse.down()
      await p.evaluate(() => window.__contar())
      const passos = 30
      let seguiu = true, preso = true, semCorteNoMeio = []
      const lugar0 = await p.locator('[data-cartao="contas"]').evaluate((e) => { const r = e.getBoundingClientRect(); return [r.left, r.top + scrollY] })
      for (let i = 1; i <= passos; i++) {
        await p.mouse.move(b.x + b.width / 2 + (i * 6), b.y + b.height / 2 + (i * 12))
        if (i % 5 === 0) {
          await esperar(p, 40)
          const r = await p.locator('[data-cartao="contas"]').evaluate((e) => { const q = e.getBoundingClientRect(); return [q.left, q.top + scrollY, q.width] })
          if (Math.abs(r[0] - lugar0[0]) > 1 || Math.abs(r[1] - lugar0[1]) > 1) preso = false
          if (i === 15) seguiu = Math.abs(r[2] - (antesContas.w + 90)) < 4
          semCorteNoMeio = semCorteNoMeio.concat(await cortadas(p))
        }
      }
      await esperar(p, 120)
      const noMeio = await p.evaluate(() => ({ longas: window.__longas, quadros: window.__quadros, vaga: getComputedStyle(document.querySelector('.vaga-do-cartao')).opacity }))
      await foto(p, `puxando-${tema}`)
      await p.mouse.up(); await esperar(p, 900)
      ok(seguiu, `${tema}: no meio do arrasto o cartão tem a largura do mouse (segue em px, sem esperar o encaixe)`)
      ok(preso, `${tema}: puxando o canto, o cartão não sai do lugar`)
      ok(semCorteNoMeio.length === 0, `${tema}: no meio do arrasto, nenhuma linha cortada na borda ${semCorteNoMeio.join(' ')}`)
      ok(noMeio.longas === 0, `${tema}: nenhuma tarefa longa (>50 ms) durante o arrasto (${noMeio.longas})`)
      ok(Number(noMeio.vaga) > 0.5, `${tema}: a vaga tracejada mostra onde o cartão vai encaixar`)
      cs = await caixas(p)
      const depoisContas = cs.find((c) => c.id === 'contas')
      ok(depoisContas.h > antesContas.h + 200 && depoisContas.w > antesContas.w + 40, `${tema}: o cartão Contas cresceu (${Math.round(antesContas.w)}×${Math.round(antesContas.h)} → ${Math.round(depoisContas.w)}×${Math.round(depoisContas.h)})`)
      const linhasDepois = await p.locator('[data-cartao="contas"]').evaluate((cel) => {
        const c = cel.getBoundingClientRect()
        return [...cel.querySelectorAll('.linha-movel')].filter((l) => { const r = l.getBoundingClientRect(); return r.height > 0 && r.right <= c.right + 1 && r.bottom <= c.bottom + 1 }).length
      })
      ok(linhasDepois > linhasAntes, `${tema}: mais alto, o cartão mostra mais contas (${linhasAntes} → ${linhasDepois})`)
      ok(sobrepostos(cs).length === 0 && foraDaGrade(cs).length === 0, `${tema}: depois de soltar, os outros se encaixaram sem sobrepor ${sobrepostos(cs).join(' ')}`)
      ok((await cortadas(p)).length === 0, `${tema}: depois de soltar, nenhuma linha cortada na borda ${(await cortadas(p)).join(' ')}`)

      // ---------- diminuir de novo: as linhas somem junto, inteiras ----------
      const b2 = await alca.boundingBox()
      await p.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2); await p.mouse.down()
      let cortesDiminuindo = [], alturasDiminuindo = []
      for (let i = 1; i <= 20; i++) {
        await p.mouse.move(b2.x + b2.width / 2 - i * 4, b2.y + b2.height / 2 - i * 17)
        if (i % 4 === 0) {
          await esperar(p, 30)
          cortesDiminuindo = cortesDiminuindo.concat(await cortadas(p))
          alturasDiminuindo.push(await p.locator('[data-cartao="contas"] .widget-corpo').evaluate((c) => [...c.children].filter((f) => getComputedStyle(f).visibility !== 'hidden').length))
        }
      }
      await p.mouse.up(); await esperar(p, 700)
      ok(cortesDiminuindo.length === 0, `${tema}: diminuindo, nenhuma linha cortada em nenhum momento`)
      ok(alturasDiminuindo[0] > alturasDiminuindo[alturasDiminuindo.length - 1], `${tema}: diminuindo, as linhas somem junto (${alturasDiminuindo.join(' → ')})`)
      ok((await cortadas(p)).length === 0, `${tema}: depois de diminuir, nada cortado`)
      // e cresce de novo para os testes seguintes
      const b3 = await alca.boundingBox()
      await p.mouse.move(b3.x + 17, b3.y + 17); await p.mouse.down()
      for (let i = 1; i <= 10; i++) await p.mouse.move(b3.x + 17 + i * 2, b3.y + 17 + i * 34)
      await p.mouse.up(); await esperar(p, 700)

      let a = await arrumacao(p)
      ok(a?.tamanhos?.contas?.l > 0 && a.tamanhos.contas.c > 0, `${tema}: o tamanho foi guardado (${JSON.stringify(a?.tamanhos?.contas)})`)

      // ---------- teclado na alça ----------
      const c0 = a.tamanhos.contas.c
      await alca.focus(); await p.keyboard.press('ArrowLeft'); await esperar(p, 700)
      a = await arrumacao(p)
      ok(a.tamanhos.contas.c === c0 - 1, `${tema}: seta para a esquerda estreita uma coluna (${c0} → ${a.tamanhos.contas.c})`)

      // ---------- arrastar para trocar de lugar ----------
      // tela alta: o cartão e o lugar de destino ficam os dois à vista
      await p.setViewportSize({ width: 1440, height: 3200 }); await p.evaluate(() => window.scrollTo(0, 0)); await esperar(p, 700)
      const ordemAntes = (await caixas(p)).map((c) => c.id)
      const para = p.locator('[data-cartao="evolucao"]')
      const bd = await p.locator('[data-cartao="ultimos"]').boundingBox(), bp = await para.boundingBox()
      await p.mouse.move(bd.x + bd.width / 2, bd.y + bd.height - 40)
      await p.mouse.down()
      for (let i = 1; i <= 25; i++) await p.mouse.move(bd.x + bd.width / 2 + ((bp.x + 60 - bd.x - bd.width / 2) * i) / 25, bd.y + bd.height - 40 + ((bp.y + 80 - bd.y - bd.height + 40) * i) / 25)
      await esperar(p, 400)
      await foto(p, `arrastando-${tema}`)
      await p.mouse.up(); await esperar(p, 900)
      a = await arrumacao(p)
      const ordem = a.ordem.filter((id) => ordemAntes.includes(id))
      ok(ordem.indexOf('ultimos') < ordem.indexOf('evolucao'), `${tema}: arrastar Últimos para cima do gráfico põe ele antes (${ordem.slice(0, 4).join(', ')})`)
      cs = await caixas(p)
      ok(sobrepostos(cs).length === 0 && foraDaGrade(cs).length === 0, `${tema}: depois de trocar, nada sobreposto`)
      await p.setViewportSize({ width: 1440, height: 900 }); await esperar(p, 500)

      // ---------- resumo largo ----------
      const ar = p.locator('[data-cartao="resumo-mes"] .alca-tamanho')
      await ar.focus()
      for (let i = 0; i < 6; i++) { await p.keyboard.press('ArrowRight'); await esperar(p, 250) }
      await esperar(p, 700)
      const colunasResumo = await p.locator('[data-cartao="resumo-mes"] .widget-resumo-grade').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)
      ok(colunasResumo === 4, `${tema}: o resumo do mês largo mostra os quatro números numa fileira (${colunasResumo} colunas)`)
      a = await arrumacao(p)
      ok(a.tamanhos['resumo-mes'] && a.tamanhos['resumo-mes'].l === undefined, `${tema}: esticar só para o lado não trava a altura (${JSON.stringify(a.tamanhos['resumo-mes'])})`)
      const rsAlto = (await caixas(p)).find((c) => c.id === 'resumo-mes')
      ok(rsAlto.h < 300, `${tema}: o resumo largo fica da altura do conteúdo (${Math.round(rsAlto.h)} px)`)
      // só para o lado com o mouse: também não trava
      const ag = p.locator('[data-cartao="gasto-mes"] .alca-tamanho')
      await ag.scrollIntoViewIfNeeded(); await esperar(p, 200)
      const qg = await ag.boundingBox()
      await p.mouse.move(qg.x + 17, qg.y + 17); await p.mouse.down()
      for (let i = 1; i <= 8; i++) await p.mouse.move(qg.x + 17 - i * 10, qg.y + 17 + (i % 2) * 3)
      await p.mouse.up(); await esperar(p, 700)
      a = await arrumacao(p)
      ok(a.tamanhos['gasto-mes'] && a.tamanhos['gasto-mes'].l === undefined, `${tema}: arrastar a alça só para o lado muda só a largura (${JSON.stringify(a.tamanhos['gasto-mes'])})`)

      // o Consultor e o Dinheiro guardado esticados para o lado e encolhidos (os dos prints): nada cortado
      for (const id of ['orientacao', 'guardado']) {
        const al = p.locator(`[data-cartao="${id}"] .alca-tamanho`)
        await al.scrollIntoViewIfNeeded(); await esperar(p, 200)
        const q = await al.boundingBox()
        await p.mouse.move(q.x + 17, q.y + 17); await p.mouse.down()
        for (let i = 1; i <= 12; i++) await p.mouse.move(q.x + 17 + i * 25, q.y + 17 - i * 5)
        const meio = await cortadas(p)
        await p.mouse.up(); await esperar(p, 700)
        ok(meio.length === 0 && (await cortadas(p)).length === 0, `${tema}: ${id} largo e baixo, nada cortado na borda`)
      }

      await p.getByRole('button', { name: 'Pronto' }).click(); await esperar(p, 600)
      ok((await cortadas(p)).length === 0, `${tema}: fora do Arrumar, nada cortado na borda`)
      await foto(p, `arrumada-${tema}`)

      // ---------- recarregar ----------
      const antesDeRecarregar = (await caixas(p)).map((c) => `${c.id}:${Math.round(c.w)}x${Math.round(c.h)}`).sort().join()
      await p.reload(); await esperar(p, 2600)
      const depoisDeRecarregar = (await caixas(p)).map((c) => `${c.id}:${Math.round(c.w)}x${Math.round(c.h)}`).sort().join()
      ok(antesDeRecarregar === depoisDeRecarregar, `${tema}: depois de recarregar, os tamanhos continuam`)

      // ---------- Delete volta ao de sempre ----------
      await p.getByRole('button', { name: 'Arrumar' }).click(); await esperar(p, 500)
      await p.locator('[data-cartao="contas"] .alca-tamanho').focus(); await p.keyboard.press('Delete'); await esperar(p, 700)
      a = await arrumacao(p)
      ok(!a.tamanhos?.contas, `${tema}: Delete na alça volta o cartão ao tamanho de sempre`)

      // ---------- janela mais estreita ----------
      await p.setViewportSize({ width: 1000, height: 800 }); await esperar(p, 900)
      cs = await caixas(p)
      ok(sobrepostos(cs).length === 0 && foraDaGrade(cs).length === 0, `${tema}: a 1000 px, nada sobreposto nem fora`)
      ok(await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${tema}: a 1000 px, sem rolagem de lado`)
    } catch (e) {
      ok(false, `${tema}: ${e.message.split('\n')[0]}`)
      await foto(p, `erro-${tema}`)
    }
    await t.fechar()
  }
})()
