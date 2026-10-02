-- Registra cada abertura do app (1 insert por carregamento, ver app.js) pra
-- dar visibilidade real de uso na visão gerencial. "Último login" (do Auth
-- do Supabase) só muda quando a sessão expira e a pessoa precisa logar nela
-- de novo — numa sessão longa isso pode ficar semanas sem acontecer mesmo
-- com uso diário — então sozinho ele não serve pra saber se alguém tá
-- realmente usando o app. app_opens é a fonte de verdade do "último acesso".

create table if not exists public.app_opens (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists app_opens_user_created_idx on public.app_opens (user_id, created_at desc);

alter table public.app_opens enable row level security;

grant select, insert on public.app_opens to authenticated;

-- Sem policy de select: ninguém lê os registros de abertura dos outros (nem
-- os próprios, via client) — só a função admin_usage_stats (security
-- definer) consegue agregar isso, e só devolve algo pro e-mail admin.
drop policy if exists app_opens_insert_own on public.app_opens;
create policy app_opens_insert_own on public.app_opens
  for insert with check (auth.uid() = user_id or user_id is null);
