export type ColorSpace = 'srgb' | 'rec709' | 'display-p3' | 'acescg' | 'linear-srgb';
export type HdrTransfer = 'pq' | 'hlg';

export interface ColorPipelineRequest {
  input: ColorSpace;
  working: ColorSpace;
  output: ColorSpace;
  ocioConfigId?: string;
  look?: string;
}

export interface ColorPipeline extends ColorPipelineRequest {
  processing: 'native';
  deterministic: true;
}

export interface ScopeReport {
  histogram: number[];
  waveform: number[];
  vectorscope: Array<{ u: number; v: number }>;
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const srgbToLinear = (v: number) => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
const linearToSrgb = (v: number) => v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;

function mul3(m: number[][], rgb: number[]): number[] {
  return m.map((row) => row[0]! * rgb[0]! + row[1]! * rgb[1]! + row[2]! * rgb[2]!);
}

const SRGB_TO_ACESCG = [
  [0.6131324224, 0.3395380158, 0.0474166960],
  [0.0701243808, 0.9163940113, 0.0134515239],
  [0.0205876575, 0.1095745716, 0.8697854040],
];
const ACESCG_TO_SRGB = [
  [1.70505154, -0.62179068, -0.08325840],
  [-0.13025714, 1.14080271, -0.01054853],
  [-0.02400328, -0.12896898, 1.15297175],
];

export function resolveColorPipeline(request: ColorPipelineRequest): ColorPipeline {
  for (const key of ['input', 'working', 'output'] as const) {
    if (!request[key]) throw new Error(`${key} color space is required`);
  }
  return { ...request, processing: 'native', deterministic: true };
}

function toLinearSrgb(rgb: number[], space: ColorSpace): number[] {
  if (space === 'acescg') return mul3(ACESCG_TO_SRGB, rgb);
  if (space === 'linear-srgb') return rgb;
  return rgb.map(srgbToLinear);
}

function fromLinearSrgb(rgb: number[], space: ColorSpace): number[] {
  if (space === 'acescg') return mul3(SRGB_TO_ACESCG, rgb);
  if (space === 'linear-srgb') return rgb;
  return rgb.map(linearToSrgb);
}

export function applyColorPipeline(pixel: number[], pipeline: ColorPipeline): [number, number, number, number] {
  if (pixel.length < 3) throw new Error('RGBA pixel requires at least three channels');
  let linear = toLinearSrgb(pixel.slice(0, 3), pipeline.input);
  if (pipeline.working === 'acescg') {
    const aces = mul3(SRGB_TO_ACESCG, linear);
    linear = mul3(ACESCG_TO_SRGB, aces);
  }
  const out = fromLinearSrgb(linear, pipeline.output).map(clamp);
  return [out[0]!, out[1]!, out[2]!, clamp(pixel[3] ?? 1)];
}

export function computeScopes(pixels: Float32Array | number[], width: number, height: number): ScopeReport {
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) throw new Error('Invalid scope dimensions');
  const channels = pixels.length === width * height * 4 ? 4 : pixels.length === width * height * 3 ? 3 : 0;
  if (!channels) throw new Error('Pixel buffer must be RGB or RGBA');
  const histogram = Array.from({ length: 256 }, () => 0);
  const waveform: number[] = [];
  const vectorscope: Array<{ u: number; v: number }> = [];
  for (let i = 0; i < width * height; i++) {
    const r = clamp(Number(pixels[i * channels] ?? 0));
    const g = clamp(Number(pixels[i * channels + 1] ?? 0));
    const b = clamp(Number(pixels[i * channels + 2] ?? 0));
    const y = clamp(0.2126 * r + 0.7152 * g + 0.0722 * b);
    histogram[Math.min(255, Math.round(y * 255))]! += 1;
    waveform.push(y);
    vectorscope.push({ u: (b - y) * 0.5389, v: (r - y) * 0.6350 });
  }
  return { histogram, waveform, vectorscope };
}

export function encodeHdrMetadata(input: { transfer: HdrTransfer; maxNits: number; minNits?: number }) {
  if (!Number.isFinite(input.maxNits) || input.maxNits <= 0) throw new Error('maxNits must be positive');
  return {
    transferCharacteristic: input.transfer === 'pq' ? 'smpte2084' : 'arib-std-b67',
    colorPrimaries: 'bt2020',
    matrixCoefficients: 'bt2020nc',
    maxLuminanceNits: input.maxNits,
    minLuminanceNits: input.minNits ?? 0.0001,
  } as const;
}

export interface OcioRuntimeCapability {
  available: boolean;
  configId?: string;
  reason?: string;
}

export function resolveOcioRuntime(input: { configId?: string; nativeLibraryAvailable: boolean }): OcioRuntimeCapability {
  if (!input.nativeLibraryAvailable) return { available: false, reason: 'OpenColorIO native runtime is not available; deterministic built-in transforms remain available.' };
  if (!input.configId?.trim()) throw new Error('OCIO config id is required when native runtime is enabled');
  return { available: true, configId: input.configId };
}
