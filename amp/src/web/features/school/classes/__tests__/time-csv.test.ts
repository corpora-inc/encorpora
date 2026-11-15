import { describe, expect, it } from "vitest";
import { mergeTimeCsv } from "../time-csv";

const BOM = "﻿";

describe("mergeTimeCsv", () => {
  it("labels the class's lines with its group and appends the others' lines", () => {
    const merged = mergeTimeCsv(
      `${BOM}SIS ID,Student,Date,Active minutes,Problems\r\n,Pip,2026-11-02,12.5,8\r\n`,
      "The Lane family",
      [
        `${BOM}SIS ID,Student,Date,Active minutes,Problems,Group\r\n,Elsewhere Kid,2026-11-03,4,2,Avery's tutoring\r\n`,
      ],
    );
    expect(merged).toBe(
      "SIS ID,Student,Date,Active minutes,Problems,Group\r\n" +
        ",Pip,2026-11-02,12.5,8,The Lane family\r\n" +
        ",Elsewhere Kid,2026-11-03,4,2,Avery's tutoring\r\n",
    );
  });

  it("keeps a group name a spreadsheet would run as a formula as text", () => {
    const merged = mergeTimeCsv("a,b\r\n1,2\r\n", '=HYPERLINK("x")', []);
    expect(merged).toBe('a,b,Group\r\n1,2,"\'=HYPERLINK(""x"")"\r\n');
  });

  it("keeps a quoted line break inside one record", () => {
    const merged = mergeTimeCsv('a,b\r\n"one\r\ntwo",2\r\n', "G", []);
    expect(merged).toBe('a,b,Group\r\n"one\r\ntwo",2,G\r\n');
  });

  it("refuses an empty class file rather than save a partial one", () => {
    expect(() => mergeTimeCsv("", "G", [])).toThrow();
  });
});
