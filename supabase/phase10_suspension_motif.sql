-- ============================================================
-- Chantier 9 bis, Phase 10 (2026-09-18) — motif de suspension fermé
-- ============================================================
-- Le grill-me imposait une liste fermée de motifs (fraude/sécurité/
-- légal/illicite/impayé-processeur), pas le champ texte libre utilisé
-- jusqu'ici (suspendu_raison, rempli à la main par l'admin). Nouvelle
-- colonne suspendu_motif = le choix fermé, contraint en base (pas
-- seulement côté UI) ; suspendu_raison redevient un champ de précision
-- optionnel, utilisé uniquement quand motif = 'autre' (demande de Jake).
-- Vérifié avant migration : 0 boutique suspendue actuellement en base,
-- aucune donnée existante à réconcilier.

alter table beatmakers add column if not exists suspendu_motif text;

alter table beatmakers drop constraint if exists beatmakers_suspendu_motif_check;
alter table beatmakers add constraint beatmakers_suspendu_motif_check check (
  suspendu_motif is null or suspendu_motif in (
    'fraude', 'securite', 'legal', 'illicite', 'impaye_processeur', 'autre'
  )
);

-- "Autre" exige une précision écrite — sinon la liste fermée perd son sens.
alter table beatmakers drop constraint if exists beatmakers_suspendu_autre_precision_check;
alter table beatmakers add constraint beatmakers_suspendu_autre_precision_check check (
  suspendu_motif is distinct from 'autre'
  or (suspendu_raison is not null and length(trim(suspendu_raison)) > 0)
);

-- Une boutique suspendue doit toujours avoir un motif de la liste fermée —
-- plus de suspension "à la main" en contournant l'UI.
alter table beatmakers drop constraint if exists beatmakers_suspendu_motif_requis_check;
alter table beatmakers add constraint beatmakers_suspendu_motif_requis_check check (
  statut is distinct from 'suspendu' or suspendu_motif is not null
);

-- Nouveau type d'email "Mails My Producer" (lib/emails.ts) — avertit
-- désormais automatiquement le beatmaker suspendu par email, en plus du
-- message qu'il voit déjà en tentant de se reconnecter (/dashboard/suspendu
-- via proxy.ts). Demande explicite de Jake, Phase 10.
alter table templates_plateforme drop constraint if exists templates_plateforme_type_check;
alter table templates_plateforme add constraint templates_plateforme_type_check check (type in (
  'bienvenue', 'confirmation_essai', 'rappel_fin_essai',
  'paiement_echoue', 'annulation', 'confirmation_email',
  'collab_invitation', 'collab_fonds_attente', 'collab_rappel_fonds', 'collab_expiration',
  'suspension'
));
