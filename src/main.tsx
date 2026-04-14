import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import './i18n'
import App from './App.tsx'
import { HomePage } from './pages/HomePage'
import { PDFToImage } from './pages/converters/PDFToImage'
import { CompressPDF } from './pages/converters/CompressPDF'
import { SplitPDF } from './pages/converters/SplitPDF'
import { MergePDF } from './pages/converters/MergePDF'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/editor" element={<App />} />
        <Route path="/convert/to-image" element={<PDFToImage />} />
        <Route path="/convert/compress" element={<CompressPDF />} />
        <Route path="/convert/split" element={<SplitPDF />} />
        <Route path="/convert/merge" element={<MergePDF />} />
      </Routes>
    </HashRouter>
  </StrictMode>,
)
