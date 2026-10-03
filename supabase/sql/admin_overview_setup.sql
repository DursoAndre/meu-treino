-- Painel geral de uso (admin): números agregados de todos os usuários — não
-- por pessoa (isso já existe em admin_usage_stats) — pra ver de relance
-- quantos usuários existem, quantos estão ativos e a tendência diária.
-- Mesmo esquema de segurança das outras funções admin: security definer +
-- confere o e-mail de quem chamou (ardurso@gmail.com) antes de devolver
-- qualquer linha; pra qualquer outro usuário, o "where" dá falso e some
-- tudo (nessas duas funções, como não tem "from" de verdade, a query
-- simplesmente não devolve nenhuma linha — não dá erro, só fica vazio).

drop function if exists public.admin_overview_stats();

create function public.admin_overview_stats()
returns table (
  total_usuarios bigint,
  ativos_hoje bigint,
  ativos_7d bigint,
  ativos_30d bigint,
  novos_7d bigint,
  novos_30d bigint,
  completaram_onboarding bigint,
  conectaram_strava bigint
)
language sql
security definer
set search_path = public, auth
as $$
  select
    (select count(*) from auth.users),
    (select count(distinct user_id) from public.app_opens where opened_at >= date_trunc('day', now())),
    (select count(distinct user_id) from public.app_opens where opened_at >= now() - interval '7 days'),
    (select count(distinct user_id) from public.app_opens where opened_at >= now() - interval '30 days'),
    (select count(*) from auth.users where created_at >= now() - interval '7 days'),
    (select count(*) from auth.users where created_at >= now() - interval '30 days'),
    (select count(*) from public.app_data where treinos is not null and jsonb_array_length(treinos) > 0),
    (select count(distinct user_id) from public.strava_connections)
  where (select email from auth.users where id = auth.uid()) = 'ardurso@gmail.com';
$$;

grant execute on function public.admin_overview_stats() to authenticated;

-- "Usuários ativos" por dia nos últimos N dias (default 14), pra desenhar o
-- gráfico de tendência — inclui dias com zero acesso (generate_series),
-- senão um dia parado simplesmente some do gráfico em vez de aparecer como
-- uma barra zerada.
drop function if exists public.admin_daily_active(int);

create function public.admin_daily_active(dias int default 14)
returns table (
  dia date,
  usuarios_ativos bigint
)
language sql
security definer
set search_path = public, auth
as $$
  select d::date, coalesce(count(distinct o.user_id), 0)
  from generate_series((current_date - (dias - 1)), current_date, interval '1 day') d
  left join public.app_opens o on o.opened_at::date = d::date
  where (select email from auth.users where id = auth.uid()) = 'ardurso@gmail.com'
  group by d
  order by d;
$$;

grant execute on function public.admin_daily_active(int) to authenticated;
