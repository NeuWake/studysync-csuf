import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Code,
  Undo,
  Redo,
  Link as LinkIcon,
} from "lucide-react";

interface NoteEditorProps {
  content: any;
  editable?: boolean;
  onChange?: (json: any) => void;
}

export function NoteEditor({ content, editable = true, onChange }: NoteEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({ placeholder: "Start typing your note..." }),
      Link.configure({ openOnClick: true, autolink: true, HTMLAttributes: { class: "text-primary underline" } }),
    ],
    content: content || { type: "doc", content: [] },
    editable,
    onUpdate: ({ editor }) => onChange?.(editor.getJSON()),
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none min-h-[300px] focus:outline-none px-4 py-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:italic [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded",
      },
    },
  });

  // Sync external content (e.g. realtime updates) without losing focus when unchanged
  useEffect(() => {
    if (!editor || !content) return;
    const current = JSON.stringify(editor.getJSON());
    const incoming = JSON.stringify(content);
    if (current !== incoming) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      {editable && (
        <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/30 px-2 py-1.5">
          <Toggle size="sm" pressed={editor.isActive("bold")} onPressedChange={() => editor.chain().focus().toggleBold().run()}>
            <Bold className="h-4 w-4" />
          </Toggle>
          <Toggle size="sm" pressed={editor.isActive("italic")} onPressedChange={() => editor.chain().focus().toggleItalic().run()}>
            <Italic className="h-4 w-4" />
          </Toggle>
          <Toggle size="sm" pressed={editor.isActive("underline")} onPressedChange={() => editor.chain().focus().toggleUnderline().run()}>
            <UnderlineIcon className="h-4 w-4" />
          </Toggle>
          <Toggle size="sm" pressed={editor.isActive("strike")} onPressedChange={() => editor.chain().focus().toggleStrike().run()}>
            <Strikethrough className="h-4 w-4" />
          </Toggle>
          <div className="w-px h-5 bg-border mx-1" />
          <Toggle size="sm" pressed={editor.isActive("heading", { level: 1 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
            <Heading1 className="h-4 w-4" />
          </Toggle>
          <Toggle size="sm" pressed={editor.isActive("heading", { level: 2 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 className="h-4 w-4" />
          </Toggle>
          <Toggle size="sm" pressed={editor.isActive("bulletList")} onPressedChange={() => editor.chain().focus().toggleBulletList().run()}>
            <List className="h-4 w-4" />
          </Toggle>
          <Toggle size="sm" pressed={editor.isActive("orderedList")} onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}>
            <ListOrdered className="h-4 w-4" />
          </Toggle>
          <Toggle size="sm" pressed={editor.isActive("blockquote")} onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}>
            <Quote className="h-4 w-4" />
          </Toggle>
          <Toggle size="sm" pressed={editor.isActive("codeBlock")} onPressedChange={() => editor.chain().focus().toggleCodeBlock().run()}>
            <Code className="h-4 w-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive("link")}
            onPressedChange={() => {
              const prev = editor.getAttributes("link").href as string | undefined;
              const url = window.prompt("URL", prev || "https://");
              if (url === null) return;
              if (url === "") editor.chain().focus().unsetLink().run();
              else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
            }}
          >
            <LinkIcon className="h-4 w-4" />
          </Toggle>
          <div className="ml-auto flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => editor.chain().focus().undo().run()}>
              <Undo className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => editor.chain().focus().redo().run()}>
              <Redo className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
