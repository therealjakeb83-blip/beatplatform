import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { envoyerCampagne } from '@/lib/mailing'

const URL_CAMPAGNES = '/dashboard/business/marketing/campagnes'
import { evaluerFiltres, type Condition } from '../../_lib/segments'
import { chargerContactsEnrichis } from '../../_lib/contacts'
import CampagnesClient from './_components/CampagnesClient'

export type CampagneRow = {
  id: string
  nom: string
  objet: string | null
  statut: 'brouillon' | 'planifiee' | 'envoyee'
  scheduled_at: string | null
  sent_at: string | null
  destinataires: number
  ouvertures: number
  clics: number
  conversions: number
  desinscrits: number
  cible_mode: 'segment' | 'liste' | 'manuel' | null
  cible_id: string | null
  cible_emails: string[] | null
  created_at: string
}

export type CibleOption = { id: string; nom: string; count: number }
export type TemplateOption = {
  id: string
  nom: string
  categorie: string
  objet_defaut: string | null
  source: 'plateforme' | 'beatmaker'
  contenu: unknown
}

// ── Server actions ─────────────────────────────────────────────────────────────

async function creerCampagne(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const cibleMode = formData.get('cible_mode') as 'segment' | 'liste' | 'manuel'
  const cibleId   = formData.get('cible_id') as string | null
  const emailsRaw = formData.get('cible_emails') as string | null
  const templateId = formData.get('template_id') as string

  const { data: template } = await supabase
    .from('templates_email')
    .select('contenu')
    .eq('id', templateId)
    .single()

  await supabase.from('campagnes').insert({
    beatmaker_id: user.id,
    nom:          (formData.get('nom') as string).trim(),
    objet:        (formData.get('objet') as string).trim(),
    statut:       'brouillon',
    cible_mode:   cibleMode,
    cible_id:     cibleMode !== 'manuel' ? cibleId : null,
    cible_emails: cibleMode === 'manuel'
      ? (emailsRaw ?? '').split(/[\n,]+/).map(e => e.trim()).filter(Boolean)
      : null,
    contenu: template?.contenu ?? [],
  })

  revalidatePath('/dashboard/business/marketing/campagnes')
}

async function dupliquerCampagne(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const id = formData.get('id') as string

  const { data: source } = await supabase
    .from('campagnes')
    .select('nom, objet, contenu, cible_mode, cible_id, cible_emails')
    .eq('id', id)
    .eq('beatmaker_id', user.id)
    .single()
  if (!source) return

  await supabase.from('campagnes').insert({
    beatmaker_id: user.id,
    nom:          `${source.nom} (copie)`,
    objet:        source.objet,
    contenu:      source.contenu,
    cible_mode:   source.cible_mode,
    cible_id:     source.cible_id,
    cible_emails: source.cible_emails,
    statut:       'brouillon',
  })

  revalidatePath('/dashboard/business/marketing/campagnes')
}

async function supprimerCampagne(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const id = formData.get('id') as string
  await supabase.from('campagnes').delete().eq('id', id).eq('beatmaker_id', user.id).neq('statut', 'envoyee')
  revalidatePath('/dashboard/business/marketing/campagnes')
}

async function planifierCampagne(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const id          = formData.get('id') as string
  const scheduledAt = formData.get('scheduled_at') as string
  await supabase
    .from('campagnes')
    .update({ statut: 'planifiee', scheduled_at: new Date(scheduledAt).toISOString() })
    .eq('id', id)
    .eq('beatmaker_id', user.id)
    .eq('statut', 'brouillon')
  revalidatePath('/dashboard/business/marketing/campagnes')
}

async function envoyerMaintenant(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const id = formData.get('id') as string

  const { data: campagne } = await supabase
    .from('campagnes')
    .select('id')
    .eq('id', id)
    .eq('beatmaker_id', user.id)
    .neq('statut', 'envoyee')
    .single()
  if (!campagne) {
    redirect(`${URL_CAMPAGNES}?erreur=${encodeURIComponent("Cette campagne est introuvable ou a déjà été envoyée.")}`)
  }

  let resultat: { envoyes: number; echecs: number }
  try {
    resultat = await envoyerCampagne(id)
  } catch (err) {
    console.error('[campagnes] Échec envoyerMaintenant', id, ':', err)
    redirect(`${URL_CAMPAGNES}?erreur=${encodeURIComponent('Erreur inattendue à l\'envoi — vérifie la config Resend (variables d\'environnement, domaine).')}`)
  }

  if (resultat.envoyes === 0 && resultat.echecs === 0) {
    redirect(`${URL_CAMPAGNES}?erreur=${encodeURIComponent("Aucun destinataire trouvé — vérifie que le segment/la liste/les emails ciblés contiennent des contacts inscrits à la newsletter.")}`)
  }

  if (resultat.envoyes === 0 && resultat.echecs > 0) {
    redirect(`${URL_CAMPAGNES}?erreur=${encodeURIComponent(`Échec de l'envoi pour les ${resultat.echecs} destinataire(s) — vérifie la config Resend (variables d'environnement, domaine d'envoi).`)}`)
  }

  revalidatePath(URL_CAMPAGNES)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CampagnesPage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string; erreur?: string }>
}) {
  const { segment: segmentPreselectionne, erreur } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: bm } = await supabase.from('beatmakers').select('id').eq('id', user.id).single()
  if (!bm) redirect('/')

  const [{ data: campagnesRaw }, { data: segmentsRaw }, { data: listesRaw }, { data: templatesRaw }, { contacts }] = await Promise.all([
    supabase
      .from('campagnes')
      .select('id, nom, objet, statut, scheduled_at, sent_at, destinataires, ouvertures, clics, conversions, desinscrits, cible_mode, cible_id, cible_emails, created_at')
      .eq('beatmaker_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('segments_crm')
      .select('id, nom, filtres')
      .eq('beatmaker_id', user.id)
      .order('nom'),
    supabase
      .from('listes_crm')
      .select('id, nom, listes_crm_contacts(client_id)')
      .eq('beatmaker_id', user.id)
      .order('nom'),
    supabase
      .from('templates_email')
      .select('id, nom, categorie, objet_defaut, source, contenu')
      .order('source', { ascending: true })
      .order('nom'),
    chargerContactsEnrichis(user.id),
  ])

  const consentants = contacts.filter(c => c.newsletter_consent)

  const segments: CibleOption[] = (segmentsRaw ?? []).map(s => ({
    id:    s.id,
    nom:   s.nom,
    count: consentants.filter(c => evaluerFiltres(c, s.filtres as Condition[])).length,
  }))

  const listes: CibleOption[] = (listesRaw ?? []).map(l => {
    const membreIds = new Set(((l.listes_crm_contacts ?? []) as { client_id: string }[]).map(m => m.client_id))
    return {
      id:    l.id,
      nom:   l.nom,
      count: consentants.filter(c => membreIds.has(c.id)).length,
    }
  })

  const templates: TemplateOption[] = templatesRaw ?? []
  const campagnes: CampagneRow[] = campagnesRaw ?? []

  return (
    <CampagnesClient
      campagnes={campagnes}
      segments={segments}
      listes={listes}
      templates={templates}
      segmentPreselectionne={segmentPreselectionne ?? null}
      erreur={erreur ?? null}
      creerCampagne={creerCampagne}
      dupliquerCampagne={dupliquerCampagne}
      supprimerCampagne={supprimerCampagne}
      planifierCampagne={planifierCampagne}
      envoyerMaintenant={envoyerMaintenant}
    />
  )
}
