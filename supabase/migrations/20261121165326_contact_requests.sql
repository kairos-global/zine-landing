create table public.contact_requests (
  id uuid primary key,
  created_at timestamptz not null default now(),
  topic text not null check (topic in ('map', 'distribution', 'publishing', 'order', 'general')),
  name text not null check (char_length(name) between 2 and 100),
  email text not null check (char_length(email) between 3 and 254),
  reference text not null default '' check (char_length(reference) <= 250),
  message text not null check (char_length(message) between 10 and 4000),
  source_key text not null,
  status text not null default 'new' check (status in ('new', 'in_progress', 'resolved')),
  notification_status text not null default 'pending' check (notification_status in ('pending', 'sent', 'failed', 'unconfigured')),
  gmail_message_id text
);
alter table public.contact_requests enable row level security;
revoke all on table public.contact_requests from public, anon, authenticated;
grant select, insert, update on table public.contact_requests to service_role;
create index contact_requests_created_at_idx on public.contact_requests (created_at desc, id);
create index contact_requests_source_rate_idx on public.contact_requests (source_key, created_at desc);
create index contact_requests_email_rate_idx on public.contact_requests (lower(email), created_at desc);

create function public.submit_contact_request(
  request_id uuid, request_topic text, request_name text, request_email text,
  request_reference text, request_message text, request_source text
) returns text
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(1201061, pg_catalog.hashtext(request_id::text));
  perform pg_catalog.pg_advisory_xact_lock(1201062, pg_catalog.hashtext(request_source));
  perform pg_catalog.pg_advisory_xact_lock(1201063, pg_catalog.hashtext(lower(request_email)));

  if exists (
    select 1 from public.contact_requests
    where id = request_id and topic = request_topic and name = request_name
      and email = request_email and reference = request_reference and message = request_message
  ) then return 'existing'; end if;
  if exists (select 1 from public.contact_requests where id = request_id) then return 'conflict'; end if;
  if (
    select count(*) from public.contact_requests
    where source_key = request_source and created_at >= now() - interval '1 hour'
  ) >= 8 or (
    select count(*) from public.contact_requests
    where lower(email) = lower(request_email) and created_at >= now() - interval '1 hour'
  ) >= 4 then return 'limited'; end if;

  insert into public.contact_requests (id, topic, name, email, reference, message, source_key)
  values (request_id, request_topic, request_name, request_email, request_reference, request_message, request_source);
  return 'created';
end;
$$;
revoke all on function public.submit_contact_request(uuid, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_contact_request(uuid, text, text, text, text, text, text) to service_role;
