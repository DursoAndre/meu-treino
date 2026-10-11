# Plano: treinadores no Movo (visualizar, editar e enviar treinos aos alunos)

Status: **planejamento, nada implementado**. Decisões de negócio (preço, modelo de cobrança, termos) ficam para a conversa de negócio.

## 1. Problema e JTBD
- **Treinador:** "Montar, ajustar e acompanhar os treinos de vários alunos sem planilha e sem WhatsApp, e saber quem está treinando."
- **Aluno:** "Receber o treino do meu treinador já pronto no app que eu uso, registrar sem esforço e ver que ele acompanha."
- **Hoje:** o aluno monta ou importa a ficha sozinho. O treinador passa PDF/WhatsApp, e o aluno redigita ou usa o importador.

## 2. Princípios
1. O aluno é dono dos próprios dados. O treinador só vê o que o aluno autorizar, e o aluno revoga quando quiser.
2. O aluno nunca perde o que já tem. O treino do treinador chega como proposta ou ficha marcada, não sobrescreve.
3. Simples: sem app separado no começo. O treinador usa o mesmo Movo, com um modo "Treinador".
4. Dados de saúde (dor, esforço, peso) são sensíveis (LGPD). Compartilhar exige consentimento explícito, por tipo de dado.

## 3. Modelo de papéis e vínculo
- Um usuário pode ser **aluno**, **treinador** ou os dois. Treinador é um papel ativado no perfil (flag `is_coach`, inicialmente liberado manualmente por você).
- **Vínculo** treinador↔aluno por **convite**: o treinador gera link/código ("Seja meu aluno no Movo"). O aluno abre, vê quem é e o que será compartilhado, e aceita. Mesmo padrão de convite dos Desafios.
- Estados: `pendente` → `ativo` → `encerrado` (qualquer lado encerra; ao encerrar o treinador perde acesso na hora).

### Tabelas novas (esboço)
- `coach_profiles(user_id, nome_exibicao, bio, created_at)`
- `coach_links(id, coach_id, student_id, status, invite_code, permissions jsonb, created_at, accepted_at, ended_at)`
  - `permissions`: `{ver_treinos: true, ver_historico: true, ver_esforco_dor: false, editar_fichas: true, ver_corrida: true}`; o aluno liga e desliga cada um.
- `coach_assignments(id, link_id, tipo, payload jsonb, status, created_at, applied_at)` — envios do treinador (ficha, atividade, plano de corrida, ajuste da semana). Status: `enviado` → `aceito`/`recusado`/`aplicado`.
- `coach_notes(id, link_id, author_id, date, texto, created_at)` — comentário do treinador num dia/sessão, e resposta do aluno.
- `coach_audit(link_id, ator, acao, quando)` — registro de quem viu/alterou o quê (transparência e suporte).

### Segurança (RLS)
- Treinador só lê dados de aluno via **funções RPC `security definer`** que checam vínculo `ativo` + permissão específica. Nunca acesso direto a `app_data` do aluno.
- Aluno lê tudo que é dele; treinador só `coach_assignments`/`coach_notes` que criou.
- Encerrar vínculo revoga imediatamente (a RPC deixa de autorizar).

## 4. Fluxos

### 4.1 Treinador (modo "Treinador", aba nova ou item no menu)
1. **Meus alunos:** lista com foto/nome, "último treino há X dias", semana (dias ativos/meta), alerta (sumiu, dor alta, semana sem treino).
2. **Perfil do aluno:** semana atual, histórico, cargas por exercício, esforço/dor (se permitido), corridas, notas.
3. **Montar e enviar:**
   - Reaproveitar o construtor de fichas atual, com destino "para o aluno X" (ou biblioteca de modelos do treinador para reutilizar com vários alunos).
   - **Agenda do aluno:** definir os dias da semana (a "agenda recorrente") e enviar.
   - Plano de corrida: reaproveitar o gerador de plano; o treinador revisa e envia.
4. **Editar treino de um aluno:** a edição vira **nova versão** enviada ao aluno (ver 5), com mensagem opcional ("subi a carga do supino").
5. **Comentar** sessões (feedback) e responder dúvidas do aluno.

### 4.2 Aluno
1. Recebe convite → tela clara de consentimento (quem, o quê, como revogar).
2. **Treino do treinador** aparece na aba Treinos como ficha com selo "Prescrito por {Nome}" e na agenda. Notificação dentro do app (push depois).
3. Pode aceitar todas as mudanças automaticamente (opção "confiar no meu treinador") ou revisar uma a uma.
4. Registra normalmente (cargas, esforço, dor). O treinador vê conforme as permissões.
5. Menu "Meu treinador": ver permissões, pausar compartilhamento, encerrar, baixar o que foi compartilhado.

## 5. Edição e sincronização (ponto mais delicado)
Hoje o app é local-first com sincronização por chave. Treinador editando a ficha do aluno cria risco de conflito.
- **Ficha prescrita é uma cópia versionada**: `treino.origem = {coach_id, assignment_id, versao}`. O treinador nunca grava direto em `app_data` do aluno.
- Envio gera `coach_assignment`; ao aceitar (ou automático), o app do aluno aplica e grava na ficha dele (campo `versao`).
- **Aluno pode ajustar no dia** (já existe "ajustes do treino de hoje" sem mexer na ficha). Mudanças permanentes na ficha prescrita voltam ao treinador como sugestão, não sobrescrevem a prescrição.
- Conflito: a versão do treinador vence na ficha prescrita; as anotações do aluno ficam preservadas.
- Fichas pessoais do aluno continuam separadas e intocáveis.

## 6. Escopo por fases
**Fase 0 – Fundação (1–2 semanas)**
- Tabelas, RLS, RPCs (criar convite, aceitar, listar alunos, ler resumo do aluno).
- Modo Treinador mínimo: convite + lista de alunos + perfil do aluno somente leitura.
- Tela de consentimento e "Meu treinador" no aluno.
- Eventos de funil (convite criado/aceito, aluno ativo).

**Fase 1 – Enviar treinos (2–3 semanas)**
- Construtor de ficha "para o aluno", agenda semanal do aluno, envio e aplicação no app do aluno.
- Fichas com selo de origem e versionamento.
- Biblioteca de modelos do treinador.

**Fase 2 – Acompanhar (2 semanas)**
- Histórico/cargas/esforço/dor com permissões; alertas ("sumiu há 5 dias", "dor 7+").
- Comentários nas sessões e respostas.
- Resumo semanal por aluno (reaproveita o resumo semanal do aluno).

**Fase 3 – Escala (depois)**
- Push (lembrete de treino, novo treino enviado), grupos/turmas, planos de corrida em lote, exportação, painel web para tela grande, treinador com muitos alunos (busca/filtros).

## 7. Riscos e decisões em aberto
- **LGPD:** dados de saúde de terceiros. Precisa de base legal (consentimento do aluno), política atualizada, termos para o treinador (responsabilidade pela prescrição) e revisão jurídica. O app **não** deve se apresentar como substituto de orientação profissional.
- **Quem é treinador:** verificação (CREF?) ou apenas auto-declaração com aviso. Decisão de negócio.
- **Monetização:** quem paga (treinador por nº de alunos, aluno, ou gratuito na beta). Em aberto, para a conversa de negócio.
- **Moderação/abuso:** denunciar treinador, encerrar vínculo em um toque, auditoria de acesso.
- **Treinador com muitos alunos:** o app é mobile; pode pedir tela web depois.
- **Conflitos offline:** aluno offline recebe o treino ao reconectar; exibir "nova versão disponível".
- **Estágios da IA:** gerar rascunho de ficha com o gerador atual para o treinador revisar (diferencial), respeitando o limite diário e custo.

## 8. Métricas de sucesso
- Treinadores ativos (enviaram treino nos últimos 14 dias) e alunos por treinador.
- % de convites aceitos; tempo do convite ao 1º treino registrado pelo aluno.
- Retenção D30 de aluno com treinador vs. sem treinador.
- % de treinos prescritos executados na semana.

## 9. Primeiro passo sugerido
Piloto fechado com 1–3 treinadores reais (por exemplo, a Dayanne) e 5–10 alunos, só Fase 0 + Fase 1, flag `is_coach` liberada manualmente. Aprender o fluxo real antes de construir alertas e painéis.
