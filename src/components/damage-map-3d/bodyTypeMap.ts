// @agent:   claude (TZ-06)
// @project: hanbridge-inspector
// @purpose: Pick a 3D body template from make/model (demo cars + common Korean export models)
// @created: 2026-10-28
import type { BodyType } from "./bodyTemplates";

const RULES: { re: RegExp; type: BodyType }[] = [
  { re: /\b(x[1-7]|ix3|glc|gle|gla|glb|xc40|xc60|xc90|tucson|santa\s?fe|palisade|sorento|sportage|kona|venue|seltos|telluride|qm6|torres|tivoli|rav4|cr-?v|q[3578]|macan|cayenne|range|countryman|suv)\b/i, type: "suv" },
  { re: /\b(mini|cooper|golf|i30|ceed|polo|clio|fit|jazz|yaris|ray|morning|picanto|hatch)\b/i, type: "hatchback" },
];

export function guessBodyType(make: string, model: string): { type: BodyType; guessed: boolean } {
  const s = `${make} ${model}`;
  for (const r of RULES) if (r.re.test(s)) return { type: r.type, guessed: false };
  if (/\b([3-8]\d\di|[3-8]\s?series|[ceas]-?class|e\s?\d{3}|sonata|grandeur|k5|k8|k3|avante|elantra|g70|g80|g90|s60|s90|a[4-8]|camry|accord|sm6|sedan)\b/i.test(s))
    return { type: "sedan", guessed: false };
  return { type: "sedan", guessed: true };
}
