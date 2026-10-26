// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Landing page TZ-01 (stub New inspection)
// @created: 2026-10-27
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-16">
      <p className="text-sm text-zinc-400">Korea → CIS / Central Asia</p>
      <h1 className="mt-3 text-4xl font-semibold leading-tight text-zinc-50">Hanbridge Inspector</h1>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-300">
        Every inspection claim clicks through to its evidence — frame, mask, voice quote or gauge reading — ending in a BUY / NEGOTIATE / WALK AWAY verdict.
      </p>
      <div className="mt-8">
        <a href="/inspect/new" className="inline-block rounded-md bg-zinc-100 px-5 py-2.5 text-sm font-medium text-zinc-900">New inspection</a>
        <span className="ml-3 text-sm text-zinc-500">Full flow lands in TZ-05.</span>
      </div>
    </main>
  );
}
