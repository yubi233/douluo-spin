import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

async function recordFlow(page: Page, testInfo: TestInfo) {
  const frames = testInfo.outputPath('screencast-frames')
  const video = testInfo.outputPath(`${testInfo.project.name}-v03-flow.mp4`)
  await mkdir(frames, { recursive: true })
  const session = await page.context().newCDPSession(page)
  const writes: Promise<void>[] = []
  let frame = 0
  session.on('Page.screencastFrame', ({ data, sessionId }) => {
    frame += 1
    writes.push(writeFile(`${frames}/frame-${String(frame).padStart(4, '0')}.jpg`, Buffer.from(data, 'base64')))
    void session.send('Page.screencastFrameAck', { sessionId })
  })
  await session.send('Page.startScreencast', { format: 'jpeg', quality: 65, maxWidth: 1366, maxHeight: 844, everyNthFrame: 2 })
  return async () => {
    await session.send('Page.stopScreencast')
    await Promise.all(writes)
    if (!frame) return
    await execFileAsync('/opt/homebrew/bin/ffmpeg', ['-y', '-framerate', '6', '-i', `${frames}/frame-%04d.jpg`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', video])
    await testInfo.attach(`${testInfo.project.name}-v03-flow`, { path: video, contentType: 'video/mp4' })
  }
}

async function start(page: Page, route: 'human' | 'beast', seed: string) {
  await expect(page).toHaveTitle(/斗罗大陆.*命运轮盘/)
  await page.locator('.seed-field input').fill(seed)
  await page.getByRole('button', { name: route === 'human' ? '人类魂师' : '魂兽肉鸽' }).click()
  await expect(page.getByRole('dialog', { name: '选择起始路线' })).toBeHidden()
  await expect(page.locator('.task-header h2')).not.toHaveText('展开下一段命运')
}

async function speedUp(page: Page) {
  await page.locator('summary').click()
  await page.locator('input[type="range"]').fill('100')
  await page.locator('summary').click()
}

async function spinOnce(page: Page) {
  await page.getByRole('button', { name: '转动命运轮盘' }).click()
  await expect(page.locator('.result-panel small')).toContainText(/第 \d+ 次投掷/, { timeout: 5_000 })
}

async function openMenu(page: Page) { await page.getByRole('button', { name: '更多操作' }).click() }

test('desktop: v0.3 receipt, deterministic undo, save and pure narrative editor', async ({ page }, testInfo) => {
  await page.goto('/')
  const stopRecording = await recordFlow(page, testInfo)
  try {
    await start(page, 'human', 'v03-human-2')
    await speedUp(page)

    await spinOnce(page)
    const firstResult = await page.locator('.result-panel p').textContent()
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('douluo-spin-vue-v3') ?? '{}'))
    expect(stored).toMatchObject({ format: 'douluo-spin-event-log', schemaVersion: 3, contentVersion: 'v0.3.5' })
    expect(stored.batches).toHaveLength(2)

    await page.locator('.advanced-section > summary').click()
    const browser = page.locator('.pool-browser')
    await browser.locator('select').first().selectOption({ label: '原版迁移内容' })
    await browser.locator('select').nth(1).selectOption('pool.legacy.7ba36261-846a-4e5b-bdcf-8e0612794350')
    await browser.getByRole('button', { name: '投掷当前池' }).click()
    await expect(browser.locator('.pool-result small')).toContainText('等级')
    await page.locator('.advanced-section > summary').click()

    await page.reload()
    await expect(page.locator('.result-panel p')).toHaveText(firstResult ?? '')

    await page.getByRole('button', { name: /返回/ }).click()
    await spinOnce(page)
    await expect(page.locator('.result-panel p')).toHaveText(firstResult ?? '')
    await page.getByLabel('进入下一项').click()

    await page.getByRole('button', { name: '修改' }).click()
    await page.getByRole('button', { name: '增加纯叙事事件' }).click()
    const added = page.locator('.editor-row').last()
    await added.locator('textarea').fill('等级+99并死亡，但这只是展示文案')
    await added.locator('input[type="number"]').fill('2')
    await page.getByRole('button', { name: '校验并应用' }).click()
    await expect(page.locator('.wheel-editor')).toBeHidden()
    await openMenu(page)
    const patchDownload = page.waitForEvent('download')
    await page.getByRole('menuitem', { name: /导出当前修改/ }).click()
    const patch = await patchDownload
    const patchPath = await patch.path()
    const patchPayload = JSON.parse(patchPath ? await readFile(patchPath, 'utf8') : '{}')
    const narrative = patchPayload.patches[0].options.find((option: { name: string }) => option.name.includes('等级+99'))
    expect(narrative.effects).toEqual([])

    await openMenu(page)
    const saveDownload = page.waitForEvent('download')
    await page.getByRole('menuitem', { name: '导出存档' }).click()
    const save = await saveDownload
    const savePath = await save.path()
    const savePayload = JSON.parse(savePath ? await readFile(savePath, 'utf8') : '{}')
    expect(savePayload).toMatchObject({ format: 'douluo-spin-event-log', schemaVersion: 3 })
    expect(savePayload.checksum).toMatch(/^[a-f0-9]{8}$/)
    await page.screenshot({ path: testInfo.outputPath('desktop-v03.png'), fullPage: true })
  } finally {
    await stopRecording()
  }
})

test('desktop: complete inherited god-trial journey in the real UI', async ({ page }) => {
  await page.goto('/')
  await start(page, 'human', 'v03-human-2')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: '极速结算' }).click()
  await expect(page.locator('.ending-banner')).toContainText('百级成神', { timeout: 20_000 })
  await expect(page.getByText('9枚魂环')).toBeVisible()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('douluo-spin-vue-v3') ?? '{}'))
  expect(saved.batches.at(-1).events.some((event: { type: string }) => event.type === 'run.finished')).toBe(true)
})

test('desktop: lethal human and untransformed beast journeys reach distinct terminal states', async ({ page }) => {
  await page.goto('/')
  await start(page, 'human', 'v03-human-28')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: '极速结算' }).click()
  await expect(page.locator('.ending-banner')).toContainText('命运断绝', { timeout: 20_000 })
  await expect(page.locator('.character-summary')).toContainText('已陨落')

  await page.getByRole('button', { name: '新命运' }).click()
  await page.locator('.seed-field input').fill('v03-beast-2')
  await page.getByRole('button', { name: '魂兽肉鸽' }).click()
  await expect(page.getByRole('dialog', { name: '选择起始路线' })).toBeHidden()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: '极速结算' }).click()
  await expect(page.locator('.ending-banner')).toContainText('兽域飞升', { timeout: 20_000 })
  await expect(page.locator('.character-summary')).toContainText('魂兽')
})

test('desktop: structured editor previews and imports two-pool patches', async ({ page }) => {
  await page.goto('/')
  await start(page, 'human', 'v03-editor-structured')
  await speedUp(page)

  await page.getByRole('button', { name: '修改' }).click()
  const firstOption = page.locator('.editor-row').first()
  await firstOption.locator('.mechanics-editor > summary').click()
  await firstOption.getByRole('button', { name: '增加条件' }).click()
  await firstOption.locator('.predicate-editor input').fill('99')
  await firstOption.getByRole('button', { name: '增加效果' }).click()
  await expect(firstOption.locator('.editor-probability')).toHaveText('当前不可抽')
  await page.getByRole('button', { name: '校验并应用' }).click()
  await expect(page.locator('.wheel-editor')).toBeHidden()

  await spinOnce(page)
  await page.getByLabel('进入下一项').click()
  await page.getByRole('button', { name: '修改' }).click()
  await page.getByRole('button', { name: '增加纯叙事事件' }).click()
  const narrative = page.locator('.editor-row').last()
  await narrative.locator('textarea').fill('这是独立的纯叙事事件')
  await page.getByRole('button', { name: '校验并应用' }).click()

  await openMenu(page)
  const patchDownload = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: /导出当前修改/ }).click()
  const patch = await patchDownload
  const patchPath = await patch.path()
  expect(patchPath).toBeTruthy()
  const document = JSON.parse(await readFile(patchPath!, 'utf8'))
  expect(document.patches).toHaveLength(2)
  const gender = document.patches.find((entry: { poolId: string }) => entry.poolId === 'pool.setup.gender')
  expect(gender.options[0]).toMatchObject({ availableWhen: { type: 'compare', value: 99 } })
  expect(gender.options[0].effects.some((effect: { type: string }) => effect.type === 'stat.change')).toBe(true)
  const appearance = document.patches.find((entry: { poolId: string }) => entry.poolId === 'pool.setup.appearance')
  expect(appearance.options.at(-1)).toMatchObject({ name: '这是独立的纯叙事事件', effects: [] })

  page.once('dialog', (dialog) => dialog.accept())
  await openMenu(page)
  await page.getByRole('menuitem', { name: /清除全部转盘修改/ }).click()
  await page.getByLabel('导入转盘覆盖文件').setInputFiles(patchPath!)
  await expect(page.getByRole('status')).toContainText('转盘修改导入成功')
  await page.getByRole('button', { name: '修改' }).click()
  await expect(page.locator('.editor-row').last().locator('textarea')).toHaveValue('这是独立的纯叙事事件')
})

test('mobile: beast transforms, finishes, supports tabs and has no horizontal overflow', async ({ page }, testInfo) => {
  await page.goto('/')
  const stopRecording = await recordFlow(page, testInfo)
  try {
    await start(page, 'beast', 'v03-beast-1')
    await expect(page.getByRole('tab', { name: '主舞台' })).toHaveAttribute('aria-selected', 'true')
    await page.getByRole('tab', { name: '主舞台' }).press('ArrowRight')
    await expect(page.getByRole('tab', { name: '角色' })).toHaveAttribute('aria-selected', 'true')
    await page.getByRole('tab', { name: '主舞台' }).click()
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: '极速结算' }).click()
    await expect(page.locator('.ending-banner')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('.character-summary')).toContainText('化形魂师')
    const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, viewport: window.innerWidth }))
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.viewport)
    await page.screenshot({ path: testInfo.outputPath('mobile-transformed-v03.png'), fullPage: true })
  } finally {
    await stopRecording()
  }
})

test('mobile: structured editor controls fit the viewport and keep focus semantics', async ({ page }, testInfo) => {
  await page.goto('/')
  await start(page, 'human', 'v03-editor-mobile')
  await page.getByRole('button', { name: '修改', exact: true }).click()
  const editor = page.getByRole('dialog', { name: /基础设定/ })
  await expect(editor).toBeFocused()
  const firstOption = page.locator('.editor-row').first()
  await firstOption.locator('.mechanics-editor > summary').click()
  await firstOption.getByRole('button', { name: '增加条件' }).click()
  await firstOption.getByRole('button', { name: '增加效果' }).click()
  const dimensions = await editor.evaluate((element) => ({ scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
  await page.screenshot({ path: testInfo.outputPath('mobile-structured-editor-v03.png'), fullPage: true })
})

test('desktop: responsive viewport matrix keeps the primary controls visible', async ({ page }) => {
  await page.goto('/')
  await start(page, 'human', 'responsive-v03')
  for (const viewport of [
    { width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 },
    { width: 1024, height: 768 }, { width: 1366, height: 768 }, { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport)
    const target = viewport.width <= 760 ? 'mobile' : 'desktop'
    if (await page.locator('.app-shell').getAttribute('data-layout') !== target) {
      await page.getByRole('button', { name: target === 'mobile' ? '切换为移动端布局' : '切换为 PC 布局' }).click()
    }
    await expect(page.getByRole('button', { name: '转动命运轮盘' })).toBeVisible()
    const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, viewport: window.innerWidth }))
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.viewport)
  }
})
