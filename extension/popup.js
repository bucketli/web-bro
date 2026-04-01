const statusEl = document.getElementById("service-status");
document.getElementById("open-test-plan").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("test-plan-viewer.html") });
});
document.getElementById("open-test-cases").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("test-cases-viewer.html") });
});
const viewerLinksEl = document.querySelector(".viewer-links");
const featureSelectEl = document.getElementById("feature-select");
const featureDescriptionEl = document.getElementById("feature-description");
const featureInputSectionEl = document.getElementById("feature-input-section");
const featureInputEl = document.getElementById("feature-input");
const buttonEl = document.getElementById("action-button");
const runAllButtonEl = document.getElementById("run-all-button");
const bestItemSectionEl = document.getElementById("best-item-section");
const bestItemCardEl = document.getElementById("best-item-card");
const ccCasesSectionEl = document.getElementById("cc-cases-section");
const ccCasesListEl = document.getElementById("cc-cases-list");
const ccClearButtonEl = document.getElementById("cc-clear-button");
const summaryTitleEl = document.getElementById("summary-title");
const functionsTitleEl = document.getElementById("functions-title");
const summaryListEl = document.getElementById("summary-list");
const functionsListEl = document.getElementById("functions-list");
const messageEl = document.getElementById("message");
const yuqueCollectOptionsSectionEl = document.getElementById("yuque-collect-options-section");
const yuqueExportUsersEl = document.getElementById("yuque-export-users");
const summarySectionEl = summaryTitleEl.closest(".result-section");
const functionsSectionEl = functionsTitleEl.closest(".result-section");
const DEFAULT_CC_SITE_URL = "http://localhost:8080/";

const FEATURES = [
  {
    id: "page-summary",
    title: "页面总结",
    description: "分析当前网页提供的主要功能和结构",
    actionLabel: "执行页面总结",
    loadingLabel: "正在分析当前页面...",
    successLabel: "页面总结完成",
    messageType: "SUMMARIZE_CURRENT_TAB",
    summaryTitle: "三句总结",
    functionsTitle: "页面功能",
    requiresBackend: true
  },
  {
    id: "taobao-guide",
    title: "淘宝导购",
    description: "输入商品名后自动打开淘宝搜索并执行搜索",
    actionLabel: "执行淘宝导购",
    loadingLabel: "正在打开淘宝并搜索商品...",
    successLabel: "已在淘宝执行搜索",
    messageType: "RUN_TAOBAO_GUIDE",
    summaryTitle: "执行结果",
    functionsTitle: "操作说明",
    requiresInput: true,
    inputLabel: "商品名称",
    inputPlaceholder: "例如：机械键盘",
    emptyInputMessage: "请输入商品名称",
    emptySummary: ["已打开淘宝搜索页", "已填入商品关键词", "已触发搜索操作"],
    emptyFunctions: [
      {
        name: "自动填充关键词",
        detail: "扩展会将输入的商品名称写入淘宝搜索框"
      },
      {
        name: "自动执行搜索",
        detail: "扩展会自动点击搜索按钮或提交搜索表单"
      }
    ]
  },
  {
    id: "yuque-collect",
    title: "语雀需求汇总",
    description: "扫描「分支测试验证」目录，提取文件名匹配前缀的文件中的「需求」小节，并下载汇总文件",
    actionLabel: "开始汇总",
    loadingLabel: "正在扫描目录...",
    successLabel: "需求汇总完成",
    messageType: "RUN_YUQUE_COLLECT",
    summaryTitle: "汇总进度",
    functionsTitle: "操作说明",
    requiresInput: true,
    inputLabel: "文件名前缀",
    inputPlaceholder: "例如：[v5.5.0.0]",
    emptyInputMessage: "请输入文件名前缀",
    emptyFunctions: [
      { name: "扫描目录", detail: "遍历左侧「分支测试验证」目录，找出文件名以指定前缀开头的文件" },
      { name: "提取需求小节", detail: "逐一打开匹配文件，提取「需求」h2 标题下的全部内容" },
      { name: "下载汇总文件", detail: "将所有内容整合成 Markdown 文件自动下载" }
    ]
  },
  {
    id: "cc-automation-test",
    title: "CC自动化测试",
    description: "展示测试用例列表与执行状态（未开始、通过、未通过）",
    actionLabel: "执行测试用例",
    loadingLabel: "正在执行 CC 自动化测试...",
    successLabel: "CC 自动化测试执行完成",
    messageType: "RUN_CC_AUTOMATION_TEST",
    summaryTitle: "测试摘要",
    functionsTitle: "测试说明",
    requiresInput: true,
    inputLabel: "测试站点",
    inputPlaceholder: "例如：http://localhost:8080",
    defaultInputValue: DEFAULT_CC_SITE_URL,
    emptyInputMessage: "请输入测试站点地址",
    emptySummary: ["默认测试目标：localhost:8080", "测试页面：/#/data/job/list、/#/ccdatasource", "执行后将更新用例状态"]
  }
];

let selectedFeatureId = "yuque-collect";
let taskPollTimer = null;
let ccTaskPollTimer = null;
let yuqueCollectPollTimer = null;
// Loaded from cc-test-cases.json; each item: { id, name, passCriteria, status, detail }
let ccTestCases = [];

document.addEventListener("DOMContentLoaded", () => {
  renderFeatureList();
  syncFeatureView();
  refreshHealth();
  refreshTaobaoTask();
  loadTestCasesFromConfig().then((cases) => {
    ccTestCases = cases;
    renderCcCases(ccTestCases);
  });
  refreshCcAutomationTask();
  refreshYuqueCollectTask();
  taskPollTimer = window.setInterval(refreshTaobaoTask, 1500);
  ccTaskPollTimer = window.setInterval(refreshCcAutomationTask, 1500);
  yuqueCollectPollTimer = window.setInterval(refreshYuqueCollectTask, 1500);
});

window.addEventListener("beforeunload", () => {
  if (taskPollTimer) {
    window.clearInterval(taskPollTimer);
  }
  if (ccTaskPollTimer) {
    window.clearInterval(ccTaskPollTimer);
  }
  if (yuqueCollectPollTimer) {
    window.clearInterval(yuqueCollectPollTimer);
  }
});

ccClearButtonEl.addEventListener("click", async () => {
  try {
    ccClearButtonEl.disabled = true;
    await sendRuntimeMessage({ type: "CLEAR_CC_AUTOMATION_TASK" });
    const freshCases = await loadTestCasesFromConfig();
    ccTestCases = freshCases;
    renderCcCases(ccTestCases);
    renderSummary([
      `用例总数：${ccTestCases.length}`,
      "通过数：0",
      "未通过数：0"
    ]);
    setMessage("已重置测试状态");
  } catch (error) {
    setMessage(error.message || "清理测试状态失败");
  } finally {
    ccClearButtonEl.disabled = false;
  }
});

runAllButtonEl.addEventListener("click", async () => {
  const siteUrl = featureInputEl.value.trim() || DEFAULT_CC_SITE_URL;
  setMessage("CC 自动化测试任务已启动");
  runAllButtonEl.disabled = true;
  try {
    await sendRuntimeMessage({ type: "RUN_CC_AUTOMATION_TEST", siteUrl });
    await refreshCcAutomationTask();
  } catch (error) {
    setMessage(error.message || "启动失败");
    runAllButtonEl.disabled = false;
  }
});

ccCasesListEl.addEventListener("click", async (event) => {
  const btn = event.target.closest(".cc-case-run-btn");
  if (!btn || btn.disabled) {
    return;
  }
  const caseId = btn.dataset.caseId;
  if (!caseId) {
    return;
  }
  const siteUrl = featureInputEl.value.trim() || DEFAULT_CC_SITE_URL;
  btn.disabled = true;
  runAllButtonEl.disabled = true;
  ccTestCases = ccTestCases.map((c) =>
    c.id === caseId ? { ...c, status: "running" } : c
  );
  renderCcCases(ccTestCases);
  setMessage(`正在启动：${btn.dataset.caseName || caseId}`);
  try {
    await sendRuntimeMessage({ type: "RUN_CC_SINGLE_CASE", caseId, siteUrl });
    await refreshCcAutomationTask();
  } catch (error) {
    setMessage(error.message || "启动失败");
    ccTestCases = ccTestCases.map((c) =>
      c.id === caseId ? { ...c, status: "failed", detail: error.message || "启动失败" } : c
    );
    renderCcCases(ccTestCases);
    runAllButtonEl.disabled = false;
  }
});

buttonEl.addEventListener("click", async () => {
  const feature = getSelectedFeature();
  const keyword = feature.requiresInput ? featureInputEl.value.trim() : "";

  if (feature.requiresInput && !keyword) {
    setMessage(feature.emptyInputMessage || "请输入内容");
    featureInputEl.focus();
    return;
  }

  setMessage(feature.loadingLabel);
  buttonEl.disabled = true;

  try {
    const message = { type: feature.messageType, keyword };
    if (feature.id === "yuque-collect") {
      message.exportUserRequirements = yuqueExportUsersEl.checked;
    }
    const response = await sendRuntimeMessage(message);

    if (feature.id === "taobao-guide") {
      setMessage("淘宝导购任务已启动，可关闭 popup 后稍后再看结果");
      await refreshTaobaoTask();
      return;
    }

    if (feature.id === "yuque-collect") {
      setMessage("需求汇总任务已启动，请稍候...");
      await refreshYuqueCollectTask();
      return;
    }

    const payload = response.data && response.data.data ? response.data.data : {};
    const summary = payload.summary;
    const functions = payload.functions || payload.changes;
    renderBestItem(payload.bestItem || null);
    renderSummary(Array.isArray(summary) ? summary : feature.emptySummary || []);
    renderFunctions(Array.isArray(functions) ? functions : feature.emptyFunctions || []);
    setMessage(feature.successLabel);
  } catch (error) {
    renderBestItem(null);
    renderSummary([]);
    renderFunctions([]);
    setMessage(error.message || "执行失败");
  } finally {
    buttonEl.disabled = false;
  }
});

async function refreshHealth() {
  try {
    const response = await sendRuntimeMessage({ type: "CHECK_HEALTH" });
    if (response.ok) {
      setStatus("服务正常", "ok");
      return;
    }
    throw new Error(response.error || "服务不可用");
  } catch (error) {
    setStatus("未连接", "error");
    setMessage(error.message || "健康检查失败");
  }
}

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response) {
        reject(new Error("No response received"));
        return;
      }

      if (!response.ok) {
        reject(new Error(response.error || "Request failed"));
        return;
      }

      resolve(response);
    });
  });
}

function renderFeatureList() {
  featureSelectEl.innerHTML = FEATURES.map((feature) => {
    const selected = feature.id === selectedFeatureId ? ' selected="selected"' : "";
    return `<option value="${escapeHtml(feature.id)}"${selected}>${escapeHtml(feature.title)}</option>`;
  }).join("");

  featureSelectEl.addEventListener("change", () => {
    selectedFeatureId = featureSelectEl.value || FEATURES[0].id;
    syncFeatureView();
    clearResults();
  });
}

function renderSummary(lines) {
  if (!lines.length) {
    summaryListEl.innerHTML = "<li>暂无结果</li>";
    return;
  }

  summaryListEl.innerHTML = lines
    .slice(0, 3)
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join("");
}

function renderFunctions(items) {
  if (!items.length) {
    functionsListEl.innerHTML = '<li class="empty-item">暂无结果</li>';
    return;
  }

  functionsListEl.innerHTML = items
    .slice(0, 8)
    .map((item) => {
      const name = escapeHtml(item.name || "未命名功能");
      const detail = escapeHtml(item.detail || "");
      return `
        <li class="function-item">
          <div class="function-name">${name}</div>
          <div class="function-detail">${detail}</div>
        </li>
      `;
    })
    .join("");
}

function setStatus(text, type) {
  statusEl.textContent = text;
  statusEl.className = `status ${type}`;
}

function clearResults() {
  renderBestItem(null);
  renderSummary([]);
  renderFunctions([]);
  renderCcCases(ccTestCases);
  setMessage("");
  runAllButtonEl.disabled = false;
}

function setMessage(text) {
  messageEl.textContent = text || "";
}

function getSelectedFeature() {
  return FEATURES.find((feature) => feature.id === selectedFeatureId) || FEATURES[0];
}

function syncFeatureView() {
  const feature = getSelectedFeature();
  const isCcAutomation = feature.id === "cc-automation-test";
  featureSelectEl.value = feature.id;
  featureDescriptionEl.textContent = feature.description || "";
  summaryTitleEl.textContent = feature.summaryTitle;
  functionsTitleEl.textContent = feature.functionsTitle;
  featureInputSectionEl.classList.toggle("hidden", !feature.requiresInput);
  featureInputEl.placeholder = feature.inputPlaceholder || "";
  if (feature.requiresInput && feature.defaultInputValue && !featureInputEl.value.trim()) {
    featureInputEl.value = feature.defaultInputValue;
  }
  summarySectionEl.classList.toggle("hidden", false);
  functionsSectionEl.classList.toggle("hidden", isCcAutomation);
  ccCasesSectionEl.classList.toggle("hidden", !isCcAutomation);
  ccClearButtonEl.classList.toggle("hidden", !isCcAutomation);
  viewerLinksEl.classList.toggle("hidden", !isCcAutomation);
  yuqueCollectOptionsSectionEl.classList.toggle("hidden", feature.id !== "yuque-collect");

  // CC automation uses dedicated run-all button; other features use the action button
  buttonEl.classList.toggle("hidden", isCcAutomation);
  runAllButtonEl.classList.toggle("hidden", !isCcAutomation);

  if (isCcAutomation) {
    buttonEl.textContent = feature.actionLabel;
    renderBestItem(null);
    renderCcCases(ccTestCases);
    renderSummary(feature.emptySummary || []);
    runAllButtonEl.disabled = false;
  } else {
    buttonEl.textContent = feature.actionLabel;
    if (feature.id === "yuque-collect") {
      renderSummary(["请在语雀知识库页面触发", "确保左侧「分支测试验证」目录已展开", "输入文件名前缀后点击开始汇总"]);
      renderFunctions(feature.emptyFunctions || []);
    }
  }

  if (feature.id !== "taobao-guide") {
    buttonEl.disabled = false;
  }

  const label = featureInputSectionEl.querySelector(".input-label");
  if (label) {
    label.textContent = feature.inputLabel || "输入内容";
  }
}

function renderCcCases(cases) {
  if (!Array.isArray(cases) || !cases.length) {
    ccCasesListEl.innerHTML = '<li class="empty-item">暂无测试用例</li>';
    return;
  }

  const isSuiteRunning = runAllButtonEl.disabled;

  ccCasesListEl.innerHTML = cases.map((item) => {
    const name = escapeHtml(item.name || item.title || "未命名用例");
    const passCriteria = escapeHtml(item.passCriteria || "");
    const detail = escapeHtml(item.detail || "");
    const status = normalizeCcStatus(item.status);
    const statusText = getCcStatusText(status);
    const isRunning = status === "running";
    const runBtnDisabled = isSuiteRunning || isRunning ? " disabled" : "";
    return `
      <li class="cc-case-item">
        <div class="cc-case-main">
          <span class="cc-case-title">${name}</span>
          <span class="cc-case-criteria">通过标准：${passCriteria || "未设置"}</span>
          ${detail ? `<span class="cc-case-criteria">执行结果：${detail}</span>` : ""}
        </div>
        <div class="cc-case-actions">
          <button class="cc-case-run-btn" data-case-id="${escapeHtml(item.id || "")}" data-case-name="${name}"${runBtnDisabled}>▶</button>
          <span class="cc-case-status ${status}">${statusText}</span>
        </div>
      </li>
    `;
  }).join("");
}

function normalizeCcStatus(status) {
  if (status === "passed") { return "passed"; }
  if (status === "failed") { return "failed"; }
  if (status === "running") { return "running"; }
  if (status === "skipped") { return "skipped"; }
  return "not-started";
}

function getCcStatusText(status) {
  if (status === "passed") { return "通过"; }
  if (status === "failed") { return "未通过"; }
  if (status === "running") { return "执行中"; }
  if (status === "skipped") { return "已跳过"; }
  return "未开始";
}

async function loadTestCasesFromConfig() {
  try {
    const url = chrome.runtime.getURL("cc-test-cases.json");
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    const cases = data && Array.isArray(data.cases) ? data.cases : [];
    return cases.map((c) => ({
      id: c.id || "",
      name: c.name || "未命名用例",
      passCriteria: c.passCriteria || "",
      status: "not-started",
      detail: ""
    }));
  } catch (error) {
    return [];
  }
}

async function refreshTaobaoTask() {
  try {
    const response = await sendRuntimeMessage({ type: "GET_TAOBAO_GUIDE_TASK" });
    const task = response.data;
    if (!task || getSelectedFeature().id !== "taobao-guide") {
      return;
    }

    if (task.status === "running") {
      buttonEl.disabled = true;
      setMessage(task.message || "任务执行中...");
      if (typeof task.itemCount === "number" && task.itemCount > 0) {
        renderSummary([
          `当前关键词：${task.keyword || ""}`,
          `已抓取商品数：${task.itemCount}`,
          "正在等待后端分析结果"
        ]);
      }
      return;
    }

    buttonEl.disabled = false;

    if (task.status === "completed" && task.result) {
      renderBestItem(task.result.bestItem || null);
      renderSummary(Array.isArray(task.result.summary) ? task.result.summary : []);
      renderFunctions(Array.isArray(task.result.functions) ? task.result.functions : []);
      setMessage(task.message || "淘宝导购已完成");
      return;
    }

    if (task.status === "failed") {
      renderBestItem(null);
      setMessage(task.error || task.message || "淘宝导购执行失败");
    }
  } catch (error) {
    if (getSelectedFeature().id === "taobao-guide") {
      buttonEl.disabled = false;
    }
  }
}

async function refreshCcAutomationTask() {
  try {
    const response = await sendRuntimeMessage({ type: "GET_CC_AUTOMATION_TASK" });
    const task = response.data;
    if (!task || getSelectedFeature().id !== "cc-automation-test") {
      return;
    }

    if (task.status === "running") {
      runAllButtonEl.disabled = true;
      setMessage(task.message || "CC 自动化测试执行中...");
      // Mark the currently running case
      if (task.runningCaseId) {
        ccTestCases = ccTestCases.map((c) =>
          c.id === task.runningCaseId ? { ...c, status: "running" } : c
        );
      }
      renderCcCases(ccTestCases);
      return;
    }

    runAllButtonEl.disabled = false;

    if (task.status === "completed" && task.result) {
      const completedCases = Array.isArray(task.result.cases) ? task.result.cases : [];

      if (task.runningCaseId) {
        // Single-case run: merge result into existing list
        ccTestCases = ccTestCases.map((c) => {
          const updated = completedCases.find((r) => r.id === c.id);
          return updated ? { ...c, ...updated } : c;
        });
      } else {
        // Full suite: merge all results, preserving cases not in result
        ccTestCases = ccTestCases.map((c) => {
          const updated = completedCases.find((r) => r.id === c.id);
          return updated ? { ...c, ...updated } : c;
        });
      }

      renderCcCases(ccTestCases);
      const summaryLines = Array.isArray(task.result.summary) && task.result.summary.length
        ? task.result.summary
        : [
          `用例总数：${ccTestCases.length}`,
          `通过数：${ccTestCases.filter((item) => item.status === "passed").length}`,
          `未通过数：${ccTestCases.filter((item) => item.status === "failed").length}`
        ];
      renderSummary(summaryLines);
      setMessage(task.message || "执行完成");
      return;
    }

    if (task.status === "failed") {
      // Restore running case to failed if single-case run failed
      if (task.runningCaseId) {
        ccTestCases = ccTestCases.map((c) =>
          c.id === task.runningCaseId && c.status === "running"
            ? { ...c, status: "failed", detail: task.error || task.message || "执行失败" }
            : c
        );
        renderCcCases(ccTestCases);
      }
      setMessage(task.error || task.message || "执行失败");
    }
  } catch (error) {
    if (getSelectedFeature().id === "cc-automation-test") {
      runAllButtonEl.disabled = false;
    }
  }
}

async function refreshYuqueCollectTask() {
  try {
    const response = await sendRuntimeMessage({ type: "GET_YUQUE_COLLECT_TASK" });
    const task = response.data;
    if (!task || getSelectedFeature().id !== "yuque-collect") return;

    if (task.status === "running") {
      buttonEl.disabled = true;
      setMessage(task.message || "正在执行...");
      if (typeof task.total === "number" && task.total > 0) {
        renderSummary([
          `匹配文件：${task.total} 个`,
          `已处理：${task.processed || 0} / ${task.total}`,
          `已收集需求：${task.collected || 0} 个`
        ]);
      }
      return;
    }

    buttonEl.disabled = false;

    if (task.status === "completed" && task.result) {
      const skippedLine = task.result.skipped
        ? `未找到需求小节（${task.result.skipped}个）：${(task.result.skippedTitles || []).join("、")}`
        : "全部文件均含需求小节";
      renderSummary([
        `扫描文件：${task.result.total} 个`,
        `成功提取需求：${task.result.collected} 个`,
        skippedLine
      ]);
      renderFunctions(getSelectedFeature().emptyFunctions || []);
      setMessage(task.message || "汇总完成，文件已下载");
      return;
    }

    if (task.status === "failed") {
      setMessage(task.error || task.message || "汇总失败");
    }
  } catch (error) {
    if (getSelectedFeature().id === "yuque-collect") {
      buttonEl.disabled = false;
    }
  }
}

function renderBestItem(item) {
  if (!item || !item.title) {
    bestItemSectionEl.classList.add("hidden");
    bestItemCardEl.innerHTML = "";
    return;
  }

  bestItemSectionEl.classList.remove("hidden");
  bestItemCardEl.innerHTML = `
    <div class="best-item-title">${escapeHtml(item.title || "")}</div>
    <div class="best-item-meta">价格：${escapeHtml(item.priceText || "未知")}</div>
    <div class="best-item-meta">付款人数：${escapeHtml(String(item.soldCount || item.soldText || "未知"))}</div>
    <div class="best-item-meta">店铺：${escapeHtml(item.shop || "未知")}</div>
    <a class="best-item-link" href="${escapeHtml(item.link || "#")}" target="_blank">打开商品链接</a>
  `;
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
