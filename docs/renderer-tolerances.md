# FlickSmith v0.2 Renderer Equivalence Tolerances

The FFmpeg renderer is the deterministic reference backend.

| Preview capability | v0.2 status | Release tolerance |
| --- | --- | --- |
| Normal alpha compositing | Approximate, release-gated | RGB RMSE ≤ 0.035, alpha RMSE ≤ 0.01, timing error 0 frames |
| Clip activation boundaries | Release-gated | 0 frames |
| Non-normal blend modes in browser WebGPU | Unsupported in the current GPU path | No silent fallback; software/final renderer required |
| Masks, color effects, text/motion in browser WebGPU | Not hardware-verified on this runner | Must be diagnosed or use fallback; not covered by a performance claim |
| Audio preview effects | Not part of the current browser GPU compositor | FFmpeg final renderer remains authoritative |

A capability marked approximate without a declared tolerance fails the equivalence gate. The current execution environment cannot create a WebGPU adapter, so this suite verifies the shared RenderGraph orchestration and deterministic preview compositor without claiming hardware execution.

## v0.4 native motion reference

The deterministic CPU renderer is the semantic reference. GPU/reference RGB RMSE must be <= 0.02, alpha RMSE <= 0.005, and activation/timing error is 0 frames. A GPU feature outside tolerance is capability-gated and falls back explicitly to CPU; it is never silently omitted.
