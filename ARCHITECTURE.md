# CobraFlow — arquitetura e roadmap

## Visão

O produto é um SaaS financeiro multiempresa. A interface é renderizada no servidor e hidratada no cliente; rotas de API e ações sensíveis permanecem no servidor. Dados relacionais usam D1/SQLite nesta implantação Sites, arquivos e comprovantes usam R2. Integrações externas ficam atrás de adaptadores HTTP e filas/webhooks idempotentes.

## Estrutura

```text
app/                 páginas, componentes e rotas HTTP
db/                  schema, acesso isolado e migrations
domain/              regras de clientes, cobranças, pagamentos e acordos
services/            casos de uso, autorização e auditoria
integrations/        gateways, mensagens e webhooks
jobs/                automações, retries e tarefas assíncronas
public/              ativos públicos
tests/               testes unitários, integração e E2E
```

## Entidades principais

```text
Organization 1──N User N──1 Role N──N Permission
Organization 1──N Customer 1──N Charge 1──N Installment
                              ├──N Payment
                              ├──N Negotiation 1──1 Agreement
                              ├──N CommunicationLog
                              └──N CollectionAction
Organization 1──N AutomationRule 1──N AutomationExecution
Organization 1──N AuditLog / Integration / Webhook / Goal
```

Toda tabela de negócio contém `organization_id`. Repositórios exigem um contexto de tenant e todas as chaves únicas e índices compostos incluem o tenant. Nenhum identificador fornecido pelo navegador define o tenant.

## Autenticação e autorização

1. O dispatcher autentica o usuário e encaminha identificadores assinados.
2. O servidor resolve a associação ativa entre identidade e organização.
3. O middleware cria o contexto `{userId, organizationId, role}`.
4. Cada caso de uso verifica permissões RBAC antes da consulta ou mutação.
5. Operações críticas registram antes/depois na auditoria.

Permissões seguem `recurso:ação` (por exemplo, `charge:create`, `report:export`). Limites de desconto e aprovação são políticas adicionais, nunca apenas estados visuais.

## Cobranças, pagamentos e automações

Cobranças usam uma máquina de estados validada no domínio. Criação e baixa exigem chave de idempotência. Confirmações de gateway entram por webhook assinado, são deduplicadas, conciliadas e auditadas antes de alterar saldos.

Automações são modeladas como gatilho → condições → ações. O agendador produz execuções imutáveis; workers aplicam retry exponencial, fila de falhas e limites por organização. Ações financeiras críticas param em um nó de aprovação humana.

## Integrações e segurança

Adaptadores isolam PIX, boleto, WhatsApp, e-mail, SMS e ERP. Segredos ficam no ambiente do servidor. Webhooks usam assinatura HMAC, timestamp, idempotência e histórico de tentativas. Controles incluem validação de entrada, queries parametrizadas, CSRF quando aplicável, CSP, rate limit, sessões revogáveis, 2FA, logs estruturados, minimização LGPD, retenção configurável e criptografia em trânsito e repouso.

## Roadmap

1. Fundação: arquitetura, autenticação, tenant, RBAC, auditoria e schema inicial.
2. Dashboard e clientes com perfil 360°.
3. Cobranças, parcelas e contas a receber.
4. Pagamentos, PIX e boleto por adaptadores.
5. Inadimplência, negociação, acordo e promessas.
6. Comunicações multicanal e templates.
7. Réguas e construtor de automações.
8. Relatórios, metas, equipe e aprovações.
9. IA assistiva, score explicável e análises.
10. Super admin, planos, assinatura e API pública.

Cada fase fecha migrations, backend, frontend, validação, testes, revisão de segurança e documentação antes da próxima.
