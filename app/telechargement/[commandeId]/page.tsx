import { createAdminClient } from '@/utils/supabase/admin'
import { genererUrlsSignees, genererUrlSigneePdf, uploadPdfContrat } from '@/lib/livraison'
import { genererContratPdf } from '@/lib/contrat'
import { notFound } from 'next/navigation'
import TelechargerBouton from './_components/TelechargerBouton'

export const runtime = 'nodejs'

type LigneDispo = {
  ligneId: string
  titre: string
  licenceNom: string
  fichiersSignes: { label: string; url: string }[]
  pdfSigneUrl: string | null
}

export default async function TelechargerPage({
  params,
}: {
  params: Promise<{ commandeId: string }>
}) {
  const { commandeId } = await params
  const supabase = createAdminClient()

  const { data: commande, error: commandeError } = await supabase
    .from('commandes')
    .select('id, beatmaker_id, acheteur_email, acheteur_nom')
    .eq('id', commandeId)
    .single()

  if (commandeError) console.error('[telechargement] Erreur query commande:', JSON.stringify(commandeError))
  if (!commande) notFound()

  const { data: lignes, error: lignesError } = await supabase
    .from('commande_lignes')
    .select('id, beat_id, licence_id, contrat_pdf_url, splits_snapshot')
    .eq('commande_id', commandeId)

  if (lignesError) console.error('[telechargement] Erreur query commande_lignes:', JSON.stringify(lignesError))
  if (!lignes || lignes.length === 0) notFound()

  const beatIds = [...new Set(lignes.map(l => l.beat_id))]
  const licenceIds = [...new Set(lignes.map(l => l.licence_id))]

  const [{ data: beatsData }, { data: licencesData }, { data: beatmaker }] = await Promise.all([
    supabase.from('beats').select('id, titre, bpm, cle, mp3_propre_url, wav_url, stems_url').in('id', beatIds),
    supabase.from('licences').select('id, nom, modele').in('id', licenceIds),
    supabase.from('beatmakers').select('nom_artiste').eq('id', commande.beatmaker_id).single(),
  ])

  const beatMap = new Map((beatsData ?? []).map(b => [b.id, b]))
  const licenceMap = new Map((licencesData ?? []).map(l => [l.id, l]))

  const lignesDispo: LigneDispo[] = []

  for (const ligne of lignes) {
    const beat = beatMap.get(ligne.beat_id)
    const licence = licenceMap.get(ligne.licence_id)
    if (!beat || !licence) continue

    // Générer le PDF si pas encore fait
    let contratUrl = ligne.contrat_pdf_url
    if (!contratUrl) {
      try {
        const splitsSnapshot = (ligne.splits_snapshot as { nom_artiste: string; pourcentage: number }[] | null) ?? [
          { nom_artiste: beatmaker?.nom_artiste ?? 'Beatmaker', pourcentage: 100 }
        ]

        const pdfBytes = await genererContratPdf({
          beat: { titre: beat.titre, bpm: beat.bpm, cle: beat.cle },
          beatmaker: { nom_artiste: beatmaker?.nom_artiste ?? 'Beatmaker' },
          acheteur: { nom: commande.acheteur_nom, email: commande.acheteur_email },
          licence: { nom: licence.nom },
          splits: splitsSnapshot,
          dateVente: new Date(),
        })

        contratUrl = await uploadPdfContrat(ligne.id, pdfBytes)
        await supabase.from('commande_lignes').update({ contrat_pdf_url: contratUrl }).eq('id', ligne.id)
      } catch (err) {
        console.error('[telechargement] Erreur PDF pour la ligne', ligne.id, ':', err)
      }
    }

    const fichiersSignes = await genererUrlsSignees(beat, licence.modele ?? 'mp3')
    const pdfFilename = `Contrat - ${beat.titre} (${licence.nom}).pdf`
    const pdfSigneUrl = contratUrl ? await genererUrlSigneePdf(contratUrl, pdfFilename).catch(() => null) : null

    lignesDispo.push({
      ligneId: ligne.id,
      titre: beat.titre,
      licenceNom: licence.nom,
      fichiersSignes,
      pdfSigneUrl,
    })
  }

  const titrePage = lignesDispo.length > 1
    ? `${lignesDispo.length} beats`
    : `${lignesDispo[0]?.titre} — ${lignesDispo[0]?.licenceNom}`

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-black mb-1">Paiement confirmé</h1>
          <p className="text-gray-400 text-sm">{titrePage}</p>
          {commande.acheteur_email && (
            <p className="text-gray-600 text-xs mt-1">{commande.acheteur_email}</p>
          )}
        </div>

        {/* Lien permanent */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-3 mb-6 text-center">
          <p className="text-gray-400 text-xs">
            Tu peux revenir sur cette page à tout moment pour télécharger tes fichiers.
          </p>
        </div>

        {/* Une section par article acheté */}
        {lignesDispo.map(ligne => (
          <div key={ligne.ligneId} className="mb-4">
            {lignesDispo.length > 1 && (
              <p className="text-sm font-semibold text-white mb-2">{ligne.titre} — {ligne.licenceNom}</p>
            )}

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-2">
              <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider mb-4">Fichiers inclus</h2>
              <div className="flex flex-col gap-3">
                {ligne.fichiersSignes.map(f => (
                  <TelechargerBouton key={f.label} label={f.label} url={f.url} commandeId={commandeId} ligneId={ligne.ligneId} />
                ))}
              </div>
            </div>

            {ligne.pdfSigneUrl && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider mb-4">Contrat de licence</h2>
                <TelechargerBouton label="Contrat PDF" url={ligne.pdfSigneUrl} icon="pdf" commandeId={commandeId} ligneId={ligne.ligneId} />
              </div>
            )}
          </div>
        ))}

        <p className="text-center text-gray-700 text-xs mt-6">
          Propulsé par My Producer · Les paiements sont sécurisés
        </p>
      </div>
    </div>
  )
}
