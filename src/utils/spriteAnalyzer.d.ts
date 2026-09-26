/**
 * Declarações de tipos para o Sprite Sheet Analyzer
 */

export interface ContentBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FrameDefinition {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  contentBounds: ContentBounds;
  centerX: number;
  centerY: number;
  anchorX: number;
  anchorY: number;
  relativeAnchorX: number;
  relativeAnchorY: number;
  pixelCount: number;
  componentsCount: number;
  confidence: number;
  warnings: string[];
}

export interface DetectedGrid {
  rows: number;
  columns: number;
  cellW: number;
  cellH: number;
  confidence: number;
}

export interface DetectedBackground {
  type: 'transparent' | 'solid';
  dominantColor: { r: number; g: number; b: number } | null;
}

export interface NormalizedDimensions {
  maxWidth: number;
  maxHeight: number;
}

export interface AnalysisResult {
  frames: FrameDefinition[];
  detectedGrid: DetectedGrid;
  background: DetectedBackground;
  normalizedDimensions: NormalizedDimensions;
  rawComponentsCount: number;
  warnings: string[];
  imageWidth: number;
  imageHeight: number;
}

export interface AnalyzerOptions {
  backgroundType?: 'auto' | 'transparent' | 'solid';
  alphaThreshold?: number;
  colorTolerance?: number;
  padding?: number;
  mergeGapX?: number;
  mergeGapY?: number;
  minComponentArea?: number;
  expectedFrames?: number | null;
  expectedRows?: number | null;
  expectedCols?: number | null;
  anchorMode?: 'bottom_center' | 'center' | 'center_of_mass' | 'custom';
  confidenceThreshold?: number;
  aiFallback?: boolean;
}

export function analyzeSpriteSheet(
  imageSource: HTMLImageElement | HTMLCanvasElement | ImageData | { data: Uint8ClampedArray | Uint8Array; width: number; height: number },
  options?: AnalyzerOptions
): AnalysisResult;

export function renderNormalizedFrame(
  sourceImage: HTMLImageElement | HTMLCanvasElement,
  frame: FrameDefinition,
  targetCanvas: HTMLCanvasElement,
  options?: { targetAnchorX?: number; targetAnchorY?: number; showAnchor?: boolean }
): void;

export function exportMetadataJSON(
  analysisResult: AnalysisResult,
  sourceFilename?: string,
  animationsMap?: Record<string, any>
): string;
