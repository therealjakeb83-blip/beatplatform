// 9d lot 4 : tests publics en ligne (sans connexion) — pages légales et refus des routes.
const B = 'https://sonoo.app'
const FAUX = '00000000-0000-0000-0000-000000000000'
let ok = 0, ko = 0
const verif = (nom, cond, detail) => { if (cond) { ok++; console.log('OK ', nom) } else { ko++; console.log('KO ', nom, detail ?? '') } }
const get = async (url, init) => { const r = await fetch(url, { redirect: 'manual', ...init }); return { s: r.status, t: await r.text(), loc: r.headers.get('location') } }

let r = await get(`${B}/confidentialite`)
verif('sonoo.app/confidentialite ouverte malgré la maintenance (200)', r.s === 200, r.s)
verif('… parle du compte et de sa suppression', r.t.includes('Confidentialité du compte') && r.t.includes('supprimer toi-même'), '')
verif('… pas la page de maintenance', !/maintenance/i.test(r.t.slice(0, 3000)) || r.t.includes('Confidentialité du compte'))

for (const url of [`${B}/jakeb-test/confidentialite`, `https://jakeb-test.sonoo.app/confidentialite`, `${B}/nic-beat-2809/confidentialite`]) {
  r = await get(url, { redirect: 'follow' })
  verif(`${url} : 200 + bloc « Rôle de Sonoo »`, r.s === 200 && r.t.includes('Rôle de Sonoo') && r.t.includes('Ce que reçoit cette boutique'), r.s)
  verif(`… lien vers sonoo.app/confidentialite`, r.t.includes('https://sonoo.app/confidentialite'))
}
r = await get(`${B}/jakeb-test/cgv`, { redirect: 'follow' })
verif('CGV : pas de bloc (contenu prévu seulement pour Confidentialité)', r.s === 200 && !r.t.includes('Rôle de Sonoo'), r.s)

const json = { 'Content-Type': 'application/json' }
r = await get(`${B}/api/business/contacts/${FAUX}/effacer`, { method: 'POST', headers: json, body: JSON.stringify({ confirmation: 'EFFACER' }) })
verif('effacer sans connexion : 401', r.s === 401, r.s + ' ' + r.t.slice(0, 100))
r = await get(`${B}/api/business/contacts/${FAUX}/export`)
verif('exporter sans connexion : 401', r.s === 401, r.s)
r = await get(`${B}/api/artiste/supprimer-compte`, { method: 'POST', headers: json, body: JSON.stringify({ confirmation: 'SUPPRIMER' }) })
verif('supprimer le compte sans connexion : 401', r.s === 401, r.s)
r = await get(`${B}/api/artiste/supprimer-compte`, { method: 'POST', headers: { 'Content-Type': 'text/plain', Cookie: 'abo_jakeb-test=faux' }, body: '{"confirmation":"SUPPRIMER"}' })
verif('supprimer le compte avec un cookie d\'abonné seul : 401', r.s === 401, r.s)
r = await get(`${B}/dashboard/admin/clients/${FAUX}`)
verif('Admin sans connexion : renvoyé ailleurs', r.s >= 300 && r.s < 400 && !r.t.includes('Fiches dans les boutiques'), r.s + ' ' + r.loc)
r = await get(`${B}/mon-compte`)
verif('sonoo.app/mon-compte sans connexion : renvoie à la connexion', r.s >= 300 && r.s < 400, r.s + ' ' + r.loc)
console.log(`\n${ok} OK, ${ko} KO`)
