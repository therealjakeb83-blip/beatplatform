import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export const runtime = 'nodejs'

function fmt(cents: number) {
  return (cents / 100).toFixed(2) + ' EUR'
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const annee = parseInt(searchParams.get('annee') ?? String(new Date().getFullYear()))

  const admin = createAdminClient()

  const { data: beatmaker } = await admin
    .from('beatmakers')
    .select('nom_artiste, email')
    .eq('id', user.id)
    .single()

  const { data: { user: fullUser } } = await admin.auth.admin.getUserById(user.id)
  const userEmail = fullUser?.email ?? ''

  // Récupérer tous les split_payments de l'année pour ce beatmaker (par beatmaker_id ou email_invite)
  const debut = `${annee}-01-01T00:00:00.000Z`
  const fin   = `${annee + 1}-01-01T00:00:00.000Z`

  const [{ data: byId }, { data: byEmail }] = await Promise.all([
    admin
      .from('split_payments')
      .select('id, montant, statut, stripe_transfer_id, created_at, beat_splits(pourcentage, beats(titre, beatmakers(nom_artiste)))')
      .eq('beatmaker_id', user.id)
      .gte('created_at', debut)
      .lt('created_at', fin)
      .order('created_at'),
    userEmail
      ? admin
          .from('split_payments')
          .select('id, montant, statut, stripe_transfer_id, created_at, beat_splits(pourcentage, beats(titre, beatmakers(nom_artiste)))')
          .eq('email_invite', userEmail)
          .is('beatmaker_id', null)
          .gte('created_at', debut)
          .lt('created_at', fin)
          .order('created_at')
      : Promise.resolve({ data: [] }),
  ])

  type PayRow = {
    id: string
    montant: number
    statut: string
    stripe_transfer_id: string | null
    created_at: string
    beat_splits: {
      pourcentage: number
      beats: { titre: string; beatmakers: { nom_artiste: string } | null } | null
    } | null
  }

  const seen = new Set<string>()
  const payments = ([...(byId ?? []), ...((byEmail ?? []) as unknown[])] as PayRow[])
    .filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true })
    .filter(p => p.statut === 'transfere')

  const totalCents = payments.reduce((s, p) => s + p.montant, 0)

  // ── Génération PDF ──────────────────────────────────────────
  const doc  = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const W = 595, H = 842
  const ml = 50, mr = W - 50
  const gris  = rgb(0.5, 0.5, 0.5)
  const noir  = rgb(0, 0, 0)
  const vert  = rgb(0.13, 0.55, 0.13)

  const page = doc.addPage([W, H])
  let y = H - 50

  // En-tête
  page.drawText('My Producer', { x: ml, y, font: bold, size: 18, color: rgb(0.24, 0.31, 0.85) })
  page.drawText('beatplatform.vercel.app', { x: mr - 160, y, font, size: 9, color: gris })
  y -= 6
  page.drawLine({ start: { x: ml, y }, end: { x: mr, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) })
  y -= 20

  page.drawText(`RELEVÉ DE REVENUS COLLABORATIONS — ${annee}`, { x: ml, y, font: bold, size: 13, color: noir })
  y -= 18
  page.drawText(`Généré le ${fmtDate(new Date().toISOString())}`, { x: ml, y, font, size: 9, color: gris })
  y -= 30

  // Infos beatmaker
  page.drawText('Bénéficiaire', { x: ml, y, font: bold, size: 10, color: noir })
  y -= 14
  page.drawText(beatmaker?.nom_artiste ?? userEmail, { x: ml, y, font, size: 10, color: noir })
  y -= 12
  page.drawText(userEmail, { x: ml, y, font, size: 9, color: gris })
  y -= 30

  if (payments.length === 0) {
    page.drawText(`Aucun revenu collab reçu en ${annee}.`, { x: ml, y, font, size: 10, color: gris })
  } else {
    // En-tête tableau
    const cols = { date: ml, beat: ml + 70, proprio: ml + 220, pct: ml + 340, ref: ml + 380, montant: mr - 60 }
    const drawRow = (p: PayRow | null, isHeader = false) => {
      const f = isHeader ? bold : font
      const sz = isHeader ? 8 : 9
      const c  = isHeader ? gris : noir

      if (p === null) {
        page.drawText('Date',    { x: cols.date,    y, font: f, size: sz, color: c })
        page.drawText('Beat',    { x: cols.beat,    y, font: f, size: sz, color: c })
        page.drawText('Par',     { x: cols.proprio, y, font: f, size: sz, color: c })
        page.drawText('%',       { x: cols.pct,     y, font: f, size: sz, color: c })
        page.drawText('Réf.',    { x: cols.ref,     y, font: f, size: sz, color: c })
        page.drawText('Montant', { x: cols.montant, y, font: f, size: sz, color: c })
      } else {
        const bs  = p.beat_splits
        const titre = (bs?.beats?.titre ?? '—').slice(0, 22)
        const par   = (bs?.beats?.beatmakers?.nom_artiste ?? '—').slice(0, 18)
        const pct   = bs ? `${bs.pourcentage}%` : '—'
        const ref   = p.stripe_transfer_id ? p.stripe_transfer_id.slice(0, 14) + '…' : '—'
        page.drawText(fmtDate(p.created_at), { x: cols.date,    y, font: f, size: sz, color: c })
        page.drawText(titre,                  { x: cols.beat,    y, font: f, size: sz, color: c })
        page.drawText(par,                    { x: cols.proprio, y, font: f, size: sz, color: c })
        page.drawText(pct,                    { x: cols.pct,     y, font: f, size: sz, color: c })
        page.drawText(ref,                    { x: cols.ref,     y, font: f, size: sz, color: c })
        page.drawText(fmt(p.montant),         { x: cols.montant, y, font: f, size: sz, color: c })
      }
    }

    drawRow(null, true)
    y -= 4
    page.drawLine({ start: { x: ml, y }, end: { x: mr, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) })
    y -= 14

    for (const p of payments) {
      if (y < 100) {
        // Nouvelle page si nécessaire
        const np = doc.addPage([W, H])
        y = H - 50
        Object.assign(page, np)
      }
      drawRow(p)
      y -= 14
    }

    y -= 6
    page.drawLine({ start: { x: ml, y }, end: { x: mr, y }, thickness: 1, color: rgb(0.7, 0.7, 0.7) })
    y -= 16
    page.drawText('Total reçu', { x: ml, y, font: bold, size: 11, color: noir })
    page.drawText(fmt(totalCents), { x: cols.montant, y, font: bold, size: 11, color: vert })
  }

  // Pied de page
  y = 40
  page.drawText(
    'Ce relevé est fourni par My Producer à titre informatif. Il atteste des revenus distribués via la plateforme.',
    { x: ml, y, font, size: 7, color: gris }
  )

  const pdfBytes = await doc.save()
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="releve-collabs-${annee}.pdf"`,
    },
  })
}
