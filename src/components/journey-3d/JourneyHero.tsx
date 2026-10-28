// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Homepage hero wrapper: JourneyScene (hatchback, no current stage) + title + catalogue CTA overlay
// @created: 2026-10-28
"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

const JourneyScene = dynamic(() => import("./JourneyScene"), { ssr: false });

export default function JourneyHero() {
  return (
    <section className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 mx-auto w-full max-w-6xl px-6 pt-14">
        <p className="text-sm text-zinc-400">Korea → CIS / Central Asia</p>
        <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight text-zinc-50 sm:text-5xl">Hanbridge Inspector</h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-300">
          Every inspection claim clicks through to its evidence — frame, mask, voice quote or gauge reading — ending in a BUY / NEGOTIATE / WALK AWAY verdict. Then your car travels: Korea → bridge → port → sea → Vladivostok → home.
        </p>
        <div className="pointer-events-auto mt-8 flex flex-wrap gap-3">
          <Link href="/cars" className="inline-block rounded-md bg-zinc-100 px-5 py-2.5 text-sm font-medium text-zinc-900">Каталог осмотров</Link>
          <Link href="/cars" className="inline-block rounded-md border border-zinc-600 px-5 py-2.5 text-sm font-medium text-zinc-100">New inspection</Link>
        </div>
      </div>
      <JourneyScene bodyType="hatchback" lang="ru" />
    </section>
  );
}
