# My Producer — Roadmap V1

> Dernière mise à jour : 2026-05-14

## Légende
| Statut | Signification |
|--------|--------------|
| ⬜ À faire | Étape non commencée |
| 🔄 En cours | Étape en cours de développement |
| ✅ Validé | Étape terminée et testée |

---

## Progression globale : 2 / 17 étapes validées

| # | Étape | Description | Durée estimée | Statut |
|---|-------|-------------|---------------|--------|
| 1 | **Setup & infrastructure** | Next.js, Git, GitHub, Supabase, Vercel, Cloudflare | 2-3h | ✅ Validé |
| 2 | **Base de données** | Concevoir et créer toutes les tables (beats, clients, licences, abonnements...) | 3-5h | ✅ Validé |
| 3 | **Authentification** | Inscription / connexion des beatmakers | 3-4h | ⬜ À faire |
| 4 | **Gestion des beats** | Upload, infos, fichiers (WAV/MP3/ZIP via Cloudflare R2), licences, organisation du catalogue | 10-15h | ⬜ À faire |
| 5 | **Boutique** | Page publique du beatmaker, catalogue, player audio, pages beats | 15-20h | ⬜ À faire |
| 6 | **Paiements** | Stripe Connect, checkout, codes promo, TVA optionnelle | 10-15h | ⬜ À faire |
| 7 | **Licences & livraison** | Livraison automatique des fichiers après achat | 5-8h | ⬜ À faire |
| 8 | **Abonnements** | Création des plans, catalogue privé, gestion depuis l'espace client | 8-12h | ⬜ À faire |
| 9 | **Split collab** | Stripe Connect pour beatmakers collaborateurs | 5-8h | ⬜ À faire |
| 10 | **Espace client artiste** | Compte, historique achats, gestion abonnement | 5-8h | ⬜ À faire |
| 11 | **CRM** | Liste clients, fiches, import CSV BeatStars. Détection automatique de doublons clients (fuzzy matching) : email exact + variantes (nom.prenom/prenom.nom, domaines différents), nom/prénom inversé, téléphone normalisé, adresse postale similaire. Action fusionner (avec annulation possible) ou ignorer par paire. Import CSV BeatStars : fuzzy matching des titres de beats (BeatStars ajoute des tags SEO au titre), confirmation manuelle puis stockage dans `titre_beatstars` pour les imports suivants. | 5-8h | ⬜ À faire |
| 12 | **Emails automatiques** | Post-achat, abonnement, renouvellement, annulation | 4-6h | ⬜ À faire |
| 13 | **Analytics** | CA, classements beats, licences vendues | 4-6h | ⬜ À faire |
| 14 | **Onboarding** | Parcours guidé de configuration à l'inscription | 5-8h | ⬜ À faire |
| 15 | **Admin** | Dashboard de gestion de la plateforme | 5-8h | ⬜ À faire |
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

| Sous-étape | Durée estimée | Statut |
|------------|---------------|--------|
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

## Détail étape 3 — Authentification

| Sous-étape | Durée estimée | Statut |
|------------|---------------|--------|
| 3.1 — Installer `@supabase/ssr` (sessions côté serveur Next.js) | 5 min | ⬜ À faire |
| 3.2 — Configurer Supabase Auth (URL de redirection, confirmation email) | 10 min | ⬜ À faire |
| 3.3 — Créer les clients Supabase (helpers browser / serveur / middleware) | 15 min | ⬜ À faire |
| 3.4 — Middleware de protection des routes (redirection si non connecté) | 15 min | ⬜ À faire |
| 3.5 — Page d'inscription (email + mot de passe + création profil beatmakers) | 30 min | ⬜ À faire |
| 3.6 — Page de connexion (email + mot de passe + redirection dashboard) | 20 min | ⬜ À faire |
| 3.7 — Déconnexion (bouton + redirection accueil) | 10 min | ⬜ À faire |
| 3.8 — Mot de passe oublié (page reset + email automatique Supabase) | 20 min | ⬜ À faire |
| 3.9 — Policies RLS (chaque beatmaker accède uniquement à son propre profil) | 20 min | ⬜ À faire |
| 3.10 — Test de bout en bout (créer un compte, vérifier table, tester routes) | 20 min | ⬜ À faire |

---

## Détail étape 2 — Base de données

| Sous-étape | Durée estimée | Statut |
|------------|---------------|--------|
| Concevoir le schéma des tables (quelles tables, quels champs) | 30 min | ✅ Validé |
| Créer les 9 tables via SQL (beatmakers, beats, licences, clients, leads, commandes, doublons_ignores, abonnements_plateforme, abonnements_boutique) | 45 min | ✅ Validé |
| Activer Row Level Security (RLS) sur toutes les tables | — | ✅ Validé |
| Ajouter les contraintes et index (unicité, montants, abonnements actifs) | — | ✅ Validé |

---

## Journal des sessions
| Date | Étapes travaillées | Résumé |
|------|--------------------|--------|
| 2026-05-02 | Étape 1 | Setup Next.js, apprentissage Git/GitHub, initialisation du projet beatplatform |
| 2026-05-13 | Étape 1 | ✅ Étape 1 complète. Supabase configuré, Vercel déployé (beatplatform.vercel.app), compte Cloudflare créé. Prochaine étape : conception de la base de données. |
| 2026-05-13 | Étape 2 | Début étape 2 : schéma de la base de données conçu (tables : beatmakers, beats, licences, clients, commandes, abonnements). Tables beatmakers et beats entièrement définies dans DATABASE.md. |
| 2026-05-14 | Étape 2 | ✅ Étape 2 complète. 9 tables créées dans Supabase via SQL (schema.sql). RLS activé. Contraintes et index ajoutés après revue croisée avec ChatGPT (schema_fixes_v1.sql). |
