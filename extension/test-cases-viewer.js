const DATA = {"version":"1.0","cases":[{"id":"job-list-page-check","name":"任务列表页面检查","passCriteria":"刷新 /#/data/job/list 页面后无报错","steps":[{"type":"navigate","path":"/#/data/job/list"},{"type":"reload"},{"type":"assert_no_errors"}]},{"id":"job-group-list-check","name":"任务组列表页面检查","passCriteria":"导航到 /#/data/job/group 页面后无报错","steps":[{"type":"navigate","path":"/#/data/job/group"},{"type":"wait","ms":1000},{"type":"assert_no_errors"}]},{"id":"task-list-search-check","name":"任务列表查询检查","passCriteria":"在任务列表页点击查询后无报错","steps":[{"type":"navigate","path":"/#/data/job/list"},{"type":"click_button","text":"查询","timeout":5000},{"type":"wait","ms":500},{"type":"assert_no_errors"}]},{"id":"job-detail-check","name":"任务详情页面检查","passCriteria":"点击任务列表第一条记录进入详情页，页面无报错","steps":[{"type":"navigate","path":"/#/data/job/list"},{"type":"click_first_table_row_link","timeout":8000},{"type":"assert_url_contains","contains":"/data/job/","timeout":8000},{"type":"wait","ms":1000},{"type":"assert_no_errors"}]},{"id":"monitor-console-list-check","name":"监控控制台列表页面检查","passCriteria":"导航到 /#/monitor/consolelist 页面后无报错","steps":[{"type":"navigate","path":"/#/monitor/consolelist"},{"type":"wait","ms":1000},{"type":"assert_no_errors"}]},{"id":"monitor-exception-check","name":"监控异常页面检查","passCriteria":"导航到 /#/monitor/exception 页面后无报错","steps":[{"type":"navigate","path":"/#/monitor/exception"},{"type":"wait","ms":1000},{"type":"assert_no_errors"}]},{"id":"monitor-job-dashboard-check","name":"任务监控看板页面检查","passCriteria":"导航到 /#/monitor/job/dashboard 页面后无报错","steps":[{"type":"navigate","path":"/#/monitor/job/dashboard"},{"type":"wait","ms":1000},{"type":"assert_no_errors"}]},{"id":"alarm-log-check","name":"告警日志页面检查","passCriteria":"导航到 /#/alarm/log 页面后无报错","steps":[{"type":"navigate","path":"/#/alarm/log"},{"type":"wait","ms":1000},{"type":"assert_no_errors"}]},{"id":"operation-log-check","name":"操作日志页面检查","passCriteria":"导航到 /#/ccsystem/operationLog 页面后无报错","steps":[{"type":"navigate","path":"/#/ccsystem/operationLog"},{"type":"wait","ms":1000},{"type":"assert_no_errors"}]},{"id":"cluster-list-check","name":"集群列表页面检查","passCriteria":"导航到 /#/ccsystem/resource 页面后无报错","steps":[{"type":"navigate","path":"/#/ccsystem/resource"},{"type":"wait","ms":1000},{"type":"assert_no_errors"}]},{"id":"cluster-create","name":"创建集群","passCriteria":"点击新增集群，填写集群描述，保存后无报错","providesContext":["testClusterDesc"],"steps":[{"type":"navigate","path":"/#/ccsystem/resource"},{"type":"click_button","text":"新增集群","timeout":5000},{"type":"wait_for_modal","timeout":5000},{"type":"fill_input","label":"集群描述","value":"${config.clusterCreate.description}","timeout":3000},{"type":"click_button_in_modal","text":"保存"},{"type":"wait","ms":1500},{"type":"assert_no_errors"}]},{"id":"cluster-delete","name":"删除集群","passCriteria":"在集群列表找到测试集群，点击删除并确认，无报错","dependsOn":["cluster-create"],"steps":[{"type":"navigate","path":"/#/ccsystem/resource"},{"type":"wait","ms":500},{"type":"find_row_by_text_and_click","rowText":"${config.clusterCreate.description}","text":"删除","timeout":5000},{"type":"wait_for_modal","timeout":5000},{"type":"click_button_in_modal","text":"确认"},{"type":"wait","ms":1500},{"type":"assert_no_errors"}]},{"id":"fsm-list-check","name":"状态机列表页面检查","passCriteria":"导航到 /#/ccsystem/fsm 页面后无报错","steps":[{"type":"navigate","path":"/#/ccsystem/fsm"},{"type":"wait","ms":1000},{"type":"assert_no_errors"}]},{"id":"async-task-list-check","name":"异步任务列表页面检查","passCriteria":"导航到 /#/ccsystem/state/task 页面后无报错","steps":[{"type":"navigate","path":"/#/ccsystem/state/task"},{"type":"wait","ms":1000},{"type":"assert_no_errors"}]},{"id":"datasource-add-mysql","name":"添加自建 MySQL 数据源","passCriteria":"完成自建 MySQL 数据源填写并提交，捕获到 dataSourceId","providesContext":["mySqlDataSourceId_1"],"steps":[{"type":"navigate","path":"/#/ccdatasource"},{"type":"inject_page_hook"},{"type":"intercept_api","url":"/rdp/console/api/v1/datasource/add","saveAs":"addApiResp"},{"type":"click_button","text":"新增数据源","timeout":5000},{"type":"wait_for_url","path":"/#/ccdatasource/add","timeout":10000},{"type":"select_radio","label":"部署类型","option":"${config.mysqlAdd.deployTypeLabel}","timeout":5000},{"type":"select_radio","label":"数据库类型","option":"${config.mysqlAdd.dbTypeLabel}","timeout":3000},{"type":"fill_network_address","label":"网络地址","host":"${config.mysqlAdd.host}","port":"${config.mysqlAdd.port}","timeout":3000},{"type":"fill_input","label":"账号","value":"${config.mysqlAdd.account}","timeout":3000},{"type":"fill_input","label":"密码","value":"${config.mysqlAdd.password}","timeout":3000},{"type":"fill_input","label":"描述","value":"${config.mysqlAdd.description}","timeout":3000},{"type":"click_button","text":"新增数据源","container":".add-dataSource-tools","timeout":3000},{"type":"wait_for_api_response","from":"addApiResp","timeout":20000},{"type":"extract_datasource_id","from":"addApiResp","saveAs":"mySqlDataSourceId_1"},{"type":"assert_extracted","key":"mySqlDataSourceId_1"}]},{"id":"mysql-connection-check","name":"测试 MySQL 连接","passCriteria":"通过 mySqlDataSourceId_1 定位数据源，完成测试连接弹窗操作，无错误信息","dependsOn":["datasource-add-mysql"],"requiredContext":["mySqlDataSourceId_1"],"steps":[{"type":"navigate","path":"/#/ccdatasource"},{"type":"wait","ms":400},{"type":"find_and_click_in_row","id":"${context.mySqlDataSourceId_1}","text":"测试连接"},{"type":"wait_for_modal","timeout":10000},{"type":"select_first_option","label":"绑定集群","timeout":5000},{"type":"wait","ms":800},{"type":"click_button_in_modal","text":"测试连接"},{"type":"wait","ms":2500},{"type":"assert_no_connection_errors"},{"type":"close_modal"}]},{"id":"datasource-delete-check","name":"删除 MySQL 数据源","passCriteria":"通过 mySqlDataSourceId_1 定位数据源，点击更多→删除，确认弹窗后无报错","dependsOn":["mysql-connection-check"],"requiredContext":["mySqlDataSourceId_1"],"steps":[{"type":"navigate","path":"/#/ccdatasource"},{"type":"wait","ms":400},{"type":"find_and_click_in_row","id":"${context.mySqlDataSourceId_1}","text":"更多"},{"type":"wait","ms":600},{"type":"click_dropdown_item","text":"删除","timeout":3000},{"type":"wait_for_modal","timeout":5000},{"type":"fill_input_in_modal","value":"DELETE_DATASOURCE"},{"type":"click_button_in_modal","text":"确定"},{"type":"wait","ms":1500},{"type":"assert_no_errors"}]},{"id":"datasource-add-postgresql","name":"添加自建 PostgreSQL 数据源","passCriteria":"完成自建 PostgreSQL 数据源填写并提交，捕获到 dataSourceId","providesContext":["postgresDataSourceId_1"],"steps":[{"type":"navigate","path":"/#/ccdatasource"},{"type":"inject_page_hook"},{"type":"intercept_api","url":"/rdp/console/api/v1/datasource/add","saveAs":"pgAddApiResp"},{"type":"click_button","text":"新增数据源","timeout":5000},{"type":"wait_for_url","path":"/#/ccdatasource/add","timeout":10000},{"type":"select_radio","label":"部署类型","option":"${config.postgresAdd.deployTypeLabel}","timeout":5000},{"type":"select_radio","label":"数据库类型","option":"${config.postgresAdd.dbTypeLabel}","timeout":3000},{"type":"fill_network_address","label":"网络地址","host":"${config.postgresAdd.host}","port":"${config.postgresAdd.port}","timeout":3000},{"type":"fill_input","label":"账号","value":"${config.postgresAdd.account}","timeout":3000},{"type":"fill_input","label":"密码","value":"${config.postgresAdd.password}","timeout":3000},{"type":"fill_input","label":"描述","value":"${config.postgresAdd.description}","timeout":3000},{"type":"click_button","text":"新增数据源","container":".add-dataSource-tools","timeout":3000},{"type":"wait_for_api_response","from":"pgAddApiResp","timeout":20000},{"type":"extract_datasource_id","from":"pgAddApiResp","saveAs":"postgresDataSourceId_1"},{"type":"assert_extracted","key":"postgresDataSourceId_1"}]},{"id":"postgresql-connection-check","name":"测试 PostgreSQL 连接","passCriteria":"通过 postgresDataSourceId_1 定位数据源，完成测试连接弹窗操作，无错误信息","dependsOn":["datasource-add-postgresql"],"requiredContext":["postgresDataSourceId_1"],"steps":[{"type":"navigate","path":"/#/ccdatasource"},{"type":"wait","ms":400},{"type":"find_and_click_in_row","id":"${context.postgresDataSourceId_1}","text":"测试连接"},{"type":"wait_for_modal","timeout":10000},{"type":"select_first_option","label":"绑定集群","timeout":5000},{"type":"wait","ms":800},{"type":"click_button_in_modal","text":"测试连接"},{"type":"wait","ms":2500},{"type":"assert_no_connection_errors"},{"type":"close_modal"}]},{"id":"datasource-delete-postgresql","name":"删除 PostgreSQL 数据源","passCriteria":"通过 postgresDataSourceId_1 定位数据源，点击更多→删除，确认弹窗后无报错","dependsOn":["postgresql-connection-check"],"requiredContext":["postgresDataSourceId_1"],"steps":[{"type":"navigate","path":"/#/ccdatasource"},{"type":"wait","ms":400},{"type":"find_and_click_in_row","id":"${context.postgresDataSourceId_1}","text":"更多"},{"type":"wait","ms":600},{"type":"click_dropdown_item","text":"删除","timeout":3000},{"type":"wait_for_modal","timeout":5000},{"type":"fill_input_in_modal","value":"DELETE_DATASOURCE"},{"type":"click_button_in_modal","text":"确定"},{"type":"wait","ms":1500},{"type":"assert_no_errors"}]},{"id":"datasource-add-aliyun-mysql","name":"添加阿里云 MySQL 数据源","passCriteria":"完成阿里云 MySQL 数据源（手动填写）填写并提交，捕获到 dataSourceId","disabled":true,"providesContext":["aliyunMysqlDataSourceId_1"],"steps":[{"type":"navigate","path":"/#/ccdatasource"},{"type":"inject_page_hook"},{"type":"intercept_api","url":"/rdp/console/api/v1/datasource/add","saveAs":"aliyunAddApiResp"},{"type":"click_button","text":"新增数据源","timeout":5000},{"type":"wait_for_url","path":"/#/ccdatasource/add","timeout":10000},{"type":"select_radio","label":"部署类型","option":"${config.aliyunMysqlAdd.deployTypeLabel}","timeout":5000},{"type":"select_radio","label":"获取方式","option":"${config.aliyunMysqlAdd.discoveryTypeLabel}","timeout":3000},{"type":"select_radio","label":"数据库类型","option":"${config.aliyunMysqlAdd.dbTypeLabel}","timeout":3000},{"type":"fill_network_address","label":"网络地址","host":"${config.aliyunMysqlAdd.host}","port":"${config.aliyunMysqlAdd.port}","timeout":3000},{"type":"fill_input","label":"账号","value":"${config.aliyunMysqlAdd.account}","timeout":3000},{"type":"fill_input","label":"密码","value":"${config.aliyunMysqlAdd.password}","timeout":3000},{"type":"fill_input","label":"描述","value":"${config.aliyunMysqlAdd.description}","timeout":3000},{"type":"click_button","text":"新增数据源","container":".add-dataSource-tools","timeout":3000},{"type":"wait_for_api_response","from":"aliyunAddApiResp","timeout":20000},{"type":"extract_datasource_id","from":"aliyunAddApiResp","saveAs":"aliyunMysqlDataSourceId_1"},{"type":"assert_extracted","key":"aliyunMysqlDataSourceId_1"}]},{"id":"datasource-delete-aliyun-mysql","name":"删除阿里云 MySQL 数据源","passCriteria":"通过 aliyunMysqlDataSourceId_1 定位数据源，点击更多→删除，确认弹窗后无报错","disabled":true,"dependsOn":["datasource-add-aliyun-mysql"],"requiredContext":["aliyunMysqlDataSourceId_1"],"steps":[{"type":"navigate","path":"/#/ccdatasource"},{"type":"wait","ms":400},{"type":"find_and_click_in_row","id":"${context.aliyunMysqlDataSourceId_1}","text":"更多"},{"type":"wait","ms":600},{"type":"click_dropdown_item","text":"删除","timeout":3000},{"type":"wait_for_modal","timeout":5000},{"type":"fill_input_in_modal","value":"DELETE_DATASOURCE"},{"type":"click_button_in_modal","text":"确定"},{"type":"wait","ms":1500},{"type":"assert_no_errors"}]},{"id":"job-create-mysql-mysql","name":"创建 MySQL→MySQL 同步任务","passCriteria":"完整走完创建任务 5 个步骤，弹窗显示\"创建成功\"，任务进入初始化状态","providesContext":["mysqlToMysqlJobId"],"steps":[{"type":"navigate","path":"/#/data/job/create/process"},{"type":"wait","ms":1500},{"type":"comment","text":"=== Step 0：源目标配置 ==="},{"type":"select_first_option","label":"绑定集群","timeout":8000},{"type":"wait","ms":500},{"type":"select_job_datasource","side":"source","deployType":"${config.mysqlToMysqlJob.source.deployTypeLabel}","dbType":"${config.mysqlToMysqlJob.source.dbTypeLabel}","networkType":"${config.mysqlToMysqlJob.source.networkType}","timeout":8000},{"type":"select_first_instance","side":"source","timeout":8000},{"type":"wait","ms":500},{"type":"select_job_datasource","side":"target","deployType":"${config.mysqlToMysqlJob.sink.deployTypeLabel}","dbType":"${config.mysqlToMysqlJob.sink.dbTypeLabel}","networkType":"${config.mysqlToMysqlJob.sink.networkType}","timeout":8000},{"type":"select_first_instance","side":"target","timeout":8000},{"type":"wait","ms":500},{"type":"click_button","text":"下一步","container":".create-task-tools","timeout":5000},{"type":"comment","text":"=== Step 1：功能配置 ==="},{"type":"wait","ms":1500},{"type":"select_job_type","jobType":"${config.mysqlToMysqlJob.jobType}","timeout":5000},{"type":"wait","ms":500},{"type":"click_first_spec_row","timeout":5000},{"type":"fill_input","label":"任务描述","value":"${config.mysqlToMysqlJob.description}","timeout":3000},{"type":"click_button","text":"下一步","container":".create-task-tools","timeout":5000},{"type":"comment","text":"=== Step 2：表过滤（默认全选）==="},{"type":"wait","ms":3000},{"type":"click_button","text":"下一步","container":".create-task-tools","timeout":10000},{"type":"comment","text":"=== Step 3：数据处理（默认配置）==="},{"type":"wait","ms":1500},{"type":"click_button","text":"下一步","container":".create-task-tools","timeout":5000},{"type":"comment","text":"=== Step 4：创建确认 ==="},{"type":"wait","ms":1500},{"type":"click_button","text":"创建任务","container":".create-task-tools","timeout":5000},{"type":"wait_for_modal","timeout":10000},{"type":"click_button_in_modal","text":"确认"},{"type":"wait_for_job_created","timeout":120000}]}]};

let currentFilter = 'all';
let allExpanded = false;

function getStepTypeClass(type) {
  if (!type) return 'type-other';
  if (type === 'navigate') return 'type-navigate';
  if (type === 'reload') return 'type-reload';
  if (type === 'wait' && !type.includes('_for')) return 'type-wait';
  if (type.startsWith('click')) return 'type-click';
  if (type.startsWith('fill') || type.startsWith('select')) return 'type-fill';
  if (type.startsWith('assert')) return 'type-assert';
  if (type.startsWith('wait_for')) return 'type-wait_for';
  if (type.startsWith('intercept') || type.startsWith('extract') || type.startsWith('inject')) return 'type-intercept';
  if (type.startsWith('find')) return 'type-find';
  if (type === 'close_modal') return 'type-close';
  return 'type-other';
}

function renderParamValue(v) {
  if (typeof v !== 'string') return `<span class="step-param-val">${JSON.stringify(v)}</span>`;
  if (v.includes('${')) {
    return `<span class="step-param-var">${escHtml(v)}</span>`;
  }
  return `<span class="step-param-val">${escHtml(v)}</span>`;
}

function renderStepParams(step) {
  const skip = new Set(['type']);
  const parts = [];
  for (const [k, v] of Object.entries(step)) {
    if (skip.has(k)) continue;
    parts.push(`<span class="step-param-key">${escHtml(k)}:</span> ${renderParamValue(v)}`);
  }
  return parts.join('  ');
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderCase(c, idx) {
  const disabled = !!c.disabled;
  const steps = c.steps || [];
  const deps = c.dependsOn || [];
  const provides = c.providesContext || [];
  const requires = c.requiredContext || [];

  const stepsHtml = steps.map((s, i) => {
    const cls = getStepTypeClass(s.type);
    return `<div class="step-row">
      <span class="step-index">${i + 1}</span>
      <span class="step-type-badge ${cls}">${escHtml(s.type)}</span>
      <span class="step-params">${renderStepParams(s)}</span>
    </div>`;
  }).join('');

  const metaParts = [];
  if (c.passCriteria) {
    metaParts.push(`<div class="meta-item">
      <span class="meta-label">通过标准</span>
      <span class="meta-value">${escHtml(c.passCriteria)}</span>
    </div>`);
  }
  if (deps.length) {
    metaParts.push(`<div class="meta-item">
      <span class="meta-label">依赖</span>
      <div class="tags">${deps.map(d => `<span class="tag dep">${escHtml(d)}</span>`).join('')}</div>
    </div>`);
  }
  if (provides.length) {
    metaParts.push(`<div class="meta-item">
      <span class="meta-label">输出上下文</span>
      <div class="tags">${provides.map(p => `<span class="tag provides">${escHtml(p)}</span>`).join('')}</div>
    </div>`);
  }
  if (requires.length) {
    metaParts.push(`<div class="meta-item">
      <span class="meta-label">需要上下文</span>
      <div class="tags">${requires.map(r => `<span class="tag requires">${escHtml(r)}</span>`).join('')}</div>
    </div>`);
  }

  return `<div class="case-card${disabled ? ' disabled' : ''}" id="card-${escHtml(c.id)}">
    <div class="case-header" onclick="toggleCard('card-${escHtml(c.id)}')">
      <span class="case-status-dot ${disabled ? 'disabled' : 'active'}"></span>
      <span class="case-name">${escHtml(c.name)}</span>
      <span class="case-id">${escHtml(c.id)}</span>
      ${disabled ? '<span class="badge badge-disabled">禁用</span>' : ''}
      <span class="badge badge-steps">${steps.length} 步</span>
      ${deps.length ? `<span class="badge badge-dep">依赖 ${deps.length}</span>` : ''}
      <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
    </div>
    <div class="case-body">
      ${metaParts.length ? `<div class="meta-section">${metaParts.join('')}</div>` : ''}
      <div class="steps-section">
        <div class="steps-title">执行步骤（${steps.length}）</div>
        <div class="steps-list">${stepsHtml}</div>
      </div>
    </div>
  </div>`;
}

function toggleCard(id) {
  document.getElementById(id)?.classList.toggle('open');
}

function setFilter(f) {
  currentFilter = f;
  ['all','active','disabled'].forEach(k => {
    document.getElementById('filter-' + k)?.classList.toggle('active', k === f);
  });
  renderCases();
}

function toggleAll() {
  allExpanded = !allExpanded;
  document.querySelectorAll('.case-card').forEach(el => {
    el.classList.toggle('open', allExpanded);
  });
}

function matchesSearch(c, q) {
  if (!q) return true;
  const lower = q.toLowerCase();
  if (c.id.toLowerCase().includes(lower)) return true;
  if (c.name.toLowerCase().includes(lower)) return true;
  if (c.passCriteria && c.passCriteria.toLowerCase().includes(lower)) return true;
  if ((c.steps || []).some(s => s.type && s.type.toLowerCase().includes(lower))) return true;
  if ((c.dependsOn || []).some(d => d.toLowerCase().includes(lower))) return true;
  return false;
}

function renderCases() {
  const q = document.getElementById('search').value.trim();
  const cases = DATA.cases || [];

  const filtered = cases.filter(c => {
    if (currentFilter === 'active' && c.disabled) return false;
    if (currentFilter === 'disabled' && !c.disabled) return false;
    return matchesSearch(c, q);
  });

  const active = cases.filter(c => !c.disabled).length;
  const disabled = cases.filter(c => c.disabled).length;
  document.getElementById('stat-total').textContent = cases.length;
  document.getElementById('stat-active').textContent = active;
  document.getElementById('stat-disabled').textContent = disabled;

  const main = document.getElementById('main');
  if (!filtered.length) {
    main.innerHTML = '<div class="no-results">没有匹配的测试用例</div>';
    return;
  }
  main.innerHTML = filtered.map((c, i) => renderCase(c, i)).join('');
}

renderCases();
