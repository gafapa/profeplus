import { describe, expect, it } from "vitest";
import { normalizeMoodleServer, scaleMoodleGrade } from "./service";

describe("Moodle local service safeguards", () => {
  it("normalizes the persisted server identity without retaining a trailing slash", () => {
    expect(normalizeMoodleServer(" https://Moodle.Example.org/school/// ")).toBe("https://moodle.example.org/school");
  });

  it.each([
    "http://moodle.example.org",
    "https://teacher:secret@moodle.example.org",
    "https://moodle.example.org/?token=secret",
    "https://moodle.example.org/#token"
  ])("rejects unsafe server metadata: %s", (server) => {
    expect(() => normalizeMoodleServer(server)).toThrow();
  });

  it("scales Moodle numerical grades to the local 0-10 range", () => {
    expect(scaleMoodleGrade(17, 20)).toBe(8.5);
    expect(scaleMoodleGrade(0, 20)).toBe(0);
  });

  it.each([
    [-1, 10],
    [11, 10],
    [5, 0],
    [Number.NaN, 10]
  ])("refuses a grade outside its declared numerical scale", (grade, maximum) => {
    expect(() => scaleMoodleGrade(grade, maximum)).toThrow(/escala numérica/);
  });
});
