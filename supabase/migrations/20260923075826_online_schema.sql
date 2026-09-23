SET local check_function_bodies = off;

CREATE SCHEMA "yingira";

-- Temporary ownership-transfer privileges; revoked at the end of this migration.
GRANT USAGE, CREATE ON SCHEMA public, yingira TO yingira_executor;

CREATE TABLE "yingira"."attendance" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" uuid                     NOT NULL,
  "event_id"        uuid                     NOT NULL,
  "invitation_id"   uuid                     NOT NULL,
  "gate_id"         uuid                     NOT NULL,
  "actor_id"        uuid                     NOT NULL,
  "device_id"       uuid                     NOT NULL,
  "quantity"        integer                  NOT NULL,
  "kind"            text                     NOT NULL DEFAULT 'INITIAL_ENTRY'::text,
  "accepted_at"     timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT "attendance_kind_check" CHECK ((kind = 'INITIAL_ENTRY'::text)),
  CONSTRAINT "attendance_pkey" PRIMARY KEY (id),
  CONSTRAINT "attendance_quantity_check" CHECK ((quantity > 0))
);

ALTER TABLE "yingira"."attendance"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "yingira"."attendance"
  FORCE ROW LEVEL SECURITY;

CREATE TABLE "yingira"."audit" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" uuid                     NOT NULL,
  "event_id"        uuid,
  "actor_id"        uuid                     NOT NULL,
  "action"          text                     NOT NULL,
  "entity_id"       uuid,
  "metadata"        jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "created_at"      timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT "audit_pkey" PRIMARY KEY (id)
);

ALTER TABLE "yingira"."audit"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "yingira"."audit"
  FORCE ROW LEVEL SECURITY;

CREATE TABLE "yingira"."events" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" uuid                     NOT NULL,
  "title"           text                     NOT NULL,
  "venue"           text                     NOT NULL,
  "starts_at"       timestamp with time zone NOT NULL,
  "timezone"        text                     NOT NULL DEFAULT 'Africa/Kampala'::text,
  "status"          text                     NOT NULL DEFAULT 'draft'::text,
  CONSTRAINT "events_organization_id_id_key" UNIQUE (organization_id, id),
  CONSTRAINT "events_pkey" PRIMARY KEY (id),
  CONSTRAINT "events_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'closed'::text]))),
  CONSTRAINT "events_title_check" CHECK (((length(title) >= 2) AND (length(title) <= 160))),
  CONSTRAINT "events_venue_check" CHECK (((length(venue) >= 2) AND (length(venue) <= 160)))
);

ALTER TABLE "yingira"."events"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "yingira"."events"
  FORCE ROW LEVEL SECURITY;

CREATE TABLE "yingira"."gates" (
  "id"              uuid NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL,
  "event_id"        uuid NOT NULL,
  "name"            text NOT NULL,
  CONSTRAINT "gates_organization_id_event_id_id_key" UNIQUE (organization_id, event_id, id),
  CONSTRAINT "gates_pkey" PRIMARY KEY (id)
);

ALTER TABLE "yingira"."gates"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "yingira"."gates"
  FORCE ROW LEVEL SECURITY;

CREATE TABLE "yingira"."invitations" (
  "id"              uuid    NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" uuid    NOT NULL,
  "event_id"        uuid    NOT NULL,
  "guest_name"      text    NOT NULL,
  "phone"           text    NOT NULL,
  "table_label"     text    NOT NULL DEFAULT ''::text,
  "capacity"        integer NOT NULL,
  "initial_count"   integer NOT NULL DEFAULT 0,
  "inside_count"    integer NOT NULL DEFAULT 0,
  "version"         integer NOT NULL DEFAULT 0,
  CONSTRAINT "invitations_capacity_check" CHECK (((capacity >= 1) AND (capacity <= 100))),
  CONSTRAINT "invitations_check1" CHECK (((inside_count >= 0) AND (inside_count <= initial_count))),
  CONSTRAINT "invitations_check" CHECK (((initial_count >= 0) AND (initial_count <= capacity))),
  CONSTRAINT "invitations_guest_name_check" CHECK (((length(guest_name) >= 2) AND (length(guest_name) <= 160))),
  CONSTRAINT "invitations_organization_id_event_id_id_key" UNIQUE (organization_id, event_id, id),
  CONSTRAINT "invitations_phone_check" CHECK ((phone ~ '^\+[1-9][0-9]{7,14}$'::text)),
  CONSTRAINT "invitations_pkey" PRIMARY KEY (id),
  CONSTRAINT "invitations_table_label_check" CHECK ((length(table_label) <= 60))
);

ALTER TABLE "yingira"."invitations"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "yingira"."invitations"
  FORCE ROW LEVEL SECURITY;

CREATE TABLE "yingira"."organization_members" (
  "organization_id" uuid    NOT NULL,
  "user_id"         uuid    NOT NULL,
  "active"          boolean NOT NULL DEFAULT true,
  CONSTRAINT "organization_members_pkey" PRIMARY KEY (organization_id, user_id)
);

ALTER TABLE "yingira"."organization_members"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "yingira"."organization_members"
  FORCE ROW LEVEL SECURITY;

CREATE TABLE "yingira"."organizations" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"       text                     NOT NULL,
  "active"     boolean                  NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "organizations_name_check" CHECK (((length(name) >= 2) AND (length(name) <= 160))),
  CONSTRAINT "organizations_pkey" PRIMARY KEY (id)
);

ALTER TABLE "yingira"."organizations"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "yingira"."organizations"
  FORCE ROW LEVEL SECURITY;

CREATE TABLE "yingira"."profiles" (
  "id"       uuid    NOT NULL,
  "disabled" boolean NOT NULL DEFAULT false,
  CONSTRAINT "profiles_pkey" PRIMARY KEY (id)
);

ALTER TABLE "yingira"."profiles"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "yingira"."profiles"
  FORCE ROW LEVEL SECURITY;

CREATE TABLE "yingira"."rate_buckets" (
  "key"          text                     NOT NULL,
  "window_start" timestamp with time zone NOT NULL,
  "count"        integer                  NOT NULL,
  CONSTRAINT "rate_buckets_count_check" CHECK ((count > 0)),
  CONSTRAINT "rate_buckets_pkey" PRIMARY KEY (key)
);

ALTER TABLE "yingira"."rate_buckets"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "yingira"."rate_buckets"
  FORCE ROW LEVEL SECURITY;

CREATE TABLE "yingira"."receipts" (
  "organization_id" uuid  NOT NULL,
  "actor_id"        uuid  NOT NULL,
  "key"             uuid  NOT NULL,
  "request_hash"    text  NOT NULL,
  "receipt"         jsonb NOT NULL,
  CONSTRAINT "receipts_pkey" PRIMARY KEY (actor_id, key)
);

ALTER TABLE "yingira"."receipts"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "yingira"."receipts"
  FORCE ROW LEVEL SECURITY;

CREATE TABLE "yingira"."scan_attempts" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" uuid                     NOT NULL,
  "event_id"        uuid                     NOT NULL,
  "gate_id"         uuid                     NOT NULL,
  "actor_id"        uuid                     NOT NULL,
  "result"          text                     NOT NULL,
  "created_at"      timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT "scan_attempts_pkey" PRIMARY KEY (id)
);

ALTER TABLE "yingira"."scan_attempts"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "yingira"."scan_attempts"
  FORCE ROW LEVEL SECURITY;

CREATE TABLE "yingira"."team" (
  "organization_id" uuid    NOT NULL,
  "event_id"        uuid    NOT NULL,
  "user_id"         uuid    NOT NULL,
  "gate_id"         uuid    NOT NULL,
  "role"            text    NOT NULL,
  "active"          boolean NOT NULL DEFAULT true,
  CONSTRAINT "team_pkey" PRIMARY KEY (event_id, user_id),
  CONSTRAINT "team_role_check" CHECK ((role = ANY (ARRAY['usher'::text, 'supervisor'::text])))
);

ALTER TABLE "yingira"."team"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "yingira"."team"
  FORCE ROW LEVEL SECURITY;

CREATE TABLE "yingira"."tokens" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" uuid                     NOT NULL,
  "event_id"        uuid                     NOT NULL,
  "invitation_id"   uuid                     NOT NULL,
  "digest"          text                     NOT NULL,
  "ciphertext"      text                     NOT NULL,
  "revoked_at"      timestamp with time zone,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "tokens_ciphertext_check" CHECK (((length(ciphertext) >= 50) AND (length(ciphertext) <= 300))),
  CONSTRAINT "tokens_digest_check" CHECK ((digest ~ '^[0-9a-f]{64}$'::text)),
  CONSTRAINT "tokens_digest_key" UNIQUE (digest),
  CONSTRAINT "tokens_pkey" PRIMARY KEY (id)
);

ALTER TABLE "yingira"."tokens"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "yingira"."tokens"
  FORCE ROW LEVEL SECURITY;

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
 outcome text; reply jsonb; rows jsonb; q integer; reqkey uuid; reqhash text; tid uuid; accepted timestamptz; role_name text;
begin
 insert into yingira.profiles(id) values(u) on conflict do nothing;
 perform 1 from yingira.profiles where id=u and not disabled for share;
 if not found then raise exception 'Not authorized' using errcode='42501'; end if;
 if not yingira.check_rate('actor:'||u,240) then return jsonb_build_object('ok',false,'code','RATE_LIMITED','message','Too many requests. Wait a minute and try again.'); end if;

 if p_action='create_organization' then
  insert into yingira.organizations(name) values(trim(p_data->>'name')) returning id into org;
  insert into yingira.organization_members values(org,u,true);
  insert into yingira.audit(organization_id,actor_id,action,entity_id) values(org,u,p_action,org);
  return jsonb_build_object('ok',true,'data',jsonb_build_object('id',org));
 end if;
 if p_action='dashboard' then
  return jsonb_build_object('organizations',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name)) from yingira.organizations o join yingira.organization_members m on m.organization_id=o.id where m.user_id=u and m.active and o.active),'[]'::jsonb),
  'events',coalesce((select jsonb_agg(jsonb_build_object('id',ev.id,'title',ev.title,'venue',ev.venue,'starts_at',ev.starts_at,'status',ev.status,'organization_id',ev.organization_id,'is_admin',exists(select 1 from yingira.organization_members m where m.organization_id=ev.organization_id and m.user_id=u and m.active)) order by ev.starts_at) from yingira.events ev join yingira.organizations o on o.id=ev.organization_id where o.active and (exists(select 1 from yingira.organization_members m where m.organization_id=o.id and m.user_id=u and m.active) or exists(select 1 from yingira.team t where t.event_id=ev.id and t.user_id=u and t.active))),'[]'::jsonb));
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
 if p_action='event' then
  return jsonb_build_object('id',eid,'title',e.title,'venue',e.venue,'startsAt',e.starts_at,'timezone',e.timezone,'status',e.status,'isAdmin',admin,
   'gates',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'name',g.name)) from yingira.gates g where g.event_id=eid and (admin or exists(select 1 from yingira.team t where t.event_id=eid and t.user_id=u and t.active and t.gate_id=g.id))),'[]'::jsonb),
   'guests',case when admin then coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'name',i.guest_name,'phone_suffix',right(i.phone,4),'capacity',i.capacity,'initial_count',i.initial_count,'table_label',i.table_label,'token_ciphertext',t.ciphertext,'revoked',t.id is null) order by i.guest_name) from yingira.invitations i left join yingira.tokens t on t.invitation_id=i.id and t.revoked_at is null where i.event_id=eid),'[]'::jsonb) else '[]'::jsonb end,
   'staff',case when admin then coalesce((select jsonb_agg(jsonb_build_object('user_id',t.user_id,'email',yingira.member_email(t.user_id),'role',t.role,'active',t.active,'gate_name',g.name)) from yingira.team t join yingira.gates g on g.id=t.gate_id where t.event_id=eid),'[]'::jsonb) else '[]'::jsonb end,
   'metrics',case when admin then (select jsonb_build_object('invitations',count(*),'capacity',coalesce(sum(capacity),0),'admitted',coalesce(sum(initial_count),0),'inside',coalesce(sum(inside_count),0)) from yingira.invitations where event_id=eid) else '{}'::jsonb end,
   'recent',case when admin then coalesce((select jsonb_agg(to_jsonb(r)) from (select a.id,i.guest_name,a.quantity,a.accepted_at,g.name as gate_name from yingira.attendance a join yingira.invitations i on i.id=a.invitation_id join yingira.gates g on g.id=a.gate_id where a.event_id=eid order by a.accepted_at desc limit 10) r),'[]'::jsonb) else '[]'::jsonb end);
 end if;
 if p_action in ('assign_staff','disable_staff','create_guest','reissue','revoke') then
  if not admin then raise exception 'Not authorized' using errcode='42501'; end if;
  if p_action='assign_staff' then
   gate:=(p_data->>'gateId')::uuid; role_name:=p_data->>'role';
   target:=yingira.confirmed_user(p_data->>'email');
   if target is null then return jsonb_build_object('ok',false,'code','ACCOUNT_REQUIRED','message','This person must register and confirm their email before assignment.'); end if;
   insert into yingira.team(organization_id,event_id,user_id,gate_id,role) values(org,eid,target,gate,role_name) on conflict(event_id,user_id) do update set gate_id=excluded.gate_id,role=excluded.role,active=true;
   iid:=target;
  elsif p_action='disable_staff' then
   target:=(p_data->>'userId')::uuid;
   update yingira.team set active=false where event_id=eid and user_id=target;
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
  reqhash:=encode(extensions.digest(p_data::text,'sha256'),'hex');
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
  insert into yingira.audit(organization_id,event_id,actor_id,action,entity_id,metadata) values(org,eid,u,'INITIAL_ENTRY',tid,jsonb_build_object('quantity',q,'gateId',gate,'invitationId',inv.id));
  reply:=jsonb_build_object('ok',true,'data',jsonb_build_object('transactionId',tid,'acceptedAt',accepted,'quantity',q,'initialCount',inv.initial_count,'insideCount',inv.inside_count,'remaining',inv.capacity-inv.initial_count,'version',inv.version,'tableLabel',inv.table_label,'guestName',inv.guest_name));
 end if;
 if p_action='admit' then insert into yingira.receipts values(org,u,reqkey,reqhash,reply); end if;
 return reply;
end $function$;

ALTER FUNCTION "public"."yingira_command"(text, jsonb) OWNER TO "yingira_executor";

CREATE OR REPLACE FUNCTION public.yingira_public_invitation (
  p_token text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare result jsonb; begin
 if p_token !~ '^[A-Za-z0-9_-]{43}$' then return null; end if;
 select jsonb_build_object('guestName',i.guest_name,'title',e.title,'venue',e.venue,'startsAt',e.starts_at,'timezone',e.timezone,'capacity',i.capacity,'tableLabel',i.table_label) into result
 from yingira.tokens t join yingira.invitations i on i.id=t.invitation_id join yingira.events e on e.id=i.event_id join yingira.organizations o on o.id=e.organization_id
 where t.digest=encode(extensions.digest(p_token,'sha256'),'hex') and t.revoked_at is null and o.active and e.status<>'closed';
 return result;
end $function$;

ALTER FUNCTION "public"."yingira_public_invitation"(text) OWNER TO "yingira_executor";

CREATE OR REPLACE FUNCTION yingira.actor_id()
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare u uuid:=auth.uid(); begin
 if u is null or not exists(select 1 from auth.users where id=u and email_confirmed_at is not null and (banned_until is null or banned_until<now()))
 or not exists(select 1 from auth.sessions where id=nullif(auth.jwt()->>'session_id','')::uuid and user_id=u)
 then raise exception 'Not authorized' using errcode='42501'; end if;
 return u;
end $function$;

CREATE OR REPLACE FUNCTION yingira.check_rate (
  p_key   text,
  p_limit integer
)
  RETURNS boolean
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare n integer; begin
 insert into yingira.rate_buckets(key,window_start,count) values(p_key,date_trunc('minute',clock_timestamp()),1)
 on conflict(key) do update set count=case when yingira.rate_buckets.window_start=excluded.window_start then yingira.rate_buckets.count+1 else 1 end,window_start=excluded.window_start returning count into n;
 return n<=p_limit;
end $function$;

ALTER FUNCTION "yingira"."check_rate"(text, integer) OWNER TO "yingira_executor";

CREATE OR REPLACE FUNCTION yingira.confirmed_user (
  p_email text
)
  RETURNS uuid
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$ select id from auth.users where lower(email)=lower(p_email) and email_confirmed_at is not null $function$;

CREATE OR REPLACE FUNCTION yingira.immutable()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$ begin raise exception 'Append-only history'; end $function$;

CREATE OR REPLACE FUNCTION yingira.member_email (
  p_id uuid
)
  RETURNS text
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$ select email from auth.users where id=p_id $function$;

ALTER TABLE "yingira"."attendance"
  ADD CONSTRAINT "attendance_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES auth.users(id);

ALTER TABLE "yingira"."audit"
  ADD CONSTRAINT "audit_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES auth.users(id);

ALTER TABLE "yingira"."audit"
  ADD CONSTRAINT "audit_organization_id_event_id_fkey" FOREIGN KEY (organization_id, event_id) REFERENCES yingira.events(organization_id, id);

ALTER TABLE "yingira"."gates"
  ADD CONSTRAINT "gates_organization_id_event_id_fkey" FOREIGN KEY (organization_id, event_id) REFERENCES yingira.events(organization_id, id);

ALTER TABLE "yingira"."attendance"
  ADD CONSTRAINT "attendance_organization_id_event_id_gate_id_fkey" FOREIGN KEY (organization_id, event_id, gate_id) REFERENCES yingira.gates(organization_id, event_id, id);

ALTER TABLE "yingira"."invitations"
  ADD CONSTRAINT "invitations_organization_id_event_id_fkey" FOREIGN KEY (organization_id, event_id) REFERENCES yingira.events(organization_id, id);

ALTER TABLE "yingira"."attendance"
  ADD CONSTRAINT "attendance_organization_id_event_id_invitation_id_fkey" FOREIGN KEY (organization_id, event_id, invitation_id)
    REFERENCES yingira.invitations(organization_id, event_id, id);

ALTER TABLE "yingira"."organization_members"
  ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE "yingira"."audit"
  ADD CONSTRAINT "audit_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES yingira.organizations(id);

ALTER TABLE "yingira"."events"
  ADD CONSTRAINT "events_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES yingira.organizations(id);

ALTER TABLE "yingira"."organization_members"
  ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES yingira.organizations(id);

ALTER TABLE "yingira"."profiles"
  ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id);

ALTER TABLE "yingira"."receipts"
  ADD CONSTRAINT "receipts_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES auth.users(id);

ALTER TABLE "yingira"."receipts"
  ADD CONSTRAINT "receipts_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES yingira.organizations(id);

ALTER TABLE "yingira"."scan_attempts"
  ADD CONSTRAINT "scan_attempts_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES auth.users(id);

ALTER TABLE "yingira"."scan_attempts"
  ADD CONSTRAINT "scan_attempts_organization_id_event_id_gate_id_fkey" FOREIGN KEY (organization_id, event_id, gate_id) REFERENCES yingira.gates(organization_id, event_id, id);

ALTER TABLE "yingira"."team"
  ADD CONSTRAINT "team_organization_id_event_id_gate_id_fkey" FOREIGN KEY (organization_id, event_id, gate_id) REFERENCES yingira.gates(organization_id, event_id, id);

ALTER TABLE "yingira"."team"
  ADD CONSTRAINT "team_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE "yingira"."tokens"
  ADD CONSTRAINT "tokens_organization_id_event_id_invitation_id_fkey" FOREIGN KEY (organization_id, event_id, invitation_id)
    REFERENCES yingira.invitations(organization_id, event_id, id);

CREATE INDEX attendance_event_time ON yingira.attendance USING btree (event_id, accepted_at DESC);

CREATE INDEX invitations_event ON yingira.invitations USING btree (event_id);

CREATE UNIQUE INDEX one_active_token ON yingira.tokens USING btree (invitation_id)
  WHERE (revoked_at IS NULL);

CREATE INDEX org_members_user ON yingira.organization_members USING btree (user_id);

CREATE INDEX team_user ON yingira.team USING btree (user_id, event_id);

CREATE TRIGGER attendance_immutable
  BEFORE DELETE OR UPDATE ON yingira.attendance
  FOR EACH ROW
  EXECUTE FUNCTION yingira.immutable();

CREATE TRIGGER audit_immutable
  BEFORE DELETE OR UPDATE ON yingira.audit
  FOR EACH ROW
  EXECUTE FUNCTION yingira.immutable();

CREATE POLICY "command_owner" ON "yingira"."attendance"
  FOR ALL
  TO "yingira_executor"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "command_owner" ON "yingira"."audit"
  FOR ALL
  TO "yingira_executor"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "command_owner" ON "yingira"."events"
  FOR ALL
  TO "yingira_executor"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "command_owner" ON "yingira"."gates"
  FOR ALL
  TO "yingira_executor"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "command_owner" ON "yingira"."invitations"
  FOR ALL
  TO "yingira_executor"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "command_owner" ON "yingira"."organization_members"
  FOR ALL
  TO "yingira_executor"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "command_owner" ON "yingira"."organizations"
  FOR ALL
  TO "yingira_executor"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "command_owner" ON "yingira"."profiles"
  FOR ALL
  TO "yingira_executor"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "command_owner" ON "yingira"."rate_buckets"
  FOR ALL
  TO "yingira_executor"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "command_owner" ON "yingira"."receipts"
  FOR ALL
  TO "yingira_executor"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "command_owner" ON "yingira"."scan_attempts"
  FOR ALL
  TO "yingira_executor"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "command_owner" ON "yingira"."team"
  FOR ALL
  TO "yingira_executor"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "command_owner" ON "yingira"."tokens"
  FOR ALL
  TO "yingira_executor"
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON FUNCTION "public"."yingira_command"(text, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."yingira_command"(text, jsonb) TO "authenticated", "service_role";

REVOKE ALL ON FUNCTION "public"."yingira_command"(text, jsonb) FROM "yingira_executor";

GRANT EXECUTE ON FUNCTION "public"."yingira_command"(text, jsonb) TO "yingira_executor";

REVOKE ALL ON FUNCTION "public"."yingira_public_invitation"(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."yingira_public_invitation"(text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."yingira_public_invitation"(text) FROM "yingira_executor";

GRANT EXECUTE ON FUNCTION "public"."yingira_public_invitation"(text) TO "yingira_executor";

REVOKE ALL ON FUNCTION "yingira"."actor_id"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "yingira"."actor_id"() TO "postgres", "yingira_executor";

REVOKE ALL ON FUNCTION "yingira"."check_rate"(text, integer) FROM PUBLIC;

REVOKE ALL ON FUNCTION "yingira"."confirmed_user"(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "yingira"."confirmed_user"(text) TO "postgres", "yingira_executor";

REVOKE ALL ON FUNCTION "yingira"."immutable"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "yingira"."immutable"() TO "postgres";

REVOKE ALL ON FUNCTION "yingira"."member_email"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "yingira"."member_email"(uuid) TO "postgres", "yingira_executor";

REVOKE ALL ON SCHEMA "public" FROM "yingira_executor";

GRANT USAGE ON SCHEMA "public" TO "yingira_executor";

GRANT CREATE, USAGE ON SCHEMA "yingira" TO "postgres";

GRANT USAGE ON SCHEMA "yingira" TO "yingira_executor";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "yingira"."attendance" TO "postgres";

GRANT INSERT, SELECT ON TABLE "yingira"."attendance" TO "yingira_executor";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "yingira"."audit" TO "postgres";

GRANT INSERT, SELECT ON TABLE "yingira"."audit" TO "yingira_executor";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "yingira"."events" TO "postgres";

GRANT INSERT, SELECT, UPDATE ON TABLE "yingira"."events" TO "yingira_executor";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "yingira"."gates" TO "postgres";

GRANT INSERT, SELECT, UPDATE ON TABLE "yingira"."gates" TO "yingira_executor";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "yingira"."invitations" TO "postgres";

GRANT INSERT, SELECT, UPDATE ON TABLE "yingira"."invitations" TO "yingira_executor";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "yingira"."organization_members" TO "postgres";

GRANT INSERT, SELECT, UPDATE ON TABLE "yingira"."organization_members" TO "yingira_executor";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "yingira"."organizations" TO "postgres";

GRANT INSERT, SELECT, UPDATE ON TABLE "yingira"."organizations" TO "yingira_executor";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "yingira"."profiles" TO "postgres";

GRANT INSERT, SELECT, UPDATE ON TABLE "yingira"."profiles" TO "yingira_executor";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "yingira"."rate_buckets" TO "postgres";

GRANT INSERT, SELECT, UPDATE ON TABLE "yingira"."rate_buckets" TO "yingira_executor";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "yingira"."receipts" TO "postgres";

GRANT INSERT, SELECT ON TABLE "yingira"."receipts" TO "yingira_executor";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "yingira"."scan_attempts" TO "postgres";

GRANT INSERT, SELECT ON TABLE "yingira"."scan_attempts" TO "yingira_executor";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "yingira"."team" TO "postgres";

GRANT INSERT, SELECT, UPDATE ON TABLE "yingira"."team" TO "yingira_executor";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "yingira"."tokens" TO "postgres";

GRANT INSERT, SELECT, UPDATE ON TABLE "yingira"."tokens" TO "yingira_executor";


-- Explicit grants protect against different Supabase project default privileges.
REVOKE CREATE ON SCHEMA public, yingira FROM yingira_executor;
REVOKE ALL ON SCHEMA yingira FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA yingira FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA yingira FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.yingira_command(text,jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.yingira_command(text,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.yingira_public_invitation(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.yingira_public_invitation(text) TO service_role;
