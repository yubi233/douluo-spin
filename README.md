# 斗罗大陆命运轮盘

原单文件页面的 Vue 3 + TypeScript 重构版。项目保留原始 273 个转盘、2,456 个选项及其权重，使用显式有限状态机驱动人类魂师、魂兽、化形、神考、雷劫和终局流程。

## 技术栈

- Vue 3 Composition API
- `shallowRef` + `computed`，不使用 Pinia
- 纯 TypeScript 有限状态机
- Vite + Vitest

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
```

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
