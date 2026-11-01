// @agent:   claude
// @project: hanbridge-inspector
// @purpose: ffmpeg binary + media duration that work on Vercel (no system ffmpeg/ffprobe there): ffmpeg-static, duration parsed from `ffmpeg -i`.
// @created: 2026-11-01
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
let cached: string | undefined;

/** FFMPEG_PATH, else ffmpeg-static on Vercel (or USE_FFMPEG_STATIC=1), else `ffmpeg` from PATH (local dev as before). */
export async function ffmpegBin(): Promise<string> {
  if (cached) return cached;
  if (process.env.FFMPEG_PATH) return (cached = process.env.FFMPEG_PATH);
  if (process.env.VERCEL || process.env.USE_FFMPEG_STATIC) {
    try {
      const mod = (await import("ffmpeg-static")) as unknown as { default?: string | null };
      if (mod.default) return (cached = mod.default);
    } catch { /* fall through to PATH */ }
  }
  return (cached = "ffmpeg");
}

/** Duration in seconds from the `Duration: hh:mm:ss.xx` line that ffmpeg prints for any input (no ffprobe needed). */
export async function mediaDuration(file: string): Promise<number> {
  const bin = await ffmpegBin();
  let stderr = "";
  try { stderr = (await run(bin, ["-hide_banner", "-i", file])).stderr; }
  catch (e) { stderr = String((e as { stderr?: unknown }).stderr ?? ""); } // exit code 1 is normal: no output file given
  const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
  if (!m) throw new Error(`cannot read duration of ${file}`);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}
