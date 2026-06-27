import { describe, expect, it } from "vitest";
import { parseCsv, csvToObjects, toCsv, objectsToCsv } from "./csv";

describe("parseCsv", () => {
  it("parses a simple grid", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields with commas", () => {
    expect(parseCsv('name,note\n"Doe, John","hi"')).toEqual([
      ["name", "note"],
      ["Doe, John", "hi"],
    ]);
  });

  it("handles escaped double quotes", () => {
    expect(parseCsv('a\n"she said ""hi"""')).toEqual([
      ["a"],
      ['she said "hi"'],
    ]);
  });

  it("handles newlines inside quoted fields", () => {
    expect(parseCsv('a,b\n"line1\nline2",x')).toEqual([
      ["a", "b"],
      ["line1\nline2", "x"],
    ]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("strips a leading BOM", () => {
    expect(parseCsv("﻿a,b")).toEqual([["a", "b"]]);
  });

  it("does not emit a trailing empty row for a final newline", () => {
    expect(parseCsv("a,b\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("csvToObjects", () => {
  it("maps rows to objects keyed by trimmed headers", () => {
    const { headers, rows } = csvToObjects(" name , email \nAcme,a@b.com");
    expect(headers).toEqual(["name", "email"]);
    expect(rows).toEqual([{ name: "Acme", email: "a@b.com" }]);
  });

  it("pads short rows and trims values", () => {
    const { rows } = csvToObjects("a,b,c\n1, 2 ");
    expect(rows).toEqual([{ a: "1", b: "2", c: "" }]);
  });

  it("ignores fully blank lines", () => {
    const { rows } = csvToObjects("a\n1\n\n2");
    expect(rows).toEqual([{ a: "1" }, { a: "2" }]);
  });

  it("returns empty for empty input", () => {
    expect(csvToObjects("")).toEqual({ headers: [], rows: [] });
  });
});

describe("toCsv", () => {
  it("serializes a matrix with CRLF", () => {
    expect(
      toCsv([
        ["a", "b"],
        [1, 2],
      ])
    ).toBe("a,b\r\n1,2");
  });

  it("quotes fields containing commas, quotes or newlines", () => {
    expect(toCsv([["Doe, John", 'say "hi"', "l1\nl2"]])).toBe(
      '"Doe, John","say ""hi""","l1\nl2"'
    );
  });

  it("renders null/undefined as empty", () => {
    expect(toCsv([[null, undefined, "x"]])).toBe(",,x");
  });
});

describe("objectsToCsv", () => {
  it("emits header + ordered columns", () => {
    const csv = objectsToCsv(
      ["code", "name"],
      [
        { code: "C1", name: "Acme", extra: "ignored" },
        { code: "C2", name: "Globex" },
      ]
    );
    expect(csv).toBe("code,name\r\nC1,Acme\r\nC2,Globex");
  });

  it("round-trips through csvToObjects", () => {
    const csv = objectsToCsv(["code", "name"], [{ code: "C1", name: "A,B" }]);
    const { rows } = csvToObjects(csv);
    expect(rows).toEqual([{ code: "C1", name: "A,B" }]);
  });
});
