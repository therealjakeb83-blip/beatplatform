# My Producer — Roadmap V1

> Dernière mise à jour : 2026-05-13

## Légende
| Statut | Signification |
|--------|--------------|
| ⬜ À faire | Étape non commencée |
| 🔄 En cours | Étape en cours de développement |
| ✅ Validé | Étape terminée et testée |

---

## Progression globale : 0 / 17 étapes validées (étape 1 quasi terminée)

| # | Étape | Description | Durée estimée | Statut |
|---|-------|-------------|---------------|--------|
| 1 | **Setup & infrastructure** | Next.js, Git, GitHub, Supabase, Vercel, Cloudflare | 2-3h | 🔄 En cours |
| 2 | **Base de données** | Concevoir et créer toutes les tables (beats, clients, licences, abonnements...) | 3-5h | ⬜ À faire |
| 3 | **Authentification** | Inscription / connexion des beatmakers | 3-4h | ⬜ À faire |
| 4 | **Gestion des beats** | Upload, infos, fichiers (WAV/MP3/ZIP via Cloudflare R2), licences, organisation du catalogue | 10-15h | ⬜ À faire |
| 5 | **Boutique** | Page publique du beatmaker, catalogue, player audio, pages beats | 15-20h | ⬜ À faire |
| 6 | **Paiements** | Stripe Connect, checkout, codes promo, TVA optionnelle | 10-15h | ⬜ À faire |
| 7 | **Licences & livraison** | Livraison automatique des fichiers après achat | 5-8h | ⬜ À faire |
| 8 | **Abonnements** | Création des plans, catalogue privé, gestion depuis l'espace client | 8-12h | ⬜ À faire |
| 9 | **Split collab** | Stripe Connect pour beatmakers collaborateurs | 5-8h | ⬜ À faire |
| 10 | **Espace client artiste** | Compte, historique achats, gestion abonnement | 5-8h | ⬜ À faire |
| 11 | **CRM** | Liste clients, fiches, import CSV BeatStars | 5-8h | ⬜ À faire |
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
| Créer un compte Cloudflare (pour R2 + DNS domaine) | 5 min | ⬜ À faire |

---

## Journal des sessions
| Date | Étapes travaillées | Résumé |
|------|--------------------|--------|
| 2026-05-02 | Étape 1 | Setup Next.js, apprentissage Git/GitHub, initialisation du projet beatplatform |
| 2026-05-13 | Étape 1 | Décisions d'architecture : Cloudflare R2 pour le stockage audio, Supabase free tier → Pro au lancement, budget estimé ~$50-60/mois. Supabase configuré, `lib/supabase.ts` créé. Vercel connecté à GitHub, site déployé sur beatplatform.vercel.app. Reste : compte Cloudflare. |
