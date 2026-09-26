/**
 * CSV for the audit export.
 *
 * Hand-written rather than a dependency, because the whole of CSV that this
 * needs is two rules — quote a field containing a delimiter, double an embedded
 * quote — and one that is not about CSV at all:
 *
 * A cell beginning `=`, `+`, `-`, `@`, a tab or a carriage return is executed
 * as a formula when the file is opened in Excel or Sheets. The audit feed
 * carries text that came from outside the platform — a company name, a support
 * ticket subject, a payload field — so an export is a path from a tenant's
 * input to a formula running on a platform operator's machine. Prefixing the
 * cell with an apostrophe makes it unambiguously text. It is visible in the
 * cell, which is the point: better a stray quote than a spreadsheet dialling
 * out to an attacker's URL.
 */

const NEEDS_QUOTING = /[",\r\n]/;
const FORMULA_LEAD = /^[=+\-@\t\r]/;

/** One CSV field: injection-guarded, then quoted if it has to be. */
export function csvField(value: unknown): string {
  let text = stringify(value);

  if (FORMULA_LEAD.test(text)) {
    text = `'${text}`;
  }

  if (NEEDS_QUOTING.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function csvRow(values: readonly unknown[]): string {
  return values.map(csvField).join(',');
}

/**
 * A whole document, CRLF-terminated.
 *
 * RFC 4180 says CRLF, and Excel on Windows reads a lone LF as one enormous
 * cell. Every reader handles CRLF; not every reader handles LF.
 */
export function csvDocument(header: readonly string[], rows: Iterable<readonly unknown[]>): string {
  const lines = [csvRow(header)];
  for (const row of rows) {
    lines.push(csvRow(row));
  }
  return `${lines.join('\r\n')}\r\n`;
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    // A payload with a circular reference cannot happen over JSON, but a
    // serialiser that throws mid-export would abandon the whole file.
    return '';
  }
}
