# 斗罗大陆命运轮盘

原单文件页面的 Vue 3 + TypeScript 重构版。项目保留原始 273 个转盘、2,456 个选项及其权重，使用显式有限状态机驱动人类魂师、魂兽、化形、神考、雷劫和终局流程。

## 技术栈

- Vue 3 Composition API
- `shallowRef` + `computed`，不使用 Pinia
- 纯 TypeScript 有限状态机
- Vite + Vitest + Playwright

`shallowRef` 只保存一个 `MachineState`。每次事件由纯函数 `transition(state, event)` 生成下一状态并整体替换引用；完整转盘数据保持普通只读对象，不进入 Vue 深层响应式代理。

## 运行

```bash
npm install --cache .npm-cache
npm run dev
```

测试与生产构建：

```bash
npm test
npm run build
npm run test:e2e
```

`npm run test:e2e` 使用真实本机 Chrome 验证桌面、移动端和七种响应式视口，并在 `test-results/iterations/v0.1/` 留下 trace、截图、报告和 MP4 流程录像。完整基准可运行 `npm run test:verify`。

## GitHub Pages

推送到 GitHub 仓库的 `main` 分支后，`.github/workflows/deploy-pages.yml` 会自动构建并部署站点。首次启用时，在仓库的 **Settings > Pages > Build and deployment** 中将 Source 设为 **GitHub Actions**。

工作流会使用 GitHub 提供的页面基础路径构建，项目页和个人主页均无需再修改 Vite 配置。部署完成后的站点地址会显示在该次 Actions 运行的 `Deploy to GitHub Pages` 步骤中。

## v0.1 本地数据

- 角色存档使用 `douluo-spin-vue-v1`；转盘修改使用独立的 `douluo-wheel-overrides-v1`，两者不会相互覆盖。
- 内置 `wheels.json` 始终只读。修改按稳定池 ID 合并为运行时有效池，编辑器可恢复单池默认值，更多菜单可导出审阅用 JSON。
- 转盘扇区、条件过滤、概率和抽取复用同一归一化候选分布；相同种子、有效配置与操作顺序仍保持确定性。

## 目录

```text
src/
  components/       Vue 展示与输入组件
  composables/      shallowRef 状态容器、自动推进、持久化
  data/             原页面无损抽取的转盘 JSON
  domain/           状态机、权重引擎、目录索引、领域类型
  utils/            文件导出和文本显示工具
tests/              数据完整性与状态迁移测试
```

完整状态与事件说明见 [docs/state-machine.md](docs/state-machine.md)。

双端界面重构安排见 [docs/iteration-plan-v0.1.md](docs/iteration-plan-v0.1.md)。
