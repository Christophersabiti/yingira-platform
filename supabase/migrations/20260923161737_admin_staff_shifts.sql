-- Organization administration and account-wide operational shifts.
CREATE TABLE yingira.admin_onboarding (email text PRIMARY KEY CHECK(email=lower(trim(email))));
CREATE TABLE yingira.staff_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, event_id uuid NOT NULL,
 email text NOT NULL CHECK(email=lower(trim(email)) AND length(email)<=254 AND position('@' in email)>1),
 gate_id uuid NOT NULL, role text NOT NULL CHECK(role IN ('supervisor','usher')),
 invited_by uuid NOT NULL REFERENCES auth.users(id), active boolean NOT NULL DEFAULT true,
 accepted_by uuid REFERENCES auth.users(id), UNIQUE(event_id,email),
 FOREIGN KEY(organization_id,event_id,gate_id) REFERENCES yingira.gates(organization_id,event_id,id)
);
CREATE TABLE yingira.staff_shifts (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id), organization_id uuid NOT NULL, event_id uuid NOT NULL,
 auth_session_id uuid NOT NULL, lease_id uuid NOT NULL, role text NOT NULL CHECK(role IN ('supervisor','usher')),
 expires_at timestamptz NOT NULL,
 FOREIGN KEY(organization_id,event_id) REFERENCES yingira.events(organization_id,id)
);
CREATE INDEX staff_invitation_email ON yingira.staff_invitations(email) WHERE active AND accepted_by IS NULL;
CREATE INDEX staff_shift_event ON yingira.staff_shifts(event_id);
ALTER TABLE yingira.admin_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE yingira.admin_onboarding FORCE ROW LEVEL SECURITY;
REVOKE ALL ON yingira.admin_onboarding FROM PUBLIC,anon,authenticated;
CREATE POLICY command_owner ON yingira.admin_onboarding TO yingira_executor USING(true) WITH CHECK(true);
GRANT SELECT,INSERT,UPDATE,DELETE ON yingira.admin_onboarding TO yingira_executor;
ALTER TABLE yingira.staff_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE yingira.staff_invitations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON yingira.staff_invitations FROM PUBLIC,anon,authenticated;
CREATE POLICY command_owner ON yingira.staff_invitations TO yingira_executor USING(true) WITH CHECK(true);
GRANT SELECT,INSERT,UPDATE,DELETE ON yingira.staff_invitations TO yingira_executor;
ALTER TABLE yingira.staff_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE yingira.staff_shifts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON yingira.staff_shifts FROM PUBLIC,anon,authenticated;
CREATE POLICY command_owner ON yingira.staff_shifts TO yingira_executor USING(true) WITH CHECK(true);
GRANT SELECT,INSERT,UPDATE,DELETE ON yingira.staff_shifts TO yingira_executor;

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
    'recent',coalesce((select jsonb_agg(to_jsonb(r)) from (select a.id,i.guest_name,a.quantity,a.accepted_at,g.name as gate_name from yingira.attendance a join yingira.invitations i on i.id=a.invitation_id join yingira.gates g on g.id=a.gate_id where a.event_id=eid order by a.accepted_at desc limit 20) r),'[]'::jsonb)));
  end if;
 end if;
 if p_action='event' then
  return jsonb_build_object('id',eid,'title',e.title,'venue',e.venue,'startsAt',e.starts_at,'timezone',e.timezone,'status',e.status,'isAdmin',admin,'role',(select t.role from yingira.team t where t.event_id=eid and t.user_id=u and t.active),'pendingStaff',case when admin then coalesce((select jsonb_agg(jsonb_build_object('id',si.id,'email',si.email,'role',si.role)) from yingira.staff_invitations si where si.event_id=eid and si.active and si.accepted_by is null),'[]'::jsonb) else '[]'::jsonb end,
   'gates',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'name',g.name)) from yingira.gates g where g.event_id=eid and (admin or exists(select 1 from yingira.team t where t.event_id=eid and t.user_id=u and t.active and t.gate_id=g.id))),'[]'::jsonb),
   'guests',case when admin then coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'name',i.guest_name,'phone_suffix',right(i.phone,4),'capacity',i.capacity,'initial_count',i.initial_count,'table_label',i.table_label,'token_ciphertext',t.ciphertext,'revoked',t.id is null) order by i.guest_name) from yingira.invitations i left join yingira.tokens t on t.invitation_id=i.id and t.revoked_at is null where i.event_id=eid),'[]'::jsonb) else '[]'::jsonb end,
   'staff',case when admin then coalesce((select jsonb_agg(jsonb_build_object('user_id',t.user_id,'email',yingira.member_email(t.user_id),'role',t.role,'active',t.active,'on_shift',exists(select 1 from yingira.staff_shifts s where s.user_id=t.user_id and s.event_id=eid and s.expires_at>clock_timestamp()),'gate_name',g.name)) from yingira.team t join yingira.gates g on g.id=t.gate_id where t.event_id=eid),'[]'::jsonb) else '[]'::jsonb end,
   'metrics',case when admin then (select jsonb_build_object('invitations',count(*),'capacity',coalesce(sum(capacity),0),'admitted',coalesce(sum(initial_count),0),'inside',coalesce(sum(inside_count),0)) from yingira.invitations where event_id=eid) else '{}'::jsonb end,
   'recent',case when admin then coalesce((select jsonb_agg(to_jsonb(r)) from (select a.id,i.guest_name,a.quantity,a.accepted_at,g.name as gate_name from yingira.attendance a join yingira.invitations i on i.id=a.invitation_id join yingira.gates g on g.id=a.gate_id where a.event_id=eid order by a.accepted_at desc limit 10) r),'[]'::jsonb) else '[]'::jsonb end);
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

-- Operator-only onboarding: permits a verified email to create its own organization.
-- This never grants access to an existing organization.
CREATE FUNCTION public.yingira_authorize_organization_creator(p_email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_email IS NULL OR length(trim(p_email))>254 OR position('@' in p_email)<2 THEN RAISE EXCEPTION 'Invalid email'; END IF;
 INSERT INTO yingira.admin_onboarding(email) VALUES(lower(trim(p_email))) ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.yingira_authorize_organization_creator(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.yingira_authorize_organization_creator(text) TO service_role;
