-- Shared control ledger; financial source rows are never seeded into Git.
create table if not exists public.tp_rit_control (
 id text primary key check (id = 'main'),
 revision bigint not null default 0 check (revision >= 0),
 state jsonb not null,
 constraint tp_rit_revision_matches check ((state->>'revision')::bigint = revision)
);
alter table public.tp_rit_control enable row level security;
revoke all on public.tp_rit_control from anon, authenticated;
grant select, update on public.tp_rit_control to authenticated;
drop policy if exists tp_rit_team_read on public.tp_rit_control;
create policy tp_rit_team_read on public.tp_rit_control for select to authenticated
 using (id = 'main' and lower(auth.jwt()->>'email') in ('jefriadriann@gmail.com','erwin.batista15@gmail.com'));
drop policy if exists tp_rit_team_write on public.tp_rit_control;
create policy tp_rit_team_write on public.tp_rit_control for update to authenticated
 using (id = 'main' and lower(auth.jwt()->>'email') in ('jefriadriann@gmail.com','erwin.batista15@gmail.com'))
 with check (id = 'main' and lower(auth.jwt()->>'email') in ('jefriadriann@gmail.com','erwin.batista15@gmail.com'));
insert into public.tp_rit_control(id,revision,state) values ('main',0,
 '{"version":1,"revision":0,"owners":["","",""],"packages":[],"audit":[]}'::jsonb)
on conflict (id) do nothing;
