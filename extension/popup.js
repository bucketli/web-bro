const statusEl = document.getElementById("service-status");
const featureListEl = document.getElementById("feature-list");
const featureInputSectionEl = document.getElementById("feature-input-section");
const featureInputEl = document.getElementById("feature-input");
const buttonEl = document.getElementById("action-button");
const bestItemSectionEl = document.getElementById("best-item-section");
const bestItemCardEl = document.getElementById("best-item-card");
const summaryTitleEl = document.getElementById("summary-title");
const functionsTitleEl = document.getElementById("functions-title");
const summaryListEl = document.getElementById("summary-list");
const functionsListEl = document.getElementById("functions-list");
const messageEl = document.getElementById("message");

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
  }
];

let selectedFeatureId = FEATURES[0].id;
let taskPollTimer = null;

document.addEventListener("DOMContentLoaded", () => {
  renderFeatureList();
  syncFeatureView();
  refreshHealth();
  refreshTaobaoTask();
  taskPollTimer = window.setInterval(refreshTaobaoTask, 1500);
});

window.addEventListener("beforeunload", () => {
  if (taskPollTimer) {
    window.clearInterval(taskPollTimer);
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
    const response = await sendRuntimeMessage({
      type: feature.messageType,
      keyword
    });

    if (feature.id === "taobao-guide") {
      setMessage("淘宝导购任务已启动，可关闭 popup 后稍后再看结果");
      await refreshTaobaoTask();
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
  featureListEl.innerHTML = FEATURES.map((feature) => {
    const selectedClass = feature.id === selectedFeatureId ? "feature-card selected" : "feature-card";
    return `
      <button class="${selectedClass}" type="button" data-feature-id="${escapeHtml(feature.id)}">
        <span class="feature-card-title">${escapeHtml(feature.title)}</span>
        <span class="feature-card-desc">${escapeHtml(feature.description)}</span>
      </button>
    `;
  }).join("");

  featureListEl.querySelectorAll("[data-feature-id]").forEach((element) => {
    element.addEventListener("click", () => {
      selectedFeatureId = element.getAttribute("data-feature-id") || FEATURES[0].id;
      renderFeatureList();
      syncFeatureView();
      clearResults();
    });
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
  buttonEl.textContent = feature.actionLabel;
  summaryTitleEl.textContent = feature.summaryTitle;
  functionsTitleEl.textContent = feature.functionsTitle;
  featureInputSectionEl.classList.toggle("hidden", !feature.requiresInput);
  featureInputEl.placeholder = feature.inputPlaceholder || "";
  if (feature.id !== "taobao-guide") {
    buttonEl.disabled = false;
  }

  const label = featureInputSectionEl.querySelector(".input-label");
  if (label) {
    label.textContent = feature.inputLabel || "输入内容";
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
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
