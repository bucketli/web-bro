const TEXT_LIMIT = 800;
const HTML_LIMIT = 2400;
const INTERACTIVE_HTML_LIMIT = 3200;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    return false;
  }

  if (message.type === "PING") {
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "COLLECT_PAGE_DATA") {
    sendResponse(collectPageData());
    return false;
  }

  if (message.type === "COLLECT_YUQUE_DOC") {
    collectYuqueDoc()
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "APPLY_YUQUE_OPTIMIZED_CONTENT") {
    applyYuqueOptimizedContent(message.optimizeResult)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "RUN_TAOBAO_SEARCH") {
    runTaobaoSearch(message.keyword)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "COLLECT_TAOBAO_ITEMS") {
    collectTaobaoItems(message.page)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});

function collectPageData() {
  const mainRoot =
    document.querySelector("main") ||
    document.querySelector("article") ||
    document.querySelector('[role="main"]') ||
    document.body;

  const descriptionMeta = document.querySelector('meta[name="description"]');
  const firstH1 = document.querySelector("h1");
  const visibleText = extractVisibleText(mainRoot);
  const htmlSnippet = truncate(cleanHtml(mainRoot.outerHTML || ""), HTML_LIMIT);
  const interactiveHtml = truncate(extractInteractiveHtml(mainRoot), INTERACTIVE_HTML_LIMIT);

  return {
    title: document.title || "",
    url: window.location.href,
    metaDescription: descriptionMeta ? descriptionMeta.content.trim() : "",
    firstH1: firstH1 ? firstH1.innerText.trim() : "",
    text: truncate(visibleText, TEXT_LIMIT),
    htmlSnippet,
    interactiveHtml,
    capturedAt: new Date().toISOString()
  };
}

async function collectYuqueDoc() {
  if (!isYuquePage()) {
    throw new Error("当前页面不是羽雀文档页");
  }

  const titleInput = document.querySelector('textarea[data-testid="input"]');
  const titleNode =
    document.querySelector("#article-title") ||
    document.querySelector(".index-module_title_e9d9E");
  const editorRoot =
    document.querySelector("#doc-reader-content article#content .ne-viewer-body") ||
    document.querySelector("#doc-reader-content .ne-viewer-body") ||
    document.querySelector("#lark-text-editor .ne-engine[contenteditable='true']") ||
    document.querySelector("#doc-reader-content");

  if (!editorRoot) {
    throw new Error("未找到羽雀文档内容区域");
  }

  const title = normalizeWhitespace(
    titleInput && "value" in titleInput
      ? titleInput.value
      : titleNode
        ? titleNode.textContent
        : document.title
  );
  const nodes = extractYuqueTextNodes(editorRoot);
  const content = nodes.map((node) => node.text).join("\n");

  if (!content || !nodes.length) {
    throw new Error("未读取到羽雀文档正文");
  }

  const context = detectYuqueContext();
  if (!context.docId) {
    throw new Error("未能识别羽雀文档 docId");
  }

  return {
    ok: true,
    title,
    url: window.location.href,
    content,
    docId: context.docId,
    csrfToken: context.csrfToken,
    login: context.login,
    nodes,
    capturedAt: new Date().toISOString()
  };
}

function detectYuqueContext() {
  return {
    docId: detectYuqueDocId(),
    csrfToken: detectYuqueCsrfToken(),
    login: detectYuqueLogin()
  };
}

function detectYuqueDocId() {
  const resourceEntries = performance.getEntriesByType("resource");
  for (const entry of resourceEntries) {
    const match = String(entry && entry.name).match(/\/api\/docs\/(\d+)\/content(?:[/?#]|$)/);
    if (match) {
      return match[1];
    }
  }

  const html = document.documentElement.innerHTML.slice(0, 200000);
  const htmlMatch = html.match(/\/api\/docs\/(\d+)\/content/g);
  if (htmlMatch && htmlMatch.length) {
    const last = htmlMatch[htmlMatch.length - 1].match(/(\d+)/);
    if (last) {
      return last[1];
    }
  }

  return "";
}

function detectYuqueCsrfToken() {
  const cookieToken = readCookie("_csrf_token") || readCookie("csrf_token") || readCookie("CSRF-TOKEN");
  if (cookieToken) {
    return cookieToken;
  }

  const meta =
    document.querySelector('meta[name="csrf-token"]') ||
    document.querySelector('meta[name="x-csrf-token"]');
  return meta ? String(meta.getAttribute("content") || "").trim() : "";
}

function detectYuqueLogin() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts.length ? parts[0] : "";
}

function readCookie(name) {
  const prefix = `${name}=`;
  const entries = String(document.cookie || "").split(";");
  for (const entry of entries) {
    const trimmed = entry.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }

  return "";
}

function extractVisibleText(root) {
  if (!root) {
    return "";
  }

  const clone = root.cloneNode(true);
  clone.querySelectorAll("script, style, noscript").forEach((node) => node.remove());

  const text = clone.innerText || clone.textContent || "";
  return text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function extractYuqueText(root) {
  const blocks = Array.from(root.children).filter((node) => {
    if (!(node instanceof HTMLElement)) {
      return false;
    }

    const tagName = node.tagName.toLowerCase();
    return [
      "ne-h1",
      "ne-h2",
      "ne-h3",
      "ne-h4",
      "ne-p",
      "ne-oli",
      "ne-tli",
      "ne-table-hole",
      "ne-hole"
    ].includes(tagName);
  });

  if (!blocks.length) {
    return collectNeText(root);
  }

  const lines = blocks
    .map((block) => formatYuqueBlock(block))
    .filter(Boolean);

  return lines.join("\n\n").trim();
}

function extractYuqueTextNodes(root) {
  return Array.from(root.querySelectorAll("ne-text[id]"))
    .filter((node) => !shouldSkipYuqueTextNode(node))
    .map((node, index) => ({
      id: node.id,
      text: normalizeWhitespace(node.textContent || ""),
      index,
      context: buildYuqueNodeContext(node)
    }))
    .filter((node) => node.id && node.text);
}

function formatYuqueBlock(block) {
  const tagName = block.tagName ? block.tagName.toLowerCase() : "";
  const text = getBlockText(block);
  if (!text) {
    return "";
  }

  if (tagName === "ne-h1") {
    return `# ${text}`;
  }

  if (tagName === "ne-h2") {
    return `## ${text}`;
  }

  if (tagName === "ne-h3") {
    return `### ${text}`;
  }

  if (tagName === "ne-h4") {
    return `#### ${text}`;
  }

  if (tagName === "ne-oli") {
    const marker = block.querySelector(".ne-list-symbol");
    const prefix = normalizeWhitespace(marker ? marker.textContent : "") || "1";
    return `${prefix}. ${text}`;
  }

  if (tagName === "ne-tli") {
    return `- ${text}`;
  }

  if (tagName === "ne-hole") {
    return `\`\`\`\n${getCodeBlockText(block) || text}\n\`\`\``;
  }

  if (tagName === "ne-table-hole") {
    return getTableText(block) || text;
  }

  return text;
}

function getBlockText(block) {
  const tagName = block.tagName ? block.tagName.toLowerCase() : "";

  if (tagName === "ne-table-hole") {
    return getTableText(block);
  }

  if (tagName === "ne-hole") {
    return getCodeBlockText(block) || collectNeText(block);
  }

  return collectNeText(block);
}

function collectNeText(root) {
  const texts = Array.from(root.querySelectorAll("ne-text"))
    .map((node) => normalizeWhitespace(node.textContent || ""))
    .filter(Boolean);

  if (texts.length) {
    return texts.join(" ");
  }

  return normalizeWhitespace(root.textContent || "");
}

function buildYuqueNodeContext(node) {
  const parent = node.parentElement;
  const block = node.closest("ne-h1, ne-h2, ne-h3, ne-h4, ne-p, ne-oli, ne-uli, td, th");
  return {
    parentTag: parent ? parent.tagName.toLowerCase() : "",
    blockTag: block ? block.tagName.toLowerCase() : "",
    inTable: Boolean(node.closest("table")),
    inList: Boolean(node.closest("ne-oli, ne-uli")),
    inHeading: Boolean(node.closest("ne-h1, ne-h2, ne-h3, ne-h4"))
  };
}

function shouldSkipYuqueTextNode(node) {
  return Boolean(
    node.closest("ne-code") ||
    node.closest("card") ||
    node.closest("pre") ||
    node.closest(".ne-codeblock") ||
    node.closest("ne-hole")
  );
}

function getCodeBlockText(block) {
  const lines = Array.from(block.querySelectorAll(".cm-line"))
    .map((node) => String(node.textContent || "").replace(/\u200b/g, "").trimEnd())
    .filter((line) => line.trim());

  return lines.join("\n").trim();
}

function getTableText(block) {
  const rows = Array.from(block.querySelectorAll("table .ne-tr"))
    .map((row) => {
      const cells = Array.from(row.querySelectorAll(".ne-td"))
        .map((cell) => collectNeText(cell))
        .filter(Boolean);

      if (!cells.length) {
        return "";
      }

      return `| ${cells.join(" | ")} |`;
    })
    .filter(Boolean);

  return rows.join("\n").trim();
}

function cleanHtml(html) {
  return html.replace(/\s+/g, " ").trim();
}

function extractInteractiveHtml(root) {
  if (!root) {
    return "";
  }

  const selectors = [
    "nav",
    "header a[href]",
    "main a[href]",
    "article a[href]",
    '[role="button"]',
    '[role="link"]',
    "button",
    "a[href]",
    "form",
    "input",
    "select",
    "textarea"
  ];

  const seen = new Set();
  const parts = [];
  const nodes = root.querySelectorAll(selectors.join(", "));

  nodes.forEach((node) => {
    if (!(node instanceof HTMLElement)) {
      return;
    }

    const html = simplifyInteractiveNode(node);
    if (!html || seen.has(html)) {
      return;
    }

    seen.add(html);
    parts.push(html);
  });

  return parts.join("\n");
}

function simplifyInteractiveNode(node) {
  const clone = node.cloneNode(true);
  if (!(clone instanceof HTMLElement)) {
    return "";
  }

  clone.querySelectorAll("script, style, noscript").forEach((item) => item.remove());

  const allowedAttributes = new Set([
    "href",
    "type",
    "role",
    "name",
    "placeholder",
    "value",
    "title",
    "aria-label",
    "aria-describedby"
  ]);

  [clone, ...clone.querySelectorAll("*")].forEach((element) => {
    Array.from(element.attributes).forEach((attr) => {
      if (!allowedAttributes.has(attr.name)) {
        element.removeAttribute(attr.name);
      }
    });

    if (element.childElementCount === 0 && element.textContent) {
      element.textContent = element.textContent.replace(/\s+/g, " ").trim();
    }
  });

  return cleanHtml(clone.outerHTML || "");
}

function truncate(value, limit) {
  if (!value) {
    return "";
  }

  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit)}...`;
}

async function applyYuqueOptimizedContent(optimizeResult) {
  const replacements = optimizeResult && Array.isArray(optimizeResult.replacements)
    ? optimizeResult.replacements
    : [];

  if (!replacements.length) {
    throw new Error("缺少优化后的文本替换结果");
  }

  if (!isYuquePage()) {
    throw new Error("当前页面不是羽雀文档页");
  }

  const context = optimizeResult && optimizeResult.context
    ? optimizeResult.context
    : detectYuqueContext();

  if (!context || !context.docId) {
    throw new Error("未找到羽雀文档 ID");
  }

  const currentContent = await fetchYuqueContent(context);
  const updatedBodyAsl = applyTextReplacementsToMarkup(currentContent.body_asl, replacements);
  const updatedBodyHtml = applyTextReplacementsToMarkup(currentContent.body_html, replacements);

  await saveYuqueContent(context, {
    ...currentContent,
    body_asl: updatedBodyAsl,
    body_html: updatedBodyHtml
  });

  const publishResult = await publishYuqueDoc(context);

  return {
    ok: true,
    updated: true,
    published: publishResult.ok
  };
}

async function runTaobaoSearch(keyword) {
  const input = await waitForElement([
    'input[name="q"]',
    "#q",
    'input[type="search"]',
    "input.search-combobox-input__input"
  ]);

  const searchButton = findFirst([
    'button[type="submit"]',
    ".btn-search",
    ".search-button",
    'button[aria-label*="搜索"]',
    'input[type="submit"]'
  ]);

  if (!input) {
    throw new Error("未找到淘宝搜索输入框");
  }

  focusAndSetValue(input, keyword);

  if (searchButton) {
    searchButton.click();
  } else {
    const form = input.closest("form");
    if (form) {
      form.requestSubmit ? form.requestSubmit() : form.submit();
    } else {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      input.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", bubbles: true }));
    }
  }

  return {
    ok: true,
    data: {
      keyword
    }
  };
}

async function collectTaobaoItems(page) {
  await waitForTaobaoItems();

  const lookup = findTaobaoItemNodesWithSelector();
  const items = lookup.nodes
    .map((node) => parseTaobaoItem(node, page))
    .filter((item) => item.title && item.link);

  return {
    ok: true,
    items,
    debug: {
      page,
      selector: lookup.selector,
      nodeCount: lookup.nodes.length,
      itemCount: items.length,
      sampleTitles: items.slice(0, 3).map((item) => item.title)
    }
  };
}

function findFirst(selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      return element;
    }
  }
  return null;
}

function waitForElement(selectors, timeoutMs = 15000) {
  const existing = findFirst(selectors);
  if (existing) {
    return Promise.resolve(existing);
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error("等待页面元素超时"));
    }, timeoutMs);

    const observer = new MutationObserver(() => {
      const element = findFirst(selectors);
      if (!element) {
        return;
      }

      clearTimeout(timer);
      observer.disconnect();
      resolve(element);
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  });
}

async function ensureYuqueEditMode() {
  if (isYuqueEditMode()) {
    return;
  }

  const editButton = findYuqueEditButton();
  if (!editButton) {
    throw new Error("未找到羽雀编辑按钮，请先手动进入编辑模式");
  }

  editButton.click();
  await waitForElement([
    "#lark-text-editor .ne-engine[contenteditable='true']",
    "#lark-doc-edit-root .ne-engine[contenteditable='true']",
    ".lark-editor.lark-editor-lake .ne-engine[contenteditable='true']"
  ], 15000);
}

function waitForTaobaoItems(timeoutMs = 15000) {
  const existing = findTaobaoItemNodesWithSelector().nodes;
  if (existing.length) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error("等待淘宝商品列表超时"));
    }, timeoutMs);

    const observer = new MutationObserver(() => {
      const nodes = findTaobaoItemNodesWithSelector().nodes;
      if (!nodes.length) {
        return;
      }

      clearTimeout(timer);
      observer.disconnect();
      resolve();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  });
}

function findTaobaoItemNodes() {
  return findTaobaoItemNodesWithSelector().nodes;
}

function findTaobaoItemNodesWithSelector() {
  const primarySelectors = [
    "a.doubleCardWrapperAdapt--mEcC7olq",
    'a[id^="item_id_"]',
    'a[href*="item.taobao.com/item.htm"][id^="item_id_"]',
    'a[href*="detail.tmall.com/item.htm"][id^="item_id_"]'
  ];

  for (const selector of primarySelectors) {
    const nodes = Array.from(document.querySelectorAll(selector));
    if (nodes.length >= 3) {
      return {
        selector,
        nodes
      };
    }
  }

  const linkAnchors = findTaobaoItemAnchors();
  if (linkAnchors.length) {
    const nodes = dedupeNodes(
      linkAnchors
        .map((anchor) => findProductContainer(anchor))
        .filter(Boolean)
    );

    if (nodes.length) {
      return {
        selector: "heuristic:item-link-container",
        nodes
      };
    }
  }

  const selectors = [
    '[data-id][class*="doubleCardWrapper"]',
    '[data-id][class*="Card--"]',
    '.Item--doubleCardWrapper--L2XFE73',
    '.item',
    '[data-index]'
  ];

  for (const selector of selectors) {
    const nodes = Array.from(document.querySelectorAll(selector));
    if (nodes.length >= 3) {
      return {
        selector,
        nodes
      };
    }
  }

  return {
    selector: "",
    nodes: []
  };
}

function parseTaobaoItem(node, page) {
  const linkEl = findProductAnchorInNode(node);
  const title = extractTaobaoTitle(node, linkEl);
  const link = normalizeTaobaoLink(linkEl ? linkEl.getAttribute("href") : "");
  const priceText = extractPriceText(node);
  const soldText = extractSoldText(node);
  const shop = extractShopText(node);

  return {
    page,
    title: title || "",
    priceText,
    priceValue: parsePrice(priceText),
    soldText,
    soldCount: parseSoldCount(soldText),
    shop,
    link
  };
}

function findTaobaoItemAnchors() {
  const selectors = [
    'a[href*="item.taobao.com/item.htm"]',
    'a[href*="detail.tmall.com/item.htm"]',
    'a[href*="//item.taobao.com/"]',
    'a[href*="//detail.tmall.com/"]'
  ];

  const anchors = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
  return dedupeNodes(
    anchors.filter((anchor) => anchor instanceof HTMLAnchorElement)
  );
}

function findProductContainer(anchor) {
  let current = anchor;

  for (let depth = 0; depth < 6 && current; depth += 1) {
    if (looksLikeProductContainer(current)) {
      return current;
    }
    current = current.parentElement;
  }

  return anchor.parentElement || anchor;
}

function looksLikeProductContainer(element) {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const text = normalizeWhitespace(element.innerText || "");
  const hasLink = Boolean(findProductAnchorInNode(element));
  const hasPrice = /\d+(?:\.\d+)?/.test(extractPriceText(element));
  const hasSold = /(付款|已售|人购买|人付款|销量)/.test(text);

  return hasLink && (hasPrice || hasSold) && text.length >= 20;
}

function findProductAnchorInNode(node) {
  if (!node || !(node instanceof HTMLElement)) {
    return null;
  }

  if (node instanceof HTMLAnchorElement && node.href) {
    return node;
  }

  return node.querySelector(
    'a[href*="item.taobao.com/item.htm"], a[href*="detail.tmall.com/item.htm"], a[href*="//item.taobao.com/"], a[href*="//detail.tmall.com/"]'
  );
}

function extractPriceText(node) {
  const priceIntEl = node.querySelector(".priceInt--yqqZMJ5a");
  const priceFloatEl = node.querySelector(".priceFloat--XpixvyQ1");
  if (priceIntEl) {
    const intPart = normalizeWhitespace(priceIntEl.textContent || "");
    const floatPart = normalizeWhitespace(priceFloatEl ? priceFloatEl.textContent : "");
    return `${intPart}${floatPart || ""}`;
  }

  const explicit = node.querySelector(
    '[class*="price"], .price, .Price--priceInt--, .Price--priceFloat--, strong'
  );
  const explicitText = normalizePriceText(explicit ? explicit.textContent : "");
  if (explicitText) {
    return explicitText;
  }

  const text = normalizeWhitespace(node.innerText || "");
  const matches = text.match(/\d+(?:\.\d{1,2})?/g) || [];
  const candidate = matches.find((value) => value.includes(".") || Number(value) >= 10);
  return candidate || "";
}

function extractSoldText(node) {
  const soldEl = node.querySelector(".realSales--XZJiepmt");
  if (soldEl) {
    return normalizeWhitespace(soldEl.textContent || "");
  }

  const explicit = node.querySelector(
    '[class*="realSales"], [class*="sales"], .deal-cnt, .sale, [class*="payCnt"]'
  );
  const explicitText = normalizeWhitespace(explicit ? explicit.textContent : "");
  if (explicitText) {
    return explicitText;
  }

  const text = normalizeWhitespace(node.innerText || "");
  const match = text.match(/(\d+(?:\.\d+)?万?)[^\n]{0,8}(付款|已售|人购买|人付款|销量)/);
  return match ? match[0] : "";
}

function extractShopText(node) {
  const shopTextNodes = Array.from(node.querySelectorAll(".shopNameText--DmtlsDKm"));
  if (shopTextNodes.length) {
    const lastShopName = normalizeWhitespace(shopTextNodes[shopTextNodes.length - 1].textContent || "");
    if (lastShopName) {
      return lastShopName;
    }
  }

  const explicit = node.querySelector(
    '[class*="shopName"], .shopname, .shop, [class*="seller"] a, [class*="shop"] a'
  );
  const explicitText = normalizeWhitespace(explicit ? explicit.textContent : "");
  if (explicitText) {
    return explicitText;
  }

  const links = Array.from(node.querySelectorAll("a"));
  const matched = links
    .map((link) => normalizeWhitespace(link.textContent || ""))
    .find((text) => /(旗舰店|专卖店|企业店|小店|店铺|天猫)/.test(text));

  return matched || "";
}

function extractTaobaoTitle(node, linkEl) {
  const titleEl = node.querySelector(".title--ASSt27UY");
  const title = normalizeWhitespace(
    extractAttr(titleEl, "title") ||
      extractText(titleEl)
  );

  if (title) {
    return title;
  }

  const fallbackEl = node.querySelector('a[title], img[alt], [class*="title"], .title, h3, h4');
  return normalizeWhitespace(
    extractAttr(fallbackEl, "title") ||
      extractText(fallbackEl) ||
      extractAttr(fallbackEl, "alt") ||
      extractAttr(linkEl, "title") ||
      extractText(linkEl)
  );
}

function dedupeNodes(nodes) {
  const seen = new Set();
  const result = [];

  nodes.forEach((node) => {
    if (!node) {
      return;
    }

    const key = node.outerHTML ? node.outerHTML.slice(0, 300) : String(node);
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(node);
  });

  return result;
}

function extractText(element) {
  return normalizeWhitespace(element ? element.textContent : "");
}

function extractAttr(element, attr) {
  return normalizeWhitespace(element ? element.getAttribute(attr) : "");
}

function normalizeWhitespace(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function normalizePriceText(text) {
  const value = normalizeWhitespace(text).replace(/[^\d.-]/g, " ");
  const parts = value.split(" ").filter(Boolean);
  return parts.slice(0, 2).join(".");
}

function parsePrice(text) {
  const match = String(text || "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function parseSoldCount(text) {
  const normalized = normalizeWhitespace(text);
  const wanMatch = normalized.match(/(\d+(?:\.\d+)?)\s*万/);
  if (wanMatch) {
    return Math.round(Number(wanMatch[1]) * 10000);
  }

  const numMatch = normalized.replace(/,/g, "").match(/\d+/);
  return numMatch ? Number(numMatch[0]) : null;
}

function normalizeTaobaoLink(link) {
  const value = String(link || "").trim();
  if (!value) {
    return "";
  }

  if (value.startsWith("//")) {
    return `https:${value}`;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  if (value.startsWith("/")) {
    return `${window.location.origin}${value}`;
  }

  return value;
}

function isYuquePage() {
  return /yuque\.com$/i.test(window.location.hostname) || /yuque\.com/i.test(window.location.href);
}

function isYuqueEditMode() {
  return Boolean(
    document.body &&
    document.body.className.includes("editModeBody")
  ) || Boolean(
    document.querySelector("#lark-text-editor .ne-engine[contenteditable='true']") ||
    document.querySelector("#lark-doc-edit-root .ne-engine[contenteditable='true']") ||
    document.querySelector(".lark-editor.lark-editor-lake .ne-engine[contenteditable='true']")
  );
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function fetchYuqueContent(context) {
  const embeddedContent = extractYuqueContentFromPage();
  if (embeddedContent) {
    return embeddedContent;
  }

  const response = await fetch(`/api/docs/${encodeURIComponent(context.docId)}`, {
    method: "GET",
    credentials: "include",
    headers: buildYuqueHeaders(context, false)
  });

  if (!response.ok) {
    throw new Error(`读取羽雀文档内容失败: ${response.status}`);
  }

  const data = await response.json();
  const payload = extractYuqueContentPayload(data);
  if (!payload) {
    throw new Error("未从羽雀接口响应中解析到文档内容");
  }

  return payload;
}

function extractYuqueContentFromPage() {
  const html = document.documentElement.innerHTML;
  if (!html) {
    return null;
  }

  const bodyAsl =
    extractEmbeddedJsonString(html, "body_draft_asl") ||
    extractEmbeddedJsonString(html, "body_asl");
  const bodyHtml =
    extractEmbeddedJsonString(html, "body_draft") ||
    extractEmbeddedJsonString(html, "body") ||
    extractEmbeddedJsonString(html, "body_html");
  const draftVersion = extractEmbeddedJsonNumber(html, "draft_version");

  if (!bodyAsl || !bodyHtml) {
    return null;
  }

  return {
    format: extractEmbeddedJsonString(html, "format") || "lake",
    body_asl: bodyAsl,
    body_html: bodyHtml,
    draft_version: draftVersion || 1,
    sync_dynamic_data: false,
    created_by: "online",
    save_type: "auto",
    edit_type: extractEmbeddedJsonString(html, "edit_type") || "Lake"
  };
}

function extractEmbeddedJsonString(html, key) {
  const pattern = new RegExp(`"${escapeRegExp(key)}":"((?:\\\\.|[^"\\\\])*)"`);
  const match = html.match(pattern);
  if (!match) {
    return "";
  }

  try {
    return JSON.parse(`"${match[1]}"`);
  } catch (error) {
    return "";
  }
}

function extractEmbeddedJsonNumber(html, key) {
  const pattern = new RegExp(`"${escapeRegExp(key)}":(\\d+)`);
  const match = html.match(pattern);
  return match ? Number(match[1]) : 0;
}

async function saveYuqueContent(context, content) {
  const payload = {
    format: content.format || "lake",
    body_asl: content.body_asl || "",
    draft_version: content.draft_version || 1,
    sync_dynamic_data: Boolean(content.sync_dynamic_data),
    created_by: content.created_by || "online",
    body_html: content.body_html || "",
    save_type: content.save_type || "auto",
    edit_type: content.edit_type || "Lake"
  };

  const response = await fetch(`/api/docs/${encodeURIComponent(context.docId)}/content`, {
    method: "POST",
    credentials: "include",
    headers: buildYuqueHeaders(context, true),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const message = await safeReadResponseText(response);
    throw new Error(`保存羽雀文档失败: ${response.status} ${message}`);
  }
}

async function publishYuqueDoc(context) {
  const response = await fetch(`/api/docs/${encodeURIComponent(context.docId)}/publish`, {
    method: "POST",
    credentials: "include",
    headers: buildYuqueHeaders(context, true),
    body: JSON.stringify({
      force: false,
      notify: false,
      cover: null,
      ignoreGlobalMessage: true
    })
  });

  if (!response.ok) {
    const message = await safeReadResponseText(response);
    throw new Error(`发布羽雀文档失败: ${response.status} ${message}`);
  }

  return {
    ok: true
  };
}

function buildYuqueHeaders(context, withJson) {
  const headers = {
    "x-requested-with": "XMLHttpRequest"
  };

  if (withJson) {
    headers["content-type"] = "application/json";
  }

  if (context.csrfToken) {
    headers["x-csrf-token"] = context.csrfToken;
  }

  if (context.login) {
    headers["x-login"] = context.login;
  }

  return headers;
}

function extractYuqueContentPayload(data) {
  const candidates = [
    data,
    data && data.data,
    data && data.doc,
    data && data.data && data.data.doc
  ].filter(Boolean);

  const raw = candidates.find((item) =>
    (item.body_draft_asl && item.body_draft) ||
    (item.body_asl && item.body) ||
    (item.body_asl && item.body_html)
  );

  if (!raw) {
    return null;
  }

  return {
    format: raw.format || "lake",
    body_asl: raw.body_draft_asl || raw.body_asl || "",
    body_html: raw.body_draft || raw.body || raw.body_html || "",
    draft_version: raw.draft_version || 1,
    sync_dynamic_data: Boolean(raw.sync_dynamic_data),
    created_by: raw.created_by || "online",
    save_type: raw.save_type || "auto",
    edit_type: raw.edit_type || "Lake"
  };
}

function applyTextReplacementsToMarkup(markup, replacements) {
  let nextMarkup = String(markup || "");

  replacements.forEach((item) => {
    const id = String(item && item.id || "").trim();
    const text = String(item && item.text || "").trim();
    if (!id) {
      return;
    }

    const pattern = new RegExp(
      `(<span\\b[^>]*\\bid="${escapeRegExp(id)}"[^>]*>)([\\s\\S]*?)(</span>)`,
      "g"
    );

    nextMarkup = nextMarkup.replace(pattern, (_, start, _content, end) => {
      return `${start}${escapeMarkupText(text)}${end}`;
    });
  });

  return nextMarkup;
}

function escapeMarkupText(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeRegExp(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function safeReadResponseText(response) {
  try {
    return truncate(await response.text(), 300);
  } catch (error) {
    return "";
  }
}

function focusAndSetValue(input, value) {
  input.focus();

  const prototype = Object.getPrototypeOf(input);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  if (descriptor && descriptor.set) {
    descriptor.set.call(input, value);
  } else {
    input.value = value;
  }

  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}
