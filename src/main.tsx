import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import App from './App.tsx'
import { HomePage } from './pages/HomePage'
import { QuickTools } from './pages/QuickTools'
import { ErrorBoundary } from './components/ui/ErrorBoundary'

// pdf.js v5 uses Map.prototype.getOrInsertComputed — a brand-new JS feature
// missing from Safari and slightly-older Chrome, where page rendering would
// crash outright. Tiny polyfills keep the viewer working everywhere.
for (const proto of [Map.prototype, WeakMap.prototype] as any[]) {
  if (!proto.getOrInsertComputed) {
    proto.getOrInsertComputed = function (key: unknown, cb: (k: unknown) => unknown) {
      if (!this.has(key)) this.set(key, cb(key))
      return this.get(key)
    }
  }
  if (!proto.getOrInsert) {
    proto.getOrInsert = function (key: unknown, value: unknown) {
      if (!this.has(key)) this.set(key, value)
      return this.get(key)
    }
  }
}

// Apply the saved theme before first paint — on every route, with no flash
if (localStorage.getItem('darkMode') === 'true') {
  document.documentElement.classList.add('dark')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/editor" element={<App />} />
          <Route path="/tools" element={<QuickTools />} />
          <Route path="/tools/:tool" element={<QuickTools />} />
          {/* Legacy converter URLs → the unified tools hub */}
          <Route path="/convert/to-image" element={<QuickTools />} />
          <Route path="/convert/compress" element={<QuickTools />} />
          <Route path="/convert/split" element={<QuickTools />} />
          <Route path="/convert/merge" element={<QuickTools />} />
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  </StrictMode>,
)
