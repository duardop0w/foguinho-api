# Foguinho Render API - IA sem Wikipédia

Esta versão remove o fallback silencioso para Wikipédia.

## O que mudou

- `/api/chat` tenta usar OpenAI sempre.
- Se a OpenAI falhar, a API retorna o erro real em vez de responder com Wikipédia.
- O Foguinho não vai mais falar "Pesquisei na Wikipédia".
- O `/health` mostra `mode: "openai-only"`.

## Variáveis no Render

Use:

```text
OPENAI_API_KEY=sua_chave_real
OPENAI_MODEL=gpt-4.1-mini
```

Se quiser testar outro modelo disponível na sua conta:

```text
OPENAI_MODEL=gpt-5.4-mini
```

## Como atualizar

1. Suba estes arquivos no GitHub repo `foguinho-api`.
2. Faça commit.
3. No Render, clique em Manual Deploy > Deploy latest commit.
4. Teste:

```text
https://foguinho-api.onrender.com/health
```

Deve aparecer:

```json
{
  "ok": true,
  "mode": "openai-only",
  "ai": true
}
```

## Teste de chat

No Minecraft, pergunte:

```text
me explica redstone no minecraft
```

Se aparecer erro, olhe os logs do Render. Agora o erro será explícito.
