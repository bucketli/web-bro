const API_URL = "http://127.0.0.1:8787/api/summarize-page";
const TAOBAO_API_URL = "http://127.0.0.1:8787/api/taobao-guide";
const HEALTH_URL = "http://127.0.0.1:8787/health";
const TAOBAO_SEARCH_URL = "https://s.taobao.com/search";
const TASK_STORAGE_KEY = "taobaoGuideTask";

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

  if (message.type === "GET_TAOBAO_GUIDE_TASK") {
    getTaskState()
      .then((data) => sendResponse({ ok: true, data }))
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
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (!tab || !tab.id) {
    throw new Error("Active tab not found");
  }

  if (!tab.url || !/^https?:/i.test(tab.url)) {
    throw new Error("This page does not support content capture");
  }

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

  try {
    for (let page = 1; page <= 3; page += 1) {
      await setTaskState({
        id: taskId,
        status: "running",
        keyword: normalizedKeyword,
        message: `正在抓取第 ${page} 页商品...`,
        itemCount: allItems.length,
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
        nodeCount: debug.nodeCount || 0
      });
      allItems.push(...items);
    }

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
      message: `已抓取 ${allItems.length} 个商品，正在分析...`,
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
