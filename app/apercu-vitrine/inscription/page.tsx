import Image from 'next/image'
import Link from 'next/link'
import { Logo } from '../_composants/Logo'
import { Coche, Etincelle } from '../_composants/Icones'
import { CHEMIN_VITRINE } from '../_composants/liens'
import { FormulaireFactice } from './FormulaireFactice'
import './inscription.css'

const ATOUTS = ['Boutique sur ton nom de domaine', 'Fichier clients, e-mails et automatisations', '0 % de commission sur tes ventes']

export default function InscriptionFacticePage() {
  return (
    <div className="v-inscription">
      <div className="v-inscription-gauche">
        <header className="v-inscription-tete">
          <Link href={CHEMIN_VITRINE} aria-label="Sonoo, retour au site">
            <Logo hauteur={28} />
          </Link>
          <Link href={CHEMIN_VITRINE} className="v-inscription-retour">
            Retour au site
          </Link>
        </header>

        <main className="v-inscription-centre">
          <h1 className="v-inscription-titre">Crée ton compte Sonoo</h1>
          <p className="v-inscription-sous">Lance ta boutique et démarre ton essai gratuit de l’offre Pro.</p>
          <FormulaireFactice />
        </main>

        <footer className="v-inscription-pied">
          <span>© 2026 Sonoo</span>
          <span>Confidentialité · Conditions</span>
        </footer>
      </div>

      <aside className="v-inscription-droite" aria-label="Ce que comprend l’offre Pro">
        <span className="v-bientot v-bientot-plein">
          <Etincelle taille={10} />
          Essai gratuit · offre Pro
        </span>
        <p className="v-inscription-slogan">Ta boutique. Ta marque. Tes clients.</p>
        <ul className="v-inscription-atouts">
          {ATOUTS.map(a => (
            <li key={a}>
              <span className="v-coche-pleine">
                <Coche taille={14} />
              </span>
              {a}
            </li>
          ))}
        </ul>
        <Image
          src="/apercu-vitrine/inscription-telephone.webp"
          alt="La boutique de Jake B sur mobile, avec une notification « Nouvelle vente : +49,00 € »"
          width={580}
          height={432}
          className="v-inscription-visuel"
          priority
        />
      </aside>
    </div>
  )
}
