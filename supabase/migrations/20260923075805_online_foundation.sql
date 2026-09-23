-- Non-login command owner, intentionally separate from browser-facing roles.
do $$ begin
 if not exists(select 1 from pg_roles where rolname='yingira_executor') then
  create role yingira_executor nologin noinherit;
 end if;
end $$;
grant yingira_executor to postgres;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema extensions to yingira_executor;
