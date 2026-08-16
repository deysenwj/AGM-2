import React, { useState } from 'react';
import type { FurnitureDesignState } from '../types/furniture';

interface DesignSummaryCardProps {
  design: FurnitureDesignState;
  onUpdateDesign?: () => void;
  onSubmitToAdmin: () => void;
  isSubmitting?: boolean;
  isSubmitted?: boolean;
}

export const DesignSummaryCard: React.FC<DesignSummaryCardProps> = ({
  design,
  onUpdateDesign,
  onSubmitToAdmin,
  isSubmitting = false,
  isSubmitted = false
}) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Guardrail: Do not render if state lacks category or meaningful specifications
  if (!design || !design.category) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitToAdmin();
    setShowConfirmModal(false);
  };

  return (
    <div className="my-3 bg-slate-900 text-slate-100 rounded-lg p-3.5 border border-slate-800 text-xs font-sans select-none max-w-full">
      {/* Product Spec Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
        <span className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider">
          Spesifikasi Custom Furniture
        </span>
        <span className="text-[10px] font-mono text-slate-400 uppercase bg-slate-800 px-2 py-0.5 rounded">
          {isSubmitted ? 'Pending Review' : 'Draft Spec'}
        </span>
      </div>

      {/* Main Category & Style */}
      <h4 className="font-bold text-white text-sm capitalize tracking-tight mb-2.5">
        {design.category} {design.style ? `— Style ${design.style}` : ''}
      </h4>

      {/* Structured Technical Specs */}
      <div className="space-y-1.5 text-xs text-slate-300 mb-3.5 bg-slate-950 p-2.5 rounded border border-slate-800/80 font-sans">
        <div className="flex justify-between border-b border-slate-900 pb-1">
          <span className="text-slate-400">Ukuran (P × L × T)</span>
          <span className="font-medium text-white font-mono">
            {design.width || '?'} × {design.depth || '?'} × {design.height || '?'} cm
          </span>
        </div>

        <div className="flex justify-between border-b border-slate-900 pb-1">
          <span className="text-slate-400">Material Utama</span>
          <span className="font-medium text-white capitalize">{design.material || 'Sesuai rekomendasi'}</span>
        </div>

        <div className="flex justify-between border-b border-slate-900 pb-1">
          <span className="text-slate-400">Warna & Finishing</span>
          <span className="font-medium text-white capitalize">
            {design.color || 'Natural'} {design.finish ? `(${design.finish})` : ''}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-400">Kapasitas / Kuantitas</span>
          <span className="font-medium text-white">
            {design.capacity ? design.capacity : `${design.quantity || 1} Unit`}
          </span>
        </div>
      </div>

      {/* Price Safety Info */}
      <div className="mb-3.5 text-[11px] text-slate-300 bg-slate-950/80 border border-slate-800 p-2 rounded leading-relaxed">
        <strong>Pemberitahuan Estimasi:</strong> Harga final & waktu pengerjaan dikonfirmasi secara resmi oleh Admin AGM setelah pemeriksaan spesifikasi.
      </div>

      {/* Commerce Actions */}
      <div className="flex items-center gap-2">
        {onUpdateDesign && !isSubmitted && (
          <button
            onClick={onUpdateDesign}
            disabled={isSubmitting}
            className="flex-1 py-1.5 px-3 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition-colors cursor-pointer"
          >
            Ubah Spesifikasi
          </button>
        )}

        {isSubmitted ? (
          <div className="w-full py-1.5 px-3 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-center font-semibold text-xs flex items-center justify-center gap-1.5">
            Telah Diajukan ke Admin
          </div>
        ) : (
          <button
            onClick={() => setShowConfirmModal(true)}
            disabled={isSubmitting}
            aria-label="Ajukan spesifikasi ke admin"
            className="flex-1 py-1.5 px-3 rounded bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center"
          >
            {isSubmitting ? 'Mengirim...' : 'Ajukan ke Admin'}
          </button>
        )}
      </div>

      {/* Modal Dialog */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-lg p-4 max-w-xs w-full shadow-2xl">
            <h3 className="font-semibold text-sm text-white mb-1">Konfirmasi Pengajuan Custom</h3>
            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              Spesifikasi ini akan dikirim ke Admin AGM untuk penawaran harga resmi (*quotation*).
            </p>

            <form onSubmit={handleSubmit} className="space-y-2.5">
              <div>
                <label className="block text-[10px] font-mono text-slate-400 mb-0.5">Nama Kontak (Opsional)</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Contoh: Budi"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 mb-0.5">No. WhatsApp / Telepon (Opsional)</label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="0812xxxxxxxx"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 py-1.5 rounded border border-slate-700 bg-slate-800 text-slate-300 font-medium text-xs hover:bg-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-1.5 rounded bg-amber-600 text-white font-semibold text-xs hover:bg-amber-500"
                >
                  Kirim
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
