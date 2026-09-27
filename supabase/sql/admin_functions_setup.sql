-- Funções de admin: rodam com privilégio elevado (security definer), mas só
-- devolvem dados de verdade se quem chamou for o e-mail admin — pra
-- qualquer outro usuário, o "where" abaixo dá falso pra toda linha e volta
-- vazio. Não é só esconder botão no app: é checado aqui dentro do banco.

create or replace function public.admin_usage_stats()
returns table (
  user_id uuid,
  email text,
  cadastrou_em timestamptz,
  ultimo_login timestamptz,
  ultima_atualizacao timestamptz,
  fez_onboarding boolean,
  conectou_strava boolean,
  dias_ativos_7d bigint,
  dias_ativos_30d bigint
)
language sql
security definer
set search_path = public, auth
as $$
  select
    u.id,
    u.email,
    u.created_at,
    u.last_sign_in_at,
    ad.updated_at,
    (ad.treinos is not null and jsonb_array_length(ad.treinos) > 0),
    (sc.user_id is not null),
    (select count(*) from jsonb_object_keys(coalesce(ad.sessions, '{}'::jsonb)) d
       where d::date >= current_date - interval '7 days'),
    (select count(*) from jsonb_object_keys(coalesce(ad.sessions, '{}'::jsonb)) d
       where d::date >= current_date - interval '30 days')
  from auth.users u
  left join public.app_data ad on ad.user_id = u.id
  left join public.strava_connections sc on sc.user_id = u.id
  where (select email from auth.users where id = auth.uid()) = 'ardurso@gmail.com'
  order by u.created_at desc;
$$;

grant execute on function public.admin_usage_stats() to authenticated;

create or replace function public.admin_client_errors(limit_n int default 50)
returns table (
  created_at timestamptz,
  email text,
  context text,
  message text
)
language sql
security definer
set search_path = public, auth
as $$
  select ce.created_at, u.email, ce.context, ce.message
  from public.client_errors ce
  left join auth.users u on u.id = ce.user_id
  where (select email from auth.users where id = auth.uid()) = 'ardurso@gmail.com'
  order by ce.created_at desc
  limit limit_n;
$$;

grant execute on function public.admin_client_errors(int) to authenticated;
