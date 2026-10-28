// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Muse Image client: generateImage (/images/generations) + editImage (/images/edits, mask attempt -> no-mask retry)
// @created: 2026-10-29
import sharp from "sharp";
import { metaFetch, MetaApiError } from "./client";

export interface GeneratedImage {
  image: Buffer;
  /** detected format of the returned bytes (API returned webp in smoke runs) */
  format: string;
  ms: number;
}

export interface EditedImage extends GeneratedImage {
  /** true when the API accepted the mask field; false after the no-mask retry */
  maskUsed: boolean;
}

async function decodeResult(res: Response, t0: number): Promise<GeneratedImage> {
  const raw = (await res.json()) as { data?: Array<{ b64_json?: string }> };
  const b64 = raw.data?.[0]?.b64_json ?? "";
  if (!b64) throw new MetaApiError("empty_image", "muse-image-1.0 returned no image data");
  const image = Buffer.from(b64, "base64");
  const meta = await sharp(image).metadata();
  return { image, format: meta.format ?? "png", ms: Date.now() - t0 };
}

export async function generateImage(opts: { prompt: string; n?: number }): Promise<GeneratedImage> {
  const t0 = Date.now();
  const res = await metaFetch("/images/generations", {
    method: "POST",
    model: "muse-image-1.0",
    timeoutMs: 120000,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "muse-image-1.0", prompt: opts.prompt, n: opts.n ?? 1 }),
  });
  return decodeResult(res, t0);
}

const MASK_UNSUPPORTED = "is not a supported image edit field";

/**
 * Edit via /images/edits (multipart). First attempt sends the mask
 * (PNG, white = editable area). The live API rejects the mask field
 * (400 unsupported_parameter, smoke 2026-10-29) — then retry once without
 * it and report maskUsed:false so callers must verify the result themselves.
 */
export async function editImage(opts: { image: Buffer; mask?: Buffer; prompt: string }): Promise<EditedImage> {
  const attempt = async (withMask: boolean): Promise<EditedImage> => {
    const t0 = Date.now();
    const form = new FormData();
    form.append("model", "muse-image-1.0");
    form.append("prompt", opts.prompt);
    form.append("image", new Blob([new Uint8Array(opts.image)], { type: "image/jpeg" }), "image.jpg");
    if (withMask && opts.mask) form.append("mask", new Blob([new Uint8Array(opts.mask)], { type: "image/png" }), "mask.png");
    const res = await metaFetch("/images/edits", {
      method: "POST",
      model: "muse-image-1.0",
      timeoutMs: 120000,
      body: form,
    });
    return { ...(await decodeResult(res, t0)), maskUsed: withMask && Boolean(opts.mask) };
  };

  if (!opts.mask) return attempt(false);
  try {
    return await attempt(true);
  } catch (e) {
    if (e instanceof MetaApiError && e.message.includes(MASK_UNSUPPORTED)) return attempt(false);
    throw e;
  }
}
