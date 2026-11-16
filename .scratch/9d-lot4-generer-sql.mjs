import fs from 'fs'
// 9d lot 4 : supabase/fiches_clients_lot4_rgpd.sql = tête écrite à la main
// + ecrire_fiche_boutique du lot 3 recopiée avec un seul ajout (fiche effacée = fiche neuve).
const sansCR = s => s.split(String.fromCharCode(13)).join('')
const remplacer = (txt, avant, apres) => {
  const n = txt.split(avant).length - 1
  if (n !== 1) throw new Error(`Motif trouvé ${n} fois : ${avant.slice(0, 80)}`)
  return txt.replace(avant, apres)
}
const t = sansCR(fs.readFileSync('supabase/fiches_clients_lot3_ecriture.sql', 'utf8'))
const i = t.indexOf('CREATE OR REPLACE FUNCTION ecrire_fiche_boutique(')
let f = t.slice(i, t.indexOf('$$;', i) + 3)
f = remplacer(f, `  n_premier timestamptz;
BEGIN`, `  n_premier timestamptz;
  v_neuve   boolean := false;
BEGIN`)
f = remplacer(f, `   FOR UPDATE;
  v_manu := coalesce(l.champs_manuels, '{}');`, `   FOR UPDATE;

  -- 9d lot 4 : contact effacé par la boutique qui revient = fiche neuve
  -- (seulement ce qui est redonné maintenant ; rien d'effacé ne revient)
  IF l.efface_le IS NOT NULL THEN
    UPDATE leads SET efface_le = NULL, source = p_source, created_at = v_le, premier_contact_le = v_le
     WHERE id = l.id
    RETURNING * INTO l;
    v_neuve := true;
  END IF;
  v_manu := coalesce(l.champs_manuels, '{}');`)
f = remplacer(f, `RETURN jsonb_build_object('lead_id', l.id, 'cree', v_id IS NOT NULL);`,
  `RETURN jsonb_build_object('lead_id', l.id, 'cree', v_id IS NOT NULL OR v_neuve);`)
const tete = sansCR(fs.readFileSync('.scratch/9d-lot4-sql-tete.sql', 'utf8'))
const fin = `
REVOKE ALL ON FUNCTION ecrire_fiche_boutique(uuid, uuid, text, jsonb, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ecrire_fiche_boutique(uuid, uuid, text, jsonb, timestamptz) TO service_role;

COMMIT;
`
fs.writeFileSync('supabase/fiches_clients_lot4_rgpd.sql', tete + '-- ── Fiche effacée qui revient = fiche neuve (fonction du lot 3 + ajout) ──\n' + f + '\n' + fin)
console.log('écrit', (tete + f + fin).split('\n').length, 'lignes')
