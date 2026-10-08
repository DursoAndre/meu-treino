# Roadmap do Movo

Lista viva do que queremos discutir e implementar, em ordem de conversa (não de prioridade). Itens concluídos saem da lista.

## Feedbacks novos (a discutir e implementar)

1. **Import de histórico de treinos** (ver proposta abaixo).
2. **IA ajustando os treinos dentro do app**
   - Ex.: quando o usuário muda ou pula um treino, ajustar os dias seguintes com base no que foi feito e no que não foi.
   - Sinais já existem: exercícios pulados, adicionados e séries alteradas no treino do dia, mais os eventos de "salvar na ficha".

3. **Calendário de provas (v1 no ar, a evoluir)**
   - Já existe: tela "Provas" (🏁 no cabeçalho), filtros, "Vou nessa", entrada manual e contagem regressiva na Hoje. Base em `races.json` (47 provas, carga manual).
   - Falta: provas marcadas/manuais sincronizarem na nuvem (hoje só no aparelho); tabela `races` no Supabase; atualização semanal por tarefa agendada; mais fontes (calendário completo do Track&Field, Circuito das Estações, Maratona do Rio/SP); links oficiais de inscrição (a maioria ainda sem link); lembretes antes da prova; ligar à IA de ajuste de treino (item 2).
   - Regra de produto: mostrar a prova mesmo sem link oficial; link só quando verificado.
   - Decisões da conversa: calendário separado do fluxo de treino (só a linha de contagem na Hoje e só com prova marcada); entrada manual para o que não estiver na base; pode copiar dados do Ahotu e corroborar com o link oficial do organizador, deixando sem link o que não achar; leitura das fontes uma vez por semana.
   - Fontes mapeadas: Hyrox (hyrox.com, running.life, roxradar), Track&Field Run Series (tfsports.com.br; a página de calendário é dinâmica, precisa dos links das etapas ou da API do app), Ahotu (listagem limitada a ~10 por página; ler por mês e por cidade), Circuito das Estações, Maratonas do Rio/SP/Curitiba.
   - Limites técnicos: a leitura só abre links que apareceram na conversa ou em buscas; a tarefa semanal terá de rodar como tarefa agendada, não como script no servidor.
   - Dúvidas abertas: UF de Bonito 21K e Summer 48K; "Run for Your Lives - SP" pode ser a corrida do Iron Maiden.
   - **Provas colaborativas (feito, precisa rodar `supabase/sql/races_cloud_setup.sql`):** marcações e km vão para `race_entries`; provas cadastradas viram `shared_races` (sem duplicar por nome+data+cidade, limite de 10/dia por pessoa, `oculta` para moderar) e todos veem "👥 N outras pessoas vão · km". Menu lateral (☰), Provas com abas Minhas/Explorar e detalhes com amigos que vão (precisa da função `race_friends` do mesmo SQL) já feitos. Metas de corrida sem inscrição (aba Metas em Provas / menu Corrida; tipos distância, tempo e hábito; uma ativa por vez) já feitas. Calendário mensal/anual (aba Calendário) e moderação no painel admin (`supabase/sql/admin_shared_races.sql`) também feitos.
   - **Execução do plano de corrida (etapas):** (1) definir o formato do plano: lista de sessões com data (tipo, distância/tempo, pace/esforço, notas), já que as fichas atuais são de musculação; (2) tela de perguntas + prompt gerado para copiar/colar (versão sem custo); (3) importar o JSON do plano e mostrar na Hoje/calendário; (4) validação por código (aumento semanal, teto do longão, redução de carga, semanas leves); (5) edge function `gerar-plano` com chave da API como segredo, limite por usuário e logs; (6) botão direto no app; (7) recalcular o plano quando a pessoa perder semanas.
   - **Status do plano de corrida:** etapas 1 a 4 feitas (formato, perguntas com recomendação de dias e aviso de conflito com a academia, prompt para copiar/colar, importação com validação, sessões na aba Hoje). Decisões: só corrida; 3 planos por mês por pessoa; liberado para todos; esforço e pace juntos; o usuário decide mesmo com avisos. Faltam: edge function `gerar-plano` com limite mensal e teto de gasto (etapa 5), botão direto (6) e replanejar (7). Para sincronizar na nuvem, rodar `alter table app_data add column if not exists planos jsonb default '[]'::jsonb;`.
   - **IA no plano de corrida (etapas 5 e 6 escritas):** edge function `supabase/functions/gerar-plano` + SQL `supabase/sql/plan_generations_setup.sql` (3 gerações/mês por pessoa, devolve a reserva se a IA falhar) e botão "Gerar plano com IA" no app, que só aparece depois do SQL rodado. Pendente do lado do Andre: rodar o SQL, criar o secret `ANTHROPIC_API_KEY` (feito) e publicar a função. Depois: replanejar (etapa 7) e mostrar o consumo no painel admin.
   - **Replanejar (etapa 7 feita):** convite na Hoje quando metade ou mais das sessões das últimas 2 semanas ficou sem registro (conta corrida registrada/Strava como feita) ou quando a data da prova mudou; botão "Replanejar a partir de hoje" no plano; o prompt leva o histórico do plano anterior e pede retomada gradual; o que já passou é mantido. Consumo da IA no painel admin feito (`supabase/sql/admin_plan_usage.sql`).
   - **Visão de calendário (pedido):** ver as provas (e, no futuro, desafios e treinos) em formato de calendário mensal e anual, para se programar com antecedência. Ideia: grade mensal com marcadores nos dias de prova e visão anual com os meses e a densidade de provas; toque no dia abre os detalhes.
   - **Plano de treino para a prova (pedido):** ao marcar "Vou nessa" numa prova de corrida, mostrar um botão "Criar plano de treino". O plano considera: distância que a pessoa corre confortável hoje (puxar do histórico/Strava e confirmar com ela), distância da prova, objetivo (completar ou baixar tempo/pace), semanas até a prova e dias disponíveis por semana. Saída: fichas semanais (rodagens, longão, intervalado, descanso, polimento nas últimas semanas) que entram no calendário e na aba Treino. Depende do item 2 (IA ajustando treinos) e de uma tela rápida de perguntas; com pouco tempo até a prova, o app deve avisar que o prazo é curto e propor meta mais conservadora.

4. **Desafios (v1 construída; precisa rodar o SQL)**
   - Já existe: aba Evolução > Ranking > "Desafios" (o ranking antigo virou "Geral"). Criar desafio em 3 passos (modelos meta/café/simples, regras editáveis, aposta semanal e final), convite por código ou link `?desafio=CODE`, check-ins automáticos (academia + atividades do app, no máximo 1 por tipo por dia), "treinei com alguém" com confirmação do outro, pista de corrida animada, placar, semanas fechadas com vencedor/perdedor, cartão 1080x1350 para compartilhar, chip na Hoje.
   - Ativação: rodar `supabase/sql/challenges_setup.sql` no SQL editor do Supabase. Até lá a aba mostra "ainda não foram ativados".
   - Regras configuráveis por desafio: academia/atividades (mínimo de minutos, mínimo de exercícios, só atividades por nome), limite de treinos por dia (inclui "dia ativo"), dias da semana que valem, exigir duração. Só o criador edita; regras travam quando o desafio começa; semana começa na segunda (configurável).
   - Engajamento (feito): avisos nos desafios (semana fechou com quem ganhou/paga e cartão pra compartilhar, "fulano te passou", "você assumiu a liderança", "fulano já bateu a meta", lembrete quando faltam até 2 dias e a meta não foi batida, fim do desafio), ponto vermelho na aba Desafios, aviso no chip da Hoje, gráfico "corrida dos pontos" (acumulado por semana) com cartão pra compartilhar.
   - Strava (feito): regra "distância mínima (km)" e "exigir distância registrada". A distância vem do campo `distanciaKm` da carga (a função `strava-sync` atualizada precisa ser reimplantada no Supabase) ou, nas importações antigas, do texto "· 12.3 km ·" do comentário; também lê "5 km" digitado no comentário.
   - Falta: notificações push de verdade (precisa de Web Push: chaves VAPID, tabela de assinaturas e uma Edge Function agendada; no iOS só funciona com o app instalado na tela inicial), foto como comprovação, controle de "quem deve café", unir chips de desafio e prova na Hoje, caso de empate no cartão (um aparece como 1º e o outro como 2º).

5. **Repositório privado, build e proteção contra cópia (a decidir)**
   - Feito: licença proprietária (`LICENSE`, "todos os direitos reservados") e avisos de copyright no README, `index.html` e `app.js`.
   - GitHub Pages com repositório privado exige plano pago (Pro/Team/Enterprise Cloud; conferir preço e regra atuais). O site continua público mesmo com o repositório privado. Alternativa grátis: Cloudflare Pages (também Netlify/Vercel), conectando ao repositório privado.
   - Build minificado: hoje não existe build, o `index.html` compila o JSX no navegador com o Babel. Fazer junto com a migração de hospedagem: esbuild gerando `app.min.js` no deploy, ajuste do `sw.js` e do `index.html`, sourcemaps fora do site público para os erros de `client_errors`. Ganhos: abertura mais rápida no celular e uma dependência externa a menos (Babel via CDN). Riscos: deploy depende do build; cache do service worker.
   - Mudar de endereço exige atualizar a URL de redirecionamento do login no Supabase e o domínio autorizado no Strava; os usuários teriam de reinstalar o PWA.
   - Antes de privar o repositório: varrer o histórico do Git atrás de chaves secretas (`service_role`, secret do Strava).
   - Proteção real está no servidor: RLS firme, e mover para RPC/Edge Function qualquer regra que vire diferencial (hoje os pontos dos Desafios são calculados no cliente). Código se copia; dados, curadoria e comunidade não.
   - Não publicar o que não precisa estar no site (ex.: ROADMAP.md).

6. **Revisão do catálogo de exercícios (recorrente)**
   - Quando a busca não acha, a pessoa pode criar um exercício livre; o nome fica em `exercise_suggestions` (rodar `supabase/sql/exercise_gaps_setup.sql`) e aparece no painel de admin em "Exercícios fora do catálogo" (últimos 90 dias, agrupado sem acento/maiúscula).
   - Rotina: olhar esse bloco de tempos em tempos e passar pra mim os nomes mais repetidos; eu incluo no catálogo (`TPL_EX_CATALOG_EXTRA`) e, se for outro nome de um exercício que já existe, na lista de sinônimos (`EXERCICIO_SINONIMOS`). Vídeo de execução só com link verificado.

## Pendências de coisas já conversadas

- **Ajustes no treino de hoje (entregue)**: falta rodar `supabase/sql/app_events_setup.sql` e `supabase/sql/admin_login_stats.sql` no Supabase para o painel admin mostrar as medições (treinos com ajuste, quanto salvam na ficha). Sem isso o app funciona normal, só as seções de medições e de logins por usuário não aparecem.
- **Onboarding sem "1x por semana"**: só existe 0 e 2 a 7. Adicionar se fizer sentido.
- **Strava**: limite da API é por aplicativo (~100 req/15 min, ~1.000/dia). Pode virar gargalo se a base crescer.
- **Supabase plano grátis**: 500 MB de banco (já monitorado no painel admin) e pausa do projeto após 1 semana sem nenhuma atividade.

## Proposta: como importar histórico de treinos

O histórico vive em `sessions[data].log["treino:<id>"][<exercício>].sets[{peso, reps}]`, mais `cargas` (duração, RPE, dor). Importar = gerar essas entradas com data e vincular a um exercício/ficha do app.

Caminhos possíveis, do mais simples ao mais ambicioso:

1. **CSV de outros apps (Strong, Hevy etc.)**: parser por formato conhecido, tela de pré-visualização e mapeamento de nomes de exercício (o nome deles raramente bate com o nosso catálogo).
2. **Planilha/texto livre colado, interpretado por IA**: igual ao import de fichas que já existe (prompt + JSON), mas com datas, cargas e reps. É o mais flexível e o mais barato de construir.
3. **Foto/print do histórico**: IA lê a imagem e devolve o mesmo JSON do caminho 2.

Decisões a tomar antes: o que fazer quando o exercício importado não existe no app (criar ficha "Histórico importado" ou casar com o catálogo?), e como evitar duplicar dias que já têm registro.
