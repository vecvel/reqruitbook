"use client";

import React, { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Type,
  Eraser,
  Undo2,
  Redo2,
  ExternalLink,
  Link2,
  Link2Off,
  Minimize2,
  Quote,
} from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

export interface RichTextEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  /** Height of the editing canvas when not in external mode. */
  minHeight?: number;
  /** Extra tokens rendered as one-click insert chips above the toolbar. */
  placeholders?: { token: string; label: string }[];
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Start writing...",
  className,
  minHeight = 220,
  placeholders,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [htmlContent, setHtmlContent] = useState(value);
  const [isCodeView, setIsCodeView] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 900, height: 600 });
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  // Centre the floating window whenever external mode is entered
  useEffect(() => {
    if (isFullscreen && typeof window !== "undefined") {
      const w = Math.min(950, window.innerWidth - 40);
      const h = Math.min(650, window.innerHeight - 80);
      setDimensions({ width: w, height: h });
      setPosition({
        x: (window.innerWidth - w) / 2,
        y: (window.innerHeight - h) / 2,
      });
      setIsMaximized(false);
    } else {
      setIsMaximized(false);
      setIsDragging(false);
    }
  }, [isFullscreen]);

  // Shift+F toggles external mode; Shift+F then M / N,R maximizes / restores
  const isFPressed = useRef(false);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isEditable =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      const key = e.key.toLowerCase();

      if (key === "f") isFPressed.current = true;

      if (isFullscreen && e.shiftKey && isFPressed.current) {
        if (key === "m") {
          e.preventDefault();
          setIsMaximized(true);
          return;
        }
        if (key === "n" || key === "r") {
          e.preventDefault();
          setIsMaximized(false);
          return;
        }
      }

      if (
        !isEditable &&
        e.shiftKey &&
        key === "f" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        setIsFullscreen((prev) => !prev);
        return;
      }

      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && e.shiftKey && key === "f") {
        e.preventDefault();
        setIsFullscreen((prev) => !prev);
      }
    };

    const handleGlobalKeyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "f") isFPressed.current = false;
    };

    const handleBlur = () => {
      isFPressed.current = false;
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    window.addEventListener("keyup", handleGlobalKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
      window.removeEventListener("keyup", handleGlobalKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [isFullscreen]);

  const handleHeaderDoubleClick = () => {
    if (!isFullscreen) return;
    setIsMaximized((prev) => !prev);
  };

  const handleDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isFullscreen || isMaximized) return;
    if (
      (e.target as HTMLElement).closest("button") ||
      (e.target as HTMLElement).closest("input") ||
      (e.target as HTMLElement).closest("select")
    ) {
      return;
    }

    const clickX = e.clientX;
    const clickY = e.clientY;
    const startX = e.clientX - position.x;
    const startY = e.clientY - position.y;
    let dragActivated = false;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = Math.abs(moveEvent.clientX - clickX);
      const deltaY = Math.abs(moveEvent.clientY - clickY);

      // Only treat it as a drag once the pointer travels past 3px
      if (!dragActivated && (deltaX > 3 || deltaY > 3)) {
        dragActivated = true;
        setIsDragging(true);
      }

      if (dragActivated) {
        setPosition({ x: moveEvent.clientX - startX, y: moveEvent.clientY - startY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const [activeStyles, setActiveStyles] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    unorderedList: false,
    orderedList: false,
    alignLeft: false,
    alignCenter: false,
    alignRight: false,
    h1: false,
    h2: false,
    h3: false,
    blockquote: false,
  });

  // Keep the contentEditable DOM in sync with the controlled prop
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
    setHtmlContent(value || "");
  }, [value]);

  const updateToolbarStates = () => {
    if (typeof document === "undefined" || typeof window === "undefined") return;

    const selection = window.getSelection();
    const container = editorRef.current;
    if (!selection || selection.rangeCount === 0 || !container) return;

    const range = selection.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) {
      setActiveStyles((prev) => ({
        ...prev,
        bold: false,
        italic: false,
        underline: false,
        strikeThrough: false,
        unorderedList: false,
        orderedList: false,
        alignLeft: true,
        alignCenter: false,
        alignRight: false,
        h1: false,
        h2: false,
        h3: false,
        blockquote: false,
      }));
      return;
    }

    const queryState = (command: string) => {
      try {
        return document.queryCommandState(command);
      } catch {
        return false;
      }
    };

    const queryValue = (command: string) => {
      try {
        return document.queryCommandValue(command);
      } catch {
        return "";
      }
    };

    const blockType = (queryValue("formatBlock") || "").toLowerCase();

    setActiveStyles({
      bold: queryState("bold"),
      italic: queryState("italic"),
      underline: queryState("underline"),
      strikeThrough: queryState("strikeThrough"),
      unorderedList: queryState("insertUnorderedList"),
      orderedList: queryState("insertOrderedList"),
      alignLeft:
        queryState("justifyLeft") ||
        (!queryState("justifyCenter") && !queryState("justifyRight")),
      alignCenter: queryState("justifyCenter"),
      alignRight: queryState("justifyRight"),
      h1: blockType === "h1" || blockType === "heading 1",
      h2: blockType === "h2" || blockType === "heading 2",
      h3: blockType === "h3" || blockType === "heading 3",
      blockquote: blockType === "blockquote",
    });
  };

  useEffect(() => {
    const handleSelectionChange = () => updateToolbarStates();
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  const handleInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setHtmlContent(html);
      onChange(html);
      updateToolbarStates();
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setHtmlContent(val);
    onChange(val);
    if (editorRef.current) editorRef.current.innerHTML = val;
  };

  const execCommand = (command: string, arg: string = "") => {
    if (editorRef.current) editorRef.current.focus();
    document.execCommand(command, false, arg);
    handleInput();
  };

  const handleInsertLink = () => {
    const url = window.prompt("Enter the destination URL", "https://");
    if (!url || url === "https://") return;
    execCommand("createLink", url);
  };

  /** Drop a template token at the caret (or append when unfocused). */
  const insertToken = (token: string) => {
    if (isCodeView) {
      const next = `${htmlContent}${token}`;
      setHtmlContent(next);
      onChange(next);
      return;
    }
    if (editorRef.current) editorRef.current.focus();
    document.execCommand("insertText", false, token);
    handleInput();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const isMeta = e.metaKey || e.ctrlKey;
    if (!isMeta) return;
    const key = e.key.toLowerCase();

    if (key === "b") {
      e.preventDefault();
      execCommand("bold");
    } else if (key === "i") {
      e.preventDefault();
      execCommand("italic");
    } else if (key === "u") {
      e.preventDefault();
      execCommand("underline");
    } else if (key === "k") {
      e.preventDefault();
      handleInsertLink();
    } else if (key === "z") {
      e.preventDefault();
      execCommand(e.shiftKey ? "redo" : "undo");
    } else if (key === "y") {
      e.preventDefault();
      execCommand("redo");
    }
  };

  const ToolbarButton = ({
    onClick,
    icon: Icon,
    title,
    active = false,
  }: {
    onClick: () => void;
    icon: React.ElementType;
    title: string;
    active?: boolean;
  }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className={cn(
            "p-1.5 rounded-xs text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors shrink-0 cursor-pointer",
            active && "bg-copper/15 text-copper font-bold hover:bg-copper/20"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="sr-only">{title}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="bg-popover text-popover-foreground text-[10px] py-1 px-2 border border-border shadow-md"
      >
        {title}
      </TooltipContent>
    </Tooltip>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <div
        className={cn(
          "border border-border bg-card flex flex-col transition-shadow duration-200",
          isFullscreen ? "fixed z-50 shadow-2xl" : "relative flex-1 rounded-xs",
          isFullscreen && isMaximized ? "rounded-none" : "rounded-xs",
          className
        )}
        style={
          isFullscreen
            ? isMaximized
              ? {
                  top: 0,
                  left: 0,
                  width: "100vw",
                  height: "100vh",
                  minWidth: "280px",
                  minHeight: "280px",
                  overflow: "hidden",
                }
              : {
                  top: `${position.y}px`,
                  left: `${position.x}px`,
                  width: `${dimensions.width}px`,
                  height: `${dimensions.height}px`,
                  minWidth: "280px",
                  minHeight: "280px",
                  resize: "both",
                  overflow: "hidden",
                }
            : { minHeight }
        }
      >
        {/* Toolbar — doubles as the drag handle in external mode */}
        <div
          onMouseDown={handleDragStart}
          onDoubleClick={handleHeaderDoubleClick}
          className={cn(
            "flex flex-wrap items-center gap-0.5 bg-muted/40 border-b border-border px-2 py-1.5 shrink-0 select-none rounded-t-xs",
            isFullscreen && !isMaximized && "cursor-default",
            isFullscreen && !isMaximized && isDragging && "cursor-grabbing"
          )}
        >
          <ToolbarButton onClick={() => execCommand("undo")} icon={Undo2} title="Undo (Ctrl+Z)" />
          <ToolbarButton onClick={() => execCommand("redo")} icon={Redo2} title="Redo (Ctrl+Y)" />

          <div className="w-px h-3.5 bg-border mx-1 shrink-0" />

          <ToolbarButton onClick={() => execCommand("bold")} icon={Bold} title="Bold (Ctrl+B)" active={activeStyles.bold} />
          <ToolbarButton onClick={() => execCommand("italic")} icon={Italic} title="Italic (Ctrl+I)" active={activeStyles.italic} />
          <ToolbarButton onClick={() => execCommand("underline")} icon={Underline} title="Underline (Ctrl+U)" active={activeStyles.underline} />
          <ToolbarButton onClick={() => execCommand("strikeThrough")} icon={Strikethrough} title="Strikethrough" active={activeStyles.strikeThrough} />

          <div className="w-px h-3.5 bg-border mx-1 shrink-0" />

          <ToolbarButton onClick={() => execCommand("formatBlock", "<h1>")} icon={Heading1} title="Heading 1" active={activeStyles.h1} />
          <ToolbarButton onClick={() => execCommand("formatBlock", "<h2>")} icon={Heading2} title="Heading 2" active={activeStyles.h2} />
          <ToolbarButton onClick={() => execCommand("formatBlock", "<h3>")} icon={Heading3} title="Heading 3" active={activeStyles.h3} />
          <ToolbarButton onClick={() => execCommand("formatBlock", "<p>")} icon={Type} title="Normal Text" active={!activeStyles.h1 && !activeStyles.h2 && !activeStyles.h3 && !activeStyles.blockquote} />
          <ToolbarButton onClick={() => execCommand("formatBlock", "<blockquote>")} icon={Quote} title="Blockquote" active={activeStyles.blockquote} />

          <div className="w-px h-3.5 bg-border mx-1 shrink-0" />

          <ToolbarButton onClick={() => execCommand("insertUnorderedList")} icon={List} title="Bullet List" active={activeStyles.unorderedList} />
          <ToolbarButton onClick={() => execCommand("insertOrderedList")} icon={ListOrdered} title="Numbered List" active={activeStyles.orderedList} />

          <div className="w-px h-3.5 bg-border mx-1 shrink-0" />

          <ToolbarButton onClick={() => execCommand("justifyLeft")} icon={AlignLeft} title="Align Left" active={activeStyles.alignLeft} />
          <ToolbarButton onClick={() => execCommand("justifyCenter")} icon={AlignCenter} title="Align Center" active={activeStyles.alignCenter} />
          <ToolbarButton onClick={() => execCommand("justifyRight")} icon={AlignRight} title="Align Right" active={activeStyles.alignRight} />

          <div className="w-px h-3.5 bg-border mx-1 shrink-0" />

          <ToolbarButton onClick={handleInsertLink} icon={Link2} title="Insert Link (Ctrl+K)" />
          <ToolbarButton onClick={() => execCommand("unlink")} icon={Link2Off} title="Remove Link" />
          <ToolbarButton onClick={() => execCommand("removeFormat")} icon={Eraser} title="Clear Formatting" />

          <div className="ml-auto flex items-center gap-1">
            <ToolbarButton
              onClick={() => {
                if (editorRef.current && isCodeView) {
                  editorRef.current.innerHTML = htmlContent;
                }
                setIsCodeView(!isCodeView);
              }}
              icon={Code}
              title="Toggle HTML Source View"
              active={isCodeView}
            />

            <div className="w-px h-3.5 bg-border mx-1 shrink-0" />

            <ToolbarButton
              onClick={() => setIsFullscreen(!isFullscreen)}
              icon={isFullscreen ? Minimize2 : ExternalLink}
              title={isFullscreen ? "Exit External Mode" : "External Mode"}
              active={isFullscreen}
            />
          </div>
        </div>

        {/* Placeholder token chips */}
        {placeholders && placeholders.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 border-b border-border bg-card shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1">
              Insert:
            </span>
            {placeholders.map((p) => (
              <Tooltip key={p.token}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => insertToken(p.token)}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-copper/30 bg-copper/10 text-copper hover:bg-copper/20 transition-colors cursor-pointer"
                  >
                    {p.token}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-popover text-popover-foreground text-[10px] py-1 px-2 border border-border shadow-md">
                  {p.label}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}

        {/* Canvas */}
        <div
          className={cn(
            "relative flex overflow-auto",
            isFullscreen ? "flex-1" : "flex-1"
          )}
          style={isFullscreen ? undefined : { height: minHeight }}
        >
          <textarea
            value={htmlContent}
            onChange={handleCodeChange}
            className={cn(
              "w-full p-3 text-xs border-0 outline-hidden resize-none focus:ring-0 bg-muted/20 text-foreground h-full ",
              !isCodeView && "hidden"
            )}
            placeholder="HTML source code..."
          />

          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onMouseUp={updateToolbarStates}
            onKeyUp={updateToolbarStates}
            className={cn(
              "reqruit-rte w-full p-3 text-xs text-foreground outline-hidden max-w-none focus:ring-0 overflow-y-auto h-full leading-relaxed",
              isCodeView && "hidden"
            )}
          />

          {!isCodeView && !stripHtml(htmlContent) && (
            <span className="absolute top-3 left-3 text-xs text-muted-foreground pointer-events-none select-none">
              {placeholder}
            </span>
          )}
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground select-none px-0.5 leading-normal">
        <span>
          <strong>External Mode:</strong> Press{" "}
          <kbd className="bg-muted px-1 py-0.5 rounded-xs border border-border text-[9px]">Shift + F</kbd>{" "}
          (when unfocused) or{" "}
          <kbd className="bg-muted px-1 py-0.5 rounded-xs border border-border text-[9px]">Cmd/Ctrl + Shift + F</kbd>.
        </span>
        <span>
          <strong>Maximize / Restore:</strong> Hold{" "}
          <kbd className="bg-muted px-1 py-0.5 rounded-xs border border-border text-[9px]">Shift + F</kbd> then press{" "}
          <kbd className="bg-muted px-1 py-0.5 rounded-xs border border-border text-[9px]">M</kbd> /{" "}
          <kbd className="bg-muted px-1 py-0.5 rounded-xs border border-border text-[9px]">R</kbd>.
        </span>
      </div>
    </TooltipProvider>
  );
}

/** Empty-state check that ignores markup left behind by execCommand. */
function stripHtml(html: string): string {
  return (html || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}
