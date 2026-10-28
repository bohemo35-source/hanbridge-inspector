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
  it("accepts a foreshortened plate in a 3/4 view and a cut plate at the frame edge (inside the car)", () => {
    const car = { x1: 228, y1: 70, x2: 1090, y2: 635, w: 1280, h: 720 };
    const inst = (x1: number, y1: number, x2: number, y2: number) => ({ box: { x1, y1, x2, y2, w: 1280, h: 720 }, mask: null }) as never;
    expect(selectMainPlate([inst(288, 276, 397, 351)], car)?.box.x1).toBe(288); // aspect 1.45 (photo_243113_0)
    expect(selectMainPlate([inst(1000, 300, 1080, 390)], car)?.box.x1).toBe(1000); // aspect 0.89, cut at edge
    expect(selectMainPlate([inst(300, 300, 340, 400)], car)).toBeNull(); // aspect 0.4 — not a plate
    expect(selectMainPlate([inst(20, 300, 90, 330)], car)).toBeNull(); // background car outside the box
  });
});
