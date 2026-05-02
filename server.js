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

function limitText(text, max = 1200) {
  if (!text) return "";
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + "...";
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

async function askGemini(question, context = {}) {
  if (!GEMINI_API_KEY) {
    return {
      ok: false,
      error: "GEMINI_API_KEY não está configurada no Render."
    };
  }

  const amigo = context.amigo || "Amigo";
  const streak = context.streak || "";
  const status = context.status || "";

  const prompt =
    "Você é o Foguinho, um mascote fofo de um mod Minecraft de streak de amizade.\n" +
    "Responda SEMPRE em português do Brasil.\n" +
    "Seja curto, útil, carismático e com personalidade de mascote.\n" +
    "Se a pergunta for sobre Minecraft, explique como se estivesse ajudando um iniciante.\n" +
    "Se não tiver certeza, diga que não tem certeza.\n" +
    `Contexto do jogador: amigo=${amigo}; streak=${streak}; status=${status}.\n\n` +
    `Pergunta do jogador: ${question}`;

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
          temperature: 0.8,
          maxOutputTokens: 450
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
    answer: limitText(answer, 1200)
  };
}

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    name: "Foguinho Render API",
    version: "4.0.0",
    mode: "gemini-free",
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
    mode: "gemini-free",
    ai: Boolean(GEMINI_API_KEY),
    provider: "gemini",
    model: GEMINI_API_KEY ? GEMINI_MODEL : null,
    time: new Date().toISOString()
  });
});

app.post("/api/search", checkSecret, async (req, res) => {
  // Compatibilidade com versões antigas.
  return handleChat(req, res);
});

app.post("/api/chat", checkSecret, handleChat);

async function handleChat(req, res) {
  try {
    const question = String(req.body?.question || "").trim();

    if (!question) {
      return res.status(400).json({
        ok: false,
        source: "gemini",
        error: "Campo 'question' é obrigatório.",
        answer: "Digite uma pergunta primeiro."
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
          "A IA grátis do Gemini não respondeu agora. Verifique no Render se GEMINI_API_KEY está configurada e se a chave está ativa. Erro: " +
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
  console.log(`Modo: Gemini grátis`);
  console.log(`Gemini API: ${GEMINI_API_KEY ? "ligada" : "desligada"}`);
  console.log(`Modelo: ${GEMINI_API_KEY ? GEMINI_MODEL : "nenhum"}`);
});
