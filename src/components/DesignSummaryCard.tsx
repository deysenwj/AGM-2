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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitToAdmin();
    setShowConfirmModal(false);
  };

  return (
    <div className="my-2 bg-slate-900 text-white rounded-xl p-3.5 shadow-md border border-slate-800 text-xs sm:text-sm font-sans select-none max-w-full">
      {/* Header Badge */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          <span className="font-semibold text-amber-300 text-[11px] uppercase tracking-wider">Custom Furniture Spec</span>
        </div>
        <span className="text-[10px] font-mono text-slate-400 uppercase bg-slate-800 px-2 py-0.5 rounded">
          {isSubmitted ? 'Pending Review' : 'Draft Spec'}
        </span>
      </div>

      {/* Main Furniture Name */}
      <h4 className="font-bold text-white text-sm sm:text-base capitalize tracking-tight mb-2">
        {design.category} {design.style ? `(${design.style})` : ''}
      </h4>

      {/* Structured Grid Specs */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-slate-300 mb-3 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
        <div>
          <span className="text-slate-400 text-[10px] block font-mono">Ukuran (P × L × T)</span>
          <span className="font-medium text-white">
            {design.width || '?'} × {design.depth || '?'} × {design.height || '?'} cm
          </span>
        </div>

        <div>
          <span className="text-slate-400 text-[10px] block font-mono">Material Utama</span>
          <span className="font-medium text-white capitalize">{design.material || 'Belum ditentukan'}</span>
        </div>

        <div>
          <span className="text-slate-400 text-[10px] block font-mono">Warna & Finishing</span>
          <span className="font-medium text-white capitalize">
            {design.color || 'Natural'} {design.finish ? `(${design.finish})` : ''}
          </span>
        </div>

        <div>
          <span className="text-slate-400 text-[10px] block font-mono">Kapasitas / Jumlah</span>
          <span className="font-medium text-white">
            {design.capacity ? design.capacity : `${design.quantity || 1} Unit`}
          </span>
        </div>
      </div>

      {/* Price Safety Warning */}
      <div className="mb-3 text-[11px] text-slate-300 bg-amber-950/40 border border-amber-900/60 p-2 rounded-lg leading-relaxed flex items-start gap-1.5">
        <span className="text-amber-400 shrink-0 font-bold">ℹ</span>
        <span>
          <strong>Estimasi Harga:</strong> Harga final & waktu pengerjaan custom furniture akan dikonfirmasi resmi oleh Admin AGM.
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-1">
        {onUpdateDesign && !isSubmitted && (
          <button
            onClick={onUpdateDesign}
            disabled={isSubmitting}
            className="flex-1 py-1.5 px-3 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition-colors cursor-pointer"
          >
            Ubah Spesifikasi
          </button>
        )}

        {isSubmitted ? (
          <div className="w-full py-2 px-3 rounded-lg bg-emerald-900/60 border border-emerald-700/80 text-emerald-200 text-center font-semibold text-xs flex items-center justify-center gap-1.5">
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Telah Diajukan ke Admin
          </div>
        ) : (
          <button
            onClick={() => setShowConfirmModal(true)}
            disabled={isSubmitting}
            className="flex-1 py-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1"
          >
            {isSubmitting ? 'Mengirim...' : 'Ajukan ke Admin'}
          </button>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-xl p-4 max-w-xs w-full shadow-2xl animate-fade-in">
            <h3 className="font-bold text-sm text-white mb-1">Konfirmasi Pengajuan Custom</h3>
            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              Spesifikasi desain ini akan dikirim ke Admin AGM untuk penawaran harga resmi (*quotation*).
            </p>

            <form onSubmit={handleSubmit} className="space-y-2.5">
              <div>
                <label className="block text-[10px] font-mono text-slate-400 mb-0.5">Nama Anda (Opsional)</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Contoh: Budi"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 mb-0.5">No. WhatsApp / HP (Opsional)</label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="0812xxxxxxxx"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 font-medium text-xs hover:bg-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400"
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
