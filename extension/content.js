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

  if (message.type === "RUN_CC_AUTOMATION_CHECK") {
    runCcAutomationCheck(message.expectedUrl)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "RUN_CC_DATASOURCE_ADD_CHECK") {
    runCcDataSourceAddCheck(message.expectedListUrl, message.expectedAddUrl, message.mysqlAddConfig)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "RUN_CC_MYSQL_CONNECTION_TEST") {
    runCcMySqlConnectionTest(message.expectedListUrl, message.mySqlDataSourceId_1)
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

async function runCcAutomationCheck(expectedUrl) {
  await wait(1000);

  const currentUrl = window.location.href;
  const expected = String(expectedUrl || "").trim();
  const isTargetPage = !expected || currentUrl.startsWith(expected);

  if (!isTargetPage) {
    return {
      ok: true,
      data: {
        passed: false,
        reason: `当前页面不是目标地址：${currentUrl}`,
        url: currentUrl
      }
    };
  }

  const errorSignals = collectCcErrorSignals();
  const passed = errorSignals.length === 0;

  return {
    ok: true,
    data: {
      passed,
      reason: passed
        ? "页面刷新后未检测到明显异常"
        : `检测到异常信号：${errorSignals.join("；")}`,
      url: currentUrl,
      signals: errorSignals
    }
  };
}

async function runCcDataSourceAddCheck(expectedListUrl, expectedAddUrl, mysqlAddConfig) {
  await wait(600);
  const addConfig = normalizeMySqlAddConfig(mysqlAddConfig);

  const fromUrl = window.location.href;
  if (!isUrlMatched(fromUrl, expectedListUrl)) {
    return {
      ok: true,
      data: {
        passed: false,
        reason: `当前页面不是数据源列表页：${fromUrl}`,
        fromUrl,
        toUrl: fromUrl,
        fillFields: []
      }
    };
  }

  const addButton = findButtonByText("新增数据源");
  if (!addButton) {
    return {
      ok: true,
      data: {
        passed: false,
        reason: "未找到“新增数据源”按钮",
        fromUrl,
        toUrl: fromUrl,
        fillFields: []
      }
    };
  }

  addButton.click();
  await wait(200);

  const toUrl = await waitForUrlChange(expectedAddUrl, fromUrl, 10000);
  const reachedAddPage = isUrlMatched(toUrl, expectedAddUrl);
  if (!reachedAddPage) {
    return {
      ok: true,
      data: {
        passed: false,
        reason: `点击后未进入目标页，当前地址：${toUrl}`,
        fromUrl,
        toUrl,
        fillFields: [],
        mysqlRequiredFields: { required: [], found: [], missing: [] },
        stepResults: [],
        submitTriggered: false
      }
    };
  }

  await wait(500);

  const stepResults = [];
  const deploymentSelected = selectRadioOptionByGroupLabel("部署类型", addConfig.deployTypeLabel);
  stepResults.push({
    id: "select-deploy-type",
    name: `选择部署类型=${addConfig.deployTypeLabel}`,
    passed: deploymentSelected
  });

  const dbTypeSelected = selectRadioOptionByGroupLabel("数据库类型", addConfig.dbTypeLabel);
  stepResults.push({
    id: "select-db-type",
    name: `选择数据库类型=${addConfig.dbTypeLabel}`,
    passed: dbTypeSelected
  });

  const networkFilled = fillNetworkAddress(addConfig.host, addConfig.port);
  stepResults.push({
    id: "fill-network",
    name: `填写网络地址=${addConfig.host}`,
    passed: networkFilled
  });

  const accountFilled = fillInputByFormLabel("账号", addConfig.account);
  stepResults.push({
    id: "fill-account",
    name: `填写账号=${addConfig.account}`,
    passed: accountFilled
  });

  const passwordFilled = fillInputByFormLabel("密码", addConfig.password);
  stepResults.push({
    id: "fill-password",
    name: "填写密码=****",
    passed: passwordFilled
  });

  const descFilled = fillInputByFormLabel("描述", addConfig.description);
  stepResults.push({
    id: "fill-description",
    name: `填写描述=${addConfig.description}`,
    passed: descFilled
  });

  const mysqlRequiredFields = collectMySqlRequiredFields();
  stepResults.push({
    id: "detect-required-fields",
    name: "识别 MySQL 关键项(网络地址/账号/密码/描述)",
    passed: mysqlRequiredFields.missing.length === 0
  });

  const addApiResponsePromise = waitForDataSourceAddApiResponse(20000);
  const submitTriggered = clickButtonByText("新增数据源", ".add-dataSource-tools");
  stepResults.push({
    id: "submit-create",
    name: "触发新增数据源提交",
    passed: submitTriggered
  });

  const beforeSubmitUrl = window.location.href;
  const addApiResponse = submitTriggered
    ? await addApiResponsePromise
    : { id: "", matched: false };
  const afterSubmitUrl = window.location.href;
  const mySqlDataSourceId_1 = addApiResponse.id;
  const addApiDebug = buildAddApiDebug(addApiResponse);
  console.log("[cc-automation] datasource add api capture", addApiDebug);
  const fillFields = collectFormFillFields();
  const failedSteps = stepResults.filter((item) => !item.passed).map((item) => item.name);
  const passed = failedSteps.length === 0 && submitTriggered && Boolean(mySqlDataSourceId_1);
  const fieldPreview = fillFields
    .slice(0, 4)
    .map((item) => item.label || item.placeholder || item.name || "未命名字段")
    .join("、");

  return {
    ok: true,
    data: {
      passed,
      reason: passed
        ? `已触发 MySQL 数据源新增，识别到 ${fillFields.length} 个填充项${fieldPreview ? `（示例：${fieldPreview}）` : ""}${mySqlDataSourceId_1 ? `；mySqlDataSourceId_1=${mySqlDataSourceId_1}` : ""}`
        : `步骤未完成：${failedSteps.join("、") || "未知错误"}${mysqlRequiredFields.missing.length ? `；缺少关键项：${mysqlRequiredFields.missing.join("、")}` : ""}${!mySqlDataSourceId_1 ? "；未从 /rdp/console/api/v1/datasource/add 响应中提取到 dataSourceId" : ""}；addApiMatched=${addApiResponse.matched ? "true" : "false"}；addApiSeen=${addApiDebug.seenCount}；提交前URL：${beforeSubmitUrl}；提交后URL：${afterSubmitUrl}`,
      fromUrl,
      toUrl,
      fillFields,
      mysqlRequiredFields,
      stepResults,
      submitTriggered,
      beforeSubmitUrl,
      afterSubmitUrl,
      mySqlDataSourceId_1,
      addApiMatched: addApiResponse.matched,
      addApiDebug
    }
  };
}

function normalizeMySqlAddConfig(config) {
  const value = config && typeof config === "object" ? config : {};
  return {
    deployTypeLabel: normalizeWhitespace(value.deployTypeLabel || "自建"),
    dbTypeLabel: normalizeWhitespace(value.dbTypeLabel || "MySQL"),
    host: normalizeWhitespace(value.host || "127.0.0.1"),
    port: normalizeWhitespace(value.port || "3306"),
    account: normalizeWhitespace(value.account || "origin"),
    password: String(value.password || "123456"),
    description: normalizeWhitespace(value.description || "自动测试添加")
  };
}

async function runCcMySqlConnectionTest(expectedListUrl, mySqlDataSourceId_1) {
  await wait(400);
  const currentUrl = window.location.href;
  if (!isUrlMatched(currentUrl, expectedListUrl)) {
    return {
      ok: true,
      data: {
        passed: false,
        reason: `当前页面不是数据源列表页：${currentUrl}`,
        mySqlDataSourceId_1: String(mySqlDataSourceId_1 || "")
      }
    };
  }

  const normalizedId = String(mySqlDataSourceId_1 || "").trim();
  if (!normalizedId) {
    return {
      ok: true,
      data: {
        passed: false,
        reason: "缺少 mySqlDataSourceId_1，无法定位数据源行",
        mySqlDataSourceId_1: ""
      }
    };
  }

  let row = await waitForDataSourceRowById(normalizedId, 4000);
  if (!row) {
    const filterApplied = await applyDataSourceIdFilter(normalizedId);
    if (filterApplied) {
      row = await waitForDataSourceRowById(normalizedId, 6000);
      if (!row) {
        row = await waitForFirstDataSourceRow(3000);
      }
    }
  }
  if (!row) {
    return {
      ok: true,
      data: {
        passed: false,
        reason: `未找到数据源行（mySqlDataSourceId_1=${normalizedId}）`,
        mySqlDataSourceId_1: normalizedId
      }
    };
  }

  const entryButton = findTestConnectionEntry(row);
  if (!entryButton) {
    return {
      ok: true,
      data: {
        passed: false,
        reason: "未找到列表中的“测试连接”入口",
        mySqlDataSourceId_1: normalizedId
      }
    };
  }

  entryButton.click();
  const modal = await waitForVisibleModal(10000);
  if (!modal) {
    return {
      ok: true,
      data: {
        passed: false,
        reason: "点击入口后未出现测试连接弹窗",
        mySqlDataSourceId_1: normalizedId
      }
    };
  }

  const modalTestButton = await waitForModalTestButton(modal, 6000);
  if (!modalTestButton) {
    const modalButtons = collectModalButtonsText(modal);
    return {
      ok: true,
      data: {
        passed: false,
        reason: `弹窗中未找到“测试连接”按钮（检测到按钮：${modalButtons.join("、") || "无"}）`,
        mySqlDataSourceId_1: normalizedId
      }
    };
  }

  modalTestButton.click();
  await wait(1800);

  const errorSignals = collectConnectionErrorSignals();
  const passed = errorSignals.length === 0;

  return {
    ok: true,
    data: {
      passed,
      reason: passed
        ? "测试连接已触发，未检测到错误信息"
        : `测试连接失败：${errorSignals.join("；")}`,
      mySqlDataSourceId_1: normalizedId,
      errors: errorSignals
    }
  };
}

function collectCcErrorSignals() {
  const signals = [];
  const errorSelectors = [
    ".ant-result-error",
    ".error-page",
    ".exception",
    ".exception-container",
    "#webpack-dev-server-client-overlay",
    ".runtime-error"
  ];

  for (const selector of errorSelectors) {
    if (document.querySelector(selector)) {
      signals.push(`命中错误元素 ${selector}`);
    }
  }

  const pageText = normalizeWhitespace(document.body ? document.body.innerText : "");
  const patterns = [
    /uncaught\s+(typeerror|referenceerror|syntaxerror)/i,
    /cannot\s+read\s+properties/i,
    /cannot\s+set\s+properties/i,
    /failed\s+to\s+fetch/i,
    /network\s+error/i,
    /系统异常|页面异常|请求失败|服务异常|发生错误|程序错误/i
  ];

  patterns.forEach((pattern) => {
    if (pattern.test(pageText)) {
      signals.push(`命中异常文案 ${pattern.source}`);
    }
  });

  return Array.from(new Set(signals));
}

function findButtonByText(label, root = document) {
  const target = normalizeWhitespace(label);
  if (!target) {
    return null;
  }

  const selectors = [
    "button",
    '[role="button"]',
    ".ivu-btn",
    ".el-button",
    ".ant-btn"
  ];

  for (const selector of selectors) {
    const nodes = Array.from(root.querySelectorAll(selector));
    for (const node of nodes) {
      const text = normalizeWhitespace(node.textContent || "");
      if (text.includes(target)) {
        return node;
      }
    }
  }

  return null;
}

function findDataSourceRowById(dataSourceId) {
  const rows = Array.from(document.querySelectorAll(".ivu-table-body .ivu-table-tbody tr.ivu-table-row"));
  return rows.find((row) => rowMatchesDataSourceId(row, dataSourceId)) || null;
}

async function waitForDataSourceRowById(dataSourceId, timeoutMs = 10000) {
  const startedAt = Date.now();
  let refreshed = false;
  while (Date.now() - startedAt <= timeoutMs) {
    const row = findDataSourceRowById(dataSourceId);
    if (row) {
      return row;
    }

    if (!refreshed && Date.now() - startedAt > 2500) {
      clickRefreshButton();
      refreshed = true;
    }
    await wait(250);
  }
  return null;
}

async function waitForFirstDataSourceRow(timeoutMs = 3000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= timeoutMs) {
    const rows = Array.from(document.querySelectorAll(".ivu-table-body .ivu-table-tbody tr.ivu-table-row"));
    if (rows.length > 0) {
      return rows[0];
    }
    await wait(200);
  }
  return null;
}

function rowMatchesDataSourceId(row, dataSourceId) {
  if (!(row instanceof HTMLElement)) {
    return false;
  }

  const id = String(dataSourceId || "").trim();
  if (!id) {
    return false;
  }

  const text = normalizeWhitespace(row.textContent || "");
  const html = String(row.innerHTML || "");
  const escapedId = escapeRegExp(id);
  const patterns = [
    new RegExp(`\\bid\\s*[:=]\\s*${escapedId}\\b`, "i"),
    new RegExp(`\\bdata[-_]?source[-_]?id\\s*[:=]\\s*${escapedId}\\b`, "i"),
    new RegExp(`\\bdatasourceid\\s*[:=]\\s*${escapedId}\\b`, "i"),
    new RegExp(`\\bdataSourceId\\s*[:=]\\s*${escapedId}\\b`, "i"),
    new RegExp(`["']id["']\\s*:\\s*${escapedId}\\b`, "i"),
    new RegExp(`["']dataSourceId["']\\s*:\\s*${escapedId}\\b`, "i"),
    new RegExp(`\\bid=${escapedId}(?:\\D|$)`, "i"),
    new RegExp(`\\bdata-row-key\\s*=\\s*["']?${escapedId}["']?`, "i"),
    new RegExp(`\\brow-?id\\s*[:=]\\s*${escapedId}\\b`, "i")
  ];

  for (const pattern of patterns) {
    if (pattern.test(text) || pattern.test(html)) {
      return true;
    }
  }

  return false;
}

async function applyDataSourceIdFilter(dataSourceId) {
  const form = document.querySelector(".page-header-container form");
  if (!(form instanceof HTMLElement)) {
    return false;
  }

  const formItems = Array.from(form.querySelectorAll(".ivu-form-item"));
  if (formItems.length < 2) {
    return false;
  }

  const keyItem = formItems[0];
  const valueItem = formItems[1];
  const keySelect = keyItem.querySelector(".ivu-select");
  if (!(keySelect instanceof HTMLElement)) {
    return false;
  }

  if (!selectIViewOptionByText(keySelect, "数据源数字ID")) {
    return false;
  }

  const valueInput = valueItem.querySelector("input.ivu-select-input, input.ivu-input, input[type='text']");
  if (!(valueInput instanceof HTMLInputElement)) {
    return false;
  }
  if (!setInputValue(valueInput, String(dataSourceId))) {
    return false;
  }
  valueInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  valueInput.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", bubbles: true }));

  const queryButton = Array.from(form.querySelectorAll("button, .ivu-btn"))
    .find((btn) => normalizeWhitespace(btn.textContent || "") === "查询");
  if (queryButton) {
    queryButton.click();
  }

  await wait(1200);
  return true;
}

function selectIViewOptionByText(selectRoot, optionText) {
  const selection = selectRoot.querySelector(".ivu-select-selection");
  if (!(selection instanceof HTMLElement)) {
    return false;
  }

  selection.click();
  const target = normalizeWhitespace(optionText);
  const options = Array.from(document.querySelectorAll(".ivu-select-dropdown .ivu-select-item"));
  const option = options.find((item) => normalizeWhitespace(item.textContent || "") === target);
  if (!option) {
    return false;
  }

  option.click();
  return true;
}

function clickRefreshButton() {
  const container = document.querySelector(".page-header-function");
  if (!container) {
    return false;
  }

  const buttons = Array.from(container.querySelectorAll("button, .ivu-btn"));
  const refreshButton = buttons.find((button) => {
    const text = normalizeWhitespace(button.textContent || "");
    return text === "" && button.querySelector("use[xlink\\:href*='Refresh'], use[href*='Refresh']");
  });

  if (!refreshButton) {
    return false;
  }

  refreshButton.click();
  return true;
}

function findTestConnectionEntry(row) {
  if (!(row instanceof HTMLElement)) {
    return null;
  }

  const links = Array.from(row.querySelectorAll("a, button, [role='button']"));
  const direct = links.find((node) => normalizeWhitespace(node.textContent || "") === "测试连接");
  if (direct) {
    return direct;
  }

  const fixedRows = Array.from(document.querySelectorAll(".ivu-table-fixed-right .ivu-table-fixed-body tr.ivu-table-row"));
  for (const fixedRow of fixedRows) {
    if (!normalizeWhitespace(fixedRow.textContent || "").includes("测试连接")) {
      continue;
    }
    const candidate = Array.from(fixedRow.querySelectorAll("a, button, [role='button']"))
      .find((node) => normalizeWhitespace(node.textContent || "") === "测试连接");
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

async function waitForModalTestButton(modal, timeoutMs = 6000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= timeoutMs) {
    const button = findModalTestButton(modal);
    if (button) {
      return button;
    }
    await wait(200);
  }
  return null;
}

function findModalTestButton(modal) {
  if (!(modal instanceof HTMLElement)) {
    return null;
  }

  const bodyButton = Array.from(
    modal.querySelectorAll(".ant-modal-body button, .ivu-modal-body button, .el-dialog__body button")
  ).find((btn) => normalizeWhitespace(btn.textContent || "").includes("测试连接"));
  if (bodyButton) {
    return bodyButton;
  }

  const exact = findButtonByText("测试连接", modal);
  if (exact) {
    return exact;
  }

  const buttons = Array.from(modal.querySelectorAll("button, .ivu-btn, .ant-btn, .el-button, [role='button']"));
  const primaryKeyword = ["测试", "连接"];
  const primary = buttons.find((btn) => {
    const text = normalizeWhitespace(btn.textContent || "");
    return text && primaryKeyword.every((kw) => text.includes(kw));
  });
  if (primary) {
    return primary;
  }

  const footerPrimary = modal.querySelector(
    ".ivu-modal-footer .ivu-btn-primary, .ant-modal-footer .ant-btn-primary, .el-dialog__footer .el-button--primary"
  );
  if (footerPrimary instanceof HTMLElement) {
    return footerPrimary;
  }

  return null;
}

function collectModalButtonsText(modal) {
  if (!(modal instanceof HTMLElement)) {
    return [];
  }

  const buttons = Array.from(modal.querySelectorAll("button, .ivu-btn, .ant-btn, .el-button, [role='button']"));
  return buttons
    .map((btn) => normalizeWhitespace(btn.textContent || ""))
    .filter(Boolean)
    .slice(0, 12);
}

async function waitForVisibleModal(timeoutMs = 10000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= timeoutMs) {
    const modal = findVisibleModal();
    if (modal) {
      return modal;
    }
    await wait(200);
  }
  return null;
}

function findVisibleModal() {
  const selectors = [".ant-modal-wrap .ant-modal-content", ".ivu-modal-wrap .ivu-modal-content", ".el-dialog"];
  for (const selector of selectors) {
    const nodes = Array.from(document.querySelectorAll(selector));
    const visible = nodes.find((node) => isElementVisible(node));
    if (visible) {
      return visible;
    }
  }
  return null;
}

function collectConnectionErrorSignals() {
  const signals = [];
  const text = normalizeWhitespace(document.body ? document.body.innerText : "");
  const patterns = [
    /测试连接失败/i,
    /连接失败/i,
    /无法连接/i,
    /认证失败/i,
    /超时/i,
    /error/i,
    /exception/i,
    /拒绝连接/i
  ];

  patterns.forEach((pattern) => {
    if (pattern.test(text)) {
      signals.push(`命中错误文案 ${pattern.source}`);
    }
  });

  const explicitErrorNodes = Array.from(document.querySelectorAll(
    ".ivu-message-error, .ivu-notice-error, .ant-message-error, .el-message--error, .ivu-alert-error"
  ));
  explicitErrorNodes.forEach((node) => {
    const msg = normalizeWhitespace(node.textContent || "");
    if (msg) {
      signals.push(msg);
    }
  });

  return Array.from(new Set(signals));
}

function isUrlMatched(currentUrl, expectedUrl) {
  const current = String(currentUrl || "").trim();
  const expected = String(expectedUrl || "").trim();
  if (!expected) {
    return true;
  }
  if (!current) {
    return false;
  }
  if (current === expected || current.startsWith(expected)) {
    return true;
  }

  return getHashPath(current) === getHashPath(expected);
}

function getHashPath(url) {
  const value = String(url || "");
  const hashIndex = value.indexOf("#");
  if (hashIndex === -1) {
    return "";
  }

  return value.slice(hashIndex + 1).replace(/[?#].*$/, "");
}

function waitForUrlChange(expectedUrl, beforeUrl, timeoutMs = 10000) {
  if (isUrlMatched(window.location.href, expectedUrl) || window.location.href !== beforeUrl) {
    return Promise.resolve(window.location.href);
  }

  return new Promise((resolve) => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const current = window.location.href;
      const timeout = Date.now() - startedAt > timeoutMs;
      if (isUrlMatched(current, expectedUrl) || current !== beforeUrl || timeout) {
        window.clearInterval(timer);
        resolve(current);
      }
    }, 120);
  });
}

function collectFormFillFields() {
  const seen = new Set();
  const fields = [];
  const items = Array.from(document.querySelectorAll(".ivu-form-item, .el-form-item, .ant-form-item, form .form-item"));

  items.forEach((item) => {
    const control = item.querySelector("input, textarea, select, .ivu-select, .el-select, .ant-select");
    if (!control || !isElementVisible(control)) {
      return;
    }

    const labelNode = item.querySelector(".ivu-form-item-label, .el-form-item__label, .ant-form-item-label, label");
    const label = normalizeWhitespace(labelNode ? labelNode.textContent : "");
    const key = `${label}|${getControlType(control)}|${getFieldPlaceholder(control)}`;
    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    fields.push({
      label,
      name: readFieldName(control),
      type: getControlType(control),
      placeholder: getFieldPlaceholder(control),
      required: isFieldRequired(item, control)
    });
  });

  if (fields.length) {
    return fields;
  }

  const fallbackControls = Array.from(document.querySelectorAll("input, textarea, select, .ivu-select"));
  fallbackControls.forEach((control) => {
    if (!isElementVisible(control)) {
      return;
    }

    const name = readFieldName(control);
    const placeholder = getFieldPlaceholder(control);
    const type = getControlType(control);
    const key = `${name}|${type}|${placeholder}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    fields.push({
      label: "",
      name,
      type,
      placeholder,
      required: isFieldRequired(control.closest("form, .ivu-form-item") || control, control)
    });
  });

  return fields;
}

function collectMySqlRequiredFields() {
  const requiredLabels = ["网络地址", "账号", "密码", "描述"];
  const found = [];
  const missing = [];

  requiredLabels.forEach((label) => {
    const labelNode = findLabelNode(label);
    if (labelNode) {
      found.push(label);
    } else {
      missing.push(label);
    }
  });

  return {
    required: requiredLabels,
    found,
    missing
  };
}

function findLabelNode(labelText) {
  const target = normalizeWhitespace(labelText);
  const labels = Array.from(document.querySelectorAll(".ivu-form-item-label, .el-form-item__label, .ant-form-item-label, label"));
  return labels.find((node) => normalizeWhitespace(node.textContent || "").includes(target)) || null;
}

function findFormItemByLabel(labelText) {
  const labelNode = findLabelNode(labelText);
  if (!labelNode) {
    return null;
  }
  return labelNode.closest(".ivu-form-item, .el-form-item, .ant-form-item");
}

function selectRadioOptionByGroupLabel(groupLabel, optionText) {
  const item = findFormItemByLabel(groupLabel);
  if (!item) {
    return false;
  }

  const options = Array.from(item.querySelectorAll(".ivu-radio-wrapper, label"));
  const target = options.find((node) => normalizeWhitespace(node.textContent || "").includes(normalizeWhitespace(optionText)));
  if (!target) {
    return false;
  }

  target.click();
  const input = target.querySelector("input[type='radio']");
  if (input) {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  return target.classList.contains("ivu-radio-wrapper-checked") || Boolean(input && input.checked);
}

function fillNetworkAddress(host, port) {
  const item = findFormItemByLabel("网络地址");
  if (!item) {
    return false;
  }

  const inputs = Array.from(item.querySelectorAll("input.ivu-input, input[type='text']"))
    .filter((input) => isElementVisible(input));
  if (!inputs.length) {
    return false;
  }

  let hostInput = inputs.find((input) => {
    const placeholder = normalizeWhitespace(input.getAttribute("placeholder") || "");
    return placeholder.includes("ip") || placeholder.includes("domain");
  });
  if (!hostInput) {
    hostInput = inputs[0];
  }

  let portInput = inputs.find((input) => {
    const placeholder = normalizeWhitespace(input.getAttribute("placeholder") || "");
    return placeholder.includes("port");
  });

  const hostOk = setInputValue(hostInput, host);
  const portOk = portInput ? setInputValue(portInput, port) : true;
  return hostOk && portOk;
}

function fillInputByFormLabel(labelText, value) {
  const item = findFormItemByLabel(labelText);
  if (!item) {
    return false;
  }

  const label = normalizeWhitespace(labelText);
  let targetInput = null;
  if (label === "密码") {
    targetInput = item.querySelector("input[type='password']");
  } else {
    targetInput = item.querySelector("input.ivu-input, input[type='text'], textarea");
  }

  if (!targetInput || !isElementVisible(targetInput)) {
    return false;
  }

  return setInputValue(targetInput, value);
}

function setInputValue(input, value) {
  if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLTextAreaElement)) {
    return false;
  }

  input.focus();
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value");
  if (setter && typeof setter.set === "function") {
    setter.set.call(input, value);
  } else {
    input.value = value;
  }
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.blur();
  return normalizeWhitespace(input.value) === normalizeWhitespace(value);
}

function clickButtonByText(buttonText, containerSelector) {
  const container = containerSelector ? document.querySelector(containerSelector) : document;
  if (!container) {
    return false;
  }

  const buttons = Array.from(container.querySelectorAll("button, .ivu-btn, [role='button']"));
  const target = buttons.find((node) => normalizeWhitespace(node.textContent || "") === normalizeWhitespace(buttonText));
  if (!target) {
    return false;
  }

  target.click();
  return true;
}

function detectDataSourceId(beforeSubmitUrl, afterSubmitUrl) {
  const candidates = [
    extractNumericIdFromUrl(afterSubmitUrl),
    extractNumericIdFromUrl(beforeSubmitUrl),
    extractNumericIdFromPageText()
  ].filter(Boolean);

  return candidates.length ? String(candidates[0]) : "";
}

async function waitForDataSourceAddApiResponse(timeoutMs = 15000) {
  return new Promise((resolve) => {
    let seenCount = 0;
    let lastPacket = null;
    const timer = window.setTimeout(() => {
      window.removeEventListener("message", handleMessage);
      resolve({
        id: "",
        matched: false,
        seenCount,
        lastPacket
      });
    }, timeoutMs);

    function handleMessage(event) {
      const packet = event && event.data ? event.data : null;
      if (!packet || packet.source !== "CC_AUTOMATION_HOOK" || packet.type !== "CC_DATASOURCE_ADD_API_RESULT") {
        return;
      }
      const requestUrl = packet && packet.meta && packet.meta.requestUrl ? String(packet.meta.requestUrl) : "";
      if (!isDatasourceAddApiUrl(requestUrl)) {
        return;
      }

      seenCount += 1;
      lastPacket = packet;
      const id = extractIdFromAddApiPayload(packet.payload);
      if (!id) {
        return;
      }

      window.clearTimeout(timer);
      window.removeEventListener("message", handleMessage);
      resolve({
        id,
        matched: true,
        seenCount,
        lastPacket
      });
    }

    window.addEventListener("message", handleMessage);
  });
}

function isDatasourceAddApiUrl(url) {
  return String(url || "").includes("/rdp/console/api/v1/datasource/add");
}

function buildAddApiDebug(addApiResponse) {
  const packet = addApiResponse && addApiResponse.lastPacket ? addApiResponse.lastPacket : null;
  const payload = packet && packet.payload ? packet.payload : null;
  const meta = packet && packet.meta ? packet.meta : {};
  let payloadPreview = "";
  try {
    payloadPreview = JSON.stringify(payload || {});
  } catch (error) {
    payloadPreview = String(payload || "");
  }

  return {
    matched: Boolean(addApiResponse && addApiResponse.matched),
    seenCount: addApiResponse && typeof addApiResponse.seenCount === "number" ? addApiResponse.seenCount : 0,
    transport: meta && meta.transport ? String(meta.transport) : "",
    requestUrl: meta && meta.requestUrl ? String(meta.requestUrl) : "",
    payloadPreview: payloadPreview.slice(0, 500)
  };
}

function extractIdFromAddApiPayload(payload) {
  if (!payload) {
    return "";
  }

  if (typeof payload === "string") {
    const directMatch = payload.match(/"data"\s*:\s*([0-9]{1,})/i);
    return directMatch && directMatch[1] ? directMatch[1] : "";
  }

  if (typeof payload !== "object") {
    return "";
  }

  if (typeof payload.__rawText === "string") {
    const rawMatch = payload.__rawText.match(/"data"\s*:\s*([0-9]{1,})/i);
    if (rawMatch && rawMatch[1]) {
      return rawMatch[1];
    }
  }

  const success = payload.success === true
    || payload.code === "1"
    || payload.code === 1
    || payload.msg === "request success";
  if (!success) {
    return "";
  }

  const raw = payload.data;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return String(raw);
  }

  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    return raw.trim();
  }

  if (typeof payload.id === "number" && Number.isFinite(payload.id)) {
    return String(payload.id);
  }

  if (typeof payload.id === "string" && /^\d+$/.test(payload.id.trim())) {
    return payload.id.trim();
  }

  if (raw && typeof raw === "object") {
    if (typeof raw.id === "number" && Number.isFinite(raw.id)) {
      return String(raw.id);
    }
    if (typeof raw.id === "string" && /^\d+$/.test(raw.id.trim())) {
      return raw.id.trim();
    }
  }

  return "";
}

function installDataSourceAddApiHook() {
  if (document.getElementById("cc-datasource-add-hook")) {
    return;
  }

  const script = document.createElement("script");
  script.id = "cc-datasource-add-hook";
  script.src = chrome.runtime.getURL("page-hook.js");
  script.async = false;

  (document.documentElement || document.head || document.body).appendChild(script);
}

function extractNumericIdFromUrl(url) {
  const value = String(url || "");
  if (!value) {
    return "";
  }

  const patterns = [
    /(?:dataSourceId|datasourceId|sourceId|id)=([0-9]{3,})/i,
    /\/(?:ccdatasource|datasource)\/(?:detail|edit|view|success|result)?\/?([0-9]{3,})(?:[/?#]|$)/i,
    /\/(?:success|result|detail)\/([0-9]{3,})(?:[/?#]|$)/i
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return "";
}

function extractNumericIdFromPageText() {
  const textParts = [];
  const messageSelectors = [
    ".ivu-message-notice-content-text",
    ".ivu-notice-desc",
    ".ivu-modal-body",
    ".ant-message-notice-content",
    ".el-message__content"
  ];

  messageSelectors.forEach((selector) => {
    const nodes = document.querySelectorAll(selector);
    nodes.forEach((node) => {
      const text = normalizeWhitespace(node.textContent || "");
      if (text) {
        textParts.push(text);
      }
    });
  });

  const bodyText = normalizeWhitespace(document.body ? document.body.innerText : "");
  if (bodyText) {
    textParts.push(bodyText);
  }

  const text = textParts.join("\n");
  if (!text) {
    return "";
  }

  const patterns = [
    /数据源(?:数字)?ID[:：\s#]*([0-9]{3,})/i,
    /(?:data\s*source\s*id|datasourceid)[:：\s#]*([0-9]{3,})/i,
    /"msg"\s*:\s*"request success"[\s\S]{0,220}"data"\s*:\s*([0-9]{1,})/i,
    /"data"\s*:\s*([0-9]{1,})[\s\S]{0,220}"msg"\s*:\s*"request success"/i,
    /\bdata\s*[:：]\s*([0-9]{1,})\b[\s\S]{0,120}\brequest success\b/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  const scripts = Array.from(document.querySelectorAll("script"));
  for (const script of scripts) {
    const content = String(script.textContent || "");
    if (!content) {
      continue;
    }
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
  }

  return "";
}

function readFieldName(control) {
  if (!(control instanceof HTMLElement)) {
    return "";
  }
  return normalizeWhitespace(
    control.getAttribute("name") ||
    control.getAttribute("id") ||
    control.getAttribute("data-name") ||
    ""
  );
}

function getControlType(control) {
  if (!(control instanceof HTMLElement)) {
    return "unknown";
  }

  if (control.matches(".ivu-select, .el-select, .ant-select")) {
    return "select";
  }

  const tagName = control.tagName.toLowerCase();
  if (tagName === "input") {
    return control.getAttribute("type") || "text";
  }
  if (tagName === "textarea" || tagName === "select") {
    return tagName;
  }
  return tagName;
}

function getFieldPlaceholder(control) {
  if (!(control instanceof HTMLElement)) {
    return "";
  }

  const ownPlaceholder = control.getAttribute("placeholder");
  if (ownPlaceholder) {
    return normalizeWhitespace(ownPlaceholder);
  }

  const innerInput = control.querySelector("input, textarea");
  return normalizeWhitespace(innerInput ? innerInput.getAttribute("placeholder") : "");
}

function isFieldRequired(container, control) {
  const controlRequired = control instanceof HTMLElement && (
    control.hasAttribute("required") ||
    control.getAttribute("aria-required") === "true"
  );
  if (controlRequired) {
    return true;
  }

  if (!(container instanceof HTMLElement)) {
    return false;
  }

  const className = container.className || "";
  if (/required|is-required|ivu-form-item-required/.test(className)) {
    return true;
  }

  const text = normalizeWhitespace(container.textContent || "");
  return text.includes("*");
}

function isElementVisible(element) {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  if (element.hidden) {
    return false;
  }

  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
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
