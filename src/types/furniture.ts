// src/types/furniture.ts

export interface FurnitureDesignState {
  id?: string;
  conversation_id?: string;
  user_id?: string;
  category: string; // e.g. 'meja makan', 'kursi', 'sofa', 'lemari', 'rak', 'TV cabinet', 'bed', etc.
  style?: string; // e.g. 'minimalis', 'modern', 'skandinavia', 'klasik', 'industrial'
  width?: number; // cm
  depth?: number; // cm
  height?: number; // cm
  material?: string; // e.g. 'kayu jati', 'kayu mahoni', 'plywood', 'besi', 'kain'
  color?: string; // e.g. 'natural', 'walnut', 'hitam', 'putih'
  finish?: string; // e.g. 'matte', 'glossy', 'satin'
  quantity?: number;
  capacity?: string; // e.g. '6 orang'
  notes?: string;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'quoted';
  estimated_price?: number | null;
}

export interface CustomDesignRequest {
  id?: string;
  design_id?: string;
  conversation_id: string;
  user_id?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_notes?: string;
  design_snapshot: FurnitureDesignState;
  status: 'pending_review' | 'approved' | 'rejected' | 'revision_requested' | 'quoted';
  admin_response?: string;
  quoted_price?: number;
  created_at?: string;
}

export const DEFAULT_DESIGN_STATE: FurnitureDesignState = {
  category: 'meja makan',
  style: 'minimalis',
  width: 180,
  depth: 80,
  height: 75,
  material: 'kayu jati',
  color: 'natural',
  finish: 'matte',
  quantity: 1,
  capacity: '6 orang',
  status: 'draft'
};
