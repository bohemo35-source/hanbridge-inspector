// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: Ask Meta Muse Wonder (creative director role) for movie-trailer copy for film v4; saves raw answer + usage to docs/film4/
// @created: 2026-11-02
// usage: NODE_USE_ENV_PROXY=1 node --env-file=.env.local scripts/film4/wonder-copy.mjs
import { writeFileSync } from "node:fs";
const FACTS = `Hanbridge: a company that buys used cars in South Korea for buyers in Russia, Belarus, Kazakhstan, Uzbekistan etc.
Hard facts that must stay true (do not invent numbers or promises beyond these):
- The buyer sends a request (budget, wishes, timing). A manager picks real listings at the real platform price.
- Before the buyer pays, an expert inspects the car: paint gauge on every panel, photos, video, voice notes, OBD. An AI agent built on Meta models (Muse Spark, SAM 3.1, Muse Voice Transcribe, Muse Glimmer) turns it into one report; every finding links to its proof (photo frame, voice quote, reading). Verdict: BUY / NEGOTIATE / WALK AWAY.
- If something is wrong, we keep searching; the buyer decides.
- After the buy, the car is insured at every stage of the trip.
- In Korea the buyer pays ONE invoice: the car, the platform's standard fee, and sea freight at the carrier's real public tariff. Nothing on top.
- Car carrier to Busan port, a few days at sea to Vladivostok. Location visible in the portal and in Telegram.
- In Vladivostok the car is checked against the inspection report; bonded yard usually 7–10 days.
- Customs: all payments and receipts are in the buyer's name, the buyer pays duty/recycling fee/processing in their own bank app.
- Then car carrier or rail to the buyer's city (Moscow, Minsk, Almaty, Tashkent...). The buyer picks the carrier and pays them directly.
- Hanbridge takes zero commission from the buyer (it earns from Korea's export VAT refund).`;
const ASK = `You are the creative director and trailer copywriter for a 90-second scroll-driven brand film (like a premium movie trailer, think A24 / Apple product film). Visual shots available in order: night city + cable bridge in Seoul; bridge pylon in fog; top-down bridge with a golden light line; white Kia Sportage driving on the bridge; car on a lift in a workshop; gloved hand with paint gauge on the fender; keys + inspection clipboard on the hood; car on a car carrier at a port; carrier on a highway; ro-ro ship at Busan port; ship at sea from above; ship arriving in Vladivostok bay; car rolling down the ship ramp; car in port warehouse; car at the customs gate; car carrier on a road through hills, taiga, sunset plain; tow truck in a suburban street; handover of keys to the owner; the car parked at a house at dawn.
Write the film as 4 acts: I. The doubt (8,000 km, why trust a photo), II. The proof (inspection, AI report with evidence), III. The crossing (Korea, sea, Vladivostok, customs, with the money facts), IV. Home (road, handover, end card).
Rules: short trailer lines (max 9 words EN each), present tense, concrete, no clichés like "seamless", "journey of a lifetime", "unlock". Keep every fact true; you may compress, never add promises. Give each act a title card. End with a 2-4 word tagline for the logo card.
Then give the same in natural, literary Russian (not a word-by-word translation; trailer voice; use «ёлочки»).
Return strict JSON: {"acts":[{"title":{"en":"","ru":""},"lines":[{"shot":"<shot name>","en":"","ru":""}]}],"tagline":{"en":"","ru":""},"alt_taglines":[{"en":"","ru":""}]}`;
const t0 = Date.now();
const r = await fetch("https://api.meta.ai/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.META_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model: "muse-wonder-1.0", max_tokens: 20000, reasoning_effort: process.env.EFFORT ?? "low", messages: [{ role: "system", content: FACTS }, { role: "user", content: ASK }] }),
});
const j = await r.json();
const out = { model: "muse-wonder-1.0", status: r.status, ms: Date.now() - t0, usage: j.usage, content: j.choices?.[0]?.message?.content ?? null, finish: j.choices?.[0]?.finish_reason };
writeFileSync("docs/film4/wonder-copy.json", JSON.stringify(out, null, 2));
console.log(r.status, out.ms, "ms", JSON.stringify(j.usage), out.finish);
