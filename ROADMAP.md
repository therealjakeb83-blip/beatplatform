# My Producer — Roadmap V1

> Dernière mise à jour : 2026-05-20 — Étape 11 CRM ✅ validée

## Légende
| Statut | Signification |
|--------|--------------|
| ⬜ À faire | Étape non commencée |
| 🔄 En cours | Étape en cours de développement |
| ✅ Validé | Étape terminée et testée |

---

## Progression globale : 11 / 17 étapes validées (+ 1 bonus)

| # | Étape | Description | Durée est. | Statut |
|---|-------|-------------|-----------|--------|
| 1 | **Setup & infrastructure** | Next.js, Git, GitHub, Supabase, Vercel, Cloudflare | 2-3h | ✅ Validé |
| 2 | **Base de données** | Concevoir et créer toutes les tables (beats, clients, licences, abonnements...) | 3-5h | ✅ Validé |
| 3 | **Authentification** | Inscription / connexion des beatmakers et des artistes. Bouton "Se connecter avec My Producer" dans les boutiques — compte global artiste. "Propulsé par My Producer" discret en bas de chaque boutique. | 3-4h | ✅ Validé |
| 4 | **Gestion des beats** | Upload, infos, fichiers (WAV/MP3/ZIP via Cloudflare R2), licences, organisation du catalogue | 10-15h | ✅ Validé |
| 5 | **Boutique** | Page publique du beatmaker, catalogue, player audio, pages beats | 15-20h | ✅ Validé |
| 5b | **Profil beatmaker** *(bonus)* | Slug personnalisable, logo, tagline, réseaux sociaux — page /dashboard/profil | — | ✅ Validé |
| 6 | **Paiements** | Stripe Connect, checkout, codes promo, TVA optionnelle | 10-15h | ✅ Validé |
| 7 | **Licences & livraison** | Livraison automatique des fichiers après achat. PDF contrat généré automatiquement avec : co-producers listés depuis beat_splits, répartition publishing, splits_snapshot stocké dans commandes. | 5-8h | ✅ Validé |
| 8 | **Abonnements** | Plans d'abonnement par beatmaker, catalogue privé (beats visibles + cadenas), remise % automatique (sauf Illimité/Exclusive), essai gratuit configurable, gestion depuis le dashboard et depuis la boutique | 8-12h | ✅ Validé |
| 9 | **Espace client artiste** | Compte My Producer global : inscription/connexion artiste, "Se connecter avec My Producer" dans les boutiques, beats achetés, abonnements actifs multi-appareils, fichiers à télécharger. Favoris : bouton cœur sur les cartes beat, page "Mes favoris". | 5-8h | ✅ Validé |
| 10 | **Split collab** | Stripe Connect pour beatmakers collaborateurs. Deux modes : compte My Producer existant OU invitation par email. Fonds retenus chez Stripe si collab non inscrit, reversés à l'inscription. | 7-10h | ✅ Validé |
| 11 | **CRM** | Liste clients, fiches, import CSV BeatStars. Détection automatique de doublons clients (fuzzy matching). | 5-8h | ✅ Validé |
| 12 | **Emails automatiques** | Post-achat, abonnement, renouvellement, annulation | 4-6h | ⬜ À faire |
| 13 | **Analytics** | CA, classements beats, licences vendues. Compteur d'écoutes sur les cartes beat et page détail. | 4-6h | ⬜ À faire |
| 14 | **Onboarding** | Parcours guidé de configuration à l'inscription | 5-8h | ⬜ À faire |
| 15 | **Admin** | Dashboard de gestion de la plateforme + outil interne d'import BeatStars (script scraping concierge) | 7-10h | ⬜ À faire |
| 16 | **Tests & corrections** | Tout tester de bout en bout avant lancement | 8-15h | ⬜ À faire |
| 17 | **Déploiement** | Mise en ligne sur Vercel + nom de domaine | 2-4h | ⬜ À faire |

---

## Stack technique
| Rôle | Service | Plan |
|---|---|---|
| Base de données + Auth | Supabase | Free (→ Pro au lancement prod) |
| Stockage fichiers audio (WAV/MP3/ZIP) | Cloudflare R2 | Free jusqu'à 10GB, puis $0.015/GB |
| Hébergement frontend | Vercel | Hobby (→ Pro au lancement prod) |
| Paiements | Stripe Connect | À la transaction (~1.5% + 0.25€) |
| Emails transactionnels | Resend ou Brevo | Free tier |

> **Budget estimé au lancement** : ~$50-60/mois (Vercel Pro + Supabase Pro + R2)

---

## Total estimé : 105-155h (~4 à 6 mois à 2-3 sessions/semaine)

---

## Détail étape 1 — Setup & infrastructure

| Sous-étape | Durée est. | Statut |
|------------|-----------|--------|
| Installation de Git | 5 min | ✅ Validé |
| Configuration de Git (nom + email) | 5 min | ✅ Validé |
| Installation de Node.js | 10 min | ✅ Validé |
| Création du projet Next.js (`beatplatform`) | 10 min | ✅ Validé |
| Initialisation du repo Git local | 5 min | ✅ Validé |
| Création du repo GitHub et push du code | 10 min | ✅ Validé |
| Créer un compte Supabase (free tier) | 10 min | ✅ Validé |
| Créer le projet Supabase et récupérer les clés de connexion | 15 min | ✅ Validé |
| Installer Supabase dans le projet Next.js | 10 min | ✅ Validé |
| Configurer les variables d'environnement (fichier `.env.local`) | 10 min | ✅ Validé |
| Créer un compte Vercel | 10 min | ✅ Validé |
| Connecter Vercel au repo GitHub | 15 min | ✅ Validé |
| Premier déploiement en ligne | 15 min | ✅ Validé |
| Créer un compte Cloudflare (pour R2 + DNS domaine) | 5 min | ✅ Validé |

---

## Détail étape 2 — Base de données

| Sous-étape | Durée est. | Statut |
|------------|-----------|--------|
| Concevoir le schéma des tables (quelles tables, quels champs) | 30 min | ✅ Validé |
| Créer les 9 tables via SQL (beatmakers, beats, licences, clients, leads, commandes, doublons_ignores, abonnements_plateforme, abonnements_boutique) | 45 min | ✅ Validé |
| Activer Row Level Security (RLS) sur toutes les tables | — | ✅ Validé |
| Ajouter les contraintes et index (unicité, montants, abonnements actifs) | — | ✅ Validé |

---

## Détail étape 3 — Authentification

| Sous-étape | Durée est. | Statut |
|------------|-----------|--------|
| 3.1 — Installer `@supabase/ssr` (sessions côté serveur Next.js) | 5 min | ✅ Validé |
| 3.2 — Configurer Supabase Auth (URL de redirection, confirmation email) | 10 min | ✅ Validé |
| 3.3 — Créer les clients Supabase (helpers browser / serveur / middleware) | 15 min | ✅ Validé |
| 3.4 — Proxy de protection des routes (redirection si non connecté) | 15 min | ✅ Validé |
| 3.5 — Page d'inscription (email + mot de passe + création profil beatmakers) | 30 min | ✅ Validé |
| 3.6 — Page de connexion (email + mot de passe + redirection dashboard) | 20 min | ✅ Validé |
| 3.7 — Déconnexion (bouton + redirection accueil) | 10 min | ✅ Validé |
| 3.8 — Mot de passe oublié (page reset + email via Resend, fix scan Gmail) | 20 min | ✅ Validé |
| 3.9 — Policies RLS (chaque beatmaker accède uniquement à son propre profil) | 20 min | ✅ Validé |
| 3.10 — Test de bout en bout (créer un compte, vérifier table, tester routes) | 20 min | ✅ Validé |

---

## Détail étape 4 — Gestion des beats

| Sous-étape | Durée est. | Statut |
|------------|-----------|--------|
| 4.1 — Configurer Cloudflare R2 (bucket + credentials + variables d'env) | 20 min | ✅ Validé |
| 4.2 — Intégrer le SDK S3 compatible R2 dans Next.js (`@aws-sdk/client-s3`) | 10 min | ✅ Validé |
| 4.3 — Page "Ajouter un beat" — formulaire infos (titre, BPM, clé, tags style/ambiance/instruments/type beat + ajout custom) | 45 min | ✅ Validé |
| 4.4 — Upload des fichiers audio vers R2 (MP3 taguée, MP3 propre, WAV, stems ZIP) — cover convertie en WebP auto | 60 min | ✅ Validé |
| 4.4b — Collaborateurs : split revenus par beat (recherche compte My Producer + invitation email, table beat_splits, Stripe escrow) | 30 min | ✅ Validé |
| 4.4c — (V2) Conversion WAV→MP3 automatique à l'upload (nécessite Vercel Pro) | — | ⬜ V2 |
| 4.5 — Sauvegarde du beat en base de données (table `beats` + `beat_splits`) | 20 min | ✅ Validé |
| 4.6 — Page catalogue dashboard — liste des beats, filtres, statut | 45 min | ✅ Validé |
| 4.7 — Édition et suppression d'un beat | 30 min | ✅ Validé |
| 4.8 — Gestion des licences par beat (activer/désactiver, modifier le prix) | 30 min | ✅ Validé |

---

## Détail étape 5 — Boutique publique

| Sous-étape | Durée est. | Statut |
|------------|-----------|--------|
| 5.1 — RLS Supabase : lecture publique beats/licences/beatmakers pour visiteurs non connectés | 10 min | ✅ Validé |
| 5.2 — Player audio global (PlayerContext + PlayerBar sticky) : play/pause/next/prev/seek/autoplay en fin de beat | 60 min | ✅ Validé |
| 5.3 — Page boutique principale `/[slug]` : header beatmaker (logo, nom, tagline, réseaux) + catalogue grille | 45 min | ✅ Validé |
| 5.4 — Filtres catalogue : recherche par titre, filtre style, filtre type beat | 20 min | ✅ Validé |
| 5.5 — Carte beat : cover avec bouton play overlay, titre, BPM/clé, tags, prix des licences | 30 min | ✅ Validé |
| 5.6 — Page beat individuelle `/[slug]/[beatId]` : cover, infos complètes, bouton play, tableau licences | 45 min | ✅ Validé |
| 5.7 — Lien "Ma boutique ↗" dans le dashboard | 5 min | ✅ Validé |

---

## Détail étape 6 — Paiements

| Sous-étape | Description | Qui | Statut |
|-----------|-------------|-----|--------|
| 6.1 | Créer un compte Stripe + activer Stripe Connect | Jake 👤 | ✅ |
| 6.2 | Intégrer le SDK Stripe dans Next.js | Claude 🤖 | ✅ |
| 6.3 | Onboarding Stripe Connect — le beatmaker lie son compte bancaire depuis le dashboard | Claude 🤖 + Jake 👤 | ✅ |
| 6.4 | Page de checkout — l'acheteur choisit sa licence et paie | Claude 🤖 | ✅ |
| 6.5 | Webhook Stripe — confirmer le paiement et créer la commande en base | Claude 🤖 | ✅ |
| 6.6 | Codes promo — création depuis le dashboard + application au checkout | Claude 🤖 | ✅ |
| 6.7 | TVA optionnelle — le beatmaker active/désactive la TVA sur ses ventes | Claude 🤖 | ✅ |
| 6.8 | Page "Mes commandes" dans le dashboard beatmaker | Claude 🤖 | ✅ |

---

## Détail étape 7 — Licences & livraison

| # | Sous-étape | Qui | Durée est. | Statut |
|---|-----------|-----|-----------|--------|
| 7.1 | Ajouter colonne `splits_snapshot` dans la table `commandes` (SQL Supabase) | Jake 👤 | 5 min | ✅ |
| 7.2 | Stocker le `splits_snapshot` dans le webhook au moment de l'achat | Claude 🤖 | 20 min | ✅ |
| 7.3 | Générer les URLs signées R2 pour les fichiers de la licence achetée (MP3 / WAV / Stems selon la licence) | Claude 🤖 | 45 min | ✅ |
| 7.4 | Générer le contrat PDF automatiquement (beat, beatmaker, acheteur, licence, répartition publishing) | Claude 🤖 | 90 min | ✅ |
| 7.5 | Stocker le PDF contrat dans R2 + URL dans la commande | Claude 🤖 | 20 min | ✅ |
| 7.6 | Page de téléchargement sécurisée `/telechargement/[commandeId]` | Claude 🤖 | 45 min | ✅ |
| 7.7 | Afficher bouton "Télécharger ma licence" sur la page beat après paiement réussi | Claude 🤖 | 20 min | ✅ |

> **Note :** L'email de livraison avec le lien de téléchargement est prévu à l'étape 12 (emails automatiques).

---

## Détail étape 8 — Abonnements

| # | Sous-étape | Qui | Durée est. | Statut |
|---|-----------|-----|-----------|--------|
| 8.1 | Migration SQL : colonnes `abo_*` dans `beatmakers` + migration `abonnements_boutique` (`client_id` nullable, `acheteur_email`, `acheteur_nom`, `en_essai`, `essai_fin_le`) | Jake 👤 | 10 min | ✅ |
| 8.2 | Page dashboard `/dashboard/abonnement` : configuration du plan (nom, description, prix, remise %, durée d'essai) | Claude 🤖 | 45 min | ✅ |
| 8.3 | Création du produit + prix Stripe pour le plan d'abonnement (API `/api/stripe/abonnement/creer-plan`) | Claude 🤖 | 30 min | ✅ |
| 8.4 | Page `/[slug]/abonnement` : présentation du plan + bouton S'abonner | Claude 🤖 | 30 min | ✅ |
| 8.5 | Checkout Stripe en mode `subscription` avec trial gratuit configurable | Claude 🤖 | 30 min | ✅ |
| 8.6 | Webhook Stripe : `customer.subscription.updated` + `customer.subscription.deleted` (mise à jour statut en BDD) | Claude 🤖 | 30 min | ✅ |
| 8.7 | Cookie de session membre (httpOnly `abo_<slug>`) : posé après paiement réussi, vérifié côté serveur à chaque page | Claude 🤖 | 20 min | ✅ |
| 8.8 | Catalogue privé : beats `prive` visibles par tous (covers, titre, tags) + badge cadenas pour non-abonnés | Claude 🤖 | 30 min | ✅ |
| 8.9 | Section "Réservés aux membres" sur la page boutique principale (`/[slug]`) | Claude 🤖 | 20 min | ✅ |
| 8.10 | Page `/[slug]/membres` : overlay paywall pour non-abonnés, accès complet pour abonnés | Claude 🤖 | 30 min | ✅ |
| 8.11 | Page `/[slug]/mon-abonnement` : statut de l'abonnement, date fin d'essai, lien annulation | Claude 🤖 | 30 min | ✅ |
| 8.12 | Remise abonné sur les fiches beat : prix original barré + prix réduit en indigo + badge "-X% membre" (hors Illimité et Exclusive) | Claude 🤖 | 30 min | ✅ |
| 8.13 | Fix : beats privés incluent `mp3_tague_url` pour les abonnés → lecture audio possible depuis la boutique | Claude 🤖 | 15 min | ✅ |

> **Note :** Le cookie session membre (`abo_<slug>`) est provisoire — remplacé par des comptes Supabase Auth à l'étape 9.

---

## Détail étape 9 — Espace client artiste

| # | Sous-étape | Qui | Durée est. | Statut |
|---|-----------|-----|-----------|--------|
| 9.1 | Migration SQL : RLS policies pour la table `clients` (SELECT/UPDATE sur son propre profil) + policy `abonnements_boutique` pour artistes connectés | Claude 🤖 | 20 min | ✅ |
| 9.2 | Pages auth artiste : `/artiste/connexion` + `/artiste/inscription` — séparées du login beatmaker | Claude 🤖 | 45 min | ✅ |
| 9.3 | Création de compte automatique à l'abonnement : webhook Stripe → créer `auth.user` + entrée `clients` par email | Claude 🤖 | 45 min | ✅ |
| 9.4 | Création de compte automatique à l'achat : même logique dans le webhook `checkout.session.completed` | Claude 🤖 | 20 min | ✅ |
| 9.5 | Remplacer le cookie par la session Supabase Auth dans la boutique (`estAbonne` via auth → clients → abonnements_boutique) | Claude 🤖 | 30 min | ✅ |
| 9.6 | Bouton "Se connecter / Mon compte" dans le header de chaque boutique | Claude 🤖 | 20 min | ✅ |
| 9.7 | Espace client `/mon-compte` : abonnements actifs, historique des achats, fichiers à télécharger | Claude 🤖 | 60 min | ✅ |
| 9.8 | Favoris : table `favoris` + RLS + GRANT authenticated + bouton cœur sur les cartes beat (artiste connecté uniquement) | Claude 🤖 | 30 min | ✅ |
| 9.9 | Page "Mes favoris" dans l'espace client | Claude 🤖 | 20 min | ✅ |

> **Note :** L'étape 9 est entièrement prise en charge par Claude — aucune action manuelle Supabase ou Stripe requise de la part de Jake, sauf validation fonctionnelle de bout en bout.

---

## Détail étape 10 — Split collab

> **Contexte :** La table `beat_splits` et le formulaire d'ajout de collabs existent déjà depuis l'étape 4. Ce qui manque : router réellement l'argent vers plusieurs comptes Stripe après chaque vente, notifier les collabs, et leur donner une vue dans leur dashboard.

> **Modèle économique :** My Producer reste en mode Plateforme (pas Marketplace). Les fonds transitent brièvement par My Producer le temps des virements — My Producer n'est pas deemed supplier et n'est pas responsable de la TVA. Frais de transit Stripe (~0.25%/virement) absorbés par My Producer.

| # | Sous-étape | Qui | Durée est. | Statut |
|---|-----------|-----|-----------|--------|
| 10.1 | Migration SQL : ajouter `stripe_transfer_group text` dans `commandes` + créer table `split_payments` avec RLS + GRANT service_role | Jake 👤 | 15 min | ✅ |
| 10.2 | Checkout adapté : beats avec splits → `transfer_group` UUID (pas de `on_behalf_of`). Beats sans splits : comportement inchangé. | Claude 🤖 | 30 min | ✅ |
| 10.3 | Email 1 — Invitation collab : envoyé automatiquement quand un beat passe en `public` avec un collab non inscrit (via Resend) | Claude 🤖 | 30 min | ✅ |
| 10.4 | Webhook `checkout.session.completed` : création `split_payments`, Stripe Transfers immédiats pour comptes connectés, Email 2 "fonds en attente" pour collabs non inscrits | Claude 🤖 | 60 min | ✅ |
| 10.5 | `/dashboard/splits` : vue propriétaire — liste des ventes avec collabs, statut par collaborateur (✅ transféré / ⏳ en attente), montants | Claude 🤖 | 45 min | ✅ |
| 10.6 | `/dashboard/mes-collabs` : vue collab lecture seule — beats en split, propriétaire, %, montants reçus / en attente | Claude 🤖 | 30 min | ✅ |
| 10.7 | Webhook `account.updated` : déblocage automatique des splits en attente quand un beatmaker connecte son Stripe. Jake a ajouté l'événement dans le dashboard Stripe. | Claude 🤖 + Jake 👤 | 45 min | ✅ |
| 10.8 | Cron quotidien `/api/cron/splits-expiration` : rappels email J+30 / J+50, reversal automatique vers beatmaker A à J+60 | Claude 🤖 | 45 min | ✅ |
| 10.9 | **Tests bout en bout** — voir checklist complète ci-dessous | Jake 👤 | 30 min | ✅ |

### Checklist tests 10.9

#### T1 — Email d'invitation collab ✅
- [x] Créer ou modifier un beat, ajouter un collaborateur par **email** (pas encore inscrit sur My Producer)
- [x] Passer le beat en statut `public` → sauvegarder
- [x] Vérifier que l'email d'invitation arrive dans la boîte du collab

#### T2 — Checkout beat avec splits (collab non inscrit) ✅
- [x] Acheter ce beat depuis la boutique avec la carte test `4242 4242 4242 4242`
- [x] Vérifier dans Supabase → table `split_payments` : une ligne avec `statut = en_attente` et `email_invite` rempli
- [x] Vérifier dans Supabase → table `commandes` : colonne `stripe_transfer_group` remplie
- [x] Vérifier que l'email "fonds en attente" (Email 2) est arrivé sur l'adresse du collab

#### T3 — Dashboard propriétaire `/dashboard/splits` ✅
- [x] Connecté en tant que Jake → aller sur `/dashboard/splits`
- [x] La vente apparaît avec le badge ⏳ "Fonds en attente" pour le collab non inscrit
- [x] Les montants distribués / en attente sont corrects

#### T4 — Inscription collab + déblocage automatique ✅
- [x] Le collab crée son compte sur `/inscription` avec la même adresse email
- [x] Le collab connecte son compte Stripe via `/dashboard/paiements`
- [x] Vérifier dans Stripe Dashboard → Transfers qu'un nouveau transfer a été créé automatiquement
- [x] Vérifier dans Supabase → `split_payments` que le statut est passé à `transfere`
- [x] Retourner sur `/dashboard/splits` → statut passé à ✅ Transféré

#### T5 — Dashboard collab `/dashboard/mes-collabs` ✅
- [x] Connecté en tant que beatmaker B (collab) → aller sur `/dashboard/mes-collabs`
- [x] Le beat apparaît avec le % et le montant reçu

#### T6 — Non-régression beat sans collab ✅
- [x] Acheter un beat qui n'a **aucun** collab
- [x] Vérifier que le comportement est inchangé : aucune ligne dans `split_payments`, transfer direct vers Jake dans Stripe

#### T7 — Beat avec collab déjà inscrit (compte Stripe connecté) ✅
- [x] Créer un beat avec un collab qui **a déjà** un compte My Producer + Stripe connecté
- [x] Acheter ce beat
- [x] Vérifier dans Stripe → **2 transfers** créés immédiatement (Jake + collab)
- [x] Vérifier dans `split_payments` → 2 lignes avec `statut = transfere`

> **Politique de rétention des fonds :** Split en attente = fonds détenus par Stripe (pas My Producer). Rappel email à J+30 et J+50. Reversal automatique vers beatmaker A à J+60. À documenter dans les CGU.

> **Note :** Les emails de l'étape 10 sont fonctionnels (contenu simple via Resend). Le design HTML branded sera revu à l'étape 12.

---

## Détail étape 11 — CRM

| # | Sous-étape | Qui | Statut |
|---|-----------|-----|--------|
| 11.1 | Migration SQL : RLS + GRANT sur `doublons_ignores` | Jake 👤 | ✅ |
| 11.2 | Page `/dashboard/crm` : liste clients avec stats (CA, achats, abonnés) + recherche + filtres | Claude 🤖 | ✅ |
| 11.3 | Page `/dashboard/crm/[clientId]` : fiche client avec historique achats + statut abonnement | Claude 🤖 | ✅ |
| 11.4 | Page `/dashboard/crm/doublons` : détection noms similaires + bouton Ignorer | Claude 🤖 | ✅ |
| 11.5 | Import CSV BeatStars | — | ⬜ À faire après analyse du vrai CSV |
| 11.6 | **Tests bout en bout** | Jake 👤 | ✅ |

### Checklist tests 11.6

#### T1 — Liste clients ✅
- [x] Aller sur `/dashboard/crm`
- [x] Les stats s'affichent en haut (nb clients, acheteurs, abonnés, CA total)
- [x] Les clients apparaissent dans la liste avec nom, email, achats, CA

#### T2 — Recherche + filtres ✅
- [x] Taper un nom ou email dans la barre → les résultats se filtrent
- [x] Cliquer sur "Acheteurs" → seuls les clients avec au moins 1 achat
- [x] Cliquer sur "Abonnés" → seuls les abonnés actifs
- [x] Cliquer sur "Leads" → clients sans achat ni abonnement

#### T3 — Fiche client ✅
- [x] Cliquer sur la flèche `→` d'un client avec compte My Producer
- [x] La fiche affiche ses infos (nom, email, pays, date inscription)
- [x] L'historique des achats est correct (beats, licences, montants)
- [x] Le statut abonnement est affiché si applicable

#### T4 — Doublons ✅
- [x] Aller sur `/dashboard/crm/doublons`
- [x] La page charge sans erreur
- [x] Si des noms similaires existent → paires affichées avec bouton "Ignorer"
- [x] Cliquer "Ignorer" → la paire disparaît et ne revient plus

---

## Journal des sessions

| Date | Étapes travaillées | Résumé |
|------|--------------------|--------|
| 2026-05-02 | Étape 1 | Setup Next.js, apprentissage Git/GitHub, initialisation du projet beatplatform |
| 2026-05-13 | Étape 1 | ✅ Étape 1 complète. Supabase configuré, Vercel déployé (beatplatform.vercel.app), compte Cloudflare créé. |
| 2026-05-13 | Étape 2 | Début étape 2 : schéma de la base de données conçu. Tables beatmakers et beats entièrement définies. |
| 2026-05-14 | Étape 2 | ✅ Étape 2 complète. 9 tables créées dans Supabase via SQL. RLS activé. Contraintes et index ajoutés. |
| 2026-05-14 | Étape 3 | ✅ Étape 3 complète. Resend SMTP configuré, fix Gmail OTP scanning, trigger beatmakers auto-créé, RLS policies. |
| 2026-05-14 | Étape 4 | Début étape 4. Prochaine action : configurer Cloudflare R2. |
| 2026-05-15 | Étape 4 | 4.1→4.7 validés. R2 configuré, SDK S3, formulaire beats, upload fichiers, collaborateurs/splits, catalogue dashboard, édition et suppression. |
| 2026-05-15 | Étape 5 | ✅ Étape 5 complète. Boutique publique /[slug] avec player audio global, filtres, page beat individuelle. Fix R2 public URL. |
| 2026-05-15 | Étape 5b | ✅ Profil beatmaker : slug personnalisable, logo R2, tagline, réseaux sociaux. Déploiement Vercel fonctionnel. |
| 2026-05-15 | Étape 6 | 6.1 ✅ Compte Stripe My Producer créé (distinct de Jakebmusic), Connect activé, modèle Plateforme + Express accounts. 6.2 ✅ SDK Stripe installé (lib/stripe.ts + lib/stripe-client.ts). Décisions TVA documentées. |
| 2026-05-18 | Étape 6 | ✅ Étape 6 complète. Webhook configuré, SUPABASE_SERVICE_ROLE_KEY ajouté, GRANT commandes service_role, test paiement bout en bout validé (45€ WAV, commande créée en BDD). |
| 2026-05-18 | Étape 7 | ✅ Étape 7 validée bout en bout. Fix : GRANT SELECT service_role sur beats/licences/beatmakers/beat_splits. Téléchargement direct (Content-Disposition). Page /telechargement permanente (liens régénérés à chaque visite). |
| 2026-05-18 | Étape 8 | ✅ Étape 8 validée bout en bout. Dashboard config plan (nom, prix, remise, essai). Checkout Stripe subscription mode + trial. Cookie session membre. Catalogue privé avec cadenas. Pages /abonnement, /membres, /mon-abonnement. Remise affichée sur fiche beat (prix barré). Illimité + Exclusive exclus de la remise. Webhook customer.subscription.updated/.deleted. |
| 2026-05-19 | Étape 9 | ✅ Étape 9 validée. 10 tests passés : inscription/connexion/déconnexion artiste, header boutique connecté, checkout invité+connecté, favoris (like/unlike/persistance/page), beats privés via session, /mon-abonnement via session, liaison auto achats existants. Bugs RLS corrigés : GRANT authenticated sur favoris/beats/beat_licences, fallback admin beatmakers, client_id enregistré à l'abonnement, remise checkout via session, annulation abonnement via session + UX confirmation. |
| 2026-05-19 | Correctifs post-étape 9 | ✅ Espace compte client par boutique : nouvelle page `/{slug}/mon-compte` (abonnement + favoris preview + achats preview + déco). Pages dédiées `/{slug}/mon-compte/favoris` (playlist avec player prev/next) et `/{slug}/mon-compte/achats`. Déconnexion redirige vers la boutique. Lien "Mon compte" dans le header pointe vers `/{slug}/mon-compte`. Prochaine étape : 10 (Split collab). |
| 2026-05-19 | Planification étape 10 | Détail des 9 sous-étapes Split collab finalisé. Décisions clés : transit Stripe (My Producer pas deemed supplier, custodian = Stripe), email invitation publication + email fonds en attente à la vente, rappels J+30/J+50 + reversal automatique J+60 vers beatmaker A, /dashboard/mes-collabs lecture seule, analytics collabs en étape 13. |
| 2026-05-19 | Étape 10 (code) | ✅ 10.1→10.8 complétés. Checkout transfer_group, webhook splits + transfers Stripe, emails Resend (invitation/fonds/rappel/expiration), /dashboard/splits, /dashboard/mes-collabs, webhook account.updated, cron quotidien J+30/J+50/J+60. Vercel env vars configurées (RESEND_API_KEY, NEXT_PUBLIC_APP_URL, CRON_SECRET). account.updated ajouté dans Stripe webhook. Tests 10.9 en attente de validation Jake. |
| 2026-05-19 | Étape 10 (tests) | ✅ Étape 10 validée. 7 tests T1→T7 passés. 4 bugs corrigés en cours de test : (1) lazy-init Resend évite plantage build si RESEND_API_KEY absente ; (2) cookie abo_* supprimé à la déconnexion artiste ; (3) /dashboard/mes-collabs query par beatmaker_id ET email_invite (déduplication) ; (4) beat_splits liés au beatmaker dès connexion Stripe Connect + endpoint /api/stripe/splits/debloquer pour retry splits en_attente. Limitation test mode Stripe documentée : transfers nécessitent solde disponible (carte 4000000000000077 plutôt que 4242). En production les vrais paiements alimentent le solde plateforme en continu. |
| 2026-05-20 | Homepage + Étape 11 (code) | ✅ Page d'accueil My Producer créée (deux entrées : beatmaker / artiste, lien boutique démo jakeb-test). Étape 11 CRM codée : liste clients agrégée (commandes + abonnements + clients), fiche client avec historique, détection doublons fuzzy matching + bouton Ignorer. Import BeatStars retiré (sera fait après analyse du vrai CSV). Fix middleware : toutes les pages /dashboard/* bloquées pour les artistes (redirection /mon-compte). Migration SQL étape 11 exécutée. |
| 2026-05-20 | Étape 11 (tests) | ✅ Étape 11 validée. 4 tests T1→T4 passés : liste CRM (stats + filtres Acheteurs/Abonnés/Leads), fiche client (historique + abonnement Plan Standard), doublons (page charge, message correct avec 1 seul client ayant un compte). |
