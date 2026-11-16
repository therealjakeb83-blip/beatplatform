import fs from 'fs'
const remplacer = (txt, avant, apres) => {
  const n = txt.split(avant).length - 1
  if (n !== 1) throw new Error(`Motif trouvé ${n} fois : ${avant.slice(0, 80)}`)
  return txt.replace(avant, apres)
}
const extraire = (fichier, debut) => {
  const t = fs.readFileSync(fichier, 'utf8').split(String.fromCharCode(13)).join('')
  const i = t.indexOf(debut)
  const j = t.indexOf('$$;', i)
  if (i < 0 || j < 0) throw new Error('fonction introuvable ' + debut)
  return t.slice(i, j + 3)
}
let imp = extraire('supabase/import_externe_lot4c.sql', 'CREATE OR REPLACE FUNCTION importer_commandes_externes(')
imp = remplacer(imp,
`    -- coordonnées seulement sur les fiches CRÉÉES ici (fiche commune à toutes
    -- les boutiques : jamais celle d'un client existant)
    INSERT INTO clients (id, email, prenom, nom, adresse, ville, code_postal, pays, telephone)
    SELECT gen_random_uuid(), email, coalesce(prenom, ''), coalesce(nom, ''), adresse, ville, code_postal,
      CASE WHEN pays ~ '^[A-Z]{2}$' THEN pays END, telephone
    FROM _ic WHERE client_id IS NULL`,
`    -- 9d lot 3 : la fiche commune ne reçoit que l'email ; les coordonnées du
    -- fichier vont dans la fiche de CETTE boutique (ecrire_fiche_boutique)
    INSERT INTO clients (id, email, nom)
    SELECT gen_random_uuid(), email, ''
    FROM _ic WHERE client_id IS NULL`)
imp = remplacer(imp,
`  UPDATE _ic SET lead_cree = true FROM insl WHERE insl.client_id = _ic.client_id;
`,
`  UPDATE _ic SET lead_cree = true FROM insl WHERE insl.client_id = _ic.client_id;

  -- 9d lot 3 : fiche de la boutique remplie avec le fichier (données anciennes :
  -- cases vides seulement, listes complétées à la fin)
  PERFORM ecrire_fiche_boutique(i.client_id, p_beatmaker_id, 'import', jsonb_strip_nulls(jsonb_build_object(
      'ancien', true, 'email', i.email, 'prenom', i.prenom, 'nom', i.nom, 'telephone', i.telephone, 'pays', i.pays,
      'adresse', CASE WHEN i.adresse IS NOT NULL OR i.ville IS NOT NULL THEN jsonb_strip_nulls(jsonb_build_object(
        'adresse', i.adresse, 'code_postal', i.code_postal, 'ville', i.ville, 'pays', i.pays)) END)),
    coalesce(i.premiere_date, now()))
  FROM _ic i;
`)
let ann = extraire('supabase/import_externe_lot2.sql', 'CREATE OR REPLACE FUNCTION annuler_import_externe(')
ann = remplacer(ann,
`                   AND (newsletter_statut <> 'non_inscrit' OR newsletter_statut_at IS NOT NULL OR source <> 'import'))`,
`                   AND (newsletter_statut <> 'non_inscrit' OR newsletter_statut_at IS NOT NULL OR source <> 'import'
                        OR cardinality(champs_manuels) > 0))`)
const tete = fs.readFileSync('.scratch/9d-lot3-sql-tete.sql', 'utf8')
const fin = `
-- ── SELECT de contrôle (onglet séparé, après exécution) ───────────────────
-- SELECT
--   has_function_privilege('authenticated', 'ecrire_fiche_boutique(uuid, uuid, text, jsonb, timestamptz)', 'EXECUTE') AS authenticated_peut,
--   has_function_privilege('anon', 'ecrire_fiche_boutique(uuid, uuid, text, jsonb, timestamptz)', 'EXECUTE') AS anon_peut,
--   pg_get_functiondef('fusionner_compte_client'::regproc) LIKE '%commandes_externes%' AS fusion_complete,
--   pg_get_functiondef('importer_commandes_externes'::regproc) LIKE '%ecrire_fiche_boutique%' AS import_remplit_fiche,
--   pg_get_functiondef('annuler_import_externe'::regproc) LIKE '%champs_manuels%' AS annulation_garde_main;
`
const sortie = `${tete}
-- ── Import : fiche de la boutique remplie, fiche commune = email seul ──────
-- (fonction du lot 4c de l'import, seules les lignes marquées « 9d lot 3 » changent)
${imp}

REVOKE ALL ON FUNCTION importer_commandes_externes(uuid, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION importer_commandes_externes(uuid, jsonb, jsonb, jsonb) TO service_role;

-- ── Annulation d'un import : une fiche modifiée à la main est conservée ────
-- (fonction du lot 2 de l'import, seule la garde « champs_manuels » s'ajoute)
${ann}

REVOKE ALL ON FUNCTION annuler_import_externe(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION annuler_import_externe(uuid, uuid) TO service_role;

COMMIT;
${fin}`
fs.writeFileSync('supabase/fiches_clients_lot3_ecriture.sql', sortie)
console.log('ok', sortie.split('\n').length, 'lignes')
