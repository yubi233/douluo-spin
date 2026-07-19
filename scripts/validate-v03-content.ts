import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { v03Content, v03ContentSource } from '@/content/v03/content'

const optionCount = [...v03Content.mechanics.pools.values()].reduce((sum, pool) => sum + pool.options.length, 0)
const options = v03ContentSource.pools.flatMap((pool) => pool.options)
const missingManifestFiles = v03ContentSource.manifest.files.filter((file) => !existsSync(resolve('src/content', file)))
const missingExplicitEffects = options.filter((option) => !Array.isArray(option.mechanics.effects)).map((option) => option.id)
const migrationAuditPath = 'test-results/iterations/v0.3/legacy-migration/audit.json'
const recoveryLedgerPath = 'test-results/iterations/v0.3/legacy-migration/pool-recovery-ledger.json'
const migrationAudit = existsSync(migrationAuditPath)
  ? JSON.parse(readFileSync(migrationAuditPath, 'utf8')) as { unsupportedConstraints?: unknown[]; unresolvedStaticRules?: unknown[] }
  : null
const unresolvedConstraints = migrationAudit?.unsupportedConstraints?.length ?? 0
const unresolvedStaticRules = migrationAudit?.unresolvedStaticRules?.length ?? 0
const recoveryLedger = existsSync(recoveryLedgerPath)
  ? JSON.parse(readFileSync(recoveryLedgerPath, 'utf8')) as {
    summary?: { sourcePools?: number; sourceOptions?: number; sourceTags?: number; mappedPools?: number; mappedOptions?: number; mappedTags?: number }
    pools?: Array<{ activePoolId?: string | null; options?: Array<{ activeOptionId?: string | null; matches?: boolean }> }>
  }
  : null
const ledgerSummary = recoveryLedger?.summary
const ledgerFailures = [
  !recoveryLedger,
  ledgerSummary?.sourcePools !== 276,
  ledgerSummary?.sourceOptions !== 2500,
  ledgerSummary?.sourceTags !== 25,
  ledgerSummary?.mappedPools !== 276,
  ledgerSummary?.mappedOptions !== 2500,
  ledgerSummary?.mappedTags !== 25,
  recoveryLedger?.pools?.some((pool) => !pool.activePoolId || pool.options?.some((option) => !option.activeOptionId || !option.matches)) ?? true,
].filter(Boolean).length
const classification = {
  narrative: options.filter((option) => option.mechanics.effects.length === 0 && !option.mechanics.availableWhen && !option.mechanics.weightModifier).length,
  conditional: options.filter((option) => Boolean(option.mechanics.availableWhen)).length,
  dynamicWeight: options.filter((option) => Boolean(option.mechanics.weightModifier)).length,
  effectful: options.filter((option) => option.mechanics.effects.length > 0).length,
  pending: unresolvedConstraints + unresolvedStaticRules,
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
  migration: {
    auditPath: migrationAuditPath,
    recoveryLedgerPath,
    unresolvedConstraints,
    unresolvedStaticRules,
    ledgerFailures,
  },
  classification,
  status: missingManifestFiles.length || missingExplicitEffects.length || ledgerFailures ? 'failed' : classification.pending ? 'recovery-in-progress' : 'passed',
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
  `- 原版复杂条件待迁移：${unresolvedConstraints}`,
  `- 原版任务阶段待迁移：${unresolvedStaticRules}`,
  `- 原版恢复账本失败：${ledgerFailures}`,
  `- 缺失 manifest 文件：${missingManifestFiles.length}`,
  `- 缺失显式 effects：${missingExplicitEffects.length}`,
  '',
].join('\n'))
if (report.status === 'failed') throw new Error(`v0.3 content audit failed: ${JSON.stringify(report)}`)
console.log(JSON.stringify(report, null, 2))
