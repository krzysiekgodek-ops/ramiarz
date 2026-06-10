import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import {
  Bold, Italic, Underline as UnderlineIcon,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
} from "lucide-react";

// Style treści edytora — wspólne z widokiem (.help-content)
const EDITOR_STYLES = `
  .rich-editor .ProseMirror { outline: none; min-height: 8rem; }
  .rich-editor .ProseMirror:focus { outline: none; }
  .rich-editor .ProseMirror p { margin-bottom: 0.5rem; line-height: 1.7; }
  .rich-editor .ProseMirror h1 { font-size: 1.25rem; font-weight: 800; margin: 0.75rem 0 0.4rem; }
  .rich-editor .ProseMirror h2 { font-size: 1.05rem; font-weight: 700; margin: 0.6rem 0 0.3rem; }
  .rich-editor .ProseMirror ul { list-style: disc; padding-left: 1.5rem; margin: 0.5rem 0; }
  .rich-editor .ProseMirror ol { list-style: decimal; padding-left: 1.5rem; margin: 0.5rem 0; }
  .rich-editor .ProseMirror li { margin-bottom: 0.2rem; }
  .rich-editor .ProseMirror p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    color: var(--text-muted);
    float: left;
    height: 0;
    pointer-events: none;
  }
`;

function ToolBtn({ active, onClick, title, children }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
        active ? "bg-accent-500/20 text-accent-500" : "hover:bg-black/5 dark:hover:bg-white/5"
      }`}
      style={active ? undefined : { color: "var(--text-dim)" }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px self-stretch mx-0.5" style={{ background: "var(--border)" }} />;
}

export default function RichTextEditor({ value, onChange, placeholder = "Napisz treść…" }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { "data-placeholder": placeholder },
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || "", false);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!editor) return null;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
      <style>{EDITOR_STYLES}</style>
      <div className="flex flex-wrap items-center gap-0.5 p-2" style={{ borderBottom: "1px solid var(--border)" }}>
        <ToolBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Pogrubienie">
          <Bold size={14} />
        </ToolBtn>
        <ToolBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Kursywa">
          <Italic size={14} />
        </ToolBtn>
        <ToolBtn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Podkreślenie">
          <UnderlineIcon size={14} />
        </ToolBtn>

        <Divider />

        <ToolBtn active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Nagłówek H1">
          <span className="text-[11px] font-black">H1</span>
        </ToolBtn>
        <ToolBtn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Nagłówek H2">
          <span className="text-[11px] font-black">H2</span>
        </ToolBtn>

        <Divider />

        <ToolBtn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista punktowana">
          <List size={14} />
        </ToolBtn>
        <ToolBtn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerowana">
          <ListOrdered size={14} />
        </ToolBtn>

        <Divider />

        <ToolBtn active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Do lewej">
          <AlignLeft size={14} />
        </ToolBtn>
        <ToolBtn active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Wyśrodkuj">
          <AlignCenter size={14} />
        </ToolBtn>
        <ToolBtn active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} title="Do prawej">
          <AlignRight size={14} />
        </ToolBtn>
      </div>

      <EditorContent editor={editor} className="rich-editor p-4 text-sm" style={{ color: "var(--text)" }} />
    </div>
  );
}
