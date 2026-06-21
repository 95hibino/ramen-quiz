/**
 * 画像最適化ユーティリティ。
 *
 * 投稿フォームでアップロードされた画像を Supabase Storage に送る前に
 * クライアントサイドでリサイズ・WebP 変換する。
 *
 * 仕様:
 *   - 入力 File を Canvas に描画して長辺 800px にリサイズ (アスペクト比維持)
 *   - WebP 形式 (quality 0.85) に変換
 *   - Canvas 経由なので EXIF は自動的に剥がれる (位置情報など PII 流出防止)
 *   - GIF / SVG など Canvas 描画できない/向かない形式はエラー
 *   - 元ファイルが 5MB 超の場合は事前に弾く
 *
 * 戻り値はプレビュー用に元サイズと最適化後サイズの両方を含む。
 */

/** 受け入れる入力 MIME (jpeg / png / webp のみ)。GIF/SVG は不可。 */
const ACCEPTED_INPUT_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** 出力寸法の長辺上限 (px)。 */
export const DEFAULT_MAX_DIMENSION = 800;
/** 出力 WebP の品質 (0.0-1.0)。 */
export const DEFAULT_WEBP_QUALITY = 0.85;
/** 入力ファイル容量上限 (バイト)。 */
export const MAX_INPUT_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export interface OptimizeImageOptions {
  /** 長辺ピクセル上限 (省略時 800)。 */
  maxDimension?: number;
  /** WebP 品質 (省略時 0.85)。 */
  quality?: number;
}

export interface OptimizedImage {
  /** WebP 形式の最適化後 Blob。 */
  blob: Blob;
  /** 元ファイルのバイトサイズ。 */
  originalSizeBytes: number;
  /** 最適化後の Blob バイトサイズ。 */
  optimizedSizeBytes: number;
  /** 元画像の自然寸法。 */
  originalWidth: number;
  originalHeight: number;
  /** 最適化後の寸法。 */
  optimizedWidth: number;
  optimizedHeight: number;
}

export class ImageOptimizationError extends Error {
  readonly code:
    | 'unsupported_format'
    | 'file_too_large'
    | 'decode_failed'
    | 'encode_failed'
    | 'canvas_unavailable';
  constructor(code: ImageOptimizationError['code'], message: string) {
    super(message);
    this.name = 'ImageOptimizationError';
    this.code = code;
  }
}

/**
 * 画像を最適化する。
 *
 * @throws {ImageOptimizationError}
 *   - `unsupported_format`: GIF/SVG など対応外
 *   - `file_too_large`: 5MB 超
 *   - `decode_failed`: 画像のデコードに失敗
 *   - `encode_failed`: WebP エンコードに失敗 (古いブラウザ)
 *   - `canvas_unavailable`: Canvas API が使えない環境
 */
export async function optimizeImage(
  file: File,
  options: OptimizeImageOptions = {},
): Promise<OptimizedImage> {
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const quality = options.quality ?? DEFAULT_WEBP_QUALITY;

  // 形式チェック (拡張子ではなく MIME ベース)
  if (!ACCEPTED_INPUT_MIME_TYPES.has(file.type)) {
    throw new ImageOptimizationError(
      'unsupported_format',
      `対応していない画像形式です (${file.type || '不明'})。JPEG/PNG/WebP のみ対応しています。`,
    );
  }

  // サイズチェック
  if (file.size > MAX_INPUT_FILE_SIZE_BYTES) {
    throw new ImageOptimizationError(
      'file_too_large',
      `ファイルサイズが上限 (${(MAX_INPUT_FILE_SIZE_BYTES / 1024 / 1024).toFixed(0)}MB) を超えています。`,
    );
  }

  // デコード
  const decoded = await decodeImage(file);
  const originalWidth = decoded.width;
  const originalHeight = decoded.height;

  try {
    // 出力寸法計算 (長辺を maxDimension に揃え、アスペクト比維持)
    const { width: targetWidth, height: targetHeight } = computeFitDimensions(
      originalWidth,
      originalHeight,
      maxDimension,
    );

    // Canvas に描画
    const canvas = createCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new ImageOptimizationError(
        'canvas_unavailable',
        'Canvas 2D コンテキストが取得できません。',
      );
    }
    ctx.drawImage(decoded.source, 0, 0, targetWidth, targetHeight);

    // WebP エンコード
    const blob = await canvasToBlob(canvas, 'image/webp', quality);
    if (!blob) {
      throw new ImageOptimizationError(
        'encode_failed',
        'WebP への変換に失敗しました。ブラウザを更新してください。',
      );
    }

    return {
      blob,
      originalSizeBytes: file.size,
      optimizedSizeBytes: blob.size,
      originalWidth,
      originalHeight,
      optimizedWidth: targetWidth,
      optimizedHeight: targetHeight,
    };
  } finally {
    decoded.dispose();
  }
}

/**
 * 長辺を `maxDimension` に揃え、アスペクト比を維持した寸法を返す。
 * 元画像が `maxDimension` 以下ならそのままの寸法を返す。
 */
export function computeFitDimensions(
  width: number,
  height: number,
  maxDimension: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxDimension) {
    return { width, height };
  }
  const ratio = maxDimension / longest;
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
}

interface DecodedImage {
  width: number;
  height: number;
  /** Canvas.drawImage に渡せるソース。 */
  source: CanvasImageSource;
  /** ObjectURL の解放や ImageBitmap.close を行う後始末。 */
  dispose: () => void;
}

/**
 * File をデコードする。
 * 優先: `createImageBitmap` (EXIF Orientation を自動適用)。
 * フォールバック: `HTMLImageElement` + `URL.createObjectURL`。
 */
async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      // imageOrientation: 'from-image' で EXIF Orientation を反映
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        width: bitmap.width,
        height: bitmap.height,
        source: bitmap,
        dispose: () => bitmap.close(),
      };
    } catch {
      // フォールバックへ
    }
  }
  return await decodeViaImgElement(file);
}

async function decodeViaImgElement(file: File): Promise<DecodedImage> {
  return await new Promise<DecodedImage>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        source: img,
        dispose: () => URL.revokeObjectURL(url),
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageOptimizationError('decode_failed', '画像のデコードに失敗しました。'));
    };
    img.src = url;
  });
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  if (typeof document === 'undefined') {
    throw new ImageOptimizationError('canvas_unavailable', 'document が利用できません (SSR 環境?)。');
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        resolve(blob);
      },
      type,
      quality,
    );
  });
}

/** バイトサイズを人間可読な単位に整形する (UI 用)。 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
