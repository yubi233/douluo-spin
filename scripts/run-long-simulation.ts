import { mkdir, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createSeed } from '../src/domain/random'
import { createSimulationArchive, simulateFullJourney } from '../src/domain/simulation'
import type { SimulationIssue } from '../src/domain/simulation'

const totalSamples = Number(process.env.SIMULATION_SAMPLES ?? 100)
const batchSize = Number(process.env.SIMULATION_BATCH ?? 10)
if (!Number.isInteger(totalSamples) || totalSamples < 1) throw new Error('SIMULATION_SAMPLES 必须是正整数')

const startedAt = process.env.SIMULATION_STARTED_AT || new Date().toISOString()
const seedPrefix = process.env.SIMULATION_SEED_PREFIX?.trim() || createSeed()
const directoryName = startedAt.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z').replace('T', '-')
const archiveDirectory = resolve(process.cwd(), 'simulation-archives', directoryName)

interface RunRecord {
  sample: number
  route: 'human' | 'beast'
  seed: string
  rolls: number
  completed: boolean
  ending: string
  auditPassed: boolean
  issues: SimulationIssue[]
  biography: string
  archive: string
}

const half = Math.ceil(totalSamples / 2)
const allRuns: RunRecord[] = []

await mkdir(archiveDirectory, { recursive: true })

async function runBatch(start: number, end: number): Promise<RunRecord[]> {
  const batch: RunRecord[] = []
  for (let sample = start; sample <= Math.min(end, totalSamples); sample += 1) {
    const route: 'human' | 'beast' = sample <= half ? 'human' : 'beast'
    const seed = `${seedPrefix}-batch-${String(sample).padStart(3, '0')}`
    const result = simulateFullJourney({ seed, route })
    const archive = createSimulationArchive(result)
    const baseName = `${String(sample).padStart(3, '0')}-${route}`
    const biography = `${baseName}.txt`
    const archiveName = `${baseName}.json`
    await Promise.all([
      writeFile(resolve(archiveDirectory, biography), `${result.biography}\n`),
      writeFile(resolve(archiveDirectory, archiveName), `${JSON.stringify(archive, null, 2)}\n`),
    ])
    batch.push({
      sample, route, seed,
      rolls: result.executedRolls,
      completed: result.completed,
      ending: result.state.context.ending || '未完结',
      auditPassed: result.audit.passed,
      issues: result.audit.issues,
      biography, archive: archiveName,
    })
  }
  return batch
}

function analyzeBatch(batch: RunRecord[], batchNum: number) {
  const passed = batch.filter((r) => r.auditPassed)
  const failed = batch.filter((r) => !r.auditPassed)
  const allIssues = batch.flatMap((r) => r.issues.map((i) => ({ ...i, sample: r.sample, route: r.route })))

  const byCode = new Map<string, typeof allIssues>()
  for (const issue of allIssues) {
    const list = byCode.get(issue.code) || []
    list.push(issue)
    byCode.set(issue.code, list)
  }

  // Count impact stats from the archives
  let totalEvents = 0
  let noImpactEvents = 0
  let storyNoImpact = 0
  for (const run of batch) {
    try {
      const archive = JSON.parse(readFileSync(resolve(archiveDirectory, run.archive), 'utf-8'))
      const trace = archive.trace as Array<{ impact: string; pool: string }>
      totalEvents += trace.length
      for (const entry of trace) {
        if (entry.impact === '无变化') {
          noImpactEvents += 1
          if (/剧情\d|嘉陵关|神战|决赛|单人赛|预选赛|遭遇剧情|势力|在校|入学|比赛后/.test(entry.pool)) {
            storyNoImpact += 1
          }
        }
      }
    } catch { /* skip */ }
  }

  console.log(`\n━━━ 第 ${batchNum} 批次（${batch[0].sample}-${batch[batch.length - 1].sample}）━━━`)
  console.log(`  事件：${totalEvents} · 无变化：${noImpactEvents}（其中剧情/战斗：${storyNoImpact}）`)
  console.log(`  通过：${passed.length}/${batch.length}`)

  if (failed.length > 0) {
    console.log(`  失败样本：${failed.map((r) => `#${r.sample}(${r.route})`).join(' ')}`)
    for (const [code, issues] of byCode) {
      const ids = issues.map((i) => `#${i.sample}`).join(' ')
      console.log(`    ${code} (${issues.length}): ${ids}`)
    }
  } else {
    console.log('  ✅ 全部通过')
  }
}

// Run in batches
for (let batchStart = 1; batchStart <= totalSamples; batchStart += batchSize) {
  const batchEnd = batchStart + batchSize - 1
  const batch = await runBatch(batchStart, batchEnd)
  allRuns.push(...batch)
  analyzeBatch(batch, Math.ceil(batchStart / batchSize))
}

// Final report
const humanRuns = allRuns.filter((r) => r.route === 'human')
const beastRuns = allRuns.filter((r) => r.route === 'beast')
const completed = allRuns.filter((r) => r.completed)
const passed = allRuns.filter((r) => r.auditPassed)
const allIssues = allRuns.flatMap((r) => r.issues.map((i) => ({ ...i, sample: r.sample, route: r.route })))

const issueByCode = new Map<string, typeof allIssues>()
for (const issue of allIssues) {
  const list = issueByCode.get(issue.code) || []
  list.push(issue)
  issueByCode.set(issue.code, list)
}

const humanLevels = humanRuns.map((r) => {
  try { return JSON.parse(readFileSync(resolve(archiveDirectory, r.archive), 'utf-8')).state.context.level } catch { return 0 }
}).filter((l: number) => l > 0)
const beastCultivations = beastRuns.map((r) => {
  try { return JSON.parse(readFileSync(resolve(archiveDirectory, r.archive), 'utf-8')).state.context.beast?.cultivation ?? 0 } catch { return 0 }
}).filter((c: number) => c > 0)

const avgHumanLevel = humanLevels.length ? (humanLevels.reduce((a: number, b: number) => a + b, 0) / humanLevels.length).toFixed(1) : 'N/A'
const avgBeastYears = beastCultivations.length ? (beastCultivations.reduce((a: number, b: number) => a + b, 0) / beastCultivations.length).toFixed(0) : 'N/A'

const issueRows = [...issueByCode.entries()]
  .sort(([, a], [, b]) => b.length - a.length)
  .map(([code, issues]) => {
    const sampleIds = [...new Set(issues.map((i) => i.sample))].slice(0, 5).join(', ')
    const more = new Set(issues.map((i) => i.sample)).size > 5 ? ` ...共${new Set(issues.map((i) => i.sample)).size}个样本` : ''
    return `| ${code} | ${issues.length} | ${sampleIds}${more} |`
  })

const summary = [
  '# 终极长程回归测试报告',
  '',
  `> 生成时间：${startedAt}`,
  `> 采样方式：按转盘权重抽取（模拟真实用户体验）`,
  `> 样本数：${totalSamples}（人类 ${humanRuns.length} / 魂兽 ${beastRuns.length}） · 批次大小 ${batchSize}`,
  '',
  '## 总体结果',
  '',
  `| 指标 | 数值 |`,
  `| ---- | ---- |`,
  `| 总样本 | ${totalSamples} |`,
  `| 完成终局 | ${completed.length} |`,
  `| 审计通过 | ${passed.length} |`,
  `| 人类平均等级 | ${avgHumanLevel} |`,
  `| 魂兽平均修为 | ${avgBeastYears} |`,
  '',
  '## 问题分布（按类型）',
  '',
  '| 问题代码 | 出现次数 | 涉及样本 |',
  '| -------- | -------- | -------- |',
  ...issueRows,
  '',
  '## 问题明细',
  ...allIssues.map((i) => `- **#${i.sample}** [${i.route}] \`${i.code}\`: ${i.message}`),
  '',
  '## 各样本汇总',
  '',
  '| 样本 | 路线 | 投掷 | 终局 | 审计 |',
  '| ---- | ---- | ---: | ---- | ---- |',
  ...allRuns.map((r) => `| ${r.sample} | ${r.route} | ${r.rolls} | ${r.ending.slice(0, 30)} | ${r.auditPassed ? '✅' : `❌${r.issues.length}`} |`),
  '',
].join('\n')

const manifest = {
  format: 'douluo-spin-long-simulation-batch',
  formatVersion: 2,
  startedAt,
  batchSize,
  sampling: 'weighted (real-user simulation)',
  requestedSamples: totalSamples,
  completedSamples: completed.length,
  passedSamples: passed.length,
  stats: { avgHumanLevel, avgBeastYears },
  issueByCode: Object.fromEntries(issueByCode),
}

await Promise.all([
  writeFile(resolve(archiveDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`),
  writeFile(resolve(archiveDirectory, 'audit-report.md'), summary),
])

console.log(`\n═══════════════════════════════════`)
console.log(`最终：${passed.length}/${totalSamples} 通过 · 归档目录：simulation-archives/${directoryName}`)
if (allIssues.length > 0) {
  console.log(`总问题：${allIssues.length}`)
  for (const [code, issues] of issueByCode) {
    console.log(`  ${code}: ${issues.length}`)
  }
}

if (passed.length !== totalSamples) process.exitCode = 1
