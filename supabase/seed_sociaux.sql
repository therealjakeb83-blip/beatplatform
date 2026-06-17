-- ============================================================
-- Seed réseaux sociaux — quelques clients test
-- Permet de tester la fusion CRM (auto-transfer + conflits)
-- À exécuter après seed_nouveaux_clients.sql
-- ============================================================

UPDATE clients SET instagram='@hugod_music',   spotify='hugod-music',      tiktok='@hugod'           WHERE email='hugo.durand@icloud.com';
UPDATE clients SET instagram='@remizrap',                                   tiktok='@remizrap'        WHERE email='remi.charpentier@gmail.com';
UPDATE clients SET                             spotify='issa-k-official',   youtube='IssaKOfficial'   WHERE email='issa.kone@yahoo.fr';
UPDATE clients SET instagram='@luca_trap',     spotify='luca-trap-it'                                 WHERE email='luca.ricci@libero.it';
UPDATE clients SET instagram='@carlos_beats',                               tiktok='@carlosmx'        WHERE email='carlos.mendez@hotmail.com';
UPDATE clients SET                             spotify='aminata-diallo',    youtube='AminataOfficiel' WHERE email='aminata.diallo@gmail.com';
UPDATE clients SET instagram='@noah_music',    spotify='noah-j',            tiktok='@noahjbeats'      WHERE email='noah.johnson@gmail.com';
UPDATE clients SET instagram='@malia.wav'                                                             WHERE email='malia.fonoti@gmail.com';
