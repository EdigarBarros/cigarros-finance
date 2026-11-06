/**
 * No app Android não existe "baixar arquivo" como no navegador. O arquivo é gravado no cache do app e abre o compartilhar
 * do Android, onde a pessoa escolhe: salvar no Drive, guardar em Arquivos, mandar no WhatsApp ou no e-mail.
 * Os plugins só são carregados aqui, no app (o site nunca chega a baixá-los).
 */
export async function compartilharArquivo(nome: string, base64: string, titulo: string) {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')])
  const { uri } = await Filesystem.writeFile({ path: nome, data: base64, directory: Directory.Cache })
  try {
    await Share.share({ title: titulo, files: [uri] })
  } catch (e) {
    // fechar o compartilhar sem escolher nada não é erro
    if (/cancel/i.test(String((e as Error | undefined)?.message ?? e))) return
    throw e
  }
}
