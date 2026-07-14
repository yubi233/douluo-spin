# 有限状态机设计

## 状态

| 状态 | 责任 | 允许的核心事件 |
|---|---|---|
| `idle` | 未创建命运 | `OPEN_START`, `START`, `RESTORE` |
| `routeSelection` | 选择路线与种子 | `START`, `CANCEL_START` |
| `humanSetup` | 性别、容貌、武魂、年龄、势力 | `ROLL` |
| `beastSetup` | 时期、性别、修为、种类、区域 | `ROLL` |
| `humanAdventure` | 魂环、成长、遭遇和主线 | `ROLL` |
| `beastAdventure` | 成长、遭遇、进化和雷劫 | `ROLL` |
| `transformedSetup` | 十万年魂兽化形后的重设 | `ROLL` |
| `transformedAdventure` | 化形魂师后续流程 | `ROLL` |
| `godTrial` | 神位指向与逐考奖励 | `ROLL` |
| `rolling` | 锁定活动任务，等待唯一结果 | `RESOLVE` |
| `ending` | 存活结局或死亡结局 | `OPEN_START`, `RESET` |

所有进行中状态还接受 `OPEN_START`、`FINISH` 和 `RESTORE`。`rolling` 是唯一接受 `RESOLVE` 的状态，避免结果在错误阶段写入角色。

## 主迁移

```text
idle -> routeSelection -> humanSetup -> humanAdventure -> ending
                       -> beastSetup -> beastAdventure -> ending
                                            |-> transformedSetup
                                                -> transformedAdventure -> ending

humanSetup / humanAdventure / transformedAdventure
  -> godTrial -> humanAdventure or ending

any stable play state -> rolling -> previous/derived stable state
```

## 边界

- 状态机只负责流程、上下文和守卫，不依赖 Vue 或 DOM。
- 权重抽取位于 `engine.ts`，相同种子与操作顺序得到相同结果。
- Vue store 负责动画等待、自动推进、撤销和浏览器存档，不自行改写业务阶段。
- `RAW_DATA` 被解析为 `wheels.json`，运行时不执行原页面脚本。
- 自由转盘是只读沙箱，不污染主状态机上下文。
