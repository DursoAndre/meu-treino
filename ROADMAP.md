# Roadmap do Movo

Lista viva do que queremos discutir e implementar, em ordem de conversa (não de prioridade). Nada aqui está implementado ainda.

## Feedbacks novos (a discutir e implementar)

1. **Templates de treino x sessão de treino** (desenho fechado, em implementação)
   - Template = a ficha padrão. Sessão = camada de ajustes só daquele dia, guardando só a diferença (séries, pulados, adicionados). Treino do dia = ficha + ajustes.
   - Princípio de UX: quem só executa a ficha não vê nada novo. Ajustes ficam dentro do exercício aberto / rodapé, sem confirmações durante o treino.
   - Não existe "trocar exercício": é pular um e adicionar outro (busca livre do catálogo).
   - **Etapa 1:** + série / remover série no exercício aberto, "pular hoje", "adicionar exercício" no rodapé, selinho "ajustado" e desfazer.
   - **Etapa 2:** ao finalizar um treino com ajustes, lista do que mudou com liga/desliga (adicionado e série alterada ligados; pulado desligado) e **Salvar na ficha** / **Só hoje**. Salvar atualiza a ficha dali pra frente; treinos concluídos ficam congelados.
   - **Medições (admin):** treinos com ajuste e quantos terminam salvando na ficha.
2. **Import de histórico de treinos** (ver proposta abaixo).
3. **IA ajustando os treinos dentro do app**
   - Ex.: quando o usuário muda ou pula um treino, ajustar os dias seguintes com base no que foi feito e no que não foi.
   - Depende do item 1 (precisa separar template de sessão para ajustar só o que deve).

## Pendências de coisas já conversadas

- **Login repetido (Ivan, iPhone, PWA instalado)**: diagnóstico já está no app. Falta rodar no Supabase `grant insert on public.client_errors to anon;` e olhar "Erros recentes" no painel quando acontecer de novo (`session_lost_local_data_intact` x `session_lost_all_local_data_gone`).
- **Template "Confirm signup" do Supabase**: falta editar para mostrar `{{ .Token }}` (cadastros novos recebem esse e-mail, não o de Magic Link). Caso do Lucas.
- **Onboarding sem "1x por semana"**: só existe 0 e 2 a 7. Adicionar se fizer sentido.
- **Strava**: limite da API é por aplicativo (~100 req/15 min, ~1.000/dia). Pode virar gargalo se a base crescer.
- **Supabase plano grátis**: 500 MB de banco (já monitorado no painel admin) e pausa do projeto após 1 semana sem nenhuma atividade.
- **Teste faltando**: puxar-pra-atualizar com a lista já rolada (o código ignora o gesto fora do topo, mas não foi testado com conteúdo longo).

## Proposta: como importar histórico de treinos

O histórico vive em `sessions[data].log["treino:<id>"][<exercício>].sets[{peso, reps}]`, mais `cargas` (duração, RPE, dor). Importar = gerar essas entradas com data e vincular a um exercício/ficha do app.

Caminhos possíveis, do mais simples ao mais ambicioso:

1. **CSV de outros apps (Strong, Hevy etc.)**: parser por formato conhecido, tela de pré-visualização e mapeamento de nomes de exercício (o nome deles raramente bate com o nosso catálogo).
2. **Planilha/texto livre colado, interpretado por IA**: igual ao import de fichas que já existe (prompt + JSON), mas com datas, cargas e reps. É o mais flexível e o mais barato de construir.
3. **Foto/print do histórico**: IA lê a imagem e devolve o mesmo JSON do caminho 2.

Decisões a tomar antes: o que fazer quando o exercício importado não existe no app (criar ficha "Histórico importado" ou casar com o catálogo?), e como evitar duplicar dias que já têm registro.
