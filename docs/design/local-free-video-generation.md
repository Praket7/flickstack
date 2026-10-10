# Local-Free Hybrid Video Generation Design

## Goal

Make FlickStack capable of producing substantially better image-to-video and product-ad coverage without requiring paid hosted APIs. The default premium path must run entirely from local/open-source components, while preserving FlickStack's deterministic editing, compositing, typography, QC, and rendering strengths.

## Product Principle

Hybrid means hybrid **local** execution:

1. deterministic FlickStack animation for shots that do not require novel pixels
2. local layered/depth 2.5D animation for moderate parallax
3. local open-source video diffusion for shots that require novel view synthesis, deforming motion, fluids, or substantial temporal synthesis
4. deterministic FlickStack finishing for exact logos, legal copy, typography, layout, grading, sound, and delivery

No paid API may be required for any of these paths.

## Initial Local Stack

### Video generation

Primary adapter target: a local Wan-compatible HTTP worker. FlickStack does not embed model weights. It talks to a localhost worker using a typed contract so users can run a model suited to their hardware.

The worker contract must support capability discovery and may expose:

- image-to-video
- first-frame guidance
- first-and-last-frame guidance
- reference images
- negative prompts
- seeds
- duration
- resolution
- camera hints
- motion-mask inputs
- video extension
- optional native audio

The initial FlickStack adapter must degrade cleanly when a worker exposes only a subset.

### Local vision/QC

FlickStack must remain dependency-light. Pixel-heavy inference is delegated to localhost workers through typed HTTP contracts. The core TypeScript packages own orchestration, metrics, acceptance rules, and reproducible metadata.

Optional local workers may supply:

- segmentation
- OCR
- logo/reference embeddings
- depth
- optical flow
- camera trajectory estimates

Core QC must also accept precomputed measurements so tests do not require GPU models.

## Product Identity Package

A product/brand identity package defines what generation is not allowed to improvise.

Locked invariants include:

- approved source/reference asset IDs
- expected OCR strings
- logo/reference regions
- silhouette reference
- protected brand colors
- packaging/product regions
- minimum identity similarity thresholds

Generation candidates are evaluated against this package before acceptance.

## Anchor Workflow

For hard shots, FlickStack plans a sparse anchor sequence rather than asking one model to invent the whole scene blindly.

1. create or select high-quality anchor frames
2. mark exact product/brand regions that should remain unchanged where possible
3. send anchors and motion intent to the local I2V worker
4. generate multiple candidates
5. score candidates
6. reject product-identity or temporal-consistency failures
7. accept only survivors into the project
8. composite exact brand graphics and text afterward in FlickStack

This follows current research showing that high-quality anchors plus temporal interpolation can outperform monolithic editing approaches for consistency.

## Shot Routing

A local shot router selects the cheapest deterministic path that can satisfy the requested motion.

### deterministic-2d

Use for:

- static hero shots
- crop/reframe
- typography/layout motion
- light sweeps
- graphic transitions

### layered-2.5d

Use for:

- subtle push/pull
- small pan
- restrained orbit-like parallax with no meaningful hidden surface reveal

### local-video

Use for:

- real novel-view synthesis
- large camera changes
- material/fluid motion
- complex object motion
- temporally changing lighting/reflection
- scenes where 2.5D would visibly expose missing geometry

The router must reject impossible claims. A single front product photo cannot guarantee an exact 180-degree physically faithful orbit.

## Generation Provider Model

The existing provider abstraction is extended with typed video capabilities instead of relying only on `Record<string, unknown>`.

Required capability fields include:

- first frame
- last frame
- maximum reference images
- negative prompt
- seed
- duration range
- supported resolutions/aspect ratios
- camera control
- motion masks
- extension
- native audio

Provider selection must score fitness for the request rather than alphabetically choosing the first eligible provider.

## Candidate Search

A generation request may ask for N candidates. Candidates remain staged until QC/ranking accepts one or more.

Candidate ranking inputs may include:

- product identity score
- OCR score
- logo score
- silhouette stability
- temporal consistency
- flicker
- camera adherence
- prompt adherence
- user/agent aesthetic score

No generated asset enters the project merely because a provider returned bytes.

## Brand / Generation QC

Introduce generation-specific QC separate from engineering/render QC.

Initial metrics:

- OCR drift
- logo/reference similarity
- silhouette drift
- protected-color drift
- segmentation stability
- temporal feature consistency
- flicker score
- camera-motion adherence
- product occupancy/readability

The TypeScript core receives normalized measurements in `[0,1]` (or documented physical units) and applies thresholds/release rules. Local CV workers may compute those measurements.

## Deterministic Brand Finishing

Generated models should not be trusted for exact wordmarks, legal copy, pack text, or CTA typography when FlickStack can composite those exactly.

Preferred workflow:

- generate product/world motion plate
- preserve or restore exact product region when possible
- composite approved logo/type/vector assets natively
- run final brand QC

## Hardware Profiles

FlickStack should expose local capability profiles rather than pretending every machine can run the same model.

- `cpu`: deterministic and lightweight local analysis only
- `low-vram`: deterministic + 2.5D; external local worker may use quantized/small I2V
- `standard-gpu`: local I2V at practical preview resolutions
- `high-vram`: higher-resolution/more-candidate local generation

Routing should respect the selected profile and fail with useful diagnostics instead of silently falling back to fake 2D motion.

## Non-goals

- training a new foundation video model inside FlickStack
- bundling model weights in the npm repository
- claiming local output exceeds commercial systems without benchmark evidence
- using AI-generated typography when exact native compositing is available
- hiding generation/QC failures behind effects

## Success Criteria

1. A user can connect a localhost open-source I2V worker and generate video with no paid API.
2. Provider capabilities are typed and routing is request-aware.
3. A product identity package can block malformed candidates before acceptance.
4. Multiple candidates can be ranked and only approved outputs enter the project.
5. Simple still animation stays deterministic and fast.
6. Complex novel-view requests route to local video generation rather than fake parallax.
7. Exact brand graphics remain deterministic FlickStack layers.
8. The existing test/typecheck suite remains green.