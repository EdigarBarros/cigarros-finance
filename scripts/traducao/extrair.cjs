// Tira os textos em português do código e põe no lugar uma chamada tx('texto'), que devolve o texto em inglês ou em
// espanhol quando a pessoa escolhe um desses idiomas (src/lib/textos.ts). Os textos vão para src/i18n/traducoes.json,
// onde ficam as traduções. Os outros idiomas continuam com o tradutor do Google (src/lib/idioma.ts).
//
//   node scripts/traducao/extrair.cjs src/pages/Apresentacao.tsx src/components/Entrada.tsx   extrai e troca no código
//   node scripts/traducao/extrair.cjs --simular src/lib/x.ts                                     só mostra o que trocaria
//   node scripts/traducao/extrair.cjs --limpar $(grep -rl "tx(" src)                          também tira da lista o que ninguém usa
//   node scripts/traducao/extrair.cjs --faltando                                                lista o que falta traduzir
//
// O que vira tx(): texto entre tags do JSX (junto com os valores no meio dele: "Resumo de {mes}" vira
// tx('Resumo de {0}', mes)), os atributos que a pessoa lê (placeholder, title, aria-label, alt) e textos entre aspas que
// parecem frase (têm espaço, acento ou começam com maiúscula). Ficam de fora comparações (=== 'entrar'), nomes de classe,
// chaves e endereços. Confira a lista que o script imprime: o que não for texto de tela, desfaça à mão.
const ts = require('typescript')
const fs = require('fs')
const path = require('path')

const RAIZ = path.join(__dirname, '..', '..')
const ARQ_TRADUCOES = path.join(RAIZ, 'src', 'i18n', 'traducoes.json')
const IDIOMAS = ['en', 'es']
const ATRIBUTOS = new Set(['placeholder', 'title', 'aria-label', 'alt'])
const FUNCAO = 'tx'

const lerTraducoes = () => (fs.existsSync(ARQ_TRADUCOES) ? JSON.parse(fs.readFileSync(ARQ_TRADUCOES, 'utf8')) : {})
const gravarTraducoes = (t) => {
  fs.mkdirSync(path.dirname(ARQ_TRADUCOES), { recursive: true })
  fs.writeFileSync(ARQ_TRADUCOES, JSON.stringify(t, null, 2) + '\n')
}

if (process.argv[2] === '--faltando') {
  const t = lerTraducoes()
  const faltam = Object.entries(t).filter(([, v]) => IDIOMAS.some((i) => !v[i]))
  for (const [k, v] of faltam) console.log(JSON.stringify(k), IDIOMAS.filter((i) => !v[i]).join(','))
  console.log(`\n${faltam.length} de ${Object.keys(t).length} textos sem tradução completa`)
  process.exit(faltam.length ? 1 : 0)
}

const simular = process.argv.includes('--simular')
const limpar = process.argv.includes('--limpar')
const arquivos = process.argv.slice(2).filter((a) => !a.startsWith('--')).map((a) => path.resolve(a))
if (!arquivos.length) { console.error('Diga quais arquivos: node scripts/traducao/extrair.cjs src/pages/X.tsx'); process.exit(1) }

// o verificador de tipos diz se o valor no meio do texto é texto/número (entra no tx) ou um elemento (fica de fora)
const config = ts.getParsedCommandLineOfConfigFile(path.join(RAIZ, 'tsconfig.app.json'), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} })
const programa = ts.createProgram(arquivos, config.options)
const verificador = programa.getTypeChecker()

const ehFrase = (s) => {
  const x = s.trim()
  if (!/\p{L}/u.test(x)) return false
  if (/^(https?:|mailto:|data:)/.test(x) || /^[/#.][\w/#.?=&%-]*$/.test(x)) return false // endereço
  if (/^[A-Z0-9_]+$/.test(x)) return false // CONSTANTE, BRL
  if (/^[a-z0-9_.:/-]+$/.test(x)) return false // chave, classe, id
  if (/^[a-z][\w-]*\(/i.test(x)) return false // estilo: translate3d(…), scale(…)
  if (/\\|^\(\?/.test(x)) return false // expressão de busca (regex)
  // valor sozinho (R$ 1.800,00, − R$ 32,90, US$ 120,00, 11%): igual em qualquer idioma
  if (/^[-+−–]?\s?(?:[A-Z]{0,3}\$|[€£¥₹])?\s?[-+−–]?\s?\d[\d.,\s/%]*$/u.test(x)) return false
  return /\s|[À-ÿ…!?]/.test(x) || /^\p{Lu}[\p{Ll}-]/u.test(x)
}

const ehTextoOuNumero = (expr) => {
  const tipo = verificador.getTypeAtLocation(expr)
  const ok = (t) => (t.flags & (ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike)) !== 0
  return tipo.isUnion() ? tipo.types.every(ok) : ok(tipo)
}

// regra do JSX para espaços: quebras de linha e o recuo somem; espaço no meio da linha fica
const normalizarJsx = (texto) => {
  const linhas = texto.split(/\r?\n/)
  return linhas
    .map((l, i) => {
      if (i > 0) l = l.replace(/^\s+/, '')
      if (i < linhas.length - 1) l = l.replace(/\s+$/, '')
      return l
    })
    .filter((l, i) => l || i === 0 || i === linhas.length - 1)
    .join(' ')
}

const aspas = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')}'`
const chamada = (chave, valores = []) => `${FUNCAO}(${[aspas(chave), ...valores].join(', ')})`

const traducoes = lerTraducoes()
const novos = []
const revisar = [] // frases que o script não consegue montar sozinho
const vistos = new Set()
const registrar = (chave) => {
  vistos.add(chave)
  if (!traducoes[chave]) { traducoes[chave] = Object.fromEntries(IDIOMAS.map((i) => [i, ''])); novos.push(chave) }
}

for (const arquivo of arquivos) {
  const fonte = programa.getSourceFile(arquivo)
  const trocas = [] // { de, ate, texto }
  const trocar = (de, ate, texto) => trocas.push({ de, ate, texto })

  // o texto do JSX com os espaços das pontas (getText os pula)
  const bruto = (n) => fonte.text.slice(n.pos, n.end)

  const dentroDeTx = (n) => { for (let p = n.parent; p; p = p.parent) if (ts.isCallExpression(p) && p.expression.getText(fonte) === FUNCAO) return true; return false }

  // Filhos de um elemento JSX: junta texto + {valor} + texto numa frase só
  const filhosJsx = (filhos) => {
    let grupo = []
    const fechar = () => {
      const comTexto = grupo.some((n) => ts.isJsxText(n) && bruto(n).trim())
      if (comTexto) {
        let molde = ''
        const valores = []
        for (const n of grupo) {
          if (ts.isJsxText(n)) molde += normalizarJsx(bruto(n))
          else { molde += `{${valores.length}}`; valores.push(n.expression.getText(fonte)) }
        }
        const chave = molde.trim()
        // entre tags, qualquer palavra é texto de tela ("<em>infinitas</em> possibilidades"); só valores sozinhos ficam de fora
        const semValores = chave.replace(/\{\d+\}/g, '')
        if (/\p{L}/u.test(semValores) && (ehFrase(semValores) || /^[\p{L}\s,.;:!?…-]+$/u.test(semValores))) {
          registrar(chave)
          // os espaços das pontas ficam no código como estavam (fora do tx), então o JSX os trata do mesmo jeito
          const primeiro = grupo[0], ultimo = grupo[grupo.length - 1]
          const ini = ts.isJsxText(primeiro) ? primeiro.pos + (bruto(primeiro).length - bruto(primeiro).trimStart().length) : primeiro.getStart(fonte)
          const fim = ts.isJsxText(ultimo) ? ultimo.pos + bruto(ultimo).trimEnd().length : ultimo.getEnd()
          trocar(ini, fim, `{${chamada(chave, valores)}}`)
        }
      }
      // sem texto em volta, os valores do grupo ainda podem ter tx('…') dentro, que precisam ser registrados
      else grupo.forEach((n) => ts.isJsxExpression(n) && visitar(n.expression))
      grupo = []
    }
    for (const f of filhos) {
      if (ts.isJsxText(f)) grupo.push(f)
      else if (ts.isJsxExpression(f) && f.expression && !temFrase(f.expression) && ehTextoOuNumero(f.expression)) grupo.push(f)
      else { fechar(); if (f.kind !== ts.SyntaxKind.JsxText) visitar(f) }
    }
    fechar()
  }

  // atributos que a pessoa lê: os do HTML (placeholder, title…) e as props de texto dos nossos componentes (<Campo rotulo="…">)
  const atributoDeTexto = (a) => {
    const nome = a.name.getText(fonte)
    if (ATRIBUTOS.has(nome)) return true
    const tag = a.parent.parent.tagName?.getText(fonte) ?? ''
    return /^[A-Z]/.test(tag) && !/^(className|key|id|type|name|nome|icone|tipo|modo|variante|href|src|inicial|cor|tamanho|lado|formato)$/.test(nome)
  }

  // um valor com texto dentro ({ok ? 'Entrar' : 'Nova senha'}) não entra como valor de uma frase: os textos dele são traduzidos
  const temFrase = (n) => {
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && ehFrase(n.text)) return true
    if (ts.isTemplateExpression(n)) return true
    return !!ts.forEachChild(n, (c) => (temFrase(c) ? true : undefined))
  }

  const contextoProibido = (n) => {
    const p = n.parent
    if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isExternalModuleReference(p)) return true
    if ((ts.isPropertyAssignment(p) || ts.isPropertySignature(p) || ts.isPropertyDeclaration(p) || ts.isMethodDeclaration(p)) && p.name === n) return true
    if (ts.isLiteralTypeNode(p) || ts.isTypeNode(p)) return true
    if (ts.isBinaryExpression(p) && /^(===|!==|==|!=)$/.test(p.operatorToken.getText(fonte))) return true
    if (ts.isCaseClause(p) || ts.isElementAccessExpression(p)) return true
    if (ts.isNewExpression(p)) return true // new RegExp('…'), new Date('…')
    // linha marcada com // sem-tx: fica como está (nomes que o app usa para reconhecer dados, por exemplo)
    if (/\/\/\s*sem-tx/.test(fonte.text.split('\n')[fonte.getLineAndCharacterOfPosition(n.getStart(fonte)).line])) return true
    if (ts.isJsxAttribute(p)) return !atributoDeTexto(p)
    if (ts.isJsxExpression(p) && ts.isJsxAttribute(p.parent)) return !atributoDeTexto(p.parent)
    if (ts.isCallExpression(p) && /(^|\.)(console\.\w+|addEventListener|removeEventListener|querySelector(All)?|closest|matches|getElementById|setAttribute|getAttribute|matchMedia|getItem|setItem|removeItem|from|rpc|invoke|eq|select|order|channel|on|tx|t)$/.test(p.expression.getText(fonte))) return true
    return false
  }

  const visitar = (n) => {
    if (ts.isJsxElement(n) || ts.isJsxFragment(n)) {
      if (ts.isJsxElement(n)) visitar(n.openingElement)
      filhosJsx(n.children)
      return
    }
    if (ts.isJsxAttribute(n) && n.initializer && ts.isStringLiteral(n.initializer) && atributoDeTexto(n)) {
      const v = n.initializer.text
      if (ehFrase(v)) { registrar(v.trim()); trocar(n.initializer.getStart(fonte), n.initializer.getEnd(), `{${chamada(v.trim())}}`) }
      return
    }
    // tx('…') já escrito à mão: só registra o texto na lista
    if (ts.isCallExpression(n) && n.expression.getText(fonte) === FUNCAO && n.arguments[0] && ts.isStringLiteralLike(n.arguments[0])) {
      registrar(n.arguments[0].text)
      n.arguments.slice(1).forEach(visitar)
      return
    }
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && !dentroDeTx(n) && !contextoProibido(n)) {
      const nucleo = n.text.trim()
      // no "se/senão" ao lado de um texto que é traduzido, uma palavra solta também é texto (reneg ? 'acréscimo' : 'juros')
      const irmao = ts.isConditionalExpression(n.parent) && [n.parent.whenTrue, n.parent.whenFalse].some((o) => o !== n && (ts.isCallExpression(o) && o.expression.getText(fonte) === FUNCAO || ts.isStringLiteralLike(o) && ehFrase(o.text)))
      if (nucleo && (ehFrase(nucleo) || (irmao && /^[\p{L}\s]+$/u.test(nucleo)))) {
        registrar(nucleo)
        // espaço nas pontas fica fora do tx: ' com os filtros' vira (' ' + tx('com os filtros'))
        const antes = n.text.slice(0, n.text.length - n.text.trimStart().length), depois = n.text.slice(n.text.trimEnd().length)
        trocar(n.getStart(fonte), n.getEnd(), antes || depois ? `(${[antes && aspas(antes), chamada(nucleo), depois && aspas(depois)].filter(Boolean).join(' + ')})` : chamada(nucleo))
        return
      }
    }
    if (ts.isTemplateExpression(n) && !dentroDeTx(n) && !contextoProibido(n) && n.templateSpans.some((sp) => temFrase(sp.expression))) {
      // frase montada com pedaços que também são texto (`${n} ${n === 1 ? 'conta' : 'contas'} atrasadas`): à mão
      revisar.push(`${path.relative(RAIZ, arquivo)}:${fonte.getLineAndCharacterOfPosition(n.getStart(fonte)).line + 1}  ${n.getText(fonte).slice(0, 140)}`)
    }
    if (ts.isTemplateExpression(n) && !dentroDeTx(n) && !contextoProibido(n) && !n.templateSpans.some((sp) => temFrase(sp.expression))) {
      let molde = n.head.text
      const valores = []
      n.templateSpans.forEach((s, i) => { molde += `{${i}}` + s.literal.text; valores.push(s.expression.getText(fonte)) })
      if (ehFrase(molde.replace(/\{\d+\}/g, '')) && molde === molde.trim() && !/[<>{}]\s*$/.test(n.head.text)) {
        registrar(molde); trocar(n.getStart(fonte), n.getEnd(), chamada(molde, valores)); return
      }
    }
    ts.forEachChild(n, visitar)
  }
  ts.forEachChild(fonte, visitar)

  if (!trocas.length) { console.log(`${path.relative(RAIZ, arquivo)}: nada a trocar`); continue }
  if (simular) {
    for (const { de, texto } of trocas.sort((a, b) => a.de - b.de)) console.log(`${path.relative(RAIZ, arquivo)}:${fonte.getLineAndCharacterOfPosition(de).line + 1}  ${texto}`)
    continue
  }
  let codigo = fonte.getFullText()
  for (const { de, ate, texto } of trocas.sort((a, b) => b.de - a.de)) codigo = codigo.slice(0, de) + texto + codigo.slice(ate)
  if (!new RegExp(`import \\{[^}]*\\b${FUNCAO}\\b[^}]*\\} from`).test(codigo)) {
    let rel = path.relative(path.dirname(arquivo), path.join(RAIZ, 'src', 'lib', 'textos')).replace(/\\/g, '/')
    if (!rel.startsWith('.')) rel = './' + rel
    const ultimoImport = [...codigo.matchAll(/^import .*$/gm)].pop()
    const pos = ultimoImport ? ultimoImport.index + ultimoImport[0].length + 1 : 0
    codigo = codigo.slice(0, pos) + `import { ${FUNCAO} } from '${rel}'\n` + codigo.slice(pos)
  }
  fs.writeFileSync(arquivo, codigo)
  console.log(`${path.relative(RAIZ, arquivo)}: ${trocas.length} textos`)
}

if (revisar.length) console.log(`\nFrases para acertar à mão (montadas com pedaços de texto):\n  ${revisar.join('\n  ')}\n`)
if (simular) process.exit(0)
if (limpar) {
  const sobras = Object.keys(traducoes).filter((k) => !vistos.has(k))
  for (const k of sobras) delete traducoes[k]
  console.log(`${sobras.length} textos sem uso tirados da lista`)
}
gravarTraducoes(traducoes)
console.log(`\n${novos.length} textos novos em src/i18n/traducoes.json:`)
for (const k of novos) console.log('  ' + JSON.stringify(k))
