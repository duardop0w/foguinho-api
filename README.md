# Foguinho Render API - Gemini grátis

Essa versão troca OpenAI por Gemini API.

## Variáveis no Render

Use:

```text
GEMINI_API_KEY=sua_chave_do_google_ai_studio
GEMINI_MODEL=gemini-2.5-flash
```

Não precisa mais de `OPENAI_API_KEY`.

## Como atualizar

1. Suba estes arquivos no GitHub repo `foguinho-api`.
2. Faça commit.
3. No Render, vá em Environment.
4. Adicione `GEMINI_API_KEY`.
5. Adicione `GEMINI_MODEL=gemini-2.5-flash`.
6. Pode apagar `OPENAI_API_KEY` e `OPENAI_MODEL`.
7. Manual Deploy > Deploy latest commit.

## Teste

Abra:

```text
https://foguinho-api.onrender.com/health
```

Tem que aparecer:

```json
{
  "ok": true,
  "mode": "gemini-free",
  "ai": true,
  "provider": "gemini",
  "model": "gemini-2.5-flash"
}
```

## O mod Minecraft

Não precisa mudar o mod se ele já chama:

```text
https://foguinho-api.onrender.com/api/chat
```

Porque esse backend mantém o mesmo endpoint e o mesmo campo `answer`.
