# Fully Local / Free Generation

FlickStack can run the premium generation path without any paid hosted API. The editor does not bundle model weights. Instead it orchestrates open/local workers and keeps exact editing, brand graphics, QC, sound, and rendering inside FlickStack.

## Architecture

The local path deliberately uses the cheapest honest technique for each shot:

1. **deterministic-2d** for reframes, titles, logos, graphic motion, light sweeps, and static hero shots
2. **layered-2.5d** for restrained pushes, pans, and small parallax moves that do not reveal meaningful hidden geometry
3. **local-video** for novel views, fluids, object deformation, changing reflections, large camera moves, or other temporal synthesis
4. **deterministic finishing** for exact logos, package text, legal copy, CTA typography, vector graphics, grading, sound, and delivery

The router intentionally blocks impossible claims. One front-facing product photo is not enough to promise a physically exact 90–180 degree product orbit.

## Suggested free/local model roles

FlickStack is model-agnostic. A practical local stack can use:

- a Wan-family image-to-video model for primary video synthesis
- a local image editor such as a Qwen/FLUX-class image-edit model for high-quality anchor frames
- SAM-class segmentation for masks/product regions
- local OCR such as PaddleOCR or Tesseract for package-text checks
- DINO/SigLIP-class embeddings for logo/product identity similarity
- Depth Anything-class depth estimation for 2.5D scenes
- RAFT-class optical flow or equivalent temporal features for flicker/consistency analysis

Model licenses and commercial-use terms vary. FlickStack records local provenance but cannot grant rights that a model license does not provide.

## Hardware profiles

`cpu` keeps the pipeline deterministic and refuses complex novel-view synthesis.

`low-vram` allows small/quantized local I2V and defaults to one candidate at 480p preview scale.

`standard-gpu` is the normal local I2V profile and defaults to two candidates at up to 720p preview scale.

`high-vram` allows broader candidate search and up to 1080p preview generation.

Candidate counts are capped per profile so an agent cannot accidentally launch an unbounded local generation job.

## Local video HTTP worker

Use `LocalVideoHttpProvider` when the model runs in a localhost service, another process, or another machine on the user's LAN.

### `GET /health`

Return any successful response when the worker is ready.

### `GET /capabilities`

Return a JSON object matching `VideoProviderCapabilities`:

```json
{
  "supportsFirstFrame": true,
  "supportsLastFrame": true,
  "maxReferenceImages": 4,
  "supportsNegativePrompt": true,
  "supportsSeed": true,
  "minDurationSeconds": 1,
  "maxDurationSeconds": 10,
  "supportedResolutions": ["480p", "720p"],
  "supportedAspectRatios": ["16:9", "9:16", "1:1"],
  "supportsCameraControl": true,
  "supportsMotionMasks": true,
  "supportsExtension": false,
  "supportsNativeAudio": false
}
```

Workers should only advertise controls they genuinely implement. FlickStack rejects a shot rather than pretending a missing control exists.

### `POST /v1/generate`

The request contains the prompt, negative prompt, seed, model, requested controls, and base64-encoded inputs with roles such as `first-frame`, `last-frame`, `reference`, `motion-mask`, and `extension-source`.

The response may return one candidate or many:

```json
{
  "model": "local-wan",
  "outputs": [
    {"videoBase64": "...", "mediaType": "video/mp4"},
    {"videoBase64": "...", "mediaType": "video/mp4"}
  ],
  "metadata": {"backend": "local"}
}
```

## Direct command worker

`LocalVideoCommandProvider` removes the HTTP requirement entirely. It launches a local executable with:

```text
<command> <configured args> --request /path/request.json --output /path/output
```

The backend writes generated files inside the supplied output directory and creates `output/result.json`:

```json
{
  "model": "wan-local",
  "outputs": [
    {"path": "clip-0.mp4", "mediaType": "video/mp4"}
  ],
  "metadata": {"quantized": true}
}
```

Output paths are sandboxed to the job output directory. This lets FlickStack use a local Python runner, ComfyUI bridge, shell wrapper, or custom inference binary without cloud credentials.

## Local anchor image editor

`LocalImageEditHttpProvider` calls `POST /v1/image-edit` and supports `image`, `image-edit`, and `inpaint` jobs. Use it to create a sparse set of high-quality product anchors before I2V interpolation.

The anchor workflow:

1. selects frame 0, the last frame, scene boundaries, and largest remaining gaps
2. creates local image-edit requests for the non-source anchors
3. keeps approved product references in every anchor request
4. creates a typed local video request using first/last/reference images
5. asks for multiple candidates according to the hardware profile

## Local product analyzer

`LocalProductAnalyzerHttp` keeps pixel-heavy CV out of the TypeScript core while remaining fully local.

### `POST /v1/build-identity`

Receives approved product references and may return expected OCR strings, protected colors, and source-backed silhouette metadata. FlickStack turns this into a `ProductIdentityPackage`.

### `POST /v1/analyze-product`

Returns normalized measurements in `[0,1]` such as:

- `ocrSimilarity`
- `logoSimilarity`
- `silhouetteSimilarity`
- `colorSimilarity`
- `segmentationStability`
- `temporalConsistency`
- `flickerScore` where lower is better
- `cameraAdherence`
- `productOccupancy`
- `promptAdherence`
- `aestheticScore`

The TypeScript core owns thresholds and release decisions, so the GPU worker cannot silently approve its own malformed output.

## Candidate acceptance gate

Generated bytes are not automatically project assets.

`rankGenerationCandidates()` combines product-fidelity, temporal/generation QC, prompt adherence, and aesthetic score. Brand/product fidelity is weighted most heavily by default.

`acceptRankedGenerationCandidates()` imports only approved candidates through the normal generation acceptance/provenance path. If every candidate fails, it throws instead of choosing the least-bad malformed product.

## Exact brand finishing

`planDeterministicBrandFinish()` marks exact copy, approved logos, and protected regions as non-generative.

`buildDeterministicBrandLayers()` compiles those instructions into locked V3 `text` and `image` motion layers with `generatedByModel: false` metadata.

This keeps wordmarks, product labels, legal copy, and CTA typography out of the diffusion model whenever FlickStack can render them exactly.

## Product-ad flow

For a product such as a beverage bottle, a strong local workflow is:

1. ingest two or more real approved product views when possible
2. build the identity package locally
3. describe the shot intent rather than requesting generic "crazy motion"
4. route static/simple shots to deterministic FlickStack
5. create high-quality local anchor frames for difficult shots
6. interpolate with local I2V and generate multiple candidates
7. run product/generation QC on each candidate
8. accept only survivors
9. restore/composite exact brand regions and typography
10. run normal render/motion QC and final brand inspection

The system is intentionally designed to fail honestly when the available source views or local hardware cannot support the requested shot.
