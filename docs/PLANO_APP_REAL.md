# Plano: do Movo de amigos ao Movo público (e pago)

Objetivo: abrir para usuários externos e, depois, cobrar. Escrito em 10/10/2026, a revisar a cada fase.
Tamanhos: **P** = uma sessão de trabalho, **M** = 2 a 4 sessões, **G** = mais de 4 ou depende de terceiros.
"Andre" = coisas que só você pode fazer (contas, jurídico, decisões). Conferir preços e regras das lojas e da lei na hora de executar: mudam.

## Princípio
Antes de trazer estranhos, o app precisa **não perder dado, não gastar dinheiro sem controle e ser claro sobre privacidade**. Só depois vêm lojas e cobrança. Cada fase termina com algo que dá pra entregar e medir.

## Fase 0: Decisões (antes de tudo)
| Decisão | Por quê |
|---|---|
| Nome e marca "Movo": checar INPI, domínio (.com.br/.app), perfis sociais | Trocar de nome depois custa caro (lojas, link, usuários) |
| Pessoa física ou CNPJ/MEI | Cobrança, conta de loja e nota fiscal dependem disso |
| Modelo: grátis com limite de IA + plano pago (sugestão) | Define cotas e o que o paywall bloqueia |
| Quem é o público inicial: corredor-que-treina-academia (já é o foco do app) | Guia onboarding, texto da loja e canais |

## Fase 1: Fundação (confiança e segurança)
1. **Sincronização confiável (M). FEITO na v102** (fila com nova tentativa, mescla por dia, indicador e "Sincronizar agora"; falta só resolver conflito de edição simultânea das fichas em dois aparelhos, hoje vence a última gravação). Hoje tudo vai em uma linha `app_data` por pessoa, e já vemos `persist_upsert: Load failed` nos erros. Fazer: fila local que tenta de novo ao reconectar e ao voltar pro app; indicador "sincronizado / pendente"; mesclar por dia em vez de sobrescrever tudo (evita perder treino se o mesmo usuário abrir em dois aparelhos); coluna de versão/`updated_at` pra detectar conflito. Depois, se preciso, quebrar `app_data` em tabelas.
2. **Excluir conta e exportar dados (M).** Botão em Configurações que apaga tudo (inclusive Strava e feedbacks) e baixa um arquivo com os dados. Exigido pela LGPD e pelas lojas.
3. **Privacidade e termos (M, com Andre).** Política de privacidade e termos de uso em página própria; consentimento explícito no primeiro login (dado de saúde é dado pessoal sensível na LGPD); citar os operadores (Supabase, Anthropic para a IA, Strava, Resend); canal de contato do titular; aviso de que não substitui profissional de saúde. **Andre:** revisão de um advogado.
4. **Segurança (P).** Revisão do Supabase já feita (v101); falta: limites de taxa nas funções de IA, teto global diário de gasto com **chave de desligar** (kill switch), rotação de segredos, política de backup do banco.
5. **Hospedagem e build (M, ver item 5 do ROADMAP).** Domínio próprio, build minificado (esbuild) em vez de Babel no navegador, sourcemaps privados, deploy por CI. Mudar a URL no login do Supabase e no Strava. Faz sentido já com o domínio definitivo.
6. **Testes no repositório (M).** Hoje os testes de tela ficam fora do repo (pasta de trabalho). Mover para `tests/`, rodar no GitHub Actions a cada push. Sem isso, cada mudança é arriscada com usuários reais.
7. **Monitoramento (P).** Painel de erros já existe; adicionar alerta por e-mail quando sobe muito e registro de falha das edge functions.

**Pronto quando:** dois aparelhos não se sobrescrevem, uma conta pode ser apagada, política publicada, build automatizado com testes, teto de gasto ativo.

## Fase 2: Beta aberto (50 a 200 pessoas)
1. **Onboarding (M).** Medir onde as pessoas desistem nos primeiros 2 minutos; fluxo de 3 telas (objetivo, dias, primeira ficha ou plano com IA); estado vazio com próxima ação clara.
2. **Entrada controlada (P).** Link de convite ou lista de espera, pra liberar aos poucos e controlar custo de IA.
3. **Métricas de produto (P).** Retenção D1/D7/D30, ativação (primeiro treino registrado), uso de IA, funil de onboarding no painel admin (os eventos já existem em `app_events`).
4. **E-mail transacional (P).** Resend com domínio verificado (hoje só entrega pro seu e-mail): boas-vindas, recuperação, avisos.
5. **Suporte e feedback (P).** O botão de feedback já existe; criar rotina semanal de ler, responder e priorizar.
6. **Custo da IA (P).** Painel de custo por usuário (já existe `admin_ai_cost`) + alerta; definir o que é grátis.

**Pronto quando:** 50+ pessoas externas ativas, retenção D7 medida e sem incidente de dado.

## Fase 3: Engajamento
1. **Notificações push (G).** Chaves VAPID, tabela de assinaturas, edge function agendada. Lembrete de treino, "sua semana mudou", desafio de amigo, resumo semanal. No iPhone só funciona com o app instalado na tela inicial. Pedir permissão no momento certo, nunca no primeiro acesso.
2. **Ciclo semanal (M).** Resumo da semana (o que fez, o que ajustou) e convite para "Ajustar minha semana" no domingo.
3. **Compartilhamento (P).** Cartão de treino/semana para stories (já temos cartões de desafio).
4. Evolução mostrar ajustes e usar o histórico de cargas na progressão (itens já listados).

## Fase 4: Lojas
1. **Android (M).** Empacotar o PWA (TWA ou Capacitor), ícones, capturas de tela, ficha da loja, política de privacidade e formulário de segurança de dados, link de exclusão de conta. **Andre:** conta de desenvolvedor Google (taxa única, hoje cerca de US$ 25); contas pessoais novas costumam exigir teste fechado com testadores por algumas semanas antes de publicar.
2. **iOS (G).** Capacitor, conta Apple (US$ 99/ano), recursos nativos que justifiquem não ser "só um site" (push, Apple Health talvez), revisão da Apple. Deixar pra depois do Android, ou só PWA no iPhone no começo.
3. **Atualização do app (P).** Estratégia de versões: hoje o service worker atualiza sozinho; no app empacotado, mostrar "nova versão disponível".
4. **Integração de saúde (G, opcional).** Google Health Connect (Android) em vez de depender só do Strava.

## Fase 5: Cobrança
1. **Planos (M).** Sugestão: grátis (fichas, agenda, Evolução, desafios, poucas gerações de IA) e Pro (mais IA, ajustes semanais ilimitados, importar histórico, exportar). Cotas já existem por tipo (`plano_corrida`, `historico`, `treino`, `ajuste_semana`): bastam limites por plano.
2. **Pagamento (G).** Na web: Stripe (cartão e Pix) ou Mercado Pago/Asaas, com assinatura recorrente. **Dentro das lojas, assinatura digital normalmente precisa usar a cobrança da própria loja (Google Play Billing / Apple IAP)**, com comissão. Decidir se vende só pela web no começo.
3. **Banco (P).** Tabela `assinaturas`, webhook do pagamento numa edge function, status refletido nas funções de cota.
4. **Fiscal e legal (G, Andre).** CNPJ/MEI, nota fiscal, termos de cobrança e reembolso, direito de arrependimento (CDC).
5. **Paywall (P).** Mostrar o valor no momento em que a pessoa bate no limite, não antes.

## Em paralelo: qualidade do código
- **Modularizar `app.js` (G, incremental).** ~12 mil linhas num arquivo. Fazer junto com o build: separar por área (treino, corrida, desafios, admin, IA) e tirar componentes grandes. Sempre com os testes rodando no CI.
- **Acessibilidade e idioma (P).** Contraste, foco, textos em PT-BR consistentes; decidir se haverá inglês.
- **Desempenho (P).** Tempo de abertura em celular fraco; carregar admin e modais de IA sob demanda.

## Linha do tempo estimada (trabalhando em sessões curtas)
| Etapa | Tempo |
|---|---|
| Fase 0 | 1 semana (principalmente decisão e checagem de marca) |
| Fase 1 | 3 a 5 semanas |
| Fase 2 | 4 a 6 semanas de beta |
| Fase 3 | 3 a 4 semanas (pode começar junto da Fase 2) |
| Fase 4 (Android) | 3 a 5 semanas, incluindo o teste fechado |
| Fase 5 | 4 a 6 semanas, dependendo da parte fiscal |

## Riscos principais
1. **Perda de dado por sincronização:** o pior que pode acontecer com confiança de usuário. Por isso é o item 1.
2. **Custo de IA sem teto:** cota por usuário + teto global + kill switch antes de abrir.
3. **Conformidade (LGPD, lojas):** não deixar para o fim; exclusão de conta e política precisam estar prontas antes do beta.
4. **Dependência do Strava e das APIs de IA:** limites e mudanças de regra; plano B para entrada de dados manual.
5. **Rejeição da Apple:** app que é só um site embrulhado costuma ser recusado.
6. **Suporte:** cada usuário externo gera mensagens; a rotina de feedback precisa existir antes de escalar.

## Próximos passos imediatos
1. Fase 0: decidir nome/marca, CNPJ/MEI, modelo de plano.
2. Fase 1 item 1 (sincronização) e item 2 (excluir conta e exportar): são pré-requisito de tudo.
3. Mover os testes para o repositório e ligar o CI.
