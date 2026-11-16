import type { Metadata } from 'next'
import Link from 'next/link'
import { NOM_PLATEFORME, EMAIL_CONTACT } from '@/lib/constantes'

// Confidentialité du COMPTE de la personne sur la plateforme (9d lot 4) : ici
// la plateforme est responsable. Les données confiées à chaque boutique
// relèvent de la boutique (bloc obligatoire sur sa page Confidentialité,
// lib/bloc-plateforme-legal.ts). Ouverte malgré la maintenance (pas dans
// lib/maintenance.ts). Texte à faire relire par un juriste (étape 17).
export const metadata: Metadata = {
  title: `Confidentialité du compte ${NOM_PLATEFORME}`,
  alternates: { canonical: '/confidentialite' },
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-bold text-white">{titre}</h2>
      <div className="text-sm text-gray-300 leading-relaxed space-y-2">{children}</div>
    </section>
  )
}

export default function ConfidentialitePlateformePage() {
  return (
    <main className="min-h-screen bg-gray-950 px-6 py-16">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-black text-white">Confidentialité du compte {NOM_PLATEFORME}</h1>
          <p className="text-sm text-gray-500 mt-2">
            Cette page concerne ton compte {NOM_PLATEFORME} (la connexion qui te sert dans toutes les boutiques).
            Ce que tu confies à une boutique est expliqué sur la page Confidentialité de cette boutique.
          </p>
        </div>

        <Section titre="Deux niveaux distincts">
          <p>
            <strong>Ton compte {NOM_PLATEFORME}</strong> : ta connexion, tes favoris et la page « Mon compte ». {NOM_PLATEFORME} en est
            responsable.
          </p>
          <p>
            <strong>Chaque boutique</strong> est un commerce indépendant, responsable de sa propre fiche client : elle ne reçoit que ce que
            tu lui donnes à elle (par exemple ton email quand tu te connectes chez elle, tes coordonnées quand tu y paies). Les autres
            boutiques n&apos;y ont pas accès. {NOM_PLATEFORME} agit pour le compte des boutiques comme prestataire technique et
            n&apos;utilise ces données que pour faire fonctionner le service.
          </p>
        </Section>

        <Section titre="Ce que contient ton compte">
          <p>
            Ton adresse email, ton mot de passe (jamais stocké en clair) ou ta connexion Google, le prénom et le nom saisis à
            l&apos;inscription et tes favoris. Les coordonnées que tu donnes en payant ne sont pas gardées sur ton compte : elles
            restent sur ta commande et chez la boutique où tu as acheté.
          </p>
          <p>Ces données servent uniquement à te connecter, à retrouver tes achats et tes favoris, et à t&apos;envoyer les emails liés à ton compte.</p>
        </Section>

        <Section titre="Prestataires techniques">
          <p>
            Hébergement du site (Vercel), base de données et connexion (Supabase), stockage des fichiers (Cloudflare), envoi des emails
            (Resend), paiement (Stripe). Ils traitent les données uniquement pour fournir leur service.
          </p>
        </Section>

        <Section titre="Tes droits">
          <p>
            Tu peux consulter ton compte à tout moment depuis « Mon compte », et le <strong>supprimer toi-même</strong> en bas de la page « Mon compte » :
            ta connexion et tes favoris sont alors supprimés, et les informations de ton compte sont effacées. Tu reçois un email de confirmation.
          </p>
          <p>
            Les boutiques gardent leur fiche client et leurs factures (elles sont des commerces indépendants). Pour obtenir une copie de
            tes données chez une boutique ou les faire effacer, écris-lui directement (page Contact de la boutique).
          </p>
          <p>
            Pour toute autre question sur ton compte : <a href={`mailto:${EMAIL_CONTACT}`} className="underline hover:text-white">{EMAIL_CONTACT}</a>.
            Tu peux aussi saisir l&apos;autorité de protection des données de ton pays (en France, la CNIL).
          </p>
        </Section>

        <div className="pt-4 border-t border-gray-800">
          <Link href="/mon-compte" className="text-sm text-gray-400 hover:text-white">Aller à « Mon compte » →</Link>
        </div>
      </div>
    </main>
  )
}
