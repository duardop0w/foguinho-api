import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const app = express();

const PORT = process.env.PORT || 10000;
const MOD_SECRET = process.env.MOD_SECRET || "";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "128kb" }));

app.use(rateLimit({
  windowMs: 60 * 1000,
  limit: 80,
  standardHeaders: true,
  legacyHeaders: false
}));

function checkSecret(req, res, next) {
  if (!MOD_SECRET) {
    return next();
  }

  const received = req.header("x-foguinho-secret");

  if (received !== MOD_SECRET) {
    return res.status(401).json({
      ok: false,
      error: "Token inválido."
    });
  }

  next();
}

function limitText(text, max = 1100) {
  if (!text) return "";
  const cleaned = text
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (cleaned.length <= max) return cleaned;
  return cleaned.slice(0, max - 3) + "...";
}

function extractGeminiText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;

  if (!Array.isArray(parts)) {
    return "";
  }

  return parts
    .map((part) => part?.text || "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

function publicGeminiError(status, bodyText) {
  try {
    const parsed = JSON.parse(bodyText);
    const message = parsed?.error?.message;
    const code = parsed?.error?.code;
    const statusText = parsed?.error?.status;

    if (message) {
      return `${message}${code ? ` (code ${code})` : ""}${statusText ? ` [${statusText}]` : ""}`;
    }
  } catch {
    // ignora parse
  }

  return `Erro HTTP ${status} chamando Gemini.`;
}

function isFoguinhoQuestion(question) {
  const q = question.toLowerCase();

  return (
    q.includes("foguinho") ||
    q.includes("streak") ||
    q.includes("renovar") ||
    q.includes("meu status") ||
    q.includes("minha streak") ||
    q.includes("conquista do foguinho")
  );
}

function makePrompt(question, context = {}) {
  const amigo = context.amigo || "Amigo";
  const streak = context.streak || "0";
  const status = context.status || "desconhecido";

  return `
Você é o Foguinho, um mascote fofo de um mod Minecraft de streak de amizade.

REGRAS IMPORTANTES:
- Responda SEMPRE em português do Brasil.
- Responda DIRETAMENTE a pergunta do jogador.
- Não ignore a pergunta para falar só da streak.
- Use personalidade de mascote, mas sem enrolar.
- Máximo de 7 linhas curtas.
- Se a pergunta for sobre Minecraft, dê passos práticos.
- Se a pergunta for sobre redstone, construção, sobrevivência, mobs, itens ou comandos, explique o assunto pedido.
- Só fale da streak se a pergunta for sobre o Foguinho/streak ou se couber em uma frase final.
- Não diga que é Gemini, Google ou API.
- Não use markdown pesado. Evite tabelas.

Contexto do mod:
- Amigo atual: ${amigo}
- Streak atual: ${streak}
- Status do foguinho: ${status}

Pergunta do jogador:
${question}

Resposta do Foguinho:
`.trim();
}

async function askGemini(question, context = {}) {
  if (!GEMINI_API_KEY) {
    return {
      ok: false,
      error: "GEMINI_API_KEY não está configurada no Render."
    };
  }

  const prompt = makePrompt(question, context);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: isFoguinhoQuestion(question) ? 0.85 : 0.55,
          topP: 0.9,
          maxOutputTokens: 380
        }
      })
    }
  );

  const bodyText = await response.text();

  if (!response.ok) {
    return {
      ok: false,
      error: publicGeminiError(response.status, bodyText)
    };
  }

  let data;

  try {
    data = JSON.parse(bodyText);
  } catch {
    return {
      ok: false,
      error: "O Gemini respondeu, mas a resposta não veio em JSON."
    };
  }

  const answer = extractGeminiText(data);

  if (!answer) {
    return {
      ok: false,
      error: "O Gemini respondeu, mas não encontrei texto na resposta."
    };
  }

  return {
    ok: true,
    answer: limitText(answer, 1100)
  };
}

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    name: "Foguinho Render API",
    version: "4.1.0",
    mode: "gemini-free-improved",
    ai: Boolean(GEMINI_API_KEY),
    provider: "gemini",
    model: GEMINI_API_KEY ? GEMINI_MODEL : null,
    endpoints: ["/health", "/api/chat"]
  });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    status: "online",
    mode: "gemini-free-improved",
    ai: Boolean(GEMINI_API_KEY),
    provider: "gemini",
    model: GEMINI_API_KEY ? GEMINI_MODEL : null,
    time: new Date().toISOString()
  });
});

app.post("/api/search", checkSecret, handleChat);
app.post("/api/chat", checkSecret, handleChat);

async function handleChat(req, res) {
  try {
    const question = String(req.body?.question || "").trim();

    if (!question) {
      return res.status(400).json({
        ok: false,
        source: "gemini",
        error: "Campo 'question' é obrigatório.",
        answer: "Digite uma pergunta primeiro. Exemplo: me explica redstone no Minecraft."
      });
    }

    const result = await askGemini(question, {
      amigo: req.body?.amigo,
      streak: req.body?.streak,
      status: req.body?.status
    });

    if (!result.ok) {
      console.error("Erro Gemini:", result.error);

      return res.status(502).json({
        ok: false,
        source: "gemini-error",
        error: result.error,
        answer:
          "A IA grátis do Gemini não respondeu agora. Verifica se a GEMINI_API_KEY está certa no Render. Erro: " +
          result.error
      });
    }

    return res.json({
      ok: true,
      source: "gemini",
      model: GEMINI_MODEL,
      answer: result.answer
    });
  } catch (error) {
    console.error("Erro geral:", error);

    return res.status(500).json({
      ok: false,
      source: "server-error",
      error: String(error?.message || error),
      answer: "Erro interno na API do Foguinho. Veja os logs do Render."
    });
  }
}

app.listen(PORT, () => {
  console.log(`Foguinho API online na porta ${PORT}`);
  console.log(`Modo: Gemini grátis melhorado`);
  console.log(`Gemini API: ${GEMINI_API_KEY ? "ligada" : "desligada"}`);
  console.log(`Modelo: ${GEMINI_API_KEY ? GEMINI_MODEL : "nenhum"}`);
});
