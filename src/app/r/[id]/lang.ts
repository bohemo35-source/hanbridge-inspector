// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: report page language from ?lang= — English unless the link asks for Russian (the jury reads EN; RU pages link with ?lang=ru)
// @created: 2026-11-04
export type ReportLang = "ru" | "en";
export const reportLang = (v: string | string[] | undefined): ReportLang => (v === "ru" ? "ru" : "en");
