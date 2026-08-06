import React from 'react'

export type CategoryId =
  | 'organize' | 'merge' | 'split' | 'extract'
  | 'compress' | 'to-image' | 'from-image'
  | 'watermark' | 'reverse'
  | 'to-word' | 'from-word' | 'to-excel' | 'page-numbers' | 'compare' | 'unlock'

export interface Category {
  id: CategoryId
  label: string
  desc: string
  icon: React.ReactNode
  color: string
}

export const CATEGORIES: Category[] = [
  { id: 'organize', label: 'ארגון דפים', desc: 'סובב, מחק, שכפל והוסף דפים', color: '#000000', icon: <OrganizeIcon /> },
  { id: 'merge', label: 'מיזוג', desc: 'אחד קבצי PDF לקובץ אחד', color: '#ef4444', icon: <MergeIcon /> },
  { id: 'split', label: 'פיצול', desc: 'פצל לדפים נפרדים', color: '#8b5cf6', icon: <SplitIcon /> },
  { id: 'extract', label: 'חילוץ דפים', desc: 'שמור טווח דפים כקובץ חדש', color: '#0ea5e9', icon: <ExtractIcon /> },
  { id: 'compress', label: 'קימפרוס', desc: 'הקטן את גודל הקובץ', color: '#f59e0b', icon: <CompressIcon /> },
  { id: 'watermark', label: 'סימן מים', desc: 'הוסף טקסט על כל הדפים', color: '#64748b', icon: <WatermarkIcon /> },
  { id: 'reverse', label: 'הפוך סדר', desc: 'הפוך את סדר הדפים', color: '#7c3aed', icon: <ReverseIcon /> },
  { id: 'to-image', label: 'PDF לתמונה', desc: 'ייצא דפים כ-PNG / JPG', color: '#10b981', icon: <ImageIcon /> },
  { id: 'from-image', label: 'תמונה ל-PDF', desc: 'צור PDF מתמונות', color: '#ec4899', icon: <FromImageIcon /> },
  { id: 'to-word', label: 'PDF לוורד', desc: 'ייצא את הטקסט כ-DOCX', color: '#2563eb', icon: <WordIcon /> },
  { id: 'from-word', label: 'וורד ל-PDF', desc: 'המר מסמך DOCX ל-PDF', color: '#1d4ed8', icon: <FromWordIcon /> },
  { id: 'to-excel', label: 'PDF לאקסל', desc: 'ייצא טבלאות כ-XLSX', color: '#16a34a', icon: <ExcelIcon /> },
  { id: 'page-numbers', label: 'מספור עמודים', desc: 'הוסף מספרי עמודים', color: '#0891b2', icon: <NumbersIcon /> },
  { id: 'compare', label: 'השוואת גרסאות', desc: 'מצא מה השתנה מול קובץ אחר', color: '#d97706', icon: <CompareIcon /> },
  { id: 'unlock', label: 'הסרת הגנה', desc: 'הסר סיסמה והגבלות מקובץ', color: '#059669', icon: <UnlockIcon /> },
]

function OrganizeIcon()   { return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg> }
function WatermarkIcon()  { return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 7l10 10M7 17L17 7" opacity="0.5"/><rect x="3" y="3" width="18" height="18" rx="2"/></svg> }
function ReverseIcon()    { return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16"/><path strokeLinecap="round" strokeLinejoin="round" d="M9 3l-5 4 5 4M15 13l5 4-5 4"/></svg> }
function WordIcon()       { return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z"/><path strokeLinecap="round" strokeLinejoin="round" d="M8.5 12l1.5 5 2-4 2 4 1.5-5"/></svg> }
function FromWordIcon()   { return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 11v6m0 0l-2.5-2.5M12 17l2.5-2.5"/></svg> }
function NumbersIcon()    { return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path strokeLinecap="round" d="M12 17h.01M9 7h6M9 11h6"/></svg> }
function UnlockIcon()     { return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="11" rx="2"/><path strokeLinecap="round" d="M8 10V7a4 4 0 017.5-2"/><path strokeLinecap="round" d="M12 14v3"/></svg> }
function CompareIcon()    { return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2.5" y="4" width="8" height="16" rx="1.5"/><rect x="13.5" y="4" width="8" height="16" rx="1.5"/><path strokeLinecap="round" d="M5 9h3M5 12h3M16 9h3M16 12h3M16 15h3"/></svg> }
function ExcelIcon()      { return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path strokeLinecap="round" d="M3 10h18M9 4v16"/><path strokeLinecap="round" d="M13 13l4 4m0-4l-4 4"/></svg> }
function MergeIcon()      { return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 8V5a2 2 0 012-2h6a2 2 0 012 2v3M9 21h6a2 2 0 002-2v-3M12 8v8M8 12h8" /></svg> }
function SplitIcon()      { return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M4 11h16M6 11v8a2 2 0 002 2h2M18 11v8a2 2 0 01-2 2h-2" /></svg> }
function ExtractIcon()    { return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-3-3v6M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" /></svg> }
function CompressIcon()   { return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 9L4 4m0 0v4m0-4h4M15 9l5-5m0 0v4m0-4h-4M9 15l-5 5m0 0v-4m0 4h4M15 15l5 5m0 0v-4m0 4h-4" /></svg> }
function ImageIcon()      { return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 15l-5-5L5 21" /></svg> }
function FromImageIcon()  { return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 4h6a2 2 0 012 2v6M4 8V6a2 2 0 012-2h2M4 14v4a2 2 0 002 2h4" /></svg> }
