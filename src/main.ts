import { createApp } from 'vue'
import App from './App.vue'
import './styles.css'

const app = createApp(App)

// 全局涟漪效果：记录点击位置到 CSS 自定义属性
document.addEventListener('pointerdown', (event) => {
  const target = (event.target as HTMLElement).closest('.button, .icon-button, .wheel-trigger')
  if (!target) return
  const rect = target.getBoundingClientRect()
  const x = ((event.clientX - rect.left) / rect.width * 100).toFixed(1)
  const y = ((event.clientY - rect.top) / rect.height * 100).toFixed(1)
  ;(target as HTMLElement).style.setProperty('--ripple-x', `${x}%`)
  ;(target as HTMLElement).style.setProperty('--ripple-y', `${y}%`)
})

app.mount('#app')
