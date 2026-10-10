# Local Video Worker Contract

The canonical fully-local generation guide is [`local-free-generation.md`](./local-free-generation.md).

A FlickStack video worker is an untrusted local inference process. It must expose `GET /health`, `GET /capabilities`, and `POST /v1/generate` when using `LocalVideoHttpProvider`, or implement the `--request <json> --output <dir>` contract when using `LocalVideoCommandProvider`.

HTTP providers are localhost-only by default. Set `allowRemote: true` explicitly for a trusted LAN worker. Never put API keys or model-service credentials in a `GenerationRequest`.

The worker may use Wan, ComfyUI, or another open/local image-to-video stack. It must advertise only capabilities it really supports. FlickStack will reject last-frame, camera, motion-mask, extension, duration, resolution, or reference-image requirements that exceed the advertised contract.

Generated outputs remain staged. They do not become project assets until candidate/product QC approves them through `acceptRankedGenerationCandidates()`.
