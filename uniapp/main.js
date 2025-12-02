import { createSSRApp } from 'vue'
import App from './App.vue'

// Entry point for Vue 3 UniApp
export function createApp() {
  const app = createSSRApp(App)
  return {
    app
  }
}