# My Producer — Architecture de la base de données

> Dernière mise à jour : 2026-07-02 — corrections d'unités (`prix_paye`, `licences.prix`) + ajout des tables créées depuis (module Business/11d). Ce document reste la référence de conception initiale (étapes 1-9) ; il n'a pas été réécrit intégralement — voir `ROADMAP.md` pour l'état d'avancement à jour et le détail des tables les plus récentes dans les fichiers `supabase/*.sql` correspondants.

---

## Tables

### `beatmakers`
Profil de chaque beatmaker inscrit sur la plateforme My Producer.

#### Identité
| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `id` | UUID | ✅ Auto | Identifiant unique généré automatiquement |
| `email` | text | ✅ Inscription | Email de connexion |
| `nom_artiste` | text | ✅ Inscription | Nom de scène affiché sur la boutique |
| `slug` | text | ✅ Inscription | URL de la boutique (ex: `jakeb` → myproducer.com/jakeb) |
| `created_at` | timestamp | ✅ Auto | Date d'inscription |

#### Boutique publique
| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `tagline` | text | ⬜ Optionnel | Phrase d'accroche (ex: "Trouve une instru rap pour ton projet") |
| `bio` | text | ⬜ Optionnel | Description de la boutique |
| `logo_url` | text | ⬜ Optionnel | Lien vers le logo |
| `template` | text | ⬜ Optionnel | Design choisi (ex: "dark", "minimal", "neon") |
| `devise` | text | ✅ Inscription | Devise de vente : `EUR` ou `USD` |
| `domaine` | text | ⬜ Optionnel | Domaine custom (ex: `jakeb.com`) — configuration DNS à faire à l'étape 17 |
| `instagram_url` | text | ⬜ Optionnel | Lien Instagram |
| `youtube_url` | text | ⬜ Optionnel | Lien YouTube |
| `tiktok_url` | text | ⬜ Optionnel | Lien TikTok |

#### Facturation
| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `pays` | text | ✅ Inscription | Code pays (ex: "FR", "BE", "CA") |
| `adresse` | text | ✅ Avant vente | Rue et numéro |
| `ville` | text | ✅ Avant vente | Ville |
| `code_postal` | text | ✅ Avant vente | Code postal |
| `telephone` | text | ✅ Avant vente | Numéro de téléphone |
| `numero_entreprise` | text | ⬜ Optionnel | SIRET (France) ou équivalent selon le pays |
| `tva_active` | boolean | ⬜ Optionnel | TVA activée ou non (responsabilité du beatmaker) |
| `tva_numero` | text | ⬜ Optionnel | Numéro de TVA intracommunautaire |
| `tva_taux` | numeric | ⬜ Optionnel | Taux saisi par le beatmaker (ex: 20 pour 20%) |

> **Note légale :** Le taux de TVA est saisi manuellement par le beatmaker. My Producer n'est pas responsable du taux appliqué ni des obligations fiscales du beatmaker.

#### Paiements
| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `stripe_account_id` | text | ✅ Avant vente | ID du compte Stripe Connect |
| `paypal_account_id` | text | ⬜ Optionnel | ID du compte PayPal |

#### Légal
| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `cgv_acceptees_at` | timestamp | ✅ Inscription | Date d'acceptation des CGV de My Producer |

#### Admin & CRM
| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `statut` | text | ✅ Auto | État du compte : `actif` / `inactif` / `suspendu` |
| `source_acquisition` | text | ⬜ Optionnel | Canal d'acquisition (YouTube, Instagram, bouche à oreille...) |
| `date_dernier_login` | timestamp | ✅ Auto | Dernière connexion (détection churn) |
| `notes_admin` | text | ⬜ Optionnel | Notes internes visibles uniquement par l'admin |
| `suspendu_le` | timestamp | ⬜ Optionnel | Date de suspension depuis l'admin (Étape 15c, 2026-07-24) — `null` sinon |
| `suspendu_raison` | text | ⬜ Optionnel | Raison saisie par l'admin à la suspension — `null` sinon |

> **Note :** La LTV (Lifetime Value) est calculée dynamiquement depuis `abonnements_plateforme`, pas stockée ici.

---

### `beats`
Catalogue de beats de chaque beatmaker.

#### Identité
| Champ | Type | Description |
|---|---|---|
| `id` | UUID | Identifiant unique |
| `beatmaker_id` | UUID | Lien vers le beatmaker propriétaire |
| `created_at` | timestamp | Date d'upload |
| `date_sortie` | timestamp | Date de sortie publique (peut être programmée) |

#### Infos musicales
| Champ | Type | Description |
|---|---|---|
| `titre` | text | Nom du beat |
| `titre_beatstars` | text | Titre exact sur BeatStars — renseigné après la première correspondance validée à l'import CSV |
| `bpm` | integer | Tempo |
| `cle` | text | Tonalité (ex: "C# minor") |
| `styles` | text[] | Ex: ["Trap", "RnB"] |
| `ambiances` | text[] | Ex: ["Mélodique", "Sombre"] |
| `instruments` | text[] | Ex: ["Piano"] |
| `type_beat` | text[] | Ex: ["Hamza", "Damso"] |

#### Fichiers (liens Cloudflare R2)
| Champ | Type | Description |
|---|---|---|
| `image_url` | text | Pochette |
| `mp3_tague_url` | text | MP3 avec tag vocal (preview) |
| `mp3_propre_url` | text | MP3 sans tag |
| `wav_url` | text | Fichier WAV |
| `stems_url` | text | ZIP des pistes séparées |

#### Disponibilité
| Champ | Type | Description |
|---|---|---|
| `statut` | text | `programme` / `public` / `prive` / `masque` / `vendu` |
| `supprime_le` | timestamp | Null si actif, date si supprimé par le beatmaker |

#### Marketing
| Champ | Type | Description |
|---|---|---|
| `free_download_actif` | boolean | Si vrai, l'artiste peut télécharger le `mp3_tague_url` gratuitement en échange de la création d'un compte My Producer |

### `licences`
Licences proposées par chaque beatmaker sur sa boutique. 5 modèles fixes (MP3, WAV, STEMS, ILLIMITÉ, EXCLUSIVE), activables ou non. Le beatmaker peut personnaliser 3 champs par licence.

> **V2 :** permettre aux beatmakers de créer des licences personnalisées librement.

#### Identité
| Champ | Type | Description |
|---|---|---|
| `id` | UUID | Identifiant unique |
| `beatmaker_id` | UUID | Lien vers le beatmaker propriétaire |
| `created_at` | timestamp | Date de création |
| `actif` | boolean | Licence visible sur la boutique ou non |
| `ordre` | integer | Ordre d'affichage (1 = en premier) |

#### Champs modulables par le beatmaker
| Champ | Type | Description |
|---|---|---|
| `nom` | text | Titre affiché (ex: "MP3", "WAV", "STEMS"...) |
| `prix` | integer | Prix en **euros entiers** (ex: 45 = 45€) — ⚠️ pas en centimes, contrairement à `abonnements_boutique.prix` |
| `streams_limite` | integer | Limite d'écoutes monétisées — `null` = illimité |

#### Droits fixes (définis par le modèle, non modifiables)
| Champ | Type | Description |
|---|---|---|
| `modele` | text | Identifiant du modèle : `mp3` / `wav` / `stems` / `illimite` / `exclusive` |
| `inclut_mp3` | boolean | Fichier MP3 inclus |
| `inclut_wav` | boolean | Fichier WAV inclus |
| `inclut_stems` | boolean | ZIP des stems inclus |
| `vues_video_limite` | integer | Limite de vues vidéo non-monétisées (YouTube, TikTok...) — `null` = illimité |
| `clips_video_limite` | integer | Nombre de clips vidéo monétisés autorisés — `null` = illimité |
| `radio_tv_limite` | integer | Nombre de stations radio/TV autorisées — `null` = illimité |
| `illustration_sonore` | boolean | Utilisation comme fond sonore/pub autorisée (ILLIMITÉ et EXCLUSIVE uniquement) |
| `ventes_physiques` | boolean | Ventes sur support physique autorisées (ILLIMITÉ et EXCLUSIVE uniquement) |
| `est_exclusive` | boolean | Beat retiré de la vente après achat (EXCLUSIVE uniquement) |

#### Valeurs par défaut des 5 modèles
| Modèle | MP3 | WAV | Stems | Streams | Vues vidéo | Clips | Radio/TV | Illus. sonore | Ventes physiques | Exclusif |
|---|---|---|---|---|---|---|---|---|---|---|
| `mp3` | ✅ | ❌ | ❌ | 50 000 | 200 000 | 1 | 1 | ❌ | ❌ | ❌ |
| `wav` | ✅ | ✅ | ❌ | 100 000 | 500 000 | 1 | 2 | ❌ | ❌ | ❌ |
| `stems` | ✅ | ✅ | ✅ | 500 000 | 1 000 000 | 1 | 3 | ❌ | ❌ | ❌ |
| `illimite` | ✅ | ✅ | ✅ | null | null | null | null | ✅ | ✅ | ❌ |
| `exclusive` | ✅ | ✅ | ✅ | null | null | null | null | ✅ | ✅ | ✅ |

### `clients`
Comptes globaux des artistes acheteurs sur la plateforme My Producer. Partagés entre toutes les boutiques.

#### Identité
| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `id` | UUID | ✅ Auto | Identifiant unique (lié à Supabase Auth) |
| `email` | text | ✅ Inscription | Email de connexion |
| `nom` | text | ✅ Inscription | Nom de famille |
| `prenom` | text | ✅ Inscription | Prénom |
| `nom_artiste` | text | ⬜ Optionnel | Nom de scène |
| `avatar_url` | text | ⬜ Optionnel | Photo de profil |
| `telephone` | text | ⬜ Optionnel | Numéro de téléphone |
| `langue` | text | ⬜ Auto | Langue détectée à l'inscription (ex: `fr`, `en`) — utilisée pour segmenter les communications |
| `created_at` | timestamp | ✅ Auto | Date d'inscription |
| `date_dernier_login` | timestamp | ✅ Auto | Dernière connexion |
| `fusionne_dans` | UUID | ⬜ Auto | UUID du compte principal en cas de fusion — `null` si compte actif |
| `fusionne_le` | timestamp | ⬜ Auto | Date de la fusion — `null` si compte actif |

#### Adresse (pour les contrats de licence)
| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `adresse` | text | ✅ Avant achat | Rue et numéro |
| `ville` | text | ✅ Avant achat | Ville |
| `code_postal` | text | ✅ Avant achat | Code postal |
| `pays` | text | ✅ Avant achat | Code pays (ex: "FR", "BE", "CA") |

> **Note :** L'adresse n'est pas demandée à l'inscription — uniquement au moment du premier achat pour générer le contrat de licence.

### `leads`
Trace la relation entre un artiste et la boutique d'un beatmaker. Créé au premier contact. Reste en base après conversion — permet de mesurer le temps et la source de conversion.

#### Identité
| Champ | Type | Description |
|---|---|---|
| `id` | UUID | Identifiant unique |
| `client_id` | UUID | Lien vers le client (compte My Producer) |
| `beatmaker_id` | UUID | Lien vers la boutique du beatmaker |
| `created_at` | timestamp | Date du premier contact |

#### Source
| Champ | Type | Description |
|---|---|---|
| `source` | text | Comment il est entré dans ce CRM : `visite` / `newsletter` / `free_download` / `achat` |

#### Statut
| Champ | Type | Description |
|---|---|---|
| `newsletter_inscrit` | boolean | Abonné à la newsletter du beatmaker |
| `converti` | boolean | `true` dès le premier achat |
| `date_conversion` | timestamp | Date du premier achat — `null` si pas encore converti |

### `commandes`
Historique de tous les achats de licences sur la plateforme. Une ligne = un achat. Les abonnements sont gérés dans `abonnements_boutique`.

#### Identité
| Champ | Type | Description |
|---|---|---|
| `id` | UUID | Identifiant unique |
| `created_at` | timestamp | Date de l'achat |
| `client_id` | UUID | Lien vers le client acheteur |
| `beatmaker_id` | UUID | Lien vers le beatmaker vendeur |
| `beat_id` | UUID | Lien vers le beat acheté |
| `licence_id` | UUID | Lien vers la licence choisie |

#### Paiement
| Champ | Type | Description |
|---|---|---|
| `prix_paye` | numeric(10,2) | Montant TTC réellement encaissé, en **euros décimaux** (ex: 44.95) — ⚠️ pas en centimes. C'est le prix final après remise (le code promo est appliqué côté serveur avant Stripe) |
| `devise` | text | `EUR` ou `USD` |
| `methode_paiement` | text | `stripe` / `paypal` / `apple_pay` / `google_pay` |
| `stripe_payment_id` | text | Référence du paiement Stripe |
| `statut` | text | `en_attente` / `payee` / `remboursee` / `litige` |
| `montant_rembourse` | numeric(10,2) | Montant remboursé en euros décimaux (0 par défaut — permet les remboursements partiels) |

#### Codes promo
| Champ | Type | Description |
|---|---|---|
| `code_promo` | text | Code utilisé — `null` si aucun |
| `reduction_montant` | numeric(10,2) | Montant de la réduction en euros décimaux — informatif, déjà reflété dans `prix_paye` |

> **Règle d'unités (feedback session 2026-06-26) :** `commandes.prix_paye`/`reduction_montant` sont en euros décimaux. `split_payments.montant`, `abonnements_boutique.prix`, `beatmakers.abo_prix` restent en **centimes**. Toujours vérifier la table source avant un calcul financier dans une route analytics.

#### Livraison
| Champ | Type | Description |
|---|---|---|
| `fichiers_livres` | boolean | Fichiers audio envoyés au client |
| `contrat_pdf_url` | text | Lien vers le contrat de licence généré automatiquement |
| `facture_pdf_url` | text | Lien vers la facture générée automatiquement |

#### Import externe
| Champ | Type | Description |
|---|---|---|
| `source_marketing` | text | Canal d'acquisition de la vente : `youtube` / `instagram` / `google` / `direct` / `autre` — `null` si non détecté |
| `plateforme_source` | text | `my_producer` / `beatstars` |
| `external_order_id` | text | Identifiant original BeatStars (ex: `bs:BSGUEST_05...`) — évite les doublons lors des imports CSV |

#### Upgrade de licence
| Champ | Type | Description |
|---|---|---|
| `type_transaction` | text | `achat` / `upgrade` — `achat` par défaut |
| `commande_originale_id` | UUID | Lien vers l'achat d'origine — `null` pour un achat normal, renseigné pour un upgrade |

> **Note upgrade :** Un upgrade génère une nouvelle commande (nouveau paiement, nouveau contrat PDF, nouvelle facture). La licence active d'un artiste sur un beat = la commande la plus récente. L'upgrade peut être proposé à prix réduit via un code promo ou une campagne marketing.

### `doublons_ignores`
Paires de clients que le beatmaker a décidé d'ignorer lors de la détection automatique de doublons. Évite de reproposer la même paire à chaque ouverture du CRM.

| Champ | Type | Description |
|---|---|---|
| `id` | UUID | Identifiant unique |
| `client_id_1` | UUID | Premier client de la paire |
| `client_id_2` | UUID | Second client de la paire |
| `beatmaker_id` | UUID | Beatmaker qui a ignoré la paire |
| `created_at` | timestamp | Date de la décision d'ignorer |

### `abonnements_plateforme`
Abonnements des beatmakers à My Producer. Un seul plan en V1, décliné en mensuel ou annuel. Essai gratuit 14 jours avec CB obligatoire — passage au payant automatique.

#### Identité
| Champ | Type | Description |
|---|---|---|
| `id` | UUID | Identifiant unique |
| `beatmaker_id` | UUID | Lien vers le beatmaker abonné |
| `created_at` | timestamp | Date de création de l'abonnement |
| `source_conversion` | text | Canal d'acquisition : `youtube` / `instagram` / `referral` / `organic` / `autre` |

#### Plan
| Champ | Type | Description |
|---|---|---|
| `plan` | text | Nom du plan (ex: `standard`) |
| `periode` | text | `mensuel` ou `annuel` |
| `prix` | integer | Prix en centimes au moment de la souscription |
| `devise` | text | `EUR` ou `USD` |

#### Essai gratuit
| Champ | Type | Description |
|---|---|---|
| `en_essai` | boolean | `true` pendant les 14 jours d'essai |
| `essai_fin_le` | timestamp | Date de fin de l'essai gratuit |

#### Statut
| Champ | Type | Description |
|---|---|---|
| `statut` | text | `en_essai` / `actif` / `annule` / `impaye` / `suspendu` (Étape 15c, 2026-07-24 — boutique suspendue depuis l'admin) |
| `date_debut` | timestamp | Date de début du premier cycle payant |
| `date_fin` | timestamp | Date de fin du cycle en cours (renouvellement ou expiration) |
| `date_annulation` | timestamp | Date d'annulation — `null` si actif |
| `statut_avant_suspension` | text | Statut réel avant une suspension admin — permet à la réactivation de restaurer le bon état plutôt que de deviner `actif`. Rempli/vidé uniquement par `lib/admin-boutiques.ts` |
| `annulation_prevue_le` | timestamp | Renseigné depuis `subscription.cancel_at` (Stripe) quand une annulation est programmée mais pas encore effective (ex. annulation pendant l'essai) — `null` sinon |

#### Stripe
| Champ | Type | Description |
|---|---|---|
| `stripe_subscription_id` | text | Référence de l'abonnement Stripe |
| `stripe_customer_id` | text | Référence du client Stripe |

> **Étape 8b (2026-07-24)** : ce système (beatmaker → My Producer) a un vrai parcours de paiement fonctionnel depuis cette date — 1 plan (mensuel 49,99€ / annuel 499,90€), essai 14 jours + CB obligatoire, checkout direct sans Stripe Connect. Voir `app/api/stripe/plateforme/checkout/route.ts` et `/dashboard/abonnement`. **Le blocage d'accès dashboard si non abonné n'est pas (encore) activé** — voir mémoire `project_abonnement_plateforme_decouverte`.

### `abonnements_boutique`
Abonnements des artistes aux boutiques des beatmakers. 1 seul plan en V1, que chaque beatmaker tarifie librement.

> **V2 :** Permettre aux beatmakers de proposer plusieurs plans (ex: Street, Studio, Pro) avec des contenus différents.

#### Identité
| Champ | Type | Description |
|---|---|---|
| `id` | UUID | Identifiant unique |
| `client_id` | UUID | Lien vers le client abonné |
| `beatmaker_id` | UUID | Lien vers le beatmaker |
| `created_at` | timestamp | Date de souscription |

#### Plan
| Champ | Type | Description |
|---|---|---|
| `plan` | text | `standard` — 1 seul plan en V1 |
| `periode` | text | `mensuel` / `annuel` |
| `prix` | integer | Prix en centimes au moment de la souscription (verrouillé — si le beatmaker change ses tarifs, les abonnés existants conservent leur prix) |
| `devise` | text | `EUR` ou `USD` (hérité de la devise du beatmaker) |

#### Fidélité
| Champ | Type | Description |
|---|---|---|
| `mois_consecutifs` | integer | Mois actifs consécutifs depuis la souscription — se remet à 0 en cas d'impayé ou de pause |
| `credit_licences` | integer | Licences gratuites disponibles — incrémenté de 1 tous les 4 mois consécutifs, décrémenté à l'utilisation |

#### Statut
| Champ | Type | Description |
|---|---|---|
| `statut` | text | `actif` / `annule` / `impaye` / `suspendu` (Étape 15c, 2026-07-24 — boutique suspendue depuis l'admin) |
| `date_debut` | timestamp | Début du premier cycle payant |
| `date_fin` | timestamp | Fin du cycle en cours (renouvellement ou expiration) |
| `date_annulation` | timestamp | Date d'annulation — `null` si actif |
| `motif_annulation` | text | `user_cancel` / `payment_failed` / `admin_cancel` — `null` si actif. Permet de distinguer une annulation volontaire (à relancer) d'un impayé (relance CB automatique) |
| `statut_avant_suspension` | text | Statut réel avant une suspension admin — voir même champ sur `abonnements_plateforme` |

#### Paiement
| Champ | Type | Description |
|---|---|---|
| `methode_paiement` | text | `stripe` / `paypal` |
| `stripe_subscription_id` | text | Référence de l'abonnement Stripe — `null` si PayPal |
| `stripe_customer_id` | text | Référence du client Stripe sous le compte Stripe Connect du beatmaker — `null` si PayPal |
| `paypal_subscription_id` | text | Référence de l'abonnement PayPal — `null` si Stripe |
| `paypal_payer_id` | text | Référence du compte PayPal de l'artiste — `null` si Stripe |

#### Import
| Champ | Type | Description |
|---|---|---|
| `external_subscription_id` | text | ID d'abonnement WooCommerce d'origine (ex: `woo_sub_3359`) — renseigné uniquement pour les abonnés migrés depuis une boutique externe |

> **Note :** Le contenu du plan (accès au catalogue privé, réductions, crédit fidélité) est défini dans la logique applicative — pas dans cette table. Le beatmaker configure le prix de son plan dans un écran dédié (étape 8).
>
> **Réductions :** 30% sur toutes les licences **sauf ILLIMITÉ et EXCLUSIVE**.
>
> **Crédit fidélité :** 1 crédit tous les 4 mois consécutifs. Le crédit vaut le prix de la licence WAV du beat choisi — l'artiste peut l'utiliser tel quel (WAV gratuit) ou payer la différence pour upgrader en STEMS ou ILLIMITÉ.
>
> **V2 :** Permettre aux beatmakers de créer des plans personnalisés avec leurs propres noms et contenus.

---

## Tables ajoutées depuis (module Business / étape 11d)

Non détaillées colonne par colonne ici — voir le fichier `supabase/*.sql` cité pour le schéma exact.

| Table | Rôle | Fichier SQL |
|-------|------|-------------|
| `codes_promo` | Codes promo par beatmaker : `type_remise` (panier/produit/abonnement), `type_valeur` (pourcentage/montant), restrictions (dates, licences, beats, emails, limites) | `business_migration.sql`, `codes_promo_ajustements.sql` |
| `beat_splits` | Collaborateurs par beat (pourcentage, email_invite ou beatmaker_id, statut) | `schema.sql` (déjà présent étape 4), câblage Stripe en `etape10_split_payments.sql` |
| `split_payments` | Paiements de splits — `montant` en **centimes** (contrairement à `commandes`), statut `transfere`/`en_attente`, `expire_le` | `etape10_split_payments.sql` |
| `beat_plays` | Écoutes trackées (30s min) : `client_id` nullable, puis enrichi `pays`, `device_type`, `source_marketing`, `duree_secondes` | `beat_plays.sql`, `beat_plays_enrichissement.sql` |
| `leads` | (déjà existante étape 9, réutilisée comme colonne vertébrale du CRM 11d) `source` visite/newsletter/free_download/achat, `converti` | `schema.sql` |
| `segments_crm` | Segments CRM : `filtres` jsonb (conditions ET/OU) | `segments_crm.sql` |
| `listes_crm` / `listes_crm_contacts` | Listes de contacts manuelles + table de liaison | `listes_crm.sql` |
| `doublons_ignores` | (déjà existante) paires de clients ignorées lors de la détection de doublons | `schema.sql` |
| `fusions_crm` | Historique des fusions de doublons (défusion possible) | `fusions_crm.sql` |
| `listes_contacts` / `liste_membres` | Créées upfront en Phase 0, **jamais utilisées** — remplacées par `listes_crm`/`listes_crm_contacts`. Tables mortes, pas encore supprimées. | `business_migration.sql` |
| `campagnes` | Campagnes email : `nom`, `objet`, `contenu` (blocs jsonb), `statut` (brouillon/planifiee/envoyee), `cible_mode`/`cible_id`/`cible_emails` (segment/liste/manuel), compteurs `destinataires`/`ouvertures`/`clics`/`conversions`/`desinscrits` | `business_migration.sql` + `marketing_migration*.sql` |
| `templates_email` | Bibliothèque de mises en page réutilisables (blocs jsonb) — `source` plateforme (officiel, `beatmaker_id` NULL) ou beatmaker (perso) | `marketing_migration.sql` |
| `campagne_envois` | Un email envoyé = une ligne : `resend_message_id`, `envoye_at`/`ouvert_at`/`clique_at`/`converti_at`/`desinscrit_at`, `bounce`/`plainte` — source des compteurs agrégés sur `campagnes` | `marketing_migration.sql`, `marketing_migration_webhook.sql`, `marketing_migration_conversions.sql` |
| `free_downloads` / `morceaux_clients` | Tables créées upfront en Phase 0 — `free_downloads` prévu étape 12 dédiée, `morceaux_clients` pas encore branchée | `business_migration.sql` |
| `stripe_events` | Log de chaque webhook Stripe reçu (Étape 15b, 2026-07-24) : `stripe_event_id` (unique, upsert anti-doublon sur rejeu), `type`, `statut` recu/traite/echoue, `erreur`. Consultable via `/dashboard/admin/stripe-events`, accès service_role uniquement | `phase15_1_admin_support.sql` |

**Colonnes ajoutées sur des tables existantes :** `clients` (spotify, youtube, tiktok, notes, tags, instagram, newsletter_consent), `beats` (couleur, free_download_actif), `commandes` (notes, type_commande LICENCE/CREATION_ABONNEMENT/RENOUVELLEMENT, stripe_session_id, source_marketing élargi à 9 valeurs, acheteur_email/acheteur_nom pour les invités), `abonnements_boutique` (fin_essai, annulation_en_cours, mensualites_payees, **statut `suspendu` + `statut_avant_suspension`, 2026-07-24**), `abonnements_plateforme` (**statut `suspendu` + `statut_avant_suspension` + `annulation_prevue_le`, 2026-07-24**), `beatmakers` (domaine_envoi_email, domaine_envoi_verifie — pas encore utilisées, cf Phase 4.5 ; **`suspendu_le` + `suspendu_raison`, 2026-07-24**).
