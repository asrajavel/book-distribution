-- Row-rule test with fake users. Run in the SQL editor; it always rolls back.
-- Ends with the error "ALL TESTS PASSED", or the first failing check.
do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); uc uuid := gen_random_uuid();
  ud uuid := gen_random_uuid(); ue uuid := gen_random_uuid();
  a bigint; b bigint; c bigint; d bigint;
  bk1 bigint; bk2 bigint; pl bigint; ev bigint; ev_b bigint; en bigint; n int; t text;
begin
  -- Setup as postgres
  insert into auth.users (id, email) values
    (ua, 't_a@x.test'), (ub, 't_b@x.test'), (uc, 't_c@x.test'), (ud, 't_d@x.test'), (ue, 't_e@x.test');
  insert into people (user_id, email, name, phone) values (ua, 't_a@x.test', 'A', '1111111111') returning id into a;
  insert into people (user_id, email, name, phone) values (ub, 't_b@x.test', 'B', '2222222222') returning id into b;
  insert into people (user_id, email, name, phone) values (uc, 't_c@x.test', 'C', '3333333333') returning id into c;
  insert into people (email, name, phone, is_admin) values ('t_d@x.test', 'D', '4444444444', true) returning id into d;
  insert into books (name, language, kind, price) values ('T Book 1', 'ENG', 'common', 100) returning id into bk1;
  insert into books (name, language, kind, price) values ('T Book 2', 'ENG', 'rare', 250) returning id into bk2;

  -- A starts an event with B and records an entry
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'email', 't_a@x.test', 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into places (name, lat, lng) values ('T Place', 12.97, 77.59) returning id into pl;
  ev := start_event(current_date, pl, array[b]);
  select count(*) into n from event_volunteers where event_id = ev;
  if n <> 2 then raise exception 'host + B should be on the event, got %', n; end if;
  en := save_entry(ev, jsonb_build_array(jsonb_build_object('book_id', bk1, 'qty', 2), jsonb_build_object('book_id', bk2, 'qty', 0)));
  select count(*) into n from entry_lines where entry_id = en;
  if n <> 1 then raise exception 'qty 0 line should be dropped, got % lines', n; end if;
  begin ev := start_event(current_date, pl, '{}'); raise exception 'second open event allowed';
  exception when unique_violation then null; end;
  delete from event_volunteers where event_id = ev and person_id = a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'host removed self'; end if;
  begin insert into people (email, name, phone) values ('t_x@x.test', 'X', '5555555555'); raise exception 'non-admin added a person';
  exception when insufficient_privilege then null; end;

  -- B: open event is hidden, can't record, can start own
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'email', 't_b@x.test', 'role', 'authenticated')::text, true);
  select count(*) into n from events where id = ev;
  if n <> 0 then raise exception 'volunteer sees open event'; end if;
  begin perform save_entry(ev, jsonb_build_array(jsonb_build_object('book_id', bk1, 'qty', 1))); raise exception 'volunteer recorded entry';
  exception when raise_exception then if sqlerrm not like 'Only the host%' then raise; end if; end;
  ev_b := start_event(current_date, pl, '{}');
  begin select phone into t from people limit 1; raise exception 'phone readable';
  exception when insufficient_privilege then null; end;

  -- A closes the event
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'email', 't_a@x.test', 'role', 'authenticated')::text, true);
  perform close_event(ev, jsonb_build_object(a::text, 2.5, b::text, 1.5));
  select hours::text into t from event_volunteers where event_id = ev and person_id = b;
  if t <> '1.5' then raise exception 'hours not saved: %', t; end if;

  -- B now sees it but can't change it
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'email', 't_b@x.test', 'role', 'authenticated')::text, true);
  select count(*) into n from entry_lines l join entries e on e.id = l.entry_id where e.event_id = ev;
  if n <> 1 then raise exception 'volunteer cannot see closed event lines'; end if;
  update events set date = current_date - 1 where id = ev;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'volunteer edited event'; end if;
  delete from entries where event_id = ev;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'volunteer deleted entry'; end if;

  -- C sees neither event
  perform set_config('request.jwt.claims', json_build_object('sub', uc, 'email', 't_c@x.test', 'role', 'authenticated')::text, true);
  select count(*) into n from events where id in (ev, ev_b);
  if n <> 0 then raise exception 'outsider sees events'; end if;

  -- D: pre-added admin links on first sign-in, sees everything, reads audit
  perform set_config('request.jwt.claims', json_build_object('sub', ud, 'email', 'T_D@x.test', 'role', 'authenticated')::text, true);
  select id into n from my_person();
  if n is distinct from d then raise exception 'admin row not linked'; end if;
  select count(*) into n from events where id in (ev, ev_b);
  if n <> 2 then raise exception 'admin sees % of 2 events', n; end if;
  select count(*) into n from audit_log where table_name = 'entry_lines';
  if n = 0 then raise exception 'audit empty'; end if;
  insert into people (email, name, phone) values ('t_y@x.test', 'Y', '6666666666');

  -- A deletes the entry; audit keeps it
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'email', 't_a@x.test', 'role', 'authenticated')::text, true);
  delete from entries where id = en;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'host could not delete entry'; end if;
  select count(*) into n from audit_log;
  if n <> 0 then raise exception 'non-admin reads audit'; end if;

  -- E signs up; phone keeps last 10 digits
  perform set_config('request.jwt.claims', json_build_object('sub', ue, 'email', 't_e@x.test', 'role', 'authenticated')::text, true);
  select count(*) into n from my_person();
  if n <> 0 then raise exception 'new user already has a row'; end if;
  perform sign_up(' E ', '+91 98765 43210');

  execute 'reset role';
  select phone into t from people where user_id = ue;
  if t <> '9876543210' then raise exception 'phone stored as %', t; end if;
  select count(*) into n from audit_log where action = 'DELETE' and table_name = 'entry_lines' and person_id = a;
  if n <> 1 then raise exception 'cascade delete not audited'; end if;

  raise exception 'ALL TESTS PASSED';
end $$;
