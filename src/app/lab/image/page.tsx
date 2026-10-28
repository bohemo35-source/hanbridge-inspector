// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Lab page for TZ-04 listing photos: before/after + car-mask pixel diff on the MINI demo photos (dev + Preview only)
// @created: 2026-10-29
import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { makeListingPhoto, type ListingPhotoResult } from "@/lib/agent/tools/listing";

export const metadata: Metadata = { title: "Listing image · lab", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const CAR_ID = "mini-cooper-s";
const PHOTOS = ["photo_243113_0", "photo_243114_0"] as const;

async function loadListing(photoId: string, fresh: boolean): Promise<ListingPhotoResult> {
  const dir = path.join(process.cwd(), "public", "generated", CAR_ID);
  if (!fresh) {
    try {
      return JSON.parse(await readFile(path.join(dir, `${photoId}-listing.json`), "utf8")) as ListingPhotoResult;
    } catch {
      // first run: fall through and generate
    }
  }
  const src = path.join(process.cwd(), "demo-data", CAR_ID, "photos", `${photoId}.jpg`);
  await mkdir(dir, { recursive: true });
  await copyFile(src, path.join(dir, `${photoId}-before.jpg`));
  return makeListingPhoto({ carId: CAR_ID, photoId, imagePath: src });
}

export default async function LabImagePage({ searchParams }: { searchParams: Promise<{ photo?: string; fresh?: string }> }) {
  if (process.env.VERCEL_ENV === "production") notFound();
  const sp = await searchParams;
  const photoId = PHOTOS.includes(sp.photo as (typeof PHOTOS)[number]) ? (sp.photo as string) : PHOTOS[0];
  const r = await loadListing(photoId, sp.fresh === "1");
  const before = `/generated/${CAR_ID}/${photoId}-before.jpg`;

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 16px 48px", display: "flex", flexDirection: "column", gap: 16 }}>
      <header style={{ display: "flex", flexWrap: "wrap", gap: "10px 16px", alignItems: "center" }}>
        <b>Hanbridge Inspector</b>
        <span style={{ font: "12px ui-monospace,Menlo,monospace", color: "#8b94a1" }}>/lab/image · TZ-04 listing photo</span>
        <span style={{ flex: 1 }} />
        {PHOTOS.map((p) => (
          <a key={p} href={`/lab/image?photo=${p}`} style={{ color: p === photoId ? "#c9a46a" : "#e8ebee", fontSize: 13 }}>
            {p}
          </a>
        ))}
        <a href={`/lab/image?photo=${photoId}&fresh=1`} style={{ color: "#e8ebee", fontSize: 13 }}>
          regenerate
        </a>
      </header>

      <div style={{ fontSize: 13, border: "1px solid #c9a46a", borderRadius: 8, padding: "8px 12px", color: "#e8c987" }}>{r.badge}</div>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16 }}>
        <figure style={{ margin: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={before} alt="Original inspection photo" style={{ width: "100%", borderRadius: 8 }} />
          <figcaption style={{ fontSize: 12, color: "#8b94a1", marginTop: 6 }}>Before — original frame (report evidence)</figcaption>
        </figure>
        <figure style={{ margin: 0 }}>
          {r.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.url} alt="Listing photo with hidden plate" style={{ width: "100%", borderRadius: 8 }} />
          ) : (
            <div style={{ fontSize: 14, padding: 24, border: "1px dashed #444", borderRadius: 8 }}>Skipped: {r.rejectedReason}</div>
          )}
          <figcaption style={{ fontSize: 12, color: "#8b94a1", marginTop: 6 }}>After — listing image (never evidence)</figcaption>
        </figure>
      </section>

      <section style={{ font: "13px ui-monospace,Menlo,monospace", lineHeight: 1.7 }}>
        <div>plateHidden: {String(r.plateHidden)} · backgroundEdited: {String(r.backgroundEdited)}</div>
        <div>
          diff inside car mask: {r.carMaskDiff === null ? "not measured" : r.carMaskDiff.toFixed(2)} (mean |Δ| per channel, reject &gt; 10)
        </div>
        {r.plateBox && (
          <div>
            plate box (from segmentImage): {r.plateBox.x1},{r.plateBox.y1}–{r.plateBox.x2},{r.plateBox.y2} in {r.width}x{r.height}
          </div>
        )}
        {r.rejectedReason && <div>rejectedReason: {r.rejectedReason}</div>}
        <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
          {r.trace.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
