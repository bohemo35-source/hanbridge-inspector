// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Real client video reviews from public/reviews/manifest.json; hidden entirely when the manifest is empty/missing
// @created: 2026-10-29
"use client";
import { useEffect, useRef } from "react";
import type { Lang } from "./copy";
import { REVIEWS_TITLE } from "./copy";

export interface ReviewItem { id: string; client: string; city: string; car: string; video: string; poster: string; quote_ru: string; quote_en: string; client_en?: string; city_en?: string }

export function ReviewsSection({ reviews, lang }: { reviews: ReviewItem[]; lang: Lang }) {
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      const v = e.target as HTMLVideoElement;
      if (e.isIntersecting) void v.play().catch(() => undefined); else v.pause();
    }), { threshold: 0.4 });
    videoRefs.current.forEach((v) => v && io.observe(v));
    return () => io.disconnect();
  }, [reviews]);
  if (!reviews.length) return null;
  return (
    <section data-journey-block="reviews" className="relative w-full bg-[#0a0d12] py-20" style={{ minHeight: "100vh" }}>
      <div className="mx-auto w-full max-w-6xl px-5">
        <h2 className="text-3xl font-semibold text-white">{REVIEWS_TITLE[lang]}</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.slice(0, 3).map((r, i) => (
            <article key={r.id} className="overflow-hidden rounded-2xl border border-white/12 bg-zinc-900" data-testid="review-card">
              <video ref={(el) => { videoRefs.current[i] = el; }} src={r.video} poster={r.poster} muted loop playsInline preload="metadata" className="aspect-video w-full object-cover" />
              <div className="p-5">
                <p className="text-lg leading-snug text-zinc-50">«{lang === "ru" ? r.quote_ru : r.quote_en}»</p>
                <p className="mt-3 text-sm text-zinc-400">{[lang === "ru" ? r.client : (r.client_en ?? r.client), lang === "ru" ? r.city : (r.city_en ?? r.city), r.car].filter(Boolean).join(" · ")}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
export default ReviewsSection;
