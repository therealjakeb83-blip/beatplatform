// Exécute le vrai PlayerProvider avec une horloge, un média et un serveur simulés.
// Aucun .env, appel réseau ou serveur Next nécessaire.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const { execFileSync } = require('node:child_process')
const fichier = 'app/[slug]/_components/PlayerContext.tsx'
const source = process.argv.includes('--avant')
  ? execFileSync('git', ['show', `89013a4:${fichier}`], { encoding: 'utf8' })
  : fs.readFileSync(fichier, 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText
const vider = async () => { for (let i = 0; i < 15; i++) await Promise.resolve() }

function monter() {
  let maintenant = Date.UTC(2026, 10, 20, 10), curseur = 0, valeur, effets = [], sale = false
  const cases = [], medias = [], demandes = [], document = new EventTarget()
  document.visibilityState = 'visible'
  document.referrer = ''
  let reponseRetardee = null, retarder = false, refuser = false
  const url = id => `https://stockage.invalid/${id}?X-Amz-Date=${new Date(maintenant).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}&X-Amz-Expires=3600`
  class Audio extends EventTarget {
    constructor() { super(); this.currentTime = 0; this.duration = 180; this.paused = true; this.error = null; this._src = ''; medias.push(this) }
    get src() { return this._src }
    set src(v) { this._src = v; this.currentTime = 0; this.error = null }
    removeAttribute() { this.src = '' }
    load() { this.currentTime = 0; queueMicrotask(() => this.dispatchEvent(new Event('loadedmetadata'))) }
    play() { if (!this.src) return Promise.reject(new Error('Pas de source')); this.paused = false; this.dispatchEvent(new Event('play')); return Promise.resolve() }
    pause() { this.paused = true; this.dispatchEvent(new Event('pause')) }
  }
  const identiques = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
  const react = {
    createContext: () => ({ Provider: 'provider' }), useContext: () => valeur,
    useState(initial) { const i = curseur++; if (!(i in cases)) cases[i] = initial; return [cases[i], v => { const n = typeof v === 'function' ? v(cases[i]) : v; if (!Object.is(n, cases[i])) { cases[i] = n; sale = true } }] },
    useRef(initial) { const i = curseur++; return cases[i] ??= { current: initial } },
    useCallback(fn, deps) { const i = curseur++; if (!identiques(cases[i]?.deps, deps)) cases[i] = { fn, deps }; return cases[i].fn },
    useEffect(fn, deps) { const i = curseur++; if (!identiques(cases[i]?.deps, deps)) { const avant = cases[i]; cases[i] = { deps }; effets.push(() => { avant?.cleanup?.(); cases[i].cleanup = fn() }) } },
  }
  const exports = {}
  const contexte = { exports, require: name => name === 'react' ? react : name === 'next/navigation' ? { usePathname: () => '/beats' } : { jsx: (_, props) => { valeur = props.value; return null } },
    Audio, URL, URLSearchParams, Date: class extends Date { static now() { return maintenant } },
    window: Object.assign(new EventTarget(), { location: { search: '', hostname: 'boutique.invalid' } }), document,
    sessionStorage: { getItem: () => 'direct' }, navigator: {}, Blob, console,
    fetch: async (_, opts) => {
      const { beatId } = JSON.parse(opts.body)
      demandes.push(beatId)
      if (retarder) await new Promise(r => { reponseRetardee = r })
      return { ok: !refuser, json: async () => ({ url: url(beatId) }) }
    },
  }
  vm.runInNewContext(code, contexte)
  function rendu() { do { sale = false; curseur = 0; exports.PlayerProvider({ children: null }); const suite = effets; effets = []; suite.forEach(f => f()) } while (sale) }
  rendu()
  return {
    get api() { return valeur }, get audio() { return medias[0] }, demandes, document,
    beat: id => ({ id, titre: id, image_url: null, mp3_tague_url: url(id) }),
    vieillir() { maintenant += 3_700_000 }, retarder() { retarder = true }, terminer() { retarder = false; reponseRetardee() }, refuser() { refuser = true },
    async agir(fn) { fn(); rendu(); await vider(); rendu() },
  }
}

;(async () => {
  for (const bouton of ['togglePlay', 'play']) {
    const t = monter(), beat = t.beat('a')
    await t.agir(() => t.api.play(beat, [beat]))
    t.audio.currentTime = 42
    t.audio.dispatchEvent(new Event('timeupdate'))
    await t.agir(() => t.api.togglePlay())
    t.vieillir()
    await t.agir(() => bouton === 'play' ? t.api.play(beat, [beat]) : t.api.togglePlay())
    assert.equal(t.demandes.length, 1, `${bouton} doit renouveler avant de reprendre`)
    assert.equal(t.audio.paused, false)
    assert.equal(t.audio.currentTime, 42)
    console.log(`OK : reprise expirée par ${bouton}, position conservée`)
  }
  const t = monter(), a = t.beat('a'), b = t.beat('b')
  await t.agir(() => t.api.play(a, [a, b]))
  await t.agir(() => t.api.togglePlay())
  t.vieillir(); t.retarder()
  await t.agir(() => t.api.togglePlay())
  await t.agir(() => t.api.togglePlay())
  await t.agir(() => t.terminer())
  assert.equal(t.audio.paused, true, 'Annuler doit empêcher la réponse tardive de relancer')
  console.log('OK : annulation pendant le renouvellement')
  t.vieillir(); t.retarder()
  await t.agir(() => t.api.togglePlay())
  await t.agir(() => t.api.play({ ...b, mp3_tague_url: 'https://stockage.invalid/b-neuf' }, [a, b]))
  await t.agir(() => t.terminer())
  assert.equal(t.audio.src, 'https://stockage.invalid/b-neuf', 'Une ancienne réponse ne doit pas remplacer le morceau suivant')
  assert.equal(t.audio.currentTime, 0)
  console.log('OK : changement de morceau pendant le renouvellement')
  await t.agir(() => t.api.togglePlay())
  t.vieillir()
  // Le lien non signé ci-dessus reste valide ; nouveau cas séparé pour le refus.
  const r = monter(), c = r.beat('c')
  await r.agir(() => r.api.play(c, [c]))
  await r.agir(() => r.api.togglePlay())
  r.vieillir(); r.refuser()
  await r.agir(() => r.api.togglePlay())
  assert.equal(r.audio.paused, true)
  console.log('OK : renouvellement refusé, aucune lecture')
  const v = monter(), d = v.beat('d')
  await v.agir(() => v.api.play(d, [d]))
  v.audio.currentTime = 35
  v.audio.dispatchEvent(new Event('timeupdate'))
  await v.agir(() => v.api.togglePlay())
  v.vieillir()
  await v.agir(() => v.document.dispatchEvent(new Event('visibilitychange')))
  assert.equal(v.demandes.length, 1)
  assert.equal(v.audio.paused, true, 'Revenir dans la page ne doit pas lancer la lecture')
  await v.agir(() => v.api.togglePlay())
  assert.equal(v.demandes.length, 1, 'Le lien préparé au retour doit être réutilisé')
  assert.equal(v.audio.currentTime, 35)
  console.log('OK : retour dans la page, lien préparé sans lecture automatique')
  v.audio.currentTime = 48
  v.audio.dispatchEvent(new Event('timeupdate'))
  v.audio.currentTime = 0
  v.audio.error = { code: 4 }
  await v.agir(() => v.audio.dispatchEvent(new Event('error')))
  assert.equal(v.audio.currentTime, 48)
  assert.equal(v.audio.paused, false)
  assert.equal(v.demandes.length, 2)
  console.log('OK : erreur média, renouvellement et dernière position conservée')
})().catch(e => { console.error(e); process.exitCode = 1 })
