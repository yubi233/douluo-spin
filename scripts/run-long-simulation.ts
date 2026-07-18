import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { simulateJourney } from '@/application/simulation'
import { formatBiography, projectGameView } from '@/application/gameViewModel'
import { v03Content, v03Policies } from '@/content/v03/content'

type Action = 'run-batch' | 'verify-gate'
type Route = 'human' | 'beast'

const action = (process.env.SIMULATION_ACTION ?? 'run-batch') as Action
const campaignId = process.env.SIMULATION_CAMPAIGN_ID?.trim() || 'v03-preflight'
const generation = process.env.SIMULATION_CERTIFICATION_GENERATION?.trim() || 'working-tree-v03'
const batchCount = Number(process.env.SIMULATION_BATCH_COUNT ?? 2)
const batchSize = Number(process.env.SIMULATION_BATCH_SIZE ?? 20)
const batchIndex = Number(process.env.SIMULATION_BATCH_INDEX ?? 1)
const seedPrefix = process.env.SIMULATION_SEED_PREFIX?.trim() || `${campaignId}-${generation}`
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const contentVersion = v03Content.manifest.contentVersion

if (!['run-batch', 'verify-gate'].includes(action)) throw new Error('SIMULATION_ACTION 必须为 run-batch 或 verify-gate')
if (!Number.isInteger(batchCount) || batchCount < 1) throw new Error('SIMULATION_BATCH_COUNT 必须是正整数')
if (!Number.isInteger(batchSize) || batchSize !== 20) throw new Error('SIMULATION_BATCH_SIZE 必须恰好为 20')
if (!Number.isInteger(batchIndex) || batchIndex < 1 || batchIndex > batchCount) throw new Error('SIMULATION_BATCH_INDEX 超出范围')

const root = resolve(process.cwd(), 'simulation-archives', campaignId, generation)
const batchName = `batch-${String(batchIndex).padStart(2, '0')}`
const batchDirectory = resolve(root, batchName)
const runsDirectory = resolve(batchDirectory, 'runs')
const reviewsDirectory = resolve(batchDirectory, 'reviews')
const manifestPath = resolve(root, 'manifest.json')

interface ManifestBatch { index: number; status: string; automatedPassed: number; manualPassed: number }
interface Manifest {
  format: 'douluo-spin-v03-certification'
  schemaVersion: 3
  campaignId: string
  certificationGeneration: string
  commit: string
  contentVersion: string
  seedPrefix: string
  batchCount: number
  batchSize: number
  routeDistribution: { human: number; beast: number }
  batches: ManifestBatch[]
}

function baseManifest(): Manifest {
  return {
    format: 'douluo-spin-v03-certification', schemaVersion: 3, campaignId,
    certificationGeneration: generation, commit, contentVersion, seedPrefix, batchCount, batchSize,
    routeDistribution: { human: batchCount * 10, beast: batchCount * 10 }, batches: [],
  }
}

async function loadManifest(): Promise<Manifest> {
  if (!existsSync(manifestPath)) return baseManifest()
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest
  const expected = baseManifest()
  for (const field of ['campaignId', 'certificationGeneration', 'commit', 'contentVersion', 'seedPrefix', 'batchCount', 'batchSize'] as const) {
    if (manifest[field] !== expected[field]) throw new Error(`认证 manifest ${field} 与当前运行不一致`)
  }
  return manifest
}

async function saveManifest(manifest: Manifest) {
  await mkdir(root, { recursive: true })
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
}

function setManifestBatch(manifest: Manifest, batch: ManifestBatch) {
  manifest.batches = [...manifest.batches.filter((entry) => entry.index !== batch.index), batch].sort((a, b) => a.index - b.index)
}

async function requirePreviousGate() {
  if (batchIndex === 1) return
  const path = resolve(root, `batch-${String(batchIndex - 1).padStart(2, '0')}`, 'gate.json')
  if (!existsSync(path)) throw new Error(`前一批 gate.json 不存在：${path}`)
  const gate = JSON.parse(await readFile(path, 'utf8')) as { status?: string; commit?: string; contentVersion?: string }
  if (gate.status !== 'passed' || gate.commit !== commit || gate.contentVersion !== contentVersion) {
    throw new Error(`batch-${String(batchIndex - 1).padStart(2, '0')} 尚未通过同版本硬门禁`)
  }
}

function reviewTemplate(sample: number, route: Route, seed: string, baseName: string) {
  return [
    `# 样本 ${String(sample).padStart(2, '0')} 逐份审阅`, '',
    `- Status: pending`, `- Route: ${route}`, `- Seed: ${seed}`, `- Biography: ../runs/${baseName}.txt`, `- Archive: ../runs/${baseName}.json`, '',
    '## 审阅清单', '',
    '- [ ] 全文逐行阅读传记', '- [ ] 核对 JSON audit、最终 state、trace 与结局', '- [ ] 身份、路线、年龄与时间坐标一致',
    '- [ ] 等级/修为、魂环、剧情、神考与神位前置一致', '- [ ] 因果与任务顺序一致', '- [ ] 终局后无新事件',
    '- [ ] 无内部 ID 泄露、重复段落、空栏目或语义矛盾', '', '## 结论', '', '待审阅。', '',
  ].join('\n')
}

async function runBatch() {
  await requirePreviousGate()
  if (existsSync(batchDirectory)) throw new Error(`${batchName} 已存在；禁止覆盖或在一次调用中生成多批`)
  const manifest = await loadManifest()
  await Promise.all([mkdir(runsDirectory, { recursive: true }), mkdir(reviewsDirectory, { recursive: true }), mkdir(resolve(batchDirectory, 'findings'), { recursive: true })])
  const summaries = []
  for (let sample = 1; sample <= batchSize; sample += 1) {
    const route: Route = sample % 2 === 1 ? 'human' : 'beast'
    const seed = `${seedPrefix}-${batchName}-sample-${String(sample).padStart(2, '0')}`
    const result = simulateJourney(v03Content, v03Policies, { seed, route })
    const view = projectGameView(result.state, result.eventLog, v03Content)
    const biography = formatBiography(view)
    const baseName = `${String(sample).padStart(2, '0')}-${route}`
    await Promise.all([
      writeFile(resolve(runsDirectory, `${baseName}.txt`), `${biography}\n`),
      writeFile(resolve(runsDirectory, `${baseName}.json`), `${JSON.stringify({
        format: 'douluo-spin-v03-run', schemaVersion: 3, campaignId, generation, commit, contentVersion,
        batch: batchIndex, sample, route, seed, completed: result.completed, audit: result.audit,
        trace: result.trace, eventLog: result.eventLog, state: result.state,
      }, null, 2)}\n`),
      writeFile(resolve(reviewsDirectory, `${baseName}.md`), reviewTemplate(sample, route, seed, baseName)),
    ])
    summaries.push({ sample, route, seed, completed: result.completed, auditPassed: result.audit.passed, ending: result.state.ending?.endingId, turns: result.trace.length })
  }
  const automatedPassed = summaries.filter((entry) => entry.completed && entry.auditPassed).length
  const gate = {
    batch: batchIndex, status: 'analyzing-and-reviewing', commit, contentVersion,
    automatedAudit: { passed: automatedPassed, total: batchSize }, manualReview: { passed: 0, failed: 0, pending: batchSize },
    analysisCompleted: false, defectCount: 0, fixOutcome: null, regressionVerified: false, attempt: 1,
  }
  await Promise.all([
    writeFile(resolve(batchDirectory, 'gate.json'), `${JSON.stringify(gate, null, 2)}\n`),
    writeFile(resolve(batchDirectory, 'batch-report.json'), `${JSON.stringify({ batch: batchIndex, summaries }, null, 2)}\n`),
    writeFile(resolve(batchDirectory, 'batch-review.md'), `# ${batchName} 审阅\n\n- 自动审计：${automatedPassed}/${batchSize}\n- 人工审阅：0/${batchSize}\n- 结论：分析与逐份审阅中\n`),
  ])
  setManifestBatch(manifest, { index: batchIndex, status: gate.status, automatedPassed, manualPassed: 0 })
  await saveManifest(manifest)
  if (automatedPassed !== batchSize) throw new Error(`${batchName} 自动审计仅 ${automatedPassed}/${batchSize}，禁止关闭门禁`)
  console.log(`${batchName} 已生成：20 份传记、20 份 JSON、20 份 pending 审阅模板`)
}

function reviewStatus(value: string): 'passed' | 'failed' | 'pending' {
  const match = value.match(/^- Status:\s*(passed|failed|pending)\s*$/m)
  return (match?.[1] as 'passed' | 'failed' | 'pending' | undefined) ?? 'pending'
}

function reviewIsComplete(value: string): boolean {
  const checked = value.match(/^- \[[xX]\] /gm)?.length ?? 0
  const unchecked = value.match(/^- \[ \] /gm)?.length ?? 0
  const conclusion = value.split('## 结论')[1]?.trim() ?? ''
  return checked === 7 && unchecked === 0 && conclusion.length > 0 && !conclusion.includes('待审阅')
}

async function verifyGate() {
  const manifest = await loadManifest()
  const files = (await readdir(reviewsDirectory)).filter((file) => file.endsWith('.md')).sort()
  if (files.length !== batchSize) throw new Error(`审阅文件数量错误：${files.length}/${batchSize}`)
  const reviewContents = await Promise.all(files.map((file) => readFile(resolve(reviewsDirectory, file), 'utf8')))
  const statuses = reviewContents.map(reviewStatus)
  const passed = statuses.filter((status) => status === 'passed').length
  const failed = statuses.filter((status) => status === 'failed').length
  const pending = statuses.filter((status) => status === 'pending').length
  if (failed || pending || passed !== batchSize) throw new Error(`人工审阅未通过：passed=${passed}, failed=${failed}, pending=${pending}`)
  const incompleteReviews = files.filter((_, index) => !reviewIsComplete(reviewContents[index]!))
  if (incompleteReviews.length) throw new Error(`人工审阅清单或结论不完整：${incompleteReviews.join(', ')}`)

  const runFiles = (await readdir(runsDirectory)).sort()
  const biographies = runFiles.filter((file) => file.endsWith('.txt'))
  const archives = runFiles.filter((file) => file.endsWith('.json'))
  if (biographies.length !== batchSize || archives.length !== batchSize) {
    throw new Error(`运行产物数量错误：biographies=${biographies.length}, archives=${archives.length}, expected=${batchSize}`)
  }
  for (let index = 0; index < files.length; index += 1) {
    const baseName = files[index]!.replace(/\.md$/, '')
    if (!biographies.includes(`${baseName}.txt`) || !archives.includes(`${baseName}.json`)) throw new Error(`审阅与运行产物不匹配：${baseName}`)
    const biography = await readFile(resolve(runsDirectory, `${baseName}.txt`), 'utf8')
    const archive = JSON.parse(await readFile(resolve(runsDirectory, `${baseName}.json`), 'utf8')) as {
      generation?: string; commit?: string; contentVersion?: string; batch?: number; sample?: number; route?: Route; seed?: string
      completed?: boolean; audit?: { passed?: boolean }; state?: { ending?: unknown }; trace?: unknown[]
    }
    const expectedSample = index + 1
    const expectedRoute: Route = expectedSample % 2 === 1 ? 'human' : 'beast'
    const expectedSeed = `${seedPrefix}-${batchName}-sample-${String(expectedSample).padStart(2, '0')}`
    if (archive.generation !== generation || archive.commit !== commit || archive.contentVersion !== contentVersion || archive.batch !== batchIndex || archive.sample !== expectedSample || archive.route !== expectedRoute || archive.seed !== expectedSeed) {
      throw new Error(`归档身份字段不一致：${baseName}`)
    }
    if (!archive.completed || !archive.audit?.passed || !archive.state?.ending || !Array.isArray(archive.trace) || !biography.startsWith('# 无名旅者的人物传记')) {
      throw new Error(`归档或传记自动证据不完整：${baseName}`)
    }
  }
  const report = JSON.parse(await readFile(resolve(batchDirectory, 'batch-report.json'), 'utf8')) as { summaries: Array<{ completed: boolean; auditPassed: boolean }> }
  const automatedPassed = report.summaries.filter((entry) => entry.completed && entry.auditPassed).length
  if (automatedPassed !== batchSize) throw new Error(`自动审计未通过：${automatedPassed}/${batchSize}`)
  execFileSync('npm', ['run', 'test:verify'], { cwd: process.cwd(), stdio: 'inherit' })
  const gate = {
    batch: batchIndex, status: 'passed', commit, contentVersion,
    automatedAudit: { passed: automatedPassed, total: batchSize }, manualReview: { passed, failed, pending },
    analysisCompleted: true, defectCount: 0, fixOutcome: 'no-defect-confirmed', regressionVerified: true, attempt: 1,
  }
  await Promise.all([
    writeFile(resolve(batchDirectory, 'gate.json'), `${JSON.stringify(gate, null, 2)}\n`),
    writeFile(resolve(batchDirectory, 'batch-review.md'), `# ${batchName} 审阅\n\n- 自动审计：20/20\n- 人工审阅：20/20 passed\n- 缺陷：0\n- 结论：no-defect-confirmed\n- 回归：npm run test:verify 通过\n`),
  ])
  setManifestBatch(manifest, { index: batchIndex, status: 'passed', automatedPassed, manualPassed: passed })
  await saveManifest(manifest)
  const allPassed = manifest.batches.length === batchCount && manifest.batches.every((entry) => entry.status === 'passed')
  const totals = manifest.batches.reduce((value, entry) => ({ automated: value.automated + entry.automatedPassed, manual: value.manual + entry.manualPassed }), { automated: 0, manual: 0 })
  await Promise.all([
    writeFile(resolve(root, 'audit-report.md'), `# 自动审计\n\n- 已通过批次：${manifest.batches.filter((entry) => entry.status === 'passed').length}/${batchCount}\n- 已通过样本：${totals.automated}/${batchCount * batchSize}\n- 最终状态：${allPassed ? 'passed' : 'in-progress'}\n`),
    writeFile(resolve(root, 'manual-review-report.md'), `# 人工逐份审阅\n\n- 已通过：${totals.manual}/${batchCount * batchSize}\n- pending：${batchCount * batchSize - totals.manual}\n- failed：0\n- 最终状态：${allPassed ? 'passed' : 'in-progress'}\n`),
  ])
  console.log(`${batchName} 硬门禁已通过`)
}

await (action === 'run-batch' ? runBatch() : verifyGate())
