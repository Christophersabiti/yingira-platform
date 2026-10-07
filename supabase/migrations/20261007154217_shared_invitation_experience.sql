-- New experience settings live in the existing versioned design JSON. No guest,
-- token, RSVP or admission records are rewritten. Legacy designs remain valid.
-- Validate every portrait on draft saves AND immutable published snapshots.
CREATE OR REPLACE FUNCTION yingira.validate_design_portraits()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE asset_text text;
BEGIN
  IF jsonb_typeof(NEW.design) <> 'object' OR octet_length(NEW.design::text) > 12000 THEN
    RAISE EXCEPTION 'Invalid design';
  END IF;
  IF NEW.design ? 'experience' AND jsonb_typeof(NEW.design->'experience') <> 'object' THEN
    RAISE EXCEPTION 'Invalid invitation experience';
  END IF;
  FOREACH asset_text IN ARRAY ARRAY[
    NEW.design->>'assetId',
    NEW.design#>>'{experience,brideAssetId}',
    NEW.design#>>'{experience,groomAssetId}',
    NEW.design#>>'{experience,closingAssetId}'
  ] LOOP
    IF asset_text IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM yingira.design_assets a
      WHERE a.id = asset_text::uuid AND a.event_id = NEW.event_id
    ) THEN
      RAISE EXCEPTION 'Asset not found';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION yingira.validate_design_portraits() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER validate_draft_portraits
BEFORE INSERT OR UPDATE OF design ON yingira.design_drafts
FOR EACH ROW EXECUTE FUNCTION yingira.validate_design_portraits();
CREATE TRIGGER validate_version_portraits
BEFORE INSERT OR UPDATE OF design ON yingira.design_versions
FOR EACH ROW EXECUTE FUNCTION yingira.validate_design_portraits();
