ALTER TABLE yingira.invitations DROP CONSTRAINT invitations_phone_check;
ALTER TABLE yingira.invitations ADD CONSTRAINT invitations_phone_check CHECK(phone='' OR phone ~ '^\+[1-9][0-9]{7,14}$');
ALTER TABLE yingira.invitations ADD COLUMN email text NOT NULL DEFAULT '' CHECK(length(email)<=254), ADD COLUMN category text NOT NULL DEFAULT '' CHECK(length(category)<=60), ADD COLUMN note text NOT NULL DEFAULT '' CHECK(length(note)<=500);
CREATE TABLE yingira.import_jobs(id uuid PRIMARY KEY,event_id uuid NOT NULL REFERENCES yingira.events(id),name text NOT NULL CHECK(length(name)<=100),created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE yingira.import_rows(job_id uuid NOT NULL REFERENCES yingira.import_jobs(id),row_key integer NOT NULL,payload jsonb NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','created','skipped')),invitation_id uuid REFERENCES yingira.invitations(id),PRIMARY KEY(job_id,row_key));
CREATE TABLE yingira.design_drafts(event_id uuid PRIMARY KEY REFERENCES yingira.events(id),design jsonb NOT NULL,revision integer NOT NULL DEFAULT 1,published_id uuid);
CREATE TABLE yingira.design_versions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid NOT NULL REFERENCES yingira.events(id),design jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),created_by uuid NOT NULL);
CREATE TABLE yingira.design_assets(id uuid PRIMARY KEY,event_id uuid NOT NULL REFERENCES yingira.events(id),created_at timestamptz NOT NULL DEFAULT now());
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['import_jobs','import_rows','design_drafts','design_versions','design_assets'] LOOP
 EXECUTE format('ALTER TABLE yingira.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE yingira.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON yingira.%I FROM PUBLIC,anon,authenticated',t);
 EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON yingira.%I TO yingira_executor',t);
 EXECUTE format('CREATE POLICY command_owner ON yingira.%I TO yingira_executor USING(true) WITH CHECK(true)',t);
END LOOP; END $$;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('invitation-assets','invitation-assets',false,5242880,ARRAY['image/webp']) ON CONFLICT(id) DO NOTHING;

CREATE FUNCTION public.yingira_planning(p_action text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=yingira.actor_id(); eid uuid:=(p_data->>'eventId')::uuid; org uuid; job uuid; x jsonb; import_row yingira.import_rows%rowtype; g yingira.invitations%rowtype; iid uuid; vid uuid; rev integer; body jsonb;
BEGIN
 SELECT e.organization_id INTO org FROM yingira.events e JOIN yingira.organizations o ON o.id=e.organization_id AND o.active JOIN yingira.organization_members m ON m.organization_id=o.id AND m.user_id=u AND m.active WHERE e.id=eid FOR SHARE OF m;
 IF org IS NULL OR EXISTS(SELECT 1 FROM yingira.profiles WHERE id=u AND disabled) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 IF NOT yingira.check_rate('planning:'||u,1200) THEN RAISE EXCEPTION 'Too many requests. Try again shortly.'; END IF;
 IF p_action='state' THEN RETURN jsonb_build_object(
 'guests',coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'name',i.guest_name,'phone',i.phone,'email',i.email,'capacity',i.capacity,'tableLabel',i.table_label,'category',i.category,'note',i.note,'initialCount',i.initial_count,'version',i.version,'tokenCiphertext',t.ciphertext,'revoked',t.id IS NULL) ORDER BY i.guest_name) FROM yingira.invitations i LEFT JOIN yingira.tokens t ON t.invitation_id=i.id AND t.revoked_at IS NULL WHERE i.event_id=eid),'[]'::jsonb),
 'draft',(SELECT design FROM yingira.design_drafts WHERE event_id=eid),'revision',coalesce((SELECT revision FROM yingira.design_drafts WHERE event_id=eid),0),'publishedId',(SELECT published_id FROM yingira.design_drafts WHERE event_id=eid),
 'versions',coalesce((SELECT jsonb_agg(v) FROM(SELECT id,created_at AS "createdAt",design FROM yingira.design_versions WHERE event_id=eid ORDER BY created_at DESC LIMIT 30)v),'[]'::jsonb),
 'jobs',coalesce((SELECT jsonb_agg(v) FROM(SELECT j.id,j.name,j.created_at AS "createdAt",count(*) AS total,count(*) FILTER(WHERE r.status<>'pending') AS processed,count(*) FILTER(WHERE r.status='created') AS created,count(*) FILTER(WHERE r.status='skipped') AS skipped FROM yingira.import_jobs j JOIN yingira.import_rows r ON r.job_id=j.id WHERE j.event_id=eid GROUP BY j.id ORDER BY j.created_at DESC LIMIT 30)v),'[]'::jsonb)); END IF;
 IF p_action='save_event' THEN
 UPDATE yingira.events SET title=trim(p_data->>'title'),venue=trim(p_data->>'venue'),starts_at=(p_data->>'startsAt')::timestamptz,timezone=p_data->>'timezone' WHERE id=eid;
 ELSIF p_action='save_guest' THEN
 SELECT * INTO g FROM yingira.invitations WHERE id=(p_data->>'guestId')::uuid AND event_id=eid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Guest not found'; END IF;
 IF g.version<>(p_data->>'expectedVersion')::integer THEN RAISE EXCEPTION 'Guest changed. Refresh before editing.'; END IF;
 x:=p_data->'guest';
 UPDATE yingira.invitations SET guest_name=trim(x->>'name'),phone=coalesce(x->>'phone',''),email=coalesce(x->>'email',''),capacity=(x->>'capacity')::integer,table_label=coalesce(x->>'tableLabel',''),category=coalesce(x->>'category',''),note=coalesce(x->>'note',''),version=version+1 WHERE id=g.id;
 ELSIF p_action='create_import' THEN
 job:=(p_data->>'jobId')::uuid;
 IF jsonb_array_length(p_data->'rows') NOT BETWEEN 1 AND 5000 THEN RAISE EXCEPTION 'Choose 1 to 5000 rows'; END IF;
 IF EXISTS(SELECT 1 FROM yingira.import_jobs WHERE id=job AND event_id<>eid) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 INSERT INTO yingira.import_jobs(id,event_id,name,created_by) VALUES(job,eid,p_data->>'name',u) ON CONFLICT DO NOTHING;
 -- A retry must not mutate a previously confirmed import.
 IF FOUND THEN
 FOR x IN SELECT value FROM jsonb_array_elements(p_data->'rows') LOOP
 IF length(trim(x->>'name')) NOT BETWEEN 2 AND 160 OR (x->>'capacity')::integer NOT BETWEEN 1 AND 100 OR coalesce(x->>'phone','') !~ '^(\+[1-9][0-9]{7,14})?$' OR length(coalesce(x->>'email',''))>254 OR length(coalesce(x->>'tableLabel',''))>60 OR length(coalesce(x->>'category',''))>60 OR length(coalesce(x->>'note',''))>500 THEN RAISE EXCEPTION 'Invalid guest row'; END IF;
 INSERT INTO yingira.import_rows(job_id,row_key,payload) VALUES(job,(x->>'rowKey')::integer,x);
 END LOOP; END IF;
 RETURN jsonb_build_object('id',job);
 ELSIF p_action IN('import_pending','import_batch') THEN
 job:=(p_data->>'jobId')::uuid;
 PERFORM 1 FROM yingira.import_jobs WHERE id=job AND event_id=eid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 IF p_action='import_pending' THEN RETURN coalesce((SELECT jsonb_agg(v) FROM(SELECT row_key AS "rowKey" FROM yingira.import_rows WHERE job_id=job AND status='pending' ORDER BY row_key LIMIT 40)v),'[]'::jsonb); END IF;
 IF jsonb_array_length(p_data->'tokens')>40 THEN RAISE EXCEPTION 'Batch too large'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('import:'||eid,0));
 FOR x IN SELECT value FROM jsonb_array_elements(p_data->'tokens') LOOP
 SELECT * INTO import_row FROM yingira.import_rows WHERE job_id=job AND row_key=(x->>'rowKey')::integer AND status='pending' FOR UPDATE;
 IF NOT FOUND THEN CONTINUE; END IF;
 body:=import_row.payload;
 IF NOT coalesce((body->>'keepDuplicate')::boolean,false) AND EXISTS(SELECT 1 FROM yingira.invitations WHERE event_id=eid AND lower(trim(guest_name))=lower(trim(body->>'name')) AND (phone=coalesce(body->>'phone','') OR (email<>'' AND lower(email)=lower(body->>'email')))) THEN UPDATE yingira.import_rows SET status='skipped' WHERE job_id=job AND row_key=import_row.row_key; CONTINUE; END IF;
 INSERT INTO yingira.invitations(organization_id,event_id,guest_name,phone,email,capacity,table_label,category,note) VALUES(org,eid,body->>'name',coalesce(body->>'phone',''),coalesce(body->>'email',''),(body->>'capacity')::integer,coalesce(body->>'tableLabel',''),coalesce(body->>'category',''),coalesce(body->>'note','')) RETURNING id INTO iid;
 INSERT INTO yingira.tokens(organization_id,event_id,invitation_id,digest,ciphertext) VALUES(org,eid,iid,x->>'tokenHash',x->>'tokenCiphertext');
 UPDATE yingira.import_rows SET status='created',invitation_id=iid WHERE job_id=job AND row_key=import_row.row_key;
 END LOOP;
 RETURN jsonb_build_object('remaining',(SELECT count(*) FROM yingira.import_rows WHERE job_id=job AND status='pending'));
 ELSIF p_action='register_asset' THEN
 INSERT INTO yingira.design_assets(id,event_id) VALUES((p_data->>'assetId')::uuid,eid);
 ELSIF p_action='asset' THEN
 IF NOT EXISTS(SELECT 1 FROM yingira.design_assets WHERE id=(p_data->>'assetId')::uuid AND event_id=eid) THEN RAISE EXCEPTION 'Asset not found'; END IF;
 RETURN jsonb_build_object('path',eid||'/'||(p_data->>'assetId')||'.webp');
 ELSIF p_action IN('save_design','publish_design','restore_design') THEN
 PERFORM pg_advisory_xact_lock(hashtextextended('design:'||eid,0));
 SELECT revision INTO rev FROM yingira.design_drafts WHERE event_id=eid;
 IF coalesce(rev,0)<>(p_data->>'expectedRevision')::integer THEN RAISE EXCEPTION 'Design changed in another tab. Reload before saving.'; END IF;
 IF p_action='save_design' THEN
 body:=p_data->'design';
 IF jsonb_typeof(body)<>'object' OR octet_length(body::text)>12000 THEN RAISE EXCEPTION 'Invalid design'; END IF;
 IF body->>'assetId' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM yingira.design_assets WHERE id=(body->>'assetId')::uuid AND event_id=eid) THEN RAISE EXCEPTION 'Asset not found'; END IF;
 INSERT INTO yingira.design_drafts(event_id,design) VALUES(eid,body) ON CONFLICT(event_id) DO UPDATE SET design=excluded.design,revision=yingira.design_drafts.revision+1;
 ELSIF p_action='publish_design' THEN
 IF rev IS NULL THEN RAISE EXCEPTION 'Save a draft first'; END IF;
 INSERT INTO yingira.design_versions(event_id,design,created_by) SELECT event_id,design,u FROM yingira.design_drafts WHERE event_id=eid RETURNING id INTO vid;
 UPDATE yingira.design_drafts SET published_id=vid,revision=revision+1 WHERE event_id=eid;
 ELSE
 SELECT design INTO body FROM yingira.design_versions WHERE id=(p_data->>'versionId')::uuid AND event_id=eid;
 IF body IS NULL THEN RAISE EXCEPTION 'Version not found'; END IF;
 UPDATE yingira.design_drafts SET design=body,revision=revision+1 WHERE event_id=eid;
 END IF;
 RETURN jsonb_build_object('revision',(SELECT revision FROM yingira.design_drafts WHERE event_id=eid));
 ELSE RAISE EXCEPTION 'Unknown planning action'; END IF;
 INSERT INTO yingira.audit(organization_id,event_id,actor_id,action) VALUES(org,eid,u,p_action);
 RETURN jsonb_build_object('ok',true);
END $$;
GRANT CREATE ON SCHEMA public TO yingira_executor;
ALTER FUNCTION public.yingira_planning(text,jsonb) OWNER TO yingira_executor;
REVOKE CREATE ON SCHEMA public FROM yingira_executor;
REVOKE ALL ON FUNCTION public.yingira_planning(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.yingira_planning(text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.yingira_public_invitation(p_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; BEGIN
 IF p_token !~ '^[A-Za-z0-9_-]{43}$' THEN RETURN NULL; END IF;
 SELECT jsonb_build_object('guestName',i.guest_name,'title',e.title,'venue',e.venue,'startsAt',e.starts_at,'timezone',e.timezone,'capacity',i.capacity,'tableLabel',i.table_label,'eventId',e.id,'design',v.design)
 INTO result FROM yingira.tokens t JOIN yingira.invitations i ON i.id=t.invitation_id JOIN yingira.events e ON e.id=i.event_id JOIN yingira.organizations o ON o.id=e.organization_id LEFT JOIN yingira.design_drafts d ON d.event_id=e.id LEFT JOIN yingira.design_versions v ON v.id=d.published_id AND v.event_id=e.id
 WHERE t.digest=encode(extensions.digest(p_token,'sha256'),'hex') AND t.revoked_at IS NULL AND o.active AND e.status<>'closed';
 RETURN result;
END $$;
