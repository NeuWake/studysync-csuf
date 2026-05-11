# Plan: Generate `_Instructions.docx`

Produce a downloadable Word document at `/mnt/documents/_Instructions.docx` describing how to install and run StudySync (the Lovable + Lovable Cloud app in this project).

## Formatting (per requirements)
- Filename: `_Instructions.docx` (leading underscore)
- Font: Arial 12pt (sans-serif), applied as default style
- Line spacing: double (480 twips)
- Margins: 2.54 cm / 1 inch on all sides (1440 DXA)
- Page size: US Letter (12240 × 15840 DXA)
- Footer: page number in lower-right corner (right-aligned `PageNumber.CURRENT`), shown on every page

## Content outline
1. **Title**: StudySync — Installation & Run Instructions
2. **Overview** — short description of the system (React + Vite frontend, Lovable Cloud / Supabase backend, optional Canvas LMS integration)
3. **Prerequisites**
   - Operating system: Windows 10+, macOS 12+, or Linux (Ubuntu 20.04+)
   - Node.js 18+ (or Bun 1.0+)
   - npm 9+ / bun
   - Modern browser (Chrome, Edge, Firefox, Safari latest)
   - Git
   - A Supabase / Lovable Cloud project (database engine: PostgreSQL 15, managed)
   - Optional: Canvas LMS access token for sync features
4. **Required environment variables** (`.env`)
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
5. **Installation steps**
   - Unzip the project
   - `cd` into the project folder
   - `npm install` (or `bun install`)
6. **Running locally**
   - `npm run dev` → open `http://localhost:8080`
7. **Building for production**
   - `npm run build` then `npm run preview`
8. **Using the deployed app**
   - Published URL: `https://studysync-csuf.lovable.app`
9. **First-time setup inside the app**
   - Sign up with email/password, complete Canvas onboarding (optional), start using Notes / Assignments / Calendar / Chat / Whiteboard
10. **Troubleshooting** — clear node_modules, verify `.env`, check Supabase project status

## Technical implementation
- Use the docx skill (`docx-js` via Node) to generate the file.
- Script location: `/tmp/gen_instructions.js`, output: `/mnt/documents/_Instructions.docx`.
- Set default style font Arial 12pt; paragraph spacing `{ line: 480, lineRule: "auto" }` for double spacing.
- Footer with right-aligned `TextRun({ children: [PageNumber.CURRENT] })`.
- After generation: validate via the skill's `validate_document.py`, then convert to PDF + render pages as images for QA inspection of margins, font, spacing, and footer page numbers. Fix and regenerate if issues found.
- Deliver via `<lov-artifact>` tag.

No project source files will be modified.
