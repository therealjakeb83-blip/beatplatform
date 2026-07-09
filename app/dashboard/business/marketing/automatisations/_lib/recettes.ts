export type Recette = {
  type: string
  categorie: string
  label: string
  description: string
  corpsDefaut: string
  variablesSupplementaires?: { token: string; label: string }[]
  // Paramètre numérique propre à la recette, stocké dans automatisations.config
  // (jsonb) — ex. le nombre de mois d'inactivité avant relance.
  champConfig?: { cle: string; label: string; defaut: number; suffixe: string }
}

// Ordre d'affichage des catégories — reprend les "slots" déjà actés pour la
// gestion des combinaisons (ROADMAP, Phase 5) : Abonnement/Achats/Engagement
// sont mutuellement exclusifs par nature pour un même client.
export const ORDRE_CATEGORIES = ['Abonnement', 'Achats', 'Engagement']

const SLUGS_CATEGORIES: Record<string, string> = {
  Abonnement: 'abonnement',
  Achats: 'achats',
  Engagement: 'engagement',
}

export function slugCategorie(categorie: string): string {
  return SLUGS_CATEGORIES[categorie] ?? categorie.toLowerCase()
}

export function categorieDepuisSlug(slug: string): string | null {
  const entree = Object.entries(SLUGS_CATEGORIES).find(([, s]) => s === slug)
  return entree ? entree[0] : null
}

export const RECETTES: Recette[] = [
  {
    type: 'bienvenue_abonnement',
    categorie: 'Abonnement',
    label: 'Bienvenue abonnement',
    description: "Envoyé le lendemain d'un nouvel abonnement.",
    corpsDefaut: `Yo {{prénom}}, ça va ?
J'ai vu ton abonnement d'hier, merci beaucoup et bienvenue dans l'équipe 💙
Si jamais tu cherches un style en particulier, dis moi et je te prépare une petite sélection perso de beats directement dans ton mood !
Et si t'as besoin d'un MP3 pour maquetter un beat privé, n'hésites pas, je suis là 🦾
À très vite,
Jake`,
  },
  {
    type: 'abonnement_en_attente',
    categorie: 'Abonnement',
    label: 'Abonnement en attente',
    description: "Envoyé le lendemain d'un renouvellement en échec (pas une annulation).",
    corpsDefaut: `Salut {{prénom}}, ça va ?
Juste pour te prévenir : le renouvellement n'est pas passé ce mois-ci (rien de grave 👌🏼)
Ton abo est en pause — tu as un mois pour le relancer via ton espace client, sinon il sera automatiquement annulé.
Rassure-toi, ça ne bloque pas ta progression vers le prochain beat cadeau (il te reste {{mois_avant_cadeau}} mois)
Si t'as la moindre question, je suis là :)
Jake`,
    variablesSupplementaires: [
      { token: 'mois_avant_cadeau', label: 'Mois avant le beat cadeau' },
    ],
  },
  {
    type: 'churn_message_perso',
    categorie: 'Abonnement',
    label: 'Churn message perso',
    description: "Envoyé le lendemain de la décision d'annuler (même si l'abonné reste actif jusqu'à la fin de sa période payée) — distinct d'un simple renouvellement en échec.",
    corpsDefaut: `Salut {{prénom}}, ça va ?
J'ai vu que t'avais mis fin à ton abo hier, merci d'avoir tenté l'aventure✨
Si t'as 2 minutes, ça m'aiderait vraiment d'avoir ton ressenti : ce que t'as aimé dans l'expérience, ce qui t'a déçu ou manqué, ton retour est super précieux pour moi 🙏
À très vite,
Jake
PS : Et n'hésite pas à m'envoyer tes prochains morceaux, je suis toujours super chaud d'écouter ;)`,
  },
  {
    type: 'remerciement_1er_achat',
    categorie: 'Achats',
    label: 'Remerciement achat — 1er achat',
    description: "Envoyé le lendemain du tout premier achat de licence d'un client.",
    corpsDefaut: `Salut {{prénom}}, ça va ?
Je viens de voir ton achat d'hier, merci pour la force ça fait plaisir d'avoir un nouvel artiste qui bosse sur mes prods 🙏🏼
N'hésite pas à m'envoyer ce que tu feras sur {{titre_beats}}, je te donnerai mon avis avec plaisir !
Et si jamais ça t'intéresse, j'ai aussi quelques prods qui sont pas sur YouTube, je peux t'envoyer 2–3 extraits
À très vite,
Jake`,
    variablesSupplementaires: [
      { token: 'titre_beats', label: 'Titre(s) du/des beat(s) acheté(s)' },
    ],
  },
  {
    type: 'remerciement_2e_achat',
    categorie: 'Achats',
    label: 'Remerciement achat — 2e achat',
    description: "Envoyé le lendemain du 2e achat de licence d'un client.",
    corpsDefaut: `Salut {{prénom}}, ça va ?
Merci beaucoup pour ta commande d'hier, ça fais plaisir de te voir bosser à nouveau sur mes prods 🙏🏼
Comme d'hab n'hésite pas à m'envoyer ton futur morceau pour que je te fasse un retour !
À très vite,
Jake`,
    variablesSupplementaires: [
      { token: 'titre_beats', label: 'Titre(s) du/des beat(s) acheté(s)' },
    ],
  },
  {
    type: 'remerciement_3e_achat',
    categorie: 'Achats',
    label: 'Remerciement achat — 3e achat',
    description: "Envoyé le lendemain du 3e achat de licence d'un client.",
    corpsDefaut: `Salut {{prénom}}, ça va ?
Encore une commande, merci infiniment, tu fais clairement partie des habitués maintenant et ça me touche vraiment 🙏🏼
J'ai hâte d'écouter ce que tu feras sur {{titre_beats}} !
À très vite,
Jake`,
    variablesSupplementaires: [
      { token: 'titre_beats', label: 'Titre(s) du/des beat(s) acheté(s)' },
    ],
  },
  {
    type: 'remerciement_4e_achat_plus',
    categorie: 'Achats',
    label: 'Remerciement achat — 4e achat et +',
    description: "Envoyé le lendemain du 4e achat (ou plus) de licence d'un client.",
    corpsDefaut: `Salut {{prénom}}, ça va ?
Merci pour ta dernière commande, toujours un plaisir de te voir revenir 🙏🏼
Hâte d'entendre ce que tu vas faire avec {{titre_beats}} !
À très vite,
Jake`,
    variablesSupplementaires: [
      { token: 'titre_beats', label: 'Titre(s) du/des beat(s) acheté(s)' },
    ],
  },
  {
    type: 'bienvenue_perso',
    categorie: 'Engagement',
    label: 'Bienvenue perso',
    description: "Envoyé le lendemain de la création d'un compte, seulement si rien d'autre ne s'est passé ce jour-là (pas d'achat ni d'abonnement — sinon le remerciement correspondant suffit).",
    corpsDefaut: `Salut {{prénom}}, ça va ?
Je viens de voir que tu as créé ton compte, bienvenue par ici 🙌🏼
N'hésite pas à jeter un œil à mes prods, et si t'as un coup de cœur ou une question, je suis dispo !
À très vite,
Jake`,
  },
  {
    type: 'relance_inactivite',
    categorie: 'Engagement',
    label: 'Relance inactivité',
    description: "Envoyé quand un client n'a plus rien acheté depuis X mois (configurable ci-dessous).",
    champConfig: { cle: 'mois_inactivite', label: "Mois d'inactivité avant relance", defaut: 3, suffixe: 'mois' },
    corpsDefaut: `Salut {{prénom}}, ça va ?
Ça fait un moment qu'on s'est pas croisés, j'espère que tout va bien de ton côté 🙏🏼
Je viens de sortir pas mal de nouvelles prods depuis ta dernière visite, n'hésite pas à venir jeter un œil si t'as 5 minutes !
À très vite,
Jake`,
  },
  {
    type: 'follow_up_free_download',
    categorie: 'Engagement',
    label: 'Follow-up free download',
    description: "Envoyé le lendemain d'un téléchargement gratuit — sauté si le client a déjà acheté le beat entre-temps.",
    corpsDefaut: `Salut {{prénom}}, ça va ?
Je voulais savoir ce que tu penses de {{titre_beat}} que t'as téléchargé, ça t'a plu ?
Si jamais tu veux la version complète pour sortir ton morceau, tu sais où me trouver !
À très vite,
Jake`,
    variablesSupplementaires: [
      { token: 'titre_beat', label: 'Titre du beat téléchargé' },
    ],
  },
  {
    type: 'follow_up_favori',
    categorie: 'Engagement',
    label: 'Follow-up favori',
    description: "Envoyé le lendemain d'un ajout aux favoris — sauté si le client a déjà acheté le beat entre-temps.",
    corpsDefaut: `Salut {{prénom}}, ça va ?
J'ai vu que t'avais ajouté {{titre_beat}} à tes favoris, il t'a tapé dans l'œil 👀
Si t'hésites encore, dis-moi si t'as des questions, je suis là !
À très vite,
Jake`,
    variablesSupplementaires: [
      { token: 'titre_beat', label: 'Titre du beat favori' },
    ],
  },
]
