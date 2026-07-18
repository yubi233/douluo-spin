import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, relative } from 'node:path'

const sourceRoot = 'src'
const reportPath = 'test-results/iterations/v0.3/architecture-audit/report.json'
const sourceExtensions = new Set(['.ts', '.vue', '.json'])
const forbidden = [
  { code: 'legacy-domain-import', pattern: /(?:@\/|\.\.?\/)domain\// },
  { code: 'legacy-wheel-source', pattern: /wheels\.json/ },
  { code: 'legacy-save-key', pattern: /douluo-spin-vue-v1/ },
  { code: 'legacy-override-key', pattern: /douluo-wheel-overrides-v1/ },
  { code: 'runtime-text-parser', pattern: /parse(?:Option|Result|Effect|Condition)Text/ },
]

function files(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    return statSync(path).isDirectory() ? files(path) : sourceExtensions.has(extname(path)) ? [path] : []
  })
}

const issues = files(sourceRoot).flatMap((path) => {
  if (path.endsWith('legacyContent.generated.json')) return []
  const source = readFileSync(path, 'utf8')
  return forbidden.flatMap(({ code, pattern }) => pattern.test(source) ? [{ file: relative('.', path), code }] : [])
})

const report = {
  checkedAt: new Date().toISOString(),
  entry: 'src/main.ts',
  checkedFiles: files(sourceRoot).length,
  forbiddenRules: forbidden.map(({ code }) => code),
  issues,
  status: issues.length ? 'failed' : 'passed',
}
mkdirSync(dirname(reportPath), { recursive: true })
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
if (issues.length) throw new Error(`v0.3 production architecture validation failed: ${JSON.stringify(issues)}`)
console.log(`v0.3 architecture valid: ${report.checkedFiles} source files, no legacy runtime dependency`)
