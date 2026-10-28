// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Tests for SAM text parser, mask decoding, scaleBox on real SAM fixtures (no network)
// @created: 2026-10-28
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseSamText, scaleBox } from "./sam";

const fixture = (name: string) =>
  readFileSync(path.join(process.cwd(), "tests/fixtures/sam", name), "utf8");

describe("parseSamText", () => {
  it("license_plate.txt: 5 instances, main plate box is exact", () => {
    const instances = parseSamText(fixture("license_plate.txt"));
    expect(instances).toHaveLength(5);
    const main = instances.reduce((a, b) =>
      (b.box.x2 - b.box.x1) * (b.box.y2 - b.box.y1) > (a.box.x2 - a.box.x1) * (a.box.y2 - a.box.y1) ? b : a,
    );
    expect(main.box).toMatchObject({ x1: 514, y1: 354, x2: 756, y2: 415, w: 1280, h: 720 });
  });

  it("car.txt: 11 instances", () => {
    expect(parseSamText(fixture("car.txt"))).toHaveLength(11);
  });

  it("scratch_empty.txt: 0 instances; empty string -> []", () => {
    expect(parseSamText(fixture("scratch_empty.txt"))).toEqual([]);
    expect(parseSamText("")).toEqual([]);
  });

  it("decoded mask area > 0 and <= box area", () => {
    const instances = parseSamText(fixture("license_plate.txt"));
    const main = instances.find((i) => i.box.x1 === 514 && i.box.y1 === 354);
    expect(main).toBeDefined();
    expect(main!.maskDecoded).toBe(true);
    expect(main!.mask).not.toBeNull();
    const area = main!.mask!.reduce((s, v) => s + v, 0);
    const boxArea = (main!.box.x2 - main!.box.x1) * (main!.box.y2 - main!.box.y1);
    expect(area).toBeGreaterThan(0);
    expect(area).toBeLessThanOrEqual(boxArea);
  });
});

describe("scaleBox", () => {
  it("scales coordinates and updates w/h", () => {
    expect(scaleBox({ x1: 514, y1: 354, x2: 756, y2: 415, w: 1280, h: 720 }, { w: 1280, h: 720 }, { w: 2560, h: 1440 }))
      .toEqual({ x1: 1028, y1: 708, x2: 1512, y2: 830, w: 2560, h: 1440 });
    expect(scaleBox({ x1: 100, y1: 100, x2: 200, y2: 200 }, { w: 1000, h: 1000 }, { w: 500, h: 250 }))
      .toEqual({ x1: 50, y1: 25, x2: 100, y2: 50, w: 500, h: 250 });
  });
});
