import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel has no system ffmpeg: ship the ffmpeg-static binary with the agent route (voice + gauge tools).
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/inspections/[carId]/run": ["./node_modules/ffmpeg-static/ffmpeg"],
  },
};
export default nextConfig;
