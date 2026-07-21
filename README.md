# 我的斗罗模拟器 v0.3

Vue 3 + TypeScript 的确定性斗罗模拟器。v0.3 使用结构化内容、显式 RNG、原子事件批次和 Process Manager 驱动人类魂师、魂兽、化形、魂环、剧情、神考、战后路线与终局。

当前内容包含 353 个池、3,069 个选项和 1,686 个实体。原版转盘源及其 `catalog`/`canonAdditions`/武魂分类与品阶规则已从 `1338d1b^` 以 SHA-256 固定快照恢复，并由 `npm run content:migrate` 在构建期编译为显式 v0.3 条件、效果、虚拟池与 ID 元数据；生产运行时不读取旧 JSON，也不解析中文文本。人类创建的六类武魂入口直接调度完整原始池，不再注册单项占位池。恢复工作当前使用 `contentVersion` `v0.3.8`；静态逐项保真已通过，真实流程覆盖仍有 27 个原始池 blocked，尚未认证。

## 技术栈

- Vue 3 Composition API
- TypeScript 5.9
- XState 5，仅负责生命周期与命令权限
- Vite、Vitest、Playwright
- 本机 Chrome + CDP screencast + ffmpeg 流程录像

## 运行与验证

```bash
npm install --cache .npm-cache
npm run dev
```

```bash
npm run content:validate
npm test
npm run build
npm run architecture:validate
npm run test:e2e
npm run test:verify
```

`npm run test:verify` 是完整门禁，依次执行内容审计、52 项 Vitest、生产类型检查与构建、生产架构扫描和 7 项真实 Chrome E2E。内容审计会在结构有效但原版规则仍待恢复时输出 `recovery-in-progress`，这不是发布认证通过。Playwright 使用独占端口 `4175`，证据位于 `test-results/iterations/v0.3/`。

项目不调用模型，因此模型录屏不适用；桌面主流程使用 Chrome screencast 生成 MP4，并保留 trace 与截图。

## v0.3 架构

```text
Vue UI / composables
        |
        v
application/
  GameService       ContentService       persistence / projections
        |                  |
        v                  v
core/                 content/v03/
  statechart             presentation + mechanics source
  draw / rules           stable ASCII IDs
  effects / reducer      explicit predicates/effects
  process managers
```

- `GameService` 是唯一游戏写入口。每次命令先在隔离状态上结算完整事件链，再一次性提交 `EventBatch`。
- 相同 `contentVersion`、seed 与命令序列产生字节级一致的事件日志。
- 回退通过截断事件日志并从初始状态重放，不保存可漂移的状态快照。
- UI、传记、编年史和长模拟都由同一事件日志与状态投影生成。
- 内容编辑器支持结构化 predicate、数值表达式和注册 effect；预览会完整重编译临时内容。
- patch 按稳定 pool/option ID 导入导出，版本或结构不兼容时原子拒绝。

## 浏览器数据

- 事件日志存档键：`douluo-spin-vue-v3`
- 存档格式：`douluo-spin-event-log`，schema 3
- 内容 patch 单独保存，不参与角色回退
- v0.3 明确不兼容 v0.1/v0.2 存档和旧覆盖格式

## 长程认证

`npm run simulate:long` 每次只生成或校验一个 20 份批次。下一批必须等待上一批 20 份传记与 JSON 全部人工审阅、`npm run test:verify` 通过且 `gate.json.status=passed`。

最终发布认证固定为同一 commit、同一 `contentVersion` 的 20 批 x 20 份，共 400 份；目录为 `simulation-archives/<campaign>/<generation>/`。`v03-final-20260719/45609b2-v0.3.0` 的 20 个 batch gate、400 份自动审计和 400 份独立人工审阅均已通过，但它只对应历史内容版本 `v0.3.0`。原版规则恢复已将当前版本提升为 `v0.3.8`，因此必须先满足 [原版转盘恢复与长程验证标准](docs/v0.3-long-run-recovery-standard.md)，让所有原始池达到 observed 或 controlled 后从 batch-01 重新认证。

## 目录

```text
src/
  application/      游戏/内容服务、持久化、投影和模拟
  components/       Vue UI 与结构化编辑器
  composables/      UI 状态与服务适配
  content/          v0.3 结构化内容和编译器
  core/             事件、规则、抽取、reducer、流程和状态图
scripts/            内容/架构审计与单批次长模拟
tests/              core 与 application 单元/集成测试
e2e/                桌面、移动与响应式 Chrome 旅程
docs/               状态机、测试说明、计划与实施记录
```

状态与事件边界见 [docs/state-machine.md](docs/state-machine.md)，自动化证据见 [docs/test/v0.3-automation.md](docs/test/v0.3-automation.md)，完整实施记录见 [docs/v0.3-implementation-log.md](docs/v0.3-implementation-log.md)。
