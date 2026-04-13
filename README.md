# עורך PDF עברי — Hebrew PDF Editor

עורך PDF מתקדם עם תמיכה מלאה בעברית | Advanced PDF Editor with full Hebrew/RTL support

---

## ✨ תכונות | Features

### עיון וניווט | Viewing & Navigation
- רינדור PDF באיכות גבוהה דרך PDF.js
- סרגל תמונות ממוזערות עם גרירה לשינוי סדר
- ניווט בין דפים (קודם/הבא, קפיצה לדף)
- זום: הגדל/הקטן, התאם לרוחב, התאם לדף, קלט אחוז
- מצבי תצוגה: דף יחיד / גלילה רציפה / שני דפים
- מצב מסך מלא
- קיצורי מקלדת (חצים, +-/-, Ctrl+Z/Y)

### עריכת טקסט עברי | Hebrew Text Editing
- הוספת תיבות טקסט בכל מקום על הדף
- זיהוי אוטומטי RTL/LTR לפי תו ראשון
- בחירת גופן עברי: Heebo, Frank Ruhl Libre, Noto Sans Hebrew, Assistant
- גודל, מודגש, נטוי, קו תחתון, צבע
- יישור: ימין (ברירת מחדל לעברית), שמאל, מרכז, שורה
- bidi מוטמע (עברית + אנגלית באותה שורה)
- גרירה לשינוי מיקום, ידיות לשינוי גודל, מחיקה

### הערות ומיסוך | Annotations & Markup
- **הדגשה**: צהוב/ירוק/ורוד/כחול, מחוון שקיפות
- **קו תחתון** ו-**קו חוצה** על בחירות טקסט
- **פתקים דביקים**: עם שם מחבר + חותמת זמן
- **ציור חופשי**: צבע, עובי, שקיפות
- **צורות**: מלבן, עגול, קו, חץ — מילוי + מסגרת
- **חותמות**: אושר / טיוטה / סודי / התקבל / בוטל / דחוף + מותאם אישית
- **מחק** להסרת הערות
- פנל הערות: רשימה, לחץ לניווט, מחיקה
- ביטול/חזרה עד 50 שלבים (Ctrl+Z / Ctrl+Y)

### טפסים וחתימה | Forms & Signature
- מילוי שדות טקסט, תיבות סימון, תאריכים, רשימות
- הוספת שדות טופס ידנית
- לוח חתימה: ציור עם אצבע/עכבר
- העלאת תמונת חתימה
- חתימה מוקלדת עם גופני כתב יד
- מיקום חתימה בכל מקום על הדף
- יצוא נתוני טופס כ-JSON / CSV

### ניהול דפים | Page Management
- גרירה לשינוי סדר דפים
- מחיקת דף עם אישור
- שכפול דף
- הוספת דף ריק (A4/Letter)
- חילוץ דף כ-PDF חדש
- מיזוג PDF נוסף
- סיבוב 90°/180°

---

## 🚀 התקנה והפעלה | Setup & Run

### דרישות | Requirements
- Node.js 18+
- npm 9+

### התקנה | Installation

```bash
npm install
```

### פיתוח | Development

```bash
npm run dev
```

Open in browser: `http://localhost:5173`

### בנייה לייצור | Production Build

```bash
npm run build
npm run preview
```

---

## 🌐 PWA Installation

The app can be installed as a PWA:
- Open in Chrome/Safari
- Click "Install App" in the address bar
- Works offline after installation

---

## ⌨️ קיצורי מקלדת | Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `←/→` | Previous/Next page |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl++/-` | Zoom in/out |
| `Ctrl+0` | Zoom 100% |
| `V` | Select tool |
| `T` | Text tool |
| `H` | Highlight tool |
| `D` | Free draw |
| `S` | Shapes |
| `N` | Sticky note |
| `Esc` | Select tool |
| `Delete` | Delete selected annotation |

---

## 🛠️ Tech Stack

| Layer | Library |
|-------|---------|
| Frontend | React 18 + TypeScript + Vite |
| PDF Rendering | PDF.js (pdfjs-dist v5) |
| PDF Manipulation | pdf-lib |
| Drawing | HTML5 Canvas |
| Signature | react-signature-canvas |
| State Management | Zustand |
| Styling | Tailwind CSS v4 |
| i18n | react-i18next (Hebrew default) |
| PWA | vite-plugin-pwa (Workbox) |
| Date Utils | date-fns |

---

## 📁 Project Structure

```
src/
  components/
    viewer/        # PDF canvas, annotation layer
    toolbar/       # Top, side, bottom toolbars
    panels/        # Thumbnails, annotations list, properties, forms
    tools/         # Text, draw, shapes, sticky, stamp, signature
    ui/            # Toast, Settings modal
  hooks/           # usePDF, useKeyboard, useAutoSave
  store/           # Zustand slices: pdf, annotations, ui
  utils/           # pdfExport, textUtils, hebrewDate
  i18n/            # he.json, en.json translations
```

---

## 📱 Mobile Support

- Touch-first UI with pinch-to-zoom
- Two-finger pan
- Bottom toolbar on mobile
- Signature pad works with finger
- Camera file input (iOS/Android)
- Responsive: mobile / tablet / desktop

---

## 🌙 Themes

- **Light** (default) / **Dark** — toggle in top toolbar
- All UI colors via CSS custom properties

---

## 📄 License

MIT — free to use and modify.

---

Built with love for the Hebrew-speaking world | נבנה עם אהבה לדוברי עברית
