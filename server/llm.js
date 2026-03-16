const { getProviderConfig, hasRealApiKey } = require("./config");

async function analyzePage(payload, config, providerOverride) {
  const providerName = providerOverride || config.defaultProvider || "mock";

  if (providerName === "mock") {
    return buildMockResult(payload);
  }

  const provider = getProviderConfig(config, providerName);
  validateProvider(providerName, provider);

  const preparedPayload = preparePayload(payload, config.maxInputChars || {});
  const prompt = buildPrompt(preparedPayload);
  console.log("[llm] analyzePage", {
    provider: providerName,
    model: provider.model,
    url: preparedPayload.url || "",
    title: truncate(preparedPayload.title || "", 80),
    textLength: (preparedPayload.text || "").length,
    htmlLength: (preparedPayload.htmlSnippet || "").length,
    interactiveHtmlLength: (preparedPayload.interactiveHtml || "").length
  });

  const result = await callOpenAICompatibleApi({
    providerName,
    provider,
    prompt,
    timeoutMs: config.requestTimeoutMs || 45000
  });

  return {
    provider: providerName,
    model: provider.model,
    ...normalizeModelResult(result)
  };
}

async function analyzeTaobaoItems(payload, config, providerOverride) {
  const providerName = providerOverride || config.defaultProvider || "mock";
  const keyword = String(payload.keyword || "").trim();
  const items = Array.isArray(payload.items) ? payload.items : [];

  if (!keyword) {
    throw new Error("Missing keyword");
  }

  if (!items.length) {
    throw new Error("No taobao items provided");
  }

  const preparedItems = prepareTaobaoItems(items);
  const fallback = pickBestTaobaoItem(preparedItems);

  if (providerName === "mock") {
    return buildMockTaobaoResult(keyword, preparedItems, fallback);
  }

  const provider = getProviderConfig(config, providerName);
  validateProvider(providerName, provider);

  const prompt = buildTaobaoPrompt(keyword, preparedItems);
  console.log("[llm] analyzeTaobaoItems", {
    provider: providerName,
    model: provider.model,
    keyword,
    itemCount: preparedItems.length
  });

  try {
    const result = await callOpenAICompatibleApi({
      providerName,
      provider,
      prompt,
      timeoutMs: config.requestTimeoutMs || 90000
    });

    return normalizeTaobaoResult(result, preparedItems, fallback, providerName, provider.model, keyword);
  } catch (error) {
    console.error("[llm] taobao fallback", {
      message: error.message,
      keyword,
      itemCount: preparedItems.length
    });
    return buildMockTaobaoResult(keyword, preparedItems, fallback, {
      provider: providerName,
      model: `${provider.model}-fallback`
    });
  }
}

async function analyzeYuqueDoc(payload, config, providerOverride) {
  const providerName = providerOverride || config.defaultProvider || "mock";
  const goal = String(payload.goal || "").trim();
  const title = String(payload.title || "").trim();
  const content = String(payload.content || "").trim();
  const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];

  if (!goal) {
    throw new Error("Missing goal");
  }

  if (!content || !nodes.length) {
    throw new Error("Missing document content");
  }

  const preparedPayload = {
    title: truncate(title, config.maxInputChars && config.maxInputChars.title || 120),
    url: String(payload.url || "").trim(),
    goal: truncate(goal, 300),
    content: truncate(content, config.maxInputChars && config.maxInputChars.documentContent || 12000),
    nodes: nodes
      .map((node) => ({
        id: String(node.id || "").trim(),
        text: truncate(String(node.text || "").trim(), 300),
        context: node.context || {}
      }))
      .filter((node) => node.id && node.text)
  };

  if (providerName === "mock") {
    return buildMockYuqueResult(preparedPayload);
  }

  const provider = getProviderConfig(config, providerName);
  validateProvider(providerName, provider);

  const prompt = buildYuquePrompt(preparedPayload);
  console.log("[llm] analyzeYuqueDoc", {
    provider: providerName,
    model: provider.model,
    title: truncate(preparedPayload.title, 80),
    goal: truncate(preparedPayload.goal, 80),
    contentLength: preparedPayload.content.length,
    nodeCount: preparedPayload.nodes.length
  });

  const result = await callOpenAICompatibleApi({
    providerName,
    provider,
    prompt,
    timeoutMs: config.requestTimeoutMs || 90000
  });

  return normalizeYuqueResult(result, providerName, provider.model, preparedPayload);
}

function validateProvider(providerName, provider) {
  if (!provider.enabled) {
    throw new Error(`Provider "${providerName}" is disabled in server/config.json`);
  }
  if (!hasRealApiKey(provider.apiKey)) {
    throw new Error(`Provider "${providerName}" is missing apiKey in server/config.json`);
  }
  if (!provider.baseUrl) {
    throw new Error(`Provider "${providerName}" is missing baseUrl in server/config.json`);
  }
  if (!provider.model) {
    throw new Error(`Provider "${providerName}" is missing model in server/config.json`);
  }
}

async function callOpenAICompatibleApi({ providerName, provider, prompt, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${provider.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`
      },
      body: JSON.stringify({
        model: provider.model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You analyze webpages for product and feature discovery. Return strict JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      }),
      signal: controller.signal
    });

    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(
        `${providerName} API request failed with status ${response.status}: ${truncate(rawText, 400)}`
      );
    }

    const data = JSON.parse(rawText);
    const content = data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content;

    if (!content) {
      throw new Error(`No model content returned from provider "${providerName}"`);
    }

    try {
      return parseModelJson(content);
    } catch (error) {
      throw new Error(`${error.message} | Model content preview: ${truncate(content, 500)}`);
    }
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`${providerName} API request timed out`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function buildPrompt(payload) {
  const request = {
    task: "Analyze what functions the webpage provides for end users.",
    outputFormat: {
      summary: [
        "3 short Chinese sentences, each no more than 30 Chinese characters"
      ],
      functions: [
        {
          name: "short function name",
          detail: "brief explanation in Chinese"
        }
      ]
    },
    rules: [
      "Focus on actual webpage capabilities, primary user tasks, and interactive affordances.",
      "Prioritize links, buttons, forms, navigation, and action-trigger elements over article text.",
      "Do not invent missing functions. If unsure, say it appears possible rather than certain.",
      "Prefer concise Chinese output.",
      "Return valid JSON only."
    ],
    page: {
      title: payload.title || "",
      url: payload.url || "",
      metaDescription: payload.metaDescription || "",
      firstH1: payload.firstH1 || "",
      interactiveHtml: payload.interactiveHtml || "",
      htmlSnippet: payload.htmlSnippet || "",
      supportingText: payload.text || ""
    }
  };

  return JSON.stringify(request, null, 2);
}

function buildTaobaoPrompt(keyword, items) {
  const request = {
    task: "Choose the single best Taobao product candidate for purchase guidance.",
    goal: "Find the option with the highest purchase count and the lowest price, while avoiding clearly poor-value outliers.",
    outputFormat: {
      summary: [
        "3 short Chinese sentences"
      ],
      bestItem: {
        link: "selected item link",
        title: "selected item title",
        reason: "why this item is preferred in Chinese"
      },
      functions: [
        {
          name: "decision dimension",
          detail: "brief explanation in Chinese"
        }
      ]
    },
    rules: [
      "Prioritize higher soldCount first, then lower priceValue.",
      "Use the provided structured item list only.",
      "Return strict JSON only."
    ],
    query: keyword,
    items
  };

  return JSON.stringify(request, null, 2);
}

function buildYuquePrompt(payload) {
  const request = {
    task: "Optimize text nodes in a Yuque Lake document according to the user's goal.",
    outputFormat: {
      summary: [
        "3 short Chinese sentences"
      ],
      changes: [
        {
          name: "change name",
          detail: "brief explanation in Chinese"
        }
      ],
      replacements: [
        {
          id: "node id",
          text: "optimized text for this node"
        }
      ]
    },
    rules: [
      "Follow the optimization goal closely.",
      "Only rewrite plain text nodes provided in the nodes array.",
      "Do not invent new nodes, do not remove ids, do not change code commands, code snippets, product names, version numbers, URLs, or table structure unless the text node itself clearly needs wording improvement.",
      "Preserve technical meaning and formatting intent.",
      "Return only the nodes that should actually change.",
      "Return strict JSON only."
    ],
    document: {
      title: payload.title,
      url: payload.url,
      goal: payload.goal,
      contentPreview: payload.content,
      nodes: payload.nodes
    }
  };

  return JSON.stringify(request, null, 2);
}

function preparePayload(payload, limits) {
  return {
    title: truncate(payload.title || "", limits.title || 120),
    url: String(payload.url || ""),
    metaDescription: truncate(payload.metaDescription || "", limits.metaDescription || 300),
    firstH1: truncate(payload.firstH1 || "", limits.firstH1 || 120),
    text: truncate(payload.text || "", limits.text || 400),
    htmlSnippet: truncate(payload.htmlSnippet || "", limits.htmlSnippet || 600),
    interactiveHtml: truncate(payload.interactiveHtml || "", limits.interactiveHtml || 2400)
  };
}

function normalizeModelResult(content) {
  const parsed = typeof content === "string" ? parseModelJson(content) : content;
  const summary = Array.isArray(parsed.summary) ? parsed.summary.slice(0, 3) : [];
  const functions = Array.isArray(parsed.functions) ? parsed.functions.slice(0, 8) : [];

  return {
    summary: ensureThreeSummaryLines(summary),
    functions: functions
      .map((item) => ({
        name: String((item && item.name) || "").trim(),
        detail: String((item && item.detail) || "").trim()
      }))
      .filter((item) => item.name || item.detail)
  };
}

function parseModelJson(content) {
  const jsonText = extractJson(content);
  try {
    return JSON.parse(jsonText);
  } catch (error) {
    const repaired = repairJsonText(jsonText);
    try {
      return JSON.parse(repaired);
    } catch (repairError) {
      throw new Error(
        `Failed to parse model JSON: ${repairError.message}. Raw: ${truncate(jsonText, 500)}`
      );
    }
  }
}

function normalizeTaobaoResult(result, items, fallback, providerName, model, keyword) {
  const bestItem = resolveBestItem(result, items, fallback);
  const functions = Array.isArray(result.functions) ? result.functions.slice(0, 6) : [];

  return {
    provider: providerName,
    model,
    keyword,
    summary: ensureThreeSummaryLines(Array.isArray(result.summary) ? result.summary : []),
    functions: functions
      .map((item) => ({
        name: String((item && item.name) || "").trim(),
        detail: String((item && item.detail) || "").trim()
      }))
      .filter((item) => item.name || item.detail),
    bestItem: {
      ...bestItem,
      reason: result.bestItem && result.bestItem.reason
        ? String(result.bestItem.reason).trim()
        : "该商品在销量和价格之间更均衡"
    },
    itemCount: items.length
  };
}

function normalizeYuqueResult(result, providerName, model, payload) {
  const changes = Array.isArray(result.changes) ? result.changes.slice(0, 8) : [];
  const replacements = normalizeYuqueReplacements(result && result.replacements, payload.nodes);

  if (!replacements.length) {
    throw new Error("Model did not return valid replacements");
  }

  return {
    provider: providerName,
    model,
    title: payload.title,
    goal: payload.goal,
    summary: ensureThreeSummaryLines(Array.isArray(result.summary) ? result.summary : []),
    changes: changes
      .map((item) => ({
        name: String((item && item.name) || "").trim(),
        detail: String((item && item.detail) || "").trim()
      }))
      .filter((item) => item.name || item.detail),
    functions: changes
      .map((item) => ({
        name: String((item && item.name) || "").trim(),
        detail: String((item && item.detail) || "").trim()
      }))
      .filter((item) => item.name || item.detail),
    replacements
  };
}

function normalizeYuqueReplacements(replacements, nodes) {
  if (!Array.isArray(replacements)) {
    return [];
  }

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  return replacements
    .map((item) => ({
      id: String((item && item.id) || "").trim(),
      text: String((item && item.text) || "").trim()
    }))
    .filter((item) => item.id && item.text && nodeMap.has(item.id))
    .filter((item) => item.text !== nodeMap.get(item.id).text)
    .slice(0, nodes.length);
}

function ensureThreeSummaryLines(summary) {
  const fallback = [
    "页面提供了明确的核心功能入口",
    "主要内容围绕用户任务和信息展示",
    "可结合页面结构继续做深度分析"
  ];

  const cleaned = summary
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 3);

  while (cleaned.length < 3) {
    cleaned.push(fallback[cleaned.length]);
  }

  return cleaned;
}

function extractJson(content) {
  const trimmed = String(content || "").trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  if (
    (candidate.startsWith("{") && candidate.endsWith("}")) ||
    (candidate.startsWith("[") && candidate.endsWith("]"))
  ) {
    return candidate;
  }

  const objectMatch = findBalancedJson(candidate, "{", "}");
  if (objectMatch) {
    return objectMatch;
  }

  const arrayMatch = findBalancedJson(candidate, "[", "]");
  if (arrayMatch) {
    return arrayMatch;
  }

  throw new Error(`Model response does not contain valid JSON: ${truncate(candidate, 400)}`);
}

function findBalancedJson(text, openChar, closeChar) {
  const start = text.indexOf(openChar);
  if (start < 0) {
    return "";
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === openChar) {
      depth += 1;
    } else if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return "";
}

function repairJsonText(text) {
  return String(text || "")
    .replace(/^\uFEFF/, "")
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3');
}

function buildMockResult(payload) {
  return {
    provider: "mock",
    model: "mock-v1",
    summary: [
      "这是第1句总结",
      "这是第2句总结",
      "这是第3句总结"
    ],
    functions: [
      {
        name: "信息浏览",
        detail: `页面标题为“${truncate(payload.title || "未命名页面", 40)}”，具备基础内容展示能力`
      },
      {
        name: "功能识别",
        detail: "后端已收到页面文本与主要 HTML 片段，可用于后续真实模型分析"
      }
    ]
  };
}

function buildMockTaobaoResult(keyword, items, bestItem, overrideMeta) {
  return {
    provider: overrideMeta && overrideMeta.provider ? overrideMeta.provider : "mock",
    model: overrideMeta && overrideMeta.model ? overrideMeta.model : "mock-v1",
    keyword,
    itemCount: items.length,
    summary: [
      `已分析 ${items.length} 个候选商品`,
      "优先比较了销量与价格",
      "已选出当前更优的购买选项"
    ],
    functions: [
      {
        name: "销量优先",
        detail: `候选商品中最高付款人数为 ${bestItem.soldCount || 0}`
      },
      {
        name: "价格对比",
        detail: `入选商品价格为 ${bestItem.priceText || "未知"}`
      }
    ],
    bestItem: {
      ...bestItem,
      reason: "该商品在当前候选中兼顾更高付款人数和更低价格"
    }
  };
}

function buildMockYuqueResult(payload) {
  const summary = [
    "已按目标重组文档结构",
    "表达更集中，步骤更清晰",
    "已生成节点级优化结果"
  ];

  const changes = [
    {
      name: "结构整理",
      detail: "把原文按背景、准备和步骤重新组织"
    },
    {
      name: "措辞优化",
      detail: `已根据“${truncate(payload.goal, 40)}”调整语气和说明方式`
    }
  ];

  return {
    provider: "mock",
    model: "mock-v1",
    title: payload.title,
    goal: payload.goal,
    summary,
    changes,
    functions: changes,
    replacements: payload.nodes.slice(0, 4).map((node) => ({
      id: node.id,
      text: node.text
    }))
  };
}

function prepareTaobaoItems(items) {
  return items
    .map((item, index) => ({
      index,
      page: item.page || null,
      title: truncate(String(item.title || "").trim(), 120),
      link: String(item.link || "").trim(),
      priceText: String(item.priceText || "").trim(),
      priceValue: typeof item.priceValue === "number" ? item.priceValue : null,
      soldText: String(item.soldText || "").trim(),
      soldCount: typeof item.soldCount === "number" ? item.soldCount : null,
      shop: truncate(String(item.shop || "").trim(), 60)
    }))
    .filter((item) => item.title && item.link);
}

function pickBestTaobaoItem(items) {
  return items
    .slice()
    .sort((a, b) => {
      const soldA = a.soldCount == null ? -1 : a.soldCount;
      const soldB = b.soldCount == null ? -1 : b.soldCount;
      if (soldB !== soldA) {
        return soldB - soldA;
      }

      const priceA = a.priceValue == null ? Number.MAX_SAFE_INTEGER : a.priceValue;
      const priceB = b.priceValue == null ? Number.MAX_SAFE_INTEGER : b.priceValue;
      if (priceA !== priceB) {
        return priceA - priceB;
      }

      return a.index - b.index;
    })[0];
}

function resolveBestItem(result, items, fallback) {
  const candidate = result && result.bestItem ? result.bestItem : null;
  const targetLink = candidate && candidate.link ? String(candidate.link).trim() : "";

  if (targetLink) {
    const matched = items.find((item) => item.link === targetLink);
    if (matched) {
      return matched;
    }
  }

  const targetTitle = candidate && candidate.title ? String(candidate.title).trim() : "";
  if (targetTitle) {
    const matched = items.find((item) => item.title === targetTitle);
    if (matched) {
      return matched;
    }
  }

  return fallback;
}

function truncate(value, limit) {
  const text = String(value || "");
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit)}...`;
}

module.exports = {
  analyzePage,
  analyzeTaobaoItems,
  analyzeYuqueDoc
};
