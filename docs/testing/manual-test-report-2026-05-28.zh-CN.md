# Ladybird 手工测试记录（2026-05-28）

## 测试环境

- 项目目录：`/Users/wang/workspace/直播项目/web-assistant`
- 测试时间：2026-05-28 15:20-17:03（Asia/Tokyo）
- 浏览器：Google Chrome，普通用户配置 `bingqi`
- 扩展：本地开发版 Ladybird，先测开发窗口，后续普通 Chrome 加载 `.output/chrome-mv3`，侧边栏地址 `chrome-extension://cpoeecoemaobemghkkaaljkibgbljfhg/sidepanel.html`
- 测试页面：`https://bqweapons.github.io/web-assistant/test-pages/data-source/datasource-form-a.html`
- 本地开发服务：`npm run dev` 已启动，WXT dev server 在 `http://localhost:3000`
- 说明：测试工具当前稳定可控的是普通 Chrome 窗口，不是 WXT 自动打开的临时测试窗口。

## 测试数据基线

- 当前站点：`bqweapons.github.io`
- Elements：2 个，页面注入按钮 `按钮`、`试试`
- Flows：1 个，`Popup smoke test`，包含 1 个 popup 步骤，内容为 `Hello`
- Hidden：1 条，`隐藏规则`，选择器 `#reset-button`，测试结束时保持暂停
- Overview 统计：1 sites，Elements 2，Flows 1，Hidden 1，总计 4 项

## 结果概览

| 模块 | 结果 | 备注 |
|---|---|---|
| Elements | 通过，发现 1 个轻微问题 | 新增、筛选、定位、编辑、删除、取消删除均可用 |
| Flows | 通过 | 运行 popup、OK 继续、成功状态、复制日志均可用 |
| Hidden | 通过 | 单条规则启用/暂停、自动隐藏开关、删除取消均可用 |
| Overview | 通过 | 统计刷新、站点数据删除取消均可用 |
| Settings | 通过，部分外部动作未测 | 导出、导入取消、语言、Vault 查看、复制商店链接可用 |
| 主题切换 | 通过 | 深色/浅色模式可来回切换 |
| 测试页按钮 | 通过 | 注入按钮可点击；表单重置、提交跳转、返回可用 |

## Elements 详细记录

| 动作 | 预期 | 实际 | 结果 |
|---|---|---|---|
| 打开 Add element 菜单 | 显示 Area/Button/Link | 菜单正常显示 | 通过 |
| Button 选择器 Cancel | 退出选择模式 | 正常退出 | 通过 |
| 新建按钮 `测试临时按钮` | 页面出现新按钮，数量 +1 | Elements 从 2 变 3，页面出现按钮 | 通过 |
| 搜索 `临时` | 只显示匹配元素 | 只显示临时按钮 | 通过 |
| 清空搜索 | 恢复完整列表 | 恢复 3 个元素 | 通过 |
| 类型筛选 Button | 只显示按钮类元素 | 筛选生效 | 通过 |
| Locate | 滚动/定位到目标 | 页面目标被定位并高亮 | 通过 |
| 编辑后 Cancel | 不保存修改 | 列表数据回退，但页面注入按钮短时间保留未保存文案 | 轻微问题 |
| 编辑后 Save | 保存修改并刷新页面按钮 | 列表和页面均更新为保存后的名称 | 通过 |
| 删除确认 Cancel | 不删除 | 临时按钮仍存在 | 通过 |
| 删除确认 Delete | 删除元素 | Elements 回到 2，页面临时按钮消失 | 通过 |
| Link 添加 Cancel | 退出选择模式 | 正常退出 | 通过 |
| Area 绘制 Cancel | 退出绘制模式 | 正常退出 | 通过 |

## Flows 详细记录

| 动作 | 预期 | 实际 | 结果 |
|---|---|---|---|
| 进入 Flows | 显示已有 flow | 显示 `Popup smoke test` | 通过 |
| Run flow | 页面显示 popup，runner 进入 Running | 显示 `Ladybird / Hello / OK`，状态 Running 0/1 | 通过 |
| 点击 popup `OK` | flow 继续并成功 | 状态 Succeeded 1/1，日志记录 popup shown/run succeeded/finalize | 通过 |
| Copy logs | 复制日志并给反馈 | 显示 `Logs copied.` | 通过 |
| Create flow | 打开新建抽屉 | 抽屉正常打开 | 通过 |
| Add step | 显示步骤类型 | 显示 Click/Input/Set Variable/Popup/Loop/Data Source/If Else/Wait/Navigate/Assert | 通过 |
| 关闭新建抽屉 | 不产生临时 flow | 仍只有 1 个 flow | 通过 |
| 删除 flow Cancel | 不删除 | `Popup smoke test` 保留 | 通过 |

## Hidden 详细记录

| 动作 | 预期 | 实际 | 结果 |
|---|---|---|---|
| 进入 Hidden | 显示自动拦截和手动规则 | 自动拦截 Paused，手动规则 `#reset-button` Paused | 通过 |
| 启用手动规则 | Reset 按钮隐藏 | 页面 Reset 按钮消失，规则状态 Enabled | 通过 |
| 暂停手动规则 | Reset 按钮恢复 | 页面 Reset 按钮恢复，规则状态 Paused | 通过 |
| Hide page element Cancel | 退出选择模式 | 正常退出 | 通过 |
| 启用自动隐藏 | 自动拦截状态 Enabled | 状态和按钮文案更新 | 通过 |
| 暂停自动隐藏 | 自动拦截状态 Paused | 状态和按钮文案恢复 | 通过 |
| 删除规则 Cancel | 不删除 | 规则仍保留 | 通过 |

## Overview 详细记录

| 动作 | 预期 | 实际 | 结果 |
|---|---|---|---|
| 打开 Overview | 显示站点统计 | 1 sites，Elements 2，Flows 1，Hidden 1 | 通过 |
| Refresh | 重新计算并保持一致 | 统计保持一致 | 通过 |
| Delete site data Cancel | 不清空数据 | 数据保留 | 通过 |

## Settings 详细记录

| 动作 | 预期 | 实际 | 结果 |
|---|---|---|---|
| 打开/关闭 Settings | 设置面板正常显示/隐藏 | 正常 | 通过 |
| Export | 下载导出 JSON | 下载 `ladybrid-export-2026-05-28T15-57-36-094+09-00.json`，约 4.4 KB | 通过 |
| Import Cancel | 关闭系统文件选择器，不导入 | 正常取消 | 通过 |
| Password Vault Viewer | 打开 Vault 查看器 | 显示 Not configured、0 passwords，Create vault 禁用 | 通过 |
| 切换 Simplified Chinese | UI 切到中文 | 文案切换为中文，locale 显示 `zh-CN` | 通过 |
| 切回 English (US) | UI 切回英文 | 文案和 locale 恢复 `en-US` | 通过 |
| Copy store link | 复制商店链接 | 显示 `Store link copied.` | 通过 |
| 深色/浅色模式切换 | 样式和按钮文案更新 | Dark mode/Light mode 可来回切换 | 通过 |

## 测试页与注入结果

| 动作 | 预期 | 实际 | 结果 |
|---|---|---|---|
| 点击注入按钮 `按钮` | 可点击，不破坏页面 | 无报错、无异常导航 | 通过 |
| 点击注入按钮 `试试` | 可点击，不破坏页面 | 无报错、无异常导航 | 通过 |
| 修改 Customer ID 后 Reset | 表单重置 | 临时值被清掉，恢复默认/占位状态 | 通过 |
| 必填字段为空时 Submit | 浏览器原生校验阻止提交 | 显示 `请填写此字段。` | 通过 |
| 填写必填字段后 Submit | 跳转 Screen B | 成功跳转并显示 query values | 通过 |
| Back to Screen A | 返回表单页 | 成功返回，侧栏仍可用 | 通过 |

## 发现的问题

| 优先级 | 问题 | 复现步骤 | 影响 |
|---|---|---|---|
| 已修复 | 编辑元素后点击 Cancel，页面上已注入按钮的预览文案没有立即回退 | 打开 Elements，新建或编辑一个按钮，修改名称后点击 Cancel | 已在普通 Chrome 加载 `.output/chrome-mv3` 后复测：页面按钮立即从预览文案回退到已保存文案 |

## 修复后复测

| 动作 | 预期 | 实际 | 结果 |
|---|---|---|---|
| 普通 Chrome 加载 `.output/chrome-mv3` | side panel 可连接当前测试页 | 重新打开插件后连接正常，无 `content_script_not_available_refresh_required` | 通过 |
| Add Button | 页面新增按钮并进入编辑 | 页面出现 `按钮`，侧栏进入编辑面板 | 通过 |
| 保存按钮 | 持久化元素并显示列表 | 列表计数为 1，页面保留按钮 | 通过 |
| 编辑名称实时预览 | 页面按钮即时显示草稿文案 | 名称改为 `取消回滚测试` 后页面同步变化 | 通过 |
| 编辑后 Cancel | 页面回退到保存值 | 点击取消后页面按钮从 `取消回滚测试` 回到 `按钮` | 通过 |
| Locate | 高亮目标元素 | 页面上的 `按钮` 被定位并高亮 | 通过 |
| Delete | 删除保存记录和页面注入元素 | 列表计数回到 0，页面按钮消失 | 通过 |

## 环境备注

- `.output/chrome-mv3-dev` 是 WXT 开发模式产物，依赖 `ws://localhost:3000/` dev server；本机当时 `localhost:3000` 被 OrbStack 占用，导致 `[wxt] Failed to connect to dev server`。
- 普通 Chrome 手动加载测试应使用 `.output/chrome-mv3`，不要使用 `.output/chrome-mv3-dev`。

## Flow 逐 Step 详细测试（追加）

- 测试时间：2026-05-28 16:20-16:58（Asia/Tokyo）
- 测试页面：`https://bqweapons.github.io/web-assistant/test-pages/data-source/datasource-form-a.html`
- 导入文件：`docs/testing/fixtures/flow-step-test-import-2026-05-28.json`
- CSV 文件：`docs/testing/fixtures/flow-step-data-source.csv`
- 导入结果：`已导入 1 个站点、0 个元素、10 个流程。`

| Flow | 覆盖 step / 动作 | 实际结果 | 结果 |
|---|---|---|---|
| FT01 Input and Assert | Input、Assert | `customerId` 写入 `FT-CUST-001`，断言 equals 通过 | 通过 |
| FT02 Click Reset | Input、Click、Assert | 写入 `TEMP-RESET` 后点击 `#reset-button`，字段清空断言通过 | 通过 |
| FT03 Set Variable and Popup | Set Variable、Popup、变量渲染 | 变量 `flowMessage` 以 `{{var.flowMessage}}` 渲染为 `Variable OK`，弹窗 OK 后成功 | 通过 |
| FT04 Wait Modes and Assert | Wait time / appear / disappear / condition、Input、Assert | 等待时间、元素出现、临时元素消失、`budget > 6000` 均正常，最终断言 Submit 按钮通过 | 通过 |
| FT05 If Else Then Branch | If/Else then 分支、Popup | `h1 contains Screen A` 命中 then，显示 `IF_THEN_OK` 并成功 | 通过 |
| FT06 If Else Else Branch | If/Else else 分支、Popup | `h1 contains NoSuchText` 未命中，进入 else，显示 `IF_ELSE_OK` 并成功 | 通过 |
| FT07 Loop Popup | Loop、Popup | 循环 2 次，弹窗 `LOOP_OK` 出现 2 次，日志显示 2/2 成功 | 通过 |
| FT08 Data Source | Data Source、CSV、row token、Input、Assert | 选择 CSV 后运行 2 行数据，最终字段为 `DS-2 / Grace Hopper / grace@example.com`，断言 `DS-2` 通过 | 通过 |
| FT09 Navigate | Navigate、跨页面 Assert | 主动导航到 Screen B，URL query 包含 `FTNAV`，断言 `body contains FTNAV` 通过 | 通过 |
| FT10 Click Cross Page and Return | Input、Click 页面跳转、Wait、Assert、Click 返回 | 点击 Submit 跳到 Screen B，验证 `#result-customerId = XPG-001`，再点 `#back-button` 回到 Screen A，最终 `h1 contains Screen A` 通过 | 通过 |

## Flow 反馈

| 优先级 | 反馈 | 证据 / 影响 |
|---|---|---|
| P3 | Data Source 的卡片步数和运行进度口径不完全一致 | FT08 卡片显示 `5 步`，运行状态显示 `已成功 7/7 步`。功能正确，但用户可能疑惑；原因应是 data-source 子步骤按 CSV 行展开后被计入运行进度。 |
| P3 | 变量 token 手写时容易写错 | 首次测试 fixture 误写为 `{{vars.flowMessage}}` 时弹窗原样显示；正确语法是 `{{var.flowMessage}}`。功能正确，建议在 UI 文案或 builder 提示中继续明确变量语法。 |

## Flow 编辑器手工添加 Step 测试（追加）

- 测试时间：2026-05-28 17:00-17:03（Asia/Tokyo）
- 测试方式：不通过导入 JSON，直接在 Flow 页面点击 `创建流程`、`添加步骤` 菜单和各 step 配置控件。
- 临时流程：`UI Manual Step Add Test`
- 保存结果：保存成功，列表顶部出现该流程，站点 Flow 数从 10 变 11。

| 编辑器动作 | 实际结果 | 结果 |
|---|---|---|
| 点击 `创建流程` | 新流程抽屉打开，名称、描述、步骤区、保存按钮可见 | 通过 |
| 填写名称和描述 | 文本可正常输入并保留 | 通过 |
| 从 `添加步骤` 菜单添加 Click | 生成 `点击` 卡片，展开选择器配置，默认 `.btn-primary` | 通过 |
| 从 `添加步骤` 菜单添加 Input | 生成 `输入` 卡片，展开选择器、直接输入、密码库选择、日期/时间插入按钮 | 通过 |
| 从 `添加步骤` 菜单添加 Set Variable | 生成 `设置变量` 卡片，展开变量名、Value/Selector 切换、变量提示 | 通过 |
| 从 `添加步骤` 菜单添加 Popup | 生成 `弹窗` 卡片，展开 Message 输入框 | 通过 |
| 从 `添加步骤` 菜单添加 Loop | 生成 `循环` 卡片，显示 Iterations、`{{loop.index}}` 说明、循环内添加入口 | 通过 |
| 从 `添加步骤` 菜单添加 Data Source | 生成 `数据源` 卡片，显示文件选择入口 | 通过 |
| Data Source 中选择 CSV | 系统文件选择器打开，选择 `flow-step-data-source.csv` 后卡片显示 `3 列 | 2 行` | 通过 |
| Data Source 中点击列名 `customerId` | 自动在每行步骤中创建 Input，值为 `{{row.customerId}}` | 通过 |
| 从 `添加步骤` 菜单添加 If / Else | 生成 `如果 / 否则` 卡片，显示条件字段、满足/不满足分支添加入口 | 通过 |
| 从 `添加步骤` 菜单添加 Wait | 生成 `等待` 卡片，显示时间延迟模式和 Duration | 通过 |
| 从 `添加步骤` 菜单添加 Navigate | 生成 `跳转` 卡片，显示 URL 字段 | 通过 |
| 从 `添加步骤` 菜单添加 Assert | 生成 `断言` 卡片，显示选择器、Operator、Value 字段 | 通过 |
| 点击保存 | 抽屉关闭，流程列表新增 `UI Manual Step Add Test`，显示 `11 步` | 通过 |

说明：这轮验证的是编辑器真人点击添加与保存路径；该临时流程包含默认示例 selector/URL，没有作为端到端执行用例运行。端到端执行已由前一节 FT01-FT10 覆盖。

## Button 与 Flow 联动测试（追加）

- 测试时间：2026-05-28 17:07-17:09（Asia/Tokyo）
- 测试页面：`https://bqweapons.github.io/web-assistant/test-pages/data-source/datasource-form-a.html`
- 测试方式：在 Elements 页面手工添加页面按钮，再通过按钮配置里的 `操作流程` 绑定已通过的 Flow。
- 临时按钮：`Flow触发测试`
- 绑定 Flow：`FT03 Set Variable and Popup`（内部 flow id：`flow-test-03-variable-popup`）

| 动作 | 预期 | 实际 | 结果 |
|---|---|---|---|
| 在 Elements 中选择 `按钮` 并点击页面目标位置 | 页面插入按钮并打开元素编辑面板 | 按钮插入在 `Reset` 后方，编辑面板打开 | 通过 |
| 修改按钮名称 | 页面按钮实时更新显示文本 | 名称改为 `Flow触发测试` 后，页面按钮同步显示 | 通过 |
| 在 `操作流程` 下拉中选择 Flow | 元素保存后记录 flow 绑定 | 选择 `FT03 Set Variable and Popup` 后保存，列表显示 `操作流程：flow-test-03-variable-popup` | 通过 |
| 点击页面上的 `Flow触发测试` | 页面按钮触发绑定 Flow | 弹出 Ladybird 弹窗，内容为 `Variable OK` | 通过 |
| 点击弹窗 `OK` | 弹窗关闭，页面保持在 Screen A | 弹窗正常关闭，页面 URL 未变化 | 通过 |

结论：按钮与 Flow 的基础联动链路正常，包括 UI 绑定、保存后展示、页面注入按钮点击触发 Flow、Flow 内变量渲染和 Popup 输出。

## 未覆盖 / 有意跳过

- `Open store` 未点开：会跳到外部 Chrome Web Store 页面，本轮以不打断当前测试状态为主。
- `Close side panel` 未测试：会关闭当前测试面板，留到最后清理或专项测试更合适。
- Password Vault 的创建、解锁、错误密码、导入含密钥数据未覆盖：当前 Vault 为空且本轮目标是基础按钮/动作巡检。
- 复杂 Flow 步骤已经通过导入 fixture 逐项执行，并追加覆盖了编辑器里手工点击添加每一种 step；本轮未覆盖的是拖拽重排和每个嵌套分支里的所有组合配置。
- 本轮没有在 WXT 临时测试窗口验证，因为当前可操作窗口稳定指向普通 Chrome profile。
