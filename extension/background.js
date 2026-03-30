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
const CC_TEST_CASES_FILE = "cc-test-cases.json";
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

  if (message.type === "RUN_CC_SINGLE_CASE") {
    startCcSingleCaseTask(message.caseId, message.siteUrl)
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

  // Verify the injected script is ready (retry up to 5 times with 200ms delay)
  for (let i = 0; i < 5; i++) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: "PING" });
      return;
    } catch (pingError) {
      if (i < 4) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
  }
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
  const taskId = `cc-test-${Date.now()}`;
  await setCcTaskState({
    id: taskId,
    status: "running",
    message: "正在加载测试用例...",
    siteUrl: siteUrl || "",
    startedAt: new Date().toISOString(),
    result: null,
    error: ""
  });

  const testCasesConfig = await loadCcTestCases();
  const cases = testCasesConfig && Array.isArray(testCasesConfig.cases)
    ? testCasesConfig.cases
    : [];

  if (!cases.length) {
    await setCcTaskState({
      id: taskId,
      status: "failed",
      message: "未找到测试用例，请检查 cc-test-cases.json",
      finishedAt: new Date().toISOString(),
      error: "未找到测试用例"
    });
    return { taskId, status: "failed" };
  }

  runTestSuiteWithCases(taskId, cases, siteOrigin).catch(async (error) => {
    await setCcTaskState({
      id: taskId,
      status: "failed",
      message: error.message || "CC 自动化测试执行失败",
      finishedAt: new Date().toISOString(),
      error: error.message || "CC 自动化测试执行失败"
    });
  });

  return { taskId, status: "running" };
}

async function startCcSingleCaseTask(caseId, siteUrl) {
  const testCasesConfig = await loadCcTestCases();
  const cases = testCasesConfig && Array.isArray(testCasesConfig.cases)
    ? testCasesConfig.cases
    : [];
  const caseConfig = cases.find((c) => c.id === caseId);

  if (!caseConfig) {
    throw new Error(`未找到用例：${caseId}`);
  }

  const siteOrigin = buildCcSiteOrigin(siteUrl);
  const taskId = `cc-test-${Date.now()}`;

  await setCcTaskState({
    id: taskId,
    status: "running",
    message: `正在执行：${caseConfig.name}...`,
    siteUrl: siteUrl || "",
    startedAt: new Date().toISOString(),
    result: null,
    error: "",
    runningCaseId: caseId
  });

  runTestSuiteWithCases(taskId, [caseConfig], siteOrigin).catch(async (error) => {
    await setCcTaskState({
      id: taskId,
      status: "failed",
      message: error.message || "用例执行失败",
      finishedAt: new Date().toISOString(),
      error: error.message || "用例执行失败"
    });
  });

  return { taskId, status: "running" };
}

async function runTestSuiteWithCases(taskId, casesToRun, siteOrigin) {
  const automationConfig = await loadCcAutomationConfig();
  const ac = automationConfig || {};
  const config = {
    mysqlAdd: { ...DEFAULT_MYSQL_ADD_CONFIG, ...(ac.mysqlAdd || {}) },
    postgresAdd: { ...(ac.postgresAdd || {}) },
    aliyunMysqlAdd: { ...(ac.aliyunMysqlAdd || {}) },
    clusterCreate: { ...(ac.clusterCreate || {}) },
    mysqlToMysqlJob: { ...(ac.mysqlToMysqlJob || {}) }
  };

  const sortedCases = topologicalSort(casesToRun);
  const savedContext = await getCcContextState();
  const context = savedContext ? { ...savedContext } : {};

  await setCcTaskState({ id: taskId, status: "running", message: "正在创建测试标签页..." });

  const workerTab = await chrome.tabs.create({ url: "about:blank", active: false });
  if (!workerTab || !workerTab.id) {
    throw new Error("创建测试标签页失败");
  }
  const workerTabId = workerTab.id;

  const caseResults = [];
  const failedCaseIds = new Set();

  try {
    await waitForTabComplete(workerTabId);

    for (const caseConfig of sortedCases) {
      if (caseConfig.disabled) {
        caseResults.push({
          id: caseConfig.id,
          name: caseConfig.name,
          passCriteria: caseConfig.passCriteria || "",
          status: "skipped",
          detail: "用例已禁用（disabled: true）"
        });
        continue;
      }

      const failedDeps = (caseConfig.dependsOn || []).filter((id) => failedCaseIds.has(id));
      if (failedDeps.length) {
        caseResults.push({
          id: caseConfig.id,
          name: caseConfig.name,
          passCriteria: caseConfig.passCriteria || "",
          status: "skipped",
          detail: `前置用例未通过：${failedDeps.join("、")}`
        });
        continue;
      }

      await setCcTaskState({
        id: taskId,
        status: "running",
        message: `正在执行：${caseConfig.name}...`,
        runningCaseId: caseConfig.id
      });

      console.log("[cc-automation] running case", { taskId, caseId: caseConfig.id });

      const caseResult = await runCaseSteps(
        caseConfig, workerTabId, context, config, siteOrigin
      );

      if (caseResult.contextUpdates) {
        Object.assign(context, caseResult.contextUpdates);
        await setCcContextState({ ...context, updatedAt: new Date().toISOString() });
      }

      if (!caseResult.passed) {
        failedCaseIds.add(caseConfig.id);
      }

      caseResults.push({
        id: caseConfig.id,
        name: caseConfig.name,
        passCriteria: caseConfig.passCriteria || "",
        status: caseResult.passed ? "passed" : "failed",
        detail: caseResult.reason || ""
      });
    }

    const passedCount = caseResults.filter((c) => c.status === "passed").length;
    const failedCount = caseResults.filter((c) => c.status === "failed").length;
    const skippedCount = caseResults.filter((c) => c.status === "skipped").length;

    const result = {
      cases: caseResults,
      summary: [
        `用例总数：${caseResults.length}`,
        `通过：${passedCount}　未通过：${failedCount}${skippedCount ? `　跳过：${skippedCount}` : ""}`,
        `mySqlDataSourceId_1：${context.mySqlDataSourceId_1 || "未识别"}`
      ],
      checkedAt: new Date().toISOString()
    };

    const failedList = caseResults.filter((c) => c.status === "failed");
    const completeMessage = failedList.length
      ? `执行完成（未通过：${failedList.map((c) => c.name).join("、")}）`
      : "执行完成，全部通过";

    await setCcTaskState({
      id: taskId,
      status: "completed",
      message: completeMessage,
      finishedAt: new Date().toISOString(),
      result,
      error: "",
      runningCaseId: ""
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

async function runCaseSteps(caseConfig, workerTabId, context, config, siteOrigin) {
  const steps = Array.isArray(caseConfig.steps) ? caseConfig.steps : [];
  const contextUpdates = {};

  for (let i = 0; i < steps.length; i++) {
    const step = resolveStepVars(steps[i], context, config);
    console.log("[cc-automation] step", { caseId: caseConfig.id, index: i, type: step.type });

    try {
      let result;

      if (step.type === "navigate") {
        const url = buildCcPageUrl(siteOrigin, step.path);
        await updateTabAndWait(workerTabId, url);
        await ensureContentScript(workerTabId);
        result = { ok: true };
      } else if (step.type === "reload") {
        await reloadTabAndWait(workerTabId);
        await ensureContentScript(workerTabId);
        result = { ok: true };
      } else if (step.type === "inject_page_hook") {
        await ensureCcPageHook(workerTabId);
        result = { ok: true };
      } else {
        try {
          result = await chrome.tabs.sendMessage(workerTabId, {
            type: "EXECUTE_STEP",
            step,
            context: { ...context, ...contextUpdates }
          });
        } catch (msgError) {
          if (msgError && msgError.message && msgError.message.includes("Receiving end does not exist")) {
            // Content script lost (page may have redirected after navigate). Re-inject and retry.
            await ensureContentScript(workerTabId);
            result = await chrome.tabs.sendMessage(workerTabId, {
              type: "EXECUTE_STEP",
              step,
              context: { ...context, ...contextUpdates }
            });
          } else {
            throw msgError;
          }
        }
      }

      if (!result || result.ok === false) {
        const reason = (result && result.error) || `步骤失败：${step.type}`;
        return { passed: false, reason, contextUpdates };
      }

      if (result.contextUpdates) {
        Object.assign(contextUpdates, result.contextUpdates);
        Object.assign(context, result.contextUpdates);
      }
    } catch (error) {
      return {
        passed: false,
        reason: `步骤异常（${step.type}）：${error && error.message ? error.message : String(error)}`,
        contextUpdates
      };
    }
  }

  return {
    passed: true,
    reason: `${steps.length} 个步骤全部完成`,
    contextUpdates
  };
}

function resolveStepVar(value, context, config) {
  if (typeof value !== "string") {
    return value;
  }
  return value.replace(/\$\{(config|context)\.([^}]+)\}/g, (match, scope, path) => {
    const obj = scope === "config" ? config : context;
    const parts = path.split(".");
    let cur = obj;
    for (const part of parts) {
      if (cur == null) {
        return match;
      }
      cur = cur[part];
    }
    return cur != null ? String(cur) : match;
  });
}

function resolveStepVars(step, context, config) {
  const resolved = {};
  for (const key of Object.keys(step)) {
    const value = step[key];
    resolved[key] = typeof value === "string"
      ? resolveStepVar(value, context, config)
      : value;
  }
  return resolved;
}

function topologicalSort(cases) {
  const map = new Map(cases.map((c) => [c.id, c]));
  const visited = new Set();
  const result = [];

  function visit(c) {
    if (visited.has(c.id)) {
      return;
    }
    visited.add(c.id);
    for (const depId of (c.dependsOn || [])) {
      const dep = map.get(depId);
      if (dep) {
        visit(dep);
      }
    }
    result.push(c);
  }

  cases.forEach((c) => visit(c));
  return result;
}

async function loadCcTestCases() {
  try {
    const response = await fetch(chrome.runtime.getURL(CC_TEST_CASES_FILE), {
      method: "GET",
      cache: "no-store"
    });
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data && typeof data === "object" ? data : null;
  } catch (error) {
    return null;
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
      reject(new Error("页面加载超时"));
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
      reject(new Error("页面加载超时"));
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
