# Sistema de Monitoramento de Processos Judiciais

SaaS multiusuário para consulta e monitoramento de processos judiciais via Telegram.

## Funcionalidades

- Multi usuários com bots Telegram individuais
- API gratuita DataJud (CNJ)
- API paga opcional (fallback)
- Painel web de administração
- Monitoramento automático de atualizações

## Instalação

```bash
npm install
```

## Configuração

1. Configure o PostgreSQL e crie o banco:
```sql
-- Execute o conteúdo de database.sql
```

2. Ajuste `.env` com suas credenciais de banco

## Execução

```bash
# Terminal 1 - Servidor web e bots
npm start

# Terminal 2 - Worker de monitoramento
npm run worker
```

Ou execute ambos:
```bash
npm run dev
```

## Acesso

Acesse `http://localhost:3000` para o painel de administração.

## Como Usar

1. Crie um bot no Telegram via @BotFather
2. Cadastre no painel com:
   - Telegram ID (obtenha via @userinfobot)
   - Token do Bot
   - Modo: grátis, híbrido ou pago
3. Envie números de processo no Telegram
4. O sistema monitora automaticamente
