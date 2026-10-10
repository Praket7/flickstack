# Turnkey local model runtime

FlickStack can now detect local hardware, choose a free/open local image-to-video backend, install it into an isolated Python environment, download the required weights, launch a loopback-only worker, generate multiple candidates, and reject candidates that fail product-fidelity QC.

## Quick start

```bash
node --experimental-strip-types apps/cli/src/index.ts local doctor
node --experimental-strip-types apps/cli/src/index.ts local plan
node --experimental-strip-types apps/cli/src/index.ts local setup --yes
node --experimental-strip-types apps/cli/src/index.ts local status
```

`local setup` defaults to `~/.flicksmith/local`, writes `runtime.json`, copies the local worker there, and starts it on `127.0.0.1:7861` unless `--no-start` is supplied.

To generate a product shot from an image:

```bash
node --experimental-strip-types apps/cli/src/index.ts local generate bottle.png \
  --prompt "Premium beverage commercial. The bottle remains geometrically unchanged and centered while cold condensation beads move naturally, tiny carbonation bubbles rise, and a narrow rim light travels across the plastic. Slow 50 mm dolly-in. No new text, no label changes, no logo changes." \
  --duration 4 --candidates 3 --out shot.mp4
```

The command generates several candidates and runs local product/brand QC before copying the winning clip to the requested output path. `--relaxed-qc` exists for exploratory work but should not be used for final brand footage unless exact product regions will be restored during deterministic finishing.

## Automatic backend selection

| Hardware | Default backend | Purpose |
| --- | --- | --- |
| NVIDIA CUDA, 24 GB+ VRAM | Wan2.2 TI2V-5B | Maximum-quality local I2V |
| NVIDIA CUDA, 16–23 GB VRAM | LTX-Video 13B 0.9.8 distilled | High-quality local I2V |
| NVIDIA CUDA, 6–15 GB VRAM | LTX-Video 2B 0.9.8 distilled | Lower-memory local I2V |
| Apple silicon, 32 GB+ unified memory | LTX-Video 13B 0.9.8 distilled | High-memory MPS path |
| Apple silicon, 16–31 GB unified memory | LTX-Video 2B 0.9.8 distilled | MPS-compatible local I2V |
| No supported accelerator | deterministic | Native FlickStack 2D/2.5D only |

Override automatic selection with `--backend ltx-2b`, `--backend ltx-13b`, or `--backend wan22-ti2v5b`.

The installer uses the official upstream repositories and model repositories. It does not bundle weights in FlickStack. Model licenses remain authoritative for commercial use.

## What setup installs

For a generative backend the installer:

1. clones the official upstream model repository
2. creates a backend-specific Python virtual environment
3. installs the official inference dependencies
4. installs local OpenCV/Pillow/Tesseract bindings for product QC
5. downloads the selected model weights from Hugging Face
6. writes `~/.flicksmith/local/runtime.json`
7. copies `scripts/local/flick_local_worker.py` into the runtime directory
8. starts the worker locally unless `--no-start` is passed

No paid API key is required.

## Product-fidelity worker

The same local worker exposes:

- `GET /health`
- `GET /capabilities`
- `POST /v1/generate`
- `POST /v1/build-identity`
- `POST /v1/analyze-product`

The lightweight analyzer uses local OpenCV features, edge/silhouette comparison, HSV color histograms, frame sampling, and OCR when a local Tesseract binary is present. It measures logo/reference similarity, silhouette similarity, protected-color similarity, segmentation stability, temporal consistency, and flicker. Heavy learned analyzers can still be attached later through the existing analyzer interface.

## Honest limitations

Local generation quality depends heavily on GPU memory, model, prompt, source image, and shot difficulty. A single front-facing product photograph still cannot guarantee a physically exact large orbit or reveal unseen packaging. FlickStack intentionally routes or rejects those requests instead of pretending that 2D parallax is true 3D.

Wan2.2 TI2V-5B is intentionally selected only for high-memory NVIDIA systems. Lower-memory machines use LTX rather than silently launching a model likely to OOM. CPU-only machines stay deterministic because diffusion video generation there is not a practical default.
