GRANT CREATE ON SCHEMA yingira, public TO yingira_executor;
-- A stable, human-readable alias for each token generation. Existing QR tokens
-- remain untouched; reissue creates a new token and hence a new alias.
ALTER TABLE yingira.tokens ADD COLUMN share_slug text;
CREATE FUNCTION yingira.assign_share_slug() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE prefix text;
BEGIN
  IF NEW.share_slug IS NULL THEN
    SELECT trim(both '-' from left(regexp_replace(lower(i.guest_name), '[^a-z0-9]+', '-', 'g'), 24))
      INTO prefix FROM yingira.invitations i WHERE i.id=NEW.invitation_id;
    NEW.share_slug := coalesce(nullif(prefix,''),'guest') || '-' ||
      translate(encode(extensions.gen_random_bytes(12),'base64'), '+/', '-_');
  END IF;
  RETURN NEW;
END $$;
ALTER FUNCTION yingira.assign_share_slug() OWNER TO yingira_executor;
REVOKE ALL ON FUNCTION yingira.assign_share_slug() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER assign_share_slug BEFORE INSERT OR UPDATE OF share_slug ON yingira.tokens
FOR EACH ROW EXECUTE FUNCTION yingira.assign_share_slug();
UPDATE yingira.tokens SET share_slug=NULL;
ALTER TABLE yingira.tokens ALTER COLUMN share_slug SET NOT NULL;
ALTER TABLE yingira.tokens ADD CONSTRAINT tokens_share_slug_format CHECK(share_slug ~ '^[a-z0-9][a-z0-9-]{0,23}-[A-Za-z0-9_-]{16}$');
CREATE UNIQUE INDEX tokens_share_slug_unique ON yingira.tokens(share_slug);

-- Organizer-scoped projection: no new table or ciphertext access for clients.
CREATE FUNCTION public.yingira_guest_share_links(p_event_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=yingira.actor_id(); result jsonb;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM yingira.events e
    JOIN yingira.organizations o ON o.id=e.organization_id AND o.active
    JOIN yingira.organization_members m ON m.organization_id=o.id AND m.active AND m.user_id=u
    WHERE e.id=p_event_id)
    OR EXISTS(SELECT 1 FROM yingira.profiles WHERE id=u AND disabled)
  THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
  IF NOT yingira.check_rate('share-links:'||u,240) THEN RAISE EXCEPTION 'Too many requests'; END IF;
  SELECT coalesce(jsonb_object_agg(t.invitation_id::text,t.share_slug),'{}'::jsonb) INTO result
    FROM yingira.tokens t JOIN yingira.events e ON e.id=t.event_id
    WHERE t.event_id=p_event_id AND t.revoked_at IS NULL AND e.status<>'closed';
  RETURN result;
END $$;
ALTER FUNCTION public.yingira_guest_share_links(uuid) OWNER TO yingira_executor;
REVOKE ALL ON FUNCTION public.yingira_guest_share_links(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.yingira_guest_share_links(uuid) TO authenticated;

-- Only the trusted server may exchange a full alias/token for its counterpart.
CREATE FUNCTION public.yingira_resolve_share_link(p_token text DEFAULT NULL,p_slug text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  IF (p_token IS NULL) = (p_slug IS NULL) THEN RETURN NULL; END IF;
  IF p_token IS NOT NULL AND p_token !~ '^[A-Za-z0-9_-]{43}$' THEN RETURN NULL; END IF;
  IF p_slug IS NOT NULL AND p_slug !~ '^[a-z0-9][a-z0-9-]{0,23}-[A-Za-z0-9_-]{16}$' THEN RETURN NULL; END IF;
  SELECT jsonb_build_object('slug',t.share_slug,'ciphertext',t.ciphertext) INTO result
    FROM yingira.tokens t JOIN yingira.events e ON e.id=t.event_id
    JOIN yingira.organizations o ON o.id=e.organization_id
    WHERE ((p_token IS NOT NULL AND t.digest=encode(extensions.digest(p_token,'sha256'),'hex'))
      OR (p_slug IS NOT NULL AND t.share_slug=p_slug))
      AND t.revoked_at IS NULL AND e.status<>'closed' AND o.active;
  RETURN result;
END $$;
ALTER FUNCTION public.yingira_resolve_share_link(text,text) OWNER TO yingira_executor;
REVOKE ALL ON FUNCTION public.yingira_resolve_share_link(text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.yingira_resolve_share_link(text,text) TO service_role;

REVOKE CREATE ON SCHEMA yingira, public FROM yingira_executor;
