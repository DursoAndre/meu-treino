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

4. **Desafios (v1 construída; precisa rodar o SQL)**
   - Já existe: aba Evolução > Ranking > "Desafios" (o ranking antigo virou "Geral"). Criar desafio em 3 passos (modelos meta/café/simples, regras editáveis, aposta semanal e final), convite por código ou link `?desafio=CODE`, check-ins automáticos (academia + atividades do app, no máximo 1 por tipo por dia), "treinei com alguém" com confirmação do outro, pista de corrida animada, placar, semanas fechadas com vencedor/perdedor, cartão 1080x1350 para compartilhar, chip na Hoje.
   - Ativação: rodar `supabase/sql/challenges_setup.sql` no SQL editor do Supabase. Até lá a aba mostra "ainda não foram ativados".
   - Regras: só o criador edita; regras travam quando o desafio começa; semana começa na segunda (configurável).
   - Falta: limite mínimo de km do Strava como critério; gráfico de evolução de posições; lembretes/notificações; controle de "quem deve café"; foto como comprovação; unir chips de desafio e prova na Hoje.

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
