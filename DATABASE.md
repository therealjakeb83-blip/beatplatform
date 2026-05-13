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
*À définir*

### `licences`
*À définir*

### `clients`
*À définir*

### `commandes`
*À définir*

### `abonnements_plateforme`
Abonnements des beatmakers à My Producer (ce qu'ils paient à Jake).
*À définir*

### `abonnements_boutique`
Abonnements des artistes aux boutiques des beatmakers (Street, Studio, Pro...).
*À définir*
