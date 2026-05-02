# Foguinho Render API - Gemini melhorado

Essa versão melhora o prompt do Gemini para ele responder a pergunta de verdade,
em vez de falar genericamente sobre a streak.

## O que mudou

- Modo: `gemini-free-improved`
- O Gemini recebe instrução para responder diretamente a pergunta.
- Respostas são mais curtas e práticas.
- Para perguntas de Minecraft, ele dá passos úteis.
- Mantém o mesmo endpoint: `/api/chat`

## Variáveis no Render

```text
GEMINI_API_KEY=sua_chave_do_google_ai_studio
GEMINI_MODEL=gemini-2.5-flash
```

## Como atualizar

1. Suba estes arquivos no GitHub repo `foguinho-api`.
2. Faça commit.
3. No Render: Manual Deploy > Deploy latest commit.
4. Teste `/health`.

O `/health` deve mostrar:

```json
"mode": "gemini-free-improved"
```
