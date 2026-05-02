# Foguinho Render API com IA

Essa versão adiciona IA real usando OpenAI, mas mantém Wikipédia como fallback.

## Como funciona

- Se `OPENAI_API_KEY` estiver configurada no Render, `/api/chat` usa IA real.
- Se não tiver chave, `/api/chat` usa Wikipédia.
- `/api/search` continua usando Wikipédia.

## Variáveis no Render

No Render, abra seu serviço > Environment e adicione:

```text
OPENAI_API_KEY=sua_chave_aqui
OPENAI_MODEL=gpt-4.1-mini
```

`OPENAI_MODEL` é opcional. Se você não colocar, ele usa `gpt-4.1-mini`.

## Deploy

Depois de subir os arquivos no GitHub:

1. Render detecta o push automaticamente, ou
2. Clique em Manual Deploy > Deploy latest commit.

## Testar

Abra:

```text
https://foguinho-api.onrender.com/health
```

Se IA estiver ligada, aparece:

```json
{
  "ok": true,
  "status": "online",
  "ai": true,
  "model": "gpt-4.1-mini"
}
```

Teste chat:

```bash
curl -X POST https://foguinho-api.onrender.com/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"question\":\"me explica redstone no minecraft\"}"
```

## Importante

Nunca coloque `OPENAI_API_KEY` dentro do mod Minecraft.
A chave deve ficar somente no Render.
