import type { FurnitureDesignState } from '../types/furniture';

export interface VisualizationResult {
  status: 'ready' | 'failed' | 'not_configured' | 'stale';
  imageUrl?: string;
  prompt?: string;
  error?: string;
  generatedAt?: string;
  designVersion?: number;
}

export interface FurnitureVisualizationProvider {
  name: string;
  isConfigured(): boolean;
  generate(designState: FurnitureDesignState): Promise<VisualizationResult>;
}

const CATEGORY_PROMPT_MAP: Record<string, string> = {
  dining_table: 'dining table',
  wardrobe: 'wardrobe cabinet',
  sofa: 'sofa seating',
  tv_cabinet: 'TV cabinet credenza',
  kitchen_set: 'kitchen cabinet system',
  chair: 'single chair',
  table: 'desk table',
  other: 'custom furniture piece'
};

/**
 * Builds a deterministic, structured prompt for furniture visualization.
 * Strictly avoids hallucinating unspecified attributes.
 */
export function buildFurnitureVisualizationPrompt(designState: FurnitureDesignState): string {
  if (!designState || !designState.category) {
    return '';
  }

  const parts: string[] = [];

  // 1. SUBJECT
  const categoryNatural = CATEGORY_PROMPT_MAP[designState.category] || designState.category.replace('_', ' ');
  parts.push(`SUBJECT: High-end ${categoryNatural}`);

  // 2. DESIGN SPECIFICATIONS & SUB-CATEGORY / STYLE
  const specs: string[] = [];
  if (designState.subcategory) {
    specs.push(`type: ${designState.subcategory}`);
  }
  if (designState.style) {
    specs.push(`style: ${designState.style}`);
  }
  if (designState.shape) {
    specs.push(`shape: ${designState.shape}`);
  }
  if (specs.length > 0) {
    parts.push(`DESIGN SPECIFICATIONS: ${specs.join(', ')}`);
  }

  // 3. CAPACITY / SECTIONS
  const structDetails: string[] = [];
  if (designState.capacity) {
    structDetails.push(`seating capacity: ${designState.capacity} person`);
  }
  if (designState.sections) {
    structDetails.push(`sections/doors: ${designState.sections} units`);
  }
  if (designState.leg) {
    const legSpecs: string[] = [];
    if (designState.leg.color) legSpecs.push(designState.leg.color);
    if (designState.leg.material) legSpecs.push(designState.leg.material);
    if (designState.leg.style) legSpecs.push(designState.leg.style);
    if (legSpecs.length > 0) {
      structDetails.push(`legs: ${legSpecs.join(' ')}`);
    }
  }
  if (structDetails.length > 0) {
    parts.push(`STRUCTURAL DETAILS: ${structDetails.join(', ')}`);
  }

  // 4. DIMENSIONS (ONLY KNOWN)
  if (designState.dimensions) {
    const dims = designState.dimensions;
    const dimParts: string[] = [];
    if (dims.length) dimParts.push(`length ${dims.length}${dims.unit || 'cm'}`);
    if (dims.width) dimParts.push(`width ${dims.width}${dims.unit || 'cm'}`);
    if (dims.depth) dimParts.push(`depth ${dims.depth}${dims.unit || 'cm'}`);
    if (dims.height) dimParts.push(`height ${dims.height}${dims.unit || 'cm'}`);
    if (dimParts.length > 0) {
      parts.push(`DIMENSIONS: ${dimParts.join(' x ')}`);
    }
  }

  // 5. MATERIAL & FINISH
  const matFinish: string[] = [];
  if (designState.material) matFinish.push(`primary material: ${designState.material}`);
  if (designState.color) matFinish.push(`color: ${designState.color}`);
  if (designState.finish) matFinish.push(`surface finish: ${designState.finish}`);
  if (matFinish.length > 0) {
    parts.push(`MATERIAL & FINISH: ${matFinish.join(', ')}`);
  }

  // 6. VISUAL PRESENTATION & CONSTRAINTS
  parts.push(`VISUAL PRESENTATION: Professional studio product photograph, 3D architectural rendering, neutral bright background, soft studio lighting, ultra-realistic texture.`);
  parts.push(`CONSTRAINTS: Strictly adhere to specified materials, colors, and dimensions without adding unrequested decorative elements.`);

  return parts.join('\n');
}

/**
 * Checks whether a design state has minimal requirements to trigger visualization abstraction.
 */
export function isDesignReadyForVisualization(designState: FurnitureDesignState): boolean {
  return Boolean(designState && designState.category);
}

/**
 * Default Unconfigured Provider Implementation.
 * Returns status "not_configured" safely without calling any external API.
 */
export class NullFurnitureVisualizationProvider implements FurnitureVisualizationProvider {
  name = 'NullProvider';

  isConfigured(): boolean {
    return false;
  }

  async generate(designState: FurnitureDesignState): Promise<VisualizationResult> {
    const prompt = buildFurnitureVisualizationPrompt(designState);
    return {
      status: 'not_configured',
      prompt,
      designVersion: designState.version || 1,
      error: 'Image generation provider is not configured.'
    };
  }
}

export const defaultVisualizationProvider: FurnitureVisualizationProvider = new NullFurnitureVisualizationProvider();
