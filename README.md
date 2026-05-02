# Foguinho Render API

API online simples para o mod Foguinho.

## O que ela faz

- `GET /health` testa se a API está online.
- `POST /api/search` pesquisa na Wikipédia em português.
- `POST /api/chat` responde perguntas simples do Foguinho e usa Wikipédia para perguntas gerais.

Isso ainda não é IA real com chave paga. É um backend seguro para começar e depois plugar uma IA real sem expor chave dentro do mod.

## Rodar local

```bash
npm install
npm start
```

Teste:

```bash
curl http://localhost:10000/health
```

Pesquisa:

```bash
curl -X POST http://localhost:10000/api/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"question\":\"quem foi Albert Einstein\"}"
```

## Subir no GitHub

1. Crie um repositório chamado `foguinho-api`.
2. Suba estes arquivos.
3. No Render: New > Web Service.
4. Conecte o repo do GitHub.
5. Build Command: `npm install`
6. Start Command: `npm start`

## Variáveis no Render

Opcional:

```text
MOD_SECRET=algum-token-secreto
```

Se usar `MOD_SECRET`, o mod precisa enviar esse token no header:

```text
x-foguinho-secret: algum-token-secreto
```

## Próximo passo

Depois que a API estiver online, copie a URL do Render, tipo:

```text
https://foguinho-api.onrender.com
```

Aí o mod precisa chamar:

```text
POST https://foguinho-api.onrender.com/api/chat
```
