import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const app = express();

const PORT = process.env.PORT || 10000;
const MOD_SECRET = process.env.MOD_SECRET || "";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

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

function extractOpenAIText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const chunks = [];

  if (Array.isArray(data?.output)) {
    for (const item of data.output) {
      if (Array.isArray(item?.content)) {
        for (const content of item.content) {
          if (typeof content?.text === "string") {
            chunks.push(content.text);
          }
        }
      }
    }
  }

  return chunks.join("\n").trim();
}

function publicOpenAIError(status, bodyText) {
  // Não mostra chave nem dado sensível. Mostra só o motivo mais útil.
  try {
    const parsed = JSON.parse(bodyText);
    const message = parsed?.error?.message || parsed?.message;
    const code = parsed?.error?.code;
    const type = parsed?.error?.type;

    if (message) {
      return `${message}${code ? ` (${code})` : ""}${type ? ` [${type}]` : ""}`;
    }
  } catch {
    // ignora parse
  }

  return `Erro HTTP ${status} chamando OpenAI.`;
}

async function askOpenAI(question, context = {}) {
  if (!OPENAI_API_KEY) {
    return {
      ok: false,
      error: "OPENAI_API_KEY não está configurada no Render."
    };
  }

  const amigo = context.amigo || "Amigo";
  const streak = context.streak || "";
  const status = context.status || "";

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      instructions:
        "Você é o Foguinho, um mascote fofo de um mod Minecraft de streak de amizade. " +
        "Responda SEMPRE em português do Brasil. " +
        "Seja curto, útil, carismático e com personalidade de mascote. " +
        "Não diga que pesquisou na Wikipédia. Não use links a menos que o usuário peça. " +
        "Se a pergunta for sobre Minecraft, explique como se estivesse ajudando um iniciante. " +
        `Contexto do jogador: amigo=${amigo}; streak=${streak}; status=${status}.`,
      input: question,
      max_output_tokens: 450
    })
  });

  const bodyText = await response.text();

  if (!response.ok) {
    return {
      ok: false,
      error: publicOpenAIError(response.status, bodyText)
    };
  }

  let data;

  try {
    data = JSON.parse(bodyText);
  } catch {
    return {
      ok: false,
      error: "A OpenAI respondeu, mas a resposta não veio em JSON."
    };
  }

  const answer = extractOpenAIText(data);

  if (!answer) {
    return {
      ok: false,
      error: "A OpenAI respondeu, mas não encontrei texto na resposta."
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
    version: "3.0.0",
    mode: "openai-only",
    ai: Boolean(OPENAI_API_KEY),
    model: OPENAI_API_KEY ? OPENAI_MODEL : null,
    endpoints: ["/health", "/api/chat"]
  });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    status: "online",
    mode: "openai-only",
    ai: Boolean(OPENAI_API_KEY),
    model: OPENAI_API_KEY ? OPENAI_MODEL : null,
    time: new Date().toISOString()
  });
});

app.post("/api/search", checkSecret, async (req, res) => {
  // Mantive este endpoint só para compatibilidade.
  return app._router.handle(req, res);
});

app.post("/api/chat", checkSecret, async (req, res) => {
  try {
    const question = String(req.body?.question || "").trim();

    if (!question) {
      return res.status(400).json({
        ok: false,
        source: "openai",
        error: "Campo 'question' é obrigatório."
      });
    }

    const result = await askOpenAI(question, {
      amigo: req.body?.amigo,
      streak: req.body?.streak,
      status: req.body?.status
    });

    if (!result.ok) {
      console.error("Erro OpenAI:", result.error);

      return res.status(502).json({
        ok: false,
        source: "openai-error",
        error: result.error,
        answer:
          "A IA real não respondeu agora. Verifique no Render se a OPENAI_API_KEY está certa e se sua conta OpenAI tem créditos/billing ativo. Erro: " +
          result.error
      });
    }

    return res.json({
      ok: true,
      source: "openai",
      model: OPENAI_MODEL,
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
});

app.listen(PORT, () => {
  console.log(`Foguinho API online na porta ${PORT}`);
  console.log(`Modo: OpenAI only`);
  console.log(`IA OpenAI: ${OPENAI_API_KEY ? "ligada" : "desligada"}`);
  console.log(`Modelo: ${OPENAI_API_KEY ? OPENAI_MODEL : "nenhum"}`);
});
