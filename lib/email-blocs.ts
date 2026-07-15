import { createAdminClient } from '@/utils/supabase/admin'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://my-producer.com'

// ── Types des blocs (format stocké dans templates_email.contenu / campagnes.contenu) ──

export type BlocHeader = { type: 'header'; titre: string; couleur_fond: string }
export type BlocTexte = { type: 'texte'; contenu: string }
export type BlocSectionBeats = {
  type: 'section_beats'
  titre: string
  sous_titre?: string
  colonnes: 1 | 2
  source: 'membres' | 'nouveautes' | 'manuel'
  beat_ids?: string[]
}
export type BlocCodePromo = { type: 'code_promo'; description: string; code: string }
export type BlocCta = { type: 'cta'; texte: string; couleur: string; lien: string }
export type BlocEspace = { type: 'espace'; hauteur: number }

export type BlocEmail = BlocHeader | BlocTexte | BlocSectionBeats | BlocCodePromo | BlocCta | BlocEspace

export type BrandingBoutique = {
  nom_artiste: string
  slug: string
  logo_url: string | null
  instagram_url: string | null
  signature_emails: string | null
}

// ── Rendu HTML (tokens laissés tels quels — remplacés ensuite par lib/mailing.ts) ──

function echapper(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function rendreSectionBeats(bloc: BlocSectionBeats, beatmakerId: string): Promise<string> {
  const admin = createAdminClient()
  let query = admin
    .from('beats')
    .select('id, titre, image_url')
    .eq('beatmaker_id', beatmakerId)

  if (bloc.source === 'manuel' && bloc.beat_ids?.length) {
    query = query.in('id', bloc.beat_ids)
  } else if (bloc.source === 'membres') {
    query = query.eq('statut', 'prive').order('created_at', { ascending: false }).limit(4)
  } else {
    query = query.eq('statut', 'public').order('created_at', { ascending: false }).limit(4)
  }

  const { data: beats } = await query
  if (!beats?.length) return ''

  const largeur = bloc.colonnes === 1 ? '100%' : '48%'
  const cartes = beats.map(b => `
    <td style="width:${largeur};padding:8px;vertical-align:top;">
      <a href="${APP_URL}/{{slug_boutique}}/${b.id}" style="text-decoration:none;">
        ${b.image_url
          ? `<img src="${b.image_url}" alt="${echapper(b.titre)}" width="100%" style="border-radius:8px;display:block;" />`
          : `<div style="width:100%;aspect-ratio:1;background:#1f2937;border-radius:8px;"></div>`}
        <p style="margin:8px 0 0;font-family:Arial,sans-serif;font-size:13px;font-weight:600;color:#111827;">${echapper(b.titre)}</p>
      </a>
    </td>`).join('')

  const lignes: string[] = []
  const parLigne = bloc.colonnes === 1 ? 1 : 2
  for (let i = 0; i < beats.length; i += parLigne) {
    lignes.push(`<tr>${cartes.split('</td>').slice(i, i + parLigne).map(c => c ? c + '</td>' : '').join('')}</tr>`)
  }

  return `
    <tr><td style="padding:24px 24px 8px;font-family:Arial,sans-serif;">
      <h2 style="font-size:17px;color:#111827;margin:0 0 4px;">${echapper(bloc.titre)}</h2>
      ${bloc.sous_titre ? `<p style="font-size:13px;color:#6b7280;margin:0 0 12px;">${echapper(bloc.sous_titre)}</p>` : ''}
      <table width="100%" style="border-collapse:collapse;"><tbody>${lignes.join('')}</tbody></table>
    </td></tr>`
}

function rendreBlocSimple(bloc: BlocHeader | BlocTexte | BlocCodePromo | BlocCta | BlocEspace): string {
  switch (bloc.type) {
    case 'header':
      return `
        <tr><td style="background:${bloc.couleur_fond};padding:32px 24px;text-align:center;">
          <h1 style="color:#ffffff;font-family:Arial,sans-serif;font-size:22px;margin:0;">${echapper(bloc.titre)}</h1>
        </td></tr>`
    case 'texte':
      return `
        <tr><td style="padding:20px 24px;font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;">
          ${echapper(bloc.contenu).replace(/\n/g, '<br/>')}
        </td></tr>`
    case 'code_promo':
      return `
        <tr><td style="padding:20px 24px;text-align:center;">
          <p style="font-family:Arial,sans-serif;font-size:14px;color:#4b5563;margin:0 0 8px;">${echapper(bloc.description)}</p>
          <span style="display:inline-block;padding:12px 24px;background:#f3f4f6;border:2px dashed #9ca3af;border-radius:8px;font-family:monospace;font-size:20px;letter-spacing:2px;font-weight:700;color:#111827;">
            ${echapper(bloc.code)}
          </span>
        </td></tr>`
    case 'cta':
      return `
        <tr><td style="padding:24px;text-align:center;">
          <a href="${bloc.lien}" style="display:inline-block;padding:14px 32px;background:${bloc.couleur};color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
            ${echapper(bloc.texte)}
          </a>
        </td></tr>`
    case 'espace':
      return `<tr><td style="height:${bloc.hauteur}px;line-height:${bloc.hauteur}px;font-size:0;">&nbsp;</td></tr>`
  }
}

function rendreFooter(branding: BrandingBoutique): string {
  return `
    <tr><td style="padding:24px;text-align:center;border-top:1px solid #e5e7eb;font-family:Arial,sans-serif;">
      ${branding.logo_url
        ? `<img src="${branding.logo_url}" alt="${echapper(branding.nom_artiste)}" height="32" style="margin-bottom:8px;" />`
        : `<p style="font-size:14px;font-weight:700;color:#111827;margin:0 0 8px;">${echapper(branding.nom_artiste)}</p>`}
      <p style="font-size:12px;color:#9ca3af;margin:0 0 8px;">
        <a href="${APP_URL}/{{slug_boutique}}" style="color:#6366f1;text-decoration:none;">Voir la boutique</a>
      </p>
      <p style="font-size:11px;color:#9ca3af;margin:0;">
        Tu reçois cet email car tu es inscrit à la newsletter de ${echapper(branding.nom_artiste)}.
        <a href="{{lien_desinscription}}" style="color:#9ca3af;">Se désinscrire</a>
      </p>
    </td></tr>`
}

// Rendu complet — tokens {{prénom}}, {{lien_desinscription}}, {{slug_boutique}} etc.
// laissés tels quels, résolus ensuite par remplacerTokens() dans lib/mailing.ts
// (un seul rendu par campagne, réutilisé pour tous les destinataires)
export async function rendreEmailHtml(
  blocs: BlocEmail[],
  beatmakerId: string,
  branding: BrandingBoutique,
): Promise<string> {
  const lignes = await Promise.all(blocs.map(bloc =>
    bloc.type === 'section_beats' ? rendreSectionBeats(bloc, beatmakerId) : rendreBlocSimple(bloc)
  ))

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f3f4f6;">
    <table width="100%" style="border-collapse:collapse;background:#f3f4f6;">
      <tbody>
        <tr><td align="center" style="padding:24px 12px;">
          <table width="600" style="max-width:600px;width:100%;border-collapse:collapse;background:#ffffff;border-radius:12px;overflow:hidden;">
            <tbody>
              ${lignes.join('')}
              ${rendreFooter(branding)}
            </tbody>
          </table>
        </td></tr>
      </tbody>
    </table>
  </body>
</html>`
}
