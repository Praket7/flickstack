import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

export interface Rational { numerator: number; denominator: number }
export interface TimingInfo { fps: Rational; timeBase?: Rational; variableFrameRate: boolean }
export interface VideoMeta { width: number; height: number; codec?: string; fps: Rational; variableFrameRate: boolean; pixelFormat?: string }
export interface AudioMeta { codec?: string; sampleRate?: number; channels?: number }
export interface MediaMeta { path: string; durationSeconds?: number; sizeBytes?: number; formatName?: string; video?: VideoMeta; audio?: AudioMeta; raw: unknown }

function parseRatio(value: unknown, fallback: Rational = { numerator: 0, denominator: 1 }): Rational {
  if (typeof value !== 'string') return fallback;
  const [a, b] = value.split('/').map(Number);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return fallback;
  return { numerator: a, denominator: b };
}

function ratioValue(value: Rational): number { return value.numerator / value.denominator; }

export function normalizeMediaTiming(stream: Record<string, unknown>): TimingInfo {
  const nominal = parseRatio(stream.r_frame_rate);
  const average = parseRatio(stream.avg_frame_rate, nominal);
  const selected = average.numerator > 0 ? average : nominal;
  const variableFrameRate = nominal.numerator > 0 && average.numerator > 0 && Math.abs(ratioValue(nominal) - ratioValue(average)) > 0.001;
  const timeBase = parseRatio(stream.time_base);
  return { fps: selected, variableFrameRate, ...(timeBase.numerator > 0 ? { timeBase } : {}) };
}

export function probeMedia(path: string): MediaMeta {
  if (!existsSync(path)) throw new Error(`Media file does not exist: ${path}`);
  const result = spawnSync('ffprobe', ['-v','error','-show_format','-show_streams','-of','json',path], { encoding: 'utf8', timeout: 15_000 });
  if (result.error) throw new Error(`ffprobe failed for ${path}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`ffprobe failed for ${path}: ${(result.stderr || '').trim()}`);
  let raw: any;
  try { raw = JSON.parse(result.stdout); } catch { throw new Error(`ffprobe failed for ${path}: invalid JSON output`); }
  const streams: any[] = Array.isArray(raw.streams) ? raw.streams : [];
  const v = streams.find(s => s.codec_type === 'video');
  const a = streams.find(s => s.codec_type === 'audio');
  const format = raw.format ?? {};
  const duration = Number(format.duration);
  const size = Number(format.size);
  const meta: MediaMeta = {
    path,
    ...(Number.isFinite(duration) ? { durationSeconds: duration } : {}),
    ...(Number.isFinite(size) ? { sizeBytes: size } : {}),
    ...(typeof format.format_name === 'string' ? { formatName: format.format_name } : {}),
    raw,
  };
  if (v) {
    const timing = normalizeMediaTiming(v);
    meta.video = {
      width: Number(v.width), height: Number(v.height), fps: timing.fps, variableFrameRate: timing.variableFrameRate,
      ...(v.codec_name ? { codec: String(v.codec_name) } : {}),
      ...(v.pix_fmt ? { pixelFormat: String(v.pix_fmt) } : {}),
    };
  }
  if (a) {
    const sr = Number(a.sample_rate), channels = Number(a.channels);
    meta.audio = {
      ...(a.codec_name ? { codec: String(a.codec_name) } : {}),
      ...(Number.isFinite(sr) ? { sampleRate: sr } : {}),
      ...(Number.isFinite(channels) ? { channels } : {}),
    };
  }
  if (!meta.video && !meta.audio) throw new Error(`ffprobe failed for ${path}: no audio or video streams`);
  return meta;
}

export interface ProxyOptions { maxWidth?: number; crf?: number; audioBitrate?: string }

export function createProxy(source: string, output: string, options: ProxyOptions = {}): string {
  if (source === output) throw new Error('Proxy output must not overwrite source media');
  probeMedia(source);
  mkdirSync(dirname(output), { recursive: true });
  const maxWidth = options.maxWidth ?? 960;
  const crf = options.crf ?? 28;
  const args = [
    '-y','-i',source,
    '-vf',`scale='min(${maxWidth},iw)':-2`,
    '-c:v','libx264','-preset','veryfast','-crf',String(crf),'-pix_fmt','yuv420p',
    '-c:a','aac','-b:a',options.audioBitrate ?? '96k','-movflags','+faststart', output,
  ];
  const result = spawnSync('ffmpeg', args, { encoding: 'utf8', timeout: 120_000 });
  if (result.error) throw new Error(`Proxy render failed: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`Proxy render failed: ${(result.stderr || '').slice(-3000)}`);
  return output;
}
