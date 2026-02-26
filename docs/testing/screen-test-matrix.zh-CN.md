# 画面测试矩阵（docs 测试页面）

## 目的 / 范围

本文档用于定义 `docs/test-pages/**` 的手工测试画面矩阵，重点是基于静态页面验证扩展行为。

## 测试环境

- 浏览器：Chrome（建议最新稳定版）
- 扩展：Ladybird 主线版本（仓库根目录构建）
- 测试前确认：
  - 能正常打开侧边栏
  - 当前页面域名在扩展权限范围内

## 画面矩阵总览

| 分组 | 页面路径 | 目的 | 覆盖功能 | 优先级 |
|---|---|---|---|---|
| Basic Playground | `docs/test-pages/basic/test-page.html` | 基础交互页 | elements, hidden, popup, input, navigate | P0 |
| Basic Playground | `docs/test-pages/basic/test-page2.html` | 跨页返回页 | navigation, site/page scope 行为 | P0 |
| Data Source Flow | `docs/test-pages/data-source/datasource-form-a.html` | 表单输入页 | text/email/date/number 输入、提交 | P0 |
| Data Source Flow | `docs/test-pages/data-source/datasource-form-b.html` | 结果页 | 结果校验、返回链接 | P0 |

## 详细覆盖点

### Basic Playground（`test-page.html`, `test-page2.html`）
- 创建/编辑 button/link/tooltip/area 元素
- 创建 hidden 规则并验证页面元素隐藏
- 执行简单流程（`click`, `input`, `popup`, `navigate`）
- 在两页之间跳转后观察保存元素的显示情况

### Data Source Flow（`datasource-form-a.html`, `datasource-form-b.html`）
- 使用流程填写多种字段类型（`text`, `email`, `date`, `number`）
- 提交表单并在 Screen B 验证结果展示
- 验证 Screen B 返回 Screen A 的导航
- 使用 CSV（`docs/assets/data/datasource-form-data.csv`）作为手工/参考数据样本

## 发布前最小冒烟集

1. 在 Basic 页面创建按钮并运行一个 popup flow
2. 在 Basic 页面创建 hidden 规则并验证生效
3. 完成 Data Source A -> B 表单提交流程
4. 在任意页面验证一个使用 Vault 的流程解锁/重试成功路径

## 已知缺口 / 后续测试页（P2）

当前 `docs` 测试页尚未覆盖：
- iframe / 多 frame 场景
- 高动态 DOM 压力页
- 严格 CSP 模拟页
- 复杂业务表单 mock 页（之前的 Kintai mock 已移除）

建议后续新增专用测试页补齐这些场景。
