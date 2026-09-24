-- Responses are independent of admission. Legacy events keep RSVP disabled.
ALTER TABLE yingira.events ADD COLUMN rsvp_enabled boolean NOT NULL DEFAULT false, ADD COLUMN rsvp_deadline timestamptz;
ALTER TABLE yingira.attendance DROP CONSTRAINT attendance_kind_check;
ALTER TABLE yingira.attendance ADD CONSTRAINT attendance_kind_check CHECK(kind IN('INITIAL_ENTRY','EXIT','REENTRY'));
CREATE TABLE yingira.event_tables(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid NOT NULL REFERENCES yingira.events(id),name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 60),capacity integer NOT NULL CHECK(capacity BETWEEN 1 AND 1000),UNIQUE(event_id,id),UNIQUE(event_id,name));
ALTER TABLE yingira.invitations ADD COLUMN table_id uuid, ADD FOREIGN KEY(event_id,table_id) REFERENCES yingira.event_tables(event_id,id);
CREATE INDEX invitation_table ON yingira.invitations(table_id) WHERE table_id IS NOT NULL;
CREATE TABLE yingira.responses(invitation_id uuid PRIMARY KEY REFERENCES yingira.invitations(id),members jsonb NOT NULL,revision integer NOT NULL DEFAULT 1,updated_at timestamptz NOT NULL DEFAULT now(),source text NOT NULL CHECK(source IN('guest','admin')));
CREATE TABLE yingira.response_history(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),invitation_id uuid NOT NULL REFERENCES yingira.invitations(id),members jsonb NOT NULL,revision integer NOT NULL,source text NOT NULL,actor_id uuid,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(invitation_id,revision));
CREATE TABLE yingira.exceptions(id uuid PRIMARY KEY,event_id uuid NOT NULL REFERENCES yingira.events(id),invitation_id uuid NOT NULL REFERENCES yingira.invitations(id),requested_by uuid NOT NULL,quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 100),reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 5 AND 500),status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','rejected')),resolved_by uuid,resolution text,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX exception_event ON yingira.exceptions(event_id,status);
CREATE TABLE yingira.mail_campaigns(id uuid PRIMARY KEY,event_id uuid NOT NULL REFERENCES yingira.events(id),kind text NOT NULL CHECK(kind IN('invitation','reminder')),subject text NOT NULL CHECK(length(subject) BETWEEN 1 AND 160),message text NOT NULL CHECK(length(message) BETWEEN 1 AND 2000),created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE yingira.mail_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),campaign_id uuid NOT NULL REFERENCES yingira.mail_campaigns(id),invitation_id uuid NOT NULL REFERENCES yingira.invitations(id),recipient text NOT NULL,token_id uuid NOT NULL REFERENCES yingira.tokens(id),status text NOT NULL DEFAULT 'queued' CHECK(status IN('queued','sending','accepted','delivered','bounced','complained','failed','unknown','cancelled')),provider_id text UNIQUE,attempt_started_at timestamptz,lease_until timestamptz,payload jsonb,last_error text,updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(campaign_id,invitation_id));
CREATE INDEX mail_queue ON yingira.mail_messages(status,lease_until);
CREATE TABLE yingira.mail_suppressions(email text PRIMARY KEY,reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['event_tables','responses','response_history','exceptions','mail_campaigns','mail_messages','mail_suppressions'] LOOP
 EXECUTE format('ALTER TABLE yingira.%I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('ALTER TABLE yingira.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON yingira.%I FROM PUBLIC,anon,authenticated',t);
 EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON yingira.%I TO yingira_executor',t);
 EXECUTE format('CREATE POLICY command_owner ON yingira.%I TO yingira_executor USING(true) WITH CHECK(true)',t);
END LOOP; END $$;
CREATE TRIGGER immutable_response_history BEFORE UPDATE OR DELETE ON yingira.response_history FOR EACH ROW EXECUTE FUNCTION yingira.immutable();

-- Capacity guard applies to all writers, including the existing guest editor.
CREATE FUNCTION yingira.check_seating() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE seat_limit integer; label text; used integer;
BEGIN
 IF TG_TABLE_NAME='event_tables' THEN
  SELECT coalesce(sum(capacity),0) INTO used FROM yingira.invitations WHERE table_id=NEW.id;
  IF NEW.capacity<used THEN RAISE EXCEPTION 'Table capacity is below its reserved places'; END IF;
  IF NEW.name IS DISTINCT FROM OLD.name THEN RAISE EXCEPTION 'Create a new table to change its name'; END IF;
 ELSE
  IF NEW.table_id IS NOT NULL THEN
   SELECT capacity,name INTO seat_limit,label FROM yingira.event_tables WHERE id=NEW.table_id AND event_id=NEW.event_id FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Table not found'; END IF;
   SELECT coalesce(sum(capacity),0) INTO used FROM yingira.invitations WHERE table_id=NEW.table_id AND id<>NEW.id;
   IF used+NEW.capacity>seat_limit THEN RAISE EXCEPTION 'Not enough places at this table'; END IF;
   NEW.table_label:=label;
  END IF;
  IF EXISTS(SELECT 1 FROM yingira.responses WHERE invitation_id=NEW.id AND jsonb_array_length(members)>NEW.capacity) THEN RAISE EXCEPTION 'Capacity is below the recorded household size. Update the response first.'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER seating_guest BEFORE INSERT OR UPDATE OF table_id,capacity,table_label ON yingira.invitations FOR EACH ROW EXECUTE FUNCTION yingira.check_seating();
CREATE TRIGGER seating_table BEFORE UPDATE ON yingira.event_tables FOR EACH ROW EXECUTE FUNCTION yingira.check_seating();

CREATE FUNCTION yingira.save_response(iid uuid,body jsonb,expected integer,origin_name text,actor uuid) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE inv yingira.invitations%rowtype; rev integer; member jsonb;
BEGIN
 SELECT * INTO inv FROM yingira.invitations WHERE id=iid FOR UPDATE;
 IF NOT FOUND OR jsonb_typeof(body) IS DISTINCT FROM 'array' OR octet_length(body::text)>80000 THEN RAISE EXCEPTION 'Invalid response'; END IF;
 IF jsonb_array_length(body) NOT BETWEEN 1 AND inv.capacity THEN RAISE EXCEPTION 'Household exceeds invitation allowance'; END IF;
 FOR member IN SELECT value FROM jsonb_array_elements(body) LOOP
  IF jsonb_typeof(member) IS DISTINCT FROM 'object' OR coalesce(length(trim(member->>'name')),0) NOT BETWEEN 1 AND 160 OR coalesce(member->>'response','') NOT IN('yes','no') OR length(coalesce(member->>'meal',''))>80 OR length(coalesce(member->>'dietary',''))>300 THEN RAISE EXCEPTION 'Complete each household member response'; END IF;
 END LOOP;
 SELECT revision INTO rev FROM yingira.responses WHERE invitation_id=iid;
 IF coalesce(rev,0) IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Response changed. Reload before saving.'; END IF;
 INSERT INTO yingira.responses(invitation_id,members,source) VALUES(iid,body,origin_name) ON CONFLICT(invitation_id) DO UPDATE SET members=excluded.members,source=excluded.source,revision=yingira.responses.revision+1,updated_at=now() RETURNING revision INTO rev;
 INSERT INTO yingira.response_history(invitation_id,members,revision,source,actor_id) VALUES(iid,body,rev,origin_name,actor);
 RETURN jsonb_build_object('revision',rev);
END $$;
REVOKE ALL ON FUNCTION yingira.save_response(uuid,jsonb,integer,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION yingira.save_response(uuid,jsonb,integer,text,uuid) TO yingira_executor;

CREATE FUNCTION public.yingira_rsvp(p_token text,p_members jsonb,p_revision integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE inv yingira.invitations%rowtype; ev yingira.events%rowtype; tok yingira.tokens%rowtype;
BEGIN
 IF p_token !~ '^[A-Za-z0-9_-]{43}$' THEN RAISE EXCEPTION 'Invitation unavailable'; END IF;
 SELECT * INTO tok FROM yingira.tokens WHERE digest=encode(extensions.digest(p_token,'sha256'),'hex');
 IF NOT FOUND THEN RAISE EXCEPTION 'Invitation unavailable'; END IF;
 SELECT * INTO ev FROM yingira.events WHERE id=tok.event_id FOR SHARE;
 PERFORM 1 FROM yingira.organizations WHERE id=ev.organization_id AND active FOR SHARE;
 IF NOT FOUND OR NOT ev.rsvp_enabled OR ev.status='closed' OR (ev.rsvp_deadline IS NOT NULL AND ev.rsvp_deadline<clock_timestamp()) THEN RAISE EXCEPTION 'Responses are closed. Please contact your host.'; END IF;
 SELECT * INTO inv FROM yingira.invitations WHERE id=tok.invitation_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM yingira.tokens WHERE id=tok.id AND revoked_at IS NOT NULL) THEN RAISE EXCEPTION 'Invitation unavailable'; END IF;
 IF NOT yingira.check_rate('rsvp:'||inv.id,10) THEN RAISE EXCEPTION 'Please wait a minute before trying again'; END IF;
 RETURN yingira.save_response(inv.id,p_members,p_revision,'guest',null);
END $$;

CREATE FUNCTION public.yingira_operations(p_action text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=yingira.actor_id(); eid uuid:=(p_data->>'eventId')::uuid; ev yingira.events%rowtype; admin boolean; staff_role text; shift yingira.staff_shifts%rowtype; inv yingira.invitations%rowtype; prior yingira.receipts%rowtype; ex yingira.exceptions%rowtype; iid uuid:=(p_data->>'invitationId')::uuid; gid uuid:=(p_data->>'gateId')::uuid; action_kind text:=p_data->>'kind'; req uuid:=(p_data->>'idempotencyKey')::uuid; digest text; qty integer:=(p_data->>'quantity')::integer; reply jsonb; tid uuid; x jsonb; cid uuid; total integer; term text:=trim(p_data->>'search');
BEGIN
 PERFORM 1 FROM yingira.profiles WHERE id=u AND NOT disabled FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 SELECT * INTO ev FROM yingira.events WHERE id=eid FOR SHARE;
 PERFORM 1 FROM yingira.organizations WHERE id=ev.organization_id AND active FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM yingira.organization_members WHERE organization_id=ev.organization_id AND user_id=u AND active FOR SHARE; admin:=FOUND;
 IF p_action IN('lookup','gate_state','request_exception','resolve_exception','movement') THEN
  IF NOT admin THEN
   SELECT role INTO staff_role FROM yingira.team WHERE event_id=eid AND user_id=u AND active AND gate_id=gid FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
  END IF;
  SELECT * INTO shift FROM yingira.staff_shifts WHERE user_id=u FOR UPDATE;
  IF shift.event_id IS DISTINCT FROM eid OR shift.auth_session_id IS DISTINCT FROM (current_setting('request.jwt.claims',true)::jsonb->>'session_id')::uuid OR shift.lease_id IS DISTINCT FROM (p_data->>'leaseId')::uuid OR shift.expires_at<=clock_timestamp() OR (NOT admin AND shift.role IS DISTINCT FROM staff_role) THEN RAISE EXCEPTION 'Start an active shift for this event' USING ERRCODE='42501'; END IF;
  staff_role:=shift.role;
  IF NOT EXISTS(SELECT 1 FROM yingira.gates WHERE id=gid AND event_id=eid) THEN RAISE EXCEPTION 'Gate unavailable'; END IF;
 ELSE
  IF NOT admin THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501'; END IF;
 END IF;
 IF NOT yingira.check_rate('operations:'||u,240) THEN RAISE EXCEPTION 'Too many requests. Wait a minute.'; END IF;
 IF p_action='state' THEN
  RETURN jsonb_build_object('rsvpEnabled',ev.rsvp_enabled,'rsvpDeadline',ev.rsvp_deadline,
   'tables',coalesce((SELECT jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'capacity',t.capacity,'reserved',(SELECT coalesce(sum(capacity),0) FROM yingira.invitations WHERE table_id=t.id)) ORDER BY t.name) FROM yingira.event_tables t WHERE event_id=eid),'[]'::jsonb),
   'guests',coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'name',i.guest_name,'email',i.email,'category',i.category,'capacity',i.capacity,'tableId',i.table_id,'tableLabel',i.table_label,'version',i.version,'members',coalesce(r.members,'[]'::jsonb),'responseRevision',coalesce(r.revision,0),'responseSource',r.source,'revoked',NOT EXISTS(SELECT 1 FROM yingira.tokens WHERE invitation_id=i.id AND revoked_at IS NULL),'suppressed',EXISTS(SELECT 1 FROM yingira.mail_suppressions WHERE email=lower(i.email))) ORDER BY i.guest_name) FROM yingira.invitations i LEFT JOIN yingira.responses r ON r.invitation_id=i.id WHERE i.event_id=eid),'[]'::jsonb),
   'messages',coalesce((SELECT jsonb_agg(v) FROM(SELECT m.id,m.campaign_id AS "campaignId",i.guest_name AS "guestName",m.recipient,m.status,m.last_error AS "lastError",m.updated_at AS "updatedAt",c.kind,c.subject FROM yingira.mail_messages m JOIN yingira.mail_campaigns c ON c.id=m.campaign_id JOIN yingira.invitations i ON i.id=m.invitation_id WHERE c.event_id=eid ORDER BY c.created_at DESC,m.id LIMIT 500)v),'[]'::jsonb));
 ELSIF p_action='rsvp_settings' THEN
  UPDATE yingira.events SET rsvp_enabled=(p_data->>'enabled')::boolean,rsvp_deadline=(p_data->>'deadline')::timestamptz WHERE id=eid;
 ELSIF p_action='admin_response' THEN
  IF NOT EXISTS(SELECT 1 FROM yingira.invitations WHERE id=iid AND event_id=eid) THEN RAISE EXCEPTION 'Guest unavailable'; END IF;
  RETURN yingira.save_response(iid,p_data->'members',(p_data->>'expectedRevision')::integer,'admin',u);
 ELSIF p_action='table_save' THEN
  IF p_data->>'tableId' IS NULL THEN INSERT INTO yingira.event_tables(event_id,name,capacity) VALUES(eid,trim(p_data->>'name'),(p_data->>'capacity')::integer);
  ELSE UPDATE yingira.event_tables SET capacity=(p_data->>'capacity')::integer WHERE id=(p_data->>'tableId')::uuid AND event_id=eid; IF NOT FOUND THEN RAISE EXCEPTION 'Table unavailable'; END IF; END IF;
 ELSIF p_action='assign_table' THEN
  SELECT * INTO inv FROM yingira.invitations WHERE id=iid AND event_id=eid FOR UPDATE;
  IF NOT FOUND OR inv.version IS DISTINCT FROM (p_data->>'expectedVersion')::integer THEN RAISE EXCEPTION 'Guest changed. Reload before assigning.'; END IF;
  UPDATE yingira.invitations SET table_id=(p_data->>'tableId')::uuid,table_label=CASE WHEN p_data->>'tableId' IS NULL THEN '' ELSE table_label END,version=version+1 WHERE id=iid;
 ELSIF p_action='lookup' THEN
  IF length(term)<2 OR length(term)>180 THEN RAISE EXCEPTION 'Enter at least two characters'; END IF;
  RETURN coalesce((SELECT jsonb_agg(v) FROM(SELECT i.id,i.guest_name AS name,right(i.phone,4) AS "phoneSuffix",i.table_label AS "tableLabel",i.capacity,i.initial_count AS "initialCount",i.inside_count AS "insideCount",i.version,NOT EXISTS(SELECT 1 FROM yingira.tokens WHERE invitation_id=i.id AND revoked_at IS NULL) AS revoked FROM yingira.invitations i WHERE i.event_id=eid AND (strpos(lower(i.guest_name),lower(term))>0 OR (length(term)=4 AND right(i.phone,4)=term) OR EXISTS(SELECT 1 FROM yingira.tokens t WHERE t.invitation_id=i.id AND t.digest=encode(extensions.digest(term,'sha256'),'hex') AND t.revoked_at IS NULL)) ORDER BY i.guest_name LIMIT 20)v),'[]'::jsonb);
 ELSIF p_action='gate_state' THEN
  RETURN coalesce((SELECT jsonb_agg(v) FROM(SELECT er.id,er.invitation_id AS "invitationId",i.guest_name AS name,i.version,er.quantity,er.reason,er.status,er.created_at AS "createdAt" FROM yingira.exceptions er JOIN yingira.invitations i ON i.id=er.invitation_id WHERE er.event_id=eid AND (staff_role='supervisor' OR er.requested_by=u) ORDER BY er.created_at DESC LIMIT 100)v),'[]'::jsonb);
 ELSIF p_action='request_exception' THEN
  IF NOT EXISTS(SELECT 1 FROM yingira.invitations WHERE id=iid AND event_id=eid) THEN RAISE EXCEPTION 'Guest unavailable'; END IF;
  INSERT INTO yingira.exceptions(id,event_id,invitation_id,requested_by,quantity,reason) VALUES((p_data->>'requestId')::uuid,eid,iid,u,qty,trim(p_data->>'reason')) ON CONFLICT(id) DO NOTHING;
 ELSIF p_action IN('movement','resolve_exception') THEN
  IF p_action='resolve_exception' THEN
   IF staff_role<>'supervisor' THEN RAISE EXCEPTION 'Supervisor access required' USING ERRCODE='42501'; END IF;
   SELECT * INTO ex FROM yingira.exceptions WHERE id=(p_data->>'requestId')::uuid AND event_id=eid FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Request unavailable'; END IF;
   IF ex.status<>'pending' THEN RETURN jsonb_build_object('status',ex.status); END IF;
   IF coalesce(length(trim(p_data->>'reason')),0)<5 THEN RAISE EXCEPTION 'Record the supervisor reason'; END IF;
   IF p_data->>'decision'='reject' THEN
    UPDATE yingira.exceptions SET status='rejected',resolved_by=u,resolution=p_data->>'reason' WHERE id=ex.id;
    INSERT INTO yingira.audit(organization_id,event_id,actor_id,action,entity_id,metadata) VALUES(ev.organization_id,eid,u,'REJECT_EXCEPTION',ex.id,jsonb_build_object('reason',p_data->>'reason'));
    RETURN jsonb_build_object('status','rejected');
   ELSIF p_data->>'decision'<>'approve' THEN RAISE EXCEPTION 'Invalid decision'; END IF;
   iid:=ex.invitation_id; qty:=ex.quantity; action_kind:='INITIAL_ENTRY';
  END IF;
  IF action_kind NOT IN('INITIAL_ENTRY','EXIT','REENTRY') OR action_kind IS NULL OR qty IS NULL OR qty NOT BETWEEN 1 AND 100 OR (p_data->>'quantity')::numeric IS DISTINCT FROM (p_data->>'quantity')::integer::numeric THEN RAISE EXCEPTION 'Invalid movement'; END IF;
  IF action_kind='INITIAL_ENTRY' AND (staff_role<>'supervisor' OR coalesce(length(trim(p_data->>'reason')),0)<5) THEN RAISE EXCEPTION 'Supervisor and verification reason required' USING ERRCODE='42501'; END IF;
  IF req IS NULL THEN RAISE EXCEPTION 'Missing request key'; END IF;
  digest:=encode(extensions.digest((p_data-'leaseId')::text,'sha256'),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(u::text||req::text,0));
  SELECT * INTO prior FROM yingira.receipts WHERE actor_id=u AND key=req;
  IF FOUND THEN IF prior.request_hash<>digest THEN RAISE EXCEPTION 'Request key already used'; END IF; RETURN prior.receipt; END IF;
  IF ev.status<>'active' THEN RAISE EXCEPTION 'Check-in is not open'; END IF;
  SELECT * INTO inv FROM yingira.invitations WHERE id=iid AND event_id=eid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Guest unavailable'; END IF;
  IF NOT EXISTS(SELECT 1 FROM yingira.tokens WHERE invitation_id=iid AND revoked_at IS NULL) THEN RAISE EXCEPTION 'Invitation revoked'; END IF;
  IF inv.version IS DISTINCT FROM (p_data->>'expectedVersion')::integer THEN RAISE EXCEPTION 'Guest counts changed. Look up the guest again.'; END IF;
  IF (action_kind='EXIT' AND qty>inv.inside_count) OR (action_kind='REENTRY' AND qty>inv.initial_count-inv.inside_count) OR (action_kind='INITIAL_ENTRY' AND qty>inv.capacity-inv.initial_count) THEN RAISE EXCEPTION 'Quantity exceeds the available allowance'; END IF;
  UPDATE yingira.invitations SET inside_count=inside_count+CASE WHEN action_kind='EXIT' THEN -qty ELSE qty END,initial_count=initial_count+CASE WHEN action_kind='INITIAL_ENTRY' THEN qty ELSE 0 END,version=version+1 WHERE id=iid RETURNING * INTO inv;
  INSERT INTO yingira.attendance(organization_id,event_id,invitation_id,gate_id,actor_id,device_id,quantity,kind) VALUES(ev.organization_id,eid,iid,gid,u,(p_data->>'deviceId')::uuid,qty,action_kind) RETURNING id INTO tid;
  INSERT INTO yingira.audit(organization_id,event_id,actor_id,action,entity_id,metadata) VALUES(ev.organization_id,eid,u,action_kind,tid,jsonb_build_object('invitationId',iid,'quantity',qty,'reason',p_data->>'reason','assisted',true,'role',staff_role));
  IF p_action='resolve_exception' THEN UPDATE yingira.exceptions SET status='approved',resolved_by=u,resolution=p_data->>'reason' WHERE id=ex.id; END IF;
  reply:=jsonb_build_object('status','recorded','transactionId',tid,'insideCount',inv.inside_count,'initialCount',inv.initial_count,'version',inv.version);
  INSERT INTO yingira.receipts VALUES(ev.organization_id,u,req,digest,reply);
  RETURN reply;
 ELSIF p_action='queue_mail' THEN
  cid:=(p_data->>'campaignId')::uuid;
  IF jsonb_array_length(p_data->'guestIds') NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Choose 1 to 500 invitations'; END IF;
  IF EXISTS(SELECT 1 FROM yingira.mail_campaigns WHERE id=cid AND event_id<>eid) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
  INSERT INTO yingira.mail_campaigns(id,event_id,kind,subject,message,created_by) VALUES(cid,eid,p_data->>'kind',p_data->>'subject',p_data->>'message',u) ON CONFLICT DO NOTHING;
  IF FOUND THEN
   FOR x IN SELECT value FROM jsonb_array_elements(p_data->'guestIds') LOOP
    iid:=(x#>>'{}')::uuid;
    INSERT INTO yingira.mail_messages(campaign_id,invitation_id,recipient,token_id)
     SELECT cid,i.id,lower(trim(i.email)),t.id FROM yingira.invitations i JOIN yingira.tokens t ON t.invitation_id=i.id AND t.revoked_at IS NULL
     WHERE i.id=iid AND i.event_id=eid AND i.email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' AND NOT EXISTS(SELECT 1 FROM yingira.mail_suppressions WHERE email=lower(i.email))
     AND (p_data->>'kind'<>'reminder' OR NOT EXISTS(SELECT 1 FROM yingira.responses WHERE invitation_id=i.id)) ON CONFLICT DO NOTHING;
   END LOOP;
  END IF;
  SELECT count(*) INTO total FROM yingira.mail_messages WHERE campaign_id=cid;
  RETURN jsonb_build_object('campaignId',cid,'queued',total);
 ELSIF p_action='cancel_mail' THEN
  UPDATE yingira.mail_messages SET status='cancelled',updated_at=now() WHERE campaign_id=(p_data->>'campaignId')::uuid AND status='queued' AND EXISTS(SELECT 1 FROM yingira.mail_campaigns WHERE id=campaign_id AND event_id=eid);
 ELSE RAISE EXCEPTION 'Unknown operation'; END IF;
 INSERT INTO yingira.audit(organization_id,event_id,actor_id,action,entity_id) VALUES(ev.organization_id,eid,u,p_action,coalesce(iid,eid));
 RETURN jsonb_build_object('ok',true);
END $$;

-- A narrow server-only adapter. UI callers never receive privileged clients.
CREATE FUNCTION public.yingira_mail_worker(p_action text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m yingira.mail_messages%rowtype; c yingira.mail_campaigns%rowtype; inv yingira.invitations%rowtype; tok yingira.tokens%rowtype; ev yingira.events%rowtype;
BEGIN
 IF p_action='claim' THEN
  SELECT mm.* INTO m FROM yingira.mail_messages mm JOIN yingira.mail_campaigns cc ON cc.id=mm.campaign_id WHERE (p_data->>'eventId' IS NULL OR cc.event_id=(p_data->>'eventId')::uuid) AND (mm.status='queued' OR (mm.status='sending' AND mm.lease_until<now())) ORDER BY cc.created_at,mm.id FOR UPDATE OF mm SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF m.attempt_started_at<now()-interval '23 hours' THEN UPDATE yingira.mail_messages SET status='unknown',last_error='Provider result uncertain. Review before creating a new send.',updated_at=now() WHERE id=m.id; RETURN jsonb_build_object('skipped',true); END IF;
  SELECT * INTO c FROM yingira.mail_campaigns WHERE id=m.campaign_id;
  SELECT * INTO inv FROM yingira.invitations WHERE id=m.invitation_id;
  SELECT * INTO tok FROM yingira.tokens WHERE id=m.token_id;
  SELECT * INTO ev FROM yingira.events WHERE id=c.event_id;
  IF tok.revoked_at IS NOT NULL OR ev.status='closed' OR NOT EXISTS(SELECT 1 FROM yingira.organizations WHERE id=ev.organization_id AND active) OR EXISTS(SELECT 1 FROM yingira.mail_suppressions WHERE email=m.recipient) OR (c.kind='reminder' AND EXISTS(SELECT 1 FROM yingira.responses WHERE invitation_id=inv.id)) THEN
   UPDATE yingira.mail_messages SET status='cancelled',updated_at=now() WHERE id=m.id; RETURN jsonb_build_object('skipped',true);
  END IF;
  UPDATE yingira.mail_messages SET status='sending',attempt_started_at=coalesce(attempt_started_at,now()),lease_until=now()+interval '2 minutes',updated_at=now() WHERE id=m.id;
  RETURN jsonb_build_object('id',m.id,'recipient',m.recipient,'name',inv.guest_name,'ciphertext',tok.ciphertext,'title',ev.title,'venue',ev.venue,'startsAt',ev.starts_at,'timezone',ev.timezone,'subject',c.subject,'message',c.message,'payload',m.payload);
 ELSIF p_action='payload' THEN
  UPDATE yingira.mail_messages SET payload=p_data->'payload' WHERE id=(p_data->>'id')::uuid AND payload IS NULL AND status='sending';
 ELSIF p_action='complete' THEN
  UPDATE yingira.mail_messages SET status=p_data->>'status',provider_id=coalesce(p_data->>'providerId',provider_id),last_error=left(p_data->>'error',250),updated_at=now() WHERE id=(p_data->>'id')::uuid AND status IN('sending','accepted','delivered');
  IF p_data->>'status' IN('bounced','complained') THEN INSERT INTO yingira.mail_suppressions(email,reason) SELECT recipient,p_data->>'status' FROM yingira.mail_messages WHERE id=(p_data->>'id')::uuid ON CONFLICT DO NOTHING; END IF;
 ELSIF p_action='track' THEN
  RETURN coalesce((SELECT jsonb_agg(v) FROM(SELECT mm.id,mm.status,mm.provider_id AS "providerId" FROM yingira.mail_messages mm JOIN yingira.mail_campaigns cc ON cc.id=mm.campaign_id WHERE cc.event_id=(p_data->>'eventId')::uuid AND mm.status IN('accepted','delivered') AND mm.provider_id IS NOT NULL ORDER BY mm.updated_at LIMIT 20)v),'[]'::jsonb);
 ELSE RAISE EXCEPTION 'Unknown mail operation'; END IF;
 RETURN jsonb_build_object('ok',true);
END $$;
GRANT CREATE ON SCHEMA public TO yingira_executor;
ALTER FUNCTION public.yingira_operations(text,jsonb) OWNER TO yingira_executor;
ALTER FUNCTION public.yingira_rsvp(text,jsonb,integer) OWNER TO yingira_executor;
ALTER FUNCTION public.yingira_mail_worker(text,jsonb) OWNER TO yingira_executor;
REVOKE CREATE ON SCHEMA public FROM yingira_executor;
REVOKE ALL ON FUNCTION public.yingira_operations(text,jsonb),public.yingira_rsvp(text,jsonb,integer),public.yingira_mail_worker(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.yingira_operations(text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.yingira_rsvp(text,jsonb,integer),public.yingira_mail_worker(text,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.yingira_public_invitation(p_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; BEGIN
 IF p_token !~ '^[A-Za-z0-9_-]{43}$' THEN RETURN NULL; END IF;
 SELECT jsonb_build_object('guestName',i.guest_name,'title',e.title,'venue',e.venue,'startsAt',e.starts_at,'timezone',e.timezone,'capacity',i.capacity,'tableLabel',i.table_label,'eventId',e.id,'design',v.design,'rsvpEnabled',e.rsvp_enabled,'rsvpDeadline',e.rsvp_deadline,'responseRevision',coalesce(r.revision,0),'members',coalesce(r.members,'[]'::jsonb))
 INTO result FROM yingira.tokens t JOIN yingira.invitations i ON i.id=t.invitation_id JOIN yingira.events e ON e.id=i.event_id JOIN yingira.organizations o ON o.id=e.organization_id LEFT JOIN yingira.design_drafts d ON d.event_id=e.id LEFT JOIN yingira.design_versions v ON v.id=d.published_id AND v.event_id=e.id
 LEFT JOIN yingira.responses r ON r.invitation_id=i.id WHERE t.digest=encode(extensions.digest(p_token,'sha256'),'hex') AND t.revoked_at IS NULL AND o.active AND e.status<>'closed';
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.yingira_command (
  p_action text,
  p_data   jsonb DEFAULT '{}'::jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
 u uuid:=yingira.actor_id(); org uuid; eid uuid; gate uuid; iid uuid; target uuid; admin boolean:=false;
 e yingira.events%rowtype; inv yingira.invitations%rowtype; tok yingira.tokens%rowtype; prior yingira.receipts%rowtype;
 outcome text; reply jsonb; rows jsonb; q integer; reqkey uuid; reqhash text; tid uuid; accepted timestamptz; role_name text; session_id uuid:=nullif(current_setting('request.jwt.claims',true)::jsonb->>'session_id','')::uuid; lease uuid; shift yingira.staff_shifts%rowtype; pending yingira.staff_invitations%rowtype;
begin
 insert into yingira.profiles(id) values(u) on conflict do nothing;
 perform 1 from yingira.profiles where id=u and not disabled for share;
 if not found then raise exception 'Not authorized' using errcode='42501'; end if;
 if not yingira.check_rate('actor:'||u,240) then return jsonb_build_object('ok',false,'code','RATE_LIMITED','message','Too many requests. Wait a minute and try again.'); end if;

 if p_action='create_organization' then
  if not exists(select 1 from yingira.admin_onboarding where email=lower(yingira.member_email(u)))
   and not exists(select 1 from yingira.organization_members where user_id=u and active) then
   raise exception 'Administrator access required' using errcode='42501'; end if;
  insert into yingira.organizations(name) values(trim(p_data->>'name')) returning id into org;
  insert into yingira.organization_members values(org,u,true);
  insert into yingira.audit(organization_id,actor_id,action,entity_id) values(org,u,p_action,org);
  return jsonb_build_object('ok',true,'data',jsonb_build_object('id',org));
 end if;
 if p_action='dashboard' then
  for pending in select si.* from yingira.staff_invitations si join yingira.organizations o on o.id=si.organization_id and o.active
   where si.email=lower(yingira.member_email(u)) and si.active and si.accepted_by is null for update of si loop
   insert into yingira.team(organization_id,event_id,user_id,gate_id,role) values(pending.organization_id,pending.event_id,u,pending.gate_id,pending.role)
    on conflict(event_id,user_id) do update set gate_id=excluded.gate_id,role=excluded.role,active=true;
   update yingira.staff_invitations set accepted_by=u where id=pending.id;
   insert into yingira.audit(organization_id,event_id,actor_id,action,entity_id) values(pending.organization_id,pending.event_id,u,'ACCEPT_STAFF_INVITATION',pending.id);
  end loop;
  return jsonb_build_object('canCreateOrganization',exists(select 1 from yingira.admin_onboarding where email=lower(yingira.member_email(u))) or exists(select 1 from yingira.organization_members where user_id=u and active),'organizations',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name)) from yingira.organizations o join yingira.organization_members m on m.organization_id=o.id where m.user_id=u and m.active and o.active),'[]'::jsonb),
  'events',coalesce((select jsonb_agg(jsonb_build_object('id',ev.id,'title',ev.title,'venue',ev.venue,'starts_at',ev.starts_at,'status',ev.status,'organization_id',ev.organization_id,'role',(select t.role from yingira.team t where t.event_id=ev.id and t.user_id=u and t.active),'is_admin',exists(select 1 from yingira.organization_members m where m.organization_id=ev.organization_id and m.user_id=u and m.active)) order by ev.starts_at) from yingira.events ev join yingira.organizations o on o.id=ev.organization_id where o.active and (exists(select 1 from yingira.organization_members m where m.organization_id=o.id and m.user_id=u and m.active) or exists(select 1 from yingira.team t where t.event_id=ev.id and t.user_id=u and t.active))),'[]'::jsonb));
 end if;
 if p_action='create_event' then
  org:=(p_data->>'organizationId')::uuid;
 else
  eid:=(p_data->>'eventId')::uuid;
  select organization_id into org from yingira.events where id=eid;
 end if;
 -- Shared locks serialize with tenant/member disable; independent invitations can still run concurrently.
 perform 1 from yingira.organizations where id=org and active for share;
 if not found then raise exception 'Not authorized' using errcode='42501'; end if;
 perform 1 from yingira.organization_members where organization_id=org and user_id=u and active for share;
 admin:=found;
 if not admin then
  perform 1 from yingira.team where event_id=eid and user_id=u and active for share;
  if not found then raise exception 'Not authorized' using errcode='42501'; end if;
 end if;
 if p_action='create_event' then
  if not admin then raise exception 'Not authorized' using errcode='42501'; end if;
  if not exists(select 1 from pg_timezone_names where name=p_data->>'timezone') then raise exception 'Invalid timezone'; end if;
  insert into yingira.events(organization_id,title,venue,starts_at,timezone) values(org,trim(p_data->>'title'),trim(p_data->>'venue'),(p_data->>'startsAt')::timestamptz,p_data->>'timezone') returning id into eid;
  insert into yingira.gates(organization_id,event_id,name) values(org,eid,'Main gate');
  insert into yingira.audit(organization_id,event_id,actor_id,action,entity_id) values(org,eid,u,p_action,eid);
  return jsonb_build_object('ok',true,'data',jsonb_build_object('id',eid));
 end if;
 if p_action='set_event_status' then
  if not admin then raise exception 'Not authorized' using errcode='42501'; end if;
  select * into e from yingira.events where id=eid for update;
  update yingira.events set status=p_data->>'status' where id=eid;
  insert into yingira.audit(organization_id,event_id,actor_id,action,entity_id,metadata) values(org,eid,u,p_action,eid,jsonb_build_object('before',e.status,'after',p_data->>'status'));
  return jsonb_build_object('ok',true,'data','{}'::jsonb);
 end if;
 select * into e from yingira.events where id=eid for share;
 if p_action='cancel_staff_invitation' then
  if not admin then raise exception 'Not authorized' using errcode='42501'; end if;
  update yingira.staff_invitations set active=false where id=(p_data->>'invitationId')::uuid and event_id=eid and accepted_by is null;
  insert into yingira.audit(organization_id,event_id,actor_id,action,entity_id) values(org,eid,u,p_action,(p_data->>'invitationId')::uuid);
  return jsonb_build_object('ok',true,'data','{}'::jsonb);
 end if;
 if p_action in ('start_shift','heartbeat_shift','end_shift','release_staff_shift','supervisor_overview','validate','admit') then
  target:=case when p_action='release_staff_shift' then (p_data->>'userId')::uuid else u end;
  if p_action='release_staff_shift' and not admin then raise exception 'Not authorized' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('shift:'||target::text,0));
  select * into shift from yingira.staff_shifts where user_id=target for update;
  lease:=(p_data->>'leaseId')::uuid;
  if p_action='release_staff_shift' then
   delete from yingira.staff_shifts where user_id=target and event_id=eid;
   insert into yingira.audit(organization_id,event_id,actor_id,action,entity_id) values(org,eid,u,p_action,target);
   return jsonb_build_object('ok',true,'data','{}'::jsonb);
  end if;
  if p_action='start_shift' then
   if lease is null then raise exception 'Missing lease'; end if;
   role_name:=case when admin then p_data->>'role' else (select t.role from yingira.team t where t.event_id=eid and t.user_id=u and t.active) end;
   if role_name not in ('usher','supervisor') or role_name is null then raise exception 'Not authorized' using errcode='42501'; end if;
   if shift.expires_at>clock_timestamp() and (shift.event_id<>eid or shift.auth_session_id<>session_id or shift.lease_id<>lease) then
    return jsonb_build_object('ok',false,'code','SHIFT_BUSY','message','Your account is already working in another event or session. End that shift, ask the event Admin to release it, or wait 90 seconds after closing it.');
   end if;
   insert into yingira.staff_shifts values(u,org,eid,session_id,lease,role_name,clock_timestamp()+interval '90 seconds')
    on conflict(user_id) do update set organization_id=excluded.organization_id,event_id=excluded.event_id,auth_session_id=excluded.auth_session_id,lease_id=excluded.lease_id,role=excluded.role,expires_at=excluded.expires_at;
   if shift.lease_id is distinct from lease or shift.expires_at<=clock_timestamp() or shift.role is distinct from role_name then
    insert into yingira.audit(organization_id,event_id,actor_id,action,entity_id,metadata) values(org,eid,u,'START_SHIFT',u,jsonb_build_object('role',role_name,'adminSupport',admin));
   end if;
   return jsonb_build_object('ok',true,'data',jsonb_build_object('role',role_name));
  end if;
  if shift.user_id is null or shift.event_id<>eid or shift.auth_session_id<>session_id or shift.lease_id is distinct from lease or shift.expires_at<=clock_timestamp()
   or (not admin and shift.role is distinct from (select t.role from yingira.team t where t.event_id=eid and t.user_id=u and t.active)) then
   return jsonb_build_object('ok',false,'code','SHIFT_REQUIRED','message','Your shift is no longer active. Return to your assigned events and start a shift.');
  end if;
  role_name:=shift.role;
  if p_action='end_shift' then
   delete from yingira.staff_shifts where user_id=u;
   insert into yingira.audit(organization_id,event_id,actor_id,action,entity_id,metadata) values(org,eid,u,'END_SHIFT',u,jsonb_build_object('role',role_name));
   return jsonb_build_object('ok',true,'data','{}'::jsonb);
  end if;
  if p_action='heartbeat_shift' then
   update yingira.staff_shifts set expires_at=clock_timestamp()+interval '90 seconds' where user_id=u;
   return jsonb_build_object('ok',true,'data',jsonb_build_object('role',role_name));
  end if;
  if p_action='supervisor_overview' then
   if role_name<>'supervisor' then raise exception 'Supervisor access required' using errcode='42501'; end if;
   return jsonb_build_object('ok',true,'data',jsonb_build_object(
    'metrics',(select jsonb_build_object('invitations',count(*),'capacity',coalesce(sum(capacity),0),'admitted',coalesce(sum(initial_count),0),'inside',coalesce(sum(inside_count),0)) from yingira.invitations where event_id=eid),
    'recent',coalesce((select jsonb_agg(to_jsonb(r)) from (select a.id,i.guest_name,a.quantity,a.kind,a.accepted_at,g.name as gate_name from yingira.attendance a join yingira.invitations i on i.id=a.invitation_id join yingira.gates g on g.id=a.gate_id where a.event_id=eid order by a.accepted_at desc limit 20) r),'[]'::jsonb)));
  end if;
 end if;
 if p_action='event' then
  return jsonb_build_object('id',eid,'title',e.title,'venue',e.venue,'startsAt',e.starts_at,'timezone',e.timezone,'status',e.status,'isAdmin',admin,'role',(select t.role from yingira.team t where t.event_id=eid and t.user_id=u and t.active),'pendingStaff',case when admin then coalesce((select jsonb_agg(jsonb_build_object('id',si.id,'email',si.email,'role',si.role)) from yingira.staff_invitations si where si.event_id=eid and si.active and si.accepted_by is null),'[]'::jsonb) else '[]'::jsonb end,
   'gates',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'name',g.name)) from yingira.gates g where g.event_id=eid and (admin or exists(select 1 from yingira.team t where t.event_id=eid and t.user_id=u and t.active and t.gate_id=g.id))),'[]'::jsonb),
   'guests',case when admin then coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'name',i.guest_name,'phone_suffix',right(i.phone,4),'capacity',i.capacity,'initial_count',i.initial_count,'table_label',i.table_label,'token_ciphertext',t.ciphertext,'revoked',t.id is null) order by i.guest_name) from yingira.invitations i left join yingira.tokens t on t.invitation_id=i.id and t.revoked_at is null where i.event_id=eid),'[]'::jsonb) else '[]'::jsonb end,
   'staff',case when admin then coalesce((select jsonb_agg(jsonb_build_object('user_id',t.user_id,'email',yingira.member_email(t.user_id),'role',t.role,'active',t.active,'on_shift',exists(select 1 from yingira.staff_shifts s where s.user_id=t.user_id and s.event_id=eid and s.expires_at>clock_timestamp()),'gate_name',g.name)) from yingira.team t join yingira.gates g on g.id=t.gate_id where t.event_id=eid),'[]'::jsonb) else '[]'::jsonb end,
   'metrics',case when admin then (select jsonb_build_object('invitations',count(*),'capacity',coalesce(sum(capacity),0),'admitted',coalesce(sum(initial_count),0),'inside',coalesce(sum(inside_count),0)) from yingira.invitations where event_id=eid) else '{}'::jsonb end,
   'recent',case when admin then coalesce((select jsonb_agg(to_jsonb(r)) from (select a.id,i.guest_name,a.quantity,a.kind,a.accepted_at,g.name as gate_name from yingira.attendance a join yingira.invitations i on i.id=a.invitation_id join yingira.gates g on g.id=a.gate_id where a.event_id=eid order by a.accepted_at desc limit 10) r),'[]'::jsonb) else '[]'::jsonb end);
 end if;
 if p_action in ('assign_staff','disable_staff','create_guest','reissue','revoke') then
  if not admin then raise exception 'Not authorized' using errcode='42501'; end if;
  if p_action='assign_staff' then
   gate:=(p_data->>'gateId')::uuid; role_name:=p_data->>'role';
   target:=yingira.confirmed_user(p_data->>'email');
   insert into yingira.staff_invitations(organization_id,event_id,email,gate_id,role,invited_by,accepted_by)
    values(org,eid,lower(trim(p_data->>'email')),gate,role_name,u,target) on conflict(event_id,email) do update set gate_id=excluded.gate_id,role=excluded.role,invited_by=u,active=true,accepted_by=excluded.accepted_by;
   if target is null then
    insert into yingira.audit(organization_id,event_id,actor_id,action,entity_id) values(org,eid,u,'INVITE_STAFF',eid);
    return jsonb_build_object('ok',true,'data',jsonb_build_object('pending',true));
   end if;
   delete from yingira.staff_shifts where user_id=target and event_id=eid;
   insert into yingira.team(organization_id,event_id,user_id,gate_id,role) values(org,eid,target,gate,role_name) on conflict(event_id,user_id) do update set gate_id=excluded.gate_id,role=excluded.role,active=true;
   iid:=target;
  elsif p_action='disable_staff' then
   target:=(p_data->>'userId')::uuid;
   update yingira.team set active=false where event_id=eid and user_id=target;
   update yingira.staff_invitations set active=false where event_id=eid and accepted_by=target;
   delete from yingira.staff_shifts where user_id=target and event_id=eid;
   iid:=target;
  elsif p_action='create_guest' then
   insert into yingira.invitations(organization_id,event_id,guest_name,phone,capacity,table_label) values(org,eid,trim(p_data->>'name'),p_data->>'phone',(p_data->>'capacity')::integer,coalesce(p_data->>'tableLabel','')) returning id into iid;
   insert into yingira.tokens(organization_id,event_id,invitation_id,digest,ciphertext) values(org,eid,iid,p_data->>'tokenHash',p_data->>'tokenCiphertext');
  else
   iid:=(p_data->>'invitationId')::uuid;
   perform 1 from yingira.invitations where id=iid and event_id=eid for update;
   if not found then raise exception 'Not authorized' using errcode='42501'; end if;
   update yingira.tokens set revoked_at=clock_timestamp() where invitation_id=iid and revoked_at is null;
   if p_action='reissue' then insert into yingira.tokens(organization_id,event_id,invitation_id,digest,ciphertext) values(org,eid,iid,p_data->>'tokenHash',p_data->>'tokenCiphertext'); end if;
  end if;
  insert into yingira.audit(organization_id,event_id,actor_id,action,entity_id) values(org,eid,u,p_action,iid);
  return jsonb_build_object('ok',true,'data',jsonb_build_object('id',iid));
 end if;
 if p_action not in ('validate','admit') then raise exception 'Unknown command'; end if;
 gate:=(p_data->>'gateId')::uuid;
 if not exists(select 1 from yingira.gates where id=gate and event_id=eid) or (not admin and not exists(select 1 from yingira.team where event_id=eid and user_id=u and active and gate_id=gate)) then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_action='admit' then
  reqkey:=(p_data->>'idempotencyKey')::uuid;
  if reqkey is null then raise exception 'Missing idempotency key'; end if;
  reqhash:=encode(extensions.digest((p_data-'leaseId')::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended(u::text||reqkey::text,0));
  select * into prior from yingira.receipts where actor_id=u and key=reqkey;
  if found then
   if prior.request_hash<>reqhash then return jsonb_build_object('ok',false,'code','IDEMPOTENCY_CONFLICT','message','This request key belongs to a different action. Scan again.'); end if;
   return prior.receipt;
  end if;
 end if;
 select * into tok from yingira.tokens where digest=encode(extensions.digest(coalesce(p_data->>'token',''),'sha256'),'hex') and event_id=eid;
 if not found then outcome:='INVALID';
 else
  select * into inv from yingira.invitations where id=tok.invitation_id for update;
  -- Re-read token AFTER invitation lock; reissue uses the same lock.
  select * into tok from yingira.tokens where id=tok.id;
  if tok.revoked_at is not null then outcome:='REVOKED';
  elsif e.status<>'active' then outcome:='EVENT_CLOSED';
  elsif p_action='admit' then
   q:=(p_data->>'quantity')::integer;
   if q is null or q<1 or q>100 or (p_data->>'quantity')::numeric<>q then outcome:='INVALID_QUANTITY';
   elsif (p_data->>'expectedVersion')::integer is distinct from inv.version then outcome:='STATE_CHANGED';
   elsif inv.initial_count+q>inv.capacity then outcome:='CAPACITY_REACHED';
   else outcome:='ACCEPTED'; end if;
  else outcome:='VALID'; end if;
 end if;
 insert into yingira.scan_attempts(organization_id,event_id,gate_id,actor_id,result) values(org,eid,gate,u,outcome);
 if outcome not in ('VALID','ACCEPTED') then
  reply:=jsonb_build_object('ok',false,'code',outcome,'message',case outcome when 'STATE_CHANGED' then 'Another scan changed this invitation. Scan again to verify the latest count.' when 'CAPACITY_REACHED' then 'Invitation capacity reached. Do not admit additional people.' when 'REVOKED' then 'This QR has been revoked. Contact the organizer.' when 'EVENT_CLOSED' then 'Check-in is not open for this event.' else 'This invitation cannot be admitted. Contact the organizer.' end);
 elsif outcome='VALID' then
  return jsonb_build_object('ok',true,'data',jsonb_build_object('guestName',inv.guest_name,'phoneSuffix',right(inv.phone,4),'capacity',inv.capacity,'initialCount',inv.initial_count,'insideCount',inv.inside_count,'remaining',inv.capacity-inv.initial_count,'version',inv.version,'tableLabel',inv.table_label));
 else
  update yingira.invitations set initial_count=initial_count+q,inside_count=inside_count+q,version=version+1 where id=inv.id returning * into inv;
  insert into yingira.attendance(organization_id,event_id,invitation_id,gate_id,actor_id,device_id,quantity) values(org,eid,inv.id,gate,u,(p_data->>'deviceId')::uuid,q) returning id,accepted_at into tid,accepted;
  insert into yingira.audit(organization_id,event_id,actor_id,action,entity_id,metadata) values(org,eid,u,'INITIAL_ENTRY',tid,jsonb_build_object('quantity',q,'gateId',gate,'invitationId',inv.id,'role',role_name,'adminSupport',admin));
  reply:=jsonb_build_object('ok',true,'data',jsonb_build_object('transactionId',tid,'acceptedAt',accepted,'quantity',q,'initialCount',inv.initial_count,'insideCount',inv.inside_count,'remaining',inv.capacity-inv.initial_count,'version',inv.version,'tableLabel',inv.table_label,'guestName',inv.guest_name));
 end if;
 if p_action='admit' then insert into yingira.receipts values(org,u,reqkey,reqhash,reply); end if;
 return reply;
end $function$;

ALTER FUNCTION "public"."yingira_command"(text, jsonb) OWNER TO "yingira_executor";

