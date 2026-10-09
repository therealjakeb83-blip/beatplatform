// Sources marketing d'une commande (commandes.source_marketing) — libellés et
// couleurs partagés par Analytics, la liste Commandes et la fiche client.
export const SOURCES_MARKETING = ['instagram', 'youtube', 'tiktok', 'google', 'google_ads', 'youtube_ads', 'newsletter', 'direct', 'autre'] as const

export const SOURCE_LABELS: Record<string, string> = {
  instagram: 'Instagram', youtube: 'YouTube', tiktok: 'TikTok', google: 'Google', google_ads: 'Google Ads (Search)',
  youtube_ads: 'YouTube Ads', newsletter: 'Newsletter', direct: 'Direct', autre: 'Autre',
}

export const SOURCE_COLORS: Record<string, string> = {
  instagram: '#6366f1', youtube: '#ef4444', tiktok: '#f472b6', google: '#f59e0b', google_ads: '#4285f4',
  youtube_ads: '#dc2626', newsletter: '#f97316', direct: '#4ade80', autre: '#6b7280',
}

// Sans source enregistrée = Direct (même règle qu'Analytics)
export function libelleSource(source: string | null | undefined): string {
  return SOURCE_LABELS[source ?? 'direct'] ?? source ?? 'Direct'
}
