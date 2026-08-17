export interface FurnitureDimensions {
  length?: number;  // Panjang (cm)
  width?: number;   // Lebar (cm)
  depth?: number;   // Kedalaman (cm)
  height?: number;  // Tinggi (cm)
  unit: 'cm' | 'mm';
}

export interface FurnitureLegSpec {
  style?: string;   // e.g. "minimalis", "tapered", "hairpin", "kotak"
  material?: string;// e.g. "kayu jati", "besi hollo", "stainless"
  color?: string;   // e.g. "black", "natural", "gold"
}

export interface FurnitureVisualizationState {
  status: 'none' | 'generating' | 'ready' | 'failed' | 'stale' | 'not_configured';
  imageUrl?: string;
  prompt?: string;
  generatedAt?: string;
  designVersion?: number; // Track which design version this visualization corresponds to
}

export type CanonicalCategory = 'dining_table' | 'wardrobe' | 'sofa' | 'tv_cabinet' | 'kitchen_set' | 'chair' | 'table' | 'other';

export interface FurnitureDesignState {
  version: number;
  
  category: CanonicalCategory | string; // Canonical enum e.g. "dining_table", "wardrobe"
  subcategory?: string;   // e.g. "Meja Makan Minimalis", "Lemari Sliding"
  
  dimensions?: FurnitureDimensions;
  capacity?: number;     // Canonical integer e.g. 6

  material?: string;     // e.g. "kayu jati", "walnut"
  color?: string;        // e.g. "natural", "walnut", "hitam matte"
  finish?: string;       // e.g. "matte", "glossy", "satin"

  style?: string;        // e.g. "minimalis", "modern", "industrial"
  shape?: string;        // e.g. "persegi panjang", "round", "L-shape"

  leg?: FurnitureLegSpec;
  sections?: number;     // e.g. 3 (pintu/sekat)

  requirements?: string[];
  notes?: string;

  status: 'draft' | 'review' | 'submitted';

  visualization?: FurnitureVisualizationState;
}

export interface CustomDesignRequest {
  id?: string;
  conversation_id: string;
  user_id?: string;
  design_state: FurnitureDesignState;
  customer_name?: string;
  customer_phone?: string;
  status: 'pending_review' | 'approved' | 'rejected' | 'contacted';
  created_at?: string;
}
