export function soften(text: string, enabled: boolean): string {
  if (!enabled) return text
  return text
    .replace(/卖屁股/g, '以不体面的方式谋生')
    .replace(/槽了/g, '侵犯')
    .replace(/从早配到晚/g, '遭到长期控制')
    .replace(/日日夜夜都在配你/g, '长期控制你')
    .replace(/精华/g, '力量')
    .replace(/魅魔/g, '魅惑体质')
}

export function safeFileName(value: string): string {
  return String(value || 'save').replace(/[\\/:*?"<>|]/g, '_').slice(0, 50)
}

export function downloadText(name: string, content: string, type = 'text/plain') {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([content], { type }))
  link.download = name
  document.body.appendChild(link)
  link.click()
  setTimeout(() => {
    URL.revokeObjectURL(link.href)
    link.remove()
  }, 0)
}
