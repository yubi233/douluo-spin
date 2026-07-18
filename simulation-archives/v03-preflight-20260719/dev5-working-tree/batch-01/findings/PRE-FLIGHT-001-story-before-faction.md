# PRE-FLIGHT-001：剧情早于人物背景与势力

- 严重级别：阻断
- generation：`dev5-working-tree`
- 影响样本：01、03、05、07、09、11、13、15、17、19（10/10 人类路线）
- 自动审计：错误地报告 10/10 passed
- 人工结论：failed

## 证据

所有受影响 JSON 的 `trace` 都以 `pool.story.1` 在第 8 回、`pool.setup.faction` 在第 9 回的顺序出现。对应传记也先写“剧情1”，再写“人物背景与势力”。

代表样本：`runs/03-human.json`，seed 为 `v03-preflight-dev5-batch-01-sample-03`。

## 根因

`storyTimelineProcess` 对角色设定期间由 `pool.setup.period` 产生的 `time.advanced` 无阶段限制，因而在势力选择和进入冒险阶段前排入了首个剧情任务。

## 修复与回归

剧情排程现仅接受 `adventure.human` 或 `adventure.transformed` 阶段内的时间推进。新增集成回归使用原失败 seed，断言 `pool.setup.faction` 严格早于 `pool.story.1`。

本 generation 保留为失败证据，不得继续 batch-02。
