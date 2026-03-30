// ── Test plan data ─────────────────────────────────────────────────────────────
const PLAN = {
  sections: [
    {
      title: "一、数据源管理（/ccdatasource）",
      subsections: [
        {
          title: "1.1 页面基础检查",
          cols: ["状态", "用例 ID", "用例名称", "说明"],
          rows: [
            ["done", "datasource-list-check", "数据源列表页面检查", "导航到 /#/ccdatasource 后无报错，列表正常渲染", null],
            ["todo", "datasource-list-search", "数据源列表搜索", "输入关键词点击查询，结果列表无报错", null],
            ["todo", "datasource-add-page-check", "新增数据源页面检查", "点击「新增数据源」，表单页面正常渲染无报错", null],
          ]
        },
        {
          title: "1.2 添加数据源 — 自建（SELF_MAINTENANCE）",
          note: "每种数据库类型共享相同步骤结构，配置由 cc-automation.config.json 驱动。",
          cols: ["状态", "用例 ID", "用例名称", "依赖"],
          rows: [
            ["done", "datasource-add-mysql", "添加自建 MySQL 数据源", null, null],
            ["done", "datasource-add-postgresql", "添加自建 PostgreSQL 数据源", null, null],
            ["todo", "datasource-add-oracle", "添加自建 Oracle 数据源", null, null],
            ["todo", "datasource-add-sqlserver", "添加自建 SQL Server 数据源", null, null],
            ["todo", "datasource-add-mongodb", "添加自建 MongoDB 数据源", null, null],
            ["todo", "datasource-add-kafka", "添加自建 Kafka 数据源", null, null],
            ["todo", "datasource-add-redis", "添加自建 Redis 数据源", null, null],
            ["todo", "datasource-add-clickhouse", "添加自建 ClickHouse 数据源", null, null],
            ["todo", "datasource-add-elasticsearch", "添加自建 ElasticSearch 数据源", null, null],
            ["todo", "datasource-add-tidb", "添加自建 TiDB 数据源", null, null],
          ]
        },
        {
          title: "1.3 添加数据源 — 阿里云（ALIBABA_CLOUD_HOSTED）",
          cols: ["状态", "用例 ID", "用例名称", "说明"],
          rows: [
            ["done", "datasource-add-aliyun-mysql", "添加阿里云 MySQL 数据源", "部署类型选「阿里云」，手动填写模式", null],
            ["todo", "datasource-add-aliyun-postgresql", "添加阿里云 PostgreSQL 数据源", "同上", null],
            ["todo", "datasource-add-aliyun-rocketmq", "添加阿里云 RocketMQ 数据源", "同上", null],
          ]
        },
        {
          title: "1.4 添加数据源 — 其他云厂商",
          cols: ["状态", "用例 ID", "用例名称", "说明"],
          rows: [
            ["todo", "datasource-add-aws-mysql", "添加 AWS MySQL 数据源", "部署类型选「亚马逊AWS」", null],
            ["todo", "datasource-add-aws-postgresql", "添加 AWS PostgreSQL 数据源", null, null],
            ["todo", "datasource-add-azure-sqlserver", "添加 Azure SQL Server 数据源", "部署类型选「微软Azure」", null],
            ["todo", "datasource-add-google-mysql", "添加 Google Cloud MySQL 数据源", "部署类型选「Google Cloud」", null],
          ]
        },
        {
          title: "1.5 数据源操作",
          cols: ["状态", "用例 ID", "用例名称", "说明", "依赖"],
          rows: [
            ["done", "mysql-connection-check", "测试 MySQL 连接", "弹窗点击「测试连接」，无错误信息", "datasource-add-mysql"],
            ["done", "postgresql-connection-check", "测试 PostgreSQL 连接", "同上", "datasource-add-postgresql"],
            ["todo", "datasource-params-check", "数据源参数页面检查", "进入 /ccdatasource/params/:id/:instanceId 无报错", "datasource-add-mysql"],
            ["done", "datasource-delete-check", "删除 MySQL 数据源", "「更多→删除」确认弹窗，删除后无报错", "mysql-connection-check"],
            ["done", "datasource-delete-postgresql", "删除 PostgreSQL 数据源", "「更多→删除」确认弹窗，删除后无报错", "postgresql-connection-check"],
            ["done", "datasource-delete-aliyun-mysql", "删除阿里云 MySQL 数据源", "「更多→删除」确认弹窗，删除后无报错", "datasource-add-aliyun-mysql"],
          ]
        },
      ]
    },
    {
      title: "二、数据同步任务（/data/job）",
      subsections: [
        {
          title: "2.1 任务列表",
          cols: ["状态", "用例 ID", "用例名称", "说明"],
          rows: [
            ["done", "job-list-page-check", "任务列表页面检查", "刷新页面后无报错", null],
            ["done", "task-list-search-check", "任务列表查询", "点击「查询」按钮后无报错", null],
            ["todo", "job-list-filter-check", "任务列表筛选", "切换状态筛选条件，列表刷新无报错", null],
          ]
        },
        {
          title: "2.2 任务详情",
          cols: ["状态", "用例 ID", "用例名称", "说明", "依赖"],
          rows: [
            ["done", "job-detail-check", "任务详情页面检查", "点击任务列表第一条进入详情，页面无报错", "job-list-page-check"],
            ["todo", "job-detail-exception-log", "查看异常日志", "在任务详情「功能列表」点击「查看异常日志」，弹窗正常打开", "job-detail-check"],
            ["todo", "job-detail-view-metadata", "查看任务元数据", "「功能列表」点击「查看任务元数据」，页面跳转无报错", "job-detail-check"],
            ["todo", "job-detail-restart-history", "查看重启历史", "「功能列表」点击「重启历史记录」，弹窗正常打开", "job-detail-check"],
            ["todo", "job-detail-params-edit", "任务参数编辑页面检查", "「功能列表」点击「修改任务参数」，参数页面正常渲染无报错", "job-detail-check"],
            ["todo", "job-detail-alert-config", "任务告警配置检查", "「功能列表」点击「修改告警」，告警配置弹窗正常打开", "job-detail-check"],
            ["todo", "job-detail-monitor-graph", "任务监控图表检查", "进入任务详情对应的监控图表页面无报错", "job-detail-check"],
            ["done", "job-create-mysql-mysql", "创建 MySQL→MySQL 同步任务", "完整走完创建任务 5 个步骤，弹窗显示「创建成功」，任务进入初始化状态", null],
            ["skip", "job-start-stop", "启动/停止任务", "会影响任务运行状态，需要测试环境隔离，暂不实现", null],
            ["skip", "job-edit", "编辑数据任务", "多步骤复杂流程（3步），暂不实现", null],
          ]
        },
        {
          title: "2.3 任务组管理",
          cols: ["状态", "用例 ID", "用例名称", "说明"],
          rows: [
            ["done", "job-group-list-check", "任务组列表页面检查", "导航到 /#/data/job/group 后无报错", null],
            ["todo", "job-group-create", "创建任务组", "点击「新建任务组」，填写名称和类型并保存，验证创建成功", null],
            ["todo", "job-group-detail-check", "任务组详情页面检查", "点击任务组进入详情页无报错", null],
            ["todo", "job-group-delete", "删除任务组", "删除刚创建的任务组，确认后无报错", null],
          ]
        },
        {
          title: "2.4 任务模板与元数据",
          cols: ["状态", "用例 ID", "用例名称", "说明"],
          rows: [
            ["todo", "job-template-list-check", "任务模板列表检查", "导航到 /#/data/job/template 后无报错", null],
            ["todo", "meta-center-check", "元数据中心页面检查", "导航到 /#/data/job/meta/center 后无报错", null],
          ]
        },
      ]
    },
    {
      title: "三、集群与机器管理（/ccsystem/resource）",
      subsections: [
        {
          title: "3.1 集群管理",
          cols: ["状态", "用例 ID", "用例名称", "说明"],
          rows: [
            ["done", "cluster-list-check", "集群列表页面检查", "导航到 /#/ccsystem/resource 后无报错", null],
            ["done", "cluster-create", "创建集群", "点击「新增集群」，填写集群描述并保存，验证创建成功", null],
            ["todo", "cluster-detail-check", "集群详情（机器列表）页面检查", "点击集群进入机器列表页，页面无报错", null],
            ["done", "cluster-delete", "删除集群", "找到测试集群行点击删除，确认后无报错", "cluster-create"],
          ]
        },
        {
          title: "3.2 机器管理",
          cols: ["状态", "用例 ID", "用例名称", "说明", "依赖"],
          rows: [
            ["todo", "worker-add", "添加机器", "在集群详情页点击「新增机器」，填写 IP 并保存", "cluster-create"],
            ["todo", "worker-monitor-check", "机器监控页面检查", "点击机器的「监控」，监控图表页面无报错", "cluster-detail-check"],
            ["todo", "worker-delete", "删除机器", "删除刚添加的机器，确认后无报错", "worker-add"],
          ]
        },
      ]
    },
    {
      title: "四、监控（/monitor）",
      subsections: [
        {
          title: "",
          cols: ["状态", "用例 ID", "用例名称", "说明"],
          rows: [
            ["done", "monitor-console-list-check", "控制台节点列表检查", "导航到 /#/monitor/consolelist 后无报错", null],
            ["done", "monitor-exception-check", "异常日志页面检查", "导航到 /#/monitor/exception 后无报错", null],
            ["done", "monitor-job-dashboard-check", "任务监控看板检查", "导航到 /#/monitor/job/dashboard 后无报错", null],
            ["todo", "monitor-console-graph-check", "控制台资源监控图表检查", "导航到 /#/monitor/console/graph 后无报错", null],
            ["todo", "monitor-worker-graph-check", "Worker 资源监控图表检查", "导航到 /#/monitor/worker/graph 后无报错", null],
          ]
        }
      ]
    },
    {
      title: "五、告警（/alarm、/ccsystem/alert）",
      subsections: [
        {
          title: "",
          cols: ["状态", "用例 ID", "用例名称", "说明"],
          rows: [
            ["done", "alarm-log-check", "告警事件日志页面检查", "导航到 /#/alarm/log 后无报错", null],
            ["todo", "alert-setting-check", "告警配置页面检查", "导航到 /#/ccsystem/alert/setting 后无报错", null],
          ]
        }
      ]
    },
    {
      title: "六、系统管理（/ccsystem）",
      subsections: [
        {
          title: "",
          cols: ["状态", "用例 ID", "用例名称", "说明"],
          rows: [
            ["done", "fsm-list-check", "状态机列表页面检查", "导航到 /#/ccsystem/fsm 后无报错", null],
            ["done", "async-task-list-check", "异步任务列表页面检查", "导航到 /#/ccsystem/state/task 后无报错", null],
            ["done", "operation-log-check", "操作日志页面检查", "导航到 /#/ccsystem/operationLog 后无报错", null],
            ["todo", "st-token-setting-check", "ST Token 配置页面检查", "导航到 /#/ccsystem/stTokenSetting 后无报错", null],
            ["todo", "fsm-detail-check", "状态机详情页面检查", "点击状态机列表第一条，进入详情页无报错", null],
          ]
        }
      ]
    },
    {
      title: "七、用户与权限（/system、/userCenter）",
      subsections: [
        {
          title: "",
          cols: ["状态", "用例 ID", "用例名称", "说明"],
          rows: [
            ["todo", "user-center-check", "用户中心页面检查", "导航到 /#/userCenter 后无报错", null],
            ["todo", "role-list-check", "角色管理页面检查", "导航到 /#/system/role 后无报错", null],
            ["todo", "sub-account-list-check", "子账号列表页面检查", "导航到 /#/system/sub_account 后无报错", null],
            ["todo", "preference-check", "偏好设置页面检查", "导航到 /#/system/preference 后无报错", null],
          ]
        }
      ]
    }
  ],
  priorities: [
    {
      level: "P0",
      label: "核心流程，优先实现",
      items: [
        { id: "datasource-list-check", note: "数据源列表基础页面" },
        { id: "datasource-add-postgresql", note: "第二种常用数据库类型" },
        { id: "datasource-add-aliyun-mysql", note: "云厂商场景代表" },
        { id: "postgresql-connection-check", note: "连接测试完整性" },
        { id: "job-detail-check", note: "最常用的详情页" },
        { id: "cluster-create", note: "集群增删闭环" },
        { id: "cluster-delete", note: "集群增删闭环" },
        { id: "monitor-job-dashboard-check", note: "监控核心页面" },
      ]
    },
    {
      level: "P1",
      label: "重要功能，次优先",
      items: [
        { id: "job-detail-exception-log", note: "" },
        { id: "job-detail-view-metadata", note: "" },
        { id: "job-detail-restart-history", note: "任务详情操作覆盖" },
        { id: "job-detail-params-edit", note: "参数编辑页面检查" },
        { id: "cluster-detail-check", note: "" },
        { id: "worker-add", note: "" },
        { id: "worker-delete", note: "机器管理闭环" },
        { id: "job-group-create", note: "" },
        { id: "job-group-delete", note: "任务组增删闭环" },
        { id: "alert-setting-check", note: "告警配置" },
        { id: "datasource-add-oracle", note: "" },
        { id: "datasource-add-sqlserver", note: "常用 DB 类型" },
      ]
    },
    {
      level: "P2",
      label: "次要功能，按需实现",
      items: [
        { id: "datasource-add-aws-mysql", note: "" },
        { id: "datasource-add-aws-postgresql", note: "" },
        { id: "datasource-add-azure-sqlserver", note: "其他云厂商数据源" },
        { id: "datasource-add-google-mysql", note: "" },
        { id: "datasource-add-kafka", note: "" },
        { id: "datasource-add-mongodb", note: "" },
        { id: "datasource-add-redis", note: "" },
        { id: "datasource-add-clickhouse", note: "" },
        { id: "monitor-console-graph-check", note: "" },
        { id: "monitor-worker-graph-check", note: "图表类页面" },
        { id: "meta-center-check", note: "" },
        { id: "job-template-list-check", note: "使用频率较低" },
        { id: "user-center-check", note: "" },
        { id: "role-list-check", note: "" },
        { id: "sub-account-list-check", note: "用户权限类页面" },
        { id: "preference-check", note: "" },
      ]
    }
  ]
};

// ── Render ─────────────────────────────────────────────────────────────────────
const STATUS_MAP = {
  done: { cls: "done", label: "✅ 已实现" },
  todo: { cls: "todo", label: "🔲 待实现" },
  skip: { cls: "skip", label: "⏭️ 暂不实现" },
};

let activeFilter = "all";
let searchText = "";

function countAll() {
  let done = 0, todo = 0, skip = 0;
  for (const sec of PLAN.sections) {
    for (const sub of sec.subsections) {
      for (const row of sub.rows) {
        if (row[0] === "done") done++;
        else if (row[0] === "todo") todo++;
        else if (row[0] === "skip") skip++;
      }
    }
  }
  return { done, todo, skip };
}

function renderSummary() {
  const { done, todo, skip } = countAll();
  document.getElementById("cnt-done").textContent = done;
  document.getElementById("cnt-todo").textContent = todo;
  document.getElementById("cnt-skip").textContent = skip;
  return { done, todo, skip, total: done + todo + skip };
}

function escHtml(s) {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderCell(val) {
  if (!val) return '<span style="color:#c0c4cc">—</span>';
  let html = escHtml(val).replace(/`([^`]+)`/g, "<code>$1</code>");
  return html;
}

function buildRows(rows) {
  const q = searchText.toLowerCase();
  let html = "";
  let visibleCount = 0;
  for (const row of rows) {
    const [status, id, name, ...rest] = row;
    const dep = rest[rest.length - 1];
    const desc = rest.slice(0, -1).join(" ");

    const matchFilter = activeFilter === "all" || status === activeFilter;
    const matchSearch = !q || id.toLowerCase().includes(q) || name.toLowerCase().includes(q) || (desc && desc.toLowerCase().includes(q));

    const hidden = !matchFilter || !matchSearch;
    if (!hidden) visibleCount++;

    const s = STATUS_MAP[status] || STATUS_MAP.todo;
    html += `<tr class="${hidden ? "hidden" : ""}" data-status="${status}" data-id="${escHtml(id)}">`;
    html += `<td><span class="status ${s.cls}">${s.label}</span></td>`;
    html += `<td><code>${escHtml(id)}</code></td>`;
    html += `<td>${escHtml(name)}</td>`;
    if (rest.length > 1) {
      html += `<td>${renderCell(desc || null)}</td>`;
    }
    if (dep) {
      html += `<td><code>${escHtml(dep)}</code></td>`;
    } else if (rest.length > 0) {
      html += `<td><span style="color:#c0c4cc">—</span></td>`;
    }
    html += `</tr>`;
  }
  return { html, visibleCount };
}

function renderContent() {
  const container = document.getElementById("content");
  const { done, todo, skip, total } = renderSummary();
  let html = "";

  html += `<div class="summary-grid">
    <div class="summary-item"><div class="summary-num total">${total}</div><div class="summary-label">合计</div></div>
    <div class="summary-item"><div class="summary-num done">${done}</div><div class="summary-label">✅ 已实现</div></div>
    <div class="summary-item"><div class="summary-num todo">${todo}</div><div class="summary-label">🔲 待实现</div></div>
    <div class="summary-item"><div class="summary-num skip">${skip}</div><div class="summary-label">⏭️ 暂不实现</div></div>
  </div>`;

  for (const sec of PLAN.sections) {
    let secHtml = `<div class="section-title">${escHtml(sec.title)}</div>`;
    let secVisible = 0;

    for (const sub of sec.subsections) {
      const { html: rowsHtml, visibleCount } = buildRows(sub.rows);
      secVisible += visibleCount;

      if (sub.title) {
        secHtml += `<div class="subsection-title">${escHtml(sub.title)}</div>`;
      }
      if (sub.note) {
        secHtml += `<div style="padding:8px 20px;font-size:12px;color:var(--muted);background:#fffef5;border-bottom:1px solid #f5f0d0;">${escHtml(sub.note)}</div>`;
      }
      secHtml += `<table><thead><tr>`;
      for (const col of sub.cols) {
        secHtml += `<th>${escHtml(col)}</th>`;
      }
      secHtml += `</tr></thead><tbody>${rowsHtml}</tbody></table>`;
    }

    html += `<div class="section-card" style="${secVisible === 0 ? "display:none" : ""}">${secHtml}</div>`;
  }

  html += `<div style="margin-top:8px;margin-bottom:8px;font-size:13px;font-weight:600;color:var(--muted);padding:0 4px;">优先级建议</div>`;
  for (const p of PLAN.priorities) {
    const colorMap = { P0: "#f56c6c", P1: "#e6a23c", P2: "#909399" };
    html += `<div class="priority-section">
      <div class="priority-title" style="color:${colorMap[p.level] || "#303133"}">
        ${escHtml(p.level)} — ${escHtml(p.label)}
      </div>
      <div class="priority-body"><ul>`;
    for (const item of p.items) {
      html += `<li><code>${escHtml(item.id)}</code>${item.note ? `<span class="priority-desc">${escHtml(item.note)}</span>` : ""}</li>`;
    }
    html += `</ul></div></div>`;
  }

  container.innerHTML = html;
}

// ── Filter & search ────────────────────────────────────────────────────────────
document.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeFilter = btn.dataset.filter;
    renderContent();
  });
});

document.querySelectorAll(".stat[data-filter]").forEach(stat => {
  stat.addEventListener("click", () => {
    const f = stat.dataset.filter;
    if (activeFilter === f) {
      activeFilter = "all";
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.toggle("active", b.dataset.filter === "all"));
    } else {
      activeFilter = f;
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.toggle("active", b.dataset.filter === f));
    }
    stat.classList.toggle("active-filter", activeFilter === f);
    renderContent();
  });
});

document.getElementById("search").addEventListener("input", e => {
  searchText = e.target.value.trim();
  renderContent();
});

renderContent();
