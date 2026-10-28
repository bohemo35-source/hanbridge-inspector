// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Tests for main car / main plate selection on real SAM fixtures (no network)
// @created: 2026-10-28
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseSamText } from "@/lib/meta/sam";
import { selectMainCar, selectMainPlate } from "./segment";

const fixture = (name: string) =>
  parseSamText(readFileSync(path.join(process.cwd(), "tests/fixtures/sam", name), "utf8"));

describe("main instance selection (photo_243114_0.jpg, 1280x720)", () => {
  it("main car covers the centre and is the largest centred car", () => {
    const cars = fixture("car.txt");
    const main = selectMainCar(cars, { w: 1280, h: 720 });
    expect(main).not.toBeNull();
    expect(main!.box.x1).toBeLessThanOrEqual(640);
    expect(main!.box.x2).toBeGreaterThanOrEqual(640);
  });

  it("main plate is exactly 514,354,756,415; background plates discarded", () => {
    const cars = fixture("car.txt");
    const plates = fixture("license_plate.txt");
    const car = selectMainCar(cars, { w: 1280, h: 720 });
    const plate = selectMainPlate(plates, car!.box);
    expect(plate).not.toBeNull();
    expect(plate!.box).toMatchObject({ x1: 514, y1: 354, x2: 756, y2: 415 });
  });

  it("without a car box, largest aspect-valid plate wins", () => {
    const plate = selectMainPlate(fixture("license_plate.txt"), null);
    expect(plate!.box).toMatchObject({ x1: 514, y1: 354, x2: 756, y2: 415 });
  });

  it("empty input -> null", () => {
    expect(selectMainCar([], { w: 1280, h: 720 })).toBeNull();
    expect(selectMainPlate([], null)).toBeNull();
  });
});
