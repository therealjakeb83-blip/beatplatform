import { writeFileSync } from 'fs'
import { genererContratPdf, type ContratLicenceInput } from '../lib/contrat.ts'

const input: ContratLicenceInput = {
  beat: { titre: 'Bandits', bpm: 140, cle: 'Am' },
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
  acheteur: { nom: 'Jordan Hanssens', email: 'jordan@example.com', adresse: "Rue de l'hôtel, 75002 Paris" },
  licence: {
    nom: 'WAV',
    modele: 'wav',
    inclut_mp3: true,
    inclut_wav: true,
    inclut_stems: false,
    streams_limite: 100000,
    ventes_physiques_limite: 4000,
    vues_video_limite: 500000,
    clips_video_limite: 1,
    radio_tv_limite: 2,
    lives_performances_autorise: false,
  },
  splits: [{ nom_artiste: 'Jake B', pourcentage: 100 }],
  prixPaye: 49.96,
  texteEditable: null,
  dateVente: new Date('2026-09-03'),
}

async function main() {
  const pdfBytes = await genererContratPdf(input)
  writeFileSync('.scratch/contrat-test.pdf', pdfBytes)
  console.log('PDF généré:', pdfBytes.length, 'bytes')
}
main()
