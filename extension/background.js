const API_URL = "http://127.0.0.1:8787/api/summarize-page";
const TAOBAO_API_URL = "http://127.0.0.1:8787/api/taobao-guide";
const YUQUE_API_URL = "http://127.0.0.1:8787/api/optimize-yuque";
const HEALTH_URL = "http://127.0.0.1:8787/health";
const TAOBAO_SEARCH_URL = "https://s.taobao.com/search";
const CC_JOB_LIST_PATH = "/#/data/job/list";
const CC_DATASOURCE_LIST_PATH = "/#/ccdatasource";
const CC_DATASOURCE_ADD_PATH = "/#/ccdatasource/add";
const DEFAULT_CC_SITE_URL = "http://localhost:8080/";
const TASK_STORAGE_KEY = "taobaoGuideTask";
const CC_TASK_STORAGE_KEY = "ccAutomationTask";
const CC_CONTEXT_STORAGE_KEY = "ccAutomationContext";
const CC_AUTOMATION_CONFIG_FILE = "cc-automation.config.json";
const DEFAULT_MYSQL_ADD_CONFIG = {
  deployTypeLabel: "自建",
  dbTypeLabel: "MySQL",
  host: "127.0.0.1",
  port: "3306",
  account: "origin",
  password: "123456",
  description: "自动测试添加"
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    return false;
  }

  if (message.type === "CHECK_HEALTH") {
    checkHealth()
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => {
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }

  if (message.type === "SUMMARIZE_CURRENT_TAB") {
    summarizeCurrentTab()
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => {
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }

  if (message.type === "RUN_TAOBAO_GUIDE") {
    startTaobaoGuideTask(message.keyword)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => {
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }

  if (message.type === "OPTIMIZE_YUQUE_DOC") {
    optimizeYuqueDoc(message.keyword)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => {
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }

  if (message.type === "GET_TAOBAO_GUIDE_TASK") {
    getTaskState()
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "RUN_CC_AUTOMATION_TEST") {
    startCcAutomationTestTask(message.siteUrl)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "GET_CC_AUTOMATION_TASK") {
    getCcTaskState()
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "GET_CC_AUTOMATION_CONTEXT") {
    getCcContextState()
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "CLEAR_CC_AUTOMATION_TASK") {
    clearCcTaskState()
      .then(() => sendResponse({ ok: true, data: { cleared: true } }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});

async function checkHealth() {
  const response = await fetch(HEALTH_URL);
  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }
  return response.json();
}

async function summarizeCurrentTab() {
  const tab = await getCurrentTab();

  validatePageTab(tab);

  await ensureContentScript(tab.id);

  const pageData = await chrome.tabs.sendMessage(tab.id, {
    type: "COLLECT_PAGE_DATA"
  });

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(pageData)
  });

  if (!response.ok) {
    throw await buildHttpError("Summarize request", response);
  }

  return response.json();
}

async function optimizeYuqueDoc(goal) {
  const normalizedGoal = String(goal || "").trim();
  if (!normalizedGoal) {
    throw new Error("请输入优化目标");
  }

  const tab = await getCurrentTab();
  validatePageTab(tab);
  await ensureContentScript(tab.id);

  const docData = await chrome.tabs.sendMessage(tab.id, {
    type: "COLLECT_YUQUE_DOC"
  });

  if (docData && docData.ok === false) {
    throw new Error(docData.error || "读取羽雀文档失败");
  }

  const response = await fetch(YUQUE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ...docData,
      goal: normalizedGoal
    })
  });

  if (!response.ok) {
    throw await buildHttpError("Yuque optimize request", response);
  }

  const result = await response.json();
  const optimizeResult = result && result.data ? result.data : null;
  const replacements = optimizeResult && Array.isArray(optimizeResult.replacements)
    ? optimizeResult.replacements
    : [];

  if (!replacements.length) {
    throw new Error("后端未返回可应用的文本替换结果");
  }

  const applyResult = await chrome.tabs.sendMessage(tab.id, {
    type: "APPLY_YUQUE_OPTIMIZED_CONTENT",
    optimizeResult
  });

  if (!applyResult || applyResult.ok === false) {
    throw new Error(
      applyResult && applyResult.error
        ? applyResult.error
        : "羽雀文档回填失败"
    );
  }

  return {
    ...result,
    data: {
      ...(optimizeResult || {}),
      applyResult: applyResult || null
    }
  };
}

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "PING"
    });
    return;
  } catch (error) {
    if (!String(error && error.message).includes("Receiving end does not exist")) {
      throw error;
    }
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"]
  });
}

async function ensureCcPageHook(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["page-hook.js"],
    world: "MAIN"
  });
}

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (!tab || !tab.id) {
    throw new Error("Active tab not found");
  }

  return tab;
}

function validatePageTab(tab) {
  if (!tab || !tab.url || !/^https?:/i.test(tab.url)) {
    throw new Error("This page does not support content capture");
  }
}

async function startTaobaoGuideTask(keyword) {
  const normalizedKeyword = String(keyword || "").trim();
  if (!normalizedKeyword) {
    throw new Error("请输入商品名称");
  }

  const taskId = `taobao-${Date.now()}`;
  await setTaskState({
    id: taskId,
    status: "running",
    keyword: normalizedKeyword,
    message: "正在抓取淘宝商品...",
    startedAt: new Date().toISOString(),
    itemCount: 0,
    result: null,
    error: ""
  });

  runTaobaoGuide(taskId, normalizedKeyword).catch(async (error) => {
    await setTaskState({
      id: taskId,
      status: "failed",
      keyword: normalizedKeyword,
      message: error.message || "淘宝导购执行失败",
      finishedAt: new Date().toISOString(),
      error: error.message || "淘宝导购执行失败"
    });
  });

  return {
    taskId,
    status: "running"
  };
}

async function startCcAutomationTestTask(siteUrl) {
  const siteOrigin = buildCcSiteOrigin(siteUrl);
  const jobListUrl = buildCcPageUrl(siteOrigin, CC_JOB_LIST_PATH);
  const dataSourceListUrl = buildCcPageUrl(siteOrigin, CC_DATASOURCE_LIST_PATH);
  const dataSourceAddUrl = buildCcPageUrl(siteOrigin, CC_DATASOURCE_ADD_PATH);
  const taskId = `cc-test-${Date.now()}`;
  await setCcTaskState({
    id: taskId,
    status: "running",
    message: "正在执行 CC 自动化测试...",
    siteUrl: siteUrl || "",
    targetUrl: jobListUrl,
    startedAt: new Date().toISOString(),
    result: null,
    error: ""
  });

  runCcAutomationTest(taskId, {
    jobListUrl,
    dataSourceListUrl,
    dataSourceAddUrl
  }).catch(async (error) => {
    await setCcTaskState({
      id: taskId,
      status: "failed",
      message: error.message || "CC 自动化测试执行失败",
      finishedAt: new Date().toISOString(),
      error: error.message || "CC 自动化测试执行失败"
    });
  });

  return {
    taskId,
    status: "running"
  };
}

async function runCcAutomationTest(taskId, targetUrl) {
  const automationConfig = await loadCcAutomationConfig();
  const mysqlAddConfig = {
    ...DEFAULT_MYSQL_ADD_CONFIG,
    ...(automationConfig && automationConfig.mysqlAdd ? automationConfig.mysqlAdd : {})
  };

  await setCcTaskState({
    id: taskId,
    status: "running",
    message: "正在创建测试标签页..."
  });

  const workerTab = await chrome.tabs.create({
    url: targetUrl.jobListUrl,
    active: false
  });

  if (!workerTab || !workerTab.id) {
    throw new Error("创建 CC 测试标签页失败");
  }

  const workerTabId = workerTab.id;

  try {
    await setCcTaskState({
      id: taskId,
      status: "running",
      message: "正在刷新测试页面..."
    });

    await waitForTabComplete(workerTabId);
    await ensureContentScript(workerTabId);
    await reloadTabAndWait(workerTabId);
    await ensureContentScript(workerTabId);

    await setCcTaskState({
      id: taskId,
      status: "running",
      message: "正在检测页面异常信号..."
    });

    const checkResult = await chrome.tabs.sendMessage(workerTabId, {
      type: "RUN_CC_AUTOMATION_CHECK",
      expectedUrl: targetUrl.jobListUrl
    });

    if (!checkResult || checkResult.ok === false) {
      throw new Error(
        checkResult && checkResult.error
          ? checkResult.error
          : "CC 自动化测试检查失败"
      );
    }

    const passed = Boolean(checkResult.data && checkResult.data.passed);
    const detail = checkResult.data && checkResult.data.reason
      ? checkResult.data.reason
      : (passed ? "页面刷新后未检测到明显异常" : "页面刷新后检测到异常信号");

    await setCcTaskState({
      id: taskId,
      status: "running",
      message: "正在验证“新增数据源”入口跳转..."
    });

    await updateTabAndWait(workerTabId, targetUrl.dataSourceListUrl);
    await ensureContentScript(workerTabId);
    await ensureCcPageHook(workerTabId);

    const addSourceResult = await chrome.tabs.sendMessage(workerTabId, {
      type: "RUN_CC_DATASOURCE_ADD_CHECK",
      expectedListUrl: targetUrl.dataSourceListUrl,
      expectedAddUrl: targetUrl.dataSourceAddUrl,
      mysqlAddConfig
    });

    if (!addSourceResult || addSourceResult.ok === false) {
      throw new Error(
        addSourceResult && addSourceResult.error
          ? addSourceResult.error
          : "新增数据源检查失败"
      );
    }

    const addCasePassed = Boolean(addSourceResult.data && addSourceResult.data.passed);
    const addCaseDetail = addSourceResult.data && addSourceResult.data.reason
      ? addSourceResult.data.reason
      : (addCasePassed ? "已跳转并识别到填充项" : "新增数据源入口检查未通过");
    const fillFields = addSourceResult.data && Array.isArray(addSourceResult.data.fillFields)
      ? addSourceResult.data.fillFields
      : [];
    const mysqlRequiredFields = addSourceResult.data && addSourceResult.data.mysqlRequiredFields
      ? addSourceResult.data.mysqlRequiredFields
      : { required: [], found: [], missing: [] };
    const submitTriggered = Boolean(addSourceResult.data && addSourceResult.data.submitTriggered);
    const mySqlDataSourceId_1 = addSourceResult.data && addSourceResult.data.mySqlDataSourceId_1
      ? String(addSourceResult.data.mySqlDataSourceId_1)
      : "";
    const context = await getCcContextState();
    const persistedMySqlDataSourceId_1 = context && context.mySqlDataSourceId_1
      ? String(context.mySqlDataSourceId_1)
      : "";
    const effectiveMySqlDataSourceId_1 = mySqlDataSourceId_1 || persistedMySqlDataSourceId_1;
    const fieldPreview = fillFields
      .slice(0, 3)
      .map((item) => item.label || item.placeholder || item.name || "未命名字段")
      .join("、");
    console.log("[cc-automation] mysql connection test id", {
      taskId,
      mySqlDataSourceId_1: effectiveMySqlDataSourceId_1 || ""
    });

    await setCcTaskState({
      id: taskId,
      status: "running",
      message: "正在执行“测试 MySQL 链接”..."
    });

    await updateTabAndWait(workerTabId, targetUrl.dataSourceListUrl);
    await ensureContentScript(workerTabId);

    const mysqlConnectionResult = await chrome.tabs.sendMessage(workerTabId, {
      type: "RUN_CC_MYSQL_CONNECTION_TEST",
      expectedListUrl: targetUrl.dataSourceListUrl,
      mySqlDataSourceId_1: effectiveMySqlDataSourceId_1
    });

    if (!mysqlConnectionResult || mysqlConnectionResult.ok === false) {
      throw new Error(
        mysqlConnectionResult && mysqlConnectionResult.error
          ? mysqlConnectionResult.error
          : "MySQL 连接测试检查失败"
      );
    }

    const mysqlConnectionPassed = Boolean(mysqlConnectionResult.data && mysqlConnectionResult.data.passed);
    const mysqlConnectionDetail = mysqlConnectionResult.data && mysqlConnectionResult.data.reason
      ? mysqlConnectionResult.data.reason
      : (mysqlConnectionPassed ? "测试连接通过" : "测试连接未通过");
    const connectionCaseDataSourceId = mysqlConnectionResult.data && mysqlConnectionResult.data.mySqlDataSourceId_1
      ? String(mysqlConnectionResult.data.mySqlDataSourceId_1)
      : effectiveMySqlDataSourceId_1;

    const cases = [
      {
        id: "job-list-page-check",
        name: "任务列表",
        passCriteria: "刷新 /#/data/job/list 页面后无报错",
        status: passed ? "passed" : "failed",
        detail
      },
      {
        id: "datasource-add-entry-check",
        name: "添加 MySQL 数据源",
        passCriteria: "进入 /#/ccdatasource/add 后完成“自建+MySQL+关键字段填写”，并触发“新增数据源”提交",
        status: addCasePassed ? "passed" : "failed",
        detail: addCaseDetail
      },
      {
        id: "mysql-connection-check",
        name: "测试 MySQL 链接",
        passCriteria: "使用 mySqlDataSourceId_1 定位数据源，触发两段“测试连接”（列表入口+弹窗按钮）且无错误信息",
        status: mysqlConnectionPassed ? "passed" : "failed",
        detail: mysqlConnectionDetail
      }
    ];

    const result = {
      cases,
      summary: [
        `用例总数：${cases.length}`,
        `通过数：${cases.filter((item) => item.status === "passed").length}`,
        `MySQL关键项：${Array.isArray(mysqlRequiredFields.found) ? mysqlRequiredFields.found.length : 0}/${Array.isArray(mysqlRequiredFields.required) ? mysqlRequiredFields.required.length : 0}`,
        `提交动作：${submitTriggered ? "已触发" : "未触发"}`,
        `mySqlDataSourceId_1：${connectionCaseDataSourceId || "未识别"}`,
        addCasePassed
          ? `填充项数量：${fillFields.length}${fieldPreview ? `（示例：${fieldPreview}）` : ""}`
          : "填充项数量：0"
      ],
      dataSourceAdd: {
        fromUrl: addSourceResult.data && addSourceResult.data.fromUrl ? addSourceResult.data.fromUrl : targetUrl.dataSourceListUrl,
        toUrl: addSourceResult.data && addSourceResult.data.toUrl ? addSourceResult.data.toUrl : "",
        fillFields,
        mysqlRequiredFields,
        stepResults: addSourceResult.data && Array.isArray(addSourceResult.data.stepResults)
          ? addSourceResult.data.stepResults
          : [],
        submitTriggered,
        mySqlDataSourceId_1
      },
      mysqlConnection: {
        mySqlDataSourceId_1: connectionCaseDataSourceId,
        errors: mysqlConnectionResult.data && Array.isArray(mysqlConnectionResult.data.errors)
          ? mysqlConnectionResult.data.errors
          : []
      },
      checkedAt: new Date().toISOString(),
      pageUrl: checkResult.data && checkResult.data.url ? checkResult.data.url : targetUrl.jobListUrl
    };

    if (connectionCaseDataSourceId) {
      await setCcContextState({
        mySqlDataSourceId_1: connectionCaseDataSourceId,
        updatedAt: new Date().toISOString()
      });
    }
    const failedCases = cases.filter((item) => item.status !== "passed");
    const completeMessage = failedCases.length
      ? `CC 自动化测试执行完成（未通过：${failedCases.map((item) => `${item.name}-${item.detail || "无详情"}`).join("；")}）`
      : "CC 自动化测试执行完成";

    await setCcTaskState({
      id: taskId,
      status: "completed",
      message: completeMessage,
      finishedAt: new Date().toISOString(),
      result,
      error: ""
    });

    return result;
  } finally {
    try {
      await chrome.tabs.remove(workerTabId);
    } catch (error) {
      console.log("[cc-automation] worker tab cleanup skipped", {
        taskId,
        workerTabId,
        message: error && error.message ? error.message : String(error)
      });
    }
  }
}

function buildCcTestUrl(siteUrl) {
  const siteOrigin = buildCcSiteOrigin(siteUrl);
  return buildCcPageUrl(siteOrigin, CC_JOB_LIST_PATH);
}

function buildCcSiteOrigin(siteUrl) {
  const normalized = String(siteUrl || "").trim() || DEFAULT_CC_SITE_URL;

  let baseUrl;
  try {
    baseUrl = new URL(normalized);
  } catch (error) {
    throw new Error("测试站点地址格式不正确，请输入如 http://localhost:8080");
  }

  return baseUrl.origin;
}

function buildCcPageUrl(siteOrigin, path) {
  return `${siteOrigin}${path}`;
}

async function runTaobaoGuide(taskId, normalizedKeyword) {
  const currentTask = await getTaskState();
  if (!currentTask || currentTask.id !== taskId) {
    return;
  }

  const workerTab = await chrome.tabs.create({
    url: buildTaobaoSearchUrl(normalizedKeyword, 1),
    active: false
  });

  if (!workerTab || !workerTab.id) {
    throw new Error("Failed to create Taobao worker tab");
  }

  const workerTabId = workerTab.id;
  await setTaskState({
    id: taskId,
    status: "running",
    keyword: normalizedKeyword,
    message: "已创建淘宝后台标签页",
    workerTabId
  });

  const allItems = [];
  const page = 1;

  try {
    await setTaskState({
      id: taskId,
      status: "running",
      keyword: normalizedKeyword,
      message: "正在抓取第 1 页商品...",
      itemCount: 0,
      workerTabId
    });

    const pageUrl = buildTaobaoSearchUrl(normalizedKeyword, page);
    console.log("[taobao-guide] open search page", {
      taskId,
      page,
      pageUrl
    });
    await updateTabAndWait(workerTabId, pageUrl);
    const currentTab = await chrome.tabs.get(workerTabId);
    console.log("[taobao-guide] page loaded", {
      taskId,
      page,
      currentUrl: currentTab && currentTab.url ? currentTab.url : ""
    });
    await ensureContentScript(workerTabId);

    const pageResult = await chrome.tabs.sendMessage(workerTabId, {
      type: "COLLECT_TAOBAO_ITEMS",
      keyword: normalizedKeyword,
      page
    });

    const items = pageResult && Array.isArray(pageResult.items) ? pageResult.items : [];
    const debug = pageResult && pageResult.debug ? pageResult.debug : {};
      console.log("[taobao-guide] collected page items", {
        taskId,
        page,
        count: items.length,
        selector: debug.selector || "",
        nodeCount: debug.nodeCount || 0,
        sampleTitles: Array.isArray(debug.sampleTitles) ? debug.sampleTitles : []
      });
    allItems.push(...items);

    console.log("[taobao-guide] collected total items", {
      taskId,
      keyword: normalizedKeyword,
      count: allItems.length
    });

    if (!allItems.length) {
      throw new Error("未抓取到淘宝商品列表");
    }

    await setTaskState({
      id: taskId,
      status: "running",
      keyword: normalizedKeyword,
      message: `已抓取首页 ${allItems.length} 个商品，正在分析...`,
      itemCount: allItems.length,
      workerTabId
    });

    const response = await fetch(TAOBAO_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        keyword: normalizedKeyword,
        items: allItems
      })
    });

    if (!response.ok) {
      throw await buildHttpError("Taobao guide request", response);
    }

    const result = await response.json();
    const bestItem = result &&
      result.data &&
      result.data.bestItem;

    await setTaskState({
      id: taskId,
      status: "completed",
      keyword: normalizedKeyword,
      message: "已完成淘宝导购分析",
      finishedAt: new Date().toISOString(),
      itemCount: allItems.length,
      result: result.data || null,
      error: "",
      workerTabId
    });

    if (bestItem && bestItem.link) {
      await chrome.tabs.create({
        url: bestItem.link,
        active: true
      });
    }

    return result;
  } finally {
    try {
      await chrome.tabs.remove(workerTabId);
    } catch (error) {
      console.log("[taobao-guide] worker tab cleanup skipped", {
        taskId,
        workerTabId,
        message: error && error.message ? error.message : String(error)
      });
    }
  }
}

function waitForTabComplete(tabId) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(handleUpdated);
      reject(new Error("淘宝页面加载超时"));
    }, 20000);

    function handleUpdated(updatedTabId, changeInfo) {
      if (updatedTabId !== tabId) {
        return;
      }

      if (changeInfo.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(handleUpdated);
        resolve();
      }
    }

    chrome.tabs.get(tabId, (currentTab) => {
      if (chrome.runtime.lastError) {
        clearTimeout(timer);
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (currentTab && currentTab.status === "complete") {
        clearTimeout(timer);
        resolve();
        return;
      }

      chrome.tabs.onUpdated.addListener(handleUpdated);
    });
  });
}

function updateTabAndWait(tabId, url) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(handleUpdated);
      reject(new Error("淘宝页面加载超时"));
    }, 20000);

    function cleanup() {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(handleUpdated);
    }

    function handleUpdated(updatedTabId, changeInfo, updatedTab) {
      if (updatedTabId !== tabId) {
        return;
      }

      if (changeInfo.status === "complete" && updatedTab && updatedTab.url === url) {
        cleanup();
        resolve(updatedTab);
      }
    }

    chrome.tabs.onUpdated.addListener(handleUpdated);

    chrome.tabs.update(tabId, { url }, (updatedTab) => {
      if (chrome.runtime.lastError) {
        cleanup();
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (updatedTab && updatedTab.status === "complete" && updatedTab.url === url) {
        cleanup();
        resolve(updatedTab);
      }
    });
  });
}

function reloadTabAndWait(tabId) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(handleUpdated);
      reject(new Error("页面刷新超时"));
    }, 20000);

    function cleanup() {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(handleUpdated);
    }

    function handleUpdated(updatedTabId, changeInfo, updatedTab) {
      if (updatedTabId !== tabId) {
        return;
      }

      if (changeInfo.status === "complete") {
        cleanup();
        resolve(updatedTab);
      }
    }

    chrome.tabs.onUpdated.addListener(handleUpdated);

    chrome.tabs.reload(tabId, {}, () => {
      if (chrome.runtime.lastError) {
        cleanup();
        reject(new Error(chrome.runtime.lastError.message));
      }
    });
  });
}

function buildTaobaoSearchUrl(keyword, page) {
  const url = new URL(TAOBAO_SEARCH_URL);
  url.searchParams.set("page", String(page));
  url.searchParams.set("q", keyword);
  url.searchParams.set("tab", "all");
  return url.toString();
}

async function buildHttpError(prefix, response) {
  let detail = "";

  try {
    const data = await response.json();
    detail = data && data.error ? `: ${data.error}` : "";
  } catch (error) {
    detail = "";
  }

  return new Error(`${prefix} failed with status ${response.status}${detail}`);
}

async function getTaskState() {
  const data = await chrome.storage.local.get(TASK_STORAGE_KEY);
  return data[TASK_STORAGE_KEY] || null;
}

async function setTaskState(task) {
  const previous = await getTaskState();
  const nextTask = {
    ...(previous || {}),
    ...task
  };
  await chrome.storage.local.set({
    [TASK_STORAGE_KEY]: nextTask
  });
  return nextTask;
}

async function getCcTaskState() {
  const data = await chrome.storage.local.get(CC_TASK_STORAGE_KEY);
  return data[CC_TASK_STORAGE_KEY] || null;
}

async function setCcTaskState(task) {
  const previous = await getCcTaskState();
  const nextTask = {
    ...(previous || {}),
    ...task
  };
  await chrome.storage.local.set({
    [CC_TASK_STORAGE_KEY]: nextTask
  });
  return nextTask;
}

async function clearCcTaskState() {
  await chrome.storage.local.remove(CC_TASK_STORAGE_KEY);
}

async function loadCcAutomationConfig() {
  try {
    const response = await fetch(chrome.runtime.getURL(CC_AUTOMATION_CONFIG_FILE), {
      method: "GET",
      cache: "no-store"
    });
    if (!response.ok) {
      return {};
    }
    const data = await response.json();
    return data && typeof data === "object" ? data : {};
  } catch (error) {
    return {};
  }
}

async function getCcContextState() {
  const data = await chrome.storage.local.get(CC_CONTEXT_STORAGE_KEY);
  return data[CC_CONTEXT_STORAGE_KEY] || null;
}

async function setCcContextState(context) {
  const previous = await getCcContextState();
  const nextContext = {
    ...(previous || {}),
    ...context
  };
  await chrome.storage.local.set({
    [CC_CONTEXT_STORAGE_KEY]: nextContext
  });
  return nextContext;
}
