import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import type { Product } from './App';

interface NotaItem {
  product: Product;
  quantity: number;
}

interface NotaViewProps {
  products: Product[];
  triggerToast: (message: string) => void;
  isAdmin: boolean;
  adjustStock: (id: string, amount: number) => Promise<void>;
  deductBulkStock?: (items: { productId: string; quantity: number }[]) => Promise<void>;
  addTransaction: (tx: any) => Promise<void>;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
};

const parseDotsToNumber = (val: string | number): number => {
  if (typeof val === 'number') return val;
  const numStr = String(val).replace(/\D/g, '');
  return numStr ? Number(numStr) : 0;
};

const generateNotaHtml = (
  notaId: string,
  dateStr: string,
  customerName: string,
  customerPhone?: string,
  customerAddress?: string,
  customerNotes?: string,
  selectedProducts: NotaItem[] = [],
  payVal: number = 0,
  isPrintMode: boolean = false
) => {
  const subtotalVal = selectedProducts.reduce((acc, item) => {
    return acc + ((item.product.price - item.product.discount) * item.quantity);
  }, 0);

  const numericPay = Math.max(0, payVal);
  const kembaliVal = numericPay > subtotalVal ? numericPay - subtotalVal : 0;
  const kurangVal = numericPay > 0 && numericPay < subtotalVal ? subtotalVal - numericPay : (numericPay === 0 ? subtotalVal : 0);

  const itemsHtml = selectedProducts.map(item => {
    const discountedPrice = item.product.price - item.product.discount;
    const itemSubtotal = discountedPrice * item.quantity;
    return `
      <tr>
        <td style="padding: 6px 4px 6px 0; font-weight: bold; word-break: break-word;">${item.product.name}</td>
        <td style="padding: 6px 0; text-align: center; font-weight: bold;">${item.quantity}</td>
        <td style="padding: 6px 8px 6px 0; text-align: right; white-space: nowrap;">${formatCurrency(discountedPrice)}</td>
        <td style="padding: 6px 0; text-align: right; font-weight: bold; white-space: nowrap;">${formatCurrency(itemSubtotal)}</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${notaId}</title>
        <meta charset="utf-8">
        <style>
          @page {
            size: 110mm auto;
            margin: 0;
          }
          body {
            width: 100mm;
            margin: 0 auto;
            padding: 14px;
            font-family: 'Courier New', Courier, monospace, sans-serif;
            font-size: 10pt;
            line-height: 1.45;
            color: #111;
            background-color: #fff;
          }
          .header {
            text-align: center;
            margin-bottom: 10px;
          }
          .store-address {
            font-size: 8.5pt;
            color: #333;
            line-height: 1.35;
          }
          .divider {
            border-top: 1.5px dashed #333;
            margin: 10px 0;
          }
          .info-table {
            width: 100%;
            table-layout: fixed;
            border-collapse: collapse;
            font-size: 9.5pt;
          }
          .info-table td {
            padding: 3px 0;
          }
          .items-table {
            width: 100%;
            table-layout: fixed;
            border-collapse: collapse;
            font-size: 9.5pt;
          }
          .items-table th {
            border-bottom: 1.5px dashed #333;
            padding: 5px 0;
            font-weight: bold;
            font-size: 9pt;
            text-transform: uppercase;
          }
          .summary-table {
            width: 100%;
            table-layout: fixed;
            border-collapse: collapse;
            font-size: 10pt;
            margin-top: 4px;
          }
          .summary-table td {
            padding: 3.5px 0;
          }
          .row-total {
            font-weight: bold;
            font-size: 11pt;
          }
          .row-pay {
            font-weight: bold;
          }
          .row-change {
            font-weight: bold;
          }
          .row-remaining {
            font-weight: bold;
            color: #c2410c;
          }
          @media print {
            body {
              padding: 4px;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="${window.location.origin}/logo.png" style="height: 34px; max-width: 140px; object-fit: contain; margin: 0 auto 4px auto; display: block;" alt="AGM 2 Logo" />
          <div class="store-address">Jalan Rahadi Ismail, Desa Padang,<br>Kec. Benua Kayong, Kab. Ketapang</div>
          <div class="store-address" style="margin-top: 3px; font-weight: bold;">WhatsApp: 0896-9412-7723</div>
        </div>
        
        <div class="divider"></div>
        
        <table class="info-table">
          <colgroup>
            <col style="width: 35%;" />
            <col style="width: 65%;" />
          </colgroup>
          <tr>
            <td>No Nota:</td>
            <td style="text-align: right; font-weight: bold;">${notaId}</td>
          </tr>
          <tr>
            <td>Tanggal:</td>
            <td style="text-align: right;">${dateStr}</td>
          </tr>
          <tr style="border-top: 1px solid #eee;">
            <td style="font-weight: bold; padding-top: 4px;">Pelanggan:</td>
            <td style="text-align: right; padding-top: 4px; font-weight: bold;">${customerName}</td>
          </tr>
          ${customerPhone && customerPhone.trim() ? `
          <tr>
            <td>No. HP:</td>
            <td style="text-align: right;">${customerPhone}</td>
          </tr>` : ''}
          ${customerAddress && customerAddress.trim() ? `
          <tr>
            <td>Alamat:</td>
            <td style="text-align: right; max-width: 180px; word-wrap: break-word;">${customerAddress}</td>
          </tr>` : ''}
          ${customerNotes && customerNotes.trim() ? `
          <tr>
            <td>Keterangan:</td>
            <td style="text-align: right; max-width: 180px; word-wrap: break-word;">${customerNotes}</td>
          </tr>` : ''}
        </table>
        
        <div class="divider"></div>
        
        <table class="items-table">
          <colgroup>
            <col style="width: 34%;" />
            <col style="width: 10%;" />
            <col style="width: 28%;" />
            <col style="width: 28%;" />
          </colgroup>
          <thead>
            <tr>
              <th style="text-align: left; padding: 5px 4px 5px 0;">Item</th>
              <th style="text-align: center; padding: 5px 0;">Qty</th>
              <th style="text-align: right; padding: 5px 8px 5px 0;">Harga</th>
              <th style="text-align: right; padding: 5px 0;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        
        <div class="divider"></div>
        
        <table class="summary-table">
          <tr class="row-total">
            <td>Subtotal:</td>
            <td style="text-align: right;">${formatCurrency(subtotalVal)}</td>
          </tr>
          <tr class="row-pay">
            <td>Bayar:</td>
            <td style="text-align: right;">${formatCurrency(numericPay)}</td>
          </tr>
          ${kurangVal > 0 ? `
          <tr class="row-remaining">
            <td>Kurang (Sisa):</td>
            <td style="text-align: right;">${formatCurrency(kurangVal)}</td>
          </tr>` : ''}
          ${kembaliVal > 0 ? `
          <tr class="row-change">
            <td>Kembalian:</td>
            <td style="text-align: right;">${formatCurrency(kembaliVal)}</td>
          </tr>` : ''}
        </table>
        
        <div class="divider" style="margin-top: 12px;"></div>
        
        <div style="text-align: center; font-size: 9pt; margin-top: 10px; line-height: 1.35; color: #444;">
          Terima Kasih atas Kunjungan Anda!<br>
          Barang yang sudah dibeli tidak dapat ditukar/dikembalikan.
        </div>
        ${isPrintMode ? `
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>` : ''}
      </body>
    </html>
  `;
};

const NotaView: React.FC<NotaViewProps> = ({ products, triggerToast, isAdmin, adjustStock, deductBulkStock, addTransaction }) => {
  const [selectedProducts, setSelectedProducts] = useState<NotaItem[]>([]);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [customerNotes, setCustomerNotes] = useState<string>('');
  const [payAmount, setPayAmount] = useState<string>('');

  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [isProcessingPrint, setIsProcessingPrint] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const notaRef = useRef<HTMLDivElement>(null);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>(products);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFilteredProducts(
      products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [searchTerm, products]);

  const handleAddProduct = (product: Product) => {
    const existingItem = selectedProducts.find(item => item.product.id === product.id);
    const currentQty = existingItem ? existingItem.quantity : 0;
    
    if (product.stock <= 0) {
      triggerToast('Stok produk habis!');
      return;
    }
    
    if (currentQty + 1 > product.stock) {
      triggerToast(`Stok tidak mencukupi! Maksimal: ${product.stock}`);
      return;
    }

    if (existingItem) {
      setSelectedProducts(prev =>
        prev.map(item =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
    } else {
      setSelectedProducts(prev => [...prev, { product, quantity: 1 }]);
    }
  };

  const handleUpdateQuantity = (productId: string, newQuantity: number) => {
    const item = selectedProducts.find(i => i.product.id === productId);
    if (!item) return;

    let targetQty = Math.max(0, newQuantity);
    if (targetQty > item.product.stock) {
      triggerToast(`Stok tidak mencukupi! Maksimal: ${item.product.stock}`);
      targetQty = item.product.stock;
    }

    setSelectedProducts(prev =>
      prev
        .map(item =>
          item.product.id === productId ? { ...item, quantity: targetQty } : item
        )
        .filter(item => item.quantity > 0)
    );
  };

  const handleRemoveProduct = (productId: string) => {
    setSelectedProducts(prev => prev.filter(item => item.product.id !== productId));
  };

  const calculateTotal = () => {
    return selectedProducts.reduce((acc, item) => {
      const discountedPrice = item.product.price - item.product.discount;
      return acc + (discountedPrice * item.quantity);
    }, 0);
  };

  const handlePrintNota = () => {
    if (!customerName.trim()) {
      triggerToast('Nama pelanggan tidak boleh kosong!');
      return;
    }
    if (selectedProducts.length === 0) {
      triggerToast('Pilih setidaknya satu produk!');
      return;
    }

    for (const item of selectedProducts) {
      if (item.quantity > item.product.stock) {
        triggerToast(`Stok untuk ${item.product.name} tidak cukup!`);
        return;
      }
    }

    setIsConfirming(true);
  };

  const executePrintAndSync = async (printType: 'pdf' | 'image') => {
    setIsProcessingPrint(true);
    const notaId = `NOTA-${Date.now()}`;
    const dateStr = new Date().toLocaleString('id-ID');
    const totalVal = calculateTotal();
    const payVal = parseDotsToNumber(payAmount);
    const kembaliVal = payVal > totalVal ? payVal - totalVal : 0;
    const kurangVal = payVal > 0 && payVal < totalVal ? totalVal - payVal : (payVal === 0 ? totalVal : 0);

    try {
      if (deductBulkStock) {
        await deductBulkStock(selectedProducts.map(i => ({ productId: i.product.id, quantity: i.quantity })));
      } else {
        for (const item of selectedProducts) {
          await adjustStock(item.product.id, -item.quantity);
        }
      }

      const txItems = selectedProducts.map(item => ({
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        price: item.product.price - item.product.discount,
      }));

      const newTx = {
        id: notaId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        customerAddress: customerAddress.trim() || undefined,
        notes: customerNotes.trim() || undefined,
        totalPrice: totalVal,
        payAmount: payVal,
        changeAmount: kembaliVal,
        remainingAmount: kurangVal,
        items: txItems,
        date: dateStr,
        dateRaw: new Date().toISOString(),
      };

      await addTransaction(newTx);
      triggerToast('Stok diperbarui & transaksi disimpan.');

      const buttonsToHide = document.querySelectorAll('.print-hidden-button');
      if (printType === 'image') {
        buttonsToHide.forEach(button => (button as HTMLElement).style.display = 'none');
      }

      try {
        if (printType === 'pdf') {
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            const htmlStr = generateNotaHtml(
              notaId, dateStr, customerName, customerPhone, customerAddress, customerNotes,
              selectedProducts, payVal, true
            );
            printWindow.document.write(htmlStr);
            printWindow.document.close();
            triggerToast('Nota berhasil dicetak / diunduh PDF!');
          } else {
            triggerToast('Gagal memproses cetak. Izinkan pop-up browser Anda.');
          }
        } else {
          await handlePrintAsImageInternal(notaId, dateStr, payVal, selectedProducts);
        }
      } finally {
        buttonsToHide.forEach(button => (button as HTMLElement).style.display = '');
        setSelectedProducts([]);
        setCustomerName('');
        setCustomerPhone('');
        setCustomerAddress('');
        setCustomerNotes('');
        setPayAmount('');
        setIsConfirming(false);
        setIsProcessingPrint(false);
      }

    } catch (err: any) {
      console.error('Failed to process stock update or transaction save:', err);
      triggerToast('Gagal memproses nota: ' + err.message);
      setIsProcessingPrint(false);
    }
  };

  const handlePrintAsImageInternal = async (
    notaId: string,
    dateStr: string,
    payVal: number,
    selectedProducts: NotaItem[]
  ) => {
    const printHtml = generateNotaHtml(
      notaId, dateStr, customerName, customerPhone, customerAddress, customerNotes,
      selectedProducts, payVal, false
    );

    const iframe = document.createElement('iframe');
    iframe.style.visibility = 'hidden';
    iframe.style.position = 'absolute';
    iframe.style.width = '100mm';
    iframe.style.height = 'min-content';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) {
      triggerToast('Gagal membuat iframe.');
      document.body.removeChild(iframe);
      return;
    }
    iframeDoc.open();
    iframeDoc.write(printHtml);
    iframeDoc.close();

    await new Promise(resolve => setTimeout(resolve, 150));

    try {
      const canvas = await html2canvas(iframeDoc.body, { 
        scale: 2,
        useCORS: true, 
        logging: false, 
        allowTaint: true, 
        backgroundColor: '#ffffff', 
        ignoreElements: (element) => element.tagName === 'SCRIPT',
      });

      const imageData = canvas.toDataURL('image/jpeg', 0.95);
      const byteString = atob(imageData.split(',')[1]);
      const mimeString = imageData.split(',')[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `nota-${notaId}.jpg`; 
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      triggerToast('Nota berhasil diunduh sebagai gambar JPG!'); 

    } catch (error: any) { 
      console.error('Error generating image from iframe:', error);
      triggerToast('Gagal mengunduh gambar nota.');
    } finally {
      document.body.removeChild(iframe);
    }
  };

  const subtotal = calculateTotal();
  const numericPay = parseDotsToNumber(payAmount);
  const changeAmount = numericPay > subtotal ? numericPay - subtotal : 0;
  const remainingAmount = numericPay > 0 && numericPay < subtotal ? subtotal - numericPay : (numericPay === 0 ? subtotal : 0);

  const handlePayAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    if (!rawVal) {
      setPayAmount('');
      return;
    }
    setPayAmount(Number(rawVal).toLocaleString('id-ID'));
  };

  return (
    <section className="px-margin-mobile lg:px-margin-desktop py-6 max-w-[1300px] mx-auto w-full flex-grow">
      {isAdmin ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* ── LEFT COLUMN: ETALASE PRODUK ── */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-base text-slate-900">Etalase Stok Produk</h3>
                <p className="text-xs text-slate-500">Pilih barang untuk ditambahkan ke dalam nota</p>
              </div>
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg">
                Stok: {products.length} Item
              </span>
            </div>
            
            {/* Search Input Bar */}
            <div className="mb-4">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Cari produk..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-slate-900 focus:bg-white transition-all outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            {filteredProducts.length === 0 && searchTerm ? (
              <div className="text-center py-12 text-slate-400 text-sm">Tidak ada produk ditemukan.</div>
            ) : filteredProducts.length === 0 && !searchTerm ? (
              <div className="text-center py-12 text-slate-400 text-sm">Belum ada produk di etalase.</div>
            ) : (
              <div>
                {/* Desktop Table View */}
                <div className="hidden md:block max-h-[500px] overflow-y-auto border border-slate-200 rounded-xl">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Produk</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Harga</th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase">Stok</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredProducts.map(p => {
                        const inNota = selectedProducts.find(i => i.product.id === p.id);
                        return (
                          <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-sm font-semibold text-slate-900">{p.name}</td>
                            <td className="px-4 py-3 text-sm text-slate-700 font-medium">{formatCurrency(p.price - p.discount)}</td>
                            <td className="px-4 py-3 text-sm text-center">
                              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0 whitespace-nowrap ${p.stock <= 3 && p.stock > 0 ? 'bg-amber-50 text-amber-800 border border-amber-200' : p.stock === 0 ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                                {p.stock} {p.unit}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => handleAddProduct(p)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                  inNota 
                                    ? 'bg-slate-800 text-white hover:bg-slate-900' 
                                    : 'bg-slate-900 text-white hover:bg-slate-800'
                                }`}
                              >
                                {inNota ? `+ Tambah (${inNota.quantity})` : '+ Tambah'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View */}
                <div className="md:hidden space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
                  {filteredProducts.map(p => {
                    const inNota = selectedProducts.find(i => i.product.id === p.id);
                    return (
                      <div key={'mob-p-' + p.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-xs text-slate-900 truncate">{p.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-semibold text-xs text-slate-800">{formatCurrency(p.price - p.discount)}</span>
                            <span className="text-[10px] text-slate-500 font-medium">Stok: {p.stock}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleAddProduct(p)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer ${
                            inNota ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'
                          }`}
                        >
                          {inNota ? `x${inNota.quantity} +` : '+ Tambah'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN: KASIR NOTA & PEMBAYARAN ── */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col">
            <h3 className="font-bold text-base text-slate-900 mb-4">Detail &amp; Pembayaran Nota</h3>
            
            <div className="space-y-3 mb-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-xs">Nama Pelanggan <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="cth: Ibu Rahma"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-medium focus:ring-1 focus:ring-slate-900 focus:bg-white transition-all outline-none"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-xs">Uang Diterima / Bayar (Rp)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0 (cth: 500.000)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm font-bold text-slate-900 focus:ring-1 focus:ring-slate-900 focus:bg-white transition-all outline-none"
                    value={payAmount}
                    onChange={handlePayAmountChange}
                  />
                </div>
                {/* Preset Cash Button */}
                <div className="flex flex-wrap gap-1 mt-2">
                  <button 
                    type="button" 
                    onClick={() => setPayAmount(subtotal.toLocaleString('id-ID'))}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs"
                  >
                    Uang Pas
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 text-xs">No. HP (Opsional)</label>
                  <input
                    type="text"
                    placeholder="0812xxxxxxxx"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-slate-900 focus:bg-white transition-all outline-none"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 text-xs">Alamat (Opsional)</label>
                  <input
                    type="text"
                    placeholder="Alamat singkat"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-slate-900 focus:bg-white transition-all outline-none"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-xs">Keterangan (Opsional)</label>
                <input
                  type="text"
                  placeholder="cth: DP 50%, Lunas, Titip Toko, dll."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium focus:ring-1 focus:ring-slate-900 focus:bg-white transition-all outline-none"
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                />
              </div>
            </div>

            {/* Item List Table */}
            <div className="flex-grow overflow-x-auto max-h-44 overflow-y-auto mb-4 border border-slate-200 rounded-xl">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-3.5 py-2 text-left text-xs font-bold text-slate-500 uppercase">Item</th>
                    <th className="px-3.5 py-2 text-center text-xs font-bold text-slate-500 uppercase">Qty</th>
                    <th className="px-3.5 py-2 text-right text-xs font-bold text-slate-500 uppercase">Subtotal</th>
                    <th className="px-3.5 py-2 text-right text-xs font-bold text-slate-500 uppercase"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedProducts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-xs text-slate-400">Belum ada item ditambahkan</td>
                    </tr>
                  ) : (
                    selectedProducts.map(item => (
                      <tr key={item.product.id}>
                        <td className="px-3.5 py-2 text-xs font-semibold text-slate-900">{item.product.name}</td>
                        <td className="px-3.5 py-2 text-xs text-center">
                          <div className="inline-flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                            <button 
                              onClick={() => handleUpdateQuantity(item.product.id, item.quantity - 1)}
                              className="w-4 h-4 flex items-center justify-center font-bold text-slate-700 hover:bg-white rounded"
                            >-</button>
                            <span className="w-5 text-center font-bold text-xs">{item.quantity}</span>
                            <button 
                              onClick={() => handleUpdateQuantity(item.product.id, item.quantity + 1)}
                              className="w-4 h-4 flex items-center justify-center font-bold text-slate-700 hover:bg-white rounded"
                            >+</button>
                          </div>
                        </td>
                        <td className="px-3.5 py-2 text-right text-xs font-bold text-slate-900">
                          {formatCurrency((item.product.price - item.product.discount) * item.quantity)}
                        </td>
                        <td className="px-3.5 py-2 text-right">
                          <button
                            onClick={() => handleRemoveProduct(item.product.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            title="Hapus Item"
                          >
                            <svg className="w-3.5 h-3.5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18" />
                              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Simple Clean Payment Summary Box */}
            <div className="mt-auto pt-3 border-t border-slate-200 space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-600">Subtotal:</span>
                <span className="font-bold text-slate-900 text-sm">{formatCurrency(subtotal)}</span>
              </div>
              
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-600">Bayar:</span>
                <span className="font-bold text-slate-900 text-sm">{formatCurrency(numericPay)}</span>
              </div>

              {numericPay > 0 && numericPay < subtotal && (
                <div className="flex justify-between items-center text-xs pt-1">
                  <span className="font-semibold text-slate-600">Kurang (Sisa):</span>
                  <span className="font-bold text-slate-900 text-sm">{formatCurrency(subtotal - numericPay)}</span>
                </div>
              )}

              {numericPay > subtotal && (
                <div className="flex justify-between items-center text-xs pt-1">
                  <span className="font-semibold text-slate-600">Kembalian:</span>
                  <span className="font-bold text-slate-900 text-sm">{formatCurrency(numericPay - subtotal)}</span>
                </div>
              )}

              <button
                onClick={handlePrintNota}
                className="w-full mt-2 bg-slate-900 text-white px-6 py-3 font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50 shadow-xs cursor-pointer"
                disabled={!customerName.trim() || selectedProducts.length === 0}
              >
                Cetak Nota &amp; Simpan Transaksi
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 text-slate-500 bg-white rounded-2xl border border-slate-200 p-8 max-w-md mx-auto">
          <svg className="w-10 h-10 text-slate-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <h3 className="font-bold text-slate-900 mb-1 text-sm">Akses Khusus Admin</h3>
          <p className="text-xs text-slate-500">Anda tidak memiliki akses untuk membuat nota. Silakan login sebagai Admin.</p>
        </div>
      )}

      {/* ── NOTA CONFIRMATION MODAL ── */}
      {isConfirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in" onClick={() => !isProcessingPrint && setIsConfirming(false)}>
          <div ref={notaRef} className="w-full max-w-[420px] bg-white border border-slate-200 rounded-2xl p-6 shadow-xl animate-pop-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-slate-900 mb-1 text-base">Konfirmasi Nota Transaksi</h3>
            <p className="text-xs text-slate-500 mb-4">Periksa rincian item &amp; nominal pembayaran sebelum mencetak</p>
            
            <div className="space-y-2 text-xs mb-5 text-left border-y border-slate-200 py-3.5">
              <div><span className="text-slate-500 font-semibold">Pelanggan:</span> <strong className="text-slate-900 font-bold">{customerName}</strong></div>
              {customerPhone && <div><span className="text-slate-500 font-semibold">No. HP:</span> <span className="text-slate-900">{customerPhone}</span></div>}
              {customerAddress && <div><span className="text-slate-500 font-semibold">Alamat:</span> <span className="text-slate-900">{customerAddress}</span></div>}
              {customerNotes && <div><span className="text-slate-500 font-semibold">Keterangan:</span> <span className="text-slate-900 italic">{customerNotes}</span></div>}
              
              <div className="pt-2 border-t border-slate-100">
                <span className="text-slate-500 font-semibold block mb-1 text-[11px]">Detail Barang:</span>
                <div className="max-h-32 overflow-y-auto space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  {selectedProducts.map(item => (
                    <div key={'conf-item-' + item.product.id} className="flex justify-between text-[11px]">
                      <span className="truncate max-w-[200px] font-medium text-slate-800">{item.product.name} (x{item.quantity})</span>
                      <span className="font-bold text-slate-900">{formatCurrency((item.product.price - item.product.discount) * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Summary Breakdown */}
              <div className="pt-2 space-y-1 border-t border-slate-200">
                <div className="flex justify-between font-semibold text-xs text-slate-700">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between font-semibold text-xs text-slate-700">
                  <span>Bayar:</span>
                  <span>{formatCurrency(numericPay)}</span>
                </div>
                {remainingAmount > 0 && (
                  <div className="flex justify-between font-semibold text-xs text-slate-700 pt-1">
                    <span>Kurang (Sisa):</span>
                    <span className="font-bold text-slate-900">{formatCurrency(remainingAmount)}</span>
                  </div>
                )}
                {changeAmount > 0 && (
                  <div className="flex justify-between font-semibold text-xs text-slate-700 pt-1">
                    <span>Kembalian:</span>
                    <span className="font-bold text-slate-900">{formatCurrency(changeAmount)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 text-xs">
              <button 
                onClick={() => setIsConfirming(false)} 
                disabled={isProcessingPrint}
                className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-100 transition-all disabled:opacity-50 cursor-pointer"
              >
                Batal / Edit
              </button>
              <button 
                onClick={() => executePrintAndSync('image')} 
                disabled={isProcessingPrint}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer"
              >
                Gambar (JPG)
              </button>
              <button 
                onClick={() => executePrintAndSync('pdf')} 
                disabled={isProcessingPrint}
                className="flex-grow py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isProcessingPrint ? 'Memproses...' : 'Ya, Cetak Nota'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default NotaView;
