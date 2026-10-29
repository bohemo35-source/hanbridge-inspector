// @agent:   claude (reviewer fix, TZ-01)
// @project: hanbridge-inspector
// @purpose: Exact JSON contract for Spark so sparkJson output passes zod (FindingsDraftSchema)
// @created: 2026-10-27

export const FINDINGS_DRAFT_SPEC = `Return ONE JSON object with exactly this shape (no extra keys):
{
  "findings": [
    {
      "id": "string, unique, e.g. photo-0-dent-1",
      "panel": "one of: front_bumper, hood, front_left_fender, front_right_fender, front_left_door, front_right_door, rear_left_door, rear_right_door, rear_left_fender, rear_right_fender, trunk, rear_bumper, roof, unknown",
      "kind": "one of: scratch, dent, rust, repaint, putty, panel_replaced, mechanical, other",
      "severity": "one of: low, medium, high, critical",
      "description_en": "string",
      "description_ru": "string",
      "confidence": "number 0..1",
      "evidence": [
        { "type": "one of: frame, mask, transcript, gauge, auction_sheet, obd", "mediaId": "string, the id of the photo or 'gauge'", "panel": "string, optional", "gaugeMicrons": "number, optional", "quote": "string, optional" }
      ],
      "verified": false
    }
  ],
  "verdict": {
    "decision": "one of: BUY, NEGOTIATE, WALK_AWAY",
    "reasons_en": ["string"],
    "reasons_ru": ["string"],
    "confidence": "number 0..1",
    "handoff": "boolean, true if confidence < 0.6 or a critical finding is uncertain"
  }
}
Example:
{"findings":[{"id":"photo-0-dent-1","panel":"rear_left_door","kind":"dent","severity":"medium","description_en":"Shallow dent on rear left door.","description_ru":"Неглубокая вмятина на задней левой двери.","confidence":0.7,"evidence":[{"type":"frame","mediaId":"photo-0","panel":"rear_left_door"}],"verified":false}],"verdict":{"decision":"NEGOTIATE","reasons_en":["Dent on rear left door"],"reasons_ru":["Вмятина на задней левой двери"],"confidence":0.7,"handoff":false}}`;
