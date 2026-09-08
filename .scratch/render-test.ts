import { texteTemplateStandard, resoudreVariablesLicence, blocRolePlateforme } from '../lib/licences-textes.ts'

const texte = texteTemplateStandard()
const rendu = resoudreVariablesLicence(texte, {
  typeLicenceLabel: 'WAV',
  boutique: 'jakeb-test',
  titreBeat: 'Bandits',
  prixPaye: '49,96 €',
  fichiersLivres: '1 fichier MP3, 1 fichier WAV',
  concedant: {
    nom_artiste: 'Jake B',
    raison_sociale: 'Jake B (Nicolas JACOB)',
    forme_juridique: 'micro-entreprise',
    numero_entreprise: '904 733 342 00011',
    siege_social_adresse: null,
    adresse: '342 chemin départemental 258 annexe',
    ville: 'Solliès-Ville',
    code_postal: '83210',
    email_contact_public: 'contact@jakebmusic.com',
  },
  licencieNom: 'Jordan Hanssens',
  licencieAdresse: "Rue de l'hôtel",
  collaborateurs: [],
  limiteStreams: 100000,
  limiteVentesPhysiques: 4000,
  limiteVuesVideo: 500000,
  limiteClipsVideo: 1,
  limiteRadioTv: 2,
  performancesAutorisees: false,
  dateAchat: '3 septembre 2026',
})

console.log(rendu + '\n\n' + blocRolePlateforme())

console.log('\n\n=== Sans forme juridique ni SIRET (beatmaker sans entreprise) ===\n')
const renduSansEntreprise = resoudreVariablesLicence(texteTemplateStandard(), {
  typeLicenceLabel: 'MP3',
  boutique: 'jakeb-test',
  titreBeat: 'Coeur',
  prixPaye: '41,63 €',
  fichiersLivres: '1 fichier MP3',
  concedant: {
    nom_artiste: 'Jake B',
    raison_sociale: null,
    forme_juridique: null,
    numero_entreprise: null,
    siege_social_adresse: null,
    adresse: null,
    ville: null,
    code_postal: null,
    email_contact_public: null,
  },
  licencieNom: 'Alan Payet',
  licencieAdresse: null,
  collaborateurs: [{ nom: 'Un Collaborateur (co-compositeur)' }],
  limiteStreams: 50000,
  limiteVentesPhysiques: 2000,
  limiteVuesVideo: 200000,
  limiteClipsVideo: 1,
  limiteRadioTv: 1,
  performancesAutorisees: true,
  dateAchat: '3 septembre 2026',
})
console.log(renduSansEntreprise.split('\n').slice(0, 15).join('\n'))
