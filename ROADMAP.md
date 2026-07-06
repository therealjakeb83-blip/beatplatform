# My Producer — Roadmap V1

> Dernière mise à jour : 2026-07-04 — Phase 2b (Commerce : Tentatives de paiement) construite et validée de bout en bout (T1-T4 ✅) : table `tentatives_paiement`, 3 nouveaux hooks webhook, page Commandes fusionnée avec 3 nouveaux statuts. 4.5/4.8 restent en pause (raisons documentées ci-dessous), nom "My Producer" à reconsidérer possiblement en fin de projet (étape 17, coût de renommage vérifié bas). Prochaine session : les 8 workflows Phase 5 (Automatisations) en isolation, en commençant par la migration SQL (5.1).

## Légende
| Statut | Signification |
|--------|--------------|
| ⬜ À faire | Étape non commencée |
| 🔄 En cours | Étape en cours de développement |
| ✅ Validé | Étape terminée et testée |

---

## Progression globale : 12 / 17 étapes validées (+ 4 bonus, dont 2 en cours)

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
| 11b | **Résolution client** *(bonus)* | Chaque acheteur (invité ou connecté) reçoit un client_id unique. Résolution par email au checkout, fusion au compte à l'inscription. | — | ✅ Validé |
| 11c | **Optimisation CRM** *(bonus)* | 5 sprints : enrichissement liste/fiche (S1), BDD+LTV réelle (S2), RFM+Dashboard (S3), Email marketing intégré Resend (S4), Écoutes (S5 après étape 13) | — | 🔄 En cours |
| 11d | **Outil Business** *(bonus)* | Migration crm-proto → /dashboard/business. Back-office complet : CRM, Commerce, Analytics, Marketing (sprint dédié). Remplace et absorbe les étapes 12 (emails) et 13 (analytics). | — | 🔄 En cours |
| 12 | **Emails automatiques** | Post-achat, abonnement, renouvellement, annulation *(partiellement couvert par 11d Marketing)* | 4-6h | ⬜ À faire |
| 13 | **Analytics** | Compteur d'écoutes sur les cartes beat et page détail *(analytics back-office couvert par 11d)* | 2-3h | ✅ Validé |
| 14 | **Onboarding** | Parcours guidé de configuration à l'inscription | 5-8h | ⬜ À faire |
| 15 | **Admin** | Back-office plateforme : perf SaaS globales, perf par boutique, modération des demandes de certification (catégories, 11d Phase 7), outil interne d'import BeatStars (script scraping concierge). Dépendance dure avant l'étape 17 (déploiement officiel) | 10-15h | ⬜ À faire |
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

## Détail étape 11c — Optimisation CRM

> **Contexte :** Architecture décidée le 2026-05-21 après revue complète du CRM Airtable de Jake (2 300 clients, 4 415 commandes, 434 abonnements). Toutes les données validées une par une (liste vs fiche). 5 sprints planifiés.

### Données dans la liste CRM
Nom · **Statut abonnement** (ABONNÉ/ANCIEN ABONNÉ/JAMAIS ABONNÉ) · **Statut achat** (CLIENT/LEAD) · Langue (FR/US) · Nb achats · LTV · Dernière commande (date relative, hors rnvt) · Style préféré · Type beat préféré · Segment RFM

### Données dans la fiche client (tout ce qui est en liste + )
Email · Pays · Instagram · Adresse complète · Téléphone · Abonnement (statut brut, mois réglés, abonné depuis) · Panier moyen · Type de licence préféré · Codes promo utilisés · Préférences musicales complètes (styles, type beats, ambiances, instruments) · Historique achats détaillé · Beats téléchargés gratuitement non achetés (upsell) · Source d'acquisition · Newsletter consent · Score RFM détaillé

### Deux dimensions de statut indépendantes
**Dimension 1 — Statut abonnement :**
- ABONNÉ = abo actif (payant OU essai gratuit en cours — engagement formel même à 0€)
- ANCIEN ABONNÉ = a eu un abo, plus actif (annulé/expiré/on-hold/essai échoué)
- JAMAIS ABONNÉ = aucun abonnement jamais
- ⚠️ on-hold → ANCIEN ABONNÉ (pas de 4ème statut)

**Dimension 2 — Statut achat :**
- CLIENT = au moins une commande (même à 0€ via promo 100%)
- LEAD = aucune commande, aucun abonnement — dans le funnel uniquement
- La LTV visible permet de trier les clients à 0€ sans badge séparé

### Définition lead
Lead = contact qui a interagi mais n'a jamais acheté ni souscrit.
Sources : `free_download` (signal très fort — travaille avec le beat, veut potentiellement acheter) / `newsletter` (moyen) / `visite` (faible)
Affichage : bloc "X leads à convertir" en haut du CRM + filtre LEAD dans la liste
Transition : lead → client automatique au premier achat (source d'acquisition conservée en fiche)

### Upsell clients existants
Un client peut télécharger d'autres beats gratuitement → afficher dans sa fiche : "A téléchargé gratuitement (non achetés) : Beat X, Beat Y" → opportunité upsell directe

### Autres règles métier
- **LTV** = beats + créations abo + renouvellements. Exclut les remboursements.
- **Dernière commande** = hors renouvellements automatiques (passifs)
- **Mois réglés** = compteur de paiements réels (pas calculé depuis date_debut — faussé par on-hold)
- **Préférences musicales** = achats (poids fort) + favoris (poids moyen) + écoutes (poids faible, étape 13)
- **Score RFM** = Recency + Frequency + Monetary → segments : Champion / Fidèle / À risque / Dormant / À réactiver

---

### Sprint 1 — UI enrichissement (0 nouvelle colonne BDD) ✅ Validé

| # | Sous-étape | Statut |
|---|-----------|--------|
| S1.1 | Liste : requête `beats(styles, type_beat)` sur commandes + `pays` sur clients | ✅ |
| S1.2 | Liste : tracker `derniere_commande`, `a_deja_eu_abo`, `style_prefere`, `type_beat_prefere` par client | ✅ |
| S1.3 | Liste : badge Statut 3 états (ABONNÉ vert / ANCIEN ABONNÉ orange / JAMAIS ABONNÉ gris) | ✅ |
| S1.4 | Liste : nouveaux filtres (Tous / Abonnés / Anciens abonnés / Jamais abonnés / Leads) | ✅ |
| S1.5 | Liste : colonne Langue FR/US | ✅ |
| S1.6 | Liste : colonne Dernière commande (format relatif) | ✅ |
| S1.7 | Liste : colonne Style · Type beat (top 1 chacun) | ✅ |
| S1.8 | Liste : renommage "CA total" → "LTV" | ✅ |
| S1.9 | Fiche : requête favoris → beats(styles, type_beat, ambiances, instruments) via admin | ✅ |
| S1.10 | Fiche : calcul préférences (achats poids 2 + favoris poids 1) | ✅ |
| S1.11 | Fiche : badge Statut client + langue dans l'en-tête | ✅ |
| S1.12 | Fiche : mois réglés dans section abonnement | ✅ |
| S1.13 | Fiche : section "Préférences musicales" (style, type beat, ambiances, instruments) | ✅ |
| S1.14 | Fiche : renommage "CA total" → "LTV" | ✅ |

---

### Sprint 2 — BDD + LTV réelle + données enrichies ✅ Validé

BDD (migration `supabase/sprint2_crm.sql` exécutée) :
- `type_commande` sur `commandes` (LICENCE / CREATION_ABONNEMENT / RENOUVELLEMENT)
- `beat_id` + `licence_id` rendus nullables (commandes d'abonnement sans beat)
- `mensualites_payees integer DEFAULT 0` sur `abonnements_boutique`
- `instagram text` nullable sur `clients`
- `newsletter_consent boolean DEFAULT false` sur `clients`

Fonctionnalités livrées :
- Webhook `invoice.payment_succeeded` → commande CREATION_ABONNEMENT ou RENOUVELLEMENT + incrémente `mensualites_payees` (idempotent via invoice.id)
- Tag `type_commande = LICENCE` sur tous les nouveaux achats beats
- LTV complète (beats + paiements abo) — RENOUVELLEMENT exclu du nb_achats et dernière commande
- Mois réglés exact depuis `mensualites_payees` (avec fallback approx. si 0)
- Instagram éditable dans la fiche CRM (beatmaker uniquement)
- Badge Newsletter dans la fiche client
- Checkbox newsletter_consent à l'inscription artiste
- Toggle newsletter dans /[slug]/mon-compte
- Export CSV subscribers `/api/dashboard/crm/export-newsletter`

---

### Sprint 3 — Score RFM + Dashboard + Vues métier ✅ Validé

Fonctionnalités livrées (0 nouvelle colonne BDD) :
- Score RFM absolu : R/F/M chacun sur 5 → score global /100
- 8 segments automatiques : Champion / Fidèle / Potentiel / À risque / Dormant / À réactiver / Nouveau / Lead
- KPIs ligne 2 (Champions / Fidèles / À risque / Dormants) cliquables → filtre direct
- LTV moyenne ajoutée aux stats
- Section "Actions recommandées" : 3 vues métier contextuelles (clients à relancer / risque de partir / prêts à s'abonner)
- 6 filtres segments dans la liste (+ filtre pret_abo)
- Badge segment coloré dans chaque ligne
- Fiche client : bloc Score RFM avec R/F/M individuels + label (Nul→Excellent) + description du segment
- Fix fiche client : nbAchats exclut désormais les RENOUVELLEMENT (cohérence liste)
- Fix historique : labels corrects pour CREATION_ABONNEMENT et RENOUVELLEMENT

---

### Sprint 4 — Email marketing intégré ⬜ Fusionné dans 11d Phase 4

> **Note (2026-07-02) :** Ce sprint est absorbé par la Phase 4 de l'étape 11d ("Marketing : Fondations + Campagnes") — même socle technique que les Automatisations (Phase 5), donc construit dans le même chantier plutôt qu'isolément. Le contenu ci-dessous reste la référence fonctionnelle du workflow Campagnes.

Envoi de campagnes directement depuis My Producer via Resend, sans export/import manuel.

**Workflow beatmaker :**
1. Crée un segment dans le CRM
2. Choisit un template (nouvelle sortie / relance dormants / offre abonnement...)
3. Personnalise (tokens : `{{prénom}}`, `{{style_préféré}}`, `{{type_beat_préféré}}`...)
4. Envoie → Resend gère la délivrabilité

**Templates** : branding automatique de la boutique (logo, nom, lien boutique)

**Domaine d'envoi :**
- Par défaut : `[slug]@mail.myproducer.com` (zéro action)
- Option avancée : domaine propre du beatmaker
  - ✅ Domaines professionnels uniquement
  - ❌ Messageries publiques bloquées (Gmail, Hotmail, Yahoo, Outlook, iCloud, Orange, Free...)
  - Vérification DNS obligatoire

**RGPD :** envoi uniquement aux `newsletter_consent = true`, lien désinscription obligatoire, mise à jour auto en BDD via webhook Resend.

---

### Sprint 5 — Écoutes intégrées ⬜ À faire (après étape 13)

Quand le compteur de plays (étape 13) sera implémenté : les écoutes alimentent automatiquement les préférences musicales comme 3ème signal (poids faible).

---

## Détail étape 11d — Outil Business (migration crm-proto)

> **Contexte :** Migration de `c:\Users\nicoj\crm-proto` vers `beatplatform`. L'outil back-office complet s'intègre sous `/dashboard/business/` avec son propre layout et sidebar. Il remplace et absorbe partiellement les étapes 12 (emails) et 13 (analytics back-office). Plan validé le 2026-06-12 après session grill-me.

> **Décisions d'architecture complètes :** voir `memory/project_business_migration_decisions.md`

### Décisions clés

- **Route :** `/dashboard/business/` avec `layout.tsx` dédié + sidebar propre
- **Remplacement :** suppression des anciennes routes après migration (pas de redirections)
- **Codes promo :** table Supabase `codes_promo` + coupon Stripe créé à la volée (pas Stripe seul)
- **Splits :** `/dashboard/splits/` supprimée (sans utilité). Collabs = `/dashboard/business/collabs/` remplace `/dashboard/mes-collabs/`
- **Marketing :** sidebar avec cadenas 🔒, tables DB créées upfront, UI = sprint dédié post-migration
- **Analytics :** réécriture complète en SQL réel — onglet par onglet (Ventes en premier, Vue d'ensemble en dernier)
- **Paiements/Profil :** restent hors business (`/dashboard/paiements/`, `/dashboard/profil/`)

### Phase 0 — Foundation ✅ Validée

| # | Sous-étape | Statut |
|---|-----------|--------|
| 0.1 | Migration SQL `supabase/business_migration.sql` : 6 nouvelles tables + 5 colonnes + RLS | ✅ |
| 0.2 | Layout `app/dashboard/business/layout.tsx` + Sidebar avec auth réelle | ✅ |
| 0.3 | Utilitaires `app/dashboard/business/_lib/utils.ts` : initiales, joursDepuis, formatMontant, compareSigne | ✅ |

**Tables créées :** `codes_promo` · `listes_contacts` · `liste_membres` · `campagnes` · `free_downloads` · `morceaux_clients`

**Colonnes ajoutées :** `clients` (spotify, youtube, tiktok, notes, tags) · `beats` (couleur) · `commandes` (notes) · `abonnements_boutique` (fin_essai, annulation_en_cours)

### Phase 1 — CRM ✅ Complète

| # | Page | Route cible | Remplace | Statut |
|---|------|-------------|----------|--------|
| 1.1 | Contacts (liste) | `/dashboard/business/contacts/` | `/dashboard/crm/` | ✅ |
| 1.2 | Fiche client | `/dashboard/business/contacts/[id]/` | `/dashboard/crm/[clientId]/` | ✅ |
| 1.3 | Doublons | `/dashboard/business/doublons/` | `/dashboard/crm/doublons/` | ✅ |
| 1.4 | Segments | `/dashboard/business/segments/` | *(nouveau)* | ✅ |
| 1.5 | Listes | `/dashboard/business/listes/` | *(nouveau)* | ✅ |

**Suppressions après Phase 1 :** `/dashboard/crm/` (liste, fiche, doublons, email/[encodedEmail])

### Phase 2 — Commerce ✅ Complète

| # | Page | Route cible | Remplace | Statut |
|---|------|-------------|----------|--------|
| 2.1 | Commandes + fiche | `/dashboard/business/commandes/` + `/[id]/` | `/dashboard/commandes/` | ✅ |
| 2.2 | Abonnements | `/dashboard/business/abonnements/` | liste de `/dashboard/abonnements/` | ✅ |
| 2.3 | Plans | `/dashboard/business/plans/` | config de `/dashboard/abonnements/` | ✅ |
| 2.4 | Beats (CRUD) | `/dashboard/business/beats/` | `/dashboard/beats/` (+ sous-routes) | ✅ |
| 2.5 | Licences | `/dashboard/business/licences/` | `/dashboard/licences/` | ✅ |
| 2.6 | Codes promo + fiche | `/dashboard/business/codes-promo/` + `/[id]/` | `/dashboard/codes-promo/` | ✅ |
| 2.7 | Collabs | `/dashboard/business/collabs/` | `/dashboard/mes-collabs/` | ✅ |

**Suppressions après Phase 2 :** ✅ effectuées (`refactor(dashboard): supprimer les pages en double avec business`, 2026-06-26). Il ne reste sous `app/dashboard/` que `business/`, `paiements/`, `profil/` (hors racine et déconnexion).

### Phase 2b — Commerce : Tentatives de paiement 🔴 Priorité (nouveau, 2026-07-04)

> **Contexte :** En creusant le workflow "tentative d'achat échouée" de la Phase 5 (Marketing), Jake a découvert que la page Commandes affiche des onglets "En attente"/statuts qui ne sont **jamais réellement peuplés** — vérifié dans le code : `commandes.statut` est toujours écrit en dur à `'payee'` à la création, dans les deux seuls endroits où une commande est insérée (`app/api/stripe/webhook/route.ts`). Une commande n'existe en base que si le paiement a réussi ; aucun panier abandonné ni paiement échoué n'est tracké nulle part. **Jake considère que régler ça est prioritaire**, avant de reprendre les workflows Marketing. Détail complet des décisions dans `memory/project_commerce_tentatives_paiement.md`.

**Décision d'architecture :** ne pas toucher à `commandes` (contraintes NOT NULL sur `client_id`/`beat_id`/`licence_id`/`prix_paye`, référencée partout — Analytics, CRM LTV/RFM, Codes promo, Splits — en supposant que chaque ligne est une transaction confirmée). Nouvelle table séparée `tentatives_paiement`, sur le modèle Shopify (Checkout ≠ Order) :

```sql
tentatives_paiement (
  id, created_at,
  beatmaker_id (not null), beat_id (not null), licence_id (not null),
  client_id (nullable — résolu si connecté, sinon inconnu tant que Stripe n'a pas renvoyé l'email),
  email (nullable, capturé via Stripe),
  prix (not null),
  stripe_session_id (unique, not null),
  statut ('creee' | 'complete' | 'expiree' | 'echouee'),
  commande_id (nullable, lien vers la commande réelle si succès),
  code_promo, source_marketing
)
```

Extension future prévue si un vrai panier multi-articles voit le jour : table enfant `tentatives_paiement_lignes` (migration additive, pas de réécriture).

| # | Sous-étape | Statut |
|---|-----------|--------|
| 2b.1 | Migration SQL : table `tentatives_paiement` + RLS + GRANT authenticated/service_role (`supabase/phase2b_tentatives_paiement.sql`) | ✅ |
| 2b.2 | Modifier `/api/stripe/checkout/route.ts` : insérer une ligne `tentatives_paiement` (statut `creee`) juste après `stripe.checkout.sessions.create()` (l'id de session est requis pour la ligne) | ✅ |
| 2b.3 | Nouveaux hooks webhook Stripe : `checkout.session.completed` (étendu → `complete` + lien `commande_id`), `checkout.session.expired` (nouveau → `expiree`), `payment_intent.payment_failed` (nouveau → recherche de la session via `stripe.checkout.sessions.list` puis `echouee`) | ✅ |
| 2b.4 | Page Commandes fusionnée : `commandes` + `tentatives_paiement` (hors `complete`, déjà représentées par la vraie commande) dans une seule liste triée, 3 nouveaux statuts (Panier en cours / Abandonnée / Échouée), lien détail/facture désactivé pour les tentatives | ✅ |
| 2b.5 | Tests bout en bout | ✅ |

> **Phase 2b validée le 2026-07-04** — T1 (achat réussi, non-régression), T2 (carte refusée → email/client bien résolus après correctif), T3 (panier créé immédiatement, expiration 24h fiable par construction), T4 (abonnement → aucune ligne `tentatives_paiement`, scope respecté).
>
> **Débloque :** le workflow "Tentative d'achat échouée" (9e recette Phase 5) et une future automatisation "panier abandonné" peuvent maintenant être construits.
>
> **Action Jake :** exécuter `supabase/phase2b_tentatives_paiement.sql` dans l'éditeur SQL Supabase, puis ajouter les événements `checkout.session.expired` et `payment_intent.payment_failed` dans la config webhook du Dashboard Stripe (même écran que pour `account.updated` à l'étape 10).

### Phase 3 — Analytics ✅ Complète

Composants communs : `PeriodeSelector.tsx` · `KpiCard.tsx` · `ChartCard.tsx` · `AnalyticsLineChart.tsx` · `MiniBar.tsx`

| # | Onglet | Source SQL | Statut |
|---|--------|------------|--------|
| 3.1 | Ventes | `commandes` | ✅ |
| 3.2 | MRR/ARR (Abonnements) | `abonnements_boutique` | ✅ |
| 3.3 | Revenus | `commandes` + `abonnements_boutique` | ✅ |
| 3.4 | Préférences | `commandes → beats.styles[]` | ✅ |
| 3.5 | Codes promo | `codes_promo` + `commandes` | ✅ |
| 3.6 | Beats (+ page détail par beat) | `commandes` + `beats` + `beat_plays` | ✅ |
| 3.7 | Vue d'ensemble | Agrégation de tout | ✅ |

**Livré au-delà du périmètre initial :**
- Tracking écoutes (`beat_plays`) : seuil 30s, durée d'écoute, pays (RGPD-safe), device
- Tracking source marketing (9 sources : YouTube, Instagram, TikTok, Google, Google Ads, YouTube Ads, Newsletter, Direct, Autre) de la visite jusqu'à la commande
- Page détail beat : KPIs favoris/CA par licence/source, tables dynamiques par KPI
- Granularité adaptative des graphiques (jour/semaine/mois selon la période) + périodes semaine
- Décision **CA net = CA HT** (`brut − remises − TVA`, pas juste `brut − TVA`) appliquée uniformément sur Overview/Ventes/Revenus/Codes promo
- KPIs cliquables pilotant le graphique sur la plupart des onglets (Ventes, Revenus, Abonnements, Codes promo)

### Phase 4 — Marketing : Fondations + Campagnes 🔄 En cours

> **Contexte :** Décision prise le 2026-07-02. Fusionne le Sprint 4 du CRM (11c, jamais codé) avec les fondations nécessaires aux Automatisations (Phase 5) — les deux partagent le même socle : ciblage par segment (déjà construit), stockage de templates avec tokens, envoi Resend. La sidebar a déjà un item "Marketing" verrouillé 🔒 avec sous-items "Campagnes"/"Templates" placeholder (`Sidebar.tsx`) — cette phase les déverrouille. Construit en premier : Automatisations et Transactionnels en dépendent/en profitent ensuite.

| # | Sous-étape | Statut |
|---|-----------|--------|
| 4.1 | Migration SQL : table `templates_email` (bibliothèque réutilisable, tokens `{{prénom}}`/`{{style_préféré}}`/`{{type_beat_préféré}}`...) + ajout colonne `contenu` sur `campagnes` (le corps du mail manque actuellement) | ✅ |
| 4.2 | Wrapper d'envoi Resend générique (`lib/mailing.ts`) : résout les destinataires d'un segment, remplace les tokens, filtre `newsletter_consent = true`, injecte le lien de désinscription | ✅ |
| 4.3 | Page `/dashboard/business/marketing/campagnes/` : liste + création (segment → template → personnalisation → envoi immédiat/planifié) | ✅ |
| 4.4 | Page `/dashboard/business/marketing/templates/` : bibliothèque de templates (créer/dupliquer/éditer), branding automatique boutique (logo, nom, lien) | ✅ |
| 4.5 | Domaine d'envoi : `[slug]@mail.myproducer.com` par défaut, option domaine propre (pro uniquement, webmails bloqués, vérification DNS) | ⏸️ *En pause — voir note ci-dessous* |
| 4.6 | Webhook Resend : désinscription → mise à jour `newsletter_consent` en BDD | ✅ |
| 4.7 | Déverrouiller "Campagnes"/"Templates" dans la sidebar (retirer le 🔒 de `Sidebar.tsx`) | ✅ |
| 4.8 | Tests bout en bout | ⏸️ *En pause — voir note ci-dessous* |

> **Note (2026-07-04) — 4.5 et 4.8 mis en pause, pas oubliés :**
> - **4.8** sera fusionnée dans un futur passage page-par-page UX/UI de tout le SaaS avant lancement (Jake prévoit de tout retester à ce moment-là) — inutile de dupliquer l'effort avec une checklist dédiée maintenant. Stopgap `campagnes@jakebmusic.com` (cf 4.3) reste actif et fonctionnel en attendant.
> - **4.5** est bloquée par une question de fond, pas de DNS : le nom **"My Producer" n'est peut-être pas définitif** (Jake réfléchit à un nom de marque plus distinctif — pistes explorées : direction "premium"/francophone type "Maison"). Configurer DKIM/SPF/DMARC sur `mail.myproducer.com` maintenant serait prématuré si le nom change. **Décision : reporté à l'étape 17 (déploiement)**, coût de renommage vérifié bas (texte d'affichage + config uniquement, aucun impact architecture — détail dans `memory/project_naming_deferred.md`).

### Phase 5 — Marketing : Automatisations 🔄 Repensée le 2026-07-04 (pas encore codée)

> **Contexte original (2026-07-02) :** V1 = recettes prédéfinies personnalisables, déclencheur stocké en config générique (`type` + `params` JSON) pour évoluer vers un constructeur custom sans migration. Réutilise le ciblage segment + `templates_email` de Phase 4.
>
> **Refonte complète (2026-07-04) :** au lieu d'inventer des recettes abstraites, Jake a fourni ses **5 workflows réels** (texte exact) déjà utilisés sur sa propre boutique + une réflexion approfondie sur la gestion des combinaisons d'événements. Textes exacts dans `docs/automatisations/exemples-workflows.md`, détail complet des décisions dans `memory/project_phase5_automatisations_redesign.md`. **Prérequis avant de commencer : Phase 2b (Commerce — Tentatives de paiement) doit être terminée**, sinon le 9e workflow (tentative d'achat échouée) reste hors de portée.

**Méthode de construction validée par Jake (dans cet ordre) :**
1. Coder les 8 workflows ci-dessous **en isolation totale**, sans aucune logique de combinaison
2. Puis lister les combinaisons réalistes entre workflows (plusieurs déclencheurs le même jour, même client) et décider quoi faire pour chacune
3. Enfin, brancher un système IA — **uniquement** pour les combinaisons vraiment rares/anecdotiques (pas pour l'ensemble des emails)

**Les 8 workflows (V1 "seuls", avant combinaisons) :**

| # | Workflow | Détail | Statut |
|---|---|---|---|
| 5.6a | Bienvenue abonnement | Nouvel abonnement — texte réel fourni par Jake | ✅ *(validé le 2026-07-04)* |
| 5.6b | Abonnement en attente | Échec de renouvellement (pas annulation) — `{{mois_avant_cadeau}}`. Statut `impaye` désormais distingué de `annule` dans le webhook ; délai de grâce d'1 mois avant annulation automatique (`/api/cron/abonnements-impayes`) ; récurrence du beat cadeau configurable par le beatmaker (`abo_recurrence_cadeau_mois`, page `/dashboard/business/plans`) au lieu d'un "4 mois" fixe ; `mois_consecutifs` enfin réellement incrémenté/remis à zéro | ✅ *(codé le 2026-07-06, à tester)* |
| 5.6c | Churn message perso | Annulation réelle — distinct de la confirmation robotique d'annulation (Phase 6 Transactionnels) | ⬜ |
| 5.6d | Remerciement achat | 4 paliers (1er/2e/3e/4e et +, basé sur données réelles : 1.5 commande/client en moyenne, 3.1 chez les récurrents) + variable conditionnelle singulier/pluriel dans le système de tokens (bien expliquée dans l'UI) | ⬜ |
| 5.6e | Bienvenue perso | Compte créé sans achat/abo le jour même — ne se déclenche que si rien d'autre ne s'est passé ce jour-là (règle de suppression) | ⬜ |
| 5.6f | Relance inactivité | X mois sans achat — n'existe pas chez Jake, à construire de zéro | ⬜ |
| 5.6g | Follow-up free download | Tracking déjà existant (`free_downloads`) — Jake n'a pas de texte de référence, à rédiger ensemble | ⬜ |
| 5.6h | Follow-up favori | Tracking déjà existant (`favoris`, jointure via `beats` pour le `beatmaker_id`) — pas de texte de référence, à rédiger ensemble | ⬜ |

> 9e workflow **en attente** : Tentative d'achat échouée — bloqué tant que la Phase 2b (Commerce) n'est pas terminée.
>
> Tous les emails envoyés en **J+1** (jamais le jour même) — choix délibéré de Jake pour ne jamais sonner robotique.

**Décisions d'architecture actées :**
- Éditeur de contenu : **simple** (objet + corps en `ChampAvecVariables`), pas le `BlocEditor` complet — un message perso n'a pas besoin de sections beats/CTA/promo.
- Ciblage : **paramètre simple** par recette (ex. nombre de mois), pas de constructeur ET/OU façon Segments pour cette V1.
- `config jsonb` générique dès 5.1 (permet d'évoluer vers un vrai constructeur custom plus tard sans migration). Un vrai workflow multi-étapes nécessiterait une table additionnelle plus tard (`automatisation_etapes`) — migration additive, pas une réécriture.
- Pas de constructeur de workflow libre pour les beatmakers en V1 — ils configurent 8 recettes fixes, ils n'en créent pas.

**Gestion des combinaisons (étape 2 du séquencement, déjà cadrée) :**
- Regrouper en "slots" mutuellement exclusifs : Abonnement (bienvenue/en attente/churn — un seul état net), Achat (1 seul palier actif), Bienvenue perso (exclusif), Relance inactivité (toujours seul).
- État net pour événements contradictoires : abonnement créé + annulé le même jour → s'annule, silence total sur l'abonnement ce jour-là.
- Combos fréquentes/prévisibles → **template combiné codé en dur, pas d'IA** : Achat+Abonnement bienvenue (cas prioritaire pour Jake), Achat+Abonnement en attente, Achat+Tentative échouée, Achat+Abonnement+Tentative échouée (Jake a déjà écrit un exemple réel combinant les 3, cf exemple "Kaaris" dans la mémoire).
- Combos rares/anecdotiques (ex. Achat+Churn le même jour) → **IA + validation humaine** : le cron détecte la combinaison, génère un brouillon (à partir des textes de Jake comme référence de ton), notifie (email + badge dashboard business, notif mobile plus tard), Jake édite/valide avant envoi. Pas de péremption : le texte est re-rendu à chaque ouverture pour adapter la référence temporelle ("hier"/"lundi"/"il y a quelques jours") à la date réelle de validation.
- Raison du choix hybride : fiabilité (rien ne part sans relecture humaine sur l'imprévisible) + coût (l'IA ne tourne que sur des cas rares dans de petites boutiques) — un tout-IA automatique aurait été risqué (pas de relecture avant envoi) et coûteux en continu.

| # | Sous-étape | Statut |
|---|-----------|--------|
| 5.1 | Migration SQL (`supabase/phase5_automatisations.sql`) : `automatisations` (config par recette), `automatisation_evenements` (file d'attente déposée par les webhooks), `automatisation_envois` (log idempotent) + RLS | ✅ |
| 5.2 | Les 8 workflows en isolation (contenu + déclencheur) — **construits un par un** : 2/8 codés (Bienvenue abonnement validé, Abonnement en attente à tester) | 🔄 |
| 5.3 | Cron quotidien `/api/cron/automatisations` (pattern `splits-expiration`) : scan `automatisation_evenements` non traités, échéance calculée par événement | ✅ *(pilote)* |
| 5.4 | Hooks événementiels : `abonnement/succes/route.ts` résout/crée le client puis dépose l'événement `bienvenue_abonnement` | ✅ *(pilote — 1/6 événements)* |
| 5.5 | Page `/dashboard/business/marketing/automatisations/` : éditeur simple (objet/corps + palette de variables), toggle actif, **file d'attente** (événements en attente + bouton "Exécuter maintenant") — structure prête à accueillir les 7 autres recettes | ✅ *(pilote, validé — email reçu après exécution manuelle le 2026-07-04)* |
| 5.6 | Rédaction des textes manquants (free download, favori) avec Jake | ⬜ |
| 5.7 | Combinaisons : règles de résolution (état net, slots, templates combinés fréquents) | ⬜ |
| 5.8 | Système IA + validation humaine pour combinaisons rares (génération brouillon, notification email+badge, file d'attente de validation) | ⬜ |
| 5.9 | Tests bout en bout | ⬜ |

> **Mécanique de planification (2026-07-04) :** reprend le système réel de la boutique perso de Jake (AutomateWoo), pas un simple délai fixe — chaque recette a un `delai_heures` (attente minimum) + une `heure_cible_minutes` optionnelle (heure de Paris, ex. 10h15) : l'envoi part à la prochaine occurrence de cette heure après le délai, jamais à l'heure exacte de l'événement (un achat à 3h55 ne génère jamais un mail à 3h55 le lendemain). Heure cible désactivée = mode test, envoi dès le délai passé.
>
> **Limite Vercel Hobby découverte en testant :** les cron jobs ne tournent qu'une fois par jour sur ce plan (±1h de précision) — pas de vérification "toutes les 2 minutes" comme sur AutomateWoo tant que le passage à Vercel Pro (déjà prévu avant lancement) n'est pas fait. En attendant, le bouton "Exécuter maintenant" de la file d'attente permet de tester/débloquer un envoi à tout moment.
>
> **Limitation connue du pilote :** `lib/automatisations.ts` construit un destinataire minimal (identité + boutique) sans les statistiques CRM (LTV, RFM, préférences) — celles-ci exigent une session utilisateur (`chargerContactsEnrichis`), indisponible en contexte cron/webhook (service_role). Suffisant pour les textes de Jake, qui ne référencent que l'identité. À enrichir si un futur workflow a besoin de plus (ex. `{{nb_achats}}`).
>
> **✅ Point de vigilance scaling — corrigé le 2026-07-04 :** `/api/cron/automatisations` traitait les événements séquentiellement (un par un), avec un risque de dépasser le temps d'exécution max si beaucoup de boutiques partagent la même heure cible. Corrigé : traitement par lots de 20 en parallèle (`Promise.all`) + plafond de 500 événements par passage (le surplus attend simplement le passage suivant, rien n'est perdu). Reste en réserve si le besoin se confirme un jour à très grande échelle : décalage d'heure cible par boutique (jitter), ou passage à un système de réveil individuel par événement (ex. Vercel Workflows) plutôt qu'une ronde périodique partagée.
>
> **Limite connue (5.6b) :** `automatisation_evenements` a une contrainte `UNIQUE (type, reference_id)`. Pour `abonnement_en_attente`, `reference_id` = l'id de l'abonnement — donc si un même abonnement retombe en impayé une 2e fois après s'être rétabli entre-temps, l'insert échoue (erreur loguée dans `[webhook] Erreur insert automatisation_evenements`, pas de crash) et l'email n'est pas renvoyé pour ce 2e épisode. Edge case jugé rare, non traité pour l'instant plutôt que de complexifier le modèle de référence — à corriger si ça se présente en pratique (ex. générer un id de référence par épisode plutôt que par abonnement).

### Phase 6 — Mailing : Transactionnels ⬜ À faire

> **Contexte :** Décisions prises le 2026-07-02. Comble un vrai trou produit — aujourd'hui **aucun** email de confirmation n'est envoyé après un achat ou un abonnement (seuls les emails de splits/collab existent dans `lib/emails.ts`). Indépendant du socle Marketing (pas de ciblage segment) mais peut réutiliser le wrapper d'envoi Resend de la Phase 4. Personnalisation limitée à quelques champs (pas d'éditeur HTML libre) : intro, signature, couleur/logo — le reste du template reste fixe côté plateforme, avec fallback par défaut si le beatmaker n'a rien personnalisé.

| # | Sous-étape | Statut |
|---|-----------|--------|
| 6.1 | Migration SQL : table `templates_transactionnels` (beatmaker_id, type, champs custom limités) + RLS + GRANT | ⬜ |
| 6.2 | `lib/emails.ts` : nouvelles fonctions `confirmationCommande`, `confirmationAbonnement`, `annulationAbonnement` (branding dynamique + fallback défaut) | ⬜ |
| 6.3 | Hooks webhook Stripe : envoi à `checkout.session.completed` (commande + abonnement) et `customer.subscription.deleted` (annulation) | ⬜ |
| 6.4 | Page `/dashboard/business/mailing/transactionnels/` : liste des 3 types + formulaire d'édition (champs limités) + preview | ⬜ |
| 6.5 | Nouvel onglet sidebar "Mailing" (sous-section Transactionnels) | ⬜ |
| 6.6 | Tests bout en bout | ⬜ |

### Phase 7 — Catégories & Certification ⬜ À faire

> **Contexte :** Décisions prises le 2026-07-02. Aujourd'hui les 4 listes (`STYLES_OPTIONS`, `AMBIANCES_OPTIONS`, `INSTRUMENTS_OPTIONS`, `TYPE_BEAT_OPTIONS`) sont hardcodées dans `BeatForm.tsx`, stockées en `text[]` libre sur `beats`. Cible : Ambiances/Instruments fixés par la plateforme (lecture seule, comportement UI déjà correct via `TagSelector`) ; Styles/Type beat en mode hybride (ajout libre par beatmaker via `HybridTagSelector`, visible seulement par lui, avec certification plateforme optionnelle qui rend la catégorie globale et non modifiable). Objectif long terme : dashboard tendances basé uniquement sur les catégories certifiées. La validation des demandes de certification est manuelle en V1 (page interne simple, accès Jake) — la vraie modération back-office est absorbée par l'étape 15 (Admin), dont le périmètre a été élargi en conséquence.

| # | Sous-étape | Statut |
|---|-----------|--------|
| 7.1 | Migration SQL : table `categories` (type, nom, source plateforme/beatmaker, beatmaker_id nullable, statut actif/en_attente_certification/certifiee) + seed des 4 listes hardcodées en `source=plateforme` | ⬜ |
| 7.2 | Rebrancher `BeatForm.tsx` (`TagSelector`/`HybridTagSelector`) sur la table `categories` au lieu des constantes hardcodées | ⬜ |
| 7.3 | Ambiances/Instruments : lecture seule (source=plateforme uniquement) | ⬜ |
| 7.4 | Styles/Type beat : ajout libre par beatmaker → insert `categories` en `source=beatmaker`, visible uniquement par lui | ⬜ |
| 7.5 | Bouton "Demander la certification" sur une catégorie custom → statut `en_attente_certification` | ⬜ |
| 7.6 | Page de validation manuelle (interne, accès Jake) : approuver/rejeter → une fois certifiée, catégorie globale + non modifiable | ⬜ |
| 7.7 | Page `/dashboard/business/categories/` : 4 onglets (Styles/Ambiances/Instruments/Type beat) | ⬜ |
| 7.8 | Dashboard tendances *(V2, après volume de données suffisant)* : agrégation commandes × catégories certifiées | ⬜ |

### Phase 8 — Dashboard business (accueil) ⬜ À faire

> **Contexte :** Repoussée en dernier (décision 2026-07-02) — cette page agrège des KPIs et alertes de **tous** les modules business, y compris Marketing (Phases 4-5), Mailing (Phase 6) et Catégories (Phase 7) qui n'existaient pas encore. La coder avant ces modules obligerait à la refaire.

| # | Sous-étape | Statut |
|---|-----------|--------|
| 8.1 | Page `/dashboard/business/` : KPIs du mois, nouveaux clients, abonnés actifs, alertes, liens rapides | ⬜ |

---

## Étape 12 — Free Download (boutique + CRM)

> **Contexte :** Permettre aux visiteurs de télécharger gratuitement les beats marqués `free_download_actif = true`. Génère automatiquement un lead `source = 'free_download'` et log dans `free_downloads`. Décision prise le 2026-06-13.

### Décisions clés

- **Téléchargement :** double livraison — URL R2 signée retournée directement (DL immédiat) + email Resend avec le même lien (assurance si fermeture fenêtre)
- **Disclaimer :** message hardcodé V1 (usage personnel, maquette, réseaux OK, streaming interdit) — paramétrable par beatmaker en V2
- **Compte :** inscription obligatoire via 2 checkboxes (newsletter + création compte). Compte invité créé si non connecté (même pattern que webhook Stripe)
- **Source lead :** si le visiteur est déjà lead/client, la source existante est conservée (pas d'écrasement). Seul un nouveau lead prend `source = 'free_download'`
- **Fichier livré :** `mp3_tague_url` (MP3 taguée, seul fichier disponible sans achat de licence)

### Sous-étapes

| # | Sous-étape | Fichiers touchés | Statut |
|---|-----------|-----------------|--------|
| 12.1 | SQL : GRANT service_role sur `free_downloads` + vérification table créée | `supabase/service_role_grants.sql` | ⬜ |
| 12.2 | Boutique — page catalogue : ajouter `free_download_actif` dans SELECT + prop `BeatPublic` + badge sur `BeatCard` | `app/[slug]/page.tsx` · `BeatCard.tsx` | ⬜ |
| 12.3 | Boutique — page beat : ajouter `free_download_actif` dans SELECT + section "Télécharger gratuitement" | `app/[slug]/[beatId]/page.tsx` | ⬜ |
| 12.4 | Composant `FreeDLModal.tsx` : disclaimer + formulaire email/checkboxes (non connecté) ou bouton direct (connecté) | `app/[slug]/_components/FreeDLModal.tsx` (nouveau) | ⬜ |
| 12.5 | API POST `/api/free-download` : vérif beat, upsert client, upsert lead, insert free_downloads, signed URL + email Resend | `app/api/free-download/route.ts` (nouveau) | ⬜ |
| 12.6 | Dashboard — Fiche client onglet Activité : remplacer placeholder par requête réelle `free_downloads` | `app/dashboard/business/contacts/[id]/page.tsx` | ⬜ |

### Règles métier importantes

- Un beat `free_download_actif = true` doit avoir un `mp3_tague_url` non null — sinon le bouton est masqué
- Un client connecté qui a déjà téléchargé ce beat → le bouton reste actif (re-téléchargement autorisé, log quand même)
- Un client connecté qui a **acheté** ce beat → afficher "Vous avez acheté ce beat" à la place du bouton Free DL
- `free_downloads.achete` : mis à `true` automatiquement si une commande pour ce beat existe déjà (à la requête)

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
| 2026-05-20 | Étape 11b — Résolution client (bonus) | ✅ FK clients→auth.users supprimé. Webhook Stripe crée/résout le client par email à chaque achat. lierCompteClient fusionne le compte invité dans le compte auth à l'inscription. 15 clients fictifs + 45 commandes + 5 abonnements insérés en BDD pour tests réalistes. Fix affichage prix abonnement (centimes → décimales : 6,99€/mois). |
| 2026-05-20 | Optimisation CRM (11c) — décisions initiales | Analyse du CRM Airtable de Jake. Décisions prises pour 3 sprints : badge Statut client, LTV, Langue, Instagram, newsletter. À coder en session suivante. |
| 2026-05-21 | Optimisation CRM (11c) — architecture complète | Revue exhaustive de toutes les tables Airtable (CLIENTS, COMMANDES, ABONNEMENTS, IDENTIFIANTS). Validation donnée par donnée (liste vs fiche). Architecture CRM étendue à 5 sprints. Décisions clés : 2 dimensions de statut indépendantes (abonnement + achat), LTV inclut tout, mois réglés = compteur réel, préférences musicales depuis achats+favoris. Leads : définition, sources, score chaleur, affichage CRM. Email marketing Resend : templates brandés, domaine `[slug]@mail.myproducer.com` par défaut + domaine pro (pas de webmail). Sprint 1 entièrement planifié (14 sous-étapes, 0 BDD). |
| 2026-05-21 | Optimisation CRM (11c) — Sprint 1 + Sprint 2 ✅ | Sprint 1 : badge statut abo 3 états, filtres, LTV, langue, dernière commande, style/type beat, préférences musicales (achats×2 + favoris×1). Sprint 2 : type_commande, mensualites_payees, LTV réelle (webhook invoice.payment_succeeded), instagram éditable, newsletter_consent + checkbox inscription + toggle mon-compte + export CSV. Migration SQL : supabase/sprint2_crm.sql exécutée. |
| 2026-05-21 | Optimisation CRM (11c) — Sprint 3 ✅ | Score RFM (R/F/M /5 → score /100). 8 segments auto (Champion/Fidèle/Potentiel/À risque/Dormant/À réactiver/Nouveau/Lead). KPIs ligne 2 cliquables. LTV moyenne. Section "Actions recommandées" (3 vues métier). 6 filtres segments. Badge segment dans chaque ligne. Fiche : bloc RFM complet avec description. Fix nbAchats + historique labels. |
| 2026-06-12 | Outil Business (11d) — Plan validé | Session grill-me : 14 décisions d'architecture prises. Plan de migration crm-proto → /dashboard/business en 4 phases (Foundation → CRM → Commerce → Analytics → Dashboard). Décisions clés : layout dédié, suppression anciennes routes, codes promo table Supabase, splits supprimés, Marketing en placeholder 🔒, analytics onglet par onglet. Roadmap mise à jour. |
| 2026-06-13 | Outil Business (11d) — Phase 0 + CRM 1.1 + 1.2 ✅ | Foundation validée (SQL + layout + sidebar). Vue Contacts : 4 onglets (Tous/Clients/Abonnés/Leads), KPIs, filtres, préférences. Vue Leads : score chaleur, 20 leads de test. Fiche client : 7 onglets (Identité/Abonnement/Commandes/Préférences/Newsletter/Activité/Morceaux). Fix lead 42501 : GRANT authenticated + service_role manquants sur table `leads`. |
| 2026-06-13 | Étape 12 — Free Download — Décisions | Périmètre complet planifié : boutique (badge BeatCard + modal + page beat) + API (client invité + lead upsert + free_downloads + signed URL + email Resend) + dashboard fiche client Activité. 6 sous-étapes documentées. Double livraison (DL direct + email). **PROCHAINE ÉTAPE : 12.1 SQL puis 12.2→12.6 code.** |
| 2026-06-15 | Outil Business (11d) — Phase 1.3 Doublons ✅ | Page Doublons complète : algorithme Levenshtein (email + nom + téléphone), KPIs, paires ignorer/désignorer, fusion manuelle via FusionWizard, historique des fusions (défusion possible). Table `fusions_crm` + `doublons_ignores`. |
| 2026-06-17 | Outil Business (11d) — Fiche client + Phase 1.4 Segments ✅ | Fiche client : surnom CRM, nom_artiste, téléphone et langue éditables (bouton save inline). Segments : filter builder ET/OU custom, badge statut intégré comme condition (est/n'est pas/est parmi), compteurs dynamiques, edit mode, dropdowns catalogue. |
| 2026-06-19 | Outil Business (11d) — Phase 1.5 Listes + Phase 2.1 Commandes ✅ | Listes CRM : création/modification/suppression + détail liste, ajout/retrait contacts depuis modale, sélecteur de colonnes dynamique (15 colonnes, localStorage), drag & drop sur les headers. Commandes : liste complète + fiche détail (Articles HT/TVA, Historique téléchargements, Liens, Timeline auto, Remboursement, Renvoyer email). Fix fiche commande : admin client pour join clients. |
| 2026-06-20 | Bug fix — Historique téléchargements ✅ | `licence_downloads` manquait d'un `GRANT INSERT TO service_role`. Ajout `supabase/licence_downloads_grants.sql`. Historique téléchargements fonctionnel (date, fichier, IP). Comportement confirmé : les DL depuis le dashboard beatmaker ne sont pas loggués (correct). |
| 2026-06-24 | Outil Business (11d) — Phase 2 Commerce ✅ | 6 pages migrées vers `/dashboard/business/` : Abonnements (liste + fiche + actions Stripe annuler/réactiver), Plans, Beats (catalogue avec CA/ventes/licences actives via `beat_licences`), Codes promo (module complet : création/édition/duplication/statut), Licences, Collabs. Anciennes routes dashboard supprimées en fin de phase. |
| 2026-06-25 | Codes promo checkout + lancement Analytics (Phase 3, 11d) | Codes promo appliqués **côté serveur avant Stripe** (restriction email vérifiée au "Confirmer", licences éligibles). Collabs : détail des ventes par beat + relevé PDF annuel. Module Analytics lancé : tracking écoutes (seuil 30s), 7 onglets. Fix unités critique : `commandes.prix_paye`/`reduction_montant` sont en **euros décimaux**, pas en centimes (contrairement à `split_payments.montant` qui reste en centimes). |
| 2026-06-26 | Analytics — enrichissements + nettoyage dashboard | KPI favoris + ARR sur Vue d'ensemble, CA net isolé en KPI indépendante (Ventes), page détail beat (favoris, CA par licence/source, tables dynamiques par KPI, colonnes N° commande + client cliquables), fix graphiques (marge, axe Y). Suppression des dernières pages `/dashboard/*` dupliquées avec `business/`. |
| 2026-06-27 | Analytics — tracking sources marketing + durée d'écoute | 9 sources trackées de la visite à la commande (YouTube, Instagram, TikTok, Google, Google Ads, YouTube Ads, Newsletter, Direct, Autre) — détection via UTM/gclid/gbraid/referrer. Durée d'écoute (`PlayerContext` + endpoint dédié, envoi sur navigation + `visibilitychange`). Ventes : KPIs cliquables pilotent le graphique, légende source interactive. Granularité adaptative des graphiques + périodes semaine. Nouvelle mise en page catalogue boutique (membres en premier). |
| 2026-06-29 | Analytics — page détail beat + Abonnements | Granularité adaptive + tooltip `fullLabel` sur le détail beat, panier moyen sur Overview. KPIs Abonnements réactifs à la période sélectionnée. Churn : nombre d'annulations affiché en plus du taux. |
| 2026-07-02 | Analytics — Abonnements, Revenus, Préférences, Codes promo | **Abonnements** : 5 KPIs cliquables, badges Actuel/Tous temps/Cette période, rétention moyenne cliquable avec snapshot par slot. **Décision CA net = CA HT** (`brut − remises − TVA`) actée et appliquée à tout le module (Overview/Ventes/Revenus, puis Codes promo). **Revenus** : CA moyen net/brut sélectionnable, colonne "Remises" (remplace "Codes promo"). **Préférences** : sélecteur de catégorie pour le graphique, fix ligne "Autre" et KPIs. **Codes promo** : colonne Type (panier/produit/abonnement), code cliquable vers la fiche Commerce, CA brut (TTC)/net (HT) distingués en KPI + colonnes tableau, toutes les données scopées à la période sélectionnée, codes sans utilisation sur la période masqués du tableau. Jeu de données de test ajouté : 10 codes promo + 30 commandes sur la boutique test (`supabase/seed_codes_promo.sql`) pour valider visuellement les changements. |
| 2026-07-02 | Outil Business (11d) — Phases 4-8 planifiées + Admin (15) élargi | Session de planification (pas de code). Analyse du code existant : `campagnes` (Phase 0) créée mais jamais branchée (ni colonne `contenu`), `lib/emails.ts` ne couvre que les splits/collab (aucune confirmation commande/abonnement n'existe), catégories hardcodées dans `BeatForm.tsx` (`TagSelector` fixe pour Ambiances/Instruments, `HybridTagSelector` pour Styles/Type beat — déjà proche du modèle cible), sidebar avec section "Marketing" déjà verrouillée 🔒 (Campagnes/Templates placeholder, `Sidebar.tsx`). Décisions actées : Automatisations en recettes prédéfinies custom mais déclencheur stocké en config JSON générique dès le départ (évolutif vers 100% custom) ; Transactionnels = template par défaut + quelques champs éditables (pas d'éditeur libre) ; double email de bienvenue (plateforme fixe + boutique configurable, rangé dans Automatisations) ; certification catégories validée manuellement en V1, mais nécessite un vrai back-office Admin (perf SaaS + perf par boutique + modération) obligatoire avant la publication officielle (étape 17). **Resequencing (Jake) :** Dashboard business (accueil) repoussé en dernier (Phase 8) car il agrège des KPIs de tous les modules. **Fusion (Jake) :** Sprint 4 CRM (11c, Campagnes manuelles jamais codées) fusionné avec les Automatisations dans un même chantier Marketing (Phase 4 Fondations+Campagnes → Phase 5 Automatisations) car les deux partagent le même socle technique (ciblage segment + templates + envoi Resend) — construit une seule fois. Étape 15 (Admin) élargie en conséquence. **Prochaine étape : Phase 4 (Marketing : Fondations + Campagnes).** |
| 2026-07-02 | Marketing (11d Phase 4) — 4.1 + 4.2 ✅ | Session de code. Analyse de la maquette crm-proto (wizard 3 étapes, éditeur de blocs, bibliothèque de templates) pour calibrer le design réel. Décisions validées par Jake : éditeur de templates en "blocs simplifiés" (pas de drag-and-drop) et envoi "fait maison" (pas Audiences/Broadcasts Resend). **4.1** : `supabase/marketing_migration.sql` (tables `templates_email` + `campagne_envois`, colonne `campagnes.contenu`, domaine d'envoi sur `beatmakers`, seed de 4 templates officiels) + `supabase/marketing_migration_ciblage.sql` (colonnes `cible_mode`/`cible_id`/`cible_emails` sur `campagnes`, remplace `segment_slug` jamais utilisé). **4.2** : `lib/mailing.ts` (ciblage segment/liste/manuel avec filtre RGPD systématique, tokens `{{prénom}}`/`{{style_préféré}}`/etc., lien de désinscription signé HMAC, envoi par lots de 100 via `resend.batch.send`) + `lib/email-blocs.ts` (rendu HTML des 6 types de blocs, y compris requêtes beats pour les sections beats). Refactor : la logique de chargement des contacts (dupliquée entre Segments liste et détail) extraite dans `app/dashboard/business/_lib/contacts.ts`, réutilisée par les deux pages Segments et par `lib/mailing.ts` — comportement inchangé, vérifié via `tsc`/`eslint`. **Décision prise seul (à valider) :** les blocs "section beats" dans l'email n'affichent pas le prix (juste image + titre + lien) pour éviter de dupliquer la logique de pricing par licence de la boutique. **Nouvelle variable d'env requise sur Vercel :** `UNSUBSCRIBE_SECRET`. **Prochaine étape : 4.3 (page Campagnes).** |
| 2026-07-02 | Marketing (11d Phase 4) — 4.3 + 4.7 ✅ | **Bug trouvé et corrigé** : `lib/mailing.ts` ciblait `listes_contacts`/`liste_membres` (tables Phase 0, jamais utilisées) au lieu des vraies tables `listes_crm`/`listes_crm_contacts` (créées plus tard dans `supabase/listes_crm.sql`, celles utilisées par la page Listes réelle) — corrigé avant que ça casse le ciblage par liste. **4.3** : page `/dashboard/business/marketing/campagnes/` (KPIs, 3 sections Planifiées/Brouillons/Historique, wizard de création en 3 étapes Destinataires→Objet→Template) + nouveau cron quotidien `/api/cron/campagnes` (traite les campagnes planifiées, même pattern que `splits-expiration`, ajouté à `vercel.json` à 8h) — **limite à connaître : une campagne "planifiée à 10h" part au prochain passage du cron (une fois/jour), pas à la minute précise**. Bouton "Lancer une campagne" sur la fiche Segment débloqué (pré-sélectionne le segment dans le wizard). **4.7** : sidebar Marketing déverrouillée. Tables `listes_contacts`/`liste_membres` (Phase 0) confirmées mortes — à supprimer plus tard si Jake valide. **Prochaine étape : 4.4 (éditeur de templates, blocs simplifiés).** |
| 2026-07-02 | Marketing (11d Phase 4) — Premier envoi réel validé ✅ | Session de debug avec Jake sur une campagne test (segment/liste/manuel via l'assistant). 3 bugs trouvés et corrigés en série : (1) erreur d'envoi totalement silencieuse (aucun message, aucun log) — `genererLienDesinscription` hors du try/catch dans la boucle d'envoi, corrigé ; (2) message d'erreur trompeur "aucun destinataire" pour une campagne orpheline créée avant l'assistant (sans `cible_mode`) — messages désormais distincts (`sans_ciblage` vs `aucun_destinataire`) ; (3) **cause racine réelle**, trouvée via les logs Vercel (`permission denied for table campagnes`, code 42501) : `campagnes` et `listes_crm`/`listes_crm_contacts` n'avaient jamais reçu de `GRANT ... TO service_role` (seulement `authenticated`, accordé en Phase 0 / `listes_crm.sql`) — `lib/mailing.ts` utilise le client admin (service_role) pour l'envoi, Postgres refusait donc l'accès sans qu'aucune exception ne remonte proprement. Fix : `supabase/marketing_migration_grants.sql`. **Premier envoi réel réussi** (3 destinataires, "Liste test"). Bonus : bug préexistant trouvé et corrigé dans la fiche détail Liste CRM (colonnes inexistantes interrogées sur `leads`, affichait "—" pour tout le monde en Newsletter). Domaine d'envoi basculé temporairement sur `campagnes@jakebmusic.com` (déjà vérifié dans Resend) en attendant la vraie 4.5. **Ouvertures/clics restent à 0** : normal, pas un bug — c'est 4.6 (webhook Resend) qui n'existe pas encore. **Prochaine étape : 4.6 (webhook Resend — tracking + désinscription).** |
| 2026-07-02 | Marketing (11d Phase 4) — 4.6 ✅ | Webhook Resend (`/api/resend/webhook`) : vérifie la signature via `resend.webhooks.verify()` (svix), gère `email.opened`/`email.clicked`/`email.bounced`/`email.complained`, met à jour `campagne_envois` (par `resend_message_id`) et incrémente les compteurs agrégés sur `campagnes` (une seule fois par email, pas à chaque relance d'ouverture). Route `/api/marketing/desinscription` : vérifie le token signé (étendu pour inclure le `campagneId`, pas seulement client+beatmaker), passe `clients.newsletter_consent` et `leads.newsletter_inscrit` à `false`, marque `campagne_envois.desinscrit_at`, page de confirmation minimale. Nouvelle colonne `campagne_envois.desinscrit_at` (`marketing_migration_webhook.sql`). **Reste à faire côté Jake** : créer le webhook dans le dashboard Resend (URL `/api/resend/webhook`, événements opened/clicked/bounced/complained) et ajouter `RESEND_WEBHOOK_SECRET` sur Vercel. **Prochaine étape : 4.4 (éditeur de templates) ou 4.8 (tests bout en bout) — Jake à trancher.** |
| 2026-07-02 | Marketing (11d Phase 4) — Tracking validé + conversions ajoutées ✅ | Premier envoi réel testé de bout en bout avec succès par Jake : ouvertures/clics remontent bien après configuration du webhook Resend + activation du tracking sur le domaine jakebmusic.com (sous-domaine `links.jakebmusic.com`, CNAME vérifié). Historique affiche désormais le chiffre brut en plus du pourcentage (`pct()` dans `CampagnesClient.tsx`). **Conversions** (jusque-là jamais branchées, `campagnes.conversions` toujours à 0) : ajout de `enregistrerConversion()` dans `lib/mailing.ts`, appelée depuis `traiterPaiement()` (webhook Stripe) juste après la création de la commande — attribution "dernier contact" : si le client a reçu une campagne de ce beatmaker dans les 30 derniers jours et n'a pas déjà été compté, marque `campagne_envois.converti_at` et incrémente `campagnes.conversions`. Nouvelle colonne `campagne_envois.converti_at` (`marketing_migration_conversions.sql`). Ne fait jamais échouer le paiement (erreurs catchées et loguées uniquement). **Reste à faire côté Jake** : exécuter `marketing_migration_conversions.sql`. **Phase 4 fonctionnelle de bout en bout** (envoi, ciblage, tracking, désinscription, conversions) — reste 4.4 (éditeur), 4.5 (vrai domaine par boutique), 4.8 (tests formels). |
| 2026-07-02 | Marketing (11d Phase 4) — Attribution conversions par clic (remplace le premier jet) ✅ | Jake a identifié deux failles dans l'attribution "email + fenêtre 30j" du commit précédent : (1) un client qui clique depuis la campagne mais achète avec un autre email n'était jamais compté ; (2) un client qui reçoit la campagne mais achète en direct (sans cliquer) était compté à tort. **Nouvelle architecture, sur le modèle du lien de désinscription (jeton signé HMAC, pas de dépendance tierce)** : chaque lien de contenu dans l'email (CTA, beats, "voir la boutique" — pas le lien de désinscription) est enveloppé via `genererLienClic()`/`envelopperLiensSuivi()` dans `lib/mailing.ts`, pointant vers la nouvelle route `/api/marketing/clic`. Cette route vérifie le jeton, marque le clic (`campagne_envois.clique_at` + compteur), pose un **cookie httpOnly** (`mp_click`, 30 jours) contenant le même jeton, puis redirige — avec protection anti-open-redirect (la destination doit commencer par `NEXT_PUBLIC_APP_URL`). `/api/stripe/checkout` lit ce cookie et l'ajoute aux métadonnées Stripe (`campagne_id`/`campagne_client_id`) uniquement si le beatmaker du jeton correspond à celui du beat acheté. Le webhook Stripe utilise ces métadonnées pour l'attribution — `enregistrerConversionParClic()` remplace l'ancienne `enregistrerConversion()` (heuristique par email supprimée). Résout les deux cas : clic + email différent → suivi via le cookie, pas l'email ; pas de clic → pas de cookie → pas de fausse conversion. Fonctions de jeton généralisées (`genererToken`/`verifierTokenCampagne`), réutilisées par désinscription et suivi de clic. Aucune nouvelle migration SQL (réutilise `campagne_envois.clique_at`/`converti_at` déjà créés). |
| 2026-07-02 | Marketing (11d Phase 4) — Décision finale attribution conversions ✅ | Jake a soulevé un problème de cohérence sur l'attribution par clic seul : si l'achat se fait avec un email différent de celui de réception, la conversion est comptée sur le destinataire d'origine alors que la commande (et donc la LTV) atterrit sur un autre `client_id` — un décalage entre stats campagne et fiche client, réconciliable seulement via une fusion de doublon manuelle. **Décision (Jake) : privilégier la cohérence des stats sur l'exhaustivité.** Condition finale dans le webhook Stripe : la conversion n'est comptée que si (1) un clic récent sur la campagne est prouvé (cookie `mp_click`) **ET** (2) le `client_id` réellement utilisé pour l'achat correspond exactement au destinataire du clic. Un clic suivi d'un achat avec une autre adresse n'est donc plus compté — compromis assumé pour que toute conversion affichée soit toujours traçable jusqu'à la commande correspondante sur la bonne fiche client. |
| 2026-07-03 | Marketing (11d Phase 4) — 4.4 Éditeur de templates ✅ | Composant partagé `BlocEditor.tsx` (`app/dashboard/business/marketing/_components/`) : éditeur "Canva simplifié" 2 colonnes inspiré de l'UX Brevo (calibré avec Jake sur capture d'écran) — palette de blocs à gauche qui bascule vers les réglages du bloc sélectionné (pas de 3e colonne fixe, pas de drag-and-drop, boutons ↑/↓/supprimer), texte édité inline sur le canvas, canvas fidèle au rendu email réel (mêmes couleurs/styles que `lib/email-blocs.ts`). Bouton "Aperçu" : nouveau helper `_lib/apercu.ts` (`construireApercu`) réutilise `rendreEmailHtml()` pour un rendu HTML fidèle affiché dans une iframe. **Bibliothèque** : page `/marketing/templates` (officiels lecture seule + dupliquer, perso créer/modifier/supprimer) + pages `/templates/nouveau` et `/templates/[id]` branchées sur `BlocEditor`. **Le vrai trou comblé** : le wizard de campagne ne permettait de choisir un template que tel quel (contenu copié brut dans `campagnes.contenu` sans jamais pouvoir le modifier) — nouvelle page `/marketing/campagnes/[id]/editer` (même `BlocEditor`) + bouton "Éditer le contenu" sur les brouillons/planifiées dans `CampagnesClient.tsx`. Refactor : constantes catégories (`CATEGORIE_LABEL`/`CATEGORIE_CLS`) extraites dans `_lib/categories.ts`, réutilisées par le wizard et la bibliothèque. **Itérations post-tests Jake (même journée)** : aperçu avec un vrai client sélectionné (remplace les tokens via `remplacerTokens()`, `_lib/contactsApercu.ts`) + toggle Bureau/Mobile dans la modale ; puis déplacement du sélecteur de client dans la modale elle-même (pas compris à côté du bouton) + recherche par nom/email. **Checklist de tests bout en bout passée avec Jake (19 points : bibliothèque, éditeur de blocs, personnalisation de campagne, non-régression)** — tout validé sauf un point de protection serveur (accès direct à l'éditeur d'une campagne déjà envoyée) non testable depuis l'UI normale, vérifié par relecture de code. **4.4 done.** Dans la foulée, Jake a aussi retesté 4.6 (désinscription, jamais reformellement vérifiée depuis son implémentation) : envoi d'une campagne test à lui-même, clic sur "Se désinscrire", statut désinscrit visible sur la fiche contact, compteur "Désinscrits" incrémenté sur la campagne, re-clic sur le même lien sans double comptage (idempotent), exclusion confirmée du ciblage d'une nouvelle campagne sur le même segment/liste. **4.6 reconfirmée fonctionnelle.** Deux bonus CRM ensuite : bouton manuel Inscrire/Désinscrire sur la fiche contact (pour tester sans vrai envoi) + vraies stats d'engagement newsletter par contact (conservées après désinscription, remplace les placeholders jamais branchés). Enfin, l'onglet "Newsletter" verrouillé de la vue Contacts (placeholder 🔒 depuis la Phase 0 du 11d) a été construit pour de vrai à partir de la maquette crm-proto : KPIs, segmentation par engagement, filtres, sélection + ajout à une liste — mêmes principes de conservation d'historique. **Reste 4.5 (vrai domaine d'envoi par boutique) — 4.8 (tests bout en bout formels du reste de la Phase 4) à confirmer avec Jake si les sessions du 2026-07-03 la couvrent déjà en partie.** |
| 2026-07-03 | Marketing — Variables enrichies + éditeur en pastilles cliquables ✅ | Deux itérations sur les variables de personnalisation le même jour. **1)** Retour "trop peu de variables" (3 dispo) : `remplacerTokens()` passe à ~25 tokens (identité, achats/fidélité, abonnement, préférences musicales étendues, réseaux sociaux, engagement, date), tous tirés de `ContactEnrichi` déjà chargé (aucune requête de plus). **2)** Retour sur l'UX : Jake a montré des captures de l'éditeur Brevo (variable = pastille cliquable inline dans le texte, config de secours en chaîne variable→variable→texte fixe) — a précisé vouloir un **constructeur visuel par menus**, pas de syntaxe brute à taper (public non technique). Nouveau composant `ChampAvecVariables.tsx` : éditeur `contentEditable` remplaçant les champs simples sur les 6 zones de texte de `BlocEditor` (titre en-tête, texte, titre/sous-titre section beats, description code promo, texte CTA) — cliquer une variable dans la palette l'insère au curseur en pastille cliquable, cliquer la pastille ouvre une modale pour construire la chaîne de secours par menus déroulants. Sérialise en `{{var}}` / `{{var\|secours1\|secours2\|texte fixe}}`, rétrocompatible. `remplacerTokens()` résout la chaîne complète côté envoi. **Testé en navigateur isolé** (page jetable + Playwright, supprimée après) : frappe, insertion, chaîne à 2 étapes, suppression — tout fonctionne, 0 erreur console. **Incident** : le serveur de test isolé a été lancé par erreur dans le même dossier que le serveur de Jake (cache `.next` partagé) → ses routes protégées ont temporairement renvoyé 404 au lieu de rediriger. Résolu (cache supprimé, serveur relancé proprement) — leçon retenue en mémoire pour ne plus reproduire. |
| 2026-07-03 | Marketing — Fix insertion de variable après désélection ✅ | Jake a testé le nouvel éditeur en pastilles : clic sur une variable → "✓ inséré" affiché, mais rien ne s'insérait dans le texte. **Cause** : `ChampAvecVariables` n'était monté que lorsque le bloc était sélectionné (rendu conditionnel select/lecture-seule dans `BlocCanvas`) — désélectionner un bloc démontait donc son champ, et la référence que la palette gardait vers "le dernier champ actif" devenait orpheline ; l'insertion échouait en silence sans que la confirmation optimiste ("inséré") ne le détecte. **Fix** : `ChampAvecVariables` reste désormais toujours monté, avec un nouveau prop `editable` qui bascule juste le mode lecture seule (pastilles visibles mais non cliquables, pas de `stopPropagation`) au lieu de démonter/remonter deux JSX différents. Bonus : le retour réel de l'insertion (`insere`/`copie`) pilote maintenant le message affiché dans la palette. **Vérifié dans une appli Next.js jetable entièrement isolée** (dossier séparé dans le scratchpad, `node_modules` du vrai projet relié en jonction lecture seule, aucun `.next` partagé — leçon de l'incident précédent appliquée) : le bug était bien reproductible hors du fix, et confirmé résolu après. Confirmé fonctionnel par Jake en conditions réelles. |
| 2026-07-04 | Session de planification (pas de code) — Naming + Phase 5 repensée + Commerce 2b | **Naming :** brainstorm long sur un possible changement de nom "My Producer" (pas définitif pour Jake). Rejeté : pattern "my+métier" (daté) et "beat+mot" (saturé par la concurrence). Direction "premium"/francophone (Maison, Atelier, Aria) la mieux reçue, rien de tranché. **Décision : reporté à l'étape 17**, coût de renommage vérifié bas dans le code (texte d'affichage + config uniquement — détail `memory/project_naming_deferred.md`). **Phase 5 Automatisations entièrement repensée** : Jake a fourni ses 5 vrais workflows email (texte exact) de sa propre boutique plutôt que les 4 recettes génériques prévues. Liste finale : 8 workflows (bienvenue abo, abo en attente, churn perso, remerciement achat à 4 paliers + variable singulier/pluriel, bienvenue perso avec règle de suppression, relance inactivité, follow-up free download, follow-up favori). Méthode de construction actée : workflows seuls d'abord → combinaisons ensuite → IA seulement pour les cas rares/anecdotiques (avec validation humaine avant envoi, notification email+badge, pas de péremption de brouillon — re-rendu à chaque ouverture pour la référence temporelle). Détail complet : `memory/project_phase5_automatisations_redesign.md`. **Nouveau chantier Commerce identifié comme prioritaire** : en creusant le workflow "tentative d'achat échouée", découverte que la page Commandes n'a jamais tracké aucun paiement échoué/panier abandonné (`commandes.statut` toujours écrit en dur à `payee`, vérifié dans le webhook). Décision : nouvelle table `tentatives_paiement` séparée (modèle Shopify Checkout≠Order), sans toucher à `commandes` (contraintes NOT NULL + référencée partout en Analytics/CRM/Codes promo). Détail : `memory/project_commerce_tentatives_paiement.md`. **Prochaine session : Phase 2b (Commerce) en premier, puis reprendre les 8 workflows Phase 5 en isolation.** |
