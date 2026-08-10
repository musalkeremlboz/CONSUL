/// <reference types="vite/client" />

import type { ConsulApi } from '../../preload/index'

declare global {
  interface Window {
    consul: ConsulApi
  }
}

export {}
