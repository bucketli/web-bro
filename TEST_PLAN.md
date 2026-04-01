# CC 自动化测试用例规划

> 基于 clouddm-web 路由和功能分析，整理所有需要覆盖的测试用例。
> 状态说明：✅ 已实现 | 🔲 待实现 | ⏭️ 暂不实现（复杂/低优先级）

---

## 一、数据源管理（/ccdatasource）

### 1.1 页面基础检查

| 状态 | 用例 ID | 用例名称 | 说明 |
|------|---------|---------|------|
| ✅ | `datasource-list-check` | 数据源列表页面检查 | 导航到 `/#/ccdatasource` 后无报错，列表正常渲染 |
| 🔲 | `datasource-list-search` | 数据源列表搜索 | 输入关键词点击查询，结果列表无报错 |
| 🔲 | `datasource-add-page-check` | 新增数据源页面检查 | 点击「新增数据源」，表单页面正常渲染无报错 |

### 1.2 添加数据源 — 自建（SELF_MAINTENANCE）

> 每种数据库类型共享相同步骤结构，配置由 `cc-automation.config.json` 驱动。

| 状态 | 用例 ID | 用例名称 | 依赖 |
|------|---------|---------|------|
| ✅ | `datasource-add-mysql` | 添加自建 MySQL 数据源 | — |
| ✅ | `datasource-add-postgresql` | 添加自建 PostgreSQL 数据源 | — |
| 🔲 | `datasource-add-oracle` | 添加自建 Oracle 数据源 | — |
| 🔲 | `datasource-add-sqlserver` | 添加自建 SQL Server 数据源 | — |
| 🔲 | `datasource-add-mongodb` | 添加自建 MongoDB 数据源 | — |
| 🔲 | `datasource-add-kafka` | 添加自建 Kafka 数据源 | — |
| 🔲 | `datasource-add-redis` | 添加自建 Redis 数据源 | — |
| 🔲 | `datasource-add-clickhouse` | 添加自建 ClickHouse 数据源 | — |
| 🔲 | `datasource-add-elasticsearch` | 添加自建 ElasticSearch 数据源 | — |
| 🔲 | `datasource-add-tidb` | 添加自建 TiDB 数据源 | — |

### 1.3 添加数据源 — 阿里云（ALIBABA_CLOUD_HOSTED）

| 状态 | 用例 ID | 用例名称 | 说明 |
|------|---------|---------|------|
| ✅ | `datasource-add-aliyun-mysql` | 添加阿里云 MySQL 数据源 | 部署类型选「阿里云」，手动填写模式 |
| 🔲 | `datasource-add-aliyun-postgresql` | 添加阿里云 PostgreSQL 数据源 | 同上 |
| 🔲 | `datasource-add-aliyun-rocketmq` | 添加阿里云 RocketMQ 数据源 | 同上 |

### 1.4 添加数据源 — 其他云厂商

| 状态 | 用例 ID | 用例名称 | 说明 |
|------|---------|---------|------|
| 🔲 | `datasource-add-aws-mysql` | 添加 AWS MySQL 数据源 | 部署类型选「亚马逊AWS」 |
| 🔲 | `datasource-add-aws-postgresql` | 添加 AWS PostgreSQL 数据源 | — |
| 🔲 | `datasource-add-azure-sqlserver` | 添加 Azure SQL Server 数据源 | 部署类型选「微软Azure」 |
| 🔲 | `datasource-add-google-mysql` | 添加 Google Cloud MySQL 数据源 | 部署类型选「Google Cloud」 |

### 1.5 数据源操作

| 状态 | 用例 ID | 用例名称 | 说明 | 依赖 |
|------|---------|---------|------|------|
| ✅ | `mysql-connection-check` | 测试 MySQL 连接 | 弹窗点击「测试连接」，无错误信息 | `datasource-add-mysql` |
| ✅ | `postgresql-connection-check` | 测试 PostgreSQL 连接 | 同上 | `datasource-add-postgresql` |
| 🔲 | `datasource-params-check` | 数据源参数页面检查 | 进入 `/ccdatasource/params/:id/:instanceId` 无报错 | `datasource-add-mysql` |
| ✅ | `datasource-delete-check` | 删除 MySQL 数据源 | 「更多→删除」确认弹窗，删除后无报错 | `mysql-connection-check` |
| ✅ | `datasource-delete-postgresql` | 删除 PostgreSQL 数据源 | 「更多→删除」确认弹窗，删除后无报错 | `postgresql-connection-check` |
| ✅ | `datasource-delete-aliyun-mysql` | 删除阿里云 MySQL 数据源 | 「更多→删除」确认弹窗，删除后无报错 | `datasource-add-aliyun-mysql` |

---

## 二、数据同步任务（/data/job）

### 2.1 任务列表

| 状态 | 用例 ID | 用例名称 | 说明 |
|------|---------|---------|------|
| ✅ | `job-list-page-check` | 任务列表页面检查 | 刷新页面后无报错 |
| ✅ | `task-list-search-check` | 任务列表查询 | 点击「查询」按钮后无报错 |
| 🔲 | `job-list-filter-check` | 任务列表筛选 | 切换状态筛选条件，列表刷新无报错 |

### 2.2 任务详情

| 状态 | 用例 ID | 用例名称 | 说明 | 依赖 |
|------|---------|---------|------|------|
| ✅ | `job-detail-check` | 任务详情页面检查 | 点击任务列表第一条进入详情，页面无报错 | `job-list-page-check` |
| 🔲 | `job-detail-exception-log` | 查看异常日志 | 在任务详情「功能列表」点击「查看异常日志」，弹窗正常打开 | `job-detail-check` |
| 🔲 | `job-detail-view-metadata` | 查看任务元数据 | 「功能列表」点击「查看任务元数据」，页面跳转无报错 | `job-detail-check` |
| 🔲 | `job-detail-restart-history` | 查看重启历史 | 「功能列表」点击「重启历史记录」，弹窗正常打开 | `job-detail-check` |
| 🔲 | `job-detail-params-edit` | 任务参数编辑页面检查 | 「功能列表」点击「修改任务参数」，参数页面正常渲染无报错 | `job-detail-check` |
| 🔲 | `job-detail-alert-config` | 任务告警配置检查 | 「功能列表」点击「修改告警」，告警配置弹窗正常打开 | `job-detail-check` |
| 🔲 | `job-detail-monitor-graph` | 任务监控图表检查 | 进入任务详情对应的监控图表页面无报错 | `job-detail-check` |
| ✅ | `job-create-mysql-mysql` | 创建 MySQL→MySQL 同步任务 | 完整走完创建任务 5 个步骤，弹窗显示「创建成功」，任务进入初始化状态 | — |
| ⏭️ | `job-start-stop` | 启动/停止任务 | 会影响任务运行状态，需要测试环境隔离，暂不实现 | — |
| ⏭️ | `job-edit` | 编辑数据任务 | 多步骤复杂流程（3步），暂不实现 | — |

### 2.3 任务组管理

| 状态 | 用例 ID | 用例名称 | 说明 |
|------|---------|---------|------|
| ✅ | `job-group-list-check` | 任务组列表页面检查 | 导航到 `/#/data/job/group` 后无报错 |
| 🔲 | `job-group-create` | 创建任务组 | 点击「新建任务组」，填写名称和类型并保存，验证创建成功 |
| 🔲 | `job-group-detail-check` | 任务组详情页面检查 | 点击任务组进入详情页无报错 |
| 🔲 | `job-group-delete` | 删除任务组 | 删除刚创建的任务组，确认后无报错 | `job-group-create` |

### 2.4 任务模板与元数据

| 状态 | 用例 ID | 用例名称 | 说明 |
|------|---------|---------|------|
| 🔲 | `job-template-list-check` | 任务模板列表检查 | 导航到 `/#/data/job/template` 后无报错 |
| 🔲 | `meta-center-check` | 元数据中心页面检查 | 导航到 `/#/data/job/meta/center` 后无报错 |

---

## 三、集群与机器管理（/ccsystem/resource）

### 3.1 集群管理

| 状态 | 用例 ID | 用例名称 | 说明 |
|------|---------|---------|------|
| ✅ | `cluster-list-check` | 集群列表页面检查 | 导航到 `/#/ccsystem/resource` 后无报错 |
| ✅ | `cluster-create` | 创建集群 | 点击「新增集群」，填写集群描述并保存，验证创建成功 |
| ✅ | `cluster-detail-check` | 集群详情（机器列表）页面检查 | 点击集群进入机器列表页，页面无报错 |
| ✅ | `cluster-delete` | 删除集群 | 找到测试集群行点击删除，确认后无报错 | `cluster-create` |

### 3.2 机器管理

| 状态 | 用例 ID | 用例名称 | 说明 | 依赖 |
|------|---------|---------|------|------|
| ✅ | `worker-add` | 添加机器 | 在集群详情页点击「新增机器」，执行机器创建动作并无报错 | `cluster-detail-check` |
| ✅ | `worker-monitor-check` | 机器监控页面检查 | 点击机器的「监控」，监控图表页面无报错 | `worker-add` |
| ✅ | `worker-delete` | 删除机器 | 删除刚添加的机器，确认后无报错 | `worker-add` |

---

## 四、监控（/monitor）

| 状态 | 用例 ID | 用例名称 | 说明 |
|------|---------|---------|------|
| ✅ | `monitor-console-list-check` | 控制台节点列表检查 | 导航到 `/#/monitor/consolelist` 后无报错 |
| ✅ | `monitor-exception-check` | 异常日志页面检查 | 导航到 `/#/monitor/exception` 后无报错 |
| ✅ | `monitor-job-dashboard-check` | 任务监控看板检查 | 导航到 `/#/monitor/job/dashboard` 后无报错 |
| 🔲 | `monitor-console-graph-check` | 控制台资源监控图表检查 | 导航到 `/#/monitor/console/graph` 后无报错 |
| 🔲 | `monitor-worker-graph-check` | Worker 资源监控图表检查 | 导航到 `/#/monitor/worker/graph` 后无报错 |

---

## 五、告警（/alarm、/ccsystem/alert）

| 状态 | 用例 ID | 用例名称 | 说明 |
|------|---------|---------|------|
| ✅ | `alarm-log-check` | 告警事件日志页面检查 | 导航到 `/#/alarm/log` 后无报错 |
| 🔲 | `alert-setting-check` | 告警配置页面检查 | 导航到 `/#/ccsystem/alert/setting` 后无报错 |

---

## 六、系统管理（/ccsystem）

| 状态 | 用例 ID | 用例名称 | 说明 |
|------|---------|---------|------|
| ✅ | `fsm-list-check` | 状态机列表页面检查 | 导航到 `/#/ccsystem/fsm` 后无报错 |
| ✅ | `async-task-list-check` | 异步任务列表页面检查 | 导航到 `/#/ccsystem/state/task` 后无报错 |
| ✅ | `operation-log-check` | 操作日志页面检查 | 导航到 `/#/ccsystem/operationLog` 后无报错 |
| 🔲 | `st-token-setting-check` | ST Token 配置页面检查 | 导航到 `/#/ccsystem/stTokenSetting` 后无报错 |
| 🔲 | `fsm-detail-check` | 状态机详情页面检查 | 点击状态机列表第一条，进入详情页无报错 |

---

## 七、用户与权限（/system、/userCenter）

| 状态 | 用例 ID | 用例名称 | 说明 |
|------|---------|---------|------|
| 🔲 | `user-center-check` | 用户中心页面检查 | 导航到 `/#/userCenter` 后无报错 |
| 🔲 | `role-list-check` | 角色管理页面检查 | 导航到 `/#/system/role` 后无报错 |
| 🔲 | `sub-account-list-check` | 子账号列表页面检查 | 导航到 `/#/system/sub_account` 后无报错 |
| 🔲 | `preference-check` | 偏好设置页面检查 | 导航到 `/#/system/preference` 后无报错 |

---

## 汇总

| | 数量 |
|-|------|
| **已实现** ✅ | 28 |
| **待实现** 🔲 | 32 |
| **暂不实现** ⏭️ | 2 |
| **合计** | 62 |

---

## 优先级建议

**P0 — 核心流程，优先实现**

- `datasource-list-check` — 数据源列表基础页面
- `datasource-add-postgresql` — 第二种常用数据库类型
- `datasource-add-aliyun-mysql` — 云厂商场景代表
- `postgresql-connection-check` — 连接测试完整性
- `job-detail-check` — 最常用的详情页
- `cluster-create` / `cluster-delete` — 集群增删闭环
- `monitor-job-dashboard-check` — 监控核心页面

**P1 — 重要功能，次优先**

- `job-detail-exception-log` / `job-detail-view-metadata` / `job-detail-restart-history` — 任务详情操作覆盖
- `job-detail-params-edit` — 参数编辑页面检查
- `job-group-create` / `job-group-delete` — 任务组增删闭环
- `alert-setting-check` — 告警配置
- `datasource-add-oracle` / `datasource-add-sqlserver` — 常用 DB 类型

**P2 — 次要功能，按需实现**

- 其他云厂商数据源（AWS、Azure、Google Cloud）
- Kafka / MongoDB / Redis / ClickHouse 等数据源
- `monitor-console-graph-check` / `monitor-worker-graph-check` — 图表类页面
- `meta-center-check` / `job-template-list-check` — 使用频率较低
- 用户权限类页面（`user-center-check` 等）

---

## 待扩展 Step 类型

实现上述待实现用例时，可能需要扩展以下 Step 类型：

| Step 类型 | 用途 | 使用场景 |
|-----------|------|---------|
| `fill_select` | iView Select 下拉选择 | 集群部署类型、数据源云厂商选择 |
| `assert_table_has_row` | 断言表格中存在指定文本的行 | 验证创建成功后列表中出现新条目 |
| `click_table_row_link` | 点击表格行的链接跳转详情 | 进入任务详情、集群详情 |
| `click_function_menu_item` | 点击任务详情「功能列表」下拉菜单项 | 查看异常日志、修改参数等 |
| `assert_modal_contains` | 断言弹窗中包含指定文本 | 验证弹窗内容正确打开 |
| `assert_no_modal_errors` | 断言弹窗中无错误提示 | 通用弹窗操作后验证 |
| `assert_url_contains` | 断言当前 URL 包含指定字符串 | 验证页面跳转成功 |
| `fill_search_input` | 填写无 label 的搜索框 | 数据源列表搜索 |
