export interface FurnitureDimensions {
  width?: number;   // Panjang / Width (cm)
  depth?: number;   // Lebar / Depth (cm)
  height?: number;  // Tinggi / Height (cm)
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
}

export interface FurnitureDesignState {
  version: number;
  
  category: string;      // e.g. "dining_table", "wardrobe", "sofa", "tv_cabinet", "kitchen_set"
  subcategory?: string;   // e.g. "meja makan minimalis", "lemari sliding"
  
  dimensions?: FurnitureDimensions;
  capacity?: number;     // e.g. 6 (people / seats)

  material?: string;     // e.g. "kayu jati", "walnut", "plywood HPL"
  color?: string;        // e.g. "natural", "walnut", "hitam matte"
  finish?: string;       // e.g. "matte", "glossy", "satin"

  style?: string;        // e.g. "minimalis", "modern", "industrial"
  shape?: string;        // e.g. "persegi panjang", "round", "L-shape"

  leg?: FurnitureLegSpec;
  sections?: number;     // e.g. 3 pintu (wardrobe)

  requirements?: string[]; // e.g. ["tahan air", "laci tersembunyi"]
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
