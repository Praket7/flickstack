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

export interface OcioProcessorRequest {
  configId: string;
  input: ColorSpace;
  output: ColorSpace;
  look?: string;
  rgba: readonly [number, number, number, number];
}

export type OcioProcessor = (request: OcioProcessorRequest) => readonly [number, number, number, number];

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const srgbToLinear = (v: number) => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
const linearToSrgb = (v: number) => v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
const rec709ToLinear = (v: number) => v < 0.081 ? v / 4.5 : Math.pow((v + 0.099) / 1.099, 1 / 0.45);
const linearToRec709 = (v: number) => v < 0.018 ? 4.5 * v : 1.099 * Math.pow(v, 0.45) - 0.099;

function mul3(m: readonly (readonly number[])[], rgb: readonly number[]): [number, number, number] {
  return [
    m[0]![0]! * rgb[0]! + m[0]![1]! * rgb[1]! + m[0]![2]! * rgb[2]!,
    m[1]![0]! * rgb[0]! + m[1]![1]! * rgb[1]! + m[1]![2]! * rgb[2]!,
    m[2]![0]! * rgb[0]! + m[2]![1]! * rgb[1]! + m[2]![2]! * rgb[2]!,
  ];
}

const SRGB_TO_XYZ_D65 = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.0721750],
  [0.0193339, 0.1191920, 0.9503041],
] as const;
const XYZ_D65_TO_SRGB = [
  [3.2404542, -1.5371385, -0.4985314],
  [-0.9692660, 1.8760108, 0.0415560],
  [0.0556434, -0.2040259, 1.0572252],
] as const;
const P3_TO_XYZ_D65 = [
  [0.4865709486, 0.2656676932, 0.1982172852],
  [0.2289745641, 0.6917385218, 0.0792869141],
  [0, 0.0451133819, 1.0439443689],
] as const;
const XYZ_D65_TO_P3 = [
  [2.49349691, -0.93138362, -0.40271078],
  [-0.82948897, 1.76266406, 0.02362469],
  [0.03584583, -0.07617239, 0.95688452],
] as const;
const ACESCG_TO_XYZ_D60 = [
  [0.6624541811, 0.1340042065, 0.1561876870],
  [0.2722287168, 0.6740817658, 0.0536895174],
  [-0.0055746495, 0.0040607335, 1.0103391003],
] as const;
const XYZ_D60_TO_ACESCG = [
  [1.64102338, -0.32480329, -0.23642470],
  [-0.66366286, 1.61533159, 0.01675635],
  [0.01172189, -0.00828444, 0.98839486],
] as const;
const D60_TO_D65 = [
  [0.98722400, -0.00611327, 0.01595330],
  [-0.00759836, 1.00186000, 0.00533002],
  [0.00307257, -0.00509595, 1.08168000],
] as const;
const D65_TO_D60 = [
  [1.01303000, 0.00610531, -0.01497100],
  [0.00769823, 0.99816500, -0.00503203],
  [-0.00284131, 0.00468516, 0.92450700],
] as const;

export function resolveColorPipeline(request: ColorPipelineRequest): ColorPipeline {
  for (const key of ['input', 'working', 'output'] as const) {
    if (!request[key]) throw new Error(`${key} color space is required`);
  }
  return { ...request, processing: 'native', deterministic: true };
}

function decodeRgb(rgb: readonly number[], space: ColorSpace): [number, number, number] {
  if (space === 'acescg' || space === 'linear-srgb') return [rgb[0]!, rgb[1]!, rgb[2]!];
  const decode = space === 'rec709' ? rec709ToLinear : srgbToLinear;
  return [decode(rgb[0]!), decode(rgb[1]!), decode(rgb[2]!)];
}

function encodeRgb(rgb: readonly number[], space: ColorSpace): [number, number, number] {
  if (space === 'acescg' || space === 'linear-srgb') return [rgb[0]!, rgb[1]!, rgb[2]!];
  const encode = space === 'rec709' ? linearToRec709 : linearToSrgb;
  return [encode(rgb[0]!), encode(rgb[1]!), encode(rgb[2]!)];
}

function toXyzD65(rgb: readonly number[], space: ColorSpace): [number, number, number] {
  const linear = decodeRgb(rgb, space);
  if (space === 'acescg') return mul3(D60_TO_D65, mul3(ACESCG_TO_XYZ_D60, linear));
  if (space === 'display-p3') return mul3(P3_TO_XYZ_D65, linear);
  return mul3(SRGB_TO_XYZ_D65, linear);
}

function fromXyzD65(xyz: readonly number[], space: ColorSpace): [number, number, number] {
  let linear: [number, number, number];
  if (space === 'acescg') linear = mul3(XYZ_D60_TO_ACESCG, mul3(D65_TO_D60, xyz));
  else if (space === 'display-p3') linear = mul3(XYZ_D65_TO_P3, xyz);
  else linear = mul3(XYZ_D65_TO_SRGB, xyz);
  return encodeRgb(linear, space);
}

export function applyColorPipeline(pixel: readonly number[], pipeline: ColorPipeline): [number, number, number, number] {
  if (pixel.length < 3) throw new Error('RGBA pixel requires at least three channels');
  const xyz = toXyzD65(pixel.slice(0, 3), pipeline.input);
  const out = fromXyzD65(xyz, pipeline.output).map(clamp) as [number, number, number];
  return [out[0], out[1], out[2], clamp(pixel[3] ?? 1)];
}

export function applyOcioPipeline(pixel: readonly number[], pipeline: ColorPipeline, processor: OcioProcessor): [number, number, number, number] {
  if (!pipeline.ocioConfigId?.trim()) throw new Error('OCIO config id is required for OCIO processing');
  if (pixel.length < 3) throw new Error('RGBA pixel requires at least three channels');
  const result = processor({
    configId: pipeline.ocioConfigId,
    input: pipeline.input,
    output: pipeline.output,
    look: pipeline.look,
    rgba: [pixel[0]!, pixel[1]!, pixel[2]!, pixel[3] ?? 1],
  });
  if (result.length !== 4 || result.some((value) => !Number.isFinite(value))) throw new Error('OCIO processor returned invalid RGBA data');
  return [result[0], result[1], result[2], clamp(result[3])];
}

export function encodeHdrTransfer(linear: number, transfer: HdrTransfer): number {
  const value = Math.max(0, linear);
  if (transfer === 'hlg') {
    const a = 0.17883277;
    const b = 1 - 4 * a;
    const c = 0.5 - a * Math.log(4 * a);
    return value <= 1 / 12 ? Math.sqrt(3 * value) : a * Math.log(12 * value - b) + c;
  }
  const m1 = 2610 / 16384;
  const m2 = 2523 / 32;
  const c1 = 3424 / 4096;
  const c2 = 2413 / 128;
  const c3 = 2392 / 128;
  const normalized = Math.min(1, value / 10000);
  const p = Math.pow(normalized, m1);
  return Math.pow((c1 + c2 * p) / (1 + c3 * p), m2);
}

export function decodeHdrTransfer(encoded: number, transfer: HdrTransfer): number {
  const value = clamp(encoded);
  if (transfer === 'hlg') {
    const a = 0.17883277;
    const b = 1 - 4 * a;
    const c = 0.5 - a * Math.log(4 * a);
    return value <= 0.5 ? (value * value) / 3 : (Math.exp((value - c) / a) + b) / 12;
  }
  const m1 = 2610 / 16384;
  const m2 = 2523 / 32;
  const c1 = 3424 / 4096;
  const c2 = 2413 / 128;
  const c3 = 2392 / 128;
  const p = Math.pow(value, 1 / m2);
  const numerator = Math.max(p - c1, 0);
  const denominator = c2 - c3 * p;
  return 10000 * Math.pow(numerator / denominator, 1 / m1);
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
