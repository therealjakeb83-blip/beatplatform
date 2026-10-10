import { NextResponse } from 'next/server'
import { lireTableau } from '@/lib/import-externe/libre/tableau'
import { preparerFichier } from '@/lib/import-externe/entree'

export const runtime = 'nodejs'

// TEMPORAIRE (diagnostic réponse illisible, lot 4) — à supprimer
export async function POST(req: Request) {
  const mode = new URL(req.url).searchParams.get('mode')
  if (mode === 'vide') return NextResponse.json({ assistant: { ok: true } })
  const form = await req.formData()
  const f = form.get('fichier') as File
  const octets = await f.arrayBuffer()
  if (mode === 'form') return NextResponse.json({ assistant: { ok: true, taille: octets.byteLength } })
  if (mode === 'tableau') { const t = await lireTableau(f.name, octets); return NextResponse.json({ assistant: { ok: true, lignes: t.lignes.length } }) }
  const faux = { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }), order: async () => ({ data: [{ id: 'x', nom: 'Licence WAV' }] }) }) }) }) }
  const r = await preparerFichier(faux as never, '00000000-0000-0000-0000-000000000000', octets, f.name, null)
  return NextResponse.json(r.type === 'assistant' ? { assistant: r.besoin } : { autre: true })
}
