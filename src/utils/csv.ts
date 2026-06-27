/**
 * Minimal, dependency-free CSV utilities (RFC 4180-style).
 *
 * Handles quoted fields containing commas, double-quotes ("" escaping) and
 * newlines. Used for customer/supplier import & export.
 */

/** Parses CSV text into a matrix of string cells. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  // Normalize BOM
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  while (i < input.length) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (char === "\r") {
      i += 1;
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }

  // Flush the trailing field/row (unless the input ended with a newline)
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/**
 * Parses CSV text into header + row objects. The first non-empty row is the
 * header. Header keys are trimmed. Rows shorter than the header are padded
 * with empty strings; extra cells are ignored.
 */
export function csvToObjects(text: string): {
  headers: string[];
  rows: Array<Record<string, string>>;
} {
  const matrix = parseCsv(text).filter(
    (r) => !(r.length === 1 && r[0].trim() === "")
  );
  if (matrix.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = matrix[0].map((h) => h.trim());
  const rows = matrix.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((key, idx) => {
      record[key] = (cells[idx] ?? "").trim();
    });
    return record;
  });

  return { headers, rows };
}

/** Quotes a single CSV field when it contains a comma, quote or newline. */
function escapeField(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Serializes a matrix of cells into CSV text (CRLF line endings). */
export function toCsv(matrix: ReadonlyArray<ReadonlyArray<unknown>>): string {
  return matrix.map((row) => row.map(escapeField).join(",")).join("\r\n");
}

/** Serializes records into CSV text using the given ordered columns. */
export function objectsToCsv<T extends Record<string, unknown>>(
  columns: ReadonlyArray<keyof T & string>,
  records: ReadonlyArray<T>
): string {
  const header = [...columns];
  const body = records.map((rec) => columns.map((col) => rec[col]));
  return toCsv([header, ...body]);
}
