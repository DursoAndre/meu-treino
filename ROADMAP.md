# Roadmap do Movo

Lista viva do que queremos discutir e implementar, em ordem de conversa (não de prioridade). Itens concluídos saem da lista.

## Feedbacks novos (a discutir e implementar)

1. **Import de histórico de treinos** (ver proposta abaixo).
2. **IA ajustando os treinos dentro do app**
   - Ex.: quando o usuário muda ou pula um treino, ajustar os dias seguintes com base no que foi feito e no que não foi.
   - Sinais já existem: exercícios pulados, adicionados e séries alteradas no treino do dia, mais os eventos de "salvar na ficha".

## Pendências de coisas já conversadas

- **Ajustes no treino de hoje (entregue)**: falta rodar `supabase/sql/app_events_setup.sql` no Supabase para o painel admin mostrar as medições (treinos com ajuste, quanto salvam na ficha). Sem isso o app funciona normal, só a seção de medições não aparece.
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
