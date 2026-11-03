// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Next config: ffmpeg-static for the agent route, image optimizer for the project Blob store
// @updated: 2026-11-02 claude-code — images.remotePatterns (garage photo thumbnails)
// @updated: 2026-11-03 claude-code — ffmpeg-static also for /api/upload-run (the visitor's video sound)
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // garage photo thumbnails: only this project's public Blob store (not any Blob store on the optimizer)
  images: { remotePatterns: [{ protocol: "https", hostname: "w8cg01wtfgfsm1zk.public.blob.vercel-storage.com" }] },
  // Vercel has no system ffmpeg: ship the ffmpeg-static binary with the agent route (voice + gauge tools).
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/inspections/[carId]/run": ["./node_modules/ffmpeg-static/ffmpeg"],
    "/api/upload-run": ["./node_modules/ffmpeg-static/ffmpeg"],
  },
};
export default nextConfig;
