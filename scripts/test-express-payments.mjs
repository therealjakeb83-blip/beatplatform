// Vérifie les 8 combinaisons de la table de vérité du paiement express.
// Lance avec : node scripts/test-express-payments.mjs
// (Aucun framework de test dans ce repo — script autonome, importe
// directement la fonction réelle grâce au support TS natif de Node.)

import assert from 'node:assert/strict'
import { selectExpressPaymentMethods } from '../app/[slug]/_lib/express-payments.ts'

const cas = [
  { applePayAvailable: true, googlePayAvailable: true, paypalAvailable: true, attendu: ['apple_pay', 'paypal'] },
  { applePayAvailable: true, googlePayAvailable: true, paypalAvailable: false, attendu: ['apple_pay'] },
  { applePayAvailable: true, googlePayAvailable: false, paypalAvailable: true, attendu: ['apple_pay', 'paypal'] },
  { applePayAvailable: true, googlePayAvailable: false, paypalAvailable: false, attendu: ['apple_pay'] },
  { applePayAvailable: false, googlePayAvailable: true, paypalAvailable: true, attendu: ['google_pay', 'paypal'] },
  { applePayAvailable: false, googlePayAvailable: true, paypalAvailable: false, attendu: ['google_pay'] },
  { applePayAvailable: false, googlePayAvailable: false, paypalAvailable: true, attendu: ['paypal'] },
  { applePayAvailable: false, googlePayAvailable: false, paypalAvailable: false, attendu: [] },
]

let echecs = 0

for (const { attendu, ...dispo } of cas) {
  const resultat = selectExpressPaymentMethods(dispo)
  try {
    assert.deepEqual(resultat, attendu)
    console.log(`OK   ${JSON.stringify(dispo)} -> [${resultat.join(', ')}]`)
  } catch {
    echecs++
    console.error(`FAIL ${JSON.stringify(dispo)} -> [${resultat.join(', ')}] (attendu [${attendu.join(', ')}])`)
  }

  // Garde-fous explicites demandés : jamais Apple + Google ensemble, jamais
  // plus de 2 méthodes, Google seulement si Apple indisponible.
  assert.ok(resultat.length <= 2, 'jamais plus de 2 méthodes')
  assert.ok(!(resultat.includes('apple_pay') && resultat.includes('google_pay')), 'jamais Apple + Google ensemble')
  if (resultat.includes('google_pay')) assert.equal(dispo.applePayAvailable, false, 'Google Pay uniquement si Apple Pay indisponible')
}

if (echecs > 0) {
  console.error(`\n${echecs}/${cas.length} cas en échec`)
  process.exit(1)
}
console.log(`\n${cas.length}/${cas.length} cas OK`)
