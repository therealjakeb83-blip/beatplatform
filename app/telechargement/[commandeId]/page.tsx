import { createAdminClient } from '@/utils/supabase/admin'
import { genererUrlsSignees, genererUrlSigneePdf, uploadPdfContrat } from '@/lib/livraison'
import { genererContratPdf } from '@/lib/contrat'
import { notFound } from 'next/navigation'
import TelechargerBouton from './_components/TelechargerBouton'

export const runtime = 'nodejs'

export default async function TelechargerPage({
  params,
}: {
  params: Promise<{ commandeId: string }>
}) {
  const { commandeId } = await params
  const supabase = createAdminClient()

  const { data: commande, error: commandeError } = await supabase
    .from('commandes')
    .select('id, acheteur_email, acheteur_nom, contrat_pdf_url, splits_snapshot, beat_id, licence_id')
    .eq('id', commandeId)
    .single()

  if (commandeError) console.error('[telechargement] Erreur query commande:', JSON.stringify(commandeError))
  if (!commande) notFound()

  const [{ data: beat, error: beatError }, { data: licence, error: licenceError }] = await Promise.all([
    supabase.from('beats').select('titre, bpm, cle, mp3_propre_url, wav_url, stems_url, beatmaker_id').eq('id', commande.beat_id).single(),
    supabase.from('licences').select('nom, modele').eq('id', commande.licence_id).single(),
  ])

  console.log('[telechargement] beat_id:', commande.beat_id, 'licence_id:', commande.licence_id)
  console.log('[telechargement] beat:', beat ? beat.titre : 'NULL', 'beatError:', JSON.stringify(beatError))
  console.log('[telechargement] licence:', licence ? licence.nom : 'NULL', 'licenceError:', JSON.stringify(licenceError))
  if (beat) console.log('[telechargement] urls:', beat.mp3_propre_url, beat.wav_url, beat.stems_url)

  // Générer le PDF si pas encore fait
  let contratUrl = commande.contrat_pdf_url
  if (!contratUrl && beat && licence) {
    try {
      const { data: beatmaker } = await supabase
        .from('beatmakers')
        .select('nom_artiste')
        .eq('id', beat.beatmaker_id)
        .single()

      const splitsSnapshot = (commande.splits_snapshot as { nom_artiste: string; pourcentage: number }[] | null) ?? [
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

      contratUrl = await uploadPdfContrat(commandeId, pdfBytes)
      await supabase.from('commandes').update({ contrat_pdf_url: contratUrl, fichiers_livres: true }).eq('id', commandeId)
    } catch (err) {
      console.error('[telechargement] Erreur PDF:', err)
    }
  }

  // Générer URLs signées pour les fichiers
  const fichiersSignes = beat ? await genererUrlsSignees(beat, licence?.modele ?? 'mp3') : []

  // URL signée pour le PDF
  const pdfFilename = beat ? `Contrat - ${beat.titre} (${licence?.nom ?? 'Licence'}).pdf` : 'contrat.pdf'
  const pdfSigneUrl = contratUrl ? await genererUrlSigneePdf(contratUrl, pdfFilename).catch(() => null) : null

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
          <p className="text-gray-400 text-sm">
            {beat?.titre} — {licence?.nom}
          </p>
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

        {/* Fichiers */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-4">
          <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider mb-4">Fichiers inclus</h2>
          <div className="flex flex-col gap-3">
            {fichiersSignes.map(f => (
              <TelechargerBouton key={f.label} label={f.label} url={f.url} />
            ))}
          </div>
        </div>

        {/* Contrat PDF */}
        {pdfSigneUrl && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider mb-4">Contrat de licence</h2>
            <TelechargerBouton label="Contrat PDF" url={pdfSigneUrl} icon="pdf" />
          </div>
        )}

        <p className="text-center text-gray-700 text-xs mt-6">
          Propulsé par My Producer · Les paiements sont sécurisés
        </p>
      </div>
    </div>
  )
}
