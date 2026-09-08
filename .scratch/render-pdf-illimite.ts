import { writeFileSync } from 'fs'
import { genererContratPdf, type ContratLicenceInput } from '../lib/contrat.ts'

async function main() {
  const input: ContratLicenceInput = {
    beat: { titre: 'Au sommet', bpm: 128, cle: 'Gm' },
    beatmaker: {
      nom_artiste: 'Jake B',
      slug: 'jakeb-test',
      raison_sociale: 'Jake B (Nicolas JACOB)',
      forme_juridique: 'micro-entreprise',
      numero_entreprise: '904 733 342 00011',
      siege_social_adresse: null,
      adresse: '342 chemin départemental 258 annexe',
      ville: 'Solliès-Ville',
      code_postal: '83210',
      email_contact_public: 'contact@jakebmusic.com',
    },
    acheteur: { nom: 'dylan dahan', email: 'dylan@example.com', adresse: 'markova 12' },
    licence: {
      nom: 'ILLIMITÉ',
      modele: 'illimite',
      inclut_mp3: true,
      inclut_wav: true,
      inclut_stems: true,
      streams_limite: null,
      ventes_physiques_limite: null,
      vues_video_limite: null,
      clips_video_limite: null,
      radio_tv_limite: null,
      lives_performances_autorise: true,
    },
    splits: [{ nom_artiste: 'Jake B', pourcentage: 100 }],
    prixPaye: 166.63,
    texteEditable: null,
    dateVente: new Date('2026-09-07'),
  }

  const pdf = await genererContratPdf(input)
  writeFileSync('.scratch/contrat-test-illimite.pdf', pdf)
  console.log('PDF illimité généré:', pdf.length, 'bytes')
}
main().catch(err => { console.error('ECHEC:', err); process.exit(1) })
