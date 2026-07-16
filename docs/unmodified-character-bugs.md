# 剧情线反馈缺失诊断

> 诊断日期：2026-07-15
> 问题性质：剧情结果未能反馈到角色信息（状态、属性、数值）的修改
> 风险等级：**S1（严重）** — 影响核心游戏循环

---

## 一、诊断方法

遍历全部 275 个轮盘池的 2,468 个选项，逐个检查选项文本是否包含对角色信息的修改意图（等级/容貌/修为/称号/领域/魂骨/血脉等），再对照 `machine.ts` 中的 `applyCommon()` 和各 handler 的实现，确认修改是否实际生效。

判断标准：选项文本声明了角色变化 → 对应 handler 必须解析并应用该变化 → 否则标记为缺失。

---

## 二、发现问题总览

| ID | 问题 | 严重度 | 受影响选项 | 受影响池 |
|----|------|--------|-----------|---------|
| BUG-01 | `beastEncounter` handler 缺失 | **S1（致命）** | 36 | 7 |
| BUG-02 | `容貌+/-数字` 从未被处理 | **S1（致命）** | 52 | 52 |
| BUG-03 | 魂兽"修为掉落"句式未解析 | **S2（中等）** | 30+ | 7 |

---

## 三、详细分析

### BUG-01: `beastEncounter` handler 缺失

**位置**：`src/domain/machine.ts`

**现象**：
- `prepareNext()` 在 522-523 行推送了 `beastEncounter` 任务：
  ```typescript
  task('魂兽时间跳跃', beastEncounterPool(context.beast.cultivation), 'beastEncounter')
  ```
- 但在 `applyResult()` 的 switch 中，**不存在 `case 'beastEncounter':`**
- 现有的 beast 相关 case 只有：`beastGender`、`beastPeriod`、`beastRealm`、`beastType`、`beastSpecies`、`beastArea`、`beastRoute`、`beastGrowth`、`beastEvolution`

**影响**：
- 魂兽遭遇剧情（10年/百年/千年/万年/十万年/二十万年/30-99万年）共 7 个池、89 个选项
- 其中 36 个选项含 `修为+N年` 或 `修为掉落N年` 文本
- 比如 `"你遇到万年魂兽，强者就是要羞辱弱者，你将其重伤并啃了它一口，修为+1000年"`
- 结果：**这些修为变化从未被写入 `context.beast.cultivation`**

**生效的是**（由 `applyCommon()` 全局捕获）：
- ✅ `【XX】` 称号 → `context.traits`
- ✅ 领域获得 → `context.domains`
- ✅ 魂骨获得 → `context.soulBones`

**不生效的是**：
- ❌ `修为+N年` → `context.beast.cultivation` 不变
- ❌ `修为掉落N年` → `context.beast.cultivation` 不变
- ❌ `修为-N万年` → `context.beast.cultivation` 不变
- ❌ 血脉变化 → 没有对应字段处理

**修正方案**：
在 `applyResult()` 的 switch 中，`beastGrowth` 之前插入 `case 'beastEncounter':`
```typescript
case 'beastEncounter': {
  if (!context.beast) break
  // 修为增加：修为+N年
  let gain = 0
  const gainMatch = text.match(/修为\s*\+\s*(\d+)/)
  if (gainMatch) gain = Number(gainMatch[1])
  // 修为减少：修为掉落N年 / 修为-N万年
  const lossMatch = text.match(/修为掉落\s*(\d+)/) ?? text.match(/修为\s*-\s*(\d+)/)
  if (lossMatch) gain = -Number(lossMatch[1])
  if (gain !== 0) {
    context.beast.cultivation = Math.max(10, context.beast.cultivation + gain)
  }
  break
}
```

---

### BUG-02: `容貌+/-数字` 从未被处理

**位置**：`src/domain/machine.ts:541-553` — `applyCommon()`

**现象**：
- 当前 `applyCommon()` 处理了：`【称号】`、`领域`、`魂骨`、`等级+/-数字`
- **没有** `容貌+/-数字` 的处理
- 容貌仅在创角时由 `case 'appearance'` 设置一次：
  ```typescript
  case 'appearance':
    context.appearance = appearanceGrade(text)
  ```
- `appearanceGrade` 提取文本中的等级字母（A/B/S/EX 等），**无法处理"容貌+1"**

**影响**：
- 神考和海神考核奖励中，52 个池每个都有 `容貌+1（ex级无法提升则重抽）`
- 覆盖：三级神(6)、二级神(7)、一级神(8)、神王(8)、顶级考核(8)、黑级考核(6)、紫级考核(4)、黄级考核(4)
- **抽到"容貌+1"后，角色 `appearance` 字段从未被提升**

**修正方案**：
在 `applyCommon()` 中增加容貌处理：
```typescript
const appearanceChange = text.match(/容貌\s*([+-])\s*(\d+)/)
if (appearanceChange && !/ex级?无法提升/.test(text)) {
  const GRADES = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'EX']
  const idx = GRADES.indexOf(context.appearance.toUpperCase())
  if (idx >= 0) {
    const delta = Number(appearanceChange[2]) * (appearanceChange[1] === '+' ? 1 : -1)
    context.appearance = GRADES[Math.max(0, Math.min(GRADES.length - 1, idx + delta))]
  }
}
```

---

### BUG-03: 魂兽"修为掉落"句式未解析

**位置**：`src/domain/machine.ts:757-770` — `case 'beastGrowth'`

**现象**：
- `beastGrowth` handler 中的正则：`text.match(/修为\s*\+\s*(\d+)/)`
- 可选文本不匹配"修为掉落N年"格式
- 且代码做了 `Math.max(0, gain)` — 负数被修正为 0，无法造成修为损失

**影响**：
- 虽然 beastGrowth 池（年限修为+N年）全是正向选项，不直接受影响
- 但这个限制意味着即使文本中有"修为掉落"，也不会生效
- 与 BUG-01 修复后，需要确保 encounter handler 支持负数

**修正方案**：
在 BUG-01 的修复方案中已包含（`gain = -Number(lossMatch[1])`）。

---

## 四、已确认正常的部分

以下剧情线经检查后确认反馈正常：

| 剧情线 | 如何生效 | 状态 |
|--------|----------|------|
| 称号【XX】 | `applyCommon()` 行542 | ✅ |
| 领域获得/领悟 | `applyCommon()` 行543-546 | ✅ |
| 魂骨获得 | `applyCommon()` 行547 | ✅ |
| 等级+数字 | `applyCommon()` 行548-551 | ✅ |
| 魂兽年限成长 | `beastGrowth` handler 行757-770 | ✅ |
| 魂兽雷劫突破 | `tribulation` handler 行771-780 | ✅ |
| 魂兽进化选择 | `beastEvolution` handler 行781-783 | ✅ |
| 魂力等级/魂骨/领域（神考奖励） | `applyCommon()` 全局处理 | ✅ |
| 特殊天赋 | `specialTalent` handler 行596-603 | ✅ |
| 武魂进化 | `growth` handler（新增） | ✅ |

---

## 五、修复优先级

| 优先 | Bug | 理由 |
|------|-----|------|
| **P0** | BUG-01 `beastEncounter` 缺失 | 魂兽路线核心循环（7池89选项）完全无反馈 |
| **P0** | BUG-02 `容貌` 未处理 | 52个考核池的奖励不生效，影响全部路线 |
| **P1** | BUG-03 修为负数未处理 | 与 BUG-01 同时修复 |

---

## 六、涉及文件

| 文件 | 改动类型 |
|------|----------|
| `src/domain/machine.ts` | `applyCommon()` +9行、`applyResult()` switch +13行 |

---

*本文档仅记录问题诊断，代码修改见后续 commit。*
