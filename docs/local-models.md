# FlickSmith v0.2 Local Perception Runtimes

FlickSmith's base editor does not require a paid or hosted AI API. Local perception is capability-driven: editing remains available when an optional model/runtime is absent, and the evidence record states which provider/model produced each result.

## Verified in this release environment

### Local histogram image embedding

- Provider: `LocalHistogramEmbeddingProvider`
- Runtime: built-in TypeScript/Node implementation
- Network: none
- Model weights: none
- Output: deterministic 12-dimensional normalized RGB histogram vector
- License impact: FlickSmith source license only

This is a deliberately lightweight local baseline. It provides deterministic visual similarity primitives without downloading model weights. Richer embedding adapters can implement the same provider contract later.

### Tesseract OCR

- Provider: `TesseractOcrProvider`
- Runtime: local `tesseract` executable discovered on `PATH`
- Network: none
- Tested runtime: Tesseract 5.5.0 in the release runner
- Model/language data: supplied by the local Tesseract installation
- License: Tesseract is Apache-2.0; installed language-data licensing remains the distributor/user's responsibility

FlickSmith probes capability before use. If Tesseract is absent, OCR reports unavailable rather than blocking normal editing.

## Optional multimodal model adapters

The v0.2 architecture allows additional local providers such as ONNX Runtime, llama.cpp, or Ollama-compatible multimodal models. No such model weights are required by the base release, and FlickSmith does not treat a runtime license as permission to redistribute its model weights. Each adapter must record provider, model, version, source hash, confidence, and evidence timestamps.

## Evidence invalidation

Perception evidence is cached locally with the source-media hash that produced it. When the current source hash differs, `EvidenceStore.invalidateSource()` deletes stale evidence rather than allowing analysis from an old file to influence a new edit.

## Release acceptance

`tests/acceptance/local-vision.test.ts` creates a real high-contrast PNG with FFmpeg, decodes that image to RGBA, computes a local embedding, runs local Tesseract OCR when available, persists provenance in SQLite, and verifies source-hash invalidation.
