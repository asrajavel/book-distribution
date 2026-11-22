-- Book Distribution: Supabase schema. Run once in the SQL editor of a new project.
-- Make someone admin in the table editor: people.is_admin = true (and approved = true for the first one).
-- The client must name columns when reading people (select('id, name')): select('*') is denied.

alter database postgres set timezone to 'Asia/Kolkata';  -- IST for now(), current_date and every timestamp
set timezone to 'Asia/Kolkata';

create schema private;   -- helpers for the row rules; not exposed by the Data API

-- Tables ---------------------------------------------------------------------

create table people (
  id        bigint generated always as identity primary key,
  user_id   uuid unique references auth.users on delete set null,
  email     text unique check (email = lower(email)),              -- shown to admins on the request
  name      text not null check (trim(name) <> ''),
  phone     text check (phone ~ '^[0-9]{10}$'),                      -- stored only
  is_admin  boolean not null default false,
  approved  boolean not null default false,                          -- sign-up is a request until an admin approves
  photo     text check (photo like 'https://lh3.googleusercontent.com/%'),  -- Google photo, refreshed on sign-in
  guest     boolean not null default false,                          -- no Google account, added by name (add_guest)
  constraint people_guest_check check (case when guest then user_id is null else email is not null and phone is not null end)
);

create table books (
  id          bigint generated always as identity primary key,
  name        text not null,
  short_name  text,
  language    text not null check (language ~ '^[A-Z]{3}$'),
  kind        text not null check (kind in ('common', 'rare', 'kids')),
  price       int not null check (price >= 0),                       -- whole rupees
  unique (name, language),
  check (kind <> 'kids' or language = 'ENG')
);

create table places (
  id    bigint generated always as identity primary key,
  name  text not null check (trim(name) <> ''),
  lat   double precision not null,
  lng   double precision not null
);
create unique index places_name_unique on places (lower(trim(name)));  -- "Market" = "market "

create table events (
  id          bigint generated always as identity primary key,
  date        date not null check (date <= current_date),            -- today or past, in IST
  place_id    bigint not null references places,
  host_id     bigint not null references people,
  started_at  timestamptz not null default now(),
  closed_at   timestamptz                                            -- null while open
);
create unique index one_open_event_per_host on events (host_id) where closed_at is null;

create table event_volunteers (
  event_id   bigint references events on delete cascade,
  person_id  bigint references people,
  hours      numeric(4,1) check (hours >= 0),                        -- null until closed
  primary key (event_id, person_id)
);
create index on event_volunteers (person_id);

create table entries (
  id        bigint generated always as identity primary key,
  event_id  bigint not null references events on delete cascade,
  at        timestamptz not null default now()
);
create index on entries (event_id);

create table entry_lines (
  entry_id  bigint references entries on delete cascade,
  book_id   bigint references books,
  qty       int not null check (qty > 0),
  price     int not null check (price >= 0),                         -- book price at the time of sale
  primary key (entry_id, book_id)
);

create table audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  person_id   bigint,                                                -- null for SQL editor changes
  action      text not null,
  table_name  text not null,
  old_row     jsonb,
  new_row     jsonb,
  tx_id       bigint not null default txid_current()
);

-- Helpers for the row rules (security definer, so rules don't call each other in a loop)
-- An unapproved person counts as nobody, so every rule shuts them out.

create function private.me() returns bigint
language sql stable security definer set search_path = '' as $$
  select id from public.people where user_id = auth.uid() and approved
$$;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_admin and approved from public.people where user_id = auth.uid()), false)
$$;

create function private.is_host(e bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.events where id = e and host_id = private.me())
$$;

-- Host, admin, or a volunteer on it once it is closed.
create function private.can_see_event(e bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.events v
    where v.id = e
      and (v.host_id = private.me()
           or private.is_admin()
           or (v.closed_at is not null and exists (
                 select 1 from public.event_volunteers x
                 where x.event_id = e and x.person_id = private.me()))))
$$;

-- Row rules --------------------------------------------------------------------

alter table people           enable row level security;
alter table books            enable row level security;
alter table places           enable row level security;
alter table events           enable row level security;
alter table event_volunteers enable row level security;
alter table entries          enable row level security;
alter table entry_lines      enable row level security;
alter table audit_log        enable row level security;

-- Approved people, plus anyone on an event I can see (so a removed volunteer keeps their name there).
create policy read on people for select to authenticated
  using ((select private.me()) is not null
         and (approved or exists (select 1 from public.event_volunteers v where v.person_id = people.id)));

create policy read on books  for select to authenticated using (true);

create policy read on places for select to authenticated using (true);
create policy add  on places for insert to authenticated with check (true);

create policy read   on events for select to authenticated using (private.can_see_event(id));
create policy edit   on events for update to authenticated using (private.is_host(id));
create policy remove on events for delete to authenticated using (private.is_host(id));

create policy read   on event_volunteers for select to authenticated using (private.can_see_event(event_id));
create policy add    on event_volunteers for insert to authenticated with check (private.is_host(event_id));
create policy hours  on event_volunteers for update to authenticated using (private.is_host(event_id));
create policy remove on event_volunteers for delete to authenticated
  using (private.is_host(event_id) and person_id <> (select private.me()));  -- host stays on

create policy read   on entries for select to authenticated using (private.can_see_event(event_id));
create policy remove on entries for delete to authenticated using (private.is_host(event_id));

create policy read on entry_lines for select to authenticated
  using (private.can_see_event((select event_id from public.entries where id = entry_id)));

create policy read on audit_log for select to authenticated using ((select private.is_admin()));

-- Functions the app calls (supabase.rpc) -------------------------------------------

-- Google photo of the signed-in user (Supabase copies it from Google at sign-in). Only a Google photo address is kept.
create function private.my_photo() returns text
language sql stable security definer set search_path = '' as $$
  select raw_user_meta_data ->> 'avatar_url' from auth.users
  where id = auth.uid() and raw_user_meta_data ->> 'avatar_url' like 'https://lh3.googleusercontent.com/%'
$$;

-- Signed-in person's row (approved or not), or nothing (then show sign up). Refreshes the photo.
create function public.my_person() returns setof public.people
language plpgsql security definer set search_path = '' as $$
begin
  update public.people set photo = private.my_photo()
  where user_id = auth.uid() and photo is distinct from private.my_photo();
  return query select * from public.people where user_id = auth.uid();
end $$;

create function public.sign_up(p_name text, p_phone text) returns setof public.people
language sql security definer set search_path = '' as $$
  insert into public.people (user_id, email, name, phone, photo)
  values (auth.uid(), lower(auth.jwt() ->> 'email'), trim(p_name),
          right(regexp_replace(p_phone, '\D', '', 'g'), 10),           -- "+91 98..." -> 10 digits
          private.my_photo())
  returning *
$$;

-- Everyone, with phone and email, for the admin's People tab. Requests are the ones not approved:
-- approve or reject (reject deletes it; they can ask again).
create function public.admin_people() returns table (id bigint, name text, phone text, email text, photo text, approved boolean, is_admin boolean, guest boolean)
language sql stable security definer set search_path = '' as $$
  select id, name, phone, email, photo, approved, is_admin, guest from public.people
  where private.is_admin() order by name
$$;

-- Guest: a volunteer without the app, added by name from the volunteer picker. Reuses a guest of the same name.
create function public.add_guest(p_name text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  if private.me() is null then raise exception 'Not signed up'; end if;
  if trim(coalesce(p_name, '')) = '' then raise exception 'Name needed'; end if;
  select id into v_id from public.people where guest and lower(name) = lower(trim(p_name)) limit 1;
  if v_id is null then
    insert into public.people (name, guest, approved) values (trim(p_name), true, true) returning id into v_id;
  end if;
  return v_id;
end $$;

create function public.approve(p_person bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Only admins can approve'; end if;
  update public.people set approved = true where id = p_person;
end $$;

create function public.reject(p_person bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Only admins can reject'; end if;
  delete from public.people where id = p_person and not approved;
end $$;

-- Host is always added. One open event per host is enforced by the unique index.
create function public.start_event(p_date date, p_place bigint, p_volunteers bigint[]) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_me bigint := private.me();
  v_event bigint;
begin
  if v_me is null then raise exception 'Not signed up'; end if;
  insert into public.events (date, place_id, host_id) values (p_date, p_place, v_me)
  returning id into v_event;
  insert into public.event_volunteers (event_id, person_id)
  select distinct v_event, p from unnest(p_volunteers || v_me) p;
  return v_event;
end $$;

-- Edit event: date, place and volunteers in one save. The host always stays on.
create function public.update_event(p_event bigint, p_date date, p_place bigint, p_volunteers bigint[]) returns void
language plpgsql security definer set search_path = '' as $$
declare v_host bigint := private.me();
begin
  if not private.is_host(p_event) then raise exception 'Only the host can edit the event'; end if;
  update public.events set date = p_date, place_id = p_place where id = p_event;
  delete from public.event_volunteers
  where event_id = p_event and person_id <> v_host and person_id <> all (p_volunteers);
  insert into public.event_volunteers (event_id, person_id)
  select p_event, p from unnest(p_volunteers) p on conflict do nothing;
end $$;

-- p_lines: [{"book_id": 1, "qty": 2}, ...]. New entry when p_entry is null, else replaces its lines.
-- Qty 0 means not on the entry. New books take today's price; books already on it keep their price.
create function public.save_entry(p_event bigint, p_lines jsonb, p_entry bigint default null) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_entry bigint := p_entry;
begin
  if not private.is_host(p_event) then raise exception 'Only the host can record entries'; end if;
  select coalesce(jsonb_agg(l), '[]') into p_lines
  from jsonb_array_elements(coalesce(p_lines, '[]')) l where (l ->> 'qty')::int > 0;
  if jsonb_array_length(p_lines) = 0 then raise exception 'No books'; end if;

  if v_entry is null then
    insert into public.entries (event_id) values (p_event) returning id into v_entry;
  elsif not exists (select 1 from public.entries where id = v_entry and event_id = p_event) then
    raise exception 'Entry is not in this event';
  end if;

  delete from public.entry_lines
  where entry_id = v_entry
    and book_id not in (select (l ->> 'book_id')::bigint from jsonb_array_elements(p_lines) l);

  insert into public.entry_lines (entry_id, book_id, qty, price)
  select v_entry, b.id, (l ->> 'qty')::int, b.price
  from jsonb_array_elements(p_lines) l
  join public.books b on b.id = (l ->> 'book_id')::bigint
  on conflict (entry_id, book_id) do update set qty = excluded.qty;

  return v_entry;
end $$;

-- p_hours: {"<person_id>": 2.5, ...}
create function public.close_event(p_event bigint, p_hours jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_host(p_event) then raise exception 'Only the host can close the event'; end if;
  update public.event_volunteers set hours = (p_hours ->> person_id::text)::numeric
  where event_id = p_event;
  update public.events set closed_at = now() where id = p_event and closed_at is null;
end $$;

-- Audit: every insert, update and delete, cascades included ---------------------

create function private.audit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log (person_id, action, table_name, old_row, new_row)
  values (private.me(), tg_op, tg_table_name,
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return null;
end $$;

create trigger audit after insert or update or delete on people           for each row execute function private.audit();
create trigger audit after insert or update or delete on books            for each row execute function private.audit();
create trigger audit after insert or update or delete on places           for each row execute function private.audit();
create trigger audit after insert or update or delete on events           for each row execute function private.audit();
create trigger audit after insert or update or delete on event_volunteers for each row execute function private.audit();
create trigger audit after insert or update or delete on entries          for each row execute function private.audit();
create trigger audit after insert or update or delete on entry_lines      for each row execute function private.audit();

-- Grants: signed-in users only, nothing for anon ------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public, private from public, anon, authenticated;

grant select (id, name, photo, approved, guest) on people      to authenticated;  -- phone and email stay private
grant select                        on books            to authenticated;
grant select, insert (name, lat, lng) on places         to authenticated;
grant select, delete, update (date, place_id) on events to authenticated;
grant select, delete, insert (event_id, person_id), update (hours) on event_volunteers to authenticated;
grant select, delete                on entries          to authenticated;
grant select                        on entry_lines      to authenticated;
grant select                        on audit_log        to authenticated;

grant usage on schema private to authenticated;
grant execute on function private.me(), private.is_admin(), private.is_host(bigint),
                          private.can_see_event(bigint) to authenticated;
grant execute on function public.my_person(), public.sign_up(text, text),
                          public.admin_people(), public.add_guest(text), public.approve(bigint), public.reject(bigint),
                          public.start_event(date, bigint, bigint[]),
                          public.update_event(bigint, date, bigint, bigint[]),
                          public.save_entry(bigint, jsonb, bigint),
                          public.close_event(bigint, jsonb) to authenticated;
