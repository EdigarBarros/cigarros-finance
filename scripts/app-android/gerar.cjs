// Gera do zero o projeto Android do OpusCash (pasta android/): o site aberto em tela cheia (Trusted Web Activity), montado
// com o Bubblewrap a partir do manifesto publicado em www.opuscash.com.br. Só é preciso para recriar o projeto (por exemplo,
// quando a Play Store passar a exigir um Android mais novo e sair Bubblewrap novo). Para lançar uma versão nova basta o
// android/ que já está no repositório: veja a seção "App Android" do README.
//
//   npm i --no-save @bubblewrap/core@1.27.0
//   node scripts/app-android/gerar.cjs /tmp/projeto-novo     depois compare com android/ e traga o que mudou
const { TwaManifest, TwaGenerator, ConsoleLog } = require('@bubblewrap/core')
const path = require('path')
const fs = require('fs')
;(async () => {
  const destino = path.resolve(process.argv[2])
  const url = new URL('https://www.opuscash.com.br/manifest.webmanifest')
  const web = await (await fetch(url)).json()
  const m = TwaManifest.fromWebManifestJson(url, web)
  Object.assign(m, {
    packageId: 'br.com.opuscash.app',
    host: 'www.opuscash.com.br',
    name: 'OpusCash',
    launcherName: 'OpusCash',
    startUrl: '/?app=android', // o site sabe que está no app sem depender do navegador (src/lib/appAndroid.ts)
    appVersionCode: 1,
    appVersionName: '1.0.0',
    enableNotifications: false,
    fallbackType: 'customtabs',
    signingKey: { path: './opuscash-upload.keystore', alias: 'opuscash' },
    generatorApp: 'bubblewrap-core',
    minSdkVersion: 24, // Android 7: o mínimo da biblioteca androidbrowserhelper 2.7
  })
  // cores: tudo no azul-escuro do app (barra de status, barra de navegação e abertura)
  const Color = require('color')
  for (const k of ['themeColor', 'themeColorDark', 'navigationColor', 'navigationColorDark', 'navigationDividerColor', 'navigationDividerColorDark', 'backgroundColor']) m[k] = new Color('#090d18')
  fs.mkdirSync(destino, { recursive: true })
  await new TwaGenerator().createTwaProject(destino, m, new ConsoleLog('gerar'))
  await m.saveToFile(path.join(destino, 'twa-manifest.json'))
  // o JCenter não existe mais: as bibliotecas vêm do Maven Central
  const raiz = path.join(destino, 'build.gradle')
  fs.writeFileSync(raiz, fs.readFileSync(raiz, 'utf8').replaceAll('jcenter()', 'mavenCentral()'))
  console.log('PRONTO', destino)
})().catch((e) => { console.error('FALHOU', e); process.exit(1) })
