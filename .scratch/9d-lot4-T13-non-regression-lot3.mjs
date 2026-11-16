// 9d lot 4, T13 : tests du lot 3 rejoués sur ecrire_fiche_boutique du lot 4
import fs from 'fs'
import { PGlite } from 'file:///C:/Users/nicoj/AppData/Local/Temp/claude/9ddd3c09bf8b3398/3c76a052-57bf-4101-95c2-a12bc74e999b/scratchpad/pg/node_modules/@electric-sql/pglite/dist/index.js'

// 9d lot 3, T2 : supabase/fiches_clients_lot3_ecriture.sql essayé sur une base
// Postgres locale avec de fausses données (tables réduites aux colonnes utiles).
const db = new PGlite()
const sansCR = s => s.split(String.fromCharCode(13)).join('')
const fonction = (f, debut) => { const t = sansCR(fs.readFileSync(f, 'utf8')); const i = t.indexOf(debut); return t.slice(i, t.indexOf('$$;', i) + 3) }
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE TABLE beatmakers (id uuid PRIMARY KEY);
CREATE TABLE clients (id uuid PRIMARY KEY, email text UNIQUE NOT NULL, nom text NOT NULL, prenom text, surnom text, nom_artiste text,
  telephone text, langue text, pays text, notes text, tags text[] NOT NULL DEFAULT '{}', instagram text, spotify text, youtube text, tiktok text,
  emails_secondaires text[] NOT NULL DEFAULT '{}', adresse text, ville text, code_postal text, fusionne_dans uuid REFERENCES clients(id));
CREATE TABLE leads (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  beatmaker_id uuid NOT NULL REFERENCES beatmakers(id), source text CHECK (source IN ('visite','newsletter','free_download','achat','manuel','import')),
  source_plateforme text, created_at timestamptz DEFAULT now(), newsletter_statut text NOT NULL DEFAULT 'non_inscrit', newsletter_statut_at timestamptz,
  newsletter_statut_source text, emails text[] NOT NULL DEFAULT '{}', telephones text[] NOT NULL DEFAULT '{}', adresses jsonb NOT NULL DEFAULT '[]',
  prenom text, nom text, nom_artiste text, pays text, langue text, premier_contact_le timestamptz, notes text, tags text[] NOT NULL DEFAULT '{}',
  surnom text, instagram text, spotify text, youtube text, tiktok text, champs_manuels text[] NOT NULL DEFAULT '{}', reconstruite_le timestamptz,
  UNIQUE (client_id, beatmaker_id), CONSTRAINT leads_adresses_liste CHECK (jsonb_typeof(adresses) = 'array'));
CREATE TABLE commandes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_id uuid REFERENCES clients(id), beatmaker_id uuid);
CREATE TABLE abonnements_boutique (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_id uuid REFERENCES clients(id) ON DELETE CASCADE, beatmaker_id uuid);
CREATE TABLE favoris (client_id uuid REFERENCES clients(id) ON DELETE CASCADE);
CREATE TABLE free_downloads (client_id uuid REFERENCES clients(id) ON DELETE CASCADE, beatmaker_id uuid);
CREATE TABLE licence_downloads (client_id uuid REFERENCES clients(id));
CREATE TABLE tentatives_paiement (client_id uuid REFERENCES clients(id));
CREATE TABLE morceaux_clients (client_id uuid REFERENCES clients(id) ON DELETE CASCADE, beatmaker_id uuid);
CREATE TABLE beat_plays (client_id uuid REFERENCES clients(id) ON DELETE SET NULL);
CREATE TABLE email_logs (client_id uuid REFERENCES clients(id) ON DELETE SET NULL);
CREATE TABLE listes_crm (id uuid PRIMARY KEY, beatmaker_id uuid);
CREATE TABLE listes_crm_contacts (liste_id uuid, client_id uuid);
CREATE TABLE doublons_ignores (client_id_1 uuid REFERENCES clients(id) ON DELETE CASCADE, client_id_2 uuid REFERENCES clients(id) ON DELETE CASCADE);
CREATE TABLE automatisation_evenements (client_id uuid REFERENCES clients(id) ON DELETE CASCADE);
CREATE TABLE automatisation_envois (client_id uuid REFERENCES clients(id) ON DELETE CASCADE);
CREATE TABLE campagne_envois (client_id uuid REFERENCES clients(id) ON DELETE CASCADE);
CREATE TABLE liste_membres (client_id uuid REFERENCES clients(id) ON DELETE CASCADE);
CREATE TABLE fusions_crm (beatmaker_id uuid, client_id_conserve uuid REFERENCES clients(id) ON DELETE CASCADE, client_id_archive uuid REFERENCES clients(id) ON DELETE CASCADE);
CREATE TABLE beats (id uuid PRIMARY KEY, beatmaker_id uuid); CREATE TABLE licences (id uuid PRIMARY KEY, beatmaker_id uuid);
CREATE TABLE imports_externes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), beatmaker_id uuid, plateforme text, nom_fichier text, nom_vendeur text, devise text,
  periode_debut timestamptz, periode_fin timestamptz, nb_rejetees int, nb_ecartees int, statut text DEFAULT 'importe', annule_at timestamptz,
  annulation_rapport jsonb, nb_commandes int, nb_lignes int, nb_contacts_crees int, total_depense numeric, total_depense_eur numeric);
CREATE TABLE commandes_externes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), import_id uuid, beatmaker_id uuid, client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plateforme text, numero_externe text, date_vente timestamptz, acheteur_email text, acheteur_nom text, type_boutique text, reference_paiement text, devise text,
  taux_change numeric, date_taux date, total_catalogue numeric, total_remise numeric, total_depense numeric, total_paye numeric, total_depense_eur numeric,
  moyen_paiement text, montant_tva numeric, source_marketing text, UNIQUE (beatmaker_id, plateforme, numero_externe));
CREATE TABLE commandes_externes_lignes (commande_externe_id uuid, beatmaker_id uuid, ordre int, titre text, titre_original text, licence text, prix_catalogue numeric,
  remise numeric, montant_depense numeric, montant_paye numeric, montant_depense_eur numeric, offert boolean, vendeur_principal text, collaborateurs text[], beat_id uuid, licence_id uuid);
CREATE TABLE imports_externes_contacts (import_id uuid, beatmaker_id uuid, client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE, client_cree boolean, snapshot jsonb);
`)
await db.exec(fonction('supabase/import_externe_lot2.sql', 'CREATE OR REPLACE FUNCTION client_snapshot_import('))
await db.exec(fonction('supabase/import_externe_lot2.sql', 'CREATE OR REPLACE FUNCTION client_reference_ailleurs('))
await db.exec(sansCR(fs.readFileSync('supabase/fiches_clients_lot3_ecriture.sql', 'utf8')))
// 9d lot 4 : la fonction d'écriture du lot 4 remplace celle du lot 3 (non-régression)
await db.exec('ALTER TABLE leads ADD COLUMN efface_le timestamptz;')
await db.exec(fonction('supabase/fiches_clients_lot4_rgpd.sql', 'CREATE OR REPLACE FUNCTION ecrire_fiche_boutique('))

const A = '00000000-0000-0000-0000-00000000000a', B = '00000000-0000-0000-0000-00000000000b'
const C1 = '00000000-0000-0000-0000-0000000000c1'
await db.exec(`INSERT INTO beatmakers VALUES ('${A}'), ('${B}'); INSERT INTO clients (id, email, nom) VALUES ('${C1}', 'lea@x.fr', 'lea');`)
const ecrire = async (c, b, src, d, le) => (await db.query(
  `SELECT ecrire_fiche_boutique($1, $2, $3, $4::jsonb${le ? ', $5::timestamptz' : ''}) AS r`,
  le ? [c, b, src, JSON.stringify(d), le] : [c, b, src, JSON.stringify(d)])).rows[0].r
const fiche = async (c, b) => (await db.query(
  `SELECT source, emails, telephones, adresses, prenom, nom, nom_artiste, pays, langue, premier_contact_le, champs_manuels FROM leads WHERE client_id=$1 AND beatmaker_id=$2`, [c, b])).rows[0]
let ok = 0, ko = 0
const verif = (nom, cond, detail) => { if (cond) { ok++; console.log('OK ', nom) } else { ko++; console.log('KO ', nom, JSON.stringify(detail)) } }

// 1. Connexion : email seul
let r = await ecrire(C1, A, 'visite', { email: ' Lea@X.fr ' })
let f = await fiche(C1, A)
verif('connexion : fiche créée avec email seul', r.cree && f.emails.join() === 'lea@x.fr' && !f.prenom && f.source === 'visite' && f.premier_contact_le, f)
const premier = f.premier_contact_le
r = await ecrire(C1, A, 'achat', { email: 'lea@x.fr' })
f = await fiche(C1, A)
verif('2e écriture : pas de création, source figée', !r.cree && f.source === 'visite' && f.emails.length === 1, f)
// 2. Achat
await ecrire(C1, A, 'achat', { email: 'lea.pro@x.fr', prenom: 'Léa', nom: 'Martin', telephone: '0601', adresse: { adresse: '1 rue A', code_postal: '75001', ville: 'Paris', pays: 'fr' } })
f = await fiche(C1, A)
verif('achat : email ajouté à la fin, principal inchangé', f.emails.join() === 'lea@x.fr,lea.pro@x.fr', f.emails)
verif('achat : prénom et nom remplis', f.prenom === 'Léa' && f.nom === 'Martin', f)
verif('achat : adresse complète + pays FR', f.adresses[0].ligne === '1 rue A, 75001 Paris, FR' && f.pays === 'FR', f.adresses)
verif('date du 1er contact figée', +new Date(f.premier_contact_le) === +new Date(premier), f.premier_contact_le)
await ecrire(C1, A, 'achat', { prenom: 'Autre', nom: 'Nom', telephone: '0602', adresse: { ligne: '9 Main St, US' }, pays: 'us' })
f = await fiche(C1, A)
verif('rempli une fois : prénom et nom gardés', f.prenom === 'Léa' && f.nom === 'Martin', f)
verif('téléphone récent en tête', f.telephones.join() === '0602,0601', f.telephones)
verif('adresse récente en tête', f.adresses.map(a => a.ligne).join('|') === '9 Main St, US|1 rue A, 75001 Paris, FR', f.adresses)
verif('dernière valeur : pays remplacé', f.pays === 'US', f.pays)
await ecrire(C1, A, 'achat', { telephone: '0601' })
f = await fiche(C1, A)
verif('téléphone redonné : remonte sans doublon', f.telephones.join() === '0601,0602', f.telephones)
// 3. Main du beatmaker
await db.exec(`UPDATE leads SET champs_manuels='{pays,telephones,prenom,emails}', prenom=NULL, telephones='{0700}', emails='{lea.pro@x.fr,lea@x.fr}' WHERE client_id='${C1}' AND beatmaker_id='${A}'`)
await ecrire(C1, A, 'achat', { prenom: 'Robot', pays: 'DE', telephone: '0601', email: 'nouveau@x.fr' })
f = await fiche(C1, A)
verif('manuel : prénom vidé à la main reste vide', f.prenom === null, f.prenom)
verif('manuel : pays gardé', f.pays === 'US', f.pays)
verif('manuel : téléphone ajouté à la fin seulement', f.telephones.join() === '0700,0601', f.telephones)
verif('manuel : emails non réordonnés, nouveau à la fin', f.emails.join() === 'lea.pro@x.fr,lea@x.fr,nouveau@x.fr', f.emails)
// 4. Isolation
r = await ecrire(C1, B, 'free_download', { email: 'lea@x.fr', prenom: 'L', nom_artiste: 'LeaMC', pays: 'BE' })
const fb = await fiche(C1, B)
verif('boutique B : seulement son free download', r.cree && fb.source === 'free_download' && fb.prenom === 'L' && fb.nom_artiste === 'LeaMC' && fb.pays === 'BE' && fb.telephones.length === 0 && fb.emails.join() === 'lea@x.fr', fb)
await ecrire(C1, B, 'free_download', { pays: 'France', adresse: { ville: '' } })
const fb1 = await fiche(C1, B)
verif('pays invalide et adresse vide ignorés', fb1.pays === 'BE' && fb1.adresses.length === 0, fb1)
const C3 = '00000000-0000-0000-0000-0000000000c3'
await db.exec(`INSERT INTO clients (id, email, nom) VALUES ('${C3}', 'c3@x.fr', 'c3')`)
let refus = false
try { await ecrire(C3, A, 'n_importe_quoi', {}) } catch { refus = true }
verif('source inconnue refusée', refus)
// 5. Donnée ancienne
await ecrire(C1, B, 'import', { ancien: true, pays: 'ES', telephone: '0999', adresse: { ligne: 'Vieille adresse' } }, '2020-01-01')
const fb2 = await fiche(C1, B)
verif('ancien : 1er contact recule, pays gardé, listes complétées', new Date(fb2.premier_contact_le).getUTCFullYear() === 2020 && fb2.pays === 'BE' && fb2.telephones.join() === '0999', fb2)

// 6. Import complet + annulation
const CEX = '00000000-0000-0000-0000-0000000000c2'
await db.exec(`INSERT INTO clients (id, email, nom, prenom) VALUES ('${CEX}', 'existant@x.fr', 'Dupont', 'Jean')`)
const contacts = [
  { email: 'nouveau@x.fr', prenom: 'Nina', nom: 'Neuf', premiere_date: '2024-05-01', adresse: '2 rue B', ville: 'Lyon', code_postal: '69001', pays: 'fr', telephone: '0611' },
  { email: 'existant@x.fr', prenom: 'Jeannot', nom: 'D', premiere_date: '2023-01-01', pays: 'BE' },
]
const commandes = contacts.map((c, i) => ({ numero_externe: 'N' + i, date_vente: c.premiere_date, acheteur_email: c.email, acheteur_nom: c.prenom, devise: 'EUR', total_depense: 10, total_paye: 10, total_depense_eur: 10, lignes: [{ ordre: 1, titre: 't', montant_paye: 10 }] }))
const res = (await db.query(`SELECT importer_commandes_externes($1, $2::jsonb, $3::jsonb, $4::jsonb) r`,
  [A, JSON.stringify({ plateforme: 'beatstars', nom_fichier: 'f.csv' }), JSON.stringify(contacts), JSON.stringify(commandes)])).rows[0].r
verif('import : 2 commandes, 2 fiches créées, 1 client créé', res.nb_commandes === 2 && res.nb_contacts_crees === 2 && res.nb_clients_crees === 1, res)
const cn = (await db.query(`SELECT * FROM clients WHERE email='nouveau@x.fr'`)).rows[0]
verif('import : fiche commune = email seul', cn && cn.nom === '' && !cn.prenom && !cn.adresse && !cn.telephone && !cn.pays, cn)
const fn = await fiche(cn.id, A)
verif('import : fiche boutique remplie (nouveau client)', fn.source === 'import' && fn.prenom === 'Nina' && fn.nom === 'Neuf' && fn.pays === 'FR' && fn.telephones.join() === '0611' && fn.adresses[0].ligne === '2 rue B, 69001 Lyon, FR' && new Date(fn.premier_contact_le).getUTCFullYear() === 2024, fn)
const fe = await fiche(CEX, A)
verif('import : client connu ailleurs = fiche avec les données du fichier', fe.prenom === 'Jeannot' && fe.pays === 'BE' && fe.emails.join() === 'existant@x.fr', fe)
verif('import : fiche commune du client connu intacte', (await db.query(`SELECT prenom FROM clients WHERE id='${CEX}'`)).rows[0].prenom === 'Jean')
await db.exec(`UPDATE leads SET champs_manuels='{notes}', notes='vu' WHERE client_id='${CEX}' AND beatmaker_id='${A}'`)
const ann = (await db.query(`SELECT annuler_import_externe($1, $2) r`, [A, res.import_id])).rows[0].r
verif('annulation : 1 supprimée, 1 gardée (modifiée à la main)', ann.nb_contacts_supprimes === 1 && ann.nb_contacts_conserves === 1, ann)
verif('annulation : client créé par l import supprimé', (await db.query(`SELECT 1 FROM clients WHERE email='nouveau@x.fr'`)).rows.length === 0)

// 7. Passage invité → vrai compte
const INV = '00000000-0000-0000-0000-0000000000d1', REEL = '00000000-0000-0000-0000-0000000000d2', AUTRE = '00000000-0000-0000-0000-0000000000d3'
await db.exec(`INSERT INTO clients (id, email, nom) VALUES ('${INV}', 'invite@x.fr', 'inv'), ('${AUTRE}', 'autre@x.fr', 'a');
  INSERT INTO leads (client_id, beatmaker_id, source) VALUES ('${INV}', '${A}', 'import');
  INSERT INTO commandes_externes (beatmaker_id, client_id, plateforme, numero_externe) VALUES ('${A}', '${INV}', 'x', 'Z1');
  INSERT INTO imports_externes_contacts (beatmaker_id, client_id, client_cree) VALUES ('${A}', '${INV}', true);
  INSERT INTO fusions_crm VALUES ('${A}', '${INV}', '${AUTRE}');
  INSERT INTO campagne_envois VALUES ('${INV}'); INSERT INTO liste_membres VALUES ('${INV}');
  UPDATE clients SET fusionne_dans='${INV}' WHERE id='${AUTRE}';`)
await db.query(`SELECT fusionner_compte_client($1, $2, 'invite@x.fr', 'Nom', 'Prenom', null)`, [INV, REEL])
const compte = async (t, col) => +(await db.query(`SELECT count(*) n FROM ${t} WHERE ${col}='${REEL}'`)).rows[0].n
verif('fusion de compte : ventes importées gardées', await compte('commandes_externes', 'client_id') === 1)
verif('fusion de compte : registre de l import gardé', await compte('imports_externes_contacts', 'client_id') === 1)
verif('fusion de compte : fusion de doublons gardée', await compte('fusions_crm', 'client_id_conserve') === 1)
verif('fusion de compte : envois de campagne gardés', await compte('campagne_envois', 'client_id') === 1)
verif('fusion de compte : liste_membres gardé', await compte('liste_membres', 'client_id') === 1)
verif('fusion de compte : fusionne_dans suivi', await compte('clients', 'fusionne_dans') === 1)
verif('fusion de compte : fiche boutique suit', await compte('leads', 'client_id') === 1)

// 8. Droits
const droits = (await db.query(`SELECT
  has_function_privilege('authenticated', 'ecrire_fiche_boutique(uuid, uuid, text, jsonb, timestamptz)', 'EXECUTE') a,
  has_function_privilege('anon', 'ecrire_fiche_boutique(uuid, uuid, text, jsonb, timestamptz)', 'EXECUTE') b,
  has_function_privilege('service_role', 'ecrire_fiche_boutique(uuid, uuid, text, jsonb, timestamptz)', 'EXECUTE') c`)).rows[0]
verif('droits : clé de service seule', !droits.a && !droits.b && droits.c, droits)
console.log(`\n${ok} OK, ${ko} KO`)
