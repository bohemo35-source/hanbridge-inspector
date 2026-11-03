// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: OCR of screen-recording frames with macOS Vision (accurate mode): prints "<file>\t<line>" for every recognised line — used to scan the Muse Code session recordings for secrets and personal data before they go into a public video
// @created: 2026-11-04
// @updated: 2026-11-04 claude-code — every image gives at least one line (fail-closed scans): "<no text>" when nothing was recognised, "<error>" when Vision failed; exit 1 on any unreadable image
// usage: swiftc -O scripts/video/ocr.swift -o /tmp/ocr && /tmp/ocr <image…>
import Foundation
import Vision
import AppKit

var failed = false
for path in CommandLine.arguments.dropFirst() {
    guard let img = NSImage(contentsOfFile: path), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { print("\(path)\t-\t<unreadable>"); failed = true; continue }
    let req = VNRecognizeTextRequest()
    req.recognitionLevel = .accurate
    req.usesLanguageCorrection = false
    req.recognitionLanguages = ["en-US", "ru-RU"]
    do { try VNImageRequestHandler(cgImage: cg, options: [:]).perform([req]) } catch { print("\(path)\t-\t<error>"); failed = true; continue }
    if (req.results ?? []).isEmpty { print("\(path)\t-\t<no text>") }
    for obs in req.results ?? [] {
        guard let top = obs.topCandidates(1).first else { continue }
        let b = obs.boundingBox // normalised, origin bottom-left
        print("\(path)\t\(String(format: "%.3f,%.3f,%.3f,%.3f", b.minX, 1 - b.maxY, b.width, b.height))\t\(top.string)")
    }
}
exit(failed ? 1 : 0)
