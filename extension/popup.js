const statusEl = document.getElementById("service-status");
const featureSelectEl = document.getElementById("feature-select");
const featureDescriptionEl = document.getElementById("feature-description");
const featureInputSectionEl = document.getElementById("feature-input-section");
const featureInputEl = document.getElementById("feature-input");
const buttonEl = document.getElementById("action-button");
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
    id: "yuque-optimize",
    title: "羽雀文档优化",
    description: "按目标优化当前羽雀文档，并自动写回后发布",
    actionLabel: "执行羽雀文档优化",
    loadingLabel: "正在分析并优化羽雀文档...",
    successLabel: "羽雀文档已优化并触发更新",
    messageType: "OPTIMIZE_YUQUE_DOC",
    summaryTitle: "优化总结",
    functionsTitle: "优化动作",
    requiresBackend: true,
    requiresInput: true,
    inputLabel: "优化目标",
    inputPlaceholder: "例如：改得更专业、更清晰，并补全步骤说明",
    emptyInputMessage: "请输入优化目标",
    emptyFunctions: [
      {
        name: "读取文档内容",
        detail: "扩展会抓取当前羽雀页面中的标题和正文内容"
      },
      {
        name: "自动回填更新",
        detail: "优化结果会自动写回编辑器，并点击更新按钮发布"
      }
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

let selectedFeatureId = "cc-automation-test";
let taskPollTimer = null;
let ccTaskPollTimer = null;
const DEFAULT_CC_TEST_CASES = [
  {
    id: "job-list-page-check",
    name: "任务列表",
    passCriteria: "刷新 /#/data/job/list 页面后无报错",
    status: "not-started",
    detail: "目标页面：/#/data/job/list"
  },
  {
    id: "datasource-add-entry-check",
    name: "添加 MySQL 数据源",
    passCriteria: "进入 /#/ccdatasource/add 后完成“自建+MySQL+关键字段填写”，并触发“新增数据源”提交",
    status: "not-started",
    detail: "目标页面：/#/ccdatasource/add"
  },
  {
    id: "mysql-connection-check",
    name: "测试 MySQL 链接",
    passCriteria: "使用 mySqlDataSourceId_1 定位并执行测试连接，返回结果无错误信息",
    status: "not-started",
    detail: "目标页面：/#/ccdatasource（测试连接弹窗）"
  }
];
let ccTestCases = cloneDefaultCcCases();

document.addEventListener("DOMContentLoaded", () => {
  renderFeatureList();
  syncFeatureView();
  refreshHealth();
  refreshTaobaoTask();
  refreshCcAutomationTask();
  taskPollTimer = window.setInterval(refreshTaobaoTask, 1500);
  ccTaskPollTimer = window.setInterval(refreshCcAutomationTask, 1500);
});

window.addEventListener("beforeunload", () => {
  if (taskPollTimer) {
    window.clearInterval(taskPollTimer);
  }
  if (ccTaskPollTimer) {
    window.clearInterval(ccTaskPollTimer);
  }
});

ccClearButtonEl.addEventListener("click", async () => {
  try {
    ccClearButtonEl.disabled = true;
    await sendRuntimeMessage({ type: "CLEAR_CC_AUTOMATION_TASK" });
    ccTestCases = cloneDefaultCcCases();
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
    const message = {
      type: feature.messageType,
      keyword
    };
    if (feature.id === "cc-automation-test") {
      message.siteUrl = keyword;
    }

    const response = await sendRuntimeMessage(message);

    if (feature.id === "taobao-guide") {
      setMessage("淘宝导购任务已启动，可关闭 popup 后稍后再看结果");
      await refreshTaobaoTask();
      return;
    }

    if (feature.id === "cc-automation-test") {
      setMessage("CC 自动化测试任务已启动");
      await refreshCcAutomationTask();
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
  buttonEl.textContent = feature.actionLabel;
  summaryTitleEl.textContent = feature.summaryTitle;
  functionsTitleEl.textContent = feature.functionsTitle;
  featureInputSectionEl.classList.toggle("hidden", !feature.requiresInput);
  featureInputEl.placeholder = feature.inputPlaceholder || "";
  if (feature.requiresInput && feature.defaultInputValue && !featureInputEl.value.trim()) {
    featureInputEl.value = feature.defaultInputValue;
  }
  buttonEl.classList.remove("hidden");
  summarySectionEl.classList.toggle("hidden", false);
  functionsSectionEl.classList.toggle("hidden", isCcAutomation);
  ccCasesSectionEl.classList.toggle("hidden", !isCcAutomation);
  ccClearButtonEl.classList.toggle("hidden", !isCcAutomation);

  if (isCcAutomation) {
    renderBestItem(null);
    renderCcCases(ccTestCases);
    renderSummary(feature.emptySummary || []);
    buttonEl.disabled = false;
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

  ccCasesListEl.innerHTML = cases.map((item) => {
    const name = escapeHtml(item.name || item.title || "未命名用例");
    const passCriteria = escapeHtml(item.passCriteria || item.detail || "");
    const detail = escapeHtml(item.detail || "");
    const status = normalizeCcStatus(item.status);
    const statusText = getCcStatusText(status);
    return `
      <li class="cc-case-item">
        <div class="cc-case-main">
          <span class="cc-case-title">${name}</span>
          <span class="cc-case-criteria">通过标准：${passCriteria || "未设置"}</span>
          ${detail ? `<span class="cc-case-criteria">执行结果：${detail}</span>` : ""}
        </div>
        <span class="cc-case-status ${status}">${statusText}</span>
      </li>
    `;
  }).join("");
}

function normalizeCcStatus(status) {
  if (status === "passed") {
    return "passed";
  }
  if (status === "failed") {
    return "failed";
  }
  return "not-started";
}

function getCcStatusText(status) {
  if (status === "passed") {
    return "通过";
  }
  if (status === "failed") {
    return "未通过";
  }
  return "未开始";
}

function cloneDefaultCcCases() {
  return DEFAULT_CC_TEST_CASES.map((item) => ({ ...item }));
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
      buttonEl.disabled = true;
      setMessage(task.message || "CC 自动化测试执行中...");
      return;
    }

    buttonEl.disabled = false;

    if (task.status === "completed" && task.result) {
      const cases = Array.isArray(task.result.cases) ? task.result.cases : [];
      ccTestCases = cases;
      renderCcCases(ccTestCases);
      const summaryLines = Array.isArray(task.result.summary) && task.result.summary.length
        ? task.result.summary
        : [
        `用例总数：${ccTestCases.length}`,
        `通过数：${ccTestCases.filter((item) => item.status === "passed").length}`,
        `未通过数：${ccTestCases.filter((item) => item.status === "failed").length}`
      ];
      renderSummary(summaryLines);
      setMessage(task.message || "CC 自动化测试执行完成");
      return;
    }

    if (task.status === "failed") {
      setMessage(task.error || task.message || "CC 自动化测试执行失败");
    }
  } catch (error) {
    if (getSelectedFeature().id === "cc-automation-test") {
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
