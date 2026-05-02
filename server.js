import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const app = express();

const PORT = process.env.PORT || 10000;
const MOD_SECRET = process.env.MOD_SECRET || "";

// IA real opcional
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

function limitText(text, max = 1100) {
  if (!text) return "";
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + "...";
}

function localFoguinhoAnswer(question = "") {
  const q = question.toLowerCase();

  if (!question.trim()) {
    return "Pergunta vazia. Me pergunta algo tipo: quem foi Albert Einstein?";
  }

  if (q.includes("foguinho") || q.includes("streak")) {
    return "Eu sou o Foguinho, o mascote da sua streak. Minha missão é lembrar você de renovar a chama todo dia.";
  }

  if (q.includes("tempo") || q.includes("morre")) {
    return "O tempo da streak é calculado dentro do mod. Abre o menu do Foguinho para ver quanto falta.";
  }

  return "Não consegui pesquisar agora, mas posso tentar de novo se você escrever a pergunta de outro jeito.";
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

async function askOpenAI(question) {
  if (!OPENAI_API_KEY) {
    return null;
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      instructions:
        "Você é o Foguinho, um mascote fofo de Minecraft. " +
        "Responda em português do Brasil, de forma curta, útil e amigável. " +
        "Se a pergunta for sobre Minecraft, explique como se estivesse ajudando um jogador iniciante. " +
        "Se for uma pergunta geral, responda direto. " +
        "Não invente links. Se não tiver certeza, diga que não tem certeza.",
      input: question,
      max_output_tokens: 450
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`OpenAI error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const answer = extractOpenAIText(data);

  if (!answer) {
    return "A IA respondeu, mas não consegui ler o texto da resposta.";
  }

  return limitText(answer, 1200);
}

async function wikiSearchTitle(query) {
  const url = new URL("https://pt.wikipedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("list", "search");
  url.searchParams.set("srsearch", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("srlimit", "1");
  url.searchParams.set("utf8", "1");
  url.searchParams.set("origin", "*");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "FoguinhoMinecraftMod/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`Wikipedia search failed: ${response.status}`);
  }

  const data = await response.json();
  const first = data?.query?.search?.[0];

  return first?.title || null;
}

async function wikiSummary(title) {
  const encoded = encodeURIComponent(title).replaceAll("%20", "_");
  const response = await fetch(`https://pt.wikipedia.org/api/rest_v1/page/summary/${encoded}`, {
    headers: {
      "User-Agent": "FoguinhoMinecraftMod/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`Wikipedia summary failed: ${response.status}`);
  }

  const data = await response.json();

  return {
    title: data.title || title,
    extract: data.extract || "Sem resumo disponível.",
    url: data?.content_urls?.desktop?.page || ""
  };
}

async function askWikipedia(question) {
  const title = await wikiSearchTitle(question);

  if (!title) {
    return {
      source: "local",
      answer: localFoguinhoAnswer(question)
    };
  }

  const summary = await wikiSummary(title);

  return {
    source: "wikipedia",
    title: summary.title,
    answer: `Pesquisei na Wikipédia: ${summary.title}. ${limitText(summary.extract, 900)}`,
    url: summary.url
  };
}

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    name: "Foguinho Render API",
    version: "2.0.0",
    ai: Boolean(OPENAI_API_KEY),
    model: OPENAI_API_KEY ? OPENAI_MODEL : null,
    endpoints: ["/health", "/api/search", "/api/chat"]
  });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    status: "online",
    ai: Boolean(OPENAI_API_KEY),
    model: OPENAI_API_KEY ? OPENAI_MODEL : null,
    time: new Date().toISOString()
  });
});

app.post("/api/search", checkSecret, async (req, res) => {
  try {
    const question = String(req.body?.question || "").trim();

    if (!question) {
      return res.status(400).json({
        ok: false,
        error: "Campo 'question' é obrigatório."
      });
    }

    const result = await askWikipedia(question);

    return res.json({
      ok: true,
      ...result
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      source: "error",
      error: "Não consegui pesquisar agora.",
      fallback: localFoguinhoAnswer(String(req.body?.question || ""))
    });
  }
});

app.post("/api/chat", checkSecret, async (req, res) => {
  try {
    const question = String(req.body?.question || "").trim();

    if (!question) {
      return res.status(400).json({
        ok: false,
        error: "Campo 'question' é obrigatório."
      });
    }

    // Primeiro tenta IA real, se OPENAI_API_KEY existir.
    const aiAnswer = await askOpenAI(question);

    if (aiAnswer) {
      return res.json({
        ok: true,
        source: "openai",
        model: OPENAI_MODEL,
        answer: aiAnswer
      });
    }

    // Sem chave de IA, usa Wikipédia como fallback.
    const result = await askWikipedia(question);

    return res.json({
      ok: true,
      ...result
    });
  } catch (error) {
    console.error(error);

    // Se OpenAI falhar, tenta Wikipédia antes de desistir.
    try {
      const question = String(req.body?.question || "").trim();
      const result = await askWikipedia(question);

      return res.json({
        ok: true,
        warning: "A IA falhou, usei Wikipédia.",
        ...result
      });
    } catch {
      return res.status(500).json({
        ok: false,
        source: "error",
        error: "Erro pesquisando online.",
        fallback: localFoguinhoAnswer(String(req.body?.question || ""))
      });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Foguinho API online na porta ${PORT}`);
  console.log(`IA OpenAI: ${OPENAI_API_KEY ? "ligada" : "desligada"}`);
});
