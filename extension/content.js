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
