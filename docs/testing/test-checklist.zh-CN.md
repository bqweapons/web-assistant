# 测试检查清单（docs 测试页面）

## 冒烟（5-10 分钟）

- [ ] 打开 `docs/test-pages/basic/test-page.html`
- [ ] 创建 1 个按钮元素并确认显示
- [ ] 运行 1 个 popup flow，并确认点击 `OK` 后继续执行
- [ ] 创建 1 条 hidden 规则并确认页面元素被隐藏
- [ ] 打开 Overview，确认能看到已保存站点数据

## Vault 流程

- [ ] 在 flow 输入步骤中将密码字段绑定到 Password Vault
- [ ] 关闭 sidepanel 后运行该 flow
- [ ] 确认页面内出现保管库解锁提示
- [ ] 输入错误保管库密码并确认可重试
- [ ] 输入正确密码后确认从当前步骤继续执行
- [ ] 取消解锁提示，确认运行停止并显示用户可理解的错误
- [ ] 重置保管库后确认已绑定字段显示为失效状态
- [ ] 重新绑定失效字段并确认再次运行成功

## Data Source A/B

- [ ] 打开 `docs/test-pages/data-source/datasource-form-a.html`
- [ ] 运行 flow 填写多个字段（`text`, `email`, `date`, `number`）
- [ ] 提交到 Screen B
- [ ] 确认结果表格正确显示值
- [ ] 使用返回链接回到 Screen A

## 导入 / 导出（可选保管库数据）

- [ ] 默认路径导出（不含保管库密码）
- [ ] 包含保管库密码导出（确认提示 + 输入保管库密码）
- [ ] 导入 JSON 后确认 elements/flows 恢复
- [ ] 如包含保管库数据，确认创建/解锁保管库后 secrets 恢复

## i18n 基础检查

- [ ] 切换 sidepanel 语言到 `en`, `ja`, `zh_CN`
- [ ] 确认 tabs/header 文案正确切换（无英文残留）
- [ ] 确认 runner/vault 关键提示已本地化

## 记录模板

- 测试构建/版本：
- 浏览器版本：
- 测试人：
- 日期：
- 通过/失败概述：
- 备注 / 回归问题：
