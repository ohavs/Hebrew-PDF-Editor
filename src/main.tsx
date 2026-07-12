import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import App from './App.tsx'
import { HomePage } from './pages/HomePage'
import { QuickTools } from './pages/QuickTools'
import { ErrorBoundary } from './components/ui/ErrorBoundary'

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
