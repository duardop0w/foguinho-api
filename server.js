import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const app = express();

const PORT = process.env.PORT || 10000;
const MOD_SECRET = process.env.MOD_SECRET || "";

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "64kb" }));

app.use(rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false
}));

function checkSecret(req, res, next) {
  // Se MOD_SECRET estiver vazio, a API aceita requisições sem token.
  // Se você definir MOD_SECRET no Render, o mod precisa enviar o mesmo token no header x-foguinho-secret.
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

function limitText(text, max = 900) {
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

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    name: "Foguinho Render API",
    version: "1.0.0",
    endpoints: ["/health", "/api/search", "/api/chat"]
  });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    status: "online",
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

    const title = await wikiSearchTitle(question);

    if (!title) {
      return res.json({
        ok: true,
        source: "local",
        answer: localFoguinhoAnswer(question)
      });
    }

    const summary = await wikiSummary(title);

    return res.json({
      ok: true,
      source: "wikipedia",
      title: summary.title,
      answer: `Pesquisei na Wikipédia: ${summary.title}. ${limitText(summary.extract, 900)}`,
      url: summary.url
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
  // Por enquanto, chat usa a mesma busca da Wikipédia.
  // Depois dá para plugar uma IA real aqui usando uma chave guardada no Render.
  try {
    const question = String(req.body?.question || "").trim();

    if (!question) {
      return res.status(400).json({
        ok: false,
        error: "Campo 'question' é obrigatório."
      });
    }

    const q = question.toLowerCase();

    if (
      q.includes("foguinho") ||
      q.includes("streak") ||
      q.includes("renovar") ||
      q.includes("amizade")
    ) {
      return res.json({
        ok: true,
        source: "foguinho-local",
        answer: localFoguinhoAnswer(question)
      });
    }

    const title = await wikiSearchTitle(question);

    if (!title) {
      return res.json({
        ok: true,
        source: "local",
        answer: localFoguinhoAnswer(question)
      });
    }

    const summary = await wikiSummary(title);

    return res.json({
      ok: true,
      source: "wikipedia",
      title: summary.title,
      answer: `Achei isso: ${summary.title}. ${limitText(summary.extract, 900)}`,
      url: summary.url
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      source: "error",
      error: "Erro pesquisando online.",
      fallback: localFoguinhoAnswer(String(req.body?.question || ""))
    });
  }
});

app.listen(PORT, () => {
  console.log(`Foguinho API online na porta ${PORT}`);
});
