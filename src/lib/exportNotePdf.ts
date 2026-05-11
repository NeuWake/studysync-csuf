// Convert TipTap JSON to printable HTML and trigger the browser print dialog
// so the user can save the note as a clean PDF.
export async function exportNoteToPdf(title: string, content: any) {
  const { Editor } = await import("@tiptap/react");
  const StarterKit = (await import("@tiptap/starter-kit")).default;
  const Underline = (await import("@tiptap/extension-underline")).default;
  const Link = (await import("@tiptap/extension-link")).default;

  const tmp = new Editor({
    extensions: [StarterKit, Underline, Link],
    content: content || { type: "doc", content: [] },
  });
  const bodyHtml = tmp.getHTML();
  tmp.destroy();

  const safeTitle = (title || "Untitled note").replace(/</g, "&lt;");
  const win = window.open("", "_blank");
  if (!win) {
    alert("Please allow popups to export this note.");
    return;
  }
  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${safeTitle}</title>
  <style>
    @page { size: A4; margin: 24mm 20mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #111;
      line-height: 1.6;
      font-size: 12pt;
      margin: 0;
      padding: 24px;
      background: #fff;
    }
    h1.note-title { font-size: 22pt; margin: 0 0 4px; }
    .note-meta { color: #666; font-size: 10pt; margin-bottom: 24px; }
    h1 { font-size: 18pt; margin: 18px 0 8px; }
    h2 { font-size: 15pt; margin: 16px 0 6px; }
    h3 { font-size: 13pt; margin: 14px 0 6px; }
    p { margin: 0 0 10px; }
    ul, ol { padding-left: 22px; margin: 0 0 10px; }
    blockquote {
      border-left: 3px solid #ccc;
      padding-left: 12px;
      color: #444;
      font-style: italic;
      margin: 0 0 12px;
    }
    code { background: #f4f4f5; padding: 1px 5px; border-radius: 3px; font-size: 0.95em; }
    pre {
      background: #f4f4f5;
      padding: 12px;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 10.5pt;
    }
    pre code { background: transparent; padding: 0; }
    a { color: #2563eb; text-decoration: underline; }
    img { max-width: 100%; height: auto; }
    hr { border: none; border-top: 1px solid #ddd; margin: 16px 0; }
  </style>
</head>
<body>
  <h1 class="note-title">${safeTitle}</h1>
  <div class="note-meta">Exported ${new Date().toLocaleString()}</div>
  ${bodyHtml}
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.focus(); window.print(); }, 100);
    });
  <\/script>
</body>
</html>`);
  win.document.close();
}
