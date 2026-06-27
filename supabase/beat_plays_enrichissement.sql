-- Enrichissement beat_plays : pays, device, source marketing
ALTER TABLE beat_plays
  ADD COLUMN IF NOT EXISTS pays             text,
  ADD COLUMN IF NOT EXISTS device_type      text CHECK (device_type IN ('mobile', 'tablet', 'desktop')),
  ADD COLUMN IF NOT EXISTS source_marketing text CHECK (source_marketing IN ('instagram', 'youtube', 'google', 'direct', 'autre'));
