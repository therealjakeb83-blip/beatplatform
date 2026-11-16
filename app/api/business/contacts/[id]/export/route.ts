import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { clientLieABoutique } from '@/app/dashboard/business/_lib/appartenance'
import { chargerFichesBoutique, chargerFusionsBoutique, adresseAffichee } from '@/app/dashboard/business/_lib/fiche-boutique'
import { ecrireCsv } from '@/lib/import-externe/csv'
import { fuseauSur } from '@/lib/fuseau-horaire'

// « Exporter » (9d lot 4) : tout ce que CETTE boutique détient sur un contact,
// en UN fichier CSV lisible par rubriques, pour répondre à une demande d'accès
// (RGPD art. 15). Notes et tags compris (décision de Jake) : le beatmaker
// relit avant d'envoyer. Rien d'une autre boutique, rien du compte Sonoo.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: beatmaker } = await supabase.from('beatmakers').select('id, fuseau_horaire').eq('id', user.id).maybeSingle()
  if (!beatmaker) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  if (!/^[0-9a-f-]{36}$/i.test(clientId) || !(await clientLieABoutique(supabase, user.id, clientId))) {
    return NextResponse.json({ error: 'Contact introuvable' }, { status: 404 })
  }
  const bm = user.id
  const admin = createAdminClient()
  const tz = fuseauSur(beatmaker.fuseau_horaire)

  // Fiches fusionnées dans ce contact (même boutique) comprises
  const fusions = await chargerFusionsBoutique(admin, bm)
  const ids = [clientId, ...fusions.archivesDe(clientId)]
  const fiches = await chargerFichesBoutique(admin, bm, ids)
  const fiche = fiches.get(clientId)
  if (fiche?.efface_le) {
    return NextResponse.json({ error: 'Ce contact a été effacé : la boutique ne détient plus ses données personnelles.' }, { status: 409 })
  }
  const emails = [...new Set(ids.flatMap(id => fiches.get(id)?.emails ?? []))]
  const filtreEmail = (col: string) => ids.map(id => `client_id.eq.${id}`)
    .concat(emails.map(e => `${col}.eq."${e.replace(/"/g, '')}"`)).join(',')

  const [commandes, abos, freeDl, externes, logs, listes, favoris, morceaux] = await Promise.all([
    admin.from('commandes')
      .select('id, created_at, numero_facture, statut, type_commande, prix_paye, reduction_montant, code_promo, acheteur_nom, acheteur_email, acheteur_telephone, acheteur_adresse, acheteur_raison_sociale, acheteur_numero_tva, commande_lignes(beats(titre), licences(nom))')
      .eq('beatmaker_id', bm).or(filtreEmail('acheteur_email')).order('created_at'),
    admin.from('abonnements_boutique')
      .select('created_at, date_debut, date_fin, statut, en_essai, annulation_en_cours, plan, prix, mensualites_payees, acheteur_nom, acheteur_email')
      .eq('beatmaker_id', bm).in('client_id', ids).order('created_at'),
    admin.from('free_downloads').select('downloaded_at, beats(titre)').eq('beatmaker_id', bm).in('client_id', ids).order('downloaded_at'),
    admin.from('commandes_externes')
      .select('date_vente, plateforme, numero_externe, acheteur_nom, acheteur_email, total_paye, devise, commandes_externes_lignes(titre, licence)')
      .eq('beatmaker_id', bm).in('client_id', ids).order('date_vente'),
    admin.from('email_logs').select('created_at, type, evenement, sujet, destinataire, statut, ouvert_at, clique_at')
      .eq('beatmaker_id', bm).or(filtreEmail('destinataire')).order('created_at'),
    admin.from('listes_crm_contacts').select('added_at, listes_crm!inner(nom, beatmaker_id)')
      .eq('listes_crm.beatmaker_id', bm).in('client_id', ids),
    admin.from('favoris').select('created_at, beats!inner(titre, beatmaker_id)').eq('beats.beatmaker_id', bm).in('client_id', ids),
    // morceaux_clients : pas de droit pour la clé de service, lu avec la session du beatmaker (règle « own »)
    supabase.from('morceaux_clients').select('created_at, titre, lien_spotify').eq('beatmaker_id', bm).in('client_id', ids),
  ])
  const erreur = [commandes, abos, freeDl, externes, logs, listes, favoris, morceaux].find(r => r.error)?.error
  if (erreur) {
    console.error('[contacts/export]', JSON.stringify(erreur))
    return NextResponse.json({ error: 'Export impossible, réessaie.' }, { status: 500 })
  }

  const d = (iso: unknown) => iso ? new Date(String(iso)).toLocaleString('fr-FR', { timeZone: tz, dateStyle: 'short', timeStyle: 'short' }) : ''
  const t = (v: unknown) => v === null || v === undefined ? '' : Array.isArray(v) ? v.join(', ') : String(v)
  const un = <T,>(v: T | T[] | null | undefined): T | null => Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

  const lignes: string[][] = []
  const rubrique = (titre: string, entetes: string[], rangees: string[][]) => {
    if (lignes.length) lignes.push([])
    lignes.push([`## ${titre}`])
    if (rangees.length === 0) { lignes.push(['(aucune donnée)']); return }
    lignes.push(entetes)
    lignes.push(...rangees)
  }

  const fichesListe = ids.map(id => fiches.get(id)).filter((f): f is NonNullable<typeof f> => !!f)
  rubrique('Fiche', ['Champ', 'Valeur'], fichesListe.flatMap((f, i) => [
    ...(i > 0 ? [['— Fiche fusionnée', '']] : []),
    ['Emails', t(f.emails)],
    ['Téléphones', t(f.telephones)],
    ['Adresses', f.adresses.map(adresseAffichee).join(' | ')],
    ['Prénom', t(f.prenom)], ['Nom', t(f.nom)], ["Nom d'artiste", t(f.nom_artiste)], ['Surnom', t(f.surnom)],
    ['Pays', t(f.pays)], ['Langue', t(f.langue)],
    ['Instagram', t(f.instagram)], ['Spotify', t(f.spotify)], ['YouTube', t(f.youtube)], ['TikTok', t(f.tiktok)],
    ['Source', t(f.source)], ['Premier contact', d(f.premier_contact_le ?? f.created_at)],
    ['Newsletter', t(f.newsletter_statut)], ['Newsletter (date)', d(f.newsletter_statut_at)],
    ['Notes (internes)', t(f.notes)], ['Tags (internes)', t(f.tags)],
  ]))

  type LigneCmd = { beats: { titre: string } | { titre: string }[] | null; licences: { nom: string } | { nom: string }[] | null }
  rubrique('Commandes', ['Date', 'N° commande', 'N° facture', 'Type', 'Statut', 'Montant payé (€)', 'Remise (€)', 'Code promo', 'Articles',
    'Nom', 'Email', 'Téléphone', 'Adresse', 'Raison sociale', 'N° TVA'],
    (commandes.data ?? []).map(c => [d(c.created_at), String(c.id).slice(0, 8).toUpperCase(), t(c.numero_facture), t(c.type_commande), t(c.statut),
      t(c.prix_paye), t(c.reduction_montant), t(c.code_promo),
      ((c.commande_lignes ?? []) as LigneCmd[]).map(l => [un(l.beats)?.titre, un(l.licences)?.nom].filter(Boolean).join(' — ')).join(' | '),
      t(c.acheteur_nom), t(c.acheteur_email), t(c.acheteur_telephone), t(c.acheteur_adresse), t(c.acheteur_raison_sociale), t(c.acheteur_numero_tva)]))

  rubrique('Abonnements', ['Créé le', 'Début', 'Fin', 'Statut', 'Essai', 'Annulation demandée', 'Formule', 'Prix (€)', 'Mensualités payées', 'Nom', 'Email'],
    (abos.data ?? []).map(a => [d(a.created_at), d(a.date_debut), d(a.date_fin), t(a.statut), a.en_essai ? 'oui' : 'non',
      a.annulation_en_cours ? 'oui' : 'non', t(a.plan), a.prix === null || a.prix === undefined ? '' : (Number(a.prix) / 100).toFixed(2),
      t(a.mensualites_payees), t(a.acheteur_nom), t(a.acheteur_email)]))

  rubrique('Free downloads', ['Date', 'Beat'],
    (freeDl.data ?? []).map(f => [d(f.downloaded_at), t(un(f.beats as unknown as { titre: string } | null)?.titre)]))

  type LigneExt = { titre: string | null; licence: string | null }
  rubrique('Ventes importées', ['Date', 'Plateforme', 'N° de commande', 'Nom', 'Email', 'Montant payé', 'Devise', 'Articles'],
    (externes.data ?? []).map(x => [d(x.date_vente), t(x.plateforme), t(x.numero_externe), t(x.acheteur_nom), t(x.acheteur_email),
      t(x.total_paye), t(x.devise), ((x.commandes_externes_lignes ?? []) as LigneExt[]).map(l => [l.titre, l.licence].filter(Boolean).join(' — ')).join(' | ')]))

  rubrique('Emails envoyés', ['Date', 'Type', 'Événement', 'Sujet', 'Destinataire', 'Statut', 'Ouvert le', 'Cliqué le'],
    (logs.data ?? []).map(l => [d(l.created_at), t(l.type), t(l.evenement), t(l.sujet), t(l.destinataire), t(l.statut), d(l.ouvert_at), d(l.clique_at)]))

  rubrique('Listes', ['Liste', 'Ajouté le'],
    (listes.data ?? []).map(l => [t(un(l.listes_crm as unknown as { nom: string } | null)?.nom), d(l.added_at)]))

  rubrique('Favoris (beats de la boutique)', ['Date', 'Beat'],
    (favoris.data ?? []).map(f => [d(f.created_at), t(un(f.beats as unknown as { titre: string } | null)?.titre)]))

  rubrique('Morceaux', ['Ajouté le', 'Titre', 'Lien Spotify'],
    (morceaux.data ?? []).map(m => [d(m.created_at), t(m.titre), t(m.lien_spotify)]))

  const csv = '﻿' + ecrireCsv(lignes)
  const nomFichier = `contact-${(emails[0] ?? clientId).replace(/[^a-z0-9@._-]/gi, '_')}.csv`
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nomFichier}"`,
      'Cache-Control': 'no-store',
    },
  })
}
