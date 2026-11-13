'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { normaliserEmail } from '@/lib/email'
import { Fleche, Info, Oeil, OeilBarre } from '../_composants/Icones'

// Démonstration : rien n'est envoyé, aucun compte n'est créé.
export function FormulaireFactice() {
  const [voirMotDePasse, setVoirMotDePasse] = useState(false)
  const [email, setEmail] = useState('')
  const [envoye, setEnvoye] = useState(false)

  function valider(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setEnvoye(true)
  }

  return (
    <form className="v-formulaire" onSubmit={valider}>
      <label className="v-champ">
        <span>Nom d’artiste</span>
        <input type="text" name="nom" autoComplete="nickname" placeholder="Ex. Jake B" required />
      </label>
      <label className="v-champ">
        <span>Adresse e-mail</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          placeholder="toi@exemple.com"
          value={email}
          onChange={e => setEmail(normaliserEmail(e.target.value))}
          required
        />
      </label>
      <div className="v-champ">
        <label htmlFor="v-mot-de-passe">Mot de passe</label>
        <div className="v-champ-mdp">
          <input
            id="v-mot-de-passe"
            type={voirMotDePasse ? 'text' : 'password'}
            name="mot_de_passe"
            autoComplete="new-password"
            placeholder="Choisis un mot de passe"
            minLength={8}
            aria-describedby="v-mdp-aide"
            required
          />
          <button
            type="button"
            className="v-champ-oeil"
            aria-label={voirMotDePasse ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            onClick={() => setVoirMotDePasse(v => !v)}
          >
            {voirMotDePasse ? <OeilBarre taille={20} /> : <Oeil taille={20} />}
          </button>
        </div>
        <p id="v-mdp-aide" className="v-champ-aide">
          <Info taille={14} />
          Au moins 8 caractères.
        </p>
      </div>
      <label className="v-case">
        <input type="checkbox" name="conditions" defaultChecked required />
        <span>J’accepte les Conditions générales et la Politique de confidentialité de Sonoo.</span>
      </label>
      <button type="submit" className="v-bouton v-bouton-bleu v-bouton-large v-formulaire-valider">
        Créer mon compte
        <Fleche taille={20} />
      </button>
      <p role="status" className={envoye ? 'v-formulaire-statut v-formulaire-statut-visible' : 'v-formulaire-statut'}>
        {envoye ? 'Page de démonstration : aucun compte n’a été créé et aucun e-mail n’a été envoyé.' : ''}
      </p>
      <p className="v-formulaire-deja">
        Déjà un compte ? <Link href="/connexion">Se connecter</Link>
      </p>
    </form>
  )
}
