<!-- @agent: claude-code · @project: hanbridge-inspector · @purpose: plans after the hackathon (the client's individual route) and a draft of the "who did what" section for the jury · @created: 2026-11-02 -->
# Plans and drafts

## 1. Client's individual route ("Generate my route" in the personal account)
**Who it is for.** The client has signed the contract, and their car is already selected and inspected. In the account at `/r/:id` they press "Generate" and get a film about the route of **their** car to **their** city.

**How it works (Meta models and our code):**
1. **Script — Muse Spark.** Input: the report (make, colour, body type, findings), the delivery status (`shipping.stage`, ETA), the destination city, and the route: Vladivostok → Novosibirsk → Moscow, with distances and timings. Output: 12–16 scenes following the template of our v4 film: EN/RU lines and background prompts. Business facts (one invoice, insurance, customs on the client, zero commission) are taken from `story.ts` and are not rewritten by the model.
2. **Backgrounds — Muse Image.** Port of Busan, the ship (ramp closed), Vladivostok, a highway through the relevant regions with the season taken into account, the yard at home. Scenes "without the car".
3. **The car itself — SAM 3.1 on real inspection photos.** We cut out the client's car from their own photos (the agent already can do this) and place it on the backgrounds. This way the car is identical in all frames and really is their car. If we asked Muse Image to draw an "Audi" every time, the car would change from frame to frame.
4. **Animation — in the browser, as in film v4.** Parallax of the background and cut-outs, zooms, transitions, a route map with a "you are here" marker that moves as delivery progresses. We do not generate video per client: Wan is not from Meta, and a clip takes 25–75 minutes.
5. **3D.** A neutral body template (SUV / sedan / hatchback / compact / city car) in the client's car colour, with panels highlighted from their report. There is no exact model for the make.
6. **Cache and refresh.** The result is saved in Blob and rebuilt when the delivery stage changes. Generation takes minutes: 12–16 Muse Image pictures and 1–2 Muse Spark calls.

**Estimate:** MVP — 1–2 days after the hackathon. Risks: cut-out quality on dark and glary photos (fallback — template 3D model in the car's colour) and generation cost (cache it, 1 generation per client).

## 2. Jury section "Who did what" (draft for README / form)
Phrase it only the way it actually happened — an inaccuracy in the submission is more dangerous than a modest wording.
- **Muse Wonder** (inside Muse Code, Meta's coding agent) wrote the product core per TZ-01…10: the Meta API client, schemas, the Muse Spark expert, SAM segmentation, the agent orchestrator, the first garage scene with the 3D-car breakdown (TZ-10), and the parametric 3D body map (TZ-06). Review and polishing — Claude.
- **Muse Image**: starting frames of all film scenes (they were animated by Wan — it is not from Meta, as stated in the README), the "ship at sea" frame in v4, concept frames for the 3D models (from them Tripo built the 3D: the garage's source car and 4 body templates), backgrounds for the journey and the garage.
- **Muse Wonder** (directly via API): draft of the film v4 trailer lines (2 lines made it into the film) and the generator of the 3D-bridge geometry on the first screen (refined).
- **Muse Spark**: agent orchestrator, parsing of inspector sheets into RU+EN sections, translation of 550 photo captions.
- **The v4 film player, the garage studio and the site design** were written by Claude Code. State this directly: the contest requirement is "clearly show what was done during the hackathon", not to attribute the work to the models.
