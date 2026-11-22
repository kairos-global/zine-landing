create schema if not exists private;

create table public.deleted_zine_drafts (
  id uuid primary key,
  owner_id uuid not null,
  asset_paths text[] not null default '{}'
);
alter table public.deleted_zine_drafts enable row level security;
revoke all on public.deleted_zine_drafts from public, anon, authenticated;
grant select, insert, update on public.deleted_zine_drafts to service_role;

create function private.prevent_deleted_zine_restore() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.deleted_zine_drafts where id = new.id) then
    raise exception 'This draft has been permanently deleted.' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.prevent_deleted_zine_restore() from public, anon, authenticated;
create trigger prevent_deleted_zine_restore
  before insert on public.issues for each row execute function private.prevent_deleted_zine_restore();

create table public.kept_zine_editions (
  issue_id uuid primary key references public.issues(id) on delete cascade,
  title text,
  cover_img_url text,
  pdf_url text,
  category public.zine_category,
  zine_format text
);
alter table public.kept_zine_editions enable row level security;
revoke all on public.kept_zine_editions from public, anon, authenticated;
grant select, insert, update, delete on public.kept_zine_editions to service_role;

create function public.change_zine_library(target uuid, owner uuid, operation text) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  entry public.issues%rowtype;
  paths text[];
begin
  select * into entry from public.issues where id = target and profile_id = owner for update;
  if not found then
    if operation = 'delete' then
      select asset_paths into paths from public.deleted_zine_drafts where id = target and owner_id = owner;
      if found then return jsonb_build_object('status','deleted','paths',paths); end if;
    end if;
    return jsonb_build_object('status','missing');
  end if;

  if operation = 'delete' then
    if entry.status is distinct from 'draft' or entry.published_at is not null then
      return jsonb_build_object('status','conflict');
    end if;

    select coalesce(array_agg(name), '{}') into paths from storage.objects
    where bucket_id = 'zineground' and (
      name = 'canvas/' || target::text || '.json'
      or name = 'issues/' || target::text || '.pdf'
      or name like 'issues/' || target::text || '/%'
      or name like 'covers/' || target::text || '/%'
      or name like 'covers/' || target::text || '.%'
      or name like 'qr-codes/' || target::text || '/%'
      or name in (select 'qr-codes/' || link.id::text || '.png' from public.issue_links link where link.issue_id = target)
    );
    insert into public.deleted_zine_drafts (id, owner_id, asset_paths) values (target, owner, paths);
    delete from public.issues where id = target;
    return jsonb_build_object('status','deleted','paths',paths);
  end if;

  if operation not in ('keep','remove') then return jsonb_build_object('status','conflict'); end if;
  if entry.status is distinct from 'published' and (entry.status is distinct from 'draft' or entry.published_at is null) then
    return jsonb_build_object('status','conflict');
  end if;

  if operation = 'keep' and entry.status = 'published' then
    insert into public.kept_zine_editions (issue_id, title, cover_img_url, pdf_url, category, zine_format)
    values (target, entry.title, entry.cover_img_url, entry.pdf_url, entry.category, entry.zine_format)
    on conflict (issue_id) do update set title = excluded.title, cover_img_url = excluded.cover_img_url,
      pdf_url = excluded.pdf_url, category = excluded.category, zine_format = excluded.zine_format;
  elsif operation = 'remove' then
    delete from public.collections where issue_id = target;
    delete from public.kept_zine_editions where issue_id = target;
  end if;

  update public.issues set status = 'draft', published_at = coalesce(published_at, current_date) where id = target;
  return jsonb_build_object('status','unpublished');
end;
$$;
revoke all on function public.change_zine_library(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.change_zine_library(uuid,uuid,text) to service_role;

create function public.collect_zine(target uuid, reader uuid) returns boolean
language plpgsql security invoker set search_path = ''
as $$
begin
  perform id from public.issues where id = target and status = 'published' for share;
  if not found then return false; end if;
  insert into public.collections (issue_id, profile_id) values (target, reader)
    on conflict (profile_id, issue_id) do nothing;
  return true;
end;
$$;
revoke all on function public.collect_zine(uuid,uuid) from public, anon, authenticated;
grant execute on function public.collect_zine(uuid,uuid) to service_role;

create table public.zine_recommendations (
  distributor_id uuid not null references public.distributors(id) on delete cascade,
  issue_id uuid not null references public.issues(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (distributor_id, issue_id, profile_id)
);
alter table public.zine_recommendations enable row level security;
revoke all on public.zine_recommendations from public, anon, authenticated;
grant select, insert on public.zine_recommendations to service_role;
create index zine_recommendations_issue_id_idx on public.zine_recommendations (issue_id);
create index zine_recommendations_profile_id_idx on public.zine_recommendations (profile_id);
