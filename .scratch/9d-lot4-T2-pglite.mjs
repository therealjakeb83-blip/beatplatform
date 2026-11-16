import fs from 'fs'
import { PGlite } from 'file:///C:/Users/nicoj/AppData/Local/Temp/claude/9ddd3c09bf8b3398/3c76a052-57bf-4101-95c2-a12bc74e999b/scratchpad/pg/node_modules/@electric-sql/pglite/dist/index.js'
// 9d lot 4, T2 : supabase/fiches_clients_lot4_rgpd.sql essayé sur Postgres local, fausses données.
const db = new PGlite()
const sansCR = s => s.split(String.fromCharCode(13)).join('')
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE TABLE beatmakers (id uuid PRIMARY KEY);
CREATE TABLE clients (id uuid PRIMARY KEY, email text UNIQUE NOT NULL, nom text NOT NULL, prenom text, surnom text, nom_artiste text,
  telephone text, langue text, pays text, notes text, tags text[] NOT NULL DEFAULT '{}', instagram text, spotify text, youtube text, tiktok text,
  emails_secondaires text[] NOT NULL DEFAULT '{}', adresse text, ville text, code_postal text, raison_sociale text, numero_tva text, fusionne_dans uuid REFERENCES clients(id));
CREATE TABLE leads (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  beatmaker_id uuid NOT NULL REFERENCES beatmakers(id), source text CHECK (source IN ('visite','newsletter','free_download','achat','manuel','import')),
  source_plateforme text, created_at timestamptz DEFAULT now(), newsletter_statut text NOT NULL DEFAULT 'non_inscrit', newsletter_statut_at timestamptz,
  newsletter_statut_source text, emails text[] NOT NULL DEFAULT '{}', telephones text[] NOT NULL DEFAULT '{}', adresses jsonb NOT NULL DEFAULT '[]',
  prenom text, nom text, nom_artiste text, pays text, langue text, premier_contact_le timestamptz, notes text, tags text[] NOT NULL DEFAULT '{}',
  surnom text, instagram text, spotify text, youtube text, tiktok text, champs_manuels text[] NOT NULL DEFAULT '{}', reconstruite_le timestamptz,
  UNIQUE (client_id, beatmaker_id));
CREATE TABLE commandes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_id uuid REFERENCES clients(id), beatmaker_id uuid, created_at timestamptz DEFAULT now(),
  acheteur_email text, acheteur_nom text, acheteur_adresse text, acheteur_telephone text, acheteur_raison_sociale text, acheteur_numero_tva text, prix_paye numeric);
CREATE TABLE abonnements_boutique (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_id uuid REFERENCES clients(id) ON DELETE CASCADE, beatmaker_id uuid, statut text, acheteur_email text, acheteur_nom text);
CREATE TABLE favoris (client_id uuid REFERENCES clients(id) ON DELETE CASCADE, beat_id uuid);
CREATE TABLE free_downloads (client_id uuid REFERENCES clients(id) ON DELETE CASCADE, beatmaker_id uuid);
CREATE TABLE licence_downloads (id serial, commande_id uuid, client_id uuid REFERENCES clients(id), ip_address text);
CREATE TABLE tentatives_paiement (client_id uuid REFERENCES clients(id), beatmaker_id uuid, email text, telephone text, nom text, adresse text);
CREATE TABLE morceaux_clients (client_id uuid REFERENCES clients(id) ON DELETE CASCADE, beatmaker_id uuid, titre text);
CREATE TABLE email_logs (beatmaker_id uuid, client_id uuid REFERENCES clients(id) ON DELETE SET NULL, destinataire text NOT NULL, sujet text, corps_html text, corps_texte text);
CREATE TABLE listes_crm (id uuid PRIMARY KEY, beatmaker_id uuid);
CREATE TABLE listes_crm_contacts (liste_id uuid, client_id uuid);
CREATE TABLE listes_contacts (id uuid PRIMARY KEY, beatmaker_id uuid);
CREATE TABLE liste_membres (liste_id uuid, client_id uuid REFERENCES clients(id) ON DELETE CASCADE);
CREATE TABLE doublons_ignores (client_id_1 uuid, client_id_2 uuid, beatmaker_id uuid);
CREATE TABLE automatisation_evenements (beatmaker_id uuid, client_id uuid, traite boolean DEFAULT false);
CREATE TABLE fusions_crm (beatmaker_id uuid, client_id_conserve uuid, client_id_archive uuid, emails_archives text[] NOT NULL DEFAULT '{}', snapshot_archive jsonb NOT NULL DEFAULT '{}');
CREATE TABLE imports_externes_contacts (beatmaker_id uuid, client_id uuid, snapshot jsonb NOT NULL);
CREATE TABLE commandes_externes (beatmaker_id uuid, client_id uuid, acheteur_email text NOT NULL, acheteur_nom text);
CREATE TABLE campagnes (id serial, beatmaker_id uuid, cible_emails text[]);
CREATE TABLE codes_promo (code text, beatmaker_id uuid, statut text, emails_autorises text[] NOT NULL DEFAULT '{}', emails_exclus text[] NOT NULL DEFAULT '{}');
CREATE TABLE merchant_decisions_log (entity_type text CONSTRAINT merchant_decisions_log_entity_type_check CHECK (entity_type IN ('commande')));
`)
await db.exec(sansCR(fs.readFileSync('supabase/fiches_clients_lot4_rgpd.sql', 'utf8')))

const A = '00000000-0000-0000-0000-00000000000a', B = '00000000-0000-0000-0000-00000000000b'
const LEA = '00000000-0000-0000-0000-0000000000c1', LEA2 = '00000000-0000-0000-0000-0000000000c2', MAX = '00000000-0000-0000-0000-0000000000c3'
const L1 = '00000000-0000-0000-0000-0000000000d1', L2 = '00000000-0000-0000-0000-0000000000d2', LB = '00000000-0000-0000-0000-0000000000d3'
const CR = '00000000-0000-0000-0000-0000000000e1', CV = '00000000-0000-0000-0000-0000000000e2', CB = '00000000-0000-0000-0000-0000000000e3'
await db.exec(`
INSERT INTO beatmakers VALUES ('${A}'), ('${B}');
INSERT INTO clients (id, email, nom, prenom, telephone, notes) VALUES ('${LEA}', 'lea@x.fr', 'Martin', 'Léa', '0601', 'note globale'),
  ('${LEA2}', 'lea.pro@x.fr', '', NULL, NULL, NULL), ('${MAX}', 'max@x.fr', 'Max', NULL, NULL, NULL);
INSERT INTO leads (client_id, beatmaker_id, source, emails, telephones, adresses, prenom, nom, notes, tags, surnom, instagram, pays, champs_manuels, newsletter_statut)
VALUES ('${LEA}', '${A}', 'achat', '{lea@x.fr}', '{0601}', '[{"ligne":"1 rue A"}]', 'Léa', 'Martin', 'bonne cliente', '{vip}', 'Lélé', '@lea', 'FR', '{prenom}', 'inscrit'),
       ('${LEA2}', '${A}', 'import', '{lea.pro@x.fr}', '{}', '[]', NULL, NULL, NULL, '{}', NULL, NULL, NULL, '{}', 'non_inscrit'),
       ('${LEA}', '${B}', 'visite', '{lea@x.fr}', '{0699}', '[]', 'Léa', 'M', 'note de B', '{}', NULL, NULL, 'FR', '{}', 'inscrit'),
       ('${MAX}', '${A}', 'achat', '{max@x.fr}', '{}', '[]', 'Max', NULL, NULL, '{}', NULL, NULL, NULL, '{}', 'inscrit');
INSERT INTO fusions_crm VALUES ('${A}', '${LEA}', '${LEA2}', '{lea.pro@x.fr}', '{"email":"lea.pro@x.fr"}');
INSERT INTO doublons_ignores VALUES ('${LEA}', '${MAX}', '${A}'), ('${LEA}', '${MAX}', '${B}');
INSERT INTO listes_crm VALUES ('${L1}', '${A}'), ('${LB}', '${B}');
INSERT INTO listes_crm_contacts VALUES ('${L1}', '${LEA}'), ('${L1}', '${MAX}'), ('${LB}', '${LEA}');
INSERT INTO listes_contacts VALUES ('${L2}', '${A}'); INSERT INTO liste_membres VALUES ('${L2}', '${LEA2}');
INSERT INTO morceaux_clients VALUES ('${LEA}', '${A}', 'Mon son'), ('${LEA}', '${B}', 'Son B');
INSERT INTO automatisation_evenements VALUES ('${A}', '${LEA}', false), ('${A}', '${LEA}', true), ('${B}', '${LEA}', false);
INSERT INTO imports_externes_contacts VALUES ('${A}', '${LEA2}', '{"email":"lea.pro@x.fr"}');
INSERT INTO commandes_externes VALUES ('${A}', '${LEA2}', 'lea.pro@x.fr', 'Léa M');
INSERT INTO campagnes (beatmaker_id, cible_emails) VALUES ('${A}', '{lea@x.fr,max@x.fr}'), ('${B}', '{lea@x.fr}');
INSERT INTO codes_promo VALUES ('RETOUR-1', '${A}', 'actif', '{lea@x.fr}', '{}'), ('DUO', '${A}', 'actif', '{lea.pro@x.fr,max@x.fr}', '{}'),
  ('SAUF', '${A}', 'actif', '{}', '{lea@x.fr}'), ('B-1', '${B}', 'actif', '{lea@x.fr}', '{}');
INSERT INTO commandes (id, client_id, beatmaker_id, created_at, acheteur_email, acheteur_nom, acheteur_adresse, acheteur_telephone, acheteur_raison_sociale, acheteur_numero_tva, prix_paye) VALUES
  ('${CR}', '${LEA}', '${A}', now() - interval '20 days', 'lea@x.fr', 'Léa Martin', '1 rue A', '0601', 'Léa SAS', 'FR123', 30),
  ('${CV}', NULL, '${A}', now() - interval '200 days', 'lea.pro@x.fr', 'Léa Martin', '1 rue A', '0601', NULL, NULL, 20),
  ('${CB}', '${LEA}', '${B}', now() - interval '5 days', 'lea@x.fr', 'Léa Martin', '1 rue A', '0699', NULL, NULL, 10);
INSERT INTO licence_downloads (commande_id, client_id, ip_address) VALUES ('${CR}', '${LEA}', '1.1.1.1'), ('${CV}', NULL, '2.2.2.2'), ('${CB}', '${LEA}', '3.3.3.3');
INSERT INTO abonnements_boutique (client_id, beatmaker_id, statut, acheteur_email, acheteur_nom) VALUES ('${LEA}', '${A}', 'annule', 'lea@x.fr', 'Léa M');
INSERT INTO tentatives_paiement VALUES ('${LEA}', '${A}', 'lea@x.fr', '0601', 'Martin', '1 rue A'), (NULL, '${A}', 'lea.pro@x.fr', '0602', 'Martin', NULL), ('${LEA}', '${B}', 'lea@x.fr', '0699', 'M', NULL);
INSERT INTO email_logs VALUES ('${A}', '${LEA}', 'lea@x.fr', 'Merci', '<p>Léa</p>', 'Léa'), ('${A}', NULL, 'lea.pro@x.fr', 'Hello', 'x', 'x'), ('${B}', '${LEA}', 'lea@x.fr', 'B', 'y', 'y');
INSERT INTO favoris VALUES ('${LEA}', NULL), ('${LEA}', NULL);
`)
let ok = 0, ko = 0
const verif = (nom, cond, detail) => { if (cond) { ok++; console.log('OK ', nom) } else { ko++; console.log('KO ', nom, JSON.stringify(detail)) } }
const q = async (s, p) => (await db.query(s, p)).rows
const erreur = async (s, p) => { try { await db.query(s, p); return null } catch (e) { return e.message } }

// Refus
verif('contact hors boutique refusé', (await erreur(`SELECT effacer_contact_boutique($1, $2)`, [B, LEA2]))?.includes('contact_hors_boutique'))
await db.exec(`INSERT INTO abonnements_boutique (client_id, beatmaker_id, statut) VALUES ('${MAX}', '${A}', 'impaye')`)
verif('abonnement impayé (non annulé) = refus', (await erreur(`SELECT effacer_contact_boutique($1, $2)`, [A, MAX]))?.includes('abonnement_actif'))
verif('refus = rien de modifié pour Max', (await q(`SELECT emails FROM leads WHERE client_id = $1`, [MAX]))[0].emails[0] === 'max@x.fr')

// Effacement via l'identifiant ARCHIVÉ : remonte à la fiche conservée
const r = (await q(`SELECT effacer_contact_boutique($1, $2) AS r`, [A, LEA2]))[0].r
verif('effacement : fiche conservée + archivée', r.client_id === LEA && r.fiches === 2 && r.commandes === 2, r)
const la = await q(`SELECT * FROM leads WHERE beatmaker_id = $1 AND client_id IN ($2, $3)`, [A, LEA, LEA2])
verif('fiches A vidées + efface_le', la.length === 2 && la.every(l => l.efface_le && l.emails.length === 0 && l.telephones.length === 0 && l.adresses.length === 0 && !l.prenom && !l.nom && !l.notes && l.tags.length === 0 && !l.surnom && !l.instagram && !l.pays && l.champs_manuels.length === 0 && l.newsletter_statut === 'non_inscrit'), la)
const lb = (await q(`SELECT * FROM leads WHERE beatmaker_id = $1 AND client_id = $2`, [B, LEA]))[0]
verif('fiche B intacte', !lb.efface_le && lb.notes === 'note de B' && lb.emails[0] === 'lea@x.fr' && lb.newsletter_statut === 'inscrit', lb)
verif('fusion A retirée', (await q(`SELECT count(*)::int n FROM fusions_crm`))[0].n === 0)
verif('doublons ignorés : A retiré, B gardé', JSON.stringify(await q(`SELECT beatmaker_id FROM doublons_ignores`)) === JSON.stringify([{ beatmaker_id: B }]))
verif('listes : Léa retirée de A seulement, Max reste', (await q(`SELECT client_id FROM listes_crm_contacts`)).map(x => x.client_id).sort().join() === [LEA, MAX].sort().join())
verif('anciennes listes A vidées', (await q(`SELECT count(*)::int n FROM liste_membres`))[0].n === 0)
verif('morceaux : A supprimé, B gardé', (await q(`SELECT titre FROM morceaux_clients`)).map(x => x.titre).join() === 'Son B')
verif('événements en attente A supprimés, traités et B gardés', (await q(`SELECT count(*)::int n FROM automatisation_evenements`))[0].n === 2)
verif("copie de l'import vidée", JSON.stringify((await q(`SELECT snapshot FROM imports_externes_contacts`))[0].snapshot) === '{}')
const camp = await q(`SELECT beatmaker_id, cible_emails FROM campagnes ORDER BY id`)
verif('campagne A sans Léa, campagne B intacte', camp[0].cible_emails.join() === 'max@x.fr' && camp[1].cible_emails.join() === 'lea@x.fr', camp)
const codes = Object.fromEntries((await q(`SELECT * FROM codes_promo`)).map(c => [c.code, c]))
verif('code perso de Léa désactivé, vidé', codes['RETOUR-1'].statut === 'inactif' && codes['RETOUR-1'].emails_autorises.length === 0, codes['RETOUR-1'])
verif('code à 2 personnes : Max reste, toujours actif', codes.DUO.statut === 'actif' && codes.DUO.emails_autorises.join() === 'max@x.fr', codes.DUO)
verif('exclusion retirée', codes.SAUF.emails_exclus.length === 0 && codes.SAUF.statut === 'actif')
verif('code de B intact', codes['B-1'].emails_autorises.join() === 'lea@x.fr')
const cmd = Object.fromEntries((await q(`SELECT * FROM commandes`)).map(c => [c.id, c]))
verif('commande A (compte) : facture gardée, email/tél effacés', cmd[CR].acheteur_email === null && cmd[CR].acheteur_telephone === null && cmd[CR].acheteur_nom === 'Léa Martin' && cmd[CR].acheteur_adresse === '1 rue A' && cmd[CR].acheteur_raison_sociale === 'Léa SAS' && cmd[CR].acheteur_numero_tva === 'FR123' && cmd[CR].client_id === LEA && Number(cmd[CR].prix_paye) === 30, cmd[CR])
verif('commande A invitée (trouvée par email)', cmd[CV].acheteur_email === null && cmd[CV].acheteur_telephone === null && cmd[CV].acheteur_nom === 'Léa Martin', cmd[CV])
verif('commande B intacte', cmd[CB].acheteur_email === 'lea@x.fr' && cmd[CB].acheteur_telephone === '0699')
const ld = await q(`SELECT ip_address, ip_effacer_apres FROM licence_downloads ORDER BY id`)
verif('IP achat récent gardée, échéance à 120 j après achat', ld[0].ip_address === '1.1.1.1' && Math.round((new Date(ld[0].ip_effacer_apres) - Date.now()) / 864e5) === 100, ld[0])
verif('IP achat de plus de 120 j effacée', ld[1].ip_address === null && ld[1].ip_effacer_apres === null, ld[1])
verif('IP chez B intacte', ld[2].ip_address === '3.3.3.3' && ld[2].ip_effacer_apres === null)
const ab = (await q(`SELECT * FROM abonnements_boutique WHERE client_id = $1`, [LEA]))[0]
verif('abonnement annulé : email effacé, nom gardé', ab.acheteur_email === null && ab.acheteur_nom === 'Léa M', ab)
const tp = await q(`SELECT * FROM tentatives_paiement`)
verif('tentatives A (compte + invité) : email/tél effacés, nom/adresse gardés ; B intacte', tp.filter(t => t.beatmaker_id === A).every(t => !t.email && !t.telephone && t.nom === 'Martin') && tp.find(t => t.beatmaker_id === B).email === 'lea@x.fr', tp)
verif('vente importée : email effacé, nom gardé', (await q(`SELECT * FROM commandes_externes`)).every(x => x.acheteur_email === null && x.acheteur_nom === 'Léa M'))
const el = await q(`SELECT * FROM email_logs`)
verif('journal A : destinataire et contenu effacés, sujet gardé ; B intact', el.filter(e => e.beatmaker_id === A).every(e => !e.destinataire && !e.corps_html && !e.corps_texte && e.sujet) && el.find(e => e.beatmaker_id === B).destinataire === 'lea@x.fr', el)
verif("compte Sonoo (clients) non touché par l'effacement", (await q(`SELECT email FROM clients WHERE id = $1`, [LEA]))[0].email === 'lea@x.fr')
verif('effacer deux fois = sans erreur', !(await erreur(`SELECT effacer_contact_boutique($1, $2)`, [A, LEA])))

// Retour = fiche neuve
const re = (await q(`SELECT ecrire_fiche_boutique($1, $2, 'newsletter', '{"email":"lea@x.fr"}'::jsonb) AS r`, [LEA, A]))[0].r
const ln = (await q(`SELECT * FROM leads WHERE client_id = $1 AND beatmaker_id = $2`, [LEA, A]))[0]
verif("retour : fiche neuve (cree = vrai), seulement l'email redonné, source nouvelle", re.cree === true && !ln.efface_le && ln.emails.join() === 'lea@x.fr' && !ln.prenom && ln.source === 'newsletter' && ln.telephones.length === 0, ln)
verif('retour : ancienne commande toujours rattachée au compte', (await q(`SELECT client_id FROM commandes WHERE id = $1`, [CR]))[0].client_id === LEA)
const re2 = (await q(`SELECT ecrire_fiche_boutique($1, $2, 'achat', '{"prenom":"Léa"}'::jsonb) AS r`, [LEA, A]))[0].r
const ln2 = (await q(`SELECT prenom, source FROM leads WHERE client_id = $1 AND beatmaker_id = $2`, [LEA, A]))[0]
verif('2e écriture après retour : plus « créée », prénom rempli, source figée', re2.cree === false && ln2.prenom === 'Léa' && ln2.source === 'newsletter', ln2)

// Suppression du compte
verif('identifiant sans fiche clients : refus', (await erreur(`SELECT supprimer_compte_client($1)`, [A]))?.includes('compte_introuvable'))
await db.exec(`INSERT INTO clients (id, email, nom) VALUES ('${A}', 'boutique@x.fr', 'A')`)
verif('connexion = boutique : refus', (await erreur(`SELECT supprimer_compte_client($1)`, [A]))?.includes('compte_boutique'))
verif('abonnement non annulé : refus', (await erreur(`SELECT supprimer_compte_client($1)`, [MAX]))?.includes('abonnement_actif'))
await db.exec(`UPDATE leads SET newsletter_statut = 'inscrit' WHERE client_id = '${LEA}'`)
const s = (await q(`SELECT supprimer_compte_client($1, $2) AS r`, [LEA, [B]]))[0].r
verif('suppression : 2 favoris, 1 désinscription', s.favoris === 2 && s.desinscrits === 1, s)
const c = (await q(`SELECT * FROM clients WHERE id = $1`, [LEA]))[0]
verif('clients anonymisé, pas supprimé', c.email === `compte-supprime-${LEA}@supprime.invalid` && c.nom === 'Compte supprimé' && !c.prenom && !c.telephone && !c.notes && c.supprime_le, c)
const lf = await q(`SELECT beatmaker_id, newsletter_statut, emails FROM leads WHERE client_id = $1 ORDER BY beatmaker_id`, [LEA])
verif('fiches boutique intactes ; désinscrit seulement chez B (cochée)', lf[0].newsletter_statut === 'inscrit' && lf[1].newsletter_statut === 'desinscrit' && lf[1].emails[0] === 'lea@x.fr', lf)
verif('commandes gardées', (await q(`SELECT count(*)::int n FROM commandes WHERE client_id = $1`, [LEA]))[0].n === 2)
verif('supprimer deux fois : refus', (await erreur(`SELECT supprimer_compte_client($1)`, [LEA]))?.includes('compte_introuvable'))
verif('même email réutilisable par un nouveau compte', !(await erreur(`INSERT INTO clients (id, email, nom) VALUES (gen_random_uuid(), 'lea@x.fr', '')`)))

// Droits
for (const f of ['effacer_contact_boutique(uuid, uuid)', 'supprimer_compte_client(uuid, uuid[])', 'ecrire_fiche_boutique(uuid, uuid, text, jsonb, timestamptz)']) {
  const d = (await q(`SELECT has_function_privilege('anon', '${f}', 'execute') a, has_function_privilege('authenticated', '${f}', 'execute') b, has_function_privilege('service_role', '${f}', 'execute') c`))[0]
  verif('droits ' + f.split('(')[0], !d.a && !d.b && d.c, d)
}
verif('journal accepte le type client', !(await erreur(`INSERT INTO merchant_decisions_log VALUES ('client')`)))
console.log(`\n${ok} OK, ${ko} KO`)
