# My Producer — Roadmap V1

> Dernière mise à jour : 2026-05-15

## Légende
| Statut | Signification |
|--------|--------------|
| ⬜ À faire | Étape non commencée |
| 🔄 En cours | Étape en cours de développement |
| ✅ Validé | Étape terminée et testée |

---

## Progression globale : 5 / 17 étapes validées (+ 1 bonus)

| # | Étape | Description | Durée estimée | Statut |
|---|-------|-------------|---------------|--------|
| 1 | **Setup & infrastructure** | Next.js, Git, GitHub, Supabase, Vercel, Cloudflare | 2-3h | ✅ Validé |
| 2 | **Base de données** | Concevoir et créer toutes les tables (beats, clients, licences, abonnements...) | 3-5h | ✅ Validé |
| 3 | **Authentification** | Inscription / connexion des beatmakers et des artistes. Bouton "Se connecter avec My Producer" dans les boutiques — compte global artiste utilisable sur toutes les boutiques. "Propulsé par My Producer" discret en bas de chaque boutique. | 3-4h | ✅ Validé |
| 4 | **Gestion des beats** | Upload, infos, fichiers (WAV/MP3/ZIP via Cloudflare R2), licences, organisation du catalogue | 10-15h | ✅ Validé |
| 5 | **Boutique** | Page publique du beatmaker, catalogue, player audio, pages beats | 15-20h | ✅ Validé |
| 5b | **Profil beatmaker** *(bonus)* | Slug personnalisable, logo, tagline, réseaux sociaux — page /dashboard/profil | — | ✅ Validé |
| 6 | **Paiements** | Stripe Connect, checkout, codes promo, TVA optionnelle | 10-15h | ⬜ À faire |
| 7 | **Licences & livraison** | Livraison automatique des fichiers après achat. PDF contrat généré automatiquement avec : (1) co-producers listés depuis beat_splits — format d'affichage : "Prénom Nom p/k/a NomArtiste" si nom légal dispo, sinon "NomArtiste" seul, (2) répartition publishing FIXE et indépendante du split des ventes : Compositeurs 50% divisés à PARTS ÉGALES entre tous les producers (ex: 2 producers → 25/25, 3 producers → 16.67 chacun), Auteurs 50% pour le client — mention modification possible sous accord préalable écrit de tous les compositeurs, (3) splits_snapshot stocké dans commandes à la vente (modifiable par le beatmaker en cas d'erreur ex: imposteur). | 5-8h | ⬜ À faire |
| 8 | **Abonnements** | Création des plans, catalogue privé, gestion depuis l'espace client | 8-12h | ⬜ À faire |
| 9 | **Split collab** | Stripe Connect pour beatmakers collaborateurs. Deux modes : recherche d'un compte My Producer existant OU invitation par email (split "en attente"). Si vente avec collab non inscrit : fonds retenus chez Stripe (tiers de confiance réglementé), reversés automatiquement à l'inscription + connexion Stripe Connect du collab. Invite flow : prénom + nom obligatoires quand le collab clique le lien d'invitation (pour contrats légaux). En attendant, nom_artiste utilisé sur le contrat. | 7-10h | ⬜ À faire |
| 10 | **Espace client artiste** | Compte My Producer global (myproducer.com/mon-compte) : beats achetés toutes boutiques + abonnements actifs + fichiers à télécharger. Dans chaque boutique : section "Mes achats chez ce beatmaker" + lien "Tous mes achats My Producer". Bouton "Mon compte My Producer" accessible depuis n'importe quelle boutique via l'avatar en haut à droite. **Favoris** : bouton cœur sur les cartes beat pour les utilisateurs connectés, page "Mes favoris" dans l'espace client (table `favoris` user_id + beat_id). | 5-8h | ⬜ À faire |
| 11 | **CRM** | Liste clients, fiches, import CSV BeatStars. Détection automatique de doublons clients (fuzzy matching) : email exact + variantes (nom.prenom/prenom.nom, domaines différents), nom/prénom inversé, téléphone normalisé, adresse postale similaire. Action fusionner (avec annulation possible) ou ignorer par paire. Import CSV BeatStars : fuzzy matching des titres de beats (BeatStars ajoute des tags SEO au titre), confirmation manuelle puis stockage dans `titre_beatstars` pour les imports suivants. | 5-8h | ⬜ À faire |
| 12 | **Emails automatiques** | Post-achat, abonnement, renouvellement, annulation | 4-6h | ⬜ À faire |
| 13 | **Analytics** | CA, classements beats, licences vendues. **Compteur d'écoutes** : incrémenter à chaque play, afficher sur les cartes beat et page détail (social proof acheteurs + stats beatmaker). | 4-6h | ⬜ À faire |
| 14 | **Onboarding** | Parcours guidé de configuration à l'inscription | 5-8h | ⬜ À faire |
| 15 | **Admin** | Dashboard de gestion de la plateforme + outil interne d'import BeatStars (script de scraping : coller l'URL d'un beatmaker → pré-remplit sa table `beats` automatiquement, concierge onboarding) | 7-10h | ⬜ À faire |
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

## Détail étape 2 — Base de données

| Sous-étape | Durée estimée | Statut |
|------------|---------------|--------|
| Concevoir le schéma des tables (quelles tables, quels champs) | 30 min | ✅ Validé |
| Créer les 9 tables via SQL (beatmakers, beats, licences, clients, leads, commandes, doublons_ignores, abonnements_plateforme, abonnements_boutique) | 45 min | ✅ Validé |
| Activer Row Level Security (RLS) sur toutes les tables | — | ✅ Validé |
| Ajouter les contraintes et index (unicité, montants, abonnements actifs) | — | ✅ Validé |

---

## Détail étape 4 — Gestion des beats

| Sous-étape | Durée estimée | Statut |
|------------|---------------|--------|
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

| Sous-étape | Durée estimée | Statut |
|------------|---------------|--------|
| 5.1 — RLS Supabase : lecture publique beats/licences/beatmakers pour visiteurs non connectés | 10 min | ✅ Validé |
| 5.2 — Player audio global (PlayerContext + PlayerBar sticky) : play/pause/next/prev/seek/autoplay en fin de beat | 60 min | ✅ Validé |
| 5.3 — Page boutique principale `/[slug]` : header beatmaker (logo, nom, tagline, réseaux) + catalogue grille | 45 min | ✅ Validé |
| 5.4 — Filtres catalogue : recherche par titre, filtre style, filtre type beat | 20 min | ✅ Validé |
| 5.5 — Carte beat : cover avec bouton play overlay, titre, BPM/clé, tags, prix des licences | 30 min | ✅ Validé |
| 5.6 — Page beat individuelle `/[slug]/[beatId]` : cover, infos complètes, bouton play, tableau licences | 45 min | ✅ Validé |
| 5.7 — Lien "Ma boutique ↗" dans le dashboard | 5 min | ✅ Validé |

---

## Journal des sessions
| Date | Étapes travaillées | Résumé |
|------|--------------------|--------|
| 2026-05-02 | Étape 1 | Setup Next.js, apprentissage Git/GitHub, initialisation du projet beatplatform |
| 2026-05-13 | Étape 1 | ✅ Étape 1 complète. Supabase configuré, Vercel déployé (beatplatform.vercel.app), compte Cloudflare créé. Prochaine étape : conception de la base de données. |
| 2026-05-13 | Étape 2 | Début étape 2 : schéma de la base de données conçu (tables : beatmakers, beats, licences, clients, commandes, abonnements). Tables beatmakers et beats entièrement définies dans DATABASE.md. |
| 2026-05-14 | Étape 2 | ✅ Étape 2 complète. 9 tables créées dans Supabase via SQL (schema.sql). RLS activé. Contraintes et index ajoutés après revue croisée avec ChatGPT (schema_fixes_v1.sql). |
| 2026-05-14 | Étape 3 | ✅ Étape 3 complète. Resend SMTP configuré (noreply@jakebmusic.com), fix Gmail OTP scanning (verifyOtp + token_hash), trigger beatmakers auto-créé, RLS policies sur 9 tables. Tests bout en bout validés. |
| 2026-05-14 | Étape 4 | Début étape 4 : sous-étapes détaillées dans ROADMAP. Prochaine action : configurer Cloudflare R2. |
| 2026-05-15 | Étape 4 | 4.1→4.7 validés. R2 configuré, SDK S3, formulaire beats, upload fichiers (presigned URL + WebP), collaborateurs/splits, sauvegarde BDD, catalogue dashboard, édition et suppression. Prochaine étape : 4.8 licences par beat. |
| 2026-05-15 | Étape 5 | ✅ Étape 5 complète. Boutique publique /[slug] avec player audio global, filtres, page beat individuelle avec licences. RLS Supabase configuré pour lecture anon. Fix R2 : activation Public Development URL + variable R2_PUBLIC_URL pour accès public aux fichiers audio. |
| 2026-05-15 | Étape 5b | ✅ Profil beatmaker : slug personnalisable (vérif dispo temps réel), logo R2, tagline, réseaux sociaux. Déploiement Vercel fonctionnel (variables d'env configurées). |
