# v0.3 状态图与事件内核

## 生命周期状态

| `GamePhase` | 责任 | 可执行核心命令 |
|---|---|---|
| `idle` | 未创建命运 | `run.start` |
| `setup.human` | 性别、容貌、武魂、年龄、时期、魂力、势力 | `turn.spin` |
| `setup.beast` | 时期、性别、修为、类型、种族、区域 | `turn.spin` |
| `setup.transformed` | 化形后的性别、容貌和势力 | `turn.spin` |
| `adventure.human` | 初始魂环、成长、剧情、战后分支 | `turn.spin` |
| `adventure.beast` | 修为成长、雷劫、路线选择 | `turn.spin` |
| `adventure.transformed` | 化形魂师的魂环、成长和剧情 | `turn.spin` |
| `god-trial` | 继承或自创神位考核 | `turn.spin` |
| `ended` | 死亡或飞升后的不可变终局 | `run.reset`、`run.start` |

XState 只声明状态节点和命令 guard，不包含修改领域实体的 action。Vue 不直接切换业务阶段。

## 命令事务

```text
GameCommand
  -> lifecycle guard
  -> deterministic draw (optional)
  -> compile EffectSpec to DomainEvent[]
  -> Process Managers react until stable
  -> validate/reduce isolated batch
  -> append one EventBatch
  -> publish receipt + projection
```

一次 `turn.spin` 的选项、概率、RNG 前后状态、效果和全部流程反应共享同一个 `turnId`。任一未知 effect、非法内容或流程循环都会取消整批，状态、RNG 与日志不发生部分提交。

## 主迁移

```text
idle -> setup.human -> adventure.human -> god-trial -> ended
    \-> setup.beast -> adventure.beast -----------> ended
                            |
                            +-> setup.transformed
                                  -> adventure.transformed
                                  -> god-trial -> ended
```

战后时代的人类路线在四个 postwar 节点后进入自创神位考核；其他完整人类剧情进入继承神位考核。死亡与飞升都只由 `run.finished` 进入 `ended`，reducer 同时清空 agenda。

## Process Manager

| Manager | 输入事实/事件 | 产出 |
|---|---|---|
| `character-setup` | run started、setup signal | 稳定 poolId 的下一设定任务和冒险阶段迁移 |
| `soul-ring` | 进入人类冒险、level changed、ring signal | 缺失魂环任务与 `soul-ring.granted` |
| `story-timeline` | 冒险阶段的 time advanced、story signal | 四个剧情节点 |
| `human-progression` | 进入人类冒险、growth signal | 首次/后续成长、神考或战后入口 |
| `beast-cultivation` | cultivation changed、tribulation/route signal | 雷劫、化形或继续成长 |
| `postwar-story` | postwar signal | 四阶段战后节点和自创神考 |
| `god-trial` | exam signal | 考次推进、神位和成神终局 |
| `ending` | run finished | 唯一终局阶段 |

稳定循环上限为 32 步，超限抛出 `ProcessCycleError` 并取消命令事务。

## 顺序不变量

- 势力设定完成后才能进入首个剧情节点。
- 化形后的性别、容貌和势力设定完成后才能吸收魂环。
- 初始等级对应的魂环必须先于第一次“两年后的成长与遭遇”。
- 魂兽类型、种族、血脉和区域必须是陆生/疾风魔狼/森林或海生/灵潮鲸/海域的相容组合。
- 终局后 agenda 必须为空，不能再产生领域事件。

这些规则同时由 Process Manager、结构化候选条件、集成测试和长模拟 `audit` 检查。

## RNG、回退与存档

- RNG 状态属于 `GameState.random`，抽取只消费显式输入并返回 `rngAfter`。
- `turn.undo` 删除最近一次 spin 及其后续日志，再从初始状态重放保留的批次；重抽得到相同选项。
- 存档只保存 schema 3 的 `EventBatch[]`、内容版本和 checksum。
- 恢复时校验版本、checksum、连续 `turnId`、连续 RNG 收据和首批 `run.start`，失败时不修改当前服务。

## 内容边界

- PresentationCatalog 保存 title/description；MechanicsCatalog 不包含展示文案。
- predicate、number expression、effect、signal、entity、ending 和 pool 都通过注册表和稳定 ASCII ID 编译。
- 生产架构扫描禁止旧 `src/domain`、`wheels.json`、v1 存储 key 和文本解析函数重新进入源码依赖。
