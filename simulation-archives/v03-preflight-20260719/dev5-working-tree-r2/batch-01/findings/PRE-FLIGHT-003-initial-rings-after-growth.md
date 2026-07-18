# PRE-FLIGHT-003：初始魂环排在首次成长之后

- 严重级别：阻断
- generation：`dev5-working-tree-r2`
- 影响样本：01、02、03、05、06、07、09、10、11、13、15、17、19（全部 10 个人类样本与全部 3 个化形样本）
- 自动审计：错误地报告 13/13 passed
- 人工结论：failed

## 证据

进入 `adventure.human` 或 `adventure.transformed` 的事件批同时依次排入 `task.*.growth.1` 和初始魂环任务，agenda 按插入顺序先执行成长。样本 15 的先天魂力直接给出 20 级，但第 9 回先执行“两年后的成长与遭遇”并死亡，最终传记为 20 级、0 魂环。

代表样本：`runs/15-human.json`，seed 为 `v03-preflight-dev5-r2-batch-01-sample-15`。

## 根因

`CharacterSetupProcess` 在势力选择后直接排入初次成长；同一稳定循环中，`SoulRingProcess` 随后才根据 `phase.changed` 排入初始魂环。该顺序违背阶段 C 的“等级 → 魂环/魂骨 → 成长/遭遇”流程。

## 修复方案

角色设定流程只负责切换到冒险阶段。`HumanProgressionProcess` 响应该阶段事件排入初次成长；由于 Process Manager 注册顺序中 `SoulRingProcess` 在前，初始魂环会先进入 agenda。使用原失败 seed 增加集成顺序回归。

本 generation 保留为失败证据，不得继续 batch-02。
