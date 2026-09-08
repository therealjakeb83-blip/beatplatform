import { writeFileSync } from 'fs'
import { genererContratPdf, type ContratLicenceInput } from '../lib/contrat.ts'

async function main() {
  // Cas 2 : sans entreprise, avec collaborateur
  const inputSansEntreprise: ContratLicenceInput = {
    beat: { titre: 'Coeur', bpm: 90, cle: 'Cm' },
    beatmaker: {
      nom_artiste: 'Jake B',
      slug: 'jakeb-test',
      raison_sociale: null,
      forme_juridique: null,
      numero_entreprise: null,
      siege_social_adresse: null,
      adresse: null,
      ville: null,
      code_postal: null,
      email_contact_public: null,
    },
    acheteur: { nom: 'Alan Payet', email: 'alan@example.com', adresse: null },
    licence: {
      nom: 'MP3',
      modele: 'mp3',
      inclut_mp3: true,
      inclut_wav: false,
      inclut_stems: false,
      streams_limite: 50000,
      ventes_physiques_limite: 2000,
      vues_video_limite: 200000,
      clips_video_limite: 1,
      radio_tv_limite: 1,
      lives_performances_autorise: true,
    },
    splits: [
      { nom_artiste: 'Jake B', pourcentage: 50 },
      { nom_artiste: 'Un Collaborateur', pourcentage: 50 },
    ],
    prixPaye: 41.63,
    texteEditable: null,
    dateVente: new Date('2026-09-03'),
  }
  const pdf2 = await genererContratPdf(inputSansEntreprise)
  writeFileSync('.scratch/contrat-test-2.pdf', pdf2)
  console.log('Cas 2 (sans entreprise + collab) OK :', pdf2.length, 'bytes')

  // Cas 3 : repli sur le rendu simple pour licence illimité (texte pas encore rédigé)
  const inputIllimite: ContratLicenceInput = {
    ...inputSansEntreprise,
    licence: { ...inputSansEntreprise.licence, nom: 'ILLIMITÉ', modele: 'illimite' },
  }
  const pdf3 = await genererContratPdf(inputIllimite)
  writeFileSync('.scratch/contrat-test-3-illimite.pdf', pdf3)
  console.log('Cas 3 (illimité, repli rendu simple) OK :', pdf3.length, 'bytes')
}
main().catch(err => { console.error(err); process.exit(1) })
