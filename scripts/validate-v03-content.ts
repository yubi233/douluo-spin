import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { v03Content, v03ContentSource } from '@/content/v03/content'

const optionCount = [...v03Content.mechanics.pools.values()].reduce((sum, pool) => sum + pool.options.length, 0)
const options = v03ContentSource.pools.flatMap((pool) => pool.options)
const missingManifestFiles = v03ContentSource.manifest.files.filter((file) => !existsSync(resolve('src/content', file)))
const missingExplicitEffects = options.filter((option) => !Array.isArray(option.mechanics.effects)).map((option) => option.id)
const classification = {
  narrative: options.filter((option) => option.mechanics.effects.length === 0 && !option.mechanics.availableWhen && !option.mechanics.weightModifier).length,
  conditional: options.filter((option) => Boolean(option.mechanics.availableWhen)).length,
  dynamicWeight: options.filter((option) => Boolean(option.mechanics.weightModifier)).length,
  effectful: options.filter((option) => option.mechanics.effects.length > 0).length,
  pending: 0,
}
const report = {
  schemaVersion: v03Content.manifest.schemaVersion,
  contentVersion: v03Content.manifest.contentVersion,
  mechanicsFingerprint: v03Content.mechanics.fingerprint,
  pools: v03Content.mechanics.pools.size,
  options: optionCount,
  entities: v03Content.mechanics.entities.size,
  manifestFiles: v03ContentSource.manifest.files,
  missingManifestFiles,
  missingExplicitEffects,
  classification,
  status: missingManifestFiles.length || missingExplicitEffects.length || classification.pending ? 'failed' : 'passed',
}
const reportPath = 'test-results/iterations/v0.3/content-audit/report.json'
mkdirSync(dirname(reportPath), { recursive: true })
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
writeFileSync('test-results/iterations/v0.3/content-audit/report.md', [
  '# v0.3 内容审计', '',
  `- 状态：${report.status}`,
  `- 内容版本：${report.contentVersion}`,
  `- 机制指纹：${report.mechanicsFingerprint}`,
  `- 池/选项/实体：${report.pools}/${report.options}/${report.entities}`,
  `- 纯叙事/有条件/动态权重/有效果：${classification.narrative}/${classification.conditional}/${classification.dynamicWeight}/${classification.effectful}`,
  `- 待判定：${classification.pending}`,
  `- 缺失 manifest 文件：${missingManifestFiles.length}`,
  `- 缺失显式 effects：${missingExplicitEffects.length}`,
  '',
].join('\n'))
if (report.status !== 'passed') throw new Error(`v0.3 content audit failed: ${JSON.stringify(report)}`)
console.log(JSON.stringify(report, null, 2))
