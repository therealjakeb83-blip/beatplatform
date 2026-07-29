-- ============================================================
-- Audit 2026-07-29 (F1) — Statut "échouée" pour les campagnes
-- ============================================================
-- envoyerCampagne() (lib/mailing.ts) passait le statut à 'envoyee' sans
-- condition, même quand l'envoi Resend échouait pour 100% des destinataires
-- (0 email réellement parti) — la campagne restait alors bloquée "envoyée"
-- pour toujours, sans possibilité de la renvoyer ou de la supprimer.

alter table campagnes drop constraint if exists campagnes_statut_check;
alter table campagnes add constraint campagnes_statut_check
  check (statut in ('brouillon', 'planifiee', 'envoyee', 'echouee'));
