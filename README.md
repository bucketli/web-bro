# Minimal Chrome Extension + Node.js Service

这是一个最小可运行示例，包含：

- `extension/`：Chrome Extension（Manifest V3）
- `server/`：本地 Node.js + Express 服务，支持 `mock`、`OpenAI`、`Qwen`

功能流程：

1. 在任意网页打开扩展 popup。
2. 先选择功能，例如“页面总结”或“淘宝导购”。
3. `popup.js` 发消息给 `background.js`。
4. `background.js` 通过 `chrome.tabs.sendMessage` 通知 `content.js` 采集页面信息。
5. `background.js` 将采集结果 POST 到 `http://127.0.0.1:8787/api/summarize-page`。
6. popup 展示返回的 3 句话总结和页面功能列表。

当前内置功能：

- `页面总结`：抓取当前网页并调用本地服务分析页面功能
- `淘宝导购`：输入商品名后，自动抓取淘宝搜索第 1 页商品，将价格、付款人数、店铺和链接发给后端，由 AI 选出更优商品并自动跳转详情页
- `羽雀文档优化`（developing）：输入优化目标，读取当前羽雀文档内容，交给后端 AI 优化，再自动回填编辑器并点击“更新”
- `CC自动化测试`：执行 CC 页面自动化用例（任务列表、添加 MySQL 数据源、测试 MySQL 链接）

## CC 自动化配置（MySQL）

`CC自动化测试` 中“添加 MySQL 数据源”步骤读取以下配置文件：

- [extension/cc-automation.config.json](/Users/johnli/tools/web-bro/extension/cc-automation.config.json)

示例：

```json
{
  "mysqlAdd": {
    "deployTypeLabel": "自建",
    "dbTypeLabel": "MySQL",
    "host": "127.0.0.1",
    "port": "3306",
    "account": "user",
    "password": "passwd",
    "description": "自动测试添加"
  }
}
```

字段说明：

- `deployTypeLabel`：部署类型单选文案（如 `自建`）
- `dbTypeLabel`：数据库类型单选文案（如 `MySQL`）
- `host`：网络地址（IP/域名）
- `port`：端口
- `account`：账号
- `password`：密码
- `description`：描述

使用方式：

1. 测试同学先编辑 `extension/cc-automation.config.json`
2. 重新加载扩展（`chrome://extensions/` 中点击刷新）
3. 在 popup 执行 `CC自动化测试`

## 目录结构

```text
web-bro/
├── .gitignore
├── extension/
│   ├── background.js
│   ├── content.js
│   ├── manifest.json
│   ├── popup.css
│   ├── popup.html
│   └── popup.js
├── server/
│   ├── config.example.json
│   ├── config.js
│   ├── config.json
│   └── index.js
│   └── llm.js
├── package.json
└── README.md
```

## 页面抓取字段

`content.js` 会采集：

- `title`
- `url`
- `metaDescription`
- `firstH1`
- `text`
- `htmlSnippet`
- `interactiveHtml`
- `capturedAt`

采集规则：

- 正文区域优先从 `main`、`article`、`[role="main"]` 中选择
- 如果都没有，则退回 `body`
- 优先提取链接、按钮、表单、导航等交互元素的 HTML，供模型识别页面功能
- `text`、`htmlSnippet` 与 `interactiveHtml` 都会做长度截断，避免请求体过大

## 本地服务接口

## 模型配置

后端读取 `server/config.json`。

默认提供 3 个 provider：

- `mock`：本地 mock，方便联调
- `openai`：调用 OpenAI 官方接口
- `qwen`：调用阿里云 DashScope 的 Qwen 兼容接口

首次可直接编辑 [server/config.json](/Users/johnli/tools/web-bro/server/config.json)：

```json
{
  "defaultProvider": "openai",
  "requestTimeoutMs": 90000,
  "maxInputChars": {
    "text": 400,
    "htmlSnippet": 600,
    "interactiveHtml": 2400,
    "metaDescription": 300,
    "firstH1": 120,
    "title": 120
  },
  "providers": {
    "mock": {
      "enabled": true
    },
    "openai": {
      "enabled": true,
      "baseUrl": "https://api.openai.com/v1",
      "apiKey": "YOUR_OPENAI_API_KEY",
      "model": "gpt-4.1-mini"
    },
    "qwen": {
      "enabled": false,
      "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
      "apiKey": "YOUR_QWEN_API_KEY",
      "model": "qwen3.5-plus"
    }
  }
}
```

切换 provider 的方式：

- 改 `defaultProvider`
- 或请求 `POST /api/summarize-page?provider=qwen`
- 或在请求体里带 `provider`

与稳定性相关的两个配置：

- `requestTimeoutMs`：模型请求超时，默认 90 秒
- `maxInputChars`：发送给模型的各字段最大长度，默认优先保留交互元素 HTML，避免网页过长导致响应很慢

## 本地服务接口

### `GET /health`

示例响应：

```json
{
  "ok": true,
  "service": "page-summarizer",
  "host": "127.0.0.1",
  "port": 8787,
  "configExists": true,
  "configPath": "/Users/johnli/tools/web-bro/server/config.json",
  "defaultProvider": "mock",
  "providers": {
    "mock": {
      "enabled": true,
      "hasApiKey": false,
      "model": ""
    },
    "openai": {
      "enabled": false,
      "hasApiKey": true,
      "model": "gpt-4.1-mini"
    },
    "qwen": {
      "enabled": false,
      "hasApiKey": true,
      "model": "qwen3.5-plus"
    }
  }
}
```

### `POST /api/summarize-page`

返回页面功能分析结果，默认至少包含 3 句总结：

```json
{
  "ok": true,
  "data": {
    "received": {
      "title": "示例页面标题",
      "url": "https://example.com"
    },
    "provider": "openai",
    "model": "gpt-4.1-mini",
    "summary": [
      "这是第1句总结",
      "这是第2句总结",
      "这是第3句总结"
    ],
    "functions": [
      {
        "name": "信息浏览",
        "detail": "页面面向用户提供主要内容浏览与阅读能力"
      },
      {
        "name": "功能入口识别",
        "detail": "页面存在若干导航或操作入口，可继续做交互分析"
      }
    ]
  }
}
```

后端给模型的主要任务是：

- 分析该网页面向用户提供哪些功能
- 重点依据按钮、链接、表单、导航等可触发元素判断页面能力
- 提炼 3 句中文总结
- 输出一组 `functions` 列表，描述页面能力

### `POST /api/taobao-guide`

扩展会把淘宝搜索结果中的商品列表发送到该接口，请求体示例：

```json
{
  "keyword": "机械键盘",
  "items": [
    {
      "page": 1,
      "title": "某商品标题",
      "priceText": "199.00",
      "priceValue": 199,
      "soldText": "500人付款",
      "soldCount": 500,
      "shop": "某店铺",
      "link": "https://item.taobao.com/..."
    }
  ]
}
```

接口返回：

- `summary`：3 句购买建议
- `functions`：AI 的比较维度说明
- `bestItem`：被选中的商品

默认策略优先考虑：

- 更高付款人数
- 更低价格

### `POST /api/optimize-yuque`

扩展会把当前羽雀文档的标题、正文和用户输入的优化目标发送到该接口，请求体示例：

```json
{
  "title": "Minimal Docker for CentOS",
  "url": "https://www.yuque.com/xxx/yyy/zzz",
  "goal": "改得更专业、更清晰，并补全步骤说明",
  "content": "文档正文..."
}
```

接口返回：

- `summary`：3 句优化总结
- `changes`：本次优化的关键改动
- `optimizedContent`：优化后的完整文档内容

扩展收到结果后会：

- 尝试切换到羽雀编辑模式
- 将优化后的内容写回编辑器
- 自动点击右上角“更新”按钮

## 启动本地服务

要求：

- Node.js 18+

安装依赖：

```bash
npm install
```

直接编辑 `server/config.json` 即可；`server/config.example.json` 只是参考模板。

把其中的 API Key 改成你自己的，并启用需要的 provider。

启动服务：

```bash
npm start
```

启动后监听：

```text
http://127.0.0.1:8787
```

可手动测试：

```bash
curl http://127.0.0.1:8787/health
```

使用 OpenAI 测试：

```bash
curl -X POST http://127.0.0.1:8787/api/summarize-page \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "title": "Example Domain",
    "url": "https://example.com",
    "text": "This domain is for use in illustrative examples in documents."
  }'
```

使用 Qwen 测试：

```bash
curl -X POST "http://127.0.0.1:8787/api/summarize-page?provider=qwen" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Example Domain",
    "url": "https://example.com",
    "text": "This domain is for use in illustrative examples in documents."
  }'
```

## 加载 Chrome 扩展

1. 打开 Chrome。
2. 进入 `chrome://extensions/`。
3. 打开右上角“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择本项目中的 `extension/` 目录。
6. 打开任意网页。
7. 点击扩展图标，确认服务状态为“服务正常”。
8. 点击“总结当前页面”，查看返回的 3 句话。

## 说明

- 没有使用 TypeScript
- 没有数据库
- 没有登录
- 没有云部署
- OpenAI 与 Qwen 采用兼容 `chat/completions` 的 HTTP 调用方式
- 适合作为后续接入真实网页分析、函数调用或本地 LLM 的基础骨架
