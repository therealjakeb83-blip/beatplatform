-- ============================================================
-- Fix : trigger handle_new_beatmaker — ne créer un beatmaker
-- que si le metadata contient role = 'beatmaker'
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_beatmaker()
RETURNS trigger AS $$
DECLARE
  v_nom_artiste text;
  v_slug        text;
BEGIN
  -- Ne rien faire si ce n'est pas un beatmaker
  IF (NEW.raw_user_meta_data->>'role') IS DISTINCT FROM 'beatmaker' THEN
    RETURN NEW;
  END IF;

  v_nom_artiste := COALESCE(
    NEW.raw_user_meta_data->>'nom_artiste',
    split_part(NEW.email, '@', 1)
  );

  v_slug := lower(regexp_replace(v_nom_artiste, '[^a-zA-Z0-9]', '-', 'g'))
            || '-' || substr(NEW.id::text, 1, 8);

  INSERT INTO public.beatmakers (id, email, nom_artiste, slug, devise, pays, cgv_acceptees_at)
  VALUES (NEW.id, NEW.email, v_nom_artiste, v_slug, 'EUR', 'FR', now());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- Nettoyage : supprimer les lignes beatmakers créées par erreur
-- pour les artistes qui n'ont ni beats ni commandes en tant que beatmaker
-- ============================================================
DELETE FROM public.beatmakers
WHERE id IN (
  SELECT b.id
  FROM public.beatmakers b
  INNER JOIN public.clients c ON c.id = b.id
  WHERE NOT EXISTS (SELECT 1 FROM public.beats WHERE beatmaker_id = b.id)
    AND NOT EXISTS (SELECT 1 FROM public.commandes WHERE beatmaker_id = b.id)
    AND NOT EXISTS (SELECT 1 FROM public.licences WHERE beatmaker_id = b.id)
);
