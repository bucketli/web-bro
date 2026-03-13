const express = require("express");
const cors = require("cors");
const { loadConfig, hasRealApiKey } = require("./config");
const { analyzePage, analyzeTaobaoItems } = require("./llm");

const app = express();
const host = "127.0.0.1";
const port = 8787;

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`
    );
  });
  next();
});

app.get("/health", (req, res) => {
  const config = loadConfig();

  res.json({
    ok: true,
    service: "page-summarizer",
    host,
    port,
    configExists: config.configExists,
    configPath: config.configPath,
    defaultProvider: config.defaultProvider,
    providers: summarizeProviders(config.providers)
  });
});

app.post("/api/summarize-page", async (req, res) => {
  const payload = req.body || {};
  const providerOverride = typeof req.query.provider === "string"
    ? req.query.provider
    : typeof payload.provider === "string"
      ? payload.provider
      : "";

  try {
    const config = loadConfig();
    const result = await analyzePage(payload, config, providerOverride);

    res.json({
      ok: true,
      data: {
        received: {
          title: payload.title || "",
          url: payload.url || ""
        },
        provider: result.provider,
        model: result.model,
        summary: result.summary,
        functions: result.functions
      }
    });
  } catch (error) {
    console.error("[summarize-page] request failed", {
      message: error.message,
      stack: error.stack,
      providerOverride: providerOverride || "",
      title: payload.title || "",
      url: payload.url || ""
    });

    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

app.post("/api/taobao-guide", async (req, res) => {
  const payload = req.body || {};
  const providerOverride = typeof req.query.provider === "string"
    ? req.query.provider
    : typeof payload.provider === "string"
      ? payload.provider
      : "";

  try {
    console.log("[taobao-guide] analyze request", {
      keyword: payload.keyword || "",
      itemCount: Array.isArray(payload.items) ? payload.items.length : 0
    });

    const config = loadConfig();
    const result = await analyzeTaobaoItems(payload, config, providerOverride);

    res.json({
      ok: true,
      data: result
    });
  } catch (error) {
    console.error("[taobao-guide] request failed", {
      message: error.message,
      stack: error.stack,
      providerOverride: providerOverride || "",
      keyword: payload.keyword || "",
      itemCount: Array.isArray(payload.items) ? payload.items.length : 0
    });

    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

app.listen(port, host, () => {
  console.log(`Server listening at http://${host}:${port}`);
});

function summarizeProviders(providers) {
  return Object.fromEntries(
    Object.entries(providers || {}).map(([name, provider]) => [
      name,
      {
        enabled: Boolean(provider.enabled),
        hasApiKey: hasRealApiKey(provider.apiKey),
        model: provider.model || ""
      }
    ])
  );
}
