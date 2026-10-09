# FlickSmith v0.2 Performance Evidence

## Reference preview scenario

The v0.2 preview benchmark is defined as two overlapping H.264 1080p layers at 30 fps with proxies disabled. Reports record FPS, p50/p95 frame time, seek latency, dropped frames, cache hit rate, backend, codec, proxy mode, and hardware metadata when a GPU-backed run is measurable.

## Current execution runner

This CI/container runner could not provide a verified browser WebGPU adapter. FlickSmith therefore records the benchmark as **blocked** and leaves FPS/frame-time fields `null`; it does not substitute software timing or synthetic numbers for GPU performance.

The machine-readable report is committed at `benchmarks/v0.2/runner-linux-x64.json`. A GPU-enabled desktop/CI runner should run the same benchmark harness and add a named-hardware result before any 1080p30 marketing claim is made.

## v0.4 professional-motion acceptance

Performance claims distinguish evaluator throughput, CPU reference render time, GPU preview FPS and final export throughput. The premium-motion preset also requires <= 50% static-frame ratio after declared intentional holds, at least two simultaneously changing visual properties for >= 50% of every non-hold shot longer than 2 seconds, and independent foreground/subject/background activity for >= 40% of scenes marked layered motion.
