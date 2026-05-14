# My Producer — Architecture de la base de données

> Dernière mise à jour : 2026-05-13

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
| `prix` | integer | Prix en centimes (ex: 4995 = 49,95€) |
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
| `prix_paye` | integer | Prix en centimes au moment de l'achat (conservé même si le prix change après) |
| `devise` | text | `EUR` ou `USD` |
| `methode_paiement` | text | `stripe` / `paypal` / `apple_pay` / `google_pay` |
| `stripe_payment_id` | text | Référence du paiement Stripe |
| `statut` | text | `en_attente` / `payee` / `remboursee` / `litige` |
| `montant_rembourse` | integer | Montant remboursé en centimes (0 par défaut — permet les remboursements partiels) |

#### Codes promo
| Champ | Type | Description |
|---|---|---|
| `code_promo` | text | Code utilisé — `null` si aucun |
| `reduction_montant` | integer | Montant de la réduction en centimes |

#### Livraison
| Champ | Type | Description |
|---|---|---|
| `fichiers_livres` | boolean | Fichiers audio envoyés au client |
| `contrat_pdf_url` | text | Lien vers le contrat de licence généré automatiquement |
| `facture_pdf_url` | text | Lien vers la facture générée automatiquement |

#### Import externe
| Champ | Type | Description |
|---|---|---|
| `plateforme_source` | text | `my_producer` / `beatstars` |
| `external_order_id` | text | Identifiant original BeatStars (ex: `bs:BSGUEST_05...`) — évite les doublons lors des imports CSV |

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
Abonnements des beatmakers à My Producer (ce qu'ils paient à Jake).
*À définir*

### `abonnements_boutique`
Abonnements des artistes aux boutiques des beatmakers (Street, Studio, Pro...).
*À définir*
