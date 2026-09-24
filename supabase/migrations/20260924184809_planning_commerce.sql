-- Planning and financial data stay private. All amounts are integer currency minor units.
CREATE TABLE yingira.plan_settings(event_id uuid PRIMARY KEY REFERENCES yingira.events(id),currency text NOT NULL DEFAULT 'UGX' CHECK(currency IN('UGX','USD','KES','TZS','RWF','EUR','GBP')),budget bigint NOT NULL DEFAULT 0 CHECK(budget BETWEEN 0 AND 1000000000000),client_name text NOT NULL DEFAULT '' CHECK(length(client_name)<=160),client_email text NOT NULL DEFAULT '' CHECK(length(client_email)<=254),version integer NOT NULL DEFAULT 0);
CREATE TABLE yingira.plan_tasks(id uuid PRIMARY KEY,event_id uuid NOT NULL REFERENCES yingira.events(id),title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 160),owner text NOT NULL CHECK(length(owner)<=160),due date,status text NOT NULL CHECK(status IN('todo','in_progress','done','cancelled')),notes text NOT NULL CHECK(length(notes)<=2000),version integer NOT NULL DEFAULT 1);
CREATE INDEX plan_tasks_event ON yingira.plan_tasks(event_id);
CREATE TABLE yingira.plan_suppliers(id uuid PRIMARY KEY,event_id uuid NOT NULL REFERENCES yingira.events(id),name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 160),category text NOT NULL CHECK(length(category)<=80),contact text NOT NULL CHECK(length(contact)<=160),email text NOT NULL CHECK(length(email)<=254),phone text NOT NULL CHECK(length(phone)<=40),notes text NOT NULL CHECK(length(notes)<=2000),version integer NOT NULL DEFAULT 1,UNIQUE(event_id,id));
CREATE TABLE yingira.plan_programme(id uuid PRIMARY KEY,event_id uuid NOT NULL REFERENCES yingira.events(id),title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 160),starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,location text NOT NULL CHECK(length(location)<=160),owner text NOT NULL CHECK(length(owner)<=160),supplier_id uuid,notes text NOT NULL CHECK(length(notes)<=2000),version integer NOT NULL DEFAULT 1,CHECK(ends_at>starts_at),FOREIGN KEY(event_id,supplier_id) REFERENCES yingira.plan_suppliers(event_id,id));
CREATE INDEX plan_programme_event ON yingira.plan_programme(event_id,starts_at);
CREATE TABLE yingira.plan_costs(id uuid PRIMARY KEY,event_id uuid NOT NULL REFERENCES yingira.events(id),title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 160),supplier_id uuid,planned bigint NOT NULL CHECK(planned BETWEEN 0 AND 1000000000000),quoted bigint NOT NULL CHECK(quoted BETWEEN 0 AND 1000000000000),committed bigint NOT NULL CHECK(committed BETWEEN 0 AND 1000000000000),deposit bigint NOT NULL CHECK(deposit>=0 AND deposit<=committed),due date,notes text NOT NULL CHECK(length(notes)<=2000),version integer NOT NULL DEFAULT 1,FOREIGN KEY(event_id,supplier_id) REFERENCES yingira.plan_suppliers(event_id,id),UNIQUE(event_id,id));
CREATE TABLE yingira.brand_profiles(organization_id uuid PRIMARY KEY REFERENCES yingira.organizations(id),name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 160),tagline text NOT NULL DEFAULT '' CHECK(length(tagline)<=160),color text NOT NULL DEFAULT '#315b40' CHECK(color ~ '^#[0-9A-Fa-f]{6}$'),logo_asset_id uuid,logo_event_id uuid,email text NOT NULL DEFAULT '' CHECK(length(email)<=254),phone text NOT NULL DEFAULT '' CHECK(length(phone)<=40),version integer NOT NULL DEFAULT 0,CHECK((logo_asset_id IS NULL)=(logo_event_id IS NULL)),FOREIGN KEY(organization_id,logo_event_id) REFERENCES yingira.events(organization_id,id));
CREATE TABLE yingira.service_packages(id uuid PRIMARY KEY,organization_id uuid NOT NULL REFERENCES yingira.organizations(id),name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 160),description text NOT NULL CHECK(length(description)<=2000),currency text NOT NULL CHECK(currency IN('UGX','USD','KES','TZS','RWF','EUR','GBP')),lines jsonb NOT NULL,active boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1);
CREATE INDEX service_package_org ON yingira.service_packages(organization_id);
CREATE TABLE yingira.client_invoices(id uuid PRIMARY KEY,event_id uuid NOT NULL REFERENCES yingira.events(id),number text UNIQUE,client_name text NOT NULL CHECK(length(trim(client_name)) BETWEEN 1 AND 160),client_email text NOT NULL CHECK(length(client_email)<=254),due date,lines jsonb NOT NULL,notes text NOT NULL CHECK(length(notes)<=2000),status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','issued','void')),total bigint NOT NULL CHECK(total BETWEEN 0 AND 1000000000000),version integer NOT NULL DEFAULT 1,issued_at timestamptz,brand jsonb,UNIQUE(event_id,id));
CREATE TABLE yingira.plan_payments(id uuid PRIMARY KEY,event_id uuid NOT NULL REFERENCES yingira.events(id),target_kind text NOT NULL CHECK(target_kind IN('supplier','client')),cost_id uuid,invoice_id uuid,amount bigint NOT NULL CHECK(amount<>0 AND amount BETWEEN -1000000000000 AND 1000000000000),paid_on date NOT NULL,method text NOT NULL CHECK(method IN('bank','mobile_money','cash','other','pesapal')),reference text NOT NULL CHECK(length(trim(reference)) BETWEEN 1 AND 160),notes text NOT NULL CHECK(length(notes)<=500),reversal_of uuid UNIQUE REFERENCES yingira.plan_payments(id),created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),CHECK((target_kind='supplier' AND cost_id IS NOT NULL AND invoice_id IS NULL) OR (target_kind='client' AND invoice_id IS NOT NULL AND cost_id IS NULL)),CHECK((amount>0 AND reversal_of IS NULL) OR (amount<0 AND reversal_of IS NOT NULL)),FOREIGN KEY(event_id,cost_id) REFERENCES yingira.plan_costs(event_id,id),FOREIGN KEY(event_id,invoice_id) REFERENCES yingira.client_invoices(event_id,id));
CREATE INDEX plan_payment_event ON yingira.plan_payments(event_id);
CREATE INDEX plan_payment_cost ON yingira.plan_payments(cost_id);
CREATE INDEX plan_payment_invoice ON yingira.plan_payments(invoice_id);
CREATE TRIGGER immutable_plan_payments BEFORE UPDATE OR DELETE ON yingira.plan_payments FOR EACH ROW EXECUTE FUNCTION yingira.immutable();
CREATE TABLE yingira.client_approvals(id uuid PRIMARY KEY,event_id uuid NOT NULL REFERENCES yingira.events(id),title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 160),client_name text NOT NULL CHECK(length(trim(client_name)) BETWEEN 1 AND 160),kind text NOT NULL CHECK(kind IN('budget','programme','invoice','custom')),snapshot jsonb NOT NULL,digest text NOT NULL UNIQUE CHECK(digest ~ '^[a-f0-9]{64}$'),ciphertext text NOT NULL CHECK(length(ciphertext)<=1000),expires_at timestamptz NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','changes_requested','revoked')),created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),decided_at timestamptz,signer text CHECK(length(signer) BETWEEN 2 AND 160),comment text CHECK(length(comment)<=2000),decision_key uuid,decision_hash text);
CREATE INDEX client_approval_event ON yingira.client_approvals(event_id);
CREATE TABLE yingira.plan_mutations(actor_id uuid NOT NULL,request_id uuid NOT NULL,event_id uuid NOT NULL REFERENCES yingira.events(id),digest text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(actor_id,request_id));
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['plan_settings','plan_tasks','plan_suppliers','plan_programme','plan_costs','brand_profiles','service_packages','client_invoices','plan_payments','client_approvals','plan_mutations'] LOOP
 EXECUTE format('ALTER TABLE yingira.%I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('ALTER TABLE yingira.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON yingira.%I FROM PUBLIC,anon,authenticated',t); EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON yingira.%I TO yingira_executor',t);
 EXECUTE format('CREATE POLICY executor_only ON yingira.%I TO yingira_executor USING(true) WITH CHECK(true)',t);
END LOOP; END $$;
CREATE FUNCTION yingira.invoice_total(lines jsonb) RETURNS bigint LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE line jsonb; total bigint:=0; q bigint; a bigint;
BEGIN
 IF jsonb_typeof(lines) IS DISTINCT FROM 'array' OR jsonb_array_length(lines) NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Add between 1 and 50 invoice lines'; END IF;
 FOR line IN SELECT value FROM jsonb_array_elements(lines) LOOP
  IF coalesce(length(trim(line->>'description')),0) NOT BETWEEN 1 AND 160 OR coalesce(line->>'quantity','') !~ '^[0-9]+$' OR coalesce(line->>'unitAmount','') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'Invalid invoice line'; END IF;
  q:=(line->>'quantity')::bigint; a:=(line->>'unitAmount')::bigint;
  IF q NOT BETWEEN 1 AND 10000 OR a NOT BETWEEN 0 AND 1000000000000 THEN RAISE EXCEPTION 'Invalid line amount'; END IF;
  total:=total+q*a; IF total>1000000000000 THEN RAISE EXCEPTION 'Invoice total is too large'; END IF;
 END LOOP; RETURN total;
END $$;
REVOKE ALL ON FUNCTION yingira.invoice_total(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION yingira.invoice_total(jsonb) TO yingira_executor;
-- Freeze issued invoice details and every approval snapshot, even for future writers.
CREATE FUNCTION yingira.protect_plan_documents() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_TABLE_NAME='client_approvals' THEN
  IF (to_jsonb(NEW)-ARRAY['status','decided_at','signer','comment','decision_key','decision_hash']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','decided_at','signer','comment','decision_key','decision_hash']) OR (OLD.status<>'pending' AND NEW IS DISTINCT FROM OLD) THEN RAISE EXCEPTION 'Approval snapshot and decisions are immutable'; END IF;
 ELSIF OLD.status<>'draft' AND (to_jsonb(NEW)-ARRAY['status','version']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','version']) THEN RAISE EXCEPTION 'Issued invoice details are immutable';
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER protect_approval BEFORE UPDATE ON yingira.client_approvals FOR EACH ROW EXECUTE FUNCTION yingira.protect_plan_documents();
CREATE TRIGGER protect_invoice BEFORE UPDATE ON yingira.client_invoices FOR EACH ROW EXECUTE FUNCTION yingira.protect_plan_documents();

CREATE FUNCTION public.yingira_commerce(p_action text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=yingira.actor_id(); eid uuid:=(p_data->>'eventId')::uuid; ev yingira.events%rowtype; cfg yingira.plan_settings%rowtype; org uuid; rid uuid:=(p_data->>'requestId')::uuid; item uuid:=(p_data->>'id')::uuid; expected integer:=(p_data->>'expectedVersion')::integer; sig text; prior yingira.plan_mutations%rowtype; result jsonb:='{}'; v integer; paid bigint; amount_total bigint; inv yingira.client_invoices%rowtype; payment yingira.plan_payments%rowtype; brand_json jsonb; snapshot jsonb; other uuid; target uuid:=(p_data->>'targetId')::uuid;
BEGIN
 IF octet_length(p_data::text)>150000 THEN RAISE EXCEPTION 'Request is too large'; END IF;
 PERFORM 1 FROM yingira.profiles WHERE id=u AND NOT disabled FOR SHARE; IF NOT FOUND THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 SELECT * INTO ev FROM yingira.events WHERE id=eid FOR UPDATE;
 org:=ev.organization_id;
 PERFORM 1 FROM yingira.organizations WHERE id=org AND active FOR SHARE; IF NOT FOUND THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM yingira.organization_members WHERE organization_id=org AND user_id=u AND active FOR SHARE; IF NOT FOUND THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501'; END IF;
 IF NOT yingira.check_rate('commerce:'||u,180) THEN RAISE EXCEPTION 'Too many requests. Please wait.'; END IF;
 INSERT INTO yingira.plan_settings(event_id) VALUES(eid) ON CONFLICT DO NOTHING;
 INSERT INTO yingira.brand_profiles(organization_id,name) SELECT id,name FROM yingira.organizations WHERE id=org ON CONFLICT DO NOTHING;
 SELECT * INTO cfg FROM yingira.plan_settings WHERE event_id=eid FOR UPDATE;
 SELECT jsonb_build_object('name',b.name,'tagline',b.tagline,'color',b.color,'logoAssetId',b.logo_asset_id,'logoEventId',b.logo_event_id,'email',b.email,'phone',b.phone,'version',b.version) INTO brand_json FROM yingira.brand_profiles b WHERE organization_id=org;
 IF p_action='state' THEN
  RETURN jsonb_build_object('event',jsonb_build_object('id',eid,'title',ev.title,'startsAt',ev.starts_at,'timezone',ev.timezone),'settings',jsonb_build_object('currency',cfg.currency,'budget',cfg.budget,'clientName',cfg.client_name,'clientEmail',cfg.client_email,'version',cfg.version),'brand',brand_json,
   'tasks',coalesce((SELECT jsonb_agg(to_jsonb(t)-'event_id' ORDER BY t.due NULLS LAST,t.title) FROM yingira.plan_tasks t WHERE event_id=eid),'[]'),
   'programme',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'title',p.title,'startsAt',p.starts_at,'endsAt',p.ends_at,'location',p.location,'owner',p.owner,'supplierId',p.supplier_id,'notes',p.notes,'version',p.version) ORDER BY p.starts_at,p.id) FROM yingira.plan_programme p WHERE event_id=eid),'[]'),
   'suppliers',coalesce((SELECT jsonb_agg(to_jsonb(s)-'event_id' ORDER BY s.name) FROM yingira.plan_suppliers s WHERE event_id=eid),'[]'),
   'costs',coalesce((SELECT jsonb_agg((to_jsonb(c)-ARRAY['event_id','supplier_id'])||jsonb_build_object('supplierId',c.supplier_id,'paid',(SELECT coalesce(sum(amount),0) FROM yingira.plan_payments WHERE cost_id=c.id)) ORDER BY c.title) FROM yingira.plan_costs c WHERE event_id=eid),'[]'),
   'packages',coalesce((SELECT jsonb_agg(to_jsonb(p)-'organization_id' ORDER BY p.name) FROM yingira.service_packages p WHERE organization_id=org),'[]'),
   'invoices',coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'number',i.number,'clientName',i.client_name,'clientEmail',i.client_email,'due',i.due,'lines',i.lines,'notes',i.notes,'status',i.status,'total',i.total,'paid',(SELECT coalesce(sum(amount),0) FROM yingira.plan_payments WHERE invoice_id=i.id),'version',i.version,'issuedAt',i.issued_at,'brand',i.brand) ORDER BY i.issued_at DESC NULLS FIRST,i.id) FROM yingira.client_invoices i WHERE event_id=eid),'[]'),
   'payments',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'targetId',coalesce(p.cost_id,p.invoice_id),'targetKind',p.target_kind,'amount',p.amount,'paidOn',p.paid_on,'method',p.method,'reference',p.reference,'notes',p.notes,'reversalOf',p.reversal_of,'createdAt',p.created_at) ORDER BY p.created_at DESC) FROM yingira.plan_payments p WHERE event_id=eid),'[]'),
   'approvals',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'clientName',a.client_name,'kind',a.kind,'status',a.status,'expiresAt',a.expires_at,'createdAt',a.created_at,'decidedAt',a.decided_at,'signer',a.signer,'comment',a.comment,'ciphertext',a.ciphertext) ORDER BY a.created_at DESC) FROM yingira.client_approvals a WHERE event_id=eid),'[]'),
   'usage',jsonb_build_object('events',(SELECT count(*) FROM yingira.events WHERE organization_id=org),'invitations',(SELECT count(*) FROM yingira.invitations WHERE organization_id=org),'admins',(SELECT count(*) FROM yingira.organization_members WHERE organization_id=org AND active)));
 END IF;
 IF rid IS NULL THEN RAISE EXCEPTION 'Request key required'; END IF;
 sig:=encode(extensions.digest(p_action||(p_data-ARRAY['tokenHash','tokenCiphertext'])::text,'sha256'),'hex');
 SELECT * INTO prior FROM yingira.plan_mutations WHERE actor_id=u AND request_id=rid;
 IF FOUND THEN IF prior.digest<>sig OR prior.event_id<>eid THEN RAISE EXCEPTION 'Request key reused with different details'; END IF; RETURN prior.result; END IF;
 IF p_action='settings' THEN
  IF cfg.version IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Settings changed. Reload before saving.'; END IF;
  IF cfg.currency IS DISTINCT FROM p_data->>'currency' AND (EXISTS(SELECT 1 FROM yingira.plan_costs WHERE event_id=eid) OR EXISTS(SELECT 1 FROM yingira.client_invoices WHERE event_id=eid)) THEN RAISE EXCEPTION 'Currency cannot change after financial records exist'; END IF;
  UPDATE yingira.plan_settings SET currency=p_data->>'currency',budget=(p_data->>'budget')::bigint,client_name=p_data->>'clientName',client_email=p_data->>'clientEmail',version=version+1 WHERE event_id=eid;
 ELSIF p_action='task_save' THEN
  SELECT version INTO v FROM yingira.plan_tasks WHERE id=item AND event_id=eid;
  IF coalesce(v,0) IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Task changed. Reload before saving.'; END IF;
  IF v IS NULL THEN INSERT INTO yingira.plan_tasks(id,event_id,title,owner,due,status,notes) VALUES(item,eid,p_data->>'title',p_data->>'owner',(p_data->>'due')::date,p_data->>'status',p_data->>'notes');
  ELSE UPDATE yingira.plan_tasks SET title=p_data->>'title',owner=p_data->>'owner',due=(p_data->>'due')::date,status=p_data->>'status',notes=p_data->>'notes',version=version+1 WHERE id=item AND event_id=eid; END IF;
 ELSIF p_action='supplier_save' THEN
  SELECT version INTO v FROM yingira.plan_suppliers WHERE id=item AND event_id=eid;
  IF coalesce(v,0) IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Supplier changed. Reload before saving.'; END IF;
  IF v IS NULL THEN INSERT INTO yingira.plan_suppliers(id,event_id,name,category,contact,email,phone,notes) VALUES(item,eid,p_data->>'name',p_data->>'category',p_data->>'contact',p_data->>'email',p_data->>'phone',p_data->>'notes');
  ELSE UPDATE yingira.plan_suppliers SET name=p_data->>'name',category=p_data->>'category',contact=p_data->>'contact',email=p_data->>'email',phone=p_data->>'phone',notes=p_data->>'notes',version=version+1 WHERE id=item AND event_id=eid; END IF;
 ELSIF p_action='programme_save' THEN
  SELECT version INTO v FROM yingira.plan_programme WHERE id=item AND event_id=eid;
  IF coalesce(v,0) IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Programme changed. Reload before saving.'; END IF;
  IF v IS NULL THEN INSERT INTO yingira.plan_programme(id,event_id,title,starts_at,ends_at,location,owner,supplier_id,notes) VALUES(item,eid,p_data->>'title',(p_data->>'startsAt')::timestamptz,(p_data->>'endsAt')::timestamptz,p_data->>'location',p_data->>'owner',(p_data->>'supplierId')::uuid,p_data->>'notes');
  ELSE UPDATE yingira.plan_programme SET title=p_data->>'title',starts_at=(p_data->>'startsAt')::timestamptz,ends_at=(p_data->>'endsAt')::timestamptz,location=p_data->>'location',owner=p_data->>'owner',supplier_id=(p_data->>'supplierId')::uuid,notes=p_data->>'notes',version=version+1 WHERE id=item AND event_id=eid; END IF;
 ELSIF p_action='cost_save' THEN
  SELECT version INTO v FROM yingira.plan_costs WHERE id=item AND event_id=eid;
  IF coalesce(v,0) IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Budget item changed. Reload before saving.'; END IF;
  SELECT coalesce(sum(amount),0) INTO paid FROM yingira.plan_payments WHERE cost_id=item;
  IF (p_data->>'committed')::bigint<paid THEN RAISE EXCEPTION 'Committed amount cannot be below payments already recorded'; END IF;
  IF v IS NULL THEN INSERT INTO yingira.plan_costs(id,event_id,title,supplier_id,planned,quoted,committed,deposit,due,notes) VALUES(item,eid,p_data->>'title',(p_data->>'supplierId')::uuid,(p_data->>'planned')::bigint,(p_data->>'quoted')::bigint,(p_data->>'committed')::bigint,(p_data->>'deposit')::bigint,(p_data->>'due')::date,p_data->>'notes');
  ELSE UPDATE yingira.plan_costs SET title=p_data->>'title',supplier_id=(p_data->>'supplierId')::uuid,planned=(p_data->>'planned')::bigint,quoted=(p_data->>'quoted')::bigint,committed=(p_data->>'committed')::bigint,deposit=(p_data->>'deposit')::bigint,due=(p_data->>'due')::date,notes=p_data->>'notes',version=version+1 WHERE id=item AND event_id=eid; END IF;
 ELSIF p_action='package_save' THEN
  PERFORM yingira.invoice_total(p_data->'lines');
  SELECT version INTO v FROM yingira.service_packages WHERE id=item AND organization_id=org FOR UPDATE;
  IF coalesce(v,0) IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Package changed. Reload before saving.'; END IF;
  IF v IS NULL THEN INSERT INTO yingira.service_packages(id,organization_id,name,description,currency,lines,active) VALUES(item,org,p_data->>'name',p_data->>'description',p_data->>'currency',p_data->'lines',(p_data->>'active')::boolean);
  ELSE UPDATE yingira.service_packages SET name=p_data->>'name',description=p_data->>'description',currency=p_data->>'currency',lines=p_data->'lines',active=(p_data->>'active')::boolean,version=version+1 WHERE id=item AND organization_id=org; END IF;
 ELSIF p_action='invoice_save' THEN
  SELECT * INTO inv FROM yingira.client_invoices WHERE id=item AND event_id=eid;
  IF coalesce(inv.version,0) IS DISTINCT FROM expected OR (inv.id IS NOT NULL AND inv.status<>'draft') THEN RAISE EXCEPTION 'Only the current draft can be edited'; END IF;
  amount_total:=yingira.invoice_total(p_data->'lines');
  IF inv.id IS NULL THEN INSERT INTO yingira.client_invoices(id,event_id,client_name,client_email,due,lines,notes,total) VALUES(item,eid,p_data->>'clientName',p_data->>'clientEmail',(p_data->>'due')::date,p_data->'lines',p_data->>'notes',amount_total);
  ELSE UPDATE yingira.client_invoices SET client_name=p_data->>'clientName',client_email=p_data->>'clientEmail',due=(p_data->>'due')::date,lines=p_data->'lines',notes=p_data->>'notes',total=amount_total,version=version+1 WHERE id=item AND event_id=eid; END IF;
 ELSIF p_action IN('invoice_issue','invoice_void') THEN
  SELECT * INTO inv FROM yingira.client_invoices WHERE id=item AND event_id=eid;
  IF NOT FOUND OR inv.version IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Invoice changed. Reload before continuing.'; END IF;
  IF p_action='invoice_issue' THEN
   IF inv.status<>'draft' OR inv.total<=0 THEN RAISE EXCEPTION 'Issue a draft with a positive total'; END IF;
   UPDATE yingira.client_invoices SET status='issued',number='YI-'||upper(replace(id::text,'-','')),issued_at=now(),brand=brand_json,version=version+1 WHERE id=item;
  ELSE
   IF EXISTS(SELECT 1 FROM yingira.plan_payments WHERE invoice_id=item HAVING sum(amount)<>0) THEN RAISE EXCEPTION 'Reverse receipts before voiding an invoice'; END IF;
   UPDATE yingira.client_invoices SET status='void',version=version+1 WHERE id=item;
  END IF;
 ELSIF p_action='payment_record' THEN
  IF (p_data->>'amount')::bigint<=0 OR p_data->>'method' NOT IN('bank','mobile_money','cash','other') OR (p_data->>'paidOn')::date>current_date THEN RAISE EXCEPTION 'Record a positive payment already made'; END IF;
  IF p_data->>'targetKind'='supplier' THEN
   SELECT committed INTO amount_total FROM yingira.plan_costs WHERE id=target AND event_id=eid; IF NOT FOUND THEN RAISE EXCEPTION 'Budget item unavailable'; END IF;
   SELECT coalesce(sum(amount),0) INTO paid FROM yingira.plan_payments WHERE cost_id=target;
  ELSIF p_data->>'targetKind'='client' THEN
   SELECT i.total INTO amount_total FROM yingira.client_invoices i WHERE id=target AND event_id=eid AND status='issued'; IF NOT FOUND THEN RAISE EXCEPTION 'Issue the invoice before recording a receipt'; END IF;
   SELECT coalesce(sum(amount),0) INTO paid FROM yingira.plan_payments WHERE invoice_id=target;
  ELSE RAISE EXCEPTION 'Invalid payment type'; END IF;
  IF paid+(p_data->>'amount')::bigint>amount_total THEN RAISE EXCEPTION 'Payment exceeds the outstanding balance'; END IF;
  INSERT INTO yingira.plan_payments(id,event_id,target_kind,cost_id,invoice_id,amount,paid_on,method,reference,notes,created_by) VALUES(item,eid,p_data->>'targetKind',CASE WHEN p_data->>'targetKind'='supplier' THEN target END,CASE WHEN p_data->>'targetKind'='client' THEN target END,(p_data->>'amount')::bigint,(p_data->>'paidOn')::date,p_data->>'method',p_data->>'reference',p_data->>'notes',u);
 ELSIF p_action='payment_reverse' THEN
  SELECT * INTO payment FROM yingira.plan_payments WHERE id=(p_data->>'paymentId')::uuid AND event_id=eid;
  IF NOT FOUND OR payment.amount<=0 OR payment.method='pesapal' OR EXISTS(SELECT 1 FROM yingira.plan_payments WHERE reversal_of=payment.id) OR coalesce(length(trim(p_data->>'reason')),0)<5 THEN RAISE EXCEPTION 'Only unreversed manual payments can be reversed, with a reason'; END IF;
  INSERT INTO yingira.plan_payments(id,event_id,target_kind,cost_id,invoice_id,amount,paid_on,method,reference,notes,reversal_of,created_by) VALUES(item,eid,payment.target_kind,payment.cost_id,payment.invoice_id,-payment.amount,current_date,payment.method,payment.reference,p_data->>'reason',payment.id,u);
 ELSIF p_action='brand_save' THEN
  SELECT version INTO v FROM yingira.brand_profiles WHERE organization_id=org FOR UPDATE;
  IF v IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Branding changed. Reload before saving.'; END IF;
  IF p_data->>'logoAssetId' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM yingira.design_assets a JOIN yingira.events e ON e.id=a.event_id WHERE a.id=(p_data->>'logoAssetId')::uuid AND e.id=(p_data->>'logoEventId')::uuid AND e.organization_id=org) THEN RAISE EXCEPTION 'Upload a logo in your organization'; END IF;
  UPDATE yingira.brand_profiles SET name=p_data->>'name',tagline=p_data->>'tagline',color=p_data->>'color',logo_asset_id=(p_data->>'logoAssetId')::uuid,logo_event_id=(p_data->>'logoEventId')::uuid,email=p_data->>'email',phone=p_data->>'phone',version=version+1 WHERE organization_id=org;
 ELSIF p_action='approval_create' THEN
  IF (p_data->>'expiresAt')::timestamptz NOT BETWEEN now() AND now()+interval '90 days' OR length(coalesce(p_data->>'details',''))>6000 THEN RAISE EXCEPTION 'Approval links expire within 90 days'; END IF;
  snapshot:=jsonb_build_object('details',p_data->>'details','brand',brand_json,'currency',cfg.currency);
  IF p_data->>'kind'='budget' THEN
   snapshot:=snapshot||jsonb_build_object('budget',jsonb_build_object('budget',cfg.budget,'planned',(SELECT coalesce(sum(planned),0) FROM yingira.plan_costs WHERE event_id=eid),'quoted',(SELECT coalesce(sum(quoted),0) FROM yingira.plan_costs WHERE event_id=eid),'committed',(SELECT coalesce(sum(committed),0) FROM yingira.plan_costs WHERE event_id=eid),'costs',coalesce((SELECT jsonb_agg(jsonb_build_object('title',title,'planned',planned,'quoted',quoted,'committed',committed) ORDER BY title) FROM yingira.plan_costs WHERE event_id=eid),'[]')));
  ELSIF p_data->>'kind'='programme' THEN
   snapshot:=snapshot||jsonb_build_object('programme',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'title',title,'startsAt',starts_at,'endsAt',ends_at,'location',location,'owner',owner) ORDER BY starts_at) FROM yingira.plan_programme WHERE event_id=eid),'[]'));
  ELSIF p_data->>'kind'='invoice' THEN
   SELECT * INTO inv FROM yingira.client_invoices WHERE id=(p_data->>'invoiceId')::uuid AND event_id=eid AND status='issued'; IF NOT FOUND THEN RAISE EXCEPTION 'Choose an issued invoice'; END IF;
   snapshot:=snapshot||jsonb_build_object('invoice',jsonb_build_object('id',inv.id,'number',inv.number,'clientName',inv.client_name,'clientEmail',inv.client_email,'due',inv.due,'lines',inv.lines,'notes',inv.notes,'total',inv.total,'brand',inv.brand));
  ELSIF p_data->>'kind'<>'custom' THEN RAISE EXCEPTION 'Invalid approval type'; END IF;
  INSERT INTO yingira.client_approvals(id,event_id,title,client_name,kind,snapshot,digest,ciphertext,expires_at,created_by) VALUES(item,eid,p_data->>'title',p_data->>'clientName',p_data->>'kind',snapshot,p_data->>'tokenHash',p_data->>'tokenCiphertext',(p_data->>'expiresAt')::timestamptz,u);
 ELSIF p_action='approval_revoke' THEN
  UPDATE yingira.client_approvals SET status='revoked' WHERE id=item AND event_id=eid AND status='pending'; IF NOT FOUND THEN RAISE EXCEPTION 'Only pending approvals can be revoked'; END IF;
 ELSIF p_action='delete_item' THEN
  IF p_data->>'kind'='task' THEN DELETE FROM yingira.plan_tasks WHERE id=item AND event_id=eid AND version=expected;
  ELSIF p_data->>'kind'='programme' THEN DELETE FROM yingira.plan_programme WHERE id=item AND event_id=eid AND version=expected;
  ELSIF p_data->>'kind'='supplier' THEN DELETE FROM yingira.plan_suppliers WHERE id=item AND event_id=eid AND version=expected;
  ELSIF p_data->>'kind'='cost' THEN DELETE FROM yingira.plan_costs WHERE id=item AND event_id=eid AND version=expected;
  ELSE RAISE EXCEPTION 'Invalid item'; END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item changed or is unavailable'; END IF;
 ELSE RAISE EXCEPTION 'Unsupported action'; END IF;
 result:=jsonb_build_object('ok',true,'id',item);
 INSERT INTO yingira.audit(organization_id,event_id,actor_id,action,entity_id,metadata) VALUES(org,eid,u,'PLAN_'||upper(p_action),item,jsonb_build_object('requestId',rid));
 INSERT INTO yingira.plan_mutations(actor_id,request_id,event_id,digest,result) VALUES(u,rid,eid,sig,result);
 RETURN result;
END $$;

CREATE FUNCTION public.yingira_client_portal(p_token text,p_action text DEFAULT 'view',p_data jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a yingira.client_approvals%rowtype; ev yingira.events%rowtype; sig text;
BEGIN
 IF p_token !~ '^[A-Za-z0-9_-]{43}$' THEN RETURN null; END IF;
 SELECT * INTO a FROM yingira.client_approvals WHERE digest=encode(extensions.digest(p_token,'sha256'),'hex') FOR UPDATE;
 IF NOT FOUND OR a.status='revoked' OR a.expires_at<clock_timestamp() THEN RETURN null; END IF;
 SELECT * INTO ev FROM yingira.events WHERE id=a.event_id;
 PERFORM 1 FROM yingira.organizations WHERE id=ev.organization_id AND active FOR SHARE; IF NOT FOUND THEN RETURN null; END IF;
 IF p_action='decide' THEN
  sig:=encode(extensions.digest(p_data::text,'sha256'),'hex');
  IF a.decision_key=(p_data->>'requestId')::uuid AND a.decision_hash=sig THEN RETURN jsonb_build_object('status',a.status); END IF;
  IF a.status<>'pending' THEN RAISE EXCEPTION 'A decision has already been recorded'; END IF;
  IF p_data->>'decision' NOT IN('approved','changes_requested') OR coalesce(length(trim(p_data->>'signer')),0) NOT BETWEEN 2 AND 160 OR length(coalesce(p_data->>'comment',''))>2000 OR p_data->>'requestId' IS NULL THEN RAISE EXCEPTION 'Complete the decision form'; END IF;
  IF NOT yingira.check_rate('approval:'||a.id,10) THEN RAISE EXCEPTION 'Please wait before trying again'; END IF;
  UPDATE yingira.client_approvals SET status=p_data->>'decision',signer=trim(p_data->>'signer'),comment=p_data->>'comment',decided_at=now(),decision_key=(p_data->>'requestId')::uuid,decision_hash=sig WHERE id=a.id;
  RETURN jsonb_build_object('status',p_data->>'decision');
 ELSIF p_action<>'view' THEN RAISE EXCEPTION 'Unsupported action'; END IF;
 RETURN jsonb_build_object('id',a.id,'title',a.title,'clientName',a.client_name,'eventTitle',ev.title,'kind',a.kind,'status',a.status,'expiresAt',a.expires_at,'createdAt',a.created_at,'decidedAt',a.decided_at,'signer',a.signer,'comment',a.comment,'snapshot',a.snapshot);
END $$;
GRANT CREATE ON SCHEMA public TO yingira_executor;
ALTER FUNCTION public.yingira_commerce(text,jsonb) OWNER TO yingira_executor;
ALTER FUNCTION public.yingira_client_portal(text,text,jsonb) OWNER TO yingira_executor;
REVOKE CREATE ON SCHEMA public FROM yingira_executor;
REVOKE ALL ON FUNCTION public.yingira_commerce(text,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.yingira_client_portal(text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.yingira_commerce(text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.yingira_client_portal(text,text,jsonb) TO service_role;
CREATE TABLE yingira.platform_admins(user_id uuid PRIMARY KEY REFERENCES auth.users(id));
INSERT INTO yingira.platform_admins(user_id) SELECT id FROM auth.users WHERE lower(email)='sabiti.christopher@gmail.com' AND email_confirmed_at IS NOT NULL;
CREATE TABLE yingira.subscription_plans(id uuid PRIMARY KEY,name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100),description text NOT NULL CHECK(length(description)<=1500),price bigint NOT NULL CHECK(price BETWEEN 1 AND 1000000000000),days integer NOT NULL CHECK(days IN(30,90,365)),event_limit integer NOT NULL CHECK(event_limit BETWEEN 1 AND 10000),guest_limit integer NOT NULL CHECK(guest_limit BETWEEN 1 AND 1000000),active boolean NOT NULL DEFAULT false,version integer NOT NULL DEFAULT 1);
CREATE TABLE yingira.organization_subscriptions(organization_id uuid PRIMARY KEY REFERENCES yingira.organizations(id),plan_id uuid NOT NULL REFERENCES yingira.subscription_plans(id),plan_name text NOT NULL,event_limit integer NOT NULL,guest_limit integer NOT NULL,expires_at timestamptz NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE yingira.invoice_links(id uuid PRIMARY KEY,invoice_id uuid NOT NULL UNIQUE REFERENCES yingira.client_invoices(id),digest text NOT NULL UNIQUE CHECK(digest ~ '^[a-f0-9]{64}$'),ciphertext text NOT NULL,expires_at timestamptz NOT NULL,revoked boolean NOT NULL DEFAULT false);
CREATE TABLE yingira.pesapal_orders(id uuid PRIMARY KEY,organization_id uuid NOT NULL REFERENCES yingira.organizations(id),event_id uuid REFERENCES yingira.events(id),purpose text NOT NULL CHECK(purpose IN('invoice','subscription')),invoice_id uuid REFERENCES yingira.client_invoices(id),plan_id uuid REFERENCES yingira.subscription_plans(id),amount bigint NOT NULL CHECK(amount BETWEEN 1 AND 1000000000000),currency text NOT NULL CHECK(currency='UGX'),details jsonb NOT NULL,customer_name text NOT NULL,customer_email text NOT NULL,customer_phone text NOT NULL DEFAULT '',provider_mode text CHECK(provider_mode IN('sandbox','live')),status text NOT NULL DEFAULT 'created' CHECK(status IN('created','submitting','pending','completed','failed','reversed','unknown')),tracking_id uuid UNIQUE,redirect_url text,last_error text,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),CHECK((purpose='invoice' AND invoice_id IS NOT NULL AND event_id IS NOT NULL AND plan_id IS NULL) OR (purpose='subscription' AND invoice_id IS NULL AND plan_id IS NOT NULL)),subscription_before jsonb,subscription_after jsonb);
CREATE UNIQUE INDEX one_open_invoice_checkout ON yingira.pesapal_orders(invoice_id) WHERE status IN('created','submitting','pending','unknown');
CREATE UNIQUE INDEX one_open_subscription_checkout ON yingira.pesapal_orders(organization_id) WHERE purpose='subscription' AND status IN('created','submitting','pending','unknown');
CREATE INDEX pesapal_org ON yingira.pesapal_orders(organization_id,created_at);
CREATE TABLE yingira.subscription_terms(order_id uuid PRIMARY KEY REFERENCES yingira.pesapal_orders(id),organization_id uuid NOT NULL REFERENCES yingira.organizations(id),plan_id uuid NOT NULL REFERENCES yingira.subscription_plans(id),plan_name text NOT NULL,event_limit integer NOT NULL,guest_limit integer NOT NULL,starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,CHECK(ends_at>starts_at));
CREATE INDEX subscription_term_org ON yingira.subscription_terms(organization_id,starts_at,ends_at);
CREATE TRIGGER immutable_subscription_terms BEFORE UPDATE OR DELETE ON yingira.subscription_terms FOR EACH ROW EXECUTE FUNCTION yingira.immutable();
CREATE TABLE yingira.payment_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES yingira.pesapal_orders(id),status text NOT NULL,confirmation text,created_at timestamptz NOT NULL DEFAULT now());
CREATE TRIGGER immutable_payment_events BEFORE UPDATE OR DELETE ON yingira.payment_events FOR EACH ROW EXECUTE FUNCTION yingira.immutable();
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['platform_admins','subscription_plans','organization_subscriptions','invoice_links','pesapal_orders','payment_events','subscription_terms'] LOOP
 EXECUTE format('ALTER TABLE yingira.%I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('ALTER TABLE yingira.%I FORCE ROW LEVEL SECURITY',t); EXECUTE format('REVOKE ALL ON yingira.%I FROM PUBLIC,anon,authenticated',t); EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON yingira.%I TO yingira_executor',t); EXECUTE format('CREATE POLICY executor_only ON yingira.%I TO yingira_executor USING(true) WITH CHECK(true)',t);
END LOOP; END $$;
-- Serializes plan capacity across all event/import writers. Gate admission never depends on billing.
CREATE FUNCTION yingira.enforce_subscription() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE sub yingira.organization_subscriptions%rowtype; used integer;
BEGIN
 IF TG_OP='UPDATE' THEN IF OLD.status<>'closed' OR NEW.status='closed' THEN RETURN NEW; END IF; END IF;
 PERFORM 1 FROM yingira.organizations WHERE id=NEW.organization_id FOR UPDATE;
 SELECT * INTO sub FROM yingira.organization_subscriptions WHERE organization_id=NEW.organization_id;
 IF NOT FOUND THEN RETURN NEW; END IF; -- Existing pilot organizations keep their agreed access.
 SELECT t.organization_id,t.plan_id,t.plan_name,t.event_limit,t.guest_limit,t.ends_at,now() INTO sub FROM yingira.subscription_terms t JOIN yingira.pesapal_orders o ON o.id=t.order_id WHERE t.organization_id=NEW.organization_id AND o.status='completed' AND t.starts_at<=clock_timestamp() AND t.ends_at>clock_timestamp() ORDER BY t.starts_at DESC LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'Renew your Yingira subscription before adding events or invitations'; END IF;
 IF TG_TABLE_NAME='events' THEN SELECT count(*) INTO used FROM yingira.events WHERE organization_id=NEW.organization_id AND status<>'closed'; IF used>=sub.event_limit THEN RAISE EXCEPTION 'Active event limit reached. Close a finished event or upgrade.'; END IF;
 ELSE SELECT count(*) INTO used FROM yingira.invitations WHERE event_id=NEW.event_id; IF used>=sub.guest_limit THEN RAISE EXCEPTION 'Invitation limit for this event reached'; END IF;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER subscription_event BEFORE INSERT OR UPDATE OF status ON yingira.events FOR EACH ROW EXECUTE FUNCTION yingira.enforce_subscription();
CREATE TRIGGER subscription_invitation BEFORE INSERT ON yingira.invitations FOR EACH ROW EXECUTE FUNCTION yingira.enforce_subscription();
CREATE FUNCTION yingira.guard_invoice_checkout() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE iid uuid; eid uuid;
BEGIN
 IF TG_TABLE_NAME='plan_payments' THEN IF NEW.method='pesapal' THEN RETURN NEW; END IF; iid:=NEW.invoice_id; eid:=NEW.event_id;
 ELSE IF NEW.status<>'void' THEN RETURN NEW; END IF; iid:=NEW.id; eid:=NEW.event_id; END IF;
 IF iid IS NOT NULL THEN
  PERFORM 1 FROM yingira.events WHERE id=eid FOR UPDATE;
  IF EXISTS(SELECT 1 FROM yingira.pesapal_orders WHERE invoice_id=iid AND status IN('created','submitting','pending','unknown')) THEN RAISE EXCEPTION 'An online checkout is outstanding. Verify its final status before changing this balance.'; END IF;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER guard_payment_checkout BEFORE INSERT ON yingira.plan_payments FOR EACH ROW EXECUTE FUNCTION yingira.guard_invoice_checkout();
CREATE TRIGGER guard_invoice_checkout BEFORE UPDATE ON yingira.client_invoices FOR EACH ROW EXECUTE FUNCTION yingira.guard_invoice_checkout();

CREATE FUNCTION public.yingira_billing(p_action text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=yingira.actor_id(); eid uuid:=(p_data->>'eventId')::uuid; org uuid; adm boolean; item uuid:=(p_data->>'id')::uuid; v integer; plan yingira.subscription_plans%rowtype; sub yingira.organization_subscriptions%rowtype; inv yingira.client_invoices%rowtype; prior yingira.pesapal_orders%rowtype; expected integer:=(p_data->>'expectedVersion')::integer; link yingira.invoice_links%rowtype;
BEGIN
 PERFORM 1 FROM yingira.profiles WHERE id=u AND NOT disabled FOR SHARE; IF NOT FOUND THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 SELECT organization_id INTO org FROM yingira.events WHERE id=eid FOR UPDATE;
 PERFORM 1 FROM yingira.organizations WHERE id=org AND active FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM yingira.organization_members WHERE organization_id=org AND user_id=u AND active FOR SHARE; IF NOT FOUND THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501'; END IF;
 adm:=EXISTS(SELECT 1 FROM yingira.platform_admins WHERE user_id=u);
 IF NOT yingira.check_rate('billing:'||u,120) THEN RAISE EXCEPTION 'Please wait before trying again'; END IF;
 IF p_action='state' THEN RETURN jsonb_build_object('organizationId',org,'isPlatformAdmin',adm,'plans',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY price) FROM yingira.subscription_plans p WHERE active OR adm),'[]'),'subscription',(SELECT (to_jsonb(s)-'organization_id')||jsonb_build_object('starts_at',(SELECT t.starts_at FROM yingira.subscription_terms t JOIN yingira.pesapal_orders o ON o.id=t.order_id WHERE t.organization_id=org AND o.status='completed' AND t.ends_at=s.expires_at ORDER BY t.starts_at DESC LIMIT 1)) FROM yingira.organization_subscriptions s WHERE organization_id=org),'orders',coalesce((SELECT jsonb_agg(x) FROM(SELECT id,purpose,invoice_id,amount,currency,status,tracking_id,created_at,last_error,provider_mode FROM yingira.pesapal_orders WHERE organization_id=org ORDER BY created_at DESC LIMIT 100)x),'[]'),'invoiceLinks',coalesce((SELECT jsonb_agg(jsonb_build_object('id',l.id,'invoiceId',l.invoice_id,'ciphertext',l.ciphertext,'expiresAt',l.expires_at,'revoked',l.revoked)) FROM yingira.invoice_links l JOIN yingira.client_invoices i ON i.id=l.invoice_id WHERE i.event_id=eid),'[]'));
 ELSIF p_action='plan_save' THEN
  IF NOT adm THEN RAISE EXCEPTION 'Platform owner access required' USING ERRCODE='42501'; END IF;
  SELECT version INTO v FROM yingira.subscription_plans WHERE id=item FOR UPDATE;
  IF coalesce(v,0) IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Plan changed. Reload before saving.'; END IF;
  IF v IS NULL THEN INSERT INTO yingira.subscription_plans(id,name,description,price,days,event_limit,guest_limit,active) VALUES(item,p_data->>'name',p_data->>'description',(p_data->>'price')::bigint,(p_data->>'days')::integer,(p_data->>'eventLimit')::integer,(p_data->>'guestLimit')::integer,(p_data->>'active')::boolean);
  ELSE UPDATE yingira.subscription_plans SET name=p_data->>'name',description=p_data->>'description',price=(p_data->>'price')::bigint,days=(p_data->>'days')::integer,event_limit=(p_data->>'eventLimit')::integer,guest_limit=(p_data->>'guestLimit')::integer,active=(p_data->>'active')::boolean,version=version+1 WHERE id=item; END IF;
 ELSIF p_action='subscription_order' THEN
  SELECT * INTO prior FROM yingira.pesapal_orders WHERE organization_id=org AND purpose='subscription' AND status IN('created','submitting','pending','unknown'); IF FOUND THEN RETURN jsonb_build_object('id',prior.id); END IF;
  SELECT * INTO plan FROM yingira.subscription_plans WHERE id=(p_data->>'planId')::uuid AND active FOR SHARE; IF NOT FOUND THEN RAISE EXCEPTION 'Plan unavailable'; END IF;
  IF plan.version IS DISTINCT FROM (p_data->>'planVersion')::integer THEN RAISE EXCEPTION 'Plan price changed. Reload and review before paying.'; END IF;
  IF (SELECT count(*) FROM yingira.events WHERE organization_id=org AND status<>'closed')>plan.event_limit OR EXISTS(SELECT 1 FROM yingira.invitations WHERE organization_id=org GROUP BY event_id HAVING count(*)>plan.guest_limit) THEN RAISE EXCEPTION 'This plan is below your current usage'; END IF;
  SELECT * INTO sub FROM yingira.organization_subscriptions WHERE organization_id=org;
  IF FOUND AND sub.expires_at>now() AND sub.plan_id<>plan.id THEN RAISE EXCEPTION 'Choose your current plan to renew, or change plans after this term ends'; END IF;
  INSERT INTO yingira.pesapal_orders(id,organization_id,event_id,purpose,plan_id,amount,currency,details,customer_name,customer_email,created_by) VALUES(item,org,eid,'subscription',plan.id,plan.price,'UGX',to_jsonb(plan),p_data->>'customerName',yingira.member_email(u),u);
  RETURN jsonb_build_object('id',item);
 ELSIF p_action='invoice_link' THEN
  SELECT * INTO inv FROM yingira.client_invoices WHERE id=(p_data->>'invoiceId')::uuid AND event_id=eid AND status='issued'; IF NOT FOUND THEN RAISE EXCEPTION 'Choose an issued invoice'; END IF;
  IF (SELECT currency FROM yingira.plan_settings WHERE event_id=eid)<>'UGX' THEN RAISE EXCEPTION 'Pesapal checkout currently supports UGX invoices'; END IF;
  SELECT * INTO link FROM yingira.invoice_links WHERE invoice_id=inv.id FOR UPDATE;
  IF FOUND AND NOT link.revoked AND link.expires_at>now() THEN RETURN jsonb_build_object('id',link.id); END IF;
  INSERT INTO yingira.invoice_links(id,invoice_id,digest,ciphertext,expires_at) VALUES(item,inv.id,p_data->>'tokenHash',p_data->>'tokenCiphertext',now()+interval '30 days') ON CONFLICT(invoice_id) DO UPDATE SET digest=excluded.digest,ciphertext=excluded.ciphertext,expires_at=excluded.expires_at,revoked=false;
 ELSIF p_action='revoke_link' THEN
  UPDATE yingira.invoice_links l SET revoked=true FROM yingira.client_invoices i WHERE l.invoice_id=i.id AND i.event_id=eid AND l.id=item; IF NOT FOUND THEN RAISE EXCEPTION 'Link unavailable'; END IF;
 ELSIF p_action='order_access' THEN
  SELECT * INTO prior FROM yingira.pesapal_orders WHERE id=item AND organization_id=org; IF NOT FOUND THEN RAISE EXCEPTION 'Order unavailable'; END IF; RETURN jsonb_build_object('id',prior.id,'organizationId',org);
 ELSE RAISE EXCEPTION 'Unsupported action'; END IF;
 INSERT INTO yingira.audit(organization_id,event_id,actor_id,action,entity_id) VALUES(org,eid,u,'BILLING_'||upper(p_action),item);
 RETURN jsonb_build_object('ok',true,'id',item);
END $$;

CREATE FUNCTION public.yingira_invoice_checkout(p_token text,p_action text,p_data jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE link yingira.invoice_links%rowtype; inv yingira.client_invoices%rowtype; ev yingira.events%rowtype; paid bigint; ord yingira.pesapal_orders%rowtype;
BEGIN
 IF p_token !~ '^[A-Za-z0-9_-]{43}$' THEN RETURN null; END IF;
 SELECT * INTO link FROM yingira.invoice_links WHERE digest=encode(extensions.digest(p_token,'sha256'),'hex'); IF NOT FOUND THEN RETURN null; END IF;
 SELECT * INTO inv FROM yingira.client_invoices WHERE id=link.invoice_id;
 SELECT * INTO ev FROM yingira.events WHERE id=inv.event_id FOR UPDATE;
 SELECT * INTO link FROM yingira.invoice_links WHERE id=link.id FOR SHARE;
 SELECT * INTO inv FROM yingira.client_invoices WHERE id=link.invoice_id;
 IF link.revoked OR link.expires_at<now() OR inv.status<>'issued' THEN RETURN null; END IF;
 PERFORM 1 FROM yingira.organizations WHERE id=ev.organization_id AND active FOR SHARE; IF NOT FOUND THEN RETURN null; END IF;
 SELECT coalesce(sum(amount),0) INTO paid FROM yingira.plan_payments WHERE invoice_id=inv.id;
 IF p_action='view' THEN RETURN jsonb_build_object('organizationId',ev.organization_id,'eventTitle',ev.title,'number',inv.number,'clientName',inv.client_name,'currency','UGX','total',inv.total,'paid',paid,'lines',inv.lines,'notes',inv.notes,'brand',inv.brand,'due',inv.due);
 ELSIF p_action='order' THEN
  IF NOT yingira.check_rate('checkout:'||link.id,10) THEN RAISE EXCEPTION 'Please wait before trying again'; END IF;
  IF paid>=inv.total THEN RAISE EXCEPTION 'Invoice is already paid'; END IF;
  SELECT * INTO ord FROM yingira.pesapal_orders WHERE invoice_id=inv.id AND status IN('created','submitting','pending','unknown'); IF FOUND THEN RETURN jsonb_build_object('id',ord.id,'organizationId',ev.organization_id); END IF;
  IF coalesce(length(trim(p_data->>'name')),0) NOT BETWEEN 2 AND 160 OR coalesce(length(p_data->>'email'),0) NOT BETWEEN 3 AND 254 OR length(coalesce(p_data->>'phone',''))>40 THEN RAISE EXCEPTION 'Enter your billing contact details'; END IF;
  INSERT INTO yingira.pesapal_orders(id,organization_id,event_id,purpose,invoice_id,amount,currency,details,customer_name,customer_email,customer_phone,created_by) VALUES((p_data->>'id')::uuid,ev.organization_id,ev.id,'invoice',inv.id,inv.total-paid,'UGX',jsonb_build_object('number',inv.number),p_data->>'name',p_data->>'email',coalesce(p_data->>'phone',''),(SELECT actor_id FROM yingira.audit WHERE entity_id=inv.id AND action='PLAN_INVOICE_ISSUE' ORDER BY created_at DESC LIMIT 1));
  RETURN jsonb_build_object('id',p_data->>'id','organizationId',ev.organization_id);
 ELSE RAISE EXCEPTION 'Unsupported action'; END IF;
END $$;

CREATE FUNCTION public.yingira_pesapal_worker(p_action text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ord yingira.pesapal_orders%rowtype; inv yingira.client_invoices%rowtype; prev jsonb; next_sub jsonb; state text:=p_data->>'status'; before_sub yingira.organization_subscriptions%rowtype; ends timestamptz;
BEGIN
 SELECT * INTO ord FROM yingira.pesapal_orders WHERE id=(p_data->>'id')::uuid;
 IF NOT FOUND THEN RETURN null; END IF;
 -- Match the event -> organization -> order lock order used by authenticated writers.
 PERFORM 1 FROM yingira.events WHERE id=ord.event_id FOR UPDATE;
 PERFORM 1 FROM yingira.organizations WHERE id=ord.organization_id FOR UPDATE;
 SELECT * INTO ord FROM yingira.pesapal_orders WHERE id=ord.id FOR UPDATE;
 IF p_action='read' THEN RETURN to_jsonb(ord);
 ELSIF p_action='claim' THEN
  IF ord.status<>'created' THEN RETURN jsonb_build_object('claimed',false,'status',ord.status,'redirectUrl',ord.redirect_url); END IF;
  IF NOT EXISTS(SELECT 1 FROM yingira.organizations WHERE id=ord.organization_id AND active) THEN RAISE EXCEPTION 'Organization unavailable'; END IF;
  IF coalesce(p_data->>'mode','') NOT IN('live','sandbox') THEN RAISE EXCEPTION 'Provider mode required'; END IF;
  UPDATE yingira.pesapal_orders SET status='submitting',provider_mode=p_data->>'mode',updated_at=now() WHERE id=ord.id;
  RETURN to_jsonb(ord)||jsonb_build_object('claimed',true);
 ELSIF p_action='submitted' THEN
  IF ord.tracking_id IS NOT NULL AND ord.tracking_id IS DISTINCT FROM (p_data->>'trackingId')::uuid THEN RAISE EXCEPTION 'Tracking ID mismatch'; END IF;
  UPDATE yingira.pesapal_orders SET tracking_id=(p_data->>'trackingId')::uuid,redirect_url=p_data->>'redirectUrl',status=CASE WHEN status IN('created','submitting','unknown') THEN 'pending' ELSE status END,updated_at=now() WHERE id=ord.id;
 ELSIF p_action='uncertain' THEN
  UPDATE yingira.pesapal_orders SET status='unknown',last_error='Provider outcome is uncertain. Reconcile before creating another checkout.',updated_at=now() WHERE id=ord.id AND status='submitting';
 ELSIF p_action='settle' THEN
  IF coalesce(p_data->>'mode','') NOT IN('live','sandbox') OR (ord.provider_mode IS NOT NULL AND ord.provider_mode IS DISTINCT FROM p_data->>'mode') THEN RAISE EXCEPTION 'Provider mode mismatch'; END IF;
  IF ord.amount IS DISTINCT FROM (p_data->>'amount')::bigint OR ord.currency IS DISTINCT FROM p_data->>'currency' OR (ord.tracking_id IS NOT NULL AND ord.tracking_id IS DISTINCT FROM (p_data->>'trackingId')::uuid) OR state NOT IN('completed','failed','reversed','pending') THEN RAISE EXCEPTION 'Verified payment does not match this order'; END IF;
  IF ord.status='reversed' OR (ord.status='completed' AND state NOT IN('completed','reversed')) THEN RETURN jsonb_build_object('status',ord.status,'mode',coalesce(ord.provider_mode,p_data->>'mode')); END IF;
  IF state=ord.status THEN RETURN jsonb_build_object('status',ord.status,'mode',coalesce(ord.provider_mode,p_data->>'mode')); END IF;
  IF state='completed' AND p_data->>'mode'='live' THEN
   IF ord.purpose='invoice' THEN
    SELECT * INTO inv FROM yingira.client_invoices WHERE id=ord.invoice_id;
    IF inv.status<>'issued' OR inv.total<(SELECT coalesce(sum(amount),0) FROM yingira.plan_payments WHERE invoice_id=inv.id)+ord.amount THEN RAISE EXCEPTION 'Invoice balance needs reconciliation'; END IF;
    INSERT INTO yingira.plan_payments(id,event_id,target_kind,invoice_id,amount,paid_on,method,reference,notes,created_by) VALUES(ord.id,ord.event_id,'client',ord.invoice_id,ord.amount,current_date,'pesapal',left(coalesce(nullif(p_data->>'confirmation',''),(p_data->>'trackingId')),160),'Verified by Pesapal API',ord.created_by) ON CONFLICT(id) DO NOTHING;
   ELSE
    SELECT * INTO before_sub FROM yingira.organization_subscriptions WHERE organization_id=ord.organization_id;
    prev:=CASE WHEN FOUND THEN to_jsonb(before_sub) ELSE null END;
    ends:=greatest(coalesce(before_sub.expires_at,now()),now())+make_interval(days=>(ord.details->>'days')::integer);
    INSERT INTO yingira.subscription_terms(order_id,organization_id,plan_id,plan_name,event_limit,guest_limit,starts_at,ends_at) VALUES(ord.id,ord.organization_id,ord.plan_id,ord.details->>'name',(ord.details->>'event_limit')::integer,(ord.details->>'guest_limit')::integer,greatest(coalesce(before_sub.expires_at,now()),now()),ends);
    INSERT INTO yingira.organization_subscriptions(organization_id,plan_id,plan_name,event_limit,guest_limit,expires_at) VALUES(ord.organization_id,ord.plan_id,ord.details->>'name',(ord.details->>'event_limit')::integer,(ord.details->>'guest_limit')::integer,ends)
    ON CONFLICT(organization_id) DO UPDATE SET plan_id=excluded.plan_id,plan_name=excluded.plan_name,event_limit=excluded.event_limit,guest_limit=excluded.guest_limit,expires_at=excluded.expires_at,updated_at=now();
    SELECT to_jsonb(s) INTO next_sub FROM yingira.organization_subscriptions s WHERE organization_id=ord.organization_id;
    UPDATE yingira.pesapal_orders SET subscription_before=prev,subscription_after=next_sub WHERE id=ord.id;
   END IF;
  ELSIF state='reversed' AND ord.status='completed' AND p_data->>'mode'='live' THEN
   IF ord.purpose='invoice' THEN
    INSERT INTO yingira.plan_payments(id,event_id,target_kind,invoice_id,amount,paid_on,method,reference,notes,reversal_of,created_by) VALUES(gen_random_uuid(),ord.event_id,'client',ord.invoice_id,-ord.amount,current_date,'pesapal',p_data->>'trackingId','Reversal verified by Pesapal',ord.id,ord.created_by) ON CONFLICT(reversal_of) DO NOTHING;
   ELSE
    -- Original paid time windows remain intact. A refund invalidates only its own term.
    SELECT t.organization_id,t.plan_id,t.plan_name,t.event_limit,t.guest_limit,t.ends_at,now() INTO before_sub FROM yingira.subscription_terms t JOIN yingira.pesapal_orders o ON o.id=t.order_id WHERE t.organization_id=ord.organization_id AND o.status='completed' AND o.id<>ord.id ORDER BY t.ends_at DESC LIMIT 1;
    IF FOUND THEN UPDATE yingira.organization_subscriptions SET plan_id=before_sub.plan_id,plan_name=before_sub.plan_name,event_limit=before_sub.event_limit,guest_limit=before_sub.guest_limit,expires_at=before_sub.expires_at,updated_at=now() WHERE organization_id=ord.organization_id;
    ELSE UPDATE yingira.organization_subscriptions SET expires_at=now(),updated_at=now() WHERE organization_id=ord.organization_id; END IF;
   END IF;
  END IF;
  UPDATE yingira.pesapal_orders SET status=state,provider_mode=p_data->>'mode',tracking_id=(p_data->>'trackingId')::uuid,last_error=null,updated_at=now() WHERE id=ord.id;
  INSERT INTO yingira.payment_events(order_id,status,confirmation) VALUES(ord.id,state,left(p_data->>'confirmation',160));
  RETURN jsonb_build_object('status',state,'mode',p_data->>'mode');
 ELSE RAISE EXCEPTION 'Unsupported action'; END IF;
 RETURN jsonb_build_object('ok',true);
END $$;
GRANT CREATE ON SCHEMA public TO yingira_executor;
ALTER FUNCTION public.yingira_billing(text,jsonb) OWNER TO yingira_executor;
ALTER FUNCTION public.yingira_invoice_checkout(text,text,jsonb) OWNER TO yingira_executor;
ALTER FUNCTION public.yingira_pesapal_worker(text,jsonb) OWNER TO yingira_executor;
REVOKE CREATE ON SCHEMA public FROM yingira_executor;
REVOKE ALL ON FUNCTION public.yingira_billing(text,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.yingira_invoice_checkout(text,text,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.yingira_pesapal_worker(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.yingira_billing(text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.yingira_invoice_checkout(text,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.yingira_pesapal_worker(text,jsonb) TO service_role;
CREATE TABLE yingira.whatsapp_consents(invitation_id uuid PRIMARY KEY REFERENCES yingira.invitations(id),phone text NOT NULL,allowed boolean NOT NULL DEFAULT false,evidence text NOT NULL CHECK(length(evidence) BETWEEN 8 AND 500),actor_id uuid NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE yingira.whatsapp_suppressions(organization_id uuid NOT NULL REFERENCES yingira.organizations(id),phone text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,phone));
CREATE TABLE yingira.whatsapp_campaigns(id uuid PRIMARY KEY,event_id uuid NOT NULL REFERENCES yingira.events(id),kind text NOT NULL CHECK(kind IN('invitation','reminder')),scheduled_at timestamptz NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),template_sid text NOT NULL CHECK(template_sid ~ '^HX[0-9a-fA-F]{32}$'));
CREATE TABLE yingira.whatsapp_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),campaign_id uuid NOT NULL REFERENCES yingira.whatsapp_campaigns(id),invitation_id uuid NOT NULL REFERENCES yingira.invitations(id),token_id uuid NOT NULL REFERENCES yingira.tokens(id),phone text NOT NULL,status text NOT NULL DEFAULT 'queued' CHECK(status IN('queued','sending','accepted','sent','delivered','read','failed','unknown','cancelled')),provider_id text UNIQUE,attempted_at timestamptz,last_error text,updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(campaign_id,invitation_id));
CREATE INDEX whatsapp_campaign_event ON yingira.whatsapp_campaigns(event_id,scheduled_at);
CREATE INDEX whatsapp_queue ON yingira.whatsapp_messages(status,updated_at);
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['whatsapp_consents','whatsapp_suppressions','whatsapp_campaigns','whatsapp_messages'] LOOP
 EXECUTE format('ALTER TABLE yingira.%I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('ALTER TABLE yingira.%I FORCE ROW LEVEL SECURITY',t); EXECUTE format('REVOKE ALL ON yingira.%I FROM PUBLIC,anon,authenticated',t); EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON yingira.%I TO yingira_executor',t); EXECUTE format('CREATE POLICY executor_only ON yingira.%I TO yingira_executor USING(true) WITH CHECK(true)',t);
END LOOP; END $$;
CREATE FUNCTION public.yingira_whatsapp(p_action text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=yingira.actor_id(); eid uuid:=(p_data->>'eventId')::uuid; org uuid; inv yingira.invitations%rowtype; cid uuid:=(p_data->>'campaignId')::uuid; existing_campaign yingira.whatsapp_campaigns%rowtype; n integer;
BEGIN
 PERFORM 1 FROM yingira.profiles WHERE id=u AND NOT disabled FOR SHARE; IF NOT FOUND THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 SELECT organization_id INTO org FROM yingira.events WHERE id=eid FOR UPDATE;
 PERFORM 1 FROM yingira.organizations WHERE id=org AND active FOR SHARE; IF NOT FOUND THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM yingira.organization_members WHERE organization_id=org AND user_id=u AND active FOR SHARE; IF NOT FOUND THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501'; END IF;
 IF NOT yingira.check_rate('whatsapp:'||u,120) THEN RAISE EXCEPTION 'Please wait before trying again'; END IF;
 IF p_action='state' THEN RETURN jsonb_build_object('organizationId',org,'guests',coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'name',i.guest_name,'phone',i.phone,'allowed',coalesce(w.allowed AND w.phone=i.phone,false),'evidence',w.evidence,'suppressed',EXISTS(SELECT 1 FROM yingira.whatsapp_suppressions WHERE organization_id=org AND phone=i.phone),'responded',EXISTS(SELECT 1 FROM yingira.responses WHERE invitation_id=i.id),'revoked',NOT EXISTS(SELECT 1 FROM yingira.tokens WHERE invitation_id=i.id AND revoked_at IS NULL)) ORDER BY i.guest_name) FROM yingira.invitations i LEFT JOIN yingira.whatsapp_consents w ON w.invitation_id=i.id WHERE i.event_id=eid),'[]'),'messages',coalesce((SELECT jsonb_agg(x) FROM(SELECT m.id,campaign_id AS "campaignId",i.guest_name AS name,m.status,m.last_error AS "lastError",c.kind,c.scheduled_at AS "scheduledAt",m.updated_at AS "updatedAt" FROM yingira.whatsapp_messages m JOIN yingira.whatsapp_campaigns c ON c.id=m.campaign_id JOIN yingira.invitations i ON i.id=m.invitation_id WHERE c.event_id=eid ORDER BY c.created_at DESC,m.id LIMIT 500)x),'[]'));
 ELSIF p_action='consent' THEN
  SELECT * INTO inv FROM yingira.invitations WHERE id=(p_data->>'invitationId')::uuid AND event_id=eid; IF NOT FOUND THEN RAISE EXCEPTION 'Guest unavailable'; END IF;
  INSERT INTO yingira.whatsapp_consents(invitation_id,phone,allowed,evidence,actor_id) VALUES(inv.id,inv.phone,(p_data->>'allowed')::boolean,p_data->>'evidence',u) ON CONFLICT(invitation_id) DO UPDATE SET phone=excluded.phone,allowed=excluded.allowed,evidence=excluded.evidence,actor_id=u,updated_at=now();
  IF NOT (p_data->>'allowed')::boolean THEN UPDATE yingira.whatsapp_messages SET status='cancelled',updated_at=now() WHERE invitation_id=inv.id AND status='queued'; END IF;
 ELSIF p_action='queue' THEN
  IF jsonb_typeof(p_data->'guestIds') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'guestIds') NOT BETWEEN 1 AND 500 OR (p_data->>'scheduledAt')::timestamptz>now()+interval '90 days' THEN RAISE EXCEPTION 'Select 1–500 guests and a schedule within 90 days'; END IF;
  SELECT * INTO existing_campaign FROM yingira.whatsapp_campaigns WHERE id=cid;
  IF FOUND THEN IF existing_campaign.event_id<>eid OR existing_campaign.kind IS DISTINCT FROM p_data->>'kind' OR existing_campaign.template_sid IS DISTINCT FROM p_data->>'templateSid' OR existing_campaign.scheduled_at IS DISTINCT FROM (p_data->>'scheduledAt')::timestamptz THEN RAISE EXCEPTION 'Campaign key already used'; END IF; RETURN jsonb_build_object('queued',(SELECT count(*) FROM yingira.whatsapp_messages WHERE campaign_id=cid)); END IF;
  INSERT INTO yingira.whatsapp_campaigns(id,event_id,kind,scheduled_at,created_by,template_sid) VALUES(cid,eid,p_data->>'kind',(p_data->>'scheduledAt')::timestamptz,u,p_data->>'templateSid');
  INSERT INTO yingira.whatsapp_messages(campaign_id,invitation_id,token_id,phone) SELECT cid,i.id,t.id,i.phone FROM yingira.invitations i JOIN yingira.tokens t ON t.invitation_id=i.id AND t.revoked_at IS NULL JOIN yingira.whatsapp_consents w ON w.invitation_id=i.id AND w.allowed AND w.phone=i.phone WHERE i.event_id=eid AND i.id IN(SELECT value::uuid FROM jsonb_array_elements_text(p_data->'guestIds')) AND NOT EXISTS(SELECT 1 FROM yingira.whatsapp_suppressions WHERE organization_id=org AND phone=i.phone) AND (p_data->>'kind'<>'reminder' OR NOT EXISTS(SELECT 1 FROM yingira.responses WHERE invitation_id=i.id));
  GET DIAGNOSTICS n=ROW_COUNT; IF n=0 THEN RAISE EXCEPTION 'No eligible guests: check consent, responses and invitation status'; END IF;
  RETURN jsonb_build_object('queued',n);
 ELSIF p_action='cancel' THEN
  UPDATE yingira.whatsapp_messages m SET status='cancelled',updated_at=now() FROM yingira.whatsapp_campaigns c WHERE m.campaign_id=c.id AND c.id=cid AND c.event_id=eid AND m.status='queued';
 ELSE RAISE EXCEPTION 'Unsupported action'; END IF;
 INSERT INTO yingira.audit(organization_id,event_id,actor_id,action,entity_id,metadata) VALUES(org,eid,u,'WHATSAPP_'||upper(p_action),coalesce(inv.id,cid),CASE WHEN p_action='consent' THEN jsonb_build_object('allowed',p_data->'allowed','evidence',p_data->>'evidence','phone',inv.phone) ELSE '{}'::jsonb END);
 RETURN jsonb_build_object('ok',true);
END $$;
CREATE FUNCTION public.yingira_whatsapp_worker(p_action text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE msg yingira.whatsapp_messages%rowtype; camp yingira.whatsapp_campaigns%rowtype; inv yingira.invitations%rowtype; ev yingira.events%rowtype; tok yingira.tokens%rowtype; st text:=p_data->>'status'; org uuid:=(p_data->>'organizationId')::uuid;
BEGIN
 IF p_action='claim' THEN
  UPDATE yingira.whatsapp_messages SET status='unknown',last_error='Delivery request was interrupted. Check provider records before any resend.',updated_at=now() WHERE status='sending' AND attempted_at<now()-interval '5 minutes';
  SELECT m.* INTO msg FROM yingira.whatsapp_messages m JOIN yingira.whatsapp_campaigns c ON c.id=m.campaign_id JOIN yingira.events e ON e.id=c.event_id WHERE m.status='queued' AND c.scheduled_at<=now() AND (p_data->>'eventId' IS NULL OR e.id=(p_data->>'eventId')::uuid) AND e.organization_id IN(SELECT value::uuid FROM jsonb_array_elements_text(p_data->'organizations')) ORDER BY c.scheduled_at,m.id FOR UPDATE OF m SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN null; END IF;
  SELECT * INTO camp FROM yingira.whatsapp_campaigns WHERE id=msg.campaign_id;
  SELECT * INTO inv FROM yingira.invitations WHERE id=msg.invitation_id;
  SELECT * INTO ev FROM yingira.events WHERE id=camp.event_id;
  SELECT * INTO tok FROM yingira.tokens WHERE id=msg.token_id;
  IF ev.status='closed' OR tok.revoked_at IS NOT NULL OR inv.phone<>msg.phone OR NOT EXISTS(SELECT 1 FROM yingira.organizations WHERE id=ev.organization_id AND active) OR NOT EXISTS(SELECT 1 FROM yingira.whatsapp_consents WHERE invitation_id=inv.id AND phone=msg.phone AND allowed) OR EXISTS(SELECT 1 FROM yingira.whatsapp_suppressions WHERE organization_id=ev.organization_id AND phone=msg.phone) OR (camp.kind='reminder' AND EXISTS(SELECT 1 FROM yingira.responses WHERE invitation_id=inv.id)) THEN UPDATE yingira.whatsapp_messages SET status='cancelled',updated_at=now() WHERE id=msg.id; RETURN jsonb_build_object('skipped',true); END IF;
  UPDATE yingira.whatsapp_messages SET status='sending',attempted_at=now(),updated_at=now() WHERE id=msg.id;
  RETURN jsonb_build_object('id',msg.id,'organizationId',ev.organization_id,'phone',msg.phone,'name',inv.guest_name,'title',ev.title,'ciphertext',tok.ciphertext,'templateSid',camp.template_sid);
 ELSIF p_action='context' THEN
  SELECT * INTO msg FROM yingira.whatsapp_messages WHERE id=(p_data->>'id')::uuid; IF NOT FOUND THEN RETURN null; END IF;
  RETURN jsonb_build_object('organizationId',(SELECT e.organization_id FROM yingira.events e JOIN yingira.whatsapp_campaigns c ON c.event_id=e.id WHERE c.id=msg.campaign_id),'providerId',msg.provider_id);
 ELSIF p_action='status' THEN
  SELECT * INTO msg FROM yingira.whatsapp_messages WHERE id=(p_data->>'id')::uuid FOR UPDATE; IF NOT FOUND THEN RETURN null; END IF;
  IF st NOT IN('accepted','sent','delivered','read','failed','unknown') OR msg.status IN('cancelled','queued') THEN RAISE EXCEPTION 'Invalid delivery update'; END IF;
  IF msg.provider_id IS NOT NULL AND p_data->>'providerId' IS NOT NULL AND msg.provider_id<>p_data->>'providerId' THEN RAISE EXCEPTION 'Provider ID mismatch'; END IF;
  IF msg.status='read' OR (msg.status='delivered' AND st<>'read') OR (msg.status='sent' AND st='accepted') OR (msg.status='failed' AND st IN('accepted','sent','unknown')) THEN RETURN jsonb_build_object('ok',true); END IF;
  UPDATE yingira.whatsapp_messages SET status=st,provider_id=coalesce(provider_id,p_data->>'providerId'),last_error=left(p_data->>'error',300),updated_at=now() WHERE id=msg.id;
 ELSIF p_action='stop' THEN
  IF p_data->>'phone' !~ '^\+[1-9][0-9]{7,14}$' OR org IS NULL THEN RAISE EXCEPTION 'Invalid opt-out'; END IF;
  INSERT INTO yingira.whatsapp_suppressions(organization_id,phone) VALUES(org,p_data->>'phone') ON CONFLICT DO NOTHING;
  UPDATE yingira.whatsapp_messages m SET status='cancelled',updated_at=now() FROM yingira.whatsapp_campaigns c JOIN yingira.events e ON e.id=c.event_id WHERE m.campaign_id=c.id AND e.organization_id=org AND m.phone=p_data->>'phone' AND m.status='queued';
 ELSE RAISE EXCEPTION 'Unsupported action'; END IF;
 RETURN jsonb_build_object('ok',true);
END $$;
GRANT CREATE ON SCHEMA public TO yingira_executor;
ALTER FUNCTION public.yingira_whatsapp(text,jsonb) OWNER TO yingira_executor;
ALTER FUNCTION public.yingira_whatsapp_worker(text,jsonb) OWNER TO yingira_executor;
REVOKE CREATE ON SCHEMA public FROM yingira_executor;
REVOKE ALL ON FUNCTION public.yingira_whatsapp(text,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.yingira_whatsapp_worker(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.yingira_whatsapp(text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.yingira_whatsapp_worker(text,jsonb) TO service_role;
