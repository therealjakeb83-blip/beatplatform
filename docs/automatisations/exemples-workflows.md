# Exemples de workflows — Automatisations Marketing (Phase 5)

Textes réels fournis par Jake le 2026-07-04, utilisés tels quels sur sa propre boutique. Ce sont les textes de référence pour construire les templates des automatisations (11d Phase 5 — voir `ROADMAP.md`). Toujours envoyés en **J+1** (jamais le jour même) — choix délibéré pour ne jamais sonner robotique.

---

## 1. Bienvenue abonnement (nouvel abo)

```
Yo {{ customer.first_name | default: customer.username }}, ça va ?
J'ai vu ton abonnement d'hier, merci beaucoup et bienvenue dans l'équipe 💙
Si jamais tu cherches un style en particulier, dis moi et je te prépare une petite sélection perso de beats directement dans ton mood !
Et si t'as besoin d'un MP3 pour maquetter un beat privé, n'hésites pas, je suis là 🦾
À très vite,
Jake
```

---

## 2. Remerciement achat — 1er achat (licence)

```
Salut {{ customer.first_name | default: customer.username }}, ça va ?
Je viens de voir ton achat d'hier, merci pour la force ça fait plaisir d'avoir un nouvel artiste qui bosse sur mes prods 🙏🏼
N'hésite pas à m'envoyer ce que tu feras sur le beat, je te donnerai mon avis avec plaisir !
Et si jamais ça t'intéresse, j'ai aussi quelques prods qui sont pas sur YouTube, je peux t'envoyer 2–3 extraits
À très vite,
Jake
```

---

## 3. Remerciement achat — récurrent (licence, pas le 1er)

```
Salut {{ customer.first_name }}, ça va ?
Merci beaucoup pour ta commande d'hier, ça fais plaisir de te voir bosser à nouveau sur mes prods 🙏🏼
Comme d'hab n'hésite pas à m'envoyer ton futur morceau pour que je te fasse un retour !
À très vite,
Jake
```

> Note : sur sa boutique, Jake fait varier certains mots entre #2/#3 selon 1 seul beat acheté vs plusieurs (singulier/pluriel). La V1 de My Producer élargit à **4 paliers** (1er/2e/3e/4e et +), calculés sur les vraies données de Jake : 3587 commandes / 2362 clients = 1.5 commande/client en moyenne globale ; 1853 commandes / 594 clients récurrents = 3.1 en moyenne.

---

## 4. Abonnement en attente (renouvellement non passé, pas une annulation)

```
Salut {{ customer.first_name | default: customer.username }}, ça va ?
Juste pour te prévenir : le renouvellement n'est pas passé ce mois-ci (rien de grave 👌🏼)
Ton abo est juste en pause, tu peux le relancer via ton espace client quand tu veux !
Rassure toi: ça ne bloque pas ta progression vers la prod gratuite (il te reste {{ subscription.tempsavantpromo }} mois sur 4)
Si t'as la moindre question, je suis là :)
Jake
```

---

## 5. Churn message perso (annulation réelle)

```
Salut {{ customer.first_name | default: customer.username }}, ça va ?
J'ai vu que t'avais mis fin à ton abo hier, merci d'avoir tenté l'aventure✨
Si t'as 2 minutes, ça m'aiderait vraiment d'avoir ton ressenti : ce que t'as aimé dans l'expérience, ce qui t'a décu ou manqué, ton retour est super précieux pour moi 🙏
À très vite,
Jake
PS : Et n'hésite pas à m'envoyer tes prochains morceaux, je suis toujours super chaud d'écouter ;)
```

---

## Exemple combiné réel — "Kaaris" (référence pour les combinaisons fréquentes)

Cas réel où plusieurs événements tombent le même jour (achat + abonnement + tentative d'achat échouée) : sert de modèle pour les templates combinés codés en dur (pas d'IA) sur les combos fréquentes.

```
Salut Kaaris ça va ?

Merci pour ton achat d'hier ça fais plaisir de te voir à nouveau poser sur mes prods,

Au passage merci pour ton abonnement si tu as besoin d'une prod n'hésite pas

Et j'ai vue que tu as essayé d'acheter une autre prod hier mais sans succes, tu as besoin d'aide à propos ?

Jake
```

---

## Workflows sans texte existant (à rédiger en session)

- **Bienvenue perso** (compte créé sans achat/abo) — nouveau, aucun équivalent chez Jake
- **Relance inactivité** (X mois sans achat) — nouveau, aucun équivalent chez Jake
- **Follow-up free download** — tracking déjà existant, pas de texte de référence
- **Follow-up favori** — tracking déjà existant, pas de texte de référence

Détail complet de l'architecture (paliers, combinaisons, système IA pour les cas rares) : voir `ROADMAP.md` (11d Phase 5) et la mémoire Claude `project_phase5_automatisations_redesign.md`.
