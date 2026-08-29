# CobraFlow

Sistema profissional de gestão de cobranças, clientes, recebimentos, inadimplência, relatórios, auditoria e pagamentos online.

## Recursos

- Gestão multiempresa e controle de acesso por perfil
- Cadastro de clientes e cobranças
- Baixa e conciliação de pagamentos
- Links públicos de cobrança
- Integração preparada com Asaas (Pix, boleto e cartão)
- Relatórios CSV e recibos
- Histórico de auditoria
- Configurações da empresa

## Segurança

Credenciais financeiras não são armazenadas no repositório. Configure `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` como segredos no ambiente de hospedagem.

## Desenvolvimento

```bash
npm install
npm run dev
```

Para validar uma versão de produção:

```bash
npm run lint
npm run build
```
