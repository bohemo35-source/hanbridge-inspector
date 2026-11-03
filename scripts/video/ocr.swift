// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: OCR of screen-recording frames with macOS Vision (accurate mode): prints "<file>\t<line>" for every recognised line — used to scan the Muse Code session recordings for secrets and personal data before they go into a public video
// @created: 2026-11-04
// usage: swiftc -O scripts/video/ocr.swift -o /tmp/ocr && /tmp/ocr <image…>
import Foundation
import Vision
import AppKit

for path in CommandLine.arguments.dropFirst() {
    guard let img = NSImage(contentsOfFile: path), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { print("\(path)\t<unreadable>"); continue }
    let req = VNRecognizeTextRequest()
    req.recognitionLevel = .accurate
    req.usesLanguageCorrection = false
    req.recognitionLanguages = ["en-US", "ru-RU"]
    try? VNImageRequestHandler(cgImage: cg, options: [:]).perform([req])
    for obs in req.results ?? [] {
        guard let top = obs.topCandidates(1).first else { continue }
        let b = obs.boundingBox // normalised, origin bottom-left
        print("\(path)\t\(String(format: "%.3f,%.3f,%.3f,%.3f", b.minX, 1 - b.maxY, b.width, b.height))\t\(top.string)")
    }
}
