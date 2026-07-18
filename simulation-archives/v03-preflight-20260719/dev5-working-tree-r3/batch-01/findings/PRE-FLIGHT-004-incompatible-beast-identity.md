# PRE-FLIGHT-004：魂兽类型、种族与区域不相容

- 严重级别：阻断
- generation：`dev5-working-tree-r3`
- 影响样本：02、04、06、08、16、18（6/10 beast 请求路线）
- 自动审计：错误地报告 6/6 passed
- 人工结论：failed

## 证据

归档 state 中存在以下非法组合：

- 样本 02：海魂兽 + 灵潮鲸 + 星斗大森林。
- 样本 04、08、16、18：海魂兽 + 疾风魔狼 + 星斗大森林。
- 样本 06：陆生魂兽 + 灵潮鲸 + 无尽海域。

代表样本：`runs/04-beast.json`，seed 为 `v03-preflight-dev5-r3-batch-01-sample-04`。

## 根因

`pool.beast.setup.species` 和 `pool.beast.setup.area` 的选项均无 `availableWhen`，类型、种族与区域三个池彼此独立抽取。稳定 ID 和实体类型校验只能证明引用合法，不能证明组合语义相容。

## 修复方案

- 注册 `actor.beast-types`、`actor.beast-species`、`actor.beast-areas` 三个集合事实。
- 种族候选按魂兽类型过滤，区域候选按已选种族过滤。
- 模拟自动审计增加最终魂兽身份组合校验。
- 内容版本升级到 `v0.3.0-dev.6`，使用原失败 seed 验证不再产生非法组合。

本 generation 保留为失败证据，不得继续 batch-02。
