const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "config.json");

const defaultConfig = {
  defaultProvider: "mock",
  requestTimeoutMs: 90000,
  maxInputChars: {
    text: 400,
    documentContent: 12000,
    htmlSnippet: 600,
    interactiveHtml: 2400,
    metaDescription: 300,
    firstH1: 120,
    title: 120
  },
  providers: {
    mock: {
      enabled: true
    },
    openai: {
      enabled: false,
      baseUrl: "https://api.openai.com/v1",
      apiKey: "",
      model: "gpt-4.1-mini"
    },
    qwen: {
      enabled: false,
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      apiKey: "",
      model: "qwen3.5-plus"
    }
  }
};

function loadConfig() {
  if (!fs.existsSync(configPath)) {
    return { ...defaultConfig, configPath, configExists: false };
  }

  const raw = fs.readFileSync(configPath, "utf8");
  const userConfig = JSON.parse(raw);

  return {
    ...defaultConfig,
    ...userConfig,
    providers: {
      ...defaultConfig.providers,
      ...(userConfig.providers || {})
    },
    configPath,
    configExists: true
  };
}

function getProviderConfig(config, providerName) {
  const provider = (config.providers || {})[providerName];
  if (!provider) {
    throw new Error(`Unsupported provider: ${providerName}`);
  }
  return provider;
}

function hasRealApiKey(apiKey) {
  const value = String(apiKey || "").trim();
  return Boolean(value) && !/^YOUR_[A-Z0-9_]+$/i.test(value);
}

module.exports = {
  loadConfig,
  getProviderConfig,
  hasRealApiKey
};
