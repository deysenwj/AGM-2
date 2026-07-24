
import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import type { Product } from './App'; // Import type to fix verbatimModuleSyntax warning

interface NotaItem {
  product: Product;
  quantity: number;
}


interface NotaViewProps {
  products: Product[];
  triggerToast: (message: string) => void;
  isAdmin: boolean;
  adjustStock: (id: string, amount: number) => Promise<void>;
  addTransaction: (tx: any) => Promise<void>;
}

// Helper function to format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
};

const NotaView: React.FC<NotaViewProps> = ({ products, triggerToast, isAdmin, adjustStock, addTransaction }) => {
  const [selectedProducts, setSelectedProducts] = useState<NotaItem[]>([]);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
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
      // Increase quantity if already in nota
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
        .filter(item => item.quantity > 0) // Remove if quantity becomes 0
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

    // Double check stock integrity
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

    // Temporarily hide buttons or other interactive elements that should not be in the image
    const buttonsToHide = document.querySelectorAll('.print-hidden-button'); // Use a specific class for buttons to hide

    if (printType === 'image') {
      buttonsToHide.forEach(button => (button as HTMLElement).style.display = 'none');
    }

    // 1. Decrement stock from Supabase Database ONLY on final confirmation
    // 1. Decrement stock from Supabase Database ONLY on final confirmation
    try {
      for (const item of selectedProducts) {
        await adjustStock(item.product.id, -item.quantity);
      }

      // 1.5 Save transaction history
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
        totalPrice: totalVal,
        items: txItems,
        date: dateStr,
      };

      await addTransaction(newTx);

      // 2. Perform print action based on type
      if (printType === 'pdf') {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          const itemsHtml = selectedProducts.map(item => {
            const discountedPrice = item.product.price - item.product.discount;
            const subtotal = discountedPrice * item.quantity;
            return `
              <tr>
                <td style="padding: 4px 0; max-width: 180px; word-wrap: break-word;">${item.product.name}</td>
                <td style="padding: 4px 0; text-align: center;">${item.quantity}</td>
                <td style="padding: 4px 0; text-align: right;">${formatCurrency(discountedPrice)}</td>
                <td style="padding: 4px 0; text-align: right;">${formatCurrency(subtotal)}</td>
              </tr>
            `;
          }).join('');

          printWindow.document.write(`
            <html>
              <head>
                <title>${notaId}</title>
                <style>
                  @page {
                    size: 110mm auto;
                    margin: 0;
                  }
                  body {
                    width: 100mm;
                    margin: 0 auto;
                    padding: 10px;
                    font-family: 'Courier New', Courier, monospace;
                    font-size: 11pt;
                    line-height: 1.4;
                    color: #000;
                  }
                  .header {
                    text-align: center;
                    margin-bottom: 15px;
                  }
                  .store-name {
                    font-size: 16pt;
                    font-weight: bold;
                    margin-bottom: 2px;
                  }
                  .store-address {
                    font-size: 8pt;
                    color: #555;
                  }
                  .divider {
                    border-top: 1px dashed #000;
                    margin: 10px 0;
                  }
                  .info-table, .items-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 10pt;
                  }
                  .info-table td {
                    padding: 2px 0;
                  }
                  .items-table th {
                    border-bottom: 1px dashed #000;
                    padding-bottom: 5px;
                    font-weight: bold;
                  }
                  .total-row {
                    font-weight: bold;
                    font-size: 12pt;
                  }
                  @media print {
                    body {
                      padding: 0;
                    }
                  }
                </style>
              </head>
              <body>
                <div class="header">
                  <div class="store-name">AGM 2</div>
                  <div class="store-address">Jalan Rahadi Ismail, Desa Padang,<br>Kec. Benua Kayong, Kab. Ketapang</div>
                  <div class="store-address" style="margin-top: 4px; font-weight: bold;">WhatsApp: 082351623939</div>
                </div>
                
                <div class="divider"></div>
                
                <table class="info-table">
                  <tr>
                    <td>No Nota:</td>
                    <td style="text-align: right;">${notaId}</td>
                  </tr>
                  <tr>
                    <td>Tanggal:</td>
                    <td style="text-align: right;">${dateStr}</td>
                  </tr>
                  <tr style="border-top: 1px solid #eee;">
                    <td style="font-weight: bold; padding-top: 4px;">Pelanggan:</td>
                    <td style="text-align: right; padding-top: 4px; font-weight: bold;">${customerName}</td>
                  </tr>
                  ${customerPhone.trim() ? `
                  <tr>
                    <td>No. HP:</td>
                    <td style="text-align: right;">${customerPhone}</td>
                  </tr>` : ''}
                  ${customerAddress.trim() ? `
                  <tr>
                    <td>Alamat:</td>
                    <td style="text-align: right; max-width: 180px; word-wrap: break-word;">${customerAddress}</td>
                  </tr>` : ''}
                </table>
                
                <div class="divider"></div>
                
                <table class="items-table">
                  <thead>
                    <tr>
                      <th style="text-align: left;">Item</th>
                      <th style="text-align: center; width: 40px;">Qty</th>
                      <th style="text-align: right; width: 90px;">Harga</th>
                      <th style="text-align: right; width: 100px;">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsHtml}
                  </tbody>
                </table>
                
                <div class="divider"></div>
                
                <table class="info-table">
                  <tr class="total-row">
                    <td>GRAND TOTAL:</td>
                    <td style="text-align: right;">${formatCurrency(totalVal)}</td>
                  </tr>
                </table>
                
                <div class="divider" style="margin-top: 15px;"></div>
                
                <div style="text-align: center; font-size: 9pt; margin-top: 10px;">
                  Terima Kasih atas Kunjungan Anda!<br>
                  Barang yang sudah dibeli tidak dapat ditukar/dikembalikan.
                </div>
                
                <script>
                  window.onload = function() {
                    window.print();
                    setTimeout(function() { window.close(); }, 500);
                  };
                </script>
              </body>
            </html>
          `);
          printWindow.document.close();
          triggerToast('Nota berhasil dicetak / diunduh PDF!');
        } else {
          triggerToast('Gagal memproses cetak. Izinkan pop-up browser Anda.');
        }
      } else { // printType === 'image'
        await handlePrintAsImageInternal(notaId, totalVal, customerName, customerPhone, customerAddress, selectedProducts);
      }

    } catch (err) {
      console.error('Failed to process print/image or sync:', err);
      triggerToast('Gagal memproses nota.');
    } finally {
      // Restore hidden elements
      buttonsToHide.forEach(button => (button as HTMLElement).style.display = ''); // Restore buttons
      // Reset Form
      setSelectedProducts([]);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setIsConfirming(false);
      setIsProcessingPrint(false);
    }
  };

  const handlePrintAsImageInternal = async (notaId: string, totalVal: number, customerName: string, customerPhone: string | undefined, customerAddress: string | undefined, selectedProducts: NotaItem[]) => {
    // --- Start Building Print HTML (same as for PDF) ---
    const dateStr = new Date().toLocaleString('id-ID');

    const itemsHtml = selectedProducts.map(item => {
      const discountedPrice = item.product.price - item.product.discount;
      const subtotal = discountedPrice * item.quantity;
      return `
        <tr>
          <td style="padding: 4px 0; max-width: 180px; word-wrap: break-word;">${item.product.name}</td>
          <td style="padding: 4px 0; text-align: center;">${item.quantity}</td>
          <td style="padding: 4px 0; text-align: right;">${formatCurrency(discountedPrice)}</td>
          <td style="padding: 4px 0; text-align: right;">${formatCurrency(subtotal)}</td>
        </tr>
      `;
    }).join('');

    const printHtml = `
      <html>
        <head>
          <title>${notaId}</title>
          <style>
            body {
              width: 100mm;
              margin: 0 auto;
              padding: 10px;
              font-family: 'Courier New', Courier, monospace;
              font-size: 11pt;
              line-height: 1.4;
              color: #000;
            }
            .header {
              text-align: center;
              margin-bottom: 15px;
            }
            .store-name {
              font-size: 16pt;
              font-weight: bold;
              margin-bottom: 2px;
            }
            .store-address {
              font-size: 8pt;
              color: #555;
            }
            .divider {
              border-top: 1px dashed #000;
              margin: 10px 0;
            }
            .info-table, .items-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 10pt;
            }
            .info-table td {
              padding: 2px 0;
            }
            .items-table th {
              border-bottom: 1px dashed #000;
              padding-bottom: 5px;
              font-weight: bold;
            }
            .total-row {
              font-weight: bold;
              font-size: 12pt;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="store-name">AGM 2</div>
            <div class="store-address">Jalan Rahadi Ismail, Desa Padang,<br>Kec. Benua Kayong, Kab. Ketapang</div>
            <div class="store-address" style="margin-top: 4px; font-weight: bold;">WhatsApp: 082351623939</div>
          </div>
          
          <div class="divider"></div>
          
          <table class="info-table">
            <tr>
              <td>No Nota:</td>
              <td style="text-align: right;">${notaId}</td>
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
          </table>
          
          <div class="divider"></div>
          
          <table class="items-table">
            <thead>
              <tr>
                <th style="text-align: left;">Item</th>
                <th style="text-align: center; width: 40px;">Qty</th>
                <th style="text-align: right; width: 90px;">Harga</th>
                <th style="text-align: right; width: 100px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          
          <div class="divider"></div>
          
          <table class="info-table">
            <tr class="total-row">
              <td>GRAND TOTAL:</td>
              <td style="text-align: right;">${formatCurrency(totalVal)}</td>
            </tr>
          </table>
          
          <div class="divider" style="margin-top: 15px;"></div>
          
          <div style="text-align: center; font-size: 9pt; margin-top: 10px;">
            Terima Kasih atas Kunjungan Anda!<br>
            Barang yang sudah dibeli tidak dapat ditukar/dikembalikan.
          </div>
        </body>
      </html>
    `;
    // --- End Building Print HTML ---

    const iframe = document.createElement('iframe');
    iframe.style.visibility = 'hidden';
    iframe.style.position = 'absolute';
    iframe.style.width = '100mm'; // Set width for rendering
    iframe.style.height = 'min-content'; // Set height dynamically
    document.body.appendChild(iframe);

    // Get iframe's document and write HTML
    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) {
      triggerToast('Gagal membuat iframe.');
      document.body.removeChild(iframe);
      return;
    }
    iframeDoc.open();
    iframeDoc.write(printHtml);
    iframeDoc.close();

    // Ensure iframe content is rendered before capturing
    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for rendering

    try {
      const canvas = await html2canvas(iframeDoc.body, { // Capture iframe's body
        scale: 2, 
        useCORS: true, 
        logging: true, 
        allowTaint: true, 
        backgroundColor: '#ffffff', 
        ignoreElements: (element) => element.tagName === 'SCRIPT',
      });
      console.log('Canvas generated successfully:', canvas); 

      // Get JPEG data URL
      const imageData = canvas.toDataURL('image/jpeg', 0.9); 

      // Create a dummy link and click to download
      const link = document.createElement('a');
      link.href = imageData;
      link.download = `nota-${notaId}.jpg`; 
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      triggerToast('Nota berhasil diunduh sebagai gambar JPG!'); 

    } catch (error: any) { 
      console.error('Error generating image from iframe:', error);
      if (error.message && error.message.includes("Tainted canvases may not be exported")) { 
        triggerToast('Gagal: Gambar nota berisi konten dari sumber eksternal yang tidak diizinkan. Coba hapus logo/gambar eksternal.');
      } else {
        triggerToast('Gagal mengunduh gambar nota.');
      }
    } finally {
      document.body.removeChild(iframe); // Clean up iframe
    }
  };

  return (
    <section className="px-margin-mobile lg:px-margin-desktop py-8 max-w-container-max mx-auto w-full flex-grow">
      <h2 className="font-headline-lg text-headline-lg text-primary mb-6">Buat Nota Penjualan</h2>

      {isAdmin ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Product Selection */}
          <div className="lg:col-span-2 bg-pure-white border border-border-light rounded-xl p-6 shadow-sm">
            <h3 className="font-bold text-lg text-primary mb-4">Pilih Produk</h3>
            <div className="mb-4">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Cari produk..."
                className="w-full bg-surface-container-low border-none rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:bg-surface-container"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            {filteredProducts.length === 0 && searchTerm ? (
              <div className="text-center py-8 text-secondary">Tidak ada produk ditemukan untuk '\${searchTerm}'.</div>
            ) : filteredProducts.length === 0 && !searchTerm ? (
              <div className="text-center py-8 text-secondary">Tambahkan produk di menu Inventaris.</div>
            ) : (
              <div className="flex-grow max-h-96 overflow-y-auto border border-border-light rounded-lg">
                {/* Desktop Table View */}
                <table className="min-w-full divide-y divide-border-light hidden md:table">
                  <thead className="bg-surface-container-low sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-bold text-secondary uppercase">Produk</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-secondary uppercase">Harga</th>
                      <th className="px-3 py-2 text-center text-xs font-bold text-secondary uppercase">Stok</th>
                      <th className="px-3 py-2 text-right text-xs font-bold text-secondary uppercase">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light">
                    {filteredProducts.map(p => (
                      <tr key={p.id}>
                        <td className="px-3 py-2 text-sm text-on-surface">{p.name}</td>
                        <td className="px-3 py-2 text-sm text-on-surface">{formatCurrency(p.price - p.discount)}</td>
                        <td className="px-3 py-2 text-sm text-center">
                          <span className={`${p.stock <= 3 && p.stock > 0 ? 'text-warning' : p.stock === 0 ? 'text-error' : 'text-primary'}`}>
                            {p.stock} {p.unit}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => handleAddProduct(p)}
                            className="bg-primary text-pure-white px-3 py-1 text-xs rounded hover:bg-opacity-80 active:scale-95 transition-all"
                          >
                            Tambah
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Mobile Card View */}
                <div className="md:hidden">
                  {filteredProducts.map(p => (
                    <div key={p.id} className="p-3 flex items-center justify-between gap-3 bg-pure-white hover:bg-surface-container-low transition-colors relative z-0 border-b border-border-light">
                      <div className="flex-grow">
                        <div className="text-sm text-on-surface font-semibold">{p.name}</div>
                        <div className="text-xs text-secondary">{formatCurrency(p.price - p.discount)}</div>
                        <div className="text-xs">
                          <span className={`${p.stock <= 3 && p.stock > 0 ? 'text-warning' : p.stock === 0 ? 'text-error' : 'text-primary'}`}>
                            Stok: {p.stock} {p.unit}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAddProduct(p)}
                        className="bg-primary text-pure-white px-3 py-1 text-xs rounded hover:bg-opacity-80 active:scale-95 transition-all shrink-0"
                      >
                        Tambah
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Nota Preview & Actions */}
          <div className="lg:col-span-1 bg-pure-white border border-border-light rounded-xl p-6 shadow-sm flex flex-col">
            <h3 className="font-bold text-lg text-primary mb-4">Detail Nota</h3>
            
            <div className="space-y-3 mb-4">
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-1 text-xs">Nama Pelanggan</label>
                <input
                  type="text"
                  required
                  className="w-full bg-surface-container-low border-none rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:bg-surface-container"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-1 text-xs">No. HP Pelanggan</label>
                <input
                  type="text"
                  placeholder="cth: 0812xxxxxxxx"
                  className="w-full bg-surface-container-low border-none rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:bg-surface-container"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
              </div>
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-1 text-xs">Alamat Pelanggan</label>
                <input
                  type="text"
                  placeholder="cth: Jl. Merdeka No. 12"
                  className="w-full bg-surface-container-low border-none rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:bg-surface-container"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-grow overflow-x-auto max-h-80 overflow-y-auto mb-4 border border-border-light rounded-lg">
              <table className="min-w-full divide-y divide-border-light">
                <thead className="bg-surface-container-low sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-bold text-secondary uppercase">Produk</th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-secondary uppercase">Qty</th>
                    <th className="px-3 py-2 text-right text-xs font-bold text-secondary uppercase">Subtotal</th>
                    <th className="px-3 py-2 text-right text-xs font-bold text-secondary uppercase">Hapus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {selectedProducts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-4 text-center text-sm text-secondary">Belum ada produk ditambahkan</td>
                    </tr>
                  ) : (
                    selectedProducts.map(item => (
                      <tr key={item.product.id}>
                        <td className="px-3 py-2 text-sm text-on-surface">{item.product.name}</td>
                        <td className="px-3 py-2 text-sm text-on-surface">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleUpdateQuantity(item.product.id, parseInt(e.target.value))}
                            className="w-16 text-center text-sm bg-surface-container-low border-none rounded-lg px-2 py-1 focus:ring-1 focus:ring-primary focus:bg-surface-container"
                          />
                        </td>
                        <td className="px-3 py-2 text-right text-sm text-on-surface">
                          {formatCurrency((item.product.price - item.product.discount) * item.quantity)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => handleRemoveProduct(item.product.id)}
                            className="text-error hover:text-error-dark active:scale-95 transition-all"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-auto pt-4 border-t border-border-light">
              <div className="flex justify-between items-center mb-4">
                <span className="font-bold text-lg text-primary">Total:</span>
                <span className="font-bold text-xl text-primary">{formatCurrency(calculateTotal())}</span>
              </div>
              <button
                onClick={handlePrintNota}
                className="w-full bg-primary text-pure-white px-6 py-3 font-button text-button uppercase tracking-wider rounded-sm hover:bg-opacity-90 transition-all active:scale-95 disabled:opacity-50"
                disabled={!customerName.trim() || selectedProducts.length === 0}
              >
                Cetak Nota
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 text-secondary">
          <span className="material-symbols-outlined text-4xl block mb-2 text-border-light">lock</span>
          <p className="text-sm">Anda tidak memiliki akses untuk membuat nota. Silakan login sebagai Admin.</p>
        </div>
      )}

      {/* ── NOTA CONFIRMATION MODAL ── */}
      {isConfirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface/90 backdrop-blur-md" onClick={() => !isProcessingPrint && setIsConfirming(false)}>
          <div ref={notaRef} className="w-full max-w-[420px] bg-pure-white border border-border-light rounded-xl p-6 sm:p-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-headline-md text-headline-md text-primary mb-4 text-lg">Konfirmasi Transaksi Nota</h3>
            
            <div className="space-y-2.5 text-xs mb-6 text-left border-y border-border-light py-4">
              <div><span className="text-secondary font-bold">Nama Pelanggan:</span> <span className="text-primary">{customerName}</span></div>
              {customerPhone && <div><span className="text-secondary font-bold">No. HP:</span> <span className="text-primary">{customerPhone}</span></div>}
              {customerAddress && <div><span className="text-secondary font-bold">Alamat:</span> <span className="text-primary">{customerAddress}</span></div>}
              <div className="pt-2 border-t border-border-light/60">
                <span className="text-secondary font-bold">Detail Barang:</span>
                <div className="max-h-28 overflow-y-auto mt-1 space-y-1 bg-surface-container-low p-2 rounded">
                  {selectedProducts.map(item => (
                    <div key={'conf-item-' + item.product.id} className="flex justify-between">
                      <span className="truncate max-w-[180px]">{item.product.name} (x{item.quantity})</span>
                      <span>{formatCurrency((item.product.price - item.product.discount) * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-2 flex justify-between font-bold text-sm text-primary">
                <span>TOTAL AKHIR:</span>
                <span>{formatCurrency(calculateTotal())}</span>
              </div>
            </div>

            <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-lg mb-6 leading-relaxed text-center">
              <strong>Perhatian:</strong> Menekan tombol "Ya, Cetak & Potong Stok" akan secara permanen memotong persediaan stok barang di database Supabase dan memicu menu cetak.
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setIsConfirming(false)} 
                disabled={isProcessingPrint}
                className="flex-1 py-2.5 border border-border-light text-secondary font-button text-xs uppercase rounded-sm hover:border-primary transition-all disabled:opacity-50 print-hidden-button"
              >
                Batal / Edit
              </button>
              <button 
                onClick={() => executePrintAndSync('image')} 
                disabled={isProcessingPrint}
                className="flex-1 py-2.5 bg-secondary-container text-primary font-button text-xs uppercase rounded-sm hover:bg-opacity-90 transition-all disabled:opacity-50 print-hidden-button"
              >
                Cetak Gambar (JPG)
              </button>
              <button 
                onClick={() => executePrintAndSync('pdf')} 
                disabled={isProcessingPrint}
                className="flex-grow py-2.5 bg-primary text-pure-white font-button text-xs uppercase rounded-sm hover:bg-opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 print-hidden-button"
              >
                {isProcessingPrint ? 'Memproses...' : 'Ya, Cetak & Potong Stok'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default NotaView;
