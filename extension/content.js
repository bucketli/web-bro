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
      itemCount: items.length
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
  const titleEl = node.querySelector('a[title], img[alt], [class*="title"], .title');
  const linkEl = node.querySelector('a[href*="item.taobao.com"], a[href*="detail.tmall.com"], a[href]');
  const priceEl = node.querySelector('[class*="price"], .price, .Price--priceInt--, .Price--priceFloat--');
  const soldEl = node.querySelector('[class*="realSales"], [class*="sales"], .deal-cnt, .sale, [class*="payCnt"]');
  const shopEl = node.querySelector('[class*="shopName"], .shopname, .shop, [class*="seller"] a, [class*="shop"] a');

  const title = extractText(titleEl) || extractAttr(titleEl, "alt");
  const link = normalizeTaobaoLink(linkEl ? linkEl.getAttribute("href") : "");
  const priceText = normalizePriceText(priceEl ? priceEl.textContent : "");
  const soldText = normalizeWhitespace(soldEl ? soldEl.textContent : "");
  const shop = normalizeWhitespace(shopEl ? shopEl.textContent : "");

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
