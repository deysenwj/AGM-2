import React, { useState } from 'react';
import type { FurnitureDesignState, FurnitureDimensions } from '../types/furniture';

interface DesignSummaryCardProps {
  design: FurnitureDesignState;
  onUpdateDesign?: () => void;
  onSubmitToAdmin: (formData?: { customerName?: string; customerPhone?: string; customerNotes?: string }) => void;
  isSubmitting?: boolean;
  isSubmitted?: boolean;
  submittedReferenceNumber?: string | null;
  customRequestRecord?: any;
  onCustomerQuotationResponse?: (requestId: string, action: 'accept' | 'reject', note?: string) => Promise<void>;
}

const CATEGORY_DISPLAY_MAP: Record<string, string> = {
  dining_table: 'Meja Makan',
  wardrobe: 'Lemari Pakaian',
  sofa: 'Sofa',
  tv_cabinet: 'Meja TV',
  kitchen_set: 'Kitchen Set',
  chair: 'Kursi',
  table: 'Meja Kerja',
  other: 'Furniture Custom'
};

export const DesignSummaryCard: React.FC<DesignSummaryCardProps> = ({
  design,
  onUpdateDesign,
  onSubmitToAdmin,
  isSubmitting = false,
  isSubmitted = false,
  submittedReferenceNumber,
  customRequestRecord,
  onCustomerQuotationResponse
}) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [customerNotes, setCustomerNotes] = useState('');

  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [customerResponseNote, setCustomerResponseNote] = useState('');
  const [isResponding, setIsResponding] = useState(false);
  const [responseError, setResponseError] = useState<string | null>(null);


  if (!design || !design.category) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitToAdmin({ customerNotes });
    setShowConfirmModal(false);
  };

  const displayCategory = CATEGORY_DISPLAY_MAP[design.category] || design.subcategory || design.category.replace('_', ' ');

  const dims: FurnitureDimensions | undefined = design.dimensions;
  const lengthStr = dims?.length ? `${dims.length}` : '—';
  const widthStr = dims?.width ? `${dims.width}` : '—';
  const heightStr = dims?.height ? `${dims.height}` : '—';
  const hasAnyDim = dims?.length || dims?.width || dims?.height;
  const dimensionFormatted = hasAnyDim 
    ? `${lengthStr} × ${widthStr} × ${heightStr} ${dims?.unit || 'cm'}`
    : 'Belum ditentukan';

  const visStatus = design.visualization?.status;
  const hasVisualization = !!(customRequestRecord?.visualization_url || design.visualization?.imageUrl);
  const visUrl = customRequestRecord?.visualization_url || design.visualization?.imageUrl;

  // Status & Quotation Details
  const currentStatus = (customRequestRecord?.status || (isSubmitted ? 'submitted' : 'draft')).toLowerCase();
  const statusUpper = currentStatus.toUpperCase();

  const refNumber = customRequestRecord?.reference_number || submittedReferenceNumber || 'AGM-CUSTOM-REQUEST';
  const quotedPrice = customRequestRecord?.quoted_price;
  const adminResponse = customRequestRecord?.admin_response;
  const customerResponseStatus = customRequestRecord?.customer_response;


  // Timeline Step Calculations
  const isRejected = currentStatus === 'rejected';
  let activeStepIndex = 0;
  if (currentStatus === 'submitted') activeStepIndex = 1;
  else if (currentStatus === 'reviewing') activeStepIndex = 2;
  else if (currentStatus === 'quoted') activeStepIndex = 3;
  else if (currentStatus === 'approved') activeStepIndex = 4;
  else if (currentStatus === 'completed') activeStepIndex = 5;
  else if (currentStatus === 'rejected') activeStepIndex = 3;

  const timelineSteps = isRejected 
    ? ['Diterima', 'Direview', 'Ditolak']
    : ['Diterima', 'Direview', 'Penawaran', 'Disetujui', 'Selesai'];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5 shadow-xl my-2 max-w-sm w-full font-sans text-left">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          <h4 className="font-semibold text-sm text-white capitalize">{displayCategory}</h4>
        </div>
        <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-300">
          V{design.version || 1}
        </span>
      </div>

      {hasVisualization ? (
        <div className="mb-3 rounded overflow-hidden border border-slate-800 bg-slate-950">
          <img 
            src={visUrl} 
            alt="Visualisasi Furniture Custom" 
            className="w-full h-48 object-cover rounded"
          />
          <div className="p-2 text-[10px] text-slate-400 font-mono flex justify-between bg-slate-900">
            <span>Visualisasi Desain (V{design.visualization?.designVersion || design.version || 1})</span>
            {visStatus === 'stale' && <span className="text-amber-400">Versi Lama (Stale)</span>}
          </div>
        </div>
      ) : (
        <div className="mb-3 p-3 bg-slate-950 border border-slate-800 rounded text-center text-xs text-slate-400 space-y-1">
          <p className="font-medium text-slate-300">Visualisasi Belum Tersedia</p>
          <p className="text-[11px] text-slate-500">Pengajuan ini diproses berdasarkan spesifikasi ukuran dan material.</p>
        </div>
      )}

      <div className="space-y-1.5 text-xs text-slate-300 mb-3.5 bg-slate-950 p-2.5 rounded border border-slate-800/80 font-sans">
        <div className="flex justify-between border-b border-slate-900 pb-1">
          <span className="text-slate-400">Ukuran (P × L × T)</span>
          <span className="font-medium text-white font-mono">{dimensionFormatted}</span>
        </div>
        {design.material && (
          <div className="flex justify-between border-b border-slate-900 pb-1">
            <span className="text-slate-400">Material Utama</span>
            <span className="font-medium text-white capitalize">{design.material}</span>
          </div>
        )}
        {(design.color || design.finish) && (
          <div className="flex justify-between border-b border-slate-900 pb-1">
            <span className="text-slate-400">Warna & Finishing</span>
            <span className="font-medium text-white capitalize">
              {design.color || 'Natural'} {design.finish ? `(${design.finish})` : ''}
            </span>
          </div>
        )}
        {design.capacity && (
          <div className="flex justify-between">
            <span className="text-slate-400">Kapasitas</span>
            <span className="font-medium text-white">{design.capacity} Orang</span>
          </div>
        )}
      </div>

      {/* ── CUSTOMER STATUS TIMELINE & QUOTATION BOX ── */}
      {(isSubmitted || customRequestRecord) ? (
        <div className="space-y-3 bg-slate-950/90 border border-slate-800 p-3 rounded-lg mb-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div>
              <span className="text-[9px] font-mono text-slate-500 uppercase block">Nomor Referensi</span>
              <strong className="text-xs font-mono text-amber-400">{refNumber}</strong>
            </div>
            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
              isRejected ? 'bg-rose-950 text-rose-300 border border-rose-800' :
              currentStatus === 'completed' ? 'bg-slate-100 text-slate-900' :
              currentStatus === 'approved' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
              currentStatus === 'quoted' ? 'bg-purple-950 text-purple-300 border border-purple-800' :
              currentStatus === 'reviewing' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
              'bg-sky-950 text-sky-300 border border-sky-800'
            }`}>
              {statusUpper}
            </span>
          </div>

          {/* Workflow Progress Timeline */}
          <div>
            <span className="text-[9px] uppercase font-bold text-slate-500 block mb-1.5">Progress Workflow</span>
            <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
              {timelineSteps.map((stepName, idx) => {
                const stepNum = idx + 1;
                const isPassed = stepNum <= activeStepIndex;
                const isCurrent = stepNum === activeStepIndex;
                return (
                  <div key={idx} className="flex flex-col items-center flex-1 text-center">
                    <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold mb-1 ${
                      isRejected && stepNum === 3 ? 'bg-rose-600 text-white' :
                      isCurrent ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400/40' :
                      isPassed ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500'
                    }`}>
                      {isPassed ? '✓' : stepNum}
                    </div>
                    <span className={isCurrent ? 'text-amber-300 font-bold' : isPassed ? 'text-slate-200' : 'text-slate-600'}>
                      {stepName}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

      {/* Quotation & Admin Note Box */}
      {(quotedPrice !== undefined && quotedPrice !== null || adminResponse) && (
        <div className="mt-2 pt-2 border-t border-slate-800/80 space-y-2 text-xs">
          {quotedPrice !== undefined && quotedPrice !== null && (
            <div>
              <span className="text-slate-400 text-[10px] block font-medium">Harga Penawaran Resmi</span>
              <strong className="text-amber-400 font-mono text-sm font-bold">
                Rp {Number(quotedPrice).toLocaleString('id-ID')}
              </strong>
            </div>
          )}
          {adminResponse && (
            <div>
              <span className="text-slate-400 text-[10px] block font-medium">Respons Admin AGM</span>
              <p className="text-slate-200 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">{adminResponse}</p>
            </div>
          )}

          {/* Customer Quotation Acceptance Actions (QUOTED Status) */}
          {currentStatus === 'quoted' && onCustomerQuotationResponse && (
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              <span className="text-[10px] uppercase font-bold text-amber-300 block">Keputusan Penawaran Harga</span>
              {responseError && (
                <div className="p-2 rounded bg-rose-950/80 border border-rose-800 text-rose-200 text-[11px]">
                  {responseError}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setResponseError(null); setShowAcceptModal(true); }}
                  disabled={isResponding}
                  className="flex-1 py-1.5 px-2 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs transition-colors cursor-pointer text-center"
                >
                  Setujui Penawaran
                </button>
                <button
                  type="button"
                  onClick={() => { setResponseError(null); setShowRejectModal(true); }}
                  disabled={isResponding}
                  className="flex-1 py-1.5 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs transition-colors cursor-pointer text-center"
                >
                  Tolak Penawaran
                </button>
              </div>
            </div>
          )}

          {/* Locked Decision Status */}
          {customerResponseStatus === 'accepted' && (
            <div className="pt-2 border-t border-slate-800/80 text-[11px] font-mono text-emerald-300 font-bold flex items-center gap-1.5">
              <span>✓</span>
              <span>PENAWARAN TELAH ANDA SETUJUI</span>
            </div>
          )}
          {customerResponseStatus === 'rejected' && (
            <div className="pt-2 border-t border-slate-800/80 text-[11px] font-mono text-rose-300 font-bold flex items-center gap-1.5">
              <span>✕</span>
              <span>PENAWARAN TELAH DITOLAK</span>
            </div>
          )}
        </div>
      )}
    </div>
  ) : (
    <div className="mb-3.5 text-[11px] text-slate-300 bg-slate-950/80 border border-slate-800 p-2 rounded leading-relaxed">
      <strong>Pemberitahuan Estimasi:</strong> Harga final & waktu pengerjaan dikonfirmasi resmi oleh Admin AGM.
    </div>
  )}

  <div className="flex flex-col sm:flex-row items-center gap-2">
    {onUpdateDesign && !isSubmitted && !customRequestRecord && (
      <button
        onClick={onUpdateDesign}
        disabled={isSubmitting}
        className="w-full sm:flex-1 py-1.5 px-3 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition-colors cursor-pointer"
      >
        Ubah Spesifikasi
      </button>
    )}

    {isSubmitted || customRequestRecord ? (
      <div className="w-full text-center py-1.5 text-[11px] font-mono text-slate-400 bg-slate-950 border border-slate-800 rounded">
        OPERATIONS VIEW • LOCKED READ-ONLY
      </div>
    ) : (
      <button
        onClick={() => setShowConfirmModal(true)}
        disabled={isSubmitting}
        className="w-full sm:flex-1 py-2 px-3 rounded bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow-xs transition-all cursor-pointer text-center"
      >
        {isSubmitting ? 'Mengirim...' : 'Ajukan ke Admin'}
      </button>
    )}
  </div>

  {/* Accept Confirmation Modal */}
  {showAcceptModal && (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 text-white rounded-lg p-5 max-w-sm w-full shadow-2xl space-y-4 text-left">
        <div className="border-b border-slate-800 pb-2">
          <h3 className="font-semibold text-sm text-emerald-400">SETUJUI PENAWARAN HARGA?</h3>
          <p className="text-xs text-slate-400 font-mono mt-0.5">{refNumber}</p>
        </div>

        <div className="bg-slate-950 border border-slate-800/80 rounded p-3 text-xs space-y-2 text-slate-300">
          <div className="flex justify-between border-b border-slate-900 pb-1">
            <span className="text-slate-400">Harga Penawaran</span>
            <span className="font-medium text-amber-400 font-mono">Rp {Number(quotedPrice).toLocaleString('id-ID')}</span>
          </div>
          {adminResponse && (
            <div className="border-b border-slate-900 pb-1">
              <span className="text-slate-400 block text-[10px]">Catatan Admin</span>
              <span className="text-slate-200 font-mono text-[11px]">{adminResponse}</span>
            </div>
          )}
          <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
            Dengan menyetujui penawaran ini, Anda mengonfirmasi bahwa harga yang diberikan AGM dapat dilanjutkan ke tahap berikutnya.
          </p>
        </div>

        <div>
          <label className="block text-[11px] text-slate-400 mb-1">Catatan Tambahan (Opsional)</label>
          <textarea
            value={customerResponseNote}
            onChange={(e) => setCustomerResponseNote(e.target.value)}
            placeholder="Tambahkan catatan untuk Admin AGM..."
            maxLength={1000}
            rows={2}
            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-sans"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setShowAcceptModal(false)}
            disabled={isResponding}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!onCustomerQuotationResponse) return;
              setIsResponding(true);
              setResponseError(null);
              try {
                await onCustomerQuotationResponse(customRequestRecord?.id, 'accept', customerResponseNote);
                setShowAcceptModal(false);
              } catch (err: any) {
                setResponseError(err?.message || 'Gagal menyetujui penawaran.');
              } finally {
                setIsResponding(false);
              }
            }}
            disabled={isResponding}
            className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors shadow-xs cursor-pointer"
          >
            {isResponding ? 'Memproses...' : 'Setujui Penawaran'}
          </button>
        </div>
      </div>
    </div>
  )}

  {/* Reject Confirmation Modal */}
  {showRejectModal && (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 text-white rounded-lg p-5 max-w-sm w-full shadow-2xl space-y-4 text-left">
        <div className="border-b border-slate-800 pb-2">
          <h3 className="font-semibold text-sm text-rose-400">TOLAK PENAWARAN HARGA?</h3>
          <p className="text-xs text-slate-400 font-mono mt-0.5">{refNumber}</p>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Apakah Anda yakin ingin menolak penawaran harga ini? Mohon berikan alasan untuk membantu kami menyesuaikan penawaran.
        </p>

        <div>
          <label className="block text-[11px] text-slate-400 mb-1">Catatan / Alasan Penolakan (Opsional)</label>
          <textarea
            value={customerResponseNote}
            onChange={(e) => setCustomerResponseNote(e.target.value)}
            placeholder="Contoh: Budget melebihi estimasi awal..."
            maxLength={1000}
            rows={3}
            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 font-sans"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setShowRejectModal(false)}
            disabled={isResponding}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!onCustomerQuotationResponse) return;
              setIsResponding(true);
              setResponseError(null);
              try {
                await onCustomerQuotationResponse(customRequestRecord?.id, 'reject', customerResponseNote);
                setShowRejectModal(false);
              } catch (err: any) {
                setResponseError(err?.message || 'Gagal menolak penawaran.');
              } finally {
                setIsResponding(false);
              }
            }}
            disabled={isResponding}
            className="px-4 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded transition-colors shadow-xs cursor-pointer"
          >
            {isResponding ? 'Memproses...' : 'Tolak Penawaran'}
          </button>
        </div>
      </div>
    </div>
  )}


      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-lg p-5 max-w-sm w-full shadow-2xl space-y-4 text-left">
            <div className="border-b border-slate-800 pb-2">
              <h3 className="font-semibold text-sm text-white">AJUKAN DESAIN KE AGM</h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{displayCategory} — V{design.version || 1}</p>
            </div>

            <div className="bg-slate-950 border border-slate-800/80 rounded p-3 text-xs space-y-2 text-slate-300">
              <div className="flex justify-between border-b border-slate-900 pb-1">
                <span className="text-slate-400">Ukuran</span>
                <span className="font-mono text-white">{dimensionFormatted}</span>
              </div>
              <div className="flex justify-between border-b border-slate-900 pb-1">
                <span className="text-slate-400">Material</span>
                <span className="capitalize text-white">{design.material || 'Belum ditentukan'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-900 pb-1">
                <span className="text-slate-400">Visualisasi</span>
                <span className="text-white">{hasVisualization ? `V${design.version || 1} — Tersedia` : 'Belum Ada (Draf)'}</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">Catatan untuk Admin (Opsional)</label>
                <textarea
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="Tuliskan catatan khusus atau permintaan tambahan..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 py-1.5 rounded border border-slate-700 bg-slate-800 text-slate-300 font-medium text-xs hover:bg-slate-700 cursor-pointer"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-1.5 rounded bg-amber-600 text-white font-semibold text-xs hover:bg-amber-500 cursor-pointer"
                >
                  {isSubmitting ? 'Mengirim...' : 'Ajukan Desain'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
