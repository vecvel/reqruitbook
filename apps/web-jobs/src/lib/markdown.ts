/**
 * A small, deliberately incomplete Markdown renderer.
 *
 * Job descriptions are written by recruiters in a rich-text field and stored as
 * Markdown. What a candidate needs from them is headings, lists, emphasis and
 * links — so that is what this supports, and anything else is shown as the
 * plain text it already is.
 *
 * Everything is HTML-escaped *before* any markup is produced, so a description
 * containing a `<script>` tag renders as the characters a recruiter typed.
 * That ordering is the whole security argument: a renderer that escaped
 * afterwards would escape its own tags, and one that escaped selectively would
 * eventually miss a case. Nothing here ever emits a raw attribute from user
 * text — link targets are validated against an http(s) scheme first.
 */

export function renderMarkdown(source: string): string {
  if (!source) return "";

  const lines = escapeHtml(source).replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let paragraph: string[] = [];

  const closeParagraph = () => {
    if (paragraph.length > 0) {
      out.push(`<p>${inline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.trim() === "") {
      closeParagraph();
      closeList();
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      closeParagraph();
      closeList();
      // Descriptions sit inside a page that already has an h1, so a document
      // heading starts at h2 and the levels below it shift with it.
      const level = Math.min(6, heading[1]!.length + 1);
      out.push(`<h${level}>${inline(heading[2]!)}</h${level}>`);
      continue;
    }

    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (bullet) {
      closeParagraph();
      if (listType !== "ul") {
        closeList();
        out.push("<ul>");
        listType = "ul";
      }
      out.push(`<li>${inline(bullet[1]!)}</li>`);
      continue;
    }

    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (numbered) {
      closeParagraph();
      if (listType !== "ol") {
        closeList();
        out.push("<ol>");
        listType = "ol";
      }
      out.push(`<li>${inline(numbered[1]!)}</li>`);
      continue;
    }

    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      closeParagraph();
      closeList();
      out.push("<hr />");
      continue;
    }

    closeList();
    paragraph.push(line.trim());
  }

  closeParagraph();
  closeList();
  return out.join("");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inline(text: string): string {
  return (
    text
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
      // Only http and https survive; a `javascript:` target is left as text.
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_all, label, href) => {
        return `<a href="${href}" rel="nofollow noopener noreferrer" target="_blank">${label}</a>`;
      })
  );
}
