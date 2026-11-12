process.env.UNSUBSCRIBE_SECRET = 'secret-de-test-local'
const { lireEmailCookieAbonne, valeurCookieAbonne, nomCookieAbonne } = await import('../lib/cookie-abonne.ts')
const jar = (v?: string) => ({ get: (n: string) => (n === nomCookieAbonne('jakeb-test') && v !== undefined ? { value: v } : undefined) })
const ok = valeurCookieAbonne('jakeb-test', 'Lea@Exemple.com')
const cas: [string, string | undefined, string | null][] = [
  ['absent', undefined, null],
  ['email en clair (ancien format / fabriqué)', 'lea@exemple.com', null],
  ['signé valide', ok, 'lea@exemple.com'],
  ['signé pour une autre boutique', valeurCookieAbonne('autre-boutique', 'lea@exemple.com'), null],
  ['email remplacé, même signature', Buffer.from('victime@x.com').toString('base64url') + ok.slice(ok.lastIndexOf('.')), null],
  ['signature modifiée', ok.slice(0, -1) + (ok.endsWith('0') ? '1' : '0'), null],
  ['signature tronquée', ok.slice(0, -5), null],
  ['vide après le point', ok.slice(0, ok.lastIndexOf('.') + 1), null],
  ['n importe quoi', '...', null],
]
let echecs = 0
for (const [nom, v, attendu] of cas) {
  const r = lireEmailCookieAbonne(jar(v), 'jakeb-test')
  const bon = r === attendu
  if (!bon) echecs++
  console.log(bon ? 'OK ' : 'ÉCHEC', nom, '→', r)
}
process.env.UNSUBSCRIBE_SECRET = 'autre-secret'
const r2 = lireEmailCookieAbonne(jar(ok), 'jakeb-test')
console.log(r2 === null ? 'OK ' : 'ÉCHEC', 'secret différent →', r2); if (r2 !== null) echecs++
console.log(echecs === 0 ? 'TOUT BON' : `${echecs} échec(s)`)
