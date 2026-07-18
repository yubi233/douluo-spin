# PRE-FLIGHT-002：化形设定完成前吸收魂环

- 严重级别：阻断
- generation：`dev5-working-tree`
- 影响样本：02、04、08、20（4/4 完成化形的兽族路线）
- 自动审计：错误地报告 4/4 passed
- 人工结论：failed

## 证据

所有受影响 JSON 的 `trace` 都在第 11 回出现首个 `pool.human.soul-ring`，随后才在第 12、13 回出现 `pool.setup.appearance` 与 `pool.setup.faction`。传记因此先记录“魂环吸收”，再记录“基础设定4:容貌”和“人物背景与势力”。

代表样本：`runs/02-beast.json`，seed 为 `v03-preflight-dev5-batch-01-sample-02`。

## 根因

`soulRingProcess` 在 `setup.transformed` 阶段也响应等级变化。化形时同步获得的等级在人物设定链尚未完成时就排入魂环任务。

## 修复与回归

魂环排程现仅接受进入 `adventure.human` / `adventure.transformed` 的阶段事件或这些阶段内的等级变化；魂环选择后的授予结算不受影响。新增集成回归使用原失败 seed，断言容貌、势力均严格早于首枚魂环。

本 generation 保留为失败证据，不得继续 batch-02。
