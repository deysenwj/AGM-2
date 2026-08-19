import React, { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import NotaView from './NotaView'; // Import NotaView
import AIChatWidget from './components/AIChatWidget';


export interface Product {
  id: string;
  name: string;
  category: string; // 'furniture' | 'electronics'
  subcategory: string; // sub-products
  description: string;
  price: number;
  stock: number;
  unit: string;
  image_url?: string;
  images?: string[]; // Array of additional gallery photo URLs (Shopee style)
  discount: number;
  image_public_id?: string | null;
  arrivalType?: 'BARANG BARU' | 'PRODUK UNGGULAN' | 'EKSKLUSIF' | 'PRE-ORDER' | 'PROMO' | '';
}

export interface Transaction {
  id: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  notes?: string;
  totalPrice: number;
  payAmount?: number;
  changeAmount?: number;
  remainingAmount?: number;
  deliveryFee?: number; // Optional delivery fee
  items: {
    productId: string;
    productName: string;
    quantity: number;
    price: number;
  }[];
  date: string; // Formatted date string
  dateRaw: string; // ISO string for filtering
}

export interface DeletedProductLog {
  id: string;
  deletedAt: string;
  product: Product;
  changedBy?: string;
}

export interface StockHistoryLog {
  id: string;
  productId: string;
  productName: string;
  oldStock: number;
  newStock: number;
  changeAmount: number;
  changedBy: string;
  changedAt: string;
  notes?: string;
}

export interface AdminSession {
  id: string;
  name: string;
  email: string;
  status: 'online' | 'offline';
  lastSeen: string;
}

 

 


const FURNITURE_SUBCATEGORIES = [
  'Meja tv',
  'Backdrop meja tv',
  'Bopet tv',
  'Lemari pakaian',
  'Lemari rak kaca',
  'Lemari rak piring',
  'Meja rias',
  'Lemari pajang',
  'Meja prasmanan',
  'Meja kompor',
  'Kitchen set',
  'Etalase',
  'Lemari Sepatu',
  'Lemari Dapur',
  'Lainnya'
];

const ELECTRONICS_SUBCATEGORIES = [
  'TV',
  'Mesin Cuci',
  'Kulkas',
  'Kipas',
  'Salon',
  'Rice Cooker',
  'Kompor',
  'Mixer',
  'Blender',
  'Setrika',
  'Lampu',
  'Kabel',
  'Pompa Air',
  'Parutan',
  'Dispenser',
  'Senter',
  'Lainnya'
];

const formatRupiahInput = (val: string) => {
  const clean = val.replace(/\D/g, '');
  if (!clean) return '';
  return parseInt(clean).toLocaleString('id-ID');
};

const getOptimizedImageUrl = (url?: string, width = 600) => {
  if (!url) return '';
  if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
    return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width},c_limit/`);
  }
  return url;
};



const StockControlInput = ({ 
  stock, 
  onCommit 
}: { 
  stock: number; 
  onCommit: (val: number) => void; 
}) => {
  const [localVal, setLocalVal] = useState(String(stock));
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalVal(String(stock));
    }
  }, [stock]);

  const handleBlurOrSubmit = () => {
    isFocusedRef.current = false;
    const parsed = parseInt(localVal, 10);
    const safeVal = isNaN(parsed) ? 0 : Math.max(0, parsed);
    setLocalVal(String(safeVal));
    if (safeVal !== stock) {
      onCommit(safeVal);
    }
  };

  return (
    <input
      type="number"
      min="0"
      value={localVal}
      onFocus={() => { isFocusedRef.current = true; }}
      onChange={(e) => setLocalVal(e.target.value)}
      onBlur={handleBlurOrSubmit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="w-14 text-center font-bold text-sm text-primary py-1 bg-transparent border-none focus:ring-0 outline-none"
    />
  );
};

const ProductPhotoGallery = ({ 
  product, 
  onOpenFullscreen 
}: { 
  product: Product; 
  onOpenFullscreen?: (urls: string[], index: number) => void;
}) => {
  const allImages = React.useMemo(() => {
    const list: string[] = [];
    if (product.image_url) list.push(product.image_url);
    if (Array.isArray(product.images)) {
      product.images.forEach(img => {
        if (img && !list.includes(img)) list.push(img);
      });
    }
    return list;
  }, [product]);

  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [product.id]);

  const activeImage = allImages[activeIndex] || allImages[0] || '';

  return (
    <div className="space-y-3 mb-5">
      {/* Main Preview Frame */}
      <div 
        className="aspect-[4/3] w-full rounded-2xl overflow-hidden bg-slate-100 relative border border-slate-200/80 group cursor-pointer"
        onClick={() => activeImage && onOpenFullscreen?.(allImages, activeIndex)}
        title="Klik untuk melihat foto penuh (full screen)"
      >
        {activeImage ? (
          <img 
            src={getOptimizedImageUrl(activeImage, 800)} 
            alt={product.name} 
            className="w-full h-full object-cover transition-all duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
            <svg className="w-12 h-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-xs uppercase font-extrabold tracking-wider mt-2 text-slate-400">Tidak Ada Foto</span>
          </div>
        )}

        {/* Tag Badge */}
        {product.arrivalType && (
          <div className="absolute top-3 left-3 bg-slate-900/90 text-white backdrop-blur-md px-2.5 py-1 rounded-md text-[9px] font-extrabold uppercase tracking-widest border border-slate-700/50 shadow-2xs z-10">
            {product.arrivalType}
          </div>
        )}

        {/* Next / Previous Sleek Monoline SVG Arrows (Fades in on Hover) */}
        {allImages.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setActiveIndex(prev => (prev === 0 ? allImages.length - 1 : prev - 1)); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-900/60 hover:bg-slate-900 text-white flex items-center justify-center backdrop-blur-md transition-all duration-200 active:scale-90 opacity-0 group-hover:opacity-100 shadow-sm z-10 cursor-pointer"
              title="Foto Sebelumnya"
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setActiveIndex(prev => (prev === allImages.length - 1 ? 0 : prev + 1)); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-900/60 hover:bg-slate-900 text-white flex items-center justify-center backdrop-blur-md transition-all duration-200 active:scale-90 opacity-0 group-hover:opacity-100 shadow-sm z-10 cursor-pointer"
              title="Foto Selanjutnya"
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            <div className="absolute bottom-3 right-3 bg-slate-900/80 text-white px-2.5 py-0.5 rounded-full text-[10px] font-extrabold backdrop-blur-xs tracking-wider z-10 opacity-80 group-hover:opacity-100 transition-opacity">
              {activeIndex + 1} / {allImages.length}
            </div>
          </>
        )}
      </div>

      {/* Shopee-style Thumbnail Strip */}
      {allImages.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {allImages.map((imgUrl, idx) => (
            <button
              key={'thumb-' + idx}
              type="button"
              onClick={() => setActiveIndex(idx)}
              className={`relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                activeIndex === idx
                  ? 'border-slate-900 ring-2 ring-slate-900/20 scale-105 shadow-sm'
                  : 'border-slate-200/80 opacity-70 hover:opacity-100 hover:border-slate-400'
              }`}
            >
              <img src={getOptimizedImageUrl(imgUrl, 200)} alt="" className="w-full h-full object-cover" />
              {idx === 0 && (
                <span className="absolute bottom-0 inset-x-0 bg-slate-900/80 text-white text-[8px] font-extrabold uppercase text-center py-0.5">
                  Utama
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default function App() {
  const lastLocalStockEditsRef = React.useRef<{ [id: string]: { stock: number; time: number } }>({});
  const pendingStockUpdatesRef = React.useRef<{ [id: string]: { timer: any; targetStock: number } }>({});
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('agm2_inventory');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const filtered = parsed.filter(p => !['1','2','3','4','5','6'].includes(String(p.id)));
          return filtered;
        }
      } catch (e) {}
    }
    return [];
  });

  const [isFetchingData, setIsFetchingData] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  // Current logged in admin user state (Ardian or Widya)
  const [currentAdminUser, setCurrentAdminUser] = useState<{ name: string; email: string } | null>(() => {
    const saved = localStorage.getItem('agm2_admin_user');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    const isOldMode = localStorage.getItem('agm2_admin_mode') === 'true';
    return isOldMode ? { name: 'Ardian', email: 'deysen10@gmail.com' } : null;
  });
  const isAdmin = Boolean(currentAdminUser);

  const [currentView, setCurrentView] = useState<'catalog' | 'stock' | 'dashboard' | 'nota' | 'custom-requests'>('catalog');

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('agm2_transactions');
    try {
      return saved 
        ? JSON.parse(saved).map(mapDbToTransaction) 
        : [];
    } catch (e) {
      return [];
    }
  });

  const [txStartDate, setTxStartDate] = useState<string>('');
  const [txEndDate, setTxEndDate] = useState<string>('');

  const [selectedTxDetail, setSelectedTxDetail] = useState<Transaction | null>(null);
  const [selectedProductDetail, setSelectedProductDetail] = useState<Product | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<{ urls: string[]; index: number } | null>(null);
  const [activeFooterFaq, setActiveFooterFaq] = useState<number | null>(null);

  // Riwayat SKU Produk yang Dihapus State
  const [deletedProductsHistory, setDeletedProductsHistory] = useState<DeletedProductLog[]>(() => {
    const saved = localStorage.getItem('agm2_deleted_products_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  });
  const [isDeletedLogModalOpen, setIsDeletedLogModalOpen] = useState(false);
  const [deletedLogSearchQuery, setDeletedLogSearchQuery] = useState('');

  // Riwayat Edit Stok State
  const [stockHistory, setStockHistory] = useState<StockHistoryLog[]>(() => {
    const saved = localStorage.getItem('agm2_stock_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  });
  const [isStockLogModalOpen, setIsStockLogModalOpen] = useState(false);
  const [stockLogSearchQuery, setStockLogSearchQuery] = useState('');

  // Konfirmasi Toggle Edit Stok State
  const [stockEditConfirmation, setStockEditConfirmation] = useState<{
    productId: string;
    productName: string;
    oldStock: number;
    newStock: number;
  } | null>(null);

  // Active Online Admins State (Supabase Realtime Presence)
  const [activeOnlineAdmins, setActiveOnlineAdmins] = useState<{ name: string; email: string; onlineAt: string }[]>([]);
  const [isOnlineAdminsModalOpen, setIsOnlineAdminsModalOpen] = useState(false);
  const presenceChannelRef = React.useRef<any>(null);

  // Custom Design Requests Admin Mutation State
  const [customRequests, setCustomRequests] = useState<any[]>([]);
  const [isCustomRequestsLoading, setIsCustomRequestsLoading] = useState(false);
  const [customRequestsError, setCustomRequestsError] = useState<string | null>(null);
  const [selectedCustomRequestDetail, setSelectedCustomRequestDetail] = useState<any | null>(null);

  const [isUpdatingCustomRequest, setIsUpdatingCustomRequest] = useState(false);
  const [customRequestMutationError, setCustomRequestMutationError] = useState<string | null>(null);
  const [customRequestQuotedPriceInput, setCustomRequestQuotedPriceInput] = useState<string>('');
  const [customRequestAdminNoteInput, setCustomRequestAdminNoteInput] = useState<string>('');

  const fetchCustomRequests = async () => {
    if (!isSupabaseConfigured) return;
    setIsCustomRequestsLoading(true);
    setCustomRequestsError(null);
    try {
      const { data, error } = await supabase
        .from('custom_design_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Fetch custom_design_requests warning:', error.message);
        setCustomRequestsError(error.message);
      } else if (data) {
        setCustomRequests(data);
      }
    } catch (err: any) {
      console.warn('Fetch custom_design_requests exception:', err.message);
      setCustomRequestsError(err.message || 'Gagal memuat pengajuan custom');
    } finally {
      setIsCustomRequestsLoading(false);
    }
  };


  const handleAdminMutationCustomRequest = async (requestId: string, targetStatus: string, priceInput?: number, responseInput?: string) => {
    if (isUpdatingCustomRequest) return;
    setIsUpdatingCustomRequest(true);
    setCustomRequestMutationError(null);

    try {
      // 1. Get Access Token from Supabase session
      const sessionRes = await supabase.auth.getSession();
      const accessToken = sessionRes.data.session?.access_token;
      if (!accessToken) {
        throw new Error('Session admin tidak valid. Silakan login kembali.');
      }

      // 2. Prepare payload
      const payload: Record<string, any> = {
        requestId,
        status: targetStatus
      };
      if (priceInput !== undefined) payload.quoted_price = priceInput;
      if (responseInput !== undefined) payload.admin_response = responseInput;

      // 3. Dispatch PATCH request to /api/admin/custom-request
      const res = await fetch('/api/admin/custom-request', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(payload)
      });

      const resData = await res.json();
      if (!res.ok) {
        if (res.status === 401) throw new Error('Session admin tidak valid. Silakan login kembali.');
        if (res.status === 403) throw new Error('Anda tidak memiliki izin untuk mengubah pengajuan ini.');
        if (res.status === 409) throw new Error('Status pengajuan telah berubah di server. Muat ulang data sebelum mencoba lagi.');
        throw new Error(resData.message || 'Gagal memperbarui status pengajuan.');
      }

      // 4. Update local detail state and refresh request list
      setSelectedCustomRequestDetail((prev: any) => prev ? {
        ...prev,
        status: targetStatus,
        quoted_price: priceInput !== undefined ? priceInput : prev.quoted_price,
        admin_response: responseInput !== undefined ? responseInput : prev.admin_response,
        updated_at: new Date().toISOString()
      } : prev);

      triggerToast('Pengajuan berhasil diperbarui.');
      await fetchCustomRequests();

    } catch (err: any) {
      console.warn('Admin mutation error:', err.message);
      setCustomRequestMutationError(err.message || 'Terjadi kesalahan saat memperbarui status.');
    } finally {
      setIsUpdatingCustomRequest(false);
    }
  };


  // Helper to map DB row to Transaction interface
  const mapDbToTransaction = React.useCallback((item: any): Transaction => {
    const rawDate = item.created_at || item.dateRaw || item.date_raw || new Date().toISOString();
    let formattedDate = item.date;
    
    if (!formattedDate || formattedDate === 'undefined' || formattedDate === 'Invalid Date') {
      try {
        const parsedDate = new Date(rawDate);
        formattedDate = !isNaN(parsedDate.getTime())
          ? parsedDate.toLocaleString('id-ID')
          : new Date().toLocaleString('id-ID');
      } catch {
        formattedDate = new Date().toLocaleString('id-ID');
      }
    }

    let itemsList: any[] = [];
    let payAmt: number | undefined = undefined;
    let remAmt: number | undefined = undefined;
    let chgAmt: number | undefined = undefined;
    let txNotes: string | undefined = undefined;

    let parsedItems = item.items;
    if (typeof parsedItems === 'string') {
      try { parsedItems = JSON.parse(parsedItems); } catch (e) {}
    }

    if (Array.isArray(parsedItems)) {
      itemsList = parsedItems;
    } else if (parsedItems && typeof parsedItems === 'object') {
      if (Array.isArray(parsedItems.list)) {
        itemsList = parsedItems.list;
      } else if (Array.isArray(parsedItems.items)) {
        itemsList = parsedItems.items;
      }
      if (parsedItems.meta) {
        payAmt = parsedItems.meta.payAmount;
        remAmt = parsedItems.meta.remainingAmount;
        chgAmt = parsedItems.meta.changeAmount;
        txNotes = parsedItems.meta.notes;
      }
    }

    const totalP = Number(item.total_price || item.totalPrice || 0);

    return {
      id: String(item.id || 'TX-' + Date.now()),
      customerName: item.customer_name || item.customerName || 'Pelanggan Toko',
      customerPhone: item.customer_phone || item.customerPhone || undefined,
      customerAddress: item.customer_address || item.customerAddress || undefined,
      notes: txNotes || item.notes || item.description || undefined,
      totalPrice: totalP,
      payAmount: payAmt !== undefined ? payAmt : (item.pay_amount !== undefined ? Number(item.pay_amount) : (item.payAmount !== undefined ? Number(item.payAmount) : totalP)),
      remainingAmount: remAmt !== undefined ? remAmt : (item.remaining_amount !== undefined ? Number(item.remaining_amount) : (item.remainingAmount !== undefined ? Number(item.remainingAmount) : 0)),
      changeAmount: chgAmt !== undefined ? chgAmt : (item.change_amount !== undefined ? Number(item.change_amount) : (item.changeAmount !== undefined ? Number(item.changeAmount) : 0)),
      items: itemsList,
      date: formattedDate,
      dateRaw: rawDate,
    };
  }, []);

  // @ts-ignore
  const filteredTransactions = React.useMemo(() => {
    let filtered = transactions;

    if (txStartDate || txEndDate) {
      return filtered.filter(tx => {
        const timeMs = tx.dateRaw ? new Date(tx.dateRaw).getTime() : 0;
        if (isNaN(timeMs) || timeMs === 0) return true; // Don't drop items if date parse fails

        const txDate = new Date(timeMs);
        txDate.setHours(0, 0, 0, 0);

        let matchStartDate = true;
        if (txStartDate) {
          const start = new Date(txStartDate);
          start.setHours(0, 0, 0, 0);
          matchStartDate = txDate.getTime() >= start.getTime();
        }

        let matchEndDate = true;
        if (txEndDate) {
          const end = new Date(txEndDate);
          end.setHours(0, 0, 0, 0);
          matchEndDate = txDate.getTime() <= end.getTime();
        }
        return matchStartDate && matchEndDate;
      });
    }

    // Default: Show all transactions sorted newest first
    return [...filtered].sort((a, b) => {
      const timeA = a.dateRaw ? new Date(a.dateRaw).getTime() : 0;
      const timeB = b.dateRaw ? new Date(b.dateRaw).getTime() : 0;
      return timeB - timeA;
    });
  }, [transactions, txStartDate, txEndDate]);

  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  const [isDeleteTransactionModalOpen, setIsDeleteTransactionModalOpen] = useState<boolean>(false);

  const [filterCategory, setFilterCategory] = useState<'all' | 'furniture' | 'electronics'>('all');
  const [filterSubcategory, setFilterSubcategory] = useState<string>('all');
  const [globalSearch, setGlobalSearch] = useState('');
  const [stockSearchTerm, setStockSearchTerm] = useState<string>('');

  // Navigation & Drawer state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Sidebar states
  const [showInStock, setShowInStock] = useState(true);
  const [showBackorder, setShowBackorder] = useState(true);

  // Modals state
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form states (Add/Edit)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('furniture');
  const [formSubcategory, setFormSubcategory] = useState('Meja tv');
  const [formDescription, setFormDescription] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formDiscount, setFormDiscount] = useState('');
  const [formStock, setFormStock] = useState('');
  const [formUnit, setFormUnit] = useState('Pcs');
  const [formImage, setFormImage] = useState('');
  const [formImages, setFormImages] = useState<string[]>([]);
  const [formImagePublicId, setFormImagePublicId] = useState<string | null>(null);
  const [formArrivalType, setFormArrivalType] = useState<'BARANG BARU' | 'PRODUK UNGGULAN' | 'EKSKLUSIF' | 'PRE-ORDER' | 'PROMO' | ''>('');





  // Helper to map DB row to Product interface
  const mapDbToProduct = (item: any): Product => {
    let imagesList: string[] = [];
    if (Array.isArray(item.images)) {
      imagesList = item.images;
    } else if (typeof item.images === 'string' && item.images.trim()) {
      try {
        imagesList = JSON.parse(item.images);
      } catch (e) {
        imagesList = [item.images];
      }
    }

    const primaryImg = item.image_url || (imagesList.length > 0 ? imagesList[0] : '');
    if (primaryImg && !imagesList.includes(primaryImg)) {
      imagesList = [primaryImg, ...imagesList];
    }

    return {
      id: String(item.id),
      name: item.name || '',
      category: item.category || 'furniture',
      subcategory: item.subcategory || '',
      description: item.description || '',
      price: Number(item.price) || 0,
      discount: Number(item.discount) || 0,
      stock: isNaN(Number(item.stock)) ? 0 : Math.max(0, Number(item.stock)),
      unit: item.unit || 'Pcs',
      image_url: primaryImg,
      images: imagesList,
      image_public_id: item.image_public_id || '',
      arrivalType: item.arrival_type || ''
    };
  };


  const fetchProducts = async (maxRetries = 3, showSpinner = true) => {
    if (showSpinner) setIsFetchingData(true);
    
    // Try loading from local storage first
    let hasLocalData = false;
    const savedProducts = localStorage.getItem('agm2_inventory');
    if (savedProducts) {
      try {
        const parsed = JSON.parse(savedProducts);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProducts(parsed);
          hasLocalData = true;
        }
      } catch (e) {
        console.error("Failed to parse local products:", e);
        localStorage.removeItem('agm2_inventory'); // Clear corrupted data
      }
    }

    // If we already have local products, don't show full-screen spinner to prevent UI flash
    if (hasLocalData) {
      setIsFetchingData(false);
    } else if (showSpinner) {
      setIsFetchingData(true);
    }

    if (!isSupabaseConfigured) {
      setIsFetchingData(false);
      return;
    }

    let attempts = 0;
    let success = false;
    let lastErr = '';

    while (attempts < maxRetries && !success) {
      attempts++;
      try {
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort('Query timed out'), 30000); // 30 seconds timeout for mobile 4G

        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('created_at', { ascending: false })
          .abortSignal(abortController.signal);
        
        clearTimeout(timeoutId);

        if (error) {
          console.warn(`Attempt ${attempts} Supabase error:`, error.message);
          lastErr = error.message;
          if (attempts < maxRetries) {
            await new Promise(r => setTimeout(r, 500 * attempts));
          }
        } else if (data) {
          const dbProducts = data.map(mapDbToProduct);
          setProducts(dbProducts);
          try {
            localStorage.setItem('agm2_inventory', JSON.stringify(dbProducts));
          } catch (e) {}
          success = true;
          setFetchError(null);
        }
      } catch (err: any) {
        const msg = err?.name === 'AbortError' 
          ? (err.message || 'Koneksi timeout. Jaringan terlalu lambat.') 
          : (err?.message || 'Gagal terhubung ke database.');
        console.warn(`Attempt ${attempts} fetch exception:`, msg);
        lastErr = msg;
        if (attempts < maxRetries) {
          await new Promise(r => setTimeout(r, 500 * attempts));
        }
      }
    }

    if (!success && !hasLocalData) {
      setFetchError(lastErr || 'Gagal memuat data dari database.');
    } else if (success) {
      setFetchError(null);
    }
    setIsFetchingData(false);
  };

  const fetchTransactions = async (maxRetries = 1) => { // Added maxRetries parameter

    // Try loading from local storage first
    const savedTransactions = localStorage.getItem('agm2_transactions');
    if (savedTransactions) {
      try {
        const parsed = JSON.parse(savedTransactions);
        if (Array.isArray(parsed)) {
          setTransactions(parsed.map(mapDbToTransaction));
        }
      } catch (e) {
        console.error("Failed to parse local transactions:", e);
        localStorage.removeItem('agm2_transactions'); // Clear corrupted data
      }
    }

    if (!isSupabaseConfigured) return;
    
    let attempts = 0;
    let success = false;

    while (attempts < maxRetries && !success) {
      attempts++;
      try {
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort('Query timed out'), 15000);

        const { data, error } = await supabase
          .from('transactions')
          .select('id, customer_name, customer_phone, customer_address, total_price, items, created_at')
          .order('created_at', { ascending: false })
          .limit(300)
          .abortSignal(abortController.signal);

        clearTimeout(timeoutId);

        if (error) {
          console.warn(`Attempt ${attempts} Supabase transactions error:`, error.message);
          if (attempts < maxRetries) {
            await new Promise(r => setTimeout(r, 300));
          }
        } else if (data) {
          const dbMapped: Transaction[] = data.map(mapDbToTransaction);
          
          setTransactions(dbMapped);
          try { localStorage.setItem('agm2_transactions', JSON.stringify(dbMapped)); } catch (e) {}
          success = true;
        }
      } catch (err: any) {
        const msg = err?.name === 'AbortError' 
          ? (err.message || 'Koneksi timeout.') 
          : (err?.message || 'Gagal terhubung ke database.');
        console.warn(`Attempt ${attempts} fetch transactions exception:`, msg);
        if (attempts < maxRetries) {
          await new Promise(r => setTimeout(r, 300));
        }
      }
    }
  };

  const fetchDeletedLogs = async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase
        .from('deleted_logs')
        .select('*')
        .order('deleted_at', { ascending: false })
        .limit(300);

      if (!error && data && data.length > 0) {
        const mapped: DeletedProductLog[] = data.map((item: any) => ({
          id: String(item.id),
          deletedAt: item.deleted_at || new Date().toISOString(),
          product: typeof item.product === 'string' ? JSON.parse(item.product) : item.product,
          changedBy: (item.changed_by && item.changed_by !== 'Admin' && item.changed_by !== 'Unknown/System') ? item.changed_by : 'Ardian'
        }));
        setDeletedProductsHistory(mapped);
        try { localStorage.setItem('agm2_deleted_products_history', JSON.stringify(mapped)); } catch (e) {}
      }
    } catch (e) {
      console.warn('Fetch deleted_logs exception (fallback to local):', e);
    }
  };

  const fetchStockHistory = async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase
        .from('stock_history')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(300);

      if (!error && data && data.length > 0) {
        const mapped: StockHistoryLog[] = data.map((item: any) => ({
          id: String(item.id),
          productId: String(item.product_id),
          productName: item.product_name || '',
          oldStock: Number(item.old_stock) || 0,
          newStock: Number(item.new_stock) || 0,
          changeAmount: Number(item.change_amount) || 0,
          changedBy: (item.changed_by && item.changed_by !== 'Admin') ? item.changed_by : 'Ardian',
          changedAt: item.changed_at || new Date().toISOString(),
          notes: item.notes || ''
        }));
        setStockHistory(mapped);
        try { localStorage.setItem('agm2_stock_history', JSON.stringify(mapped)); } catch (e) {}
      } else if (error) {
        console.warn('Fetch stock_history error:', error.message);
      }
    } catch (e) {
      console.warn('Fetch stock_history exception:', e);
    }
  };








  const addTransaction = async (tx: Transaction) => {
    const rawDate = tx.dateRaw || new Date().toISOString();
    const txWithRawDate: Transaction = { 
      ...tx, 
      dateRaw: rawDate,
      date: tx.date || new Date(rawDate).toLocaleString('id-ID') 
    };

    setTransactions(prev => {
      const updated = [txWithRawDate, ...prev.filter(t => t.id !== tx.id)];
      localStorage.setItem('agm2_transactions', JSON.stringify(updated));
      return updated;
    });

    if (isSupabaseConfigured) {
      try {
        const itemsPayload = {
          meta: {
            payAmount: txWithRawDate.payAmount,
            remainingAmount: txWithRawDate.remainingAmount,
            changeAmount: txWithRawDate.changeAmount,
            notes: txWithRawDate.notes
          },
          list: txWithRawDate.items
        };

        const { error } = await supabase
          .from('transactions')
          .insert([{
            id: txWithRawDate.id,
            created_at: txWithRawDate.dateRaw,
            customer_name: txWithRawDate.customerName,
            customer_phone: txWithRawDate.customerPhone || null,
            customer_address: txWithRawDate.customerAddress || null,
            total_price: txWithRawDate.totalPrice,
            items: itemsPayload,
            delivery_fee: txWithRawDate.deliveryFee || 0
          }]);

        if (error) {
          console.warn('Supabase insert transaction error:', error.message);
          triggerToast('Gagal menyinkronkan transaksi ke server: ' + error.message);
        } else {
          console.log('Supabase insert transaction SUCCESS for ID:', txWithRawDate.id);
        }
      } catch (e) {
        console.warn('Supabase transaction insert exception:', e);
      }
    }
  };


  const handleDeleteTransaction = async () => {
    if (!transactionToDelete) return;

    const idToDelete = transactionToDelete;
    const prevTransactions = transactions;
    const updatedTransactions = transactions.filter(tx => tx.id !== idToDelete);

    setTransactions(updatedTransactions);
    localStorage.setItem('agm2_transactions', JSON.stringify(updatedTransactions));
    setIsDeleteTransactionModalOpen(false);
    setTransactionToDelete(null);
    triggerToast('Transaksi berhasil dihapus.');

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('id', idToDelete);

        if (error) {
          console.error('Supabase delete transaction error:', error);
          triggerToast('Gagal menghapus transaksi dari server: ' + error.message);
          setTransactions(prevTransactions);
          localStorage.setItem('agm2_transactions', JSON.stringify(prevTransactions));
        }
      } catch (e) {
        console.warn('Supabase transaction delete exception:', e);
        triggerToast('Gagal menghapus transaksi dari server.');
        setTransactions(prevTransactions);
        localStorage.setItem('agm2_transactions', JSON.stringify(prevTransactions));
      }
    }
  };

  const handleMarkAsPaid = async (txId: string) => {
    const targetTx = transactions.find(t => t.id === txId);
    if (!targetTx) return;

    const updatedTx: Transaction = {
      ...targetTx,
      payAmount: targetTx.totalPrice,
      remainingAmount: 0,
      changeAmount: 0,
    };

    const updatedList = transactions.map(t => t.id === txId ? updatedTx : t);
    setTransactions(updatedList);
    localStorage.setItem('agm2_transactions', JSON.stringify(updatedList));
    setSelectedTxDetail(updatedTx);
    triggerToast('Status transaksi berhasil diperbarui menjadi Lunas!');

    if (isSupabaseConfigured) {
      try {
        const itemsPayload = {
          meta: {
            payAmount: targetTx.totalPrice,
            remainingAmount: 0,
            changeAmount: 0,
            notes: targetTx.notes
          },
          list: targetTx.items
        };

        const payload = {
          id: txId,
          customer_name: targetTx.customerName,
          customer_phone: targetTx.customerPhone || null,
          customer_address: targetTx.customerAddress || null,
          total_price: targetTx.totalPrice,
          items: itemsPayload,
          created_at: targetTx.dateRaw || new Date().toISOString(),
          delivery_fee: targetTx.deliveryFee || 0
        };

        // Attempt update first
        const { error: updateErr } = await supabase
          .from('transactions')
          .update({
            items: itemsPayload,
            total_price: targetTx.totalPrice,
            delivery_fee: targetTx.deliveryFee || 0
          })
          .eq('id', txId);

        // Fall back to DELETE + INSERT if RLS policy blocks UPDATE query
        if (updateErr) {
          console.warn('Supabase update blocked, executing DELETE + INSERT fallback:', updateErr.message);
          await supabase.from('transactions').delete().eq('id', txId);
          await supabase.from('transactions').insert([payload]);
        }
      } catch (e) {
        console.warn('Supabase update transaction paid status exception:', e);
      }
    }
  };

  // Setup realtime subscription (called after initial fetch succeeds)
  const setupRealtime = () => {
    if (!isSupabaseConfigured) return null;

    // Product Listener
    const productChannel = supabase
      .channel('realtime-products-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newItem = mapDbToProduct(payload.new);
            setProducts(prev => {
              if (prev.some(p => p.id === newItem.id)) return prev;
              return [newItem, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedItem = mapDbToProduct(payload.new);
            const localEdit = lastLocalStockEditsRef.current[updatedItem.id];

            // Block stale WebSocket echoes from overwriting recent local edits (< 5000ms)
            if (localEdit && (Date.now() - localEdit.time < 5000)) {
              if (updatedItem.stock === localEdit.stock) {
                delete lastLocalStockEditsRef.current[updatedItem.id];
              }
              return;
            }

            setProducts(prev => prev.map(p => p.id === updatedItem.id ? { ...p, ...updatedItem } : p));
          } else if (payload.eventType === 'DELETE') {
            const deletedId = String(payload.old.id);
            setProducts(prev => prev.filter(p => p.id !== deletedId));
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('Realtime product channel warning:', status, err);
        }
      });

    // Transaction Listener
    const transactionChannel = supabase
      .channel('realtime-transactions-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newTx = mapDbToTransaction(payload.new);
            setTransactions(prev => {
              if (prev.some(tx => tx.id === newTx.id)) return prev;
              const updated = [newTx, ...prev];
              try { localStorage.setItem('agm2_transactions', JSON.stringify(updated)); } catch (e) {}
              return updated;
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedTx = mapDbToTransaction(payload.new);
            setTransactions(prev => {
              const updated = prev.map(tx => tx.id === updatedTx.id ? { ...tx, ...updatedTx } : tx);
              try { localStorage.setItem('agm2_transactions', JSON.stringify(updated)); } catch (e) {}
              return updated;
            });
            setSelectedTxDetail(prev => {
              if (prev && prev.id === updatedTx.id) {
                return updatedTx;
              }
              return prev;
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedId = String(payload.old.id);
            setTransactions(prev => {
              const updated = prev.filter(tx => tx.id !== deletedId);
              try { localStorage.setItem('agm2_transactions', JSON.stringify(updated)); } catch (e) {}
              return updated;
            });
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('Realtime transaction channel warning:', status, err);
        }
      });

    // Deleted Logs Listener
    const deletedLogChannel = supabase
      .channel('realtime-deleted-logs-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deleted_logs' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newItem: DeletedProductLog = {
              id: String(payload.new.id),
              deletedAt: payload.new.deleted_at || new Date().toISOString(),
              product: typeof payload.new.product === 'string' ? JSON.parse(payload.new.product) : payload.new.product,
              changedBy: payload.new.changed_by || 'Admin'
            };
            setDeletedProductsHistory(prev => {
              if (prev.some(item => item.id === newItem.id)) return prev;
              const updated = [newItem, ...prev];
              try { localStorage.setItem('agm2_deleted_products_history', JSON.stringify(updated)); } catch (e) {}
              return updated;
            });
          }
        }
      )
      .subscribe();

    // Stock History Listener
    const stockHistoryChannel = supabase
      .channel('realtime-stock-history-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stock_history' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newItem: StockHistoryLog = {
              id: String(payload.new.id),
              productId: String(payload.new.product_id),
              productName: payload.new.product_name || '',
              oldStock: Number(payload.new.old_stock) || 0,
              newStock: Number(payload.new.new_stock) || 0,
              changeAmount: Number(payload.new.change_amount) || 0,
              changedBy: payload.new.changed_by || 'Admin',
              changedAt: payload.new.changed_at || new Date().toISOString(),
              notes: payload.new.notes || ''
            };
            setStockHistory(prev => {
              if (prev.some(item => item.id === newItem.id)) return prev;
              const updated = [newItem, ...prev];
              try { localStorage.setItem('agm2_stock_history', JSON.stringify(updated)); } catch (e) {}
              return updated;
            });
          }
        }
      )
      .subscribe();

    // Return an unsubscribe function
    return () => {
      productChannel.unsubscribe();
      transactionChannel.unsubscribe();
      deletedLogChannel.unsubscribe();
      stockHistoryChannel.unsubscribe();
      console.log('Realtime channels unsubscribed.');
    };
  };

  // Initial load: fetch data THEN connect realtime; re-sync on visibility change (mobile tab resume)
  useEffect(() => {
    let cleanupRealtime: (() => void) | null = null;

    // Fetch all tables concurrently (in parallel) to cut initial load time in half
    Promise.all([
      fetchProducts(1, true),
      fetchDeletedLogs(),
      fetchStockHistory(),
      fetchCustomRequests(),
      new Promise(r => setTimeout(r, 100)).then(() => fetchTransactions())
    ]).then(() => {
      if (isSupabaseConfigured && import.meta.env.VITE_SUPABASE_REALTIME_ENABLED === 'true') {
        cleanupRealtime = setupRealtime();
      }
    });

    // Re-sync when user returns to tab (critical for mobile where browser suspends tabs)
    // Run silently in the background (showSpinner = false) for zero layout flicker
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchProducts(2, false);
        fetchDeletedLogs();
        fetchStockHistory();
        new Promise(r => setTimeout(r, 100)).then(() => fetchTransactions());
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Automatic background polling interval (every 30s) to keep data fresh automatically
    const autoSyncInterval = setInterval(() => {
      fetchProducts(1, false);
      fetchDeletedLogs();
      fetchStockHistory();
      fetchTransactions();
    }, 30000);

    const auth = localStorage.getItem('agm2_admin_mode');
    if (auth === 'true') {
      const savedUser = localStorage.getItem('agm2_admin_user');
      if (savedUser) {
        try { setCurrentAdminUser(JSON.parse(savedUser)); } catch (e) {}
      } else {
        setCurrentAdminUser({ name: 'Ardian', email: 'deysen10@gmail.com' });
      }
    }

    return () => {
      if (cleanupRealtime) cleanupRealtime(); // Call the cleanup function
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(autoSyncInterval);
    };
  }, []);

  // Supabase Realtime Presence for Active Online Admins (Ardian & Widya)
  useEffect(() => {
    if (!isSupabaseConfigured || !currentAdminUser) {
      if (presenceChannelRef.current) {
        presenceChannelRef.current.untrack().catch(() => {});
        presenceChannelRef.current.unsubscribe();
        presenceChannelRef.current = null;
      }
      setActiveOnlineAdmins([]);
      return;
    }

    const presenceChannel = supabase.channel('online-admins-presence', {
      config: {
        presence: {
          key: currentAdminUser.name,
        },
      },
    });

    presenceChannelRef.current = presenceChannel;

    const syncPresenceUsers = () => {
      const state = presenceChannel.presenceState();
      const usersList: { name: string; email: string; onlineAt: string }[] = [];
      
      Object.values(state).forEach((presences: any) => {
        if (Array.isArray(presences)) {
          presences.forEach((p: any) => {
            if (p.name && !usersList.some(u => u.name === p.name)) {
              usersList.push({
                name: p.name,
                email: p.email || '',
                onlineAt: p.onlineAt || new Date().toISOString()
              });
            }
          });
        }
      });

      setActiveOnlineAdmins(usersList);
    };

    presenceChannel
      .on('presence', { event: 'sync' }, syncPresenceUsers)
      .on('presence', { event: 'join' }, syncPresenceUsers)
      .on('presence', { event: 'leave' }, syncPresenceUsers)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            name: currentAdminUser.name,
            email: currentAdminUser.email,
            onlineAt: new Date().toISOString(),
          });
        }
      });

    return () => {
      presenceChannel.untrack().catch(() => {});
      presenceChannel.unsubscribe();
      presenceChannelRef.current = null;
    };
  }, [currentAdminUser]);

  const saveProducts = (list: Product[]) => {
    setProducts(list);
    localStorage.setItem('agm2_inventory', JSON.stringify(list));
  };

  // Helper to compress image file using HTML5 Canvas before uploading
  const compressImageFile = (file: File, maxWidth = 1000, maxHeight = 1000, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error('Gagal memuat gambar untuk kompresi.'));
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            if (width / height > maxWidth / maxHeight) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return reject(new Error('Canvas 2D context tidak tersedia.'));
          }

          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // Function to handle image upload to Cloudinary via API Route
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) {
      triggerToast('Pilih gambar untuk diunggah!');
      return;
    }

    const file = event.target.files[0];

    try {
      // Client-side validation: limit raw file to 15MB since canvas will compress it
      if (file.size > 15 * 1024 * 1024) { 
        throw new Error('Ukuran gambar mentah maksimal 15MB.');
      }
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
      if (!allowedTypes.includes(file.type.toLowerCase()) && !file.type.startsWith('image/')) {
        throw new Error('Format gambar tidak valid. Gunakan JPG, PNG, WEBP, atau foto kamera.');
      }

      triggerToast('Mengompres & mengunggah gambar...');

      // Compress image client-side before sending to serverless API Route
      const base64Image = await compressImageFile(file);

      // Call the API Route
      const response = await fetch('/api/cloudinary-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: base64Image }),
      });

      const responseText = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        if (response.status === 413) {
          throw new Error('Ukuran payload terlalu besar untuk server.');
        }
        throw new Error(`Respons server tidak valid (${response.status}): ${responseText.substring(0, 120)}`);
      }

      if (response.ok && data.secure_url && data.public_id) {
        // If editing a product and changing image, delete the old image from Cloudinary
        if (formMode === 'edit' && editingId) {
          const oldProduct = products.find(p => p.id === editingId);
          if (oldProduct && oldProduct.image_public_id) {
            // Call API Route to delete old image
            try {
              await fetch('/api/cloudinary-delete', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ public_id: oldProduct.image_public_id }),
              });
            } catch (e) {
              console.warn('Failed to delete old Cloudinary image:', e);
            }
          }
        }
        setFormImages(prev => [...prev.filter(url => url !== data.secure_url), data.secure_url]);
        setFormImage('');
        setFormImagePublicId(data.public_id);
        triggerToast('Gambar berhasil diunggah!');
      } else {
        throw new Error(data.message || data.error || 'Gagal mengunggah gambar ke Cloudinary.');
      }

    } catch (error: any) {
      triggerToast('Kesalahan unggah gambar: ' + (error?.message || error));
      console.error('Cloudinary upload error:', error);
    } finally {
      event.target.value = ''; // Clear file input
    }
  };

  // Reset subcategory filter when category changes
  const selectCategoryFilter = (cat: 'all' | 'furniture' | 'electronics') => {
    setFilterCategory(cat);
    setFilterSubcategory('all');
  };

  // Sync subcategory on form category change
  useEffect(() => {
    if (formCategory === 'furniture') {
      if (!FURNITURE_SUBCATEGORIES.includes(formSubcategory)) {
        setFormSubcategory(FURNITURE_SUBCATEGORIES[0]);
      }
    } else {
      if (!ELECTRONICS_SUBCATEGORIES.includes(formSubcategory)) {
        setFormSubcategory(ELECTRONICS_SUBCATEGORIES[0]);
      }
    }
  }, [formCategory]);

  // Auth Handling for Admin Users (Ardian & Widya)
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setLoginError('');

    const inputClean = username.trim().toLowerCase();
    const passClean = password.trim();

    // Determine candidate accounts to test with Supabase Auth
    let candidateAccounts: { name: string; email: string }[] = [];

    if (inputClean.includes('widya') || inputClean === 'deysen95@gmail.com' || passClean.toLowerCase().includes('widya')) {
      candidateAccounts = [
        { name: 'Widya', email: 'deysen95@gmail.com' },
        { name: 'Ardian', email: 'deysen10@gmail.com' }
      ];
    } else if (inputClean.includes('ardian') || inputClean === 'deysen10@gmail.com' || passClean.toLowerCase().includes('ardian')) {
      candidateAccounts = [
        { name: 'Ardian', email: 'deysen10@gmail.com' },
        { name: 'Widya', email: 'deysen95@gmail.com' }
      ];
    } else {
      // Default 'admin' username: test both Widya & Ardian accounts
      candidateAccounts = [
        { name: 'Widya', email: 'deysen95@gmail.com' },
        { name: 'Ardian', email: 'deysen10@gmail.com' }
      ];
    }

    if (isSupabaseConfigured) {
      for (const account of candidateAccounts) {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: account.email,
            password: passClean,
          });

          if (!error && data?.user) {
            const userObj = { name: account.name, email: data.user.email || account.email };
            setCurrentAdminUser(userObj);
            localStorage.setItem('agm2_admin_user', JSON.stringify(userObj));
            localStorage.setItem('agm2_admin_mode', 'true');
            setIsLoginOpen(false);
            setUsername('');
            setPassword('');
            triggerToast(`Autentikasi Berhasil. Selamat Datang Admin ${account.name}!`);
            setIsAuthenticating(false);
            return;
          }
        } catch (err) {
          console.warn('Supabase auth attempt error:', err);
        }
      }
    }

    // Local fallback check
    if (
      (inputClean.includes('widya') || inputClean.includes('deysen95') || passClean.toLowerCase().includes('widya')) &&
      (passClean === 'kambing123' || passClean === 'widya123')
    ) {
      const userObj = { name: 'Widya', email: 'deysen95@gmail.com' };
      setCurrentAdminUser(userObj);
      localStorage.setItem('agm2_admin_user', JSON.stringify(userObj));
      localStorage.setItem('agm2_admin_mode', 'true');
      setIsLoginOpen(false);
      setUsername('');
      setPassword('');
      triggerToast('Autentikasi Berhasil. Selamat Datang Admin Widya!');
      setIsAuthenticating(false);
      return;
    }

    if (
      (inputClean.includes('ardian') || inputClean.includes('deysen10') || (inputClean === 'admin' && (passClean === 'kambing123' || passClean === 'ardian123'))) &&
      (passClean === 'kambing123' || passClean === 'ardian123')
    ) {
      const userObj = { name: 'Ardian', email: 'deysen10@gmail.com' };
      setCurrentAdminUser(userObj);
      localStorage.setItem('agm2_admin_user', JSON.stringify(userObj));
      localStorage.setItem('agm2_admin_mode', 'true');
      setIsLoginOpen(false);
      setUsername('');
      setPassword('');
      triggerToast('Autentikasi Berhasil. Selamat Datang Admin Ardian!');
      setIsAuthenticating(false);
      return;
    }

    if (
      inputClean === 'admin' && (passClean === 'widya123' || passClean === 'kambing123')
    ) {
      const userObj = { name: 'Widya', email: 'deysen95@gmail.com' };
      setCurrentAdminUser(userObj);
      localStorage.setItem('agm2_admin_user', JSON.stringify(userObj));
      localStorage.setItem('agm2_admin_mode', 'true');
      setIsLoginOpen(false);
      setUsername('');
      setPassword('');
      triggerToast('Autentikasi Berhasil. Selamat Datang Admin Widya!');
      setIsAuthenticating(false);
      return;
    }

    setIsAuthenticating(false);
    setLoginError('Email / Username atau Password salah.');
  };

  const handleLogout = async () => {
    if (presenceChannelRef.current) {
      try {
        await presenceChannelRef.current.untrack();
        presenceChannelRef.current.unsubscribe();
      } catch (e) {}
      presenceChannelRef.current = null;
    }

    setCurrentAdminUser(null);
    setActiveOnlineAdmins([]);
    localStorage.setItem('agm2_admin_mode', 'false');
    localStorage.removeItem('agm2_admin_user');
    if (isSupabaseConfigured) {
      supabase.auth.signOut().catch(() => {});
    }
    setCurrentView('catalog');
    triggerToast('Berhasil Keluar');
  };

  // Request stock adjustment (triggers confirmation toggle modal first)
  const adjustStock = async (id: string, amount: number) => {
    const currentProduct = products.find(p => p.id === id);
    if (!currentProduct) return;

    let baseStock = currentProduct.stock;
    if (pendingStockUpdatesRef.current[id]) {
      baseStock = pendingStockUpdatesRef.current[id].targetStock;
    }

    const updatedStock = Math.max(0, baseStock + amount);
    if (updatedStock === baseStock) return;

    setStockEditConfirmation({
      productId: currentProduct.id,
      productName: currentProduct.name,
      oldStock: baseStock,
      newStock: updatedStock
    });
  };

  const setDirectStock = (id: string, newStock: number) => {
    const currentProduct = products.find(p => p.id === id);
    if (!currentProduct) return;

    const safeStock = Math.max(0, newStock);
    if (safeStock === currentProduct.stock) return;

    setStockEditConfirmation({
      productId: currentProduct.id,
      productName: currentProduct.name,
      oldStock: currentProduct.stock,
      newStock: safeStock
    });
  };

  // Confirmed stock update execution
  const confirmAndExecuteStockAdjustment = async () => {
    if (!stockEditConfirmation) return;
    const { productId, productName, oldStock, newStock } = stockEditConfirmation;
    setStockEditConfirmation(null);

    const changeAmount = newStock - oldStock;
    const changedBy = currentAdminUser?.name || 'Ardian';
    const changedAt = new Date().toISOString();

    // 1. Update state immediately for instant UI response
    setProducts(prev => {
      const updatedList = prev.map(p => p.id === productId ? { ...p, stock: newStock } : p);
      try { localStorage.setItem('agm2_inventory', JSON.stringify(updatedList)); } catch (e) {}
      return updatedList;
    });

    // 2. Add log record to local stockHistory state
    const newLogItem: StockHistoryLog = {
      id: 'log-' + Date.now(),
      productId,
      productName,
      oldStock,
      newStock,
      changeAmount,
      changedBy,
      changedAt,
      notes: changeAmount > 0 ? `Penambahan +${changeAmount} unit` : `Pengurangan ${Math.abs(changeAmount)} unit`
    };

    setStockHistory(prev => {
      const updated = [newLogItem, ...prev];
      try { localStorage.setItem('agm2_stock_history', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });

    triggerToast(`Stok "${productName}" diperbarui ke ${newStock} unit.`);

    // 3. Write to Supabase DB (products table & stock_history table)
    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('products')
          .update({ stock: newStock })
          .eq('id', productId);

        await supabase
          .from('stock_history')
          .insert([{
            product_id: productId,
            product_name: productName,
            old_stock: oldStock,
            new_stock: newStock,
            change_amount: changeAmount,
            changed_by: changedBy,
            changed_at: changedAt,
            notes: newLogItem.notes
          }]);
      } catch (e: any) {
        console.error('Supabase stock history update exception:', e);
      }
    }
  };

  const deductBulkStock = async (itemsToDeduct: { productId: string; quantity: number }[]) => {
    if (!itemsToDeduct || itemsToDeduct.length === 0) return;

    const deductionsMap = new Map<string, number>();
    itemsToDeduct.forEach(item => {
      const current = deductionsMap.get(item.productId) || 0;
      deductionsMap.set(item.productId, current + item.quantity);
    });

    const updatesToPersist: { id: string; targetStock: number }[] = [];

    setProducts(prev => {
      const updatedList = prev.map(p => {
        const qtyToDeduct = deductionsMap.get(p.id);
        if (qtyToDeduct) {
          const newStock = Math.max(0, p.stock - qtyToDeduct);
          updatesToPersist.push({ id: p.id, targetStock: newStock });
          lastLocalStockEditsRef.current[p.id] = { stock: newStock, time: Date.now() };
          return { ...p, stock: newStock };
        }
        return p;
      });

      try {
        localStorage.setItem('agm2_inventory', JSON.stringify(updatedList));
      } catch (e) {}

      return updatedList;
    });

    if (isSupabaseConfigured && updatesToPersist.length > 0) {
      Promise.allSettled(
        updatesToPersist.map(u =>
          supabase.from('products').update({ stock: u.targetStock }).eq('id', u.id)
        )
      ).catch(err => console.warn('Bulk stock DB update error:', err));
    }
  };



  // Optimistic Add / Edit Form Submission
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const priceVal = parseInt(formPrice.replace(/\D/g, '')) || 0;
    const discountVal = parseInt(formDiscount.replace(/\D/g, '')) || 0;
    const stockVal = parseInt(formStock) || 0;

    let allImgs = [...formImages];
    if (allImgs.length === 0 && formImage.trim()) {
      allImgs = [formImage.trim()];
    }
    const primaryImage = allImgs[0] || '';

    if (formMode === 'add') {
      const tempId = 'temp-' + Date.now();
      const newItem: Product = {
        id: tempId,
        name: formName,
        category: formCategory,
        subcategory: formSubcategory,
        description: formDescription,
        price: priceVal,
        discount: discountVal,
        stock: stockVal,
        unit: formUnit,
        image_url: primaryImage,
        images: allImgs,
        image_public_id: formImagePublicId,
        arrivalType: formArrivalType
      };

      // Optimistic update
      setProducts(prev => [newItem, ...prev]);
      setIsFormOpen(false);
      triggerToast('Produk ditambahkan!');

      if (isSupabaseConfigured) {
        const payloadWithImages = {
          name: formName,
          category: formCategory,
          subcategory: formSubcategory,
          description: formDescription,
          price: priceVal,
          discount: discountVal,
          stock: stockVal,
          unit: formUnit,
          image_url: primaryImage,
          images: allImgs,
          image_public_id: formImagePublicId,
          arrival_type: formArrivalType
        };

        const payloadFallback = {
          name: formName,
          category: formCategory,
          subcategory: formSubcategory,
          description: formDescription,
          price: priceVal,
          discount: discountVal,
          stock: stockVal,
          unit: formUnit,
          image_url: primaryImage,
          image_public_id: formImagePublicId,
          arrival_type: formArrivalType
        };

        let { data, error } = await supabase
          .from('products')
          .insert([payloadWithImages])
          .select();

        // Fallback retry if payloadWithImages fails due to missing DB column in Supabase schema
        if (error) {
          console.warn('Supabase insert with images column failed, retrying base payload...', error.message);
          const retryRes = await supabase
            .from('products')
            .insert([payloadFallback])
            .select();
          if (!retryRes.error) {
            error = null;
            data = retryRes.data;
          }
        }

        if (error) {
          console.warn('Supabase insert failed, keeping SKU locally:', error.message);
          triggerToast('Produk tersimpan di HP! Menyinkronkan ke server...');
          saveProducts([newItem, ...products]);
        } else if (data && data[0]) {
          const createdItem = mapDbToProduct(data[0]);
          saveProducts([createdItem, ...products.filter(p => p.id !== tempId)]);
        }
      } else {
        saveProducts([newItem, ...products]);
      }
    } else if (formMode === 'edit' && editingId) {
      const updatedItem: Product = {
        id: editingId,
        name: formName,
        category: formCategory,
        subcategory: formSubcategory,
        description: formDescription,
        price: priceVal,
        discount: discountVal,
        stock: stockVal,
        unit: formUnit,
        image_url: primaryImage,
        images: allImgs,
        image_public_id: formImagePublicId,
        arrivalType: formArrivalType
      };

      // If the image has changed, delete the old image from Cloudinary
      const oldProduct = products.find(p => p.id === editingId);
      if (oldProduct && oldProduct.image_public_id && oldProduct.image_public_id !== updatedItem.image_public_id) {
        try {
          await fetch('/api/cloudinary-delete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ public_id: oldProduct.image_public_id }),
          });
        } catch (error) {
          console.error('Failed to call Cloudinary delete API during edit:', error);
        }
      }

      // Optimistic update
      setProducts(prev => prev.map(p => p.id === editingId ? updatedItem : p));
      setIsFormOpen(false);
      triggerToast('Produk diperbarui!');

      if (isSupabaseConfigured) {
        const payloadWithImages = {
          name: formName,
          category: formCategory,
          subcategory: formSubcategory,
          description: formDescription,
          price: priceVal,
          discount: discountVal,
          stock: stockVal,
          unit: formUnit,
          image_url: primaryImage,
          images: allImgs,
          image_public_id: formImagePublicId,
          arrival_type: formArrivalType
        };

        const payloadFallback = {
          name: formName,
          category: formCategory,
          subcategory: formSubcategory,
          description: formDescription,
          price: priceVal,
          discount: discountVal,
          stock: stockVal,
          unit: formUnit,
          image_url: primaryImage,
          image_public_id: formImagePublicId,
          arrival_type: formArrivalType
        };

        let { error } = await supabase
          .from('products')
          .update(payloadWithImages)
          .eq('id', editingId);

        // Fallback retry if payloadWithImages fails due to missing DB column in Supabase schema
        if (error) {
          console.warn('Supabase update with images column failed, retrying base payload...', error.message);
          const retryRes = await supabase
            .from('products')
            .update(payloadFallback)
            .eq('id', editingId);
          if (!retryRes.error) {
            error = null;
          }
        }

        if (error) {
          triggerToast('Gagal memperbarui di server: ' + error.message);
          fetchProducts();
        }
      } else {
        saveProducts(products.map(p => p.id === editingId ? updatedItem : p));
      }
    }
  };

  // Move product to Deleted SKU History log
  const deleteProduct = async (id: string) => {
    const productToDelete = products.find(p => p.id === id);
    if (!productToDelete) return;

    // Create log record
    const logItem: DeletedProductLog = {
      id: productToDelete.id,
      deletedAt: new Date().toISOString(),
      product: productToDelete,
      changedBy: currentAdminUser?.name || 'Ardian'
    };

    // Save to deletedProductsHistory state & localStorage
    setDeletedProductsHistory(prev => {
      const updated = [logItem, ...prev.filter(item => item.id !== id)];
      try { localStorage.setItem('agm2_deleted_products_history', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });

    // Remove from active products
    const updatedActive = products.filter(p => p.id !== id);
    setProducts(updatedActive);
    try { localStorage.setItem('agm2_inventory', JSON.stringify(updatedActive)); } catch (e) {}
    setDeleteConfirmId(null);
    triggerToast(`Produk "${productToDelete.name}" dipindahkan ke Riwayat SKU Dihapus.`);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('products').delete().eq('id', id);

        // Insert record into deleted_logs table (sync across all devices)
        await supabase.from('deleted_logs').insert([{
          id: productToDelete.id,
          product: productToDelete,
          deleted_at: logItem.deletedAt,
          changed_by: currentAdminUser?.name || 'Ardian'
        }]);
      } catch (e) {
        console.warn('Supabase delete product error:', e);
      }
    }
  };



  // Open modal config
  const openAdd = () => {
    setFormMode('add');
    setFormName('');
    setFormCategory('furniture');
    setFormSubcategory(FURNITURE_SUBCATEGORIES[0]);
    setFormDescription('');
    setFormPrice('');
    setFormDiscount('');
    setFormStock('');
    setFormUnit('Pcs');
    setFormImage('');
    setFormImages([]);
    setFormArrivalType('');
    setIsFormOpen(true);
  };

  const openEdit = (p: Product) => {
    setFormMode('edit');
    setEditingId(p.id);
    setFormName(p.name);
    setFormCategory(p.category);
    setFormSubcategory(p.subcategory || (p.category === 'furniture' ? FURNITURE_SUBCATEGORIES[0] : ELECTRONICS_SUBCATEGORIES[0]));
    setFormDescription(p.description);
    setFormPrice(p.price.toLocaleString('id-ID'));
    setFormDiscount(p.discount ? p.discount.toLocaleString('id-ID') : '');
    setFormStock(p.stock.toString());
    setFormUnit(p.unit);
    
    const initialImgs = p.images && p.images.length > 0 ? p.images : (p.image_url ? [p.image_url] : []);
    setFormImages(initialImgs);
    setFormImage(initialImgs[0] || '');
    setFormImagePublicId(p.image_public_id || null);
    setFormArrivalType(p.arrivalType || '');
    setIsFormOpen(true);
  };



  // Memoized filter application for 60fps responsive UI
  const filteredProducts = React.useMemo(() => {
    const searchTarget = (currentView === 'stock' && stockSearchTerm) ? stockSearchTerm.trim().toLowerCase() : globalSearch.trim().toLowerCase();
    
    return products.filter(p => {
      const matchCategory = filterCategory === 'all' || p.category === filterCategory;
      const matchSubcategory = filterSubcategory === 'all' || p.subcategory === filterSubcategory;
      
      const matchSearch = !searchTarget || 
        p.name.toLowerCase().includes(searchTarget) || 
        p.description.toLowerCase().includes(searchTarget);
      
      const isInStock = p.stock > 0;
      let matchStock = true;
      if (showInStock && !showBackorder) {
        matchStock = isInStock;
      } else if (!showInStock && showBackorder) {
        matchStock = !isInStock;
      } else if (showInStock && showBackorder) {
        matchStock = true;
      } else {
        // Fallback: if user unchecks both boxes, show all products instead of wiping display
        matchStock = true;
      }

      return matchCategory && matchSubcategory && matchSearch && matchStock;
    });
  }, [products, filterCategory, filterSubcategory, globalSearch, stockSearchTerm, showInStock, showBackorder, currentView]);

  const getStockLabel = (stock: number) => {
    const s = isNaN(stock) ? 0 : Math.max(0, Number(stock) || 0);
    if (s === 0) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 ring-1 ring-rose-600/20"><svg className="w-3 h-3 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg> HABIS</span>;
    if (s <= 3) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 ring-1 ring-amber-600/20"><svg className="w-3 h-3 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> TERBATAS</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20"><svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> TERSEDIA</span>;
  };

  return (
    <div className="bg-surface text-on-surface selection:bg-primary-fixed selection:text-primary min-h-screen flex flex-col font-body-md">
      
      {/* ── TOP NAV BAR ── */}
      <nav className="fixed top-0 left-0 w-full z-50 px-4 md:px-8 h-16 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 shadow-xs flex items-center">
        <div className="max-w-[1400px] w-full mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3 lg:gap-8">
            {/* Mobile hamburger menu */}
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden text-slate-700 hover:text-slate-900 flex items-center justify-center p-2 rounded-xl hover:bg-slate-100/80 transition-colors cursor-pointer"
              title="Buka Menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div 
              className="flex items-center gap-2.5 cursor-pointer select-none group"
              onClick={() => setCurrentView('catalog')}
            >
              <img src="/logo.png" alt="AGM 2 Logo" className="h-7 sm:h-8 w-auto object-contain transition-transform group-hover:scale-105" />
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-md hidden sm:inline">PADANG</span>
            </div>
            <div className="hidden lg:flex items-center gap-1.5 bg-slate-100/70 p-1 rounded-xl border border-slate-200/50">
              <button
                onClick={() => setCurrentView('catalog')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${currentView === 'catalog' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Katalog
              </button>
              {isAdmin && (
                <>
                  <button
                    onClick={() => setCurrentView('stock')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${currentView === 'stock' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Inventaris
                  </button>
                  <button
                    onClick={() => setCurrentView('dashboard')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${currentView === 'dashboard' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Analisis
                  </button>
                  <button
                    onClick={() => setCurrentView('nota')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${currentView === 'nota' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Nota
                  </button>
                  <button
                    onClick={() => setCurrentView('custom-requests')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${currentView === 'custom-requests' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                    <span>Custom Requests</span>
                  </button>
                </>
              )}
            </div>
          </div>


          {/* Right Top Items (Responsive Search and Login) */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative max-w-[130px] sm:max-w-xs">
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Cari barang..."
                className="pl-9 pr-7 py-1.5 bg-slate-100/80 border border-slate-200/80 text-xs rounded-xl w-full focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all outline-none text-slate-900 placeholder:text-slate-400"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
              />
              {globalSearch && (
                <button 
                  onClick={() => setGlobalSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            
            {isAdmin ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={() => setIsOnlineAdminsModalOpen(true)}
                  className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition-all cursor-pointer"
                  title="Petugas Admin Online"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                  <span>{activeOnlineAdmins.length || 1} Online</span>
                </button>

                <div className="px-2.5 sm:px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800">
                  <span>{currentAdminUser?.name || 'Admin'}</span>
                </div>
                <button 
                  onClick={handleLogout}
                  className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-all active:scale-[0.98] cursor-pointer"
                  title="Logout Admin"
                >
                  Keluar
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setIsLoginOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-all active:scale-[0.98] shadow-xs cursor-pointer"
                title="Login Admin"
              >
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span className="hidden md:inline uppercase tracking-wider">LOGIN ADMIN</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ── MOBILE DRAWER SIDEBAR ── */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex" onClick={() => setIsSidebarOpen(false)}>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" />
          
          {/* Drawer Panel */}
          <aside 
            className="relative flex flex-col w-72 max-w-[300px] h-full p-6 gap-y-6 bg-white border-r border-slate-200 overflow-y-auto animate-slide-in shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header / Close */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="AGM 2 Logo" className="h-6.5 w-auto object-contain" />
                <span className="font-extrabold text-slate-900 text-xs tracking-tight">Katalog Padang</span>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-slate-900 flex items-center justify-center p-1 rounded-lg cursor-pointer">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div>
              <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3">Menu</h3>
              <div className="space-y-1">
                <button
                  onClick={() => { setCurrentView('catalog'); setIsSidebarOpen(false); }}
                  className={`w-full text-left flex items-center gap-3 p-3 rounded-xl text-xs font-bold transition-all ${currentView === 'catalog' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="14" width="7" height="7" rx="1.5" />
                    <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  </svg>
                  <span>Katalog Produk</span>
                </button>

                {isAdmin && (
                  <>
                    <button
                      onClick={() => { setCurrentView('stock'); setIsSidebarOpen(false); }}
                      className={`w-full text-left flex items-center gap-3 p-3 rounded-xl text-xs font-bold transition-all ${currentView === 'stock' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                        <path d="m3.3 7 8.7 5 8.7-5" />
                        <path d="M12 22V12" />
                      </svg>
                      <span>Kontrol Stok</span>
                    </button>
                    <button
                      onClick={() => { setCurrentView('dashboard'); setIsSidebarOpen(false); }}
                      className={`w-full text-left flex items-center gap-3 p-3 rounded-xl text-xs font-bold transition-all ${currentView === 'dashboard' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 3v18h18" />
                        <path d="m19 9-5 5-4-4-3 3" />
                      </svg>
                      <span>Analisis &amp; Performa</span>
                    </button>
                    <button
                      onClick={() => { setCurrentView('nota'); setIsSidebarOpen(false); }}
                      className={`w-full text-left flex items-center gap-3 p-3 rounded-xl text-xs font-bold transition-all ${currentView === 'nota' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z" />
                        <path d="M16 8h-8" />
                        <path d="M16 12h-8" />
                        <path d="M13 16h-5" />
                      </svg>
                      <span>Kasir &amp; Cetak Nota</span>
                    </button>
                    <button
                      onClick={() => { setCurrentView('custom-requests'); setIsSidebarOpen(false); }}
                      className={`w-full text-left flex items-center gap-3 p-3 rounded-xl text-xs font-bold transition-all ${currentView === 'custom-requests' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      <svg className="w-4 h-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                      </svg>
                      <span>Custom Requests</span>
                    </button>
                    <button
                      onClick={() => { setIsStockLogModalOpen(true); setIsSidebarOpen(false); }}
                      className="w-full text-left flex items-center justify-between p-3 rounded-xl text-xs font-bold transition-all text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <svg className="w-4 h-4 shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01m-.01 4h.01" />
                        </svg>
                        <span className="whitespace-nowrap">Riwayat Edit Stok</span>
                      </div>
                    </button>
                    <button
                      onClick={() => { setIsDeletedLogModalOpen(true); setIsSidebarOpen(false); }}
                      className="w-full text-left flex items-center justify-between p-3 rounded-xl text-xs font-bold transition-all text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <svg className="w-4 h-4 shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M7 3v4a1 1 0 001 1h8a1 1 0 001-1V3" />
                          <rect x="3" y="8" width="18" height="13" rx="2" ry="2" />
                          <line x1="10" y1="12" x2="14" y2="12" />
                        </svg>
                        <span className="whitespace-nowrap">Riwayat Dihapus</span>
                      </div>
                    </button>
                    <button
                      onClick={() => { setIsOnlineAdminsModalOpen(true); setIsSidebarOpen(false); }}
                      className="w-full text-left flex items-center justify-between p-3 rounded-xl text-xs font-bold transition-all text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                        <span className="whitespace-nowrap">Petugas Online</span>
                      </div>
                      <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
                        {activeOnlineAdmins.length || 1}
                      </span>
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3">Status Ketersediaan</h3>
              <div className="space-y-2.5">
                <label className="flex items-center gap-2.5 cursor-pointer select-none text-xs font-semibold text-slate-700">
                  <input 
                    type="checkbox" 
                    checked={showInStock}
                    onChange={(e) => setShowInStock(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 accent-slate-900"
                  />
                  <span>Tampilkan Barang Tersedia</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer select-none text-xs font-semibold text-slate-700">
                  <input 
                    type="checkbox"
                    checked={showBackorder}
                    onChange={(e) => setShowBackorder(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 accent-slate-900"
                  />
                  <span>Tampilkan Pre-Order / Habis</span>
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-3 text-xs">
              <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">Kontak &amp; Toko</h3>
              
              <div className="flex items-center gap-2 text-slate-600 font-medium">
                <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>07.30 - 21.00 WIB</span>
              </div>

              <a 
                href="https://instagram.com/toko_agm_padang" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-2.5 text-slate-700 font-semibold hover:text-pink-600 transition-colors"
              >
                <svg className="w-4 h-4 fill-pink-500 shrink-0" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
                <span>@toko_agm_padang</span>
              </a>

              <a 
                href="https://wa.me/6289694127723" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-2.5 text-slate-700 font-semibold hover:text-emerald-600 transition-colors"
              >
                <svg className="w-4 h-4 fill-emerald-500 shrink-0" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                </svg>
                <span>0896-9412-7723</span>
              </a>
            </div>
          </aside>
        </div>
      )}

      {/* ── MAIN CONTENT CANVAS (FULL WIDTH IKEA/APPLE STYLE) ── */}
      <main className="pt-16 min-h-screen flex flex-col transition-all bg-white">
        
        {/* ── SLEEK POS OPERATIONAL HEADER ── */}
        <header className="w-full px-4 md:px-8 py-4 md:py-5 border-b border-slate-200/80 bg-white shadow-xs">
          <div className="max-w-container-max mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
            <div>
              <h1 className="font-extrabold text-xl md:text-2xl text-slate-900 tracking-tight">
                {currentView === 'catalog' && 'Katalog Produk & Persediaan'}
                {currentView === 'stock' && 'Manajemen Kontrol Stok'}
                {currentView === 'dashboard' && 'Analisis Penjualan & Performa'}
                {currentView === 'nota' && 'Kasir & Pembuatan Nota'}
                {currentView === 'custom-requests' && 'Pengajuan Custom Furniture Customer'}
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-3 px-3.5 py-1.5 bg-slate-100/80 border border-slate-200/80 rounded-xl text-xs text-slate-600 font-semibold">
                <span>SKU: <strong className="text-slate-900 font-bold">{products.length}</strong></span>
                <span className="text-slate-300">•</span>
                <span>Tersedia: <strong className="text-emerald-700 font-bold">{products.filter(p => p.stock > 0).length}</strong></span>
              </div>

              {isAdmin && currentView === 'catalog' && (
                <button
                  onClick={openAdd}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-xs active:scale-[0.98] cursor-pointer"
                >
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Tambah Produk</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* ── CATALOG VIEW ── */}
        {currentView === 'catalog' && (
          <section className="px-4 md:px-8 pt-4 md:pt-6 pb-12 max-w-container-max mx-auto w-full flex-grow">
            
            {/* Guest Welcome Banner */}
            {!isAdmin && (
              <div className="mb-6 p-5 sm:p-6 bg-slate-900 text-white rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md">
                <div>
                  <h3 className="font-black text-base sm:text-lg text-white tracking-tight">Katalog Produk AGM 2 Padang</h3>
                  <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">Pilihan Furniture &amp; Elektronik berkualitas. Klik produk untuk detail atau konsultasi pesanan.</p>
                </div>
                <a
                  href="https://wa.me/6289694127723?text=Halo%20Toko%20AGM%202%20Padang,%20saya%20ingin%20bertanya%20mengenai%20katalog%20produk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl transition-all whitespace-nowrap flex items-center justify-center gap-2.5 shadow-md hover:shadow-emerald-900/30 active:scale-95 shrink-0"
                >
                  <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                  </svg>
                  <span>Hubungi CS Toko</span>
                </a>
              </div>
            )}

            {/* Grid Filters Row */}
            <div className="flex flex-col gap-4 mb-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex p-1 bg-slate-200/60 rounded-xl gap-1 w-full sm:w-auto overflow-x-auto hide-scrollbar">
                  <button
                    onClick={() => selectCategoryFilter('all')}
                    className={`flex-1 sm:flex-initial px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${filterCategory === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Semua ({products.length})
                  </button>
                  <button
                    onClick={() => selectCategoryFilter('furniture')}
                    className={`flex-1 sm:flex-initial px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${filterCategory === 'furniture' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Furniture ({products.filter(p => p.category === 'furniture').length})
                  </button>
                  <button
                    onClick={() => selectCategoryFilter('electronics')}
                    className={`flex-1 sm:flex-initial px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${filterCategory === 'electronics' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Elektronik ({products.filter(p => p.category === 'electronics').length})
                  </button>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto text-xs text-slate-500 font-semibold">
                  <span>Menampilkan {filteredProducts.length} dari {products.length} barang</span>
                </div>
              </div>


              {/* Mobile Sub-Category Dropdown */}
              <div className="block md:hidden pt-1">
                <select
                  value={filterSubcategory}
                  onChange={(e) => setFilterSubcategory(e.target.value)}
                  className="w-full bg-slate-100/90 border border-slate-200 text-xs font-bold rounded-xl px-3.5 py-2 text-slate-900 focus:ring-2 focus:ring-slate-900 shadow-xs outline-none cursor-pointer"
                >
                  <option value="all">Semua Subkategori</option>
                  {(filterCategory === 'furniture' ? FURNITURE_SUBCATEGORIES : filterCategory === 'electronics' ? ELECTRONICS_SUBCATEGORIES : Array.from(new Set([...FURNITURE_SUBCATEGORIES, ...ELECTRONICS_SUBCATEGORIES]))).map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>

              {/* Desktop Sub-Category Pill Chips */}
              <div className="hidden md:flex items-center gap-2 overflow-x-auto pb-1 pt-1 hide-scrollbar">
                <button
                  onClick={() => setFilterSubcategory('all')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition-all active:scale-95 ${
                    filterSubcategory === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100/80 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'
                  }`}
                >
                  Semua Subkategori
                </button>
                {(filterCategory === 'furniture' ? FURNITURE_SUBCATEGORIES : filterCategory === 'electronics' ? ELECTRONICS_SUBCATEGORIES : Array.from(new Set([...FURNITURE_SUBCATEGORIES, ...ELECTRONICS_SUBCATEGORIES]))).map(sub => (
                  <button
                    key={sub}
                    onClick={() => setFilterSubcategory(sub)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition-all active:scale-95 ${
                      filterSubcategory === sub
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100/80 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>

            {/* Warning banner if running on cached data due to network error */}
            {fetchError && products.length > 0 && (
              <div className="mb-6 p-3 px-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 0 1 0 12.728m-2.828-9.9a6 6 0 0 1 0 8.485m-2.829-5.657a2 2 0 0 1 0 2.829m-4.243 2.829a9 9 0 0 1 0-12.728m2.828 9.9a6 6 0 0 1 0-8.485m2.829 5.657a2 2 0 0 1 0-2.829" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                  <span>Menampilkan data tersimpan. Gagal menyinkronkan data terbaru dari server database.</span>
                </div>
                <button
                  onClick={() => fetchProducts(3)}
                  disabled={isFetchingData}
                  className="px-3 py-1 bg-amber-600 text-white font-bold rounded text-[11px] hover:bg-amber-700 transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                >
                  <svg className={`w-3.5 h-3.5 ${isFetchingData ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15" />
                  </svg>
                  {isFetchingData ? 'Memproses...' : 'Coba Lagi'}
                </button>
              </div>
            )}

            {/* Bento-Inspired Product Grid / Skeleton Loader / Error view */}
            {isFetchingData && products.length === 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 animate-pulse">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                  <div key={'skeleton-' + i} className="bg-pure-white border border-border-light p-3 flex flex-col gap-3 rounded-lg">
                    <div className="aspect-square bg-surface-container rounded-md w-full" />
                    <div className="h-4 bg-surface-container rounded w-3/4" />
                    <div className="h-3 bg-surface-container rounded w-1/2" />
                    <div className="h-4 bg-surface-container rounded w-2/3 mt-2" />
                  </div>
                ))}
              </div>
            ) : fetchError && products.length === 0 ? (
              <div className="text-center py-12 px-6 bg-red-50/60 border border-red-200 rounded-xl text-secondary max-w-md mx-auto my-8">
                <svg className="w-10 h-10 text-rose-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h4 className="font-bold text-primary text-base mb-1">Gagal Memuat Data Database</h4>
                <p className="text-xs text-secondary mb-5 leading-relaxed">{fetchError}</p>
                <button
                  onClick={() => fetchProducts(3)}
                  className="px-5 py-2.5 bg-primary text-pure-white text-xs font-bold uppercase rounded-lg hover:bg-opacity-90 transition-all inline-flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15" />
                  </svg>
                  Coba Muat Ulang Data
                </button>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-16 text-secondary">
                <svg className="w-10 h-10 text-slate-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <p className="text-sm font-semibold text-slate-600">Tidak ada produk yang cocok dengan kriteria.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-6">
                {filteredProducts.map(p => (
                  <div 
                    key={p.id} 
                    onClick={() => setSelectedProductDetail(p)}
                    className="product-card group relative flex flex-col bg-white rounded-2xl overflow-hidden cursor-pointer hover-lift border border-slate-200/80"
                  >
                    <div className="aspect-[4/3] sm:aspect-square overflow-hidden bg-slate-100 relative rounded-t-2xl border border-slate-200/80">
                      {p.image_url ? (
                        <img 
                          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" 
                          src={getOptimizedImageUrl(p.image_url, 600)} 
                          alt={p.name}
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400">
                          <svg className="w-9 h-9 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-[10px] uppercase font-extrabold tracking-wider mt-1 text-slate-400">Tidak Ada Foto</span>
                        </div>
                      )}
                      {p.arrivalType && (
                        <div className="absolute top-3 left-3 bg-slate-900/90 text-white backdrop-blur-md px-2.5 py-1 rounded-md text-[9px] font-extrabold uppercase tracking-widest border border-slate-700/50 shadow-2xs">
                          {p.arrivalType}
                        </div>
                      )}
                    </div>
                    
                    <div className="p-4 flex flex-col justify-between flex-grow border border-t-0 border-slate-200/80 rounded-b-2xl bg-white shadow-2xs group-hover:border-slate-300 group-hover:shadow-md transition-all duration-300">
                      <div className="space-y-1 min-w-0">
                        {p.subcategory && (
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                            {p.subcategory}
                          </span>
                        )}

                        <h3 className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight leading-snug truncate group-hover:text-slate-600 transition-colors" title={p.name}>
                          {p.name}
                        </h3>

                        <p className="text-xs text-slate-500 line-clamp-1" title={p.description}>
                          {p.description}
                        </p>

                        {/* Render Price for Admin ONLY or Guest Inquiry Button */}
                        {isAdmin ? (
                          <div className="pt-2">
                            <span className="font-black text-base sm:text-lg text-slate-900">
                              Rp {(p.price - p.discount).toLocaleString('id-ID')}
                            </span>
                            {p.discount > 0 && (
                              <span className="text-[11px] text-slate-400 line-through block font-medium">
                                Rp {p.price.toLocaleString('id-ID')}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="pt-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(`https://wa.me/6289694127723?text=${encodeURIComponent(`Halo Toko AGM 2 Padang, saya berminat dan ingin bertanya mengenai produk: ${p.name}`)}`, '_blank');
                              }}
                              className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 shadow-xs active:scale-[0.98]"
                            >
                              <svg className="w-3.5 h-3.5 fill-white shrink-0" viewBox="0 0 24 24">
                                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                              </svg>
                              <span>Tanyakan Harga</span>
                            </button>
                          </div>
                        )}
                      </div>
                      
                      {/* Availability status */}
                      <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-3">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                          <span className={`w-2 h-2 rounded-full ${p.stock > 3 ? 'bg-emerald-500' : p.stock > 0 ? 'bg-amber-500' : 'bg-rose-500'}`}></span>
                          <span>{p.stock > 0 ? `${p.stock} ${p.unit} Tersedia` : 'Habis / Pre-Order'}</span>
                        </div>

                        {isAdmin && (
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                              className="p-1.5 text-slate-400 hover:text-slate-900 transition-colors rounded-lg hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                              title="Edit Produk"
                            >
                              <svg className="w-4 h-4 text-slate-500 hover:text-slate-900 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(p.id); }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors rounded-lg hover:bg-rose-50 flex items-center justify-center cursor-pointer"
                              title="Hapus Produk"
                            >
                              <svg className="w-4 h-4 text-slate-400 hover:text-rose-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18" />
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                <line x1="10" y1="11" x2="10" y2="17" />
                                <line x1="14" y1="11" x2="14" y2="17" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── STOCK CONTROL TABLE VIEW ── */}
        {currentView === 'stock' && isAdmin && (
          <section className="px-margin-mobile lg:px-margin-desktop py-8 max-w-container-max mx-auto w-full flex-grow">
            <div className="flex flex-col sm:flex-row justify-end items-start sm:items-center gap-4 mb-6">
              <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                <div className="relative w-full sm:max-w-xs">
                  <svg className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Cari produk..."
                    className="pl-8 pr-3 py-1.5 bg-slate-100 border border-slate-200 text-xs rounded-xl w-full focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all outline-none"
                    value={stockSearchTerm}
                    onChange={(e) => setStockSearchTerm(e.target.value)}
                  />
                </div>
                <button 
                  onClick={openAdd} 
                  className="bg-slate-900 text-white px-4 py-2 text-xs font-bold rounded-xl w-full sm:w-auto hover:bg-slate-800 transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap shadow-xs active:scale-95"
                >
                  <svg className="w-4 h-4 text-white shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="whitespace-nowrap">Tambah Produk</span>
                </button>
                <button
                  onClick={() => setIsStockLogModalOpen(true)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-bold rounded-xl w-full sm:w-auto transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-slate-200 whitespace-nowrap"
                >
                  <svg className="w-4 h-4 text-slate-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01m-.01 4h.01" />
                  </svg>
                  <span className="whitespace-nowrap">Riwayat Edit Stok</span>
                </button>
                <button
                  onClick={() => setIsDeletedLogModalOpen(true)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-bold rounded-xl w-full sm:w-auto transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-slate-200 whitespace-nowrap"
                >
                  <svg className="w-4 h-4 text-slate-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 3v4a1 1 0 001 1h8a1 1 0 001-1V3" />
                    <rect x="3" y="8" width="18" height="13" rx="2" ry="2" />
                    <line x1="10" y1="12" x2="14" y2="12" />
                  </svg>
                  <span className="whitespace-nowrap">Riwayat Dihapus</span>
                </button>
              </div>
            </div>

            {/* Mobile Responsive View (< md) */}
            <div className="md:hidden space-y-3">
              {filteredProducts.length === 0 ? (
                <div className="text-center py-12 bg-white border border-slate-200 rounded-xl text-slate-500">
                  <svg className="w-10 h-10 text-slate-400 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <p className="text-xs font-semibold">Tidak ada data produk tersimpan.</p>
                </div>
              ) : (
                filteredProducts.map(p => (
                  <div key={'mob-stock-' + p.id} className="p-4 bg-pure-white border border-border-light rounded-lg shadow-xs flex flex-col gap-3">
                    <div className="flex gap-3 items-start">
                      {p.image_url ? (
                        <img src={getOptimizedImageUrl(p.image_url, 150)} className="w-16 h-16 object-cover border border-slate-200 rounded-lg shrink-0" alt={p.name} loading="lazy" decoding="async" />
                      ) : (
                        <div className="w-16 h-16 bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-400 text-[10px] rounded-lg shrink-0 font-bold">NO FOTO</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold text-sm text-slate-900 truncate">{p.name}</div>
                        <div className="text-xs text-slate-500 truncate">{p.description}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold uppercase">{p.category}</span>
                          {p.subcategory && <span className="text-[9px] bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded font-bold uppercase">{p.subcategory}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border-light/60 text-xs">
                      <div>
                        <span className="text-secondary block text-[10px] font-semibold">Harga Net</span>
                        <strong className="text-primary text-sm font-bold">Rp {(p.price - p.discount).toLocaleString('id-ID')}</strong>
                      </div>
                      <div>
                        {getStockLabel(p.stock)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border-light/60 gap-2">
                      <div className="flex items-center border border-border-light rounded-lg overflow-hidden bg-pure-white shadow-xs">
                        <button 
                          onClick={() => adjustStock(p.id, -1)} 
                          className="px-3 py-1.5 bg-surface-container hover:bg-surface-container-high text-primary font-bold text-xs active:scale-95"
                          title="Kurang 1 Unit"
                        >
                          -1
                        </button>
                        <StockControlInput stock={p.stock} onCommit={(newVal) => setDirectStock(p.id, newVal)} />
                        <button 
                          onClick={() => adjustStock(p.id, 1)} 
                          className="px-3 py-1.5 bg-surface-container hover:bg-surface-container-high text-primary font-bold text-xs active:scale-95"
                          title="Tambah 1 Unit"
                        >
                          +1
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button onClick={() => openEdit(p)} className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer" title="Edit Produk">
                          <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button onClick={() => setDeleteConfirmId(p.id)} className="p-2 border border-slate-200 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer" title="Hapus Produk">
                          <svg className="w-4 h-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block bg-pure-white border border-border-light rounded-sm overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-surface-container border-b border-border-light">
                      <th className="p-4 font-label-md text-label-md text-secondary uppercase">Foto SKU</th>
                      <th className="p-4 font-label-md text-label-md text-secondary uppercase">Detail Produk</th>
                      <th className="p-4 font-label-md text-label-md text-secondary uppercase">Harga Dasar</th>
                      <th className="p-4 font-label-md text-label-md text-secondary uppercase">Diskon</th>
                      <th className="p-4 font-label-md text-label-md text-secondary uppercase">Harga Bersih</th>
                      <th className="p-4 font-label-md text-label-md text-secondary uppercase">Stok &amp; Status</th>
                      <th className="p-4 font-label-md text-label-md text-secondary uppercase text-center">Kelola Stok (-1 / Input / +1)</th>
                      <th className="p-4 font-label-md text-label-md text-secondary uppercase text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map(p => (
                      <tr key={p.id} className="border-b border-border-light hover:bg-surface-container-low transition-colors">
                        <td className="p-4">
                          {p.image_url ? (
                            <img src={getOptimizedImageUrl(p.image_url, 150)} className="w-16 h-12 object-cover border border-slate-200 rounded-lg" alt={p.name} loading="lazy" decoding="async" />
                          ) : (
                            <div className="w-16 h-12 bg-surface-container flex items-center justify-center border border-border-light text-secondary text-xs rounded">TIDAK ADA FOTO</div>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-primary">{p.name}</div>
                          <div className="text-xs text-secondary">{p.description}</div>
                          <div className="flex gap-1.5 mt-1">
                            <span className="inline-block text-[10px] bg-surface-container-highest text-secondary px-2 py-0.5 font-bold rounded uppercase">
                              {p.category}
                            </span>
                            {p.subcategory && (
                              <span className="inline-block text-[10px] bg-primary-fixed text-primary px-2 py-0.5 font-bold rounded uppercase">
                                {p.subcategory}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 font-medium">Rp {p.price.toLocaleString('id-ID')}</td>
                        <td className="p-4 text-error font-medium">{p.discount > 0 ? `-Rp ${p.discount.toLocaleString('id-ID')}` : '-'}</td>
                        <td className="p-4 font-bold text-primary">Rp {(p.price - p.discount).toLocaleString('id-ID')}</td>
                        <td className="p-4">
                          <div className="flex flex-col gap-1">
                            <div className="font-bold text-sm text-primary flex items-center gap-1">
                              <span>{p.stock} {p.unit}</span>
                            </div>
                            {getStockLabel(p.stock)}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-center">
                            {/* Direct Edit Input & +-1 */}
                            <div className="flex items-center border border-border-light rounded-lg overflow-hidden bg-pure-white shadow-xs">
                              <button 
                                onClick={() => adjustStock(p.id, -1)} 
                                className="px-3 py-1.5 bg-surface-container hover:bg-surface-container-high text-primary font-bold transition-all active:scale-95 text-xs"
                                title="Kurang 1 Unit"
                              >
                                -1
                              </button>
                              <StockControlInput 
                                stock={p.stock} 
                                onCommit={(newVal) => setDirectStock(p.id, newVal)} 
                              />
                              <button 
                                onClick={() => adjustStock(p.id, 1)} 
                                className="px-3 py-1.5 bg-surface-container hover:bg-surface-container-high text-primary font-bold transition-all active:scale-95 text-xs"
                                title="Tambah 1 Unit"
                              >
                                +1
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button 
                              onClick={() => openEdit(p)} 
                              className="p-1.5 border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors rounded-lg flex items-center justify-center cursor-pointer"
                              title="Edit Produk"
                            >
                              <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button 
                              onClick={() => setDeleteConfirmId(p.id)} 
                              className="p-1.5 border border-slate-200 text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors rounded-lg flex items-center justify-center cursor-pointer"
                              title="Hapus Produk"
                            >
                              <svg className="w-4 h-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <line x1="10" y1="11" x2="10" y2="17" />
                                <line x1="14" y1="11" x2="14" y2="17" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ── ANALYTICS / DASHBOARD VIEW (SUPABASE LIVE SYNC) ── */}
        {currentView === 'dashboard' && isAdmin && (() => {
          const totalInventoryValue = products.reduce((acc, p) => acc + (((Number(p.price) || 0) - (Number(p.discount) || 0)) * (Number(p.stock) || 0)), 0);
          const totalUnits = products.reduce((acc, p) => acc + (Number(p.stock) || 0), 0);

          const lowStockProducts = products.filter(p => (Number(p.stock) || 0) > 0 && (Number(p.stock) || 0) <= 3);
          const outOfStockProducts = products.filter(p => (Number(p.stock) || 0) === 0);
          const healthyStockCount = products.filter(p => (Number(p.stock) || 0) > 3).length;

          // Filter transactions based on date inputs
          const filteredTransactions = transactions.filter(tx => {
            if (!txStartDate && !txEndDate) return true;
            try {
              const parts = tx.date.split(',')[0].trim().split('/');
              if (parts.length === 3) {
                // dd/mm/yyyy format -> YYYY-MM-DD
                const txDateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                if (txStartDate && txDateStr < txStartDate) return false;
                if (txEndDate && txDateStr > txEndDate) return false;
              }
            } catch (e) {
              return true;
            }
            return true;
          });

          // ── TREN PENJUALAN KEUANGAN (7 HARI TERAKHIR) ──
          const salesByDate: { [date: string]: number } = {};
          const last7Days = Array.from({ length: 7 }).map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
          });

          last7Days.forEach(day => {
            salesByDate[day] = 0;
          });

          transactions.forEach(tx => {
            try {
              const raw = tx.dateRaw || tx.date;
              if (raw) {
                const d = new Date(raw);
                if (!isNaN(d.getTime())) {
                  const label = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                  if (salesByDate[label] !== undefined) {
                    salesByDate[label] += Number(tx.totalPrice || 0);
                  }
                }
              }
            } catch (e) {}
          });

          const chartData = last7Days.map(day => ({
            label: day,
            value: salesByDate[day],
          }));

          const maxSalesValue = Math.max(...chartData.map(d => d.value), 100000);

          return (
            <section className="px-4 md:px-8 py-6 md:py-8 max-w-container-max mx-auto w-full flex-grow">
              
              {/* ── 1. RINGKASAN METRIK UTAMA & NOTIFIKASI STOK ── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
                {/* Nilai Aset Gudang */}
                <div className="p-6 bg-white border border-slate-200/80 rounded-2xl shadow-xs flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">Estimasi Nilai Aset Gudang</span>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 truncate">
                      Rp {totalInventoryValue.toLocaleString('id-ID')}
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 font-medium mt-4 block">{products.length} SKU Produk ({totalUnits} Unit Fisik)</span>
                </div>

                {/* Notifikasi & Status Stok Panel */}
                <div className="lg:col-span-2 p-6 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                      <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                      </svg>
                      Pemberitahuan &amp; Notifikasi Stok
                    </span>
                    <span className="text-[11px] font-extrabold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                      {lowStockProducts.length + outOfStockProducts.length} Perlu Perhatian
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[120px] overflow-y-auto pr-1">
                    {outOfStockProducts.length === 0 && lowStockProducts.length === 0 ? (
                      <div className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl flex items-center gap-2 text-xs text-slate-600 font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                        Semua persediaan stok dalam kondisi sehat ({healthyStockCount} SKU Aman).
                      </div>
                    ) : (
                      <>
                        {outOfStockProducts.map(p => (
                          <div key={'alert-out-' + p.id} className="p-2.5 bg-slate-50 border border-slate-200/70 rounded-xl flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-pulse"></span>
                              <span className="font-bold text-slate-900 text-xs leading-snug line-clamp-2">{p.name}</span>
                            </div>
                            <span className="font-black text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 text-[11px] shrink-0 whitespace-nowrap self-center">
                              Stok Habis (0 Unit)
                            </span>
                          </div>
                        ))}

                        {lowStockProducts.map(p => (
                          <div key={'alert-low-' + p.id} className="p-2.5 bg-slate-50 border border-slate-200/70 rounded-xl flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                              <span className="font-bold text-slate-900 text-xs leading-snug line-clamp-2">{p.name}</span>
                            </div>
                            <span className="font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 text-[11px] shrink-0 whitespace-nowrap self-center">
                              Sisa {p.stock} {p.unit}
                            </span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* ── 2. DIAGRAM CHART TREN PENJUALAN 7 HARI TERAKHIR ── */}
              <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs mb-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                      <svg className="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="20" x2="18" y2="10" />
                        <line x1="12" y1="20" x2="12" y2="4" />
                        <line x1="6" y1="20" x2="6" y2="14" />
                      </svg>
                      <span>Diagram Penjualan 7 Hari Terakhir</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Grafik grafik omzet penjualan harian toko secara real-time</p>
                  </div>
                  <span className="text-xs font-extrabold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                    7-Day Sales Trend
                  </span>
                </div>

                <div className="w-full overflow-x-auto pt-2 scrollbar-none">
                  <div className="min-w-[580px] h-60 w-full flex items-center justify-center">
                    <svg viewBox="0 0 700 220" className="w-full h-full">
                      {/* Grid Lines */}
                      <line x1="60" y1="20" x2="680" y2="20" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4" />
                      <line x1="60" y1="70" x2="680" y2="70" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4" />
                      <line x1="60" y1="120" x2="680" y2="120" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4" />
                      <line x1="60" y1="170" x2="680" y2="170" stroke="#cbd5e1" strokeWidth="1.5" />

                      {/* Y-Axis Labels */}
                      <text x="50" y="24" textAnchor="end" fontSize="10" fill="#64748b" fontWeight="600">Rp {(maxSalesValue / 1000).toLocaleString('id-ID')}k</text>
                      <text x="50" y="74" textAnchor="end" fontSize="10" fill="#64748b" fontWeight="600">Rp {(maxSalesValue / 2000).toLocaleString('id-ID')}k</text>
                      <text x="50" y="124" textAnchor="end" fontSize="10" fill="#64748b" fontWeight="600">Rp {(maxSalesValue / 4000).toLocaleString('id-ID')}k</text>
                      <text x="50" y="174" textAnchor="end" fontSize="10" fill="#64748b" fontWeight="600">Rp 0</text>

                      {/* Columns */}
                      {chartData.map((d, index) => {
                        const colWidth = 48;
                        const totalWidth = 620;
                        const colGap = (totalWidth - (7 * colWidth)) / 6;
                        const xOffset = 70 + index * (colWidth + colGap);
                        const colHeight = (d.value / maxSalesValue) * 140;
                        const yOffset = 170 - colHeight;

                        return (
                          <g key={'sales-bar-v2-' + index} className="group cursor-pointer">
                            {/* Visual Column Bar */}
                            <rect 
                              x={xOffset} 
                              y={yOffset} 
                              width={colWidth} 
                              height={colHeight} 
                              fill="#0f172a" 
                              rx="6"
                              className="fill-slate-900 hover:fill-slate-800 transition-colors"
                            />
                            
                            {/* Top Value Label */}
                            <text 
                              x={xOffset + colWidth / 2} 
                              y={yOffset - 8} 
                              textAnchor="middle" 
                              fontSize="10" 
                              fontWeight="bold" 
                              fill="#0f172a"
                            >
                              Rp {(d.value / 1000).toLocaleString('id-ID')}k
                            </text>

                            {/* X-Axis Date Label */}
                            <text x={xOffset + colWidth / 2} y="194" textAnchor="middle" fontSize="11" fill="#475569" fontWeight="bold">
                              {d.label}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </div>
              </div>

              {/* ── 2. RIWAYAT TRANSAKSI PENJUALAN ── */}
              <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900">Riwayat Transaksi Penjualan</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Klik baris untuk melihat rincian nota &amp; data pelanggan</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <div className="flex items-center gap-1.5 bg-slate-100/80 px-3 py-1.5 rounded-xl border border-slate-200/60">
                      <span className="text-slate-500 text-xs font-semibold">Mulai:</span>
                      <input 
                        type="date" 
                        value={txStartDate}
                        onChange={(e) => setTxStartDate(e.target.value)}
                        className="bg-transparent border-none p-0 text-xs text-slate-900 font-semibold focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-100/80 px-3 py-1.5 rounded-xl border border-slate-200/60">
                      <span className="text-slate-500 text-xs font-semibold">Selesai:</span>
                      <input 
                        type="date" 
                        value={txEndDate}
                        onChange={(e) => setTxEndDate(e.target.value)}
                        className="bg-transparent border-none p-0 text-xs text-slate-900 font-semibold focus:outline-none"
                      />
                    </div>
                    {(txStartDate || txEndDate) && (
                      <button 
                        onClick={() => { setTxStartDate(''); setTxEndDate(''); }}
                        className="text-rose-600 hover:text-rose-700 font-bold text-xs border border-rose-200 bg-rose-50 px-3 py-1.5 rounded-xl transition-all"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[500px] text-xs">
                    <thead>
                      <tr className="bg-slate-100/70 border-b border-slate-200/80 text-xs uppercase text-slate-500 font-extrabold tracking-wider">
                        <th className="p-3.5 rounded-l-xl">No. Nota &amp; Tanggal</th>
                        <th className="p-3.5">Nama Pelanggan</th>
                        <th className="p-3.5 text-center">Status</th>
                        <th className="p-3.5 text-right">Total Transaksi</th>
                        <th className="p-3.5 text-center rounded-r-xl">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-500 font-medium">Belum ada transaksi terekam / tidak cocok dengan filter tanggal.</td>
                        </tr>
                      ) : (
                        filteredTransactions.map(tx => {
                          const isPending = tx.remainingAmount !== undefined && tx.remainingAmount > 0;
                          return (
                            <tr 
                              key={tx.id} 
                              onClick={() => setSelectedTxDetail(tx)}
                              className="hover:bg-slate-50/80 cursor-pointer transition-colors active:scale-[0.99] origin-left animate-fade-in"
                            >
                              <td className="p-3.5">
                                <div className="font-extrabold text-slate-900">{tx.id}</div>
                                <div className="text-[11px] text-slate-500 font-medium mt-0.5">{tx.date}</div>
                              </td>
                              <td className="p-3.5">
                                <div className="font-bold text-slate-900">{tx.customerName}</div>
                                {tx.customerPhone && <div className="text-[11px] text-slate-500 font-medium">HP: {tx.customerPhone}</div>}
                              </td>
                              <td className="p-3.5 text-center">
                                {isPending ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                                    Belum Lunas
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                    Lunas
                                  </span>
                                )}
                              </td>
                              <td className="p-3.5 text-right font-black text-slate-900 text-sm">
                                Rp {tx.totalPrice.toLocaleString('id-ID')}
                              </td>
                              <td className="p-3.5 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); setSelectedTxDetail(tx); }}
                                    className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg text-[11px] font-extrabold hover:bg-slate-200 transition-all"
                                  >
                                    Detail
                                  </button>
                                  {isAdmin && (
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); setTransactionToDelete(tx.id); setIsDeleteTransactionModalOpen(true); }}
                                      className="p-1 text-slate-400 hover:text-rose-600 active:scale-95 transition-all rounded-lg hover:bg-rose-50"
                                      title="Hapus Transaksi"
                                    >
                                      <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="3 6 5 6 21 6" />
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          );
        })()}

        {/* ── NOTA PRINTING VIEW ── */}
        {currentView === 'nota' && isAdmin && (
          <NotaView products={products} triggerToast={triggerToast} isAdmin={isAdmin} adjustStock={adjustStock} deductBulkStock={deductBulkStock} addTransaction={addTransaction} />
        )}

        {/* ── CUSTOM DESIGN REQUESTS VIEW (EDITORIAL TABLE) ── */}
        {currentView === 'custom-requests' && isAdmin && (
          <section className="px-4 md:px-8 py-6 md:py-8 max-w-container-max mx-auto w-full flex-grow">
            <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 tracking-tight">Daftar Pengajuan Custom Furniture</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Permintaan spesifikasi furniture kustom dari customer melalui AGM Assistant</p>
                </div>
                <button
                  onClick={fetchCustomRequests}
                  disabled={isCustomRequestsLoading}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold rounded-xl transition-all flex items-center gap-2 border border-slate-200 cursor-pointer disabled:opacity-50"
                >
                  <svg className={`w-3.5 h-3.5 text-slate-600 ${isCustomRequestsLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>{isCustomRequestsLoading ? 'Memuat...' : 'Muat Ulang'}</span>
                </button>
              </div>

              {/* Error State */}
              {customRequestsError ? (
                <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-center">
                  <p className="text-xs font-bold text-rose-700 mb-3">Tidak dapat memuat pengajuan custom: {customRequestsError}</p>
                  <button
                    onClick={fetchCustomRequests}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold rounded-xl transition-all shadow-xs"
                  >
                    Coba Lagi
                  </button>
                </div>
              ) : isCustomRequestsLoading && customRequests.length === 0 ? (
                /* Loading State */
                <div className="py-16 text-center text-slate-500">
                  <div className="w-8 h-8 border-3 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-xs font-bold text-slate-600">Memuat data pengajuan custom...</p>
                </div>
              ) : customRequests.length === 0 ? (
                /* Empty State */
                <div className="py-16 text-center text-slate-500 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-sm font-extrabold text-slate-700 mb-1">Custom Requests</p>
                  <p className="text-xs text-slate-500">Belum ada pengajuan desain custom dari customer.</p>
                </div>
              ) : (
                /* Editorial Table */
                <div className="overflow-x-auto hide-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 uppercase font-extrabold tracking-wider text-[10px]">
                        <th className="py-3 px-3">No. Referensi</th>
                        <th className="py-3 px-3">Customer</th>
                        <th className="py-3 px-3">Kategori</th>
                        <th className="py-3 px-3 text-center">Versi</th>
                        <th className="py-3 px-3">Visualisasi</th>
                        <th className="py-3 px-3 text-center">Status</th>
                        <th className="py-3 px-3 text-right">Tanggal Pengajuan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                      {customRequests.map((req) => {
                        const snapshot = req.design_snapshot || {};
                        const categoryName = snapshot.subcategory || snapshot.category || 'Custom Furniture';
                        const versionNum = snapshot.version ? `V${snapshot.version}` : 'V1';
                        const hasVis = Boolean(req.visualization_url);
                        const customerDisplay = req.customer_name || (req.user_id ? `Customer ID: ${String(req.user_id).substring(0, 8)}` : 'Customer AGM');
                        const statusUpper = (req.status || 'SUBMITTED').toUpperCase();

                        let statusBadgeClass = 'bg-slate-100 text-slate-800 border-slate-200';
                        if (statusUpper === 'SUBMITTED') statusBadgeClass = 'bg-sky-50 text-sky-800 border-sky-200';
                        else if (statusUpper === 'REVIEWING') statusBadgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
                        else if (statusUpper === 'QUOTED') statusBadgeClass = 'bg-purple-50 text-purple-800 border-purple-200';
                        else if (statusUpper === 'APPROVED') statusBadgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                        else if (statusUpper === 'REJECTED') statusBadgeClass = 'bg-rose-50 text-rose-800 border-rose-200';
                        else if (statusUpper === 'COMPLETED') statusBadgeClass = 'bg-slate-900 text-white border-slate-900';

                        const formattedCreated = req.created_at ? new Date(req.created_at).toLocaleString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : '—';

                        return (
                          <tr 
                            key={req.id} 
                            onClick={() => setSelectedCustomRequestDetail(req)}
                            className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                          >
                            <td className="py-3.5 px-3 font-mono font-bold text-slate-900 text-xs">
                              {req.reference_number || `AGM-CUSTOM-${req.id.substring(0, 6).toUpperCase()}`}
                            </td>
                            <td className="py-3.5 px-3">
                              <span className="font-bold text-slate-900 block">{customerDisplay}</span>
                              {req.customer_phone && <span className="text-[11px] text-slate-500 font-mono">{req.customer_phone}</span>}
                            </td>
                            <td className="py-3.5 px-3 capitalize font-semibold text-slate-800">
                              {categoryName}
                            </td>
                            <td className="py-3.5 px-3 text-center">
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-bold text-[10px]">
                                {versionNum}
                              </span>
                            </td>
                            <td className="py-3.5 px-3">
                              {hasVis ? (
                                <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold text-[11px]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  AVAILABLE
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-slate-400 font-semibold text-[11px]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                  NOT AVAILABLE
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-3 text-center">
                              <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${statusBadgeClass}`}>
                                {statusUpper}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-right text-slate-500 text-[11px] font-mono whitespace-nowrap">
                              {formattedCreated}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── CUSTOM FURNITURE REQUEST DETAIL MODAL (READ-ONLY OPERATIONS VIEW) ── */}
        {selectedCustomRequestDetail && (() => {
          const req = selectedCustomRequestDetail;
          const snapshot = req.design_snapshot || {};
          const refNum = req.reference_number || `AGM-CUSTOM-${req.id.substring(0, 6).toUpperCase()}`;
          const statusUpper = (req.status || 'SUBMITTED').toUpperCase();
          const versionNum = snapshot.version ? `V${snapshot.version}` : 'V1';
          const hasVis = Boolean(req.visualization_url);
          const customerDisplay = req.customer_name || (req.user_id ? `Customer ID: ${String(req.user_id).substring(0, 8)}` : 'Customer AGM');

          // Dimension Semantics
          const len = snapshot.dimensions?.length ?? snapshot.length ?? null;
          const wid = snapshot.dimensions?.width ?? snapshot.width ?? null;
          const dep = snapshot.dimensions?.depth ?? snapshot.depth ?? null;
          const hei = snapshot.dimensions?.height ?? snapshot.height ?? null;
          const unit = snapshot.dimensions?.unit || 'cm';

          let dimStr = 'Belum ditentukan';
          if (len !== null || wid !== null || hei !== null || dep !== null) {
            const parts = [];
            parts.push(len !== null ? `${len}` : '—');
            parts.push(wid !== null ? `${wid}` : '—');
            if (dep !== null) parts.push(`${dep}`);
            parts.push(hei !== null ? `${hei}` : '—');
            dimStr = `${parts.join(' × ')} ${unit}`;
          }

          let statusBadgeClass = 'bg-slate-100 text-slate-800 border-slate-200';
          if (statusUpper === 'SUBMITTED') statusBadgeClass = 'bg-sky-50 text-sky-800 border-sky-200';
          else if (statusUpper === 'REVIEWING') statusBadgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
          else if (statusUpper === 'QUOTED') statusBadgeClass = 'bg-purple-50 text-purple-800 border-purple-200';
          else if (statusUpper === 'APPROVED') statusBadgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
          else if (statusUpper === 'REJECTED') statusBadgeClass = 'bg-rose-50 text-rose-800 border-rose-200';
          else if (statusUpper === 'COMPLETED') statusBadgeClass = 'bg-slate-900 text-white border-slate-900';

          const formattedCreated = req.created_at ? new Date(req.created_at).toLocaleString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }) : '—';

          const attachments = Array.isArray(req.reference_attachments) ? req.reference_attachments : [];

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in" onClick={() => setSelectedCustomRequestDetail(null)}>
              <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-pop-in hide-scrollbar" onClick={(e) => e.stopPropagation()}>
                {/* Close button */}
                <button 
                  onClick={() => setSelectedCustomRequestDetail(null)}
                  className="absolute top-5 right-5 text-slate-400 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 w-8 h-8 rounded-full flex items-center justify-center transition-colors z-10 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                {/* ── HEADER ── */}
                <div className="border-b border-slate-100 pb-5 mb-6 pr-8">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Custom Furniture Operations View</span>
                    <span className="text-slate-300">•</span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-bold text-[10px]">{versionNum}</span>
                  </div>
                  <h2 className="font-mono font-black text-xl sm:text-2xl text-slate-900 tracking-tight">{refNum}</h2>
                  
                  <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">Pemohon / Customer</span>
                      <strong className="text-slate-900 font-bold block">{customerDisplay}</strong>
                      {req.customer_phone && <span className="text-slate-500 font-mono text-[11px] block">{req.customer_phone}</span>}
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">Status Pengajuan</span>
                      <span className={`inline-block px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border mt-0.5 ${statusBadgeClass}`}>
                        {statusUpper}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">Tanggal Dibuat</span>
                      <span className="text-slate-700 font-mono text-[11px] block">{formattedCreated}</span>
                    </div>
                  </div>
                </div>

                {/* ── DESIGN SPECIFICATION ── */}
                <div className="space-y-6">
                  <div>
                    <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 mb-3 border-b border-slate-100 pb-1">Spesifikasi Desain Custom ({versionNum})</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50/80 p-4 rounded-xl border border-slate-200/70 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Kategori</span>
                        <strong className="text-slate-900 capitalize font-bold">{snapshot.category || '—'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Subkategori</span>
                        <strong className="text-slate-900 capitalize font-bold">{snapshot.subcategory || '—'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Dimensi (P × L × T)</span>
                        <strong className="text-slate-900 font-bold">{dimStr}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Kapasitas</span>
                        <strong className="text-slate-900 font-bold">{snapshot.capacity ? `${snapshot.capacity} orang` : '—'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Material Utama</span>
                        <strong className="text-slate-900 capitalize font-bold">{snapshot.material || '—'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Warna</span>
                        <strong className="text-slate-900 capitalize font-bold">{snapshot.color || '—'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Finishing</span>
                        <strong className="text-slate-900 capitalize font-bold">{snapshot.finish || '—'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Gaya (Style)</span>
                        <strong className="text-slate-900 capitalize font-bold">{snapshot.style || '—'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Spesifikasi Kaki</span>
                        <strong className="text-slate-900 capitalize font-bold">
                          {snapshot.leg ? `${snapshot.leg.material || ''} ${snapshot.leg.color || ''} ${snapshot.leg.style || ''}`.trim() || '—' : '—'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* ── VISUALIZATION SNAPSHOT ── */}
                  <div>
                    <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 mb-3 border-b border-slate-100 pb-1">Design Visualization ({versionNum})</h4>
                    {hasVis ? (
                      <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-900 relative group">
                        <img 
                          src={req.visualization_url} 
                          alt={`Visualisasi ${refNum}`}
                          className="w-full h-64 sm:h-80 object-cover"
                        />
                        <div className="absolute bottom-3 left-3 bg-slate-900/90 text-white backdrop-blur-md px-3 py-1 rounded-md text-[10px] font-mono font-bold border border-slate-700/50">
                          VISUALIZATION SNAPSHOT LOCKED
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-500 text-xs">
                        <p className="font-bold text-slate-600">Visualisasi belum tersedia</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Pengajuan ini dibuat tanpa menyertakan render gambar AI FLUX.</p>
                      </div>
                    )}
                  </div>

                  {/* ── REFERENCE ATTACHMENTS ── */}
                  <div>
                    <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 mb-3 border-b border-slate-100 pb-1">Reference Material &amp; Attachments</h4>
                    {attachments.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Tidak ada dokumen atau foto lampiran referensi.</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {attachments.map((att: any, idx: number) => {
                          const isImg = att.mimeType?.startsWith('image/') || att.url?.match(/\.(jpg|jpeg|png|webp)/i);
                          return (
                            <a
                              key={idx}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all block group"
                            >
                              {isImg ? (
                                <img src={att.url} alt={att.fileName || 'Attachment'} className="w-full h-24 object-cover rounded-lg mb-2 border border-slate-200" />
                              ) : (
                                <div className="w-full h-24 bg-slate-200/80 rounded-lg mb-2 flex flex-col items-center justify-center text-slate-600">
                                  <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              )}
                              <span className="text-[10px] font-bold uppercase text-slate-500 block truncate">{att.category || 'Reference'}</span>
                              <span className="text-xs font-bold text-slate-900 block truncate group-hover:text-amber-600 transition-colors">{att.fileName || 'Attachment File'}</span>
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* ── QUOTATION & ADMIN RESPONSE DISPLAY (IF AVAILABLE) ── */}
                  {(req.quoted_price !== null && req.quoted_price !== undefined || req.admin_response) && (
                    <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-2 text-xs">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-800">Penawaran &amp; Catatan Admin AGM</h4>
                      {req.quoted_price !== null && req.quoted_price !== undefined && (
                        <div>
                          <span className="text-amber-700/80 text-[10px] uppercase font-bold block">Harga Penawaran Resmi</span>
                          <strong className="text-amber-950 font-mono text-base font-black">
                            Rp {Number(req.quoted_price).toLocaleString('id-ID')}
                          </strong>
                        </div>
                      )}
                      {req.admin_response && (
                        <div>
                          <span className="text-amber-700/80 text-[10px] uppercase font-bold block">Catatan Admin</span>
                          <p className="text-amber-900 font-mono text-xs whitespace-pre-wrap">{req.admin_response}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── CUSTOMER DECISION READ-ONLY DISPLAY ── */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Keputusan Customer (Read-Only)</h4>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                        req.customer_response === 'accepted' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                        req.customer_response === 'rejected' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                        'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {req.customer_response ? req.customer_response.toUpperCase() : 'PENDING'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Responded At</span>
                        <span className="text-slate-900 font-mono text-xs font-semibold">
                          {req.responded_at ? new Date(req.responded_at).toLocaleString('id-ID', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Catatan Customer</span>
                        <p className="text-slate-800 font-mono text-xs whitespace-pre-wrap">
                          {req.customer_response_note || 'Tidak ada catatan.'}
                        </p>
                      </div>
                    </div>
                  </div>


                  {/* ── WORKFLOW ACTION PANEL ── */}
                  <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-lg space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Workflow Operasional</span>
                        <h4 className="font-bold text-sm text-white">Status: {statusUpper}</h4>
                      </div>
                      <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider ${statusBadgeClass}`}>
                        {statusUpper}
                      </span>
                    </div>

                    {/* Mutation Error Alert */}
                    {customRequestMutationError && (
                      <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-200 text-xs rounded-xl flex items-start justify-between gap-2 animate-shake">
                        <div>
                          <strong className="font-bold block text-rose-300">Gagal Memperbarui Status</strong>
                          <span>{customRequestMutationError}</span>
                        </div>
                        <button 
                          onClick={() => setCustomRequestMutationError(null)}
                          className="text-rose-400 hover:text-white text-xs font-bold px-1"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    {/* Action Controls per Status */}
                    {statusUpper === 'SUBMITTED' && (
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
                        <p className="text-xs text-slate-400">
                          Pengajuan baru diterima. Klik di bawah untuk mulai proses peninjauan operasional.
                        </p>
                        <button
                          disabled={isUpdatingCustomRequest}
                          onClick={() => {
                            if (window.confirm(`Mulai peninjauan untuk pengajuan ${refNum}?`)) {
                              handleAdminMutationCustomRequest(req.id, 'reviewing');
                            }
                          }}
                          className="w-full sm:w-auto px-5 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold text-xs rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md cursor-pointer whitespace-nowrap"
                        >
                          {isUpdatingCustomRequest ? 'Memproses...' : 'Mulai Review'}
                        </button>
                      </div>
                    )}

                    {statusUpper === 'REVIEWING' && (
                      <div className="space-y-3 pt-1">
                        <p className="text-xs text-slate-300">
                          Buat penawaran harga resmi (Quotation) untuk customer ini:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                              Harga Penawaran (Rp) <span className="text-rose-400">*</span>
                            </label>
                            <input 
                              type="number"
                              min="0"
                              placeholder="Contoh: 15000000"
                              value={customRequestQuotedPriceInput}
                              onChange={(e) => setCustomRequestQuotedPriceInput(e.target.value)}
                              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                              Catatan / Spesifikasi Tambahan
                            </label>
                            <input 
                              type="text"
                              placeholder="Estimasi pengerjaan, garansi, dll."
                              value={customRequestAdminNoteInput}
                              onChange={(e) => setCustomRequestAdminNoteInput(e.target.value)}
                              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end pt-2">
                          <button
                            disabled={isUpdatingCustomRequest || !customRequestQuotedPriceInput || Number(customRequestQuotedPriceInput) <= 0}
                            onClick={() => {
                              const price = Number(customRequestQuotedPriceInput);
                              if (isNaN(price) || price <= 0) return;
                              if (window.confirm(`Kirim penawaran Rp ${price.toLocaleString('id-ID')} untuk ${refNum}?`)) {
                                handleAdminMutationCustomRequest(req.id, 'quoted', price, customRequestAdminNoteInput || undefined);
                              }
                            }}
                            className="w-full sm:w-auto px-6 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold text-xs rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md cursor-pointer"
                          >
                            {isUpdatingCustomRequest ? 'Mengirim Penawaran...' : 'Kirim Penawaran Resmi'}
                          </button>
                        </div>
                      </div>
                    )}

                    {statusUpper === 'QUOTED' && (
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <p className="text-xs text-amber-300 font-medium">
                          Penawaran telah dikirim ke Customer ({refNum}). Menunggu keputusan resmi Customer dari antarmuka obrolan.
                        </p>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <button
                            disabled={isUpdatingCustomRequest}
                            onClick={() => {
                              const reason = window.prompt('Alasan penolakan operasional/pembatalan admin (opsional):');
                              if (reason !== null) {
                                handleAdminMutationCustomRequest(req.id, 'rejected', req.quoted_price || undefined, reason || req.admin_response || undefined);
                              }
                            }}
                            className="flex-1 sm:flex-none px-4 py-2.5 border border-rose-500/50 hover:bg-rose-950 text-rose-300 font-bold text-xs rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                          >
                            {isUpdatingCustomRequest ? 'Memproses...' : 'Batalkan Pengajuan'}
                          </button>
                        </div>
                      </div>
                    )}


                    {statusUpper === 'APPROVED' && (
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
                        <p className="text-xs text-slate-400">
                          Pengajuan telah disetujui. Setelah pengerjaan produksi selesai, tandai pengajuan sebagai selesai.
                        </p>
                        <button
                          disabled={isUpdatingCustomRequest}
                          onClick={() => {
                            if (window.confirm(`Tandai pengajuan ${refNum} sebagai SELESAI?`)) {
                              handleAdminMutationCustomRequest(req.id, 'completed', req.quoted_price || undefined, req.admin_response || undefined);
                            }
                          }}
                          className="w-full sm:w-auto px-6 py-2.5 bg-sky-500 hover:bg-sky-600 active:scale-95 text-slate-950 font-bold text-xs rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-md"
                        >
                          {isUpdatingCustomRequest ? 'Memproses...' : 'Tandai Selesai'}
                        </button>
                      </div>
                    )}

                    {(statusUpper === 'REJECTED' || statusUpper === 'COMPLETED') && (
                      <div className="text-center py-2 text-xs text-slate-400">
                        <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500 block">
                          Status Terminal Locked • {statusUpper}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── FOOTER READ-ONLY NOTICE ── */}
                <div className="mt-8 pt-4 border-t border-slate-100 text-center">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                    AGM Assistant Operations View
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── TRANSACTION DETAIL MODAL ── */}
        {selectedTxDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in" onClick={() => setSelectedTxDetail(null)}>
            <div className="w-full max-w-[460px] bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-xl relative animate-pop-in" onClick={(e) => e.stopPropagation()}>
              <button 
                onClick={() => setSelectedTxDetail(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 w-8 h-8 rounded-full flex items-center justify-center transition-colors z-10 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="flex items-start justify-between gap-3 mb-4 pr-6">
                <div>
                  <h3 className="font-bold text-base text-slate-900">Detail Transaksi Penjualan</h3>
                  <p className="text-xs text-slate-500 mt-0.5">No Struk: <strong className="text-slate-800">{selectedTxDetail.id}</strong> • {selectedTxDetail.date}</p>
                </div>
              </div>

              {/* Status Badge Indicator */}
              <div className="mb-4">
                {selectedTxDetail.remainingAmount !== undefined && selectedTxDetail.remainingAmount > 0 ? (
                  <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-800 text-xs font-semibold">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                      Status: <strong className="text-slate-900">Belum Lunas (Sisa: Rp {selectedTxDetail.remainingAmount.toLocaleString('id-ID')})</strong>
                    </span>
                    {isAdmin && (
                      <button
                        onClick={() => handleMarkAsPaid(selectedTxDetail.id)}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-[11px] transition-all cursor-pointer shadow-xs"
                      >
                        ✓ Tandai Lunas
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-slate-800 text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Status Transaksi: <strong className="text-slate-900 font-bold">Lunas</strong></span>
                  </div>
                )}
              </div>
              
              <div className="space-y-4 text-xs mb-6 text-left border-y border-slate-200 py-4">
                {/* Buyer info */}
                <div>
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px] block mb-1.5">Data Pelanggan</span>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                    <div><span className="text-slate-500 font-semibold">Nama:</span> <strong className="text-slate-900">{selectedTxDetail.customerName}</strong></div>
                    {selectedTxDetail.customerPhone && (
                      <div><span className="text-slate-500 font-semibold">No. HP:</span> <strong className="text-slate-900">{selectedTxDetail.customerPhone}</strong></div>
                    )}
                    {selectedTxDetail.customerAddress && (
                      <div><span className="text-slate-500 font-semibold">Alamat:</span> <span className="text-slate-900">{selectedTxDetail.customerAddress}</span></div>
                    )}
                    {selectedTxDetail.notes && (
                      <div><span className="text-slate-500 font-semibold">Keterangan:</span> <span className="text-slate-900 italic font-medium">{selectedTxDetail.notes}</span></div>
                    )}
                  </div>
                </div>

                {/* Items */}
                <div>
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px] block mb-1.5">Item yang Dibeli</span>
                  <div className="overflow-x-auto max-h-40 overflow-y-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 border-b border-slate-200 uppercase">
                          <th className="p-2.5">Item</th>
                          <th className="p-2.5 text-center">Qty</th>
                          <th className="p-2.5 text-right">Harga</th>
                          <th className="p-2.5 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedTxDetail.items.map((item, idx) => (
                          <tr key={'modal-tx-item-' + idx} className="hover:bg-slate-50">
                            <td className="p-2.5 font-semibold text-slate-900">{item.productName}</td>
                            <td className="p-2.5 text-center font-bold text-slate-900">{item.quantity}</td>
                            <td className="p-2.5 text-right font-medium">Rp {item.price.toLocaleString('id-ID')}</td>
                            <td className="p-2.5 text-right font-bold text-slate-900">Rp {(item.price * item.quantity).toLocaleString('id-ID')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Payment Breakdown Summary */}
                <div className="pt-3 border-t border-slate-200 space-y-1.5 text-xs">
                  <div className="flex justify-between font-semibold text-slate-700">
                    <span>Subtotal:</span>
                    <span className="font-bold text-slate-900">Rp {selectedTxDetail.totalPrice.toLocaleString('id-ID')}</span>
                  </div>
                  {selectedTxDetail.payAmount !== undefined && (
                    <div className="flex justify-between font-semibold text-slate-700">
                      <span>Bayar:</span>
                      <span className="font-bold text-slate-900">Rp {selectedTxDetail.payAmount.toLocaleString('id-ID')}</span>
                    </div>
                  )}
                  {selectedTxDetail.remainingAmount !== undefined && selectedTxDetail.remainingAmount > 0 && (
                    <div className="flex justify-between font-semibold text-slate-700 pt-0.5">
                      <span>Kurang (Sisa):</span>
                      <span className="font-bold text-slate-900">Rp {selectedTxDetail.remainingAmount.toLocaleString('id-ID')}</span>
                    </div>
                  )}
                  {selectedTxDetail.changeAmount !== undefined && selectedTxDetail.changeAmount > 0 && (
                    <div className="flex justify-between font-semibold text-slate-700 pt-0.5">
                      <span>Kembalian:</span>
                      <span className="font-bold text-slate-900">Rp {selectedTxDetail.changeAmount.toLocaleString('id-ID')}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => setSelectedTxDetail(null)}
                  className="w-full py-2.5 bg-slate-900 text-white font-bold text-xs uppercase rounded-xl hover:bg-slate-800 transition-all cursor-pointer shadow-xs"
                >
                  Tutup Detail
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── PROFESSIONAL FOOTER CV ADI GUNA MANDIRI ── */}
        <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 mt-auto pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
          <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-12 lg:py-16">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
              
              {/* Column 1: Company Profile & Description */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="font-black text-xl text-white tracking-tight">
                    CV ADI GUNA MANDIRI
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Pusat penjualan Furniture &amp; Elektronik berkualitas terbaik di Padang. Melayani kebutuhan rumah tangga, kantor, dan instansi dengan harga kompetitif dan layanan prima.
                </p>
                <div className="pt-1 flex items-center gap-2 text-xs text-slate-400 font-semibold">
                  <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>Buka 07.30 - 21.00 WIB (Setiap Hari)</span>
                </div>
              </div>

              {/* Column 2: Interactive Footer FAQ (100% Relevant for Toko AGM 2 Padang Showcase Catalog) */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-widest text-white">Informasi &amp; FAQ</h4>
                <div className="space-y-2 text-xs">
                  {[
                    {
                      q: 'Bagaimana cara kerja web katalog ini?',
                      a: 'Web ini menampilkan stok persediaan barang dan harga secara real-time. Anda dapat melihat foto produk penuh, lalu menghubungi kasir via WhatsApp atau datang langsung ke toko fisik di Padang.'
                    },
                    {
                      q: 'Apakah stok dan harga selalu akurat?',
                      a: 'Ya, data katalog ini terhubung langsung dengan sistem kontrol stok kasir toko kami sehingga ketersediaan produk selalu diperbarui.'
                    },
                    {
                      q: 'Bisakah pesan custom (ukuran & warna)?',
                      a: 'Bisa. Khusus produk lemari alumunium ACP, rak piring kaca, bupet TV, dan kitchen set melayani pembuatan pesanan khusus (Custom Pre-Order).'
                    },
                    {
                      q: 'Apakah toko menyediakan pengantaran ke rumah?',
                      a: 'Ya, toko kami menyediakan kurir dan armada pengangkut untuk mengantar barang langsung ke alamat rumah Anda di wilayah Padang dan sekitarnya.'
                    }
                  ].map((faq, idx) => {
                    const isOpen = activeFooterFaq === idx;
                    return (
                      <div key={'footer-faq-' + idx} className="border-b border-slate-800/80 pb-2">
                        <button
                          type="button"
                          onClick={() => setActiveFooterFaq(isOpen ? null : idx)}
                          className="w-full text-left font-semibold text-slate-300 hover:text-white flex items-center justify-between gap-2 py-1 cursor-pointer transition-colors"
                        >
                          <span className="text-[11px] leading-snug">{faq.q}</span>
                          <svg className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-white' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>
                        {isOpen && (
                          <p className="text-[11px] text-slate-400 leading-relaxed pt-1.5 pb-1 animate-fade-in pl-2 border-l-2 border-slate-700">
                            {faq.a}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Column 3: Kontak & Media Sosial */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-widest text-white">Kontak &amp; Media Sosial</h4>
                <ul className="space-y-2.5 text-xs">
                  <li>
                    <a 
                      href="https://instagram.com/toko_agm_padang" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="inline-flex items-center gap-2.5 text-slate-300 hover:text-pink-400 transition-colors font-semibold"
                    >
                      <svg className="w-4 h-4 fill-pink-400 shrink-0" viewBox="0 0 24 24">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                      <span>Instagram: @toko_agm_padang</span>
                    </a>
                  </li>
                  <li>
                    <a 
                      href="https://wa.me/6289694127723" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="inline-flex items-center gap-2.5 text-slate-300 hover:text-emerald-400 transition-colors font-semibold"
                    >
                      <svg className="w-4 h-4 fill-emerald-400 shrink-0" viewBox="0 0 24 24">
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                      </svg>
                      <span>WhatsApp: 0896-9412-7723</span>
                    </a>
                  </li>
                </ul>
              </div>

              {/* Column 4: Alamat Toko */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-widest text-white">Lokasi Toko</h4>
                <a 
                  href="https://maps.app.goo.gl/hcSenYvttoaBXF519?g_st=it" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-slate-400 hover:text-slate-200 transition-colors leading-relaxed flex items-start gap-2 group cursor-pointer"
                  title="Buka lokasi di Google Maps"
                >
                  <svg className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <div>
                    <span className="block font-medium group-hover:underline decoration-slate-400">Jalan Rahadi Ismail, Desa Padang, Kecamatan Benua Kayong, Kabupaten Ketapang, Kalimantan Barat</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 mt-1.5 hover:text-rose-300">
                      <span>Buka di Google Maps</span>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </span>
                  </div>
                </a>
              </div>

            </div>

            {/* Bottom Copyright Sub-Bar */}
            <div className="pt-8 mt-12 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
              <span>© 2026 CV ADI GUNA MANDIRI. All rights reserved.</span>
              <div className="flex gap-4 text-[11px] text-slate-400 font-semibold">
                <span>Furniture &amp; Elektronik Padang</span>
              </div>
            </div>
          </div>
        </footer>
      </main>

      {/* ── GUEST / ADMIN PRODUCT DETAIL & INQUIRY MODAL ── */}
      {selectedProductDetail && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setSelectedProductDetail(null)}
        >
          <div 
            className="w-full max-w-[500px] bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl overflow-hidden relative max-h-[90vh] overflow-y-auto animate-pop-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button 
              onClick={() => setSelectedProductDetail(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 w-8 h-8 rounded-full flex items-center justify-center transition-colors z-10 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Shopee-style Product Photo Gallery with Fullscreen Preview */}
            <ProductPhotoGallery 
              product={selectedProductDetail} 
              onOpenFullscreen={(urls, idx) => setFullscreenImage({ urls, index: idx })}
            />

            {/* Product Info */}
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-slate-100 text-slate-600 tracking-wider">
                  {selectedProductDetail.category}
                </span>
                {selectedProductDetail.subcategory && (
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-slate-200 text-slate-800 tracking-wider">
                    {selectedProductDetail.subcategory}
                  </span>
                )}
              </div>

              <h2 className="font-extrabold text-xl text-slate-900 tracking-tight leading-snug">
                {selectedProductDetail.name}
              </h2>

              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                {selectedProductDetail.description || 'Tidak ada deskripsi tambahan.'}
              </p>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <span className={`w-2.5 h-2.5 rounded-full ${selectedProductDetail.stock > 3 ? 'bg-emerald-500' : selectedProductDetail.stock > 0 ? 'bg-amber-500' : 'bg-rose-500'}`}></span>
                  <span>{selectedProductDetail.stock > 0 ? `Stok Tersedia (${selectedProductDetail.stock} ${selectedProductDetail.unit})` : 'Habis / Pre-Order'}</span>
                </div>

                {isAdmin && (
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Harga Admin</span>
                    <strong className="text-lg font-black text-slate-900">
                      Rp {(selectedProductDetail.price - selectedProductDetail.discount).toLocaleString('id-ID')}
                    </strong>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex flex-col gap-2">
                <a 
                  href={`https://wa.me/6289694127723?text=${encodeURIComponent(`Halo Toko AGM 2 Padang, saya berminat dan ingin menanyakan harga/detail produk:\n- Nama: ${selectedProductDetail.name}\n- Kategori: ${selectedProductDetail.category} ${selectedProductDetail.subcategory}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 shadow-md active:scale-[0.98]"
                >
                  <svg className="w-4 h-4 fill-white shrink-0" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                  </svg>
                  <span>Tanyakan Detail &amp; Pesan via WhatsApp</span>
                </a>

                {isAdmin && (
                  <button 
                    onClick={() => { const p = selectedProductDetail; setSelectedProductDetail(null); openEdit(p); }}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    <span>Edit Produk (Mode Admin)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── FULLSCREEN IMAGE LIGHTBOX MODAL ── */}
      {fullscreenImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-fade-in"
          onClick={() => setFullscreenImage(null)}
        >
          {/* Close Button */}
          <button 
            type="button"
            onClick={() => setFullscreenImage(null)}
            className="absolute top-5 right-5 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md transition-all z-20 cursor-pointer"
            title="Tutup Foto"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Counter Badge */}
          {fullscreenImage.urls.length > 1 && (
            <div className="absolute top-5 left-5 text-white/90 bg-white/10 px-3.5 py-1 rounded-full text-xs font-extrabold tracking-widest backdrop-blur-md z-20">
              {fullscreenImage.index + 1} / {fullscreenImage.urls.length}
            </div>
          )}

          {/* Prev / Next Navigation Arrows */}
          {fullscreenImage.urls.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFullscreenImage(prev => prev ? {
                    ...prev,
                    index: prev.index === 0 ? prev.urls.length - 1 : prev.index - 1
                  } : null);
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center backdrop-blur-md transition-all active:scale-95 z-20 cursor-pointer"
                title="Foto Sebelumnya"
              >
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFullscreenImage(prev => prev ? {
                    ...prev,
                    index: prev.index === prev.urls.length - 1 ? 0 : prev.index + 1
                  } : null);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center backdrop-blur-md transition-all active:scale-95 z-20 cursor-pointer"
                title="Foto Selanjutnya"
              >
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          {/* Fullsize Image Frame */}
          <div 
            className="max-w-5xl max-h-[90vh] p-2 relative flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={fullscreenImage.urls[fullscreenImage.index]} 
              alt="Foto Penuh Produk" 
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl animate-pop-in"
            />
          </div>
        </div>
      )}

      {/* ── LOGIN MODAL ── */}
      {isLoginOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setIsLoginOpen(false)}>
          <div className="w-full max-w-[400px] bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="AGM 2 Logo" className="h-8 w-auto object-contain" />
                <div>
                  <h1 className="font-extrabold text-lg text-slate-900 leading-tight">Login Admin</h1>
                  <p className="text-xs text-slate-500">Panel Manajemen AGM 2 Padang</p>
                </div>
              </div>
              <button onClick={() => setIsLoginOpen(false)} className="text-slate-400 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {loginError && (
              <div className="mb-4 text-xs text-rose-700 font-bold bg-rose-50 p-3 rounded-xl border border-rose-200">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="relative group">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 ml-1">Email / Username</label>
                <input
                  type="text"
                  required
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-900 transition-all outline-none"
                  placeholder="Masukkan email atau username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pt-5 text-slate-400 pointer-events-none">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
              </div>

              <div className="relative group">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 ml-1">Password</label>
                <input
                  type="password"
                  required
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-900 transition-all outline-none"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pt-5 text-slate-400 pointer-events-none">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
              </div>

              <button
                type="submit"
                disabled={isAuthenticating}
                className="w-full bg-slate-900 text-white font-bold text-xs py-3 rounded-xl transition-all hover:bg-slate-800 mt-4 uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer shadow-md"
              >
                {isAuthenticating ? (
                  <>
                    <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <span>Masuk</span>
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            <button onClick={() => { setIsLoginOpen(false); setLoginError(''); }} className="w-full mt-4 text-[10px] font-bold uppercase tracking-wider text-secondary hover:text-primary transition-colors text-center block">
              Batal
            </button>
          </div>
        </div>
      )}

      {/* ── ADD / EDIT SKU FORM MODAL (EXECUTIVE & CLEAN DESIGN) ── */}
      {isFormOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn" onClick={() => setIsFormOpen(false)}>
          <div className="w-full max-w-xl bg-white border border-slate-200/90 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-pop-in" onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between">
              <h2 className="font-extrabold text-base text-slate-900 tracking-tight">
                {formMode === 'add' ? 'Tambah Produk Baru' : 'Edit Detail Produk'}
              </h2>
              <button 
                type="button"
                onClick={() => setIsFormOpen(false)} 
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                title="Tutup"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 overflow-y-auto flex-grow">
              {/* Nama Produk */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Nama Produk</label>
                <input
                  type="text"
                  required
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all shadow-2xs"
                  placeholder="Contoh: KONTUR LOUNGE"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              {/* Deskripsi / Spesifikasi */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Deskripsi / Spesifikasi</label>
                <input
                  type="text"
                  required
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all shadow-2xs"
                  placeholder="Contoh: Seri 04 / Serat Karbon & Wol"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>

              {/* Kategori & Sub-Kategori */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Kategori</label>
                  <select
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all cursor-pointer shadow-2xs"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                  >
                    <option value="furniture">Furniture</option>
                    <option value="electronics">Elektronik</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Sub-Kategori</label>
                  <select
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all cursor-pointer shadow-2xs"
                    value={formSubcategory}
                    onChange={(e) => setFormSubcategory(e.target.value)}
                  >
                    {formCategory === 'furniture'
                      ? FURNITURE_SUBCATEGORIES.map(sub => <option key={sub} value={sub}>{sub}</option>)
                      : ELECTRONICS_SUBCATEGORIES.map(sub => <option key={sub} value={sub}>{sub}</option>)
                    }
                  </select>
                </div>
              </div>

              {/* Harga Dasar & Diskon */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Harga Dasar (Rp)</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all shadow-2xs"
                    placeholder="Contoh: 5.000.000"
                    value={formPrice}
                    onChange={(e) => setFormPrice(formatRupiahInput(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Diskon (Rp)</label>
                  <input
                    type="text"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all shadow-2xs"
                    placeholder="Contoh: 500.000"
                    value={formDiscount}
                    onChange={(e) => setFormDiscount(formatRupiahInput(e.target.value))}
                  />
                </div>
              </div>

              {/* Jumlah Stok, Satuan & Tag Status */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Jumlah Stok</label>
                  <input
                    type="number"
                    required
                    min="0"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all shadow-2xs"
                    placeholder="Contoh: 10"
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Satuan</label>
                  <select
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all cursor-pointer shadow-2xs"
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                  >
                    <option value="Unit">Unit</option>
                    <option value="Pcs">Pcs</option>
                    <option value="Set">Set</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Tag Status</label>
                  <select
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all cursor-pointer shadow-2xs"
                    value={formArrivalType}
                    onChange={(e) => setFormArrivalType(e.target.value as any)}
                  >
                    <option value="">Tanpa tag</option>
                    <option value="BARANG BARU">Barang Baru</option>
                    <option value="PRODUK UNGGULAN">Produk Unggulan</option>
                    <option value="EKSKLUSIF">Eksklusif</option>
                    <option value="PRE-ORDER">Pre-Order</option>
                    <option value="PROMO">Promo</option>
                  </select>
                </div>
              </div>

              {/* Photo Upload Section */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    Foto Produk (Opsional)
                  </label>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    {formImages.length} foto ditambahkan
                  </span>
                </div>

                {/* Input & Upload Button Row */}
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all shadow-2xs"
                    placeholder="Tempel URL foto atau unggah dari galeri..."
                    value={formImage}
                    onChange={(e) => setFormImage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && formImage.trim()) {
                        e.preventDefault();
                        const val = formImage.trim();
                        if (val && !formImages.includes(val)) {
                          setFormImages(prev => [...prev, val]);
                          setFormImage('');
                          triggerToast('URL foto ditambahkan!');
                        }
                      }
                    }}
                  />

                  <label className="cursor-pointer bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 shadow-2xs active:scale-95">
                    <svg className="w-3.5 h-3.5 shrink-0 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    <span>{formImages.length > 0 ? 'Tambah Foto' : 'Unggah Foto'}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                </div>

                {/* Thumbnails Gallery Preview List */}
                {formImages.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                    {formImages.map((imgUrl, idx) => (
                      <div key={'form-img-' + idx} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-white group">
                        <img src={getOptimizedImageUrl(imgUrl, 200)} className="w-full h-full object-cover" alt="" />
                        
                        {idx === 0 ? (
                          <span className="absolute top-1 left-1 bg-slate-900 text-white text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded shadow-xs">
                            Utama
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setFormImages(prev => [imgUrl, ...prev.filter((_, i) => i !== idx)]);
                            }}
                            className="absolute bottom-1 inset-x-1 bg-slate-900/80 hover:bg-slate-900 text-white text-[8px] font-bold rounded py-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-center"
                          >
                            Set Utama
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            const deletedUrl = imgUrl;
                            setFormImages(prev => prev.filter((_, i) => i !== idx));
                            if (formImage === deletedUrl) {
                              setFormImage('');
                            }
                          }}
                          className="absolute top-1 right-1 bg-rose-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] shadow-xs hover:bg-rose-700 transition-colors cursor-pointer"
                          title="Hapus foto ini"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-center text-xs text-slate-400 font-medium">
                    Belum ada foto ditambahkan (Foto Opsional). Unggah file atau tempel URL foto di atas.
                  </div>
                )}
              </div>

              {/* Modal Actions Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsFormOpen(false)} 
                  className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all active:scale-95 cursor-pointer"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Simpan Produk</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL (Ultra-Clean Minimalist) ── */}
      {deleteConfirmId && (() => {
        const targetProduct = products.find(p => p.id === deleteConfirmId);
        return (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in" 
            onClick={() => setDeleteConfirmId(null)}
          >
            <div 
              className="w-full max-w-[340px] bg-white border border-slate-200 rounded-2xl p-5 shadow-lg relative animate-pop-in space-y-4" 
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <h3 className="font-bold text-sm text-slate-900">Hapus Produk?</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Apakah Anda yakin ingin menghapus <strong className="text-slate-800">{targetProduct?.name || 'produk ini'}</strong>? Data akan dihapus dari katalog.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button 
                  onClick={() => setDeleteConfirmId(null)} 
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button 
                  onClick={() => deleteProduct(deleteConfirmId)} 
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-2xs cursor-pointer"
                >
                  Hapus
                </button>
              </div>
            </div>
          </div>
        );
      })()}


      {/* ── DELETE TRANSACTION CONFIRMATION MODAL (Ultra-Clean Minimalist) ── */}
      {isDeleteTransactionModalOpen && isAdmin && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in" 
          onClick={() => !isAuthenticating && setIsDeleteTransactionModalOpen(false)}
        >
          <div 
            className="w-full max-w-[340px] bg-white border border-slate-200 rounded-2xl p-5 shadow-lg relative animate-pop-in space-y-4" 
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="font-bold text-sm text-slate-900">Hapus Transaksi?</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Apakah Anda yakin ingin menghapus transaksi ini? Tindakan ini akan menghapus transaksi dari riwayat dan database.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button 
                onClick={() => { setIsDeleteTransactionModalOpen(false); setTransactionToDelete(null); }} 
                disabled={isAuthenticating}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                Batal
              </button>
              <button 
                onClick={handleDeleteTransaction} 
                disabled={isAuthenticating}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                {isAuthenticating ? 'Memproses...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── MODAL RIWAYAT BARANG DIHAPUS (CLEAN & PROFESSIONAL) ── */}
      {isDeletedLogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh] animate-scaleUp">
            
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
              <h3 className="font-extrabold text-sm text-slate-900 tracking-tight">Riwayat Barang Dihapus</h3>
              <button 
                onClick={() => setIsDeletedLogModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                title="Tutup"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Search Input */}
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Cari barang dihapus..."
                  className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all shadow-2xs"
                  value={deletedLogSearchQuery}
                  onChange={(e) => setDeletedLogSearchQuery(e.target.value)}
                />
                <svg className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
            </div>

            {/* Items List (Read-Only Log Rows) */}
            <div className="overflow-y-auto flex-grow divide-y divide-slate-100 max-h-[50vh]">
              {(() => {
                const filteredList = deletedProductsHistory.filter(item => {
                  if (!deletedLogSearchQuery.trim()) return true;
                  const q = deletedLogSearchQuery.toLowerCase();
                  return (
                    item.product.name.toLowerCase().includes(q) ||
                    (item.product.subcategory && item.product.subcategory.toLowerCase().includes(q)) ||
                    item.product.category.toLowerCase().includes(q)
                  );
                });

                if (filteredList.length === 0) {
                  return (
                    <div className="py-12 px-4 text-center">
                      <p className="text-xs font-medium text-slate-400">
                        {deletedLogSearchQuery ? 'Tidak ada hasil pencarian.' : 'Belum ada riwayat barang yang dihapus.'}
                      </p>
                    </div>
                  );
                }

                return filteredList.map(log => {
                  const p = log.product;
                  const dateFormatted = new Date(log.deletedAt).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  });

                  return (
                    <div 
                      key={'deleted-log-' + log.id}
                      className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200/80">
                          {p.image_url ? (
                            <img src={getOptimizedImageUrl(p.image_url, 100)} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300 text-[8px] font-bold">N/A</div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs text-slate-900 truncate" title={p.name}>
                            {p.name}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400 font-medium">
                            <span>{p.subcategory || p.category}</span>
                            <span>•</span>
                            <span>Stok saat hapus: {p.stock} {p.unit}</span>
                            {log.changedBy && (
                              <>
                                <span>•</span>
                                <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[9px] font-bold">
                                  {log.changedBy}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-bold text-slate-900">
                          Rp {(p.price - p.discount).toLocaleString('id-ID')}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {dateFormatted}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-100 bg-white flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">
                Total: <strong className="text-slate-900 font-bold">{deletedProductsHistory.length}</strong> barang
              </span>
              <button
                onClick={() => setIsDeletedLogModalOpen(false)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer active:scale-95 text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── KONFIRMASI TOGGLE EDIT STOK MODAL (Minimalist & Professional) ── */}
      {stockEditConfirmation && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in" 
          onClick={() => setStockEditConfirmation(null)}
        >
          <div 
            className="w-full max-w-[360px] bg-white border border-slate-200 rounded-2xl p-6 shadow-xl relative animate-pop-in space-y-4" 
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="font-extrabold text-base text-slate-900">Konfirmasi Edit Stok</h3>
              <p className="text-xs text-slate-500 mt-1">
                Apakah Anda yakin ingin memperbarui stok barang ini?
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Produk</span>
                <span className="font-bold text-slate-900 max-w-[180px] truncate" title={stockEditConfirmation.productName}>
                  {stockEditConfirmation.productName}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Petugas</span>
                <span className="font-bold text-slate-800">
                  {currentAdminUser?.name || 'Ardian'}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200/60 font-bold">
                <span className="text-slate-600">Perubahan</span>
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="text-slate-500">{stockEditConfirmation.oldStock}</span>
                  <span className="text-slate-400">➔</span>
                  <span className="text-slate-900 text-sm">{stockEditConfirmation.newStock}</span>
                  <span className={`text-xs ${
                    stockEditConfirmation.newStock > stockEditConfirmation.oldStock
                      ? 'text-emerald-600'
                      : 'text-rose-600'
                  }`}>
                    ({stockEditConfirmation.newStock > stockEditConfirmation.oldStock
                      ? `+${stockEditConfirmation.newStock - stockEditConfirmation.oldStock}`
                      : `${stockEditConfirmation.newStock - stockEditConfirmation.oldStock}`})
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button 
                onClick={() => setStockEditConfirmation(null)} 
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button 
                onClick={confirmAndExecuteStockAdjustment} 
                className="px-4.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer"
              >
                Simpan Stok
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RIWAYAT PENGEDITAN STOK MODAL (Ultra Clean Audit Trail) ── */}
      {isStockLogModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in" 
          onClick={() => setIsStockLogModalOpen(false)}
        >
          <div 
            className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[85vh] animate-pop-in" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Riwayat Edit Stok</h3>
              </div>
              <button 
                onClick={() => setIsStockLogModalOpen(false)} 
                className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search Input Bar */}
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Cari produk atau petugas..."
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 text-xs rounded-xl focus:ring-1 focus:ring-slate-900 transition-all outline-none"
                  value={stockLogSearchQuery}
                  onChange={(e) => setStockLogSearchQuery(e.target.value)}
                />
                <svg className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
            </div>

            {/* Log Rows List */}
            <div className="overflow-y-auto flex-grow divide-y divide-slate-100 max-h-[50vh]">
              {(() => {
                const filteredList = stockHistory.filter(item => {
                  if (!stockLogSearchQuery.trim()) return true;
                  const q = stockLogSearchQuery.toLowerCase();
                  return (
                    item.productName.toLowerCase().includes(q) ||
                    item.changedBy.toLowerCase().includes(q) ||
                    (item.notes && item.notes.toLowerCase().includes(q))
                  );
                });

                if (filteredList.length === 0) {
                  return (
                    <div className="py-12 px-4 text-center">
                      <p className="text-xs font-medium text-slate-400">
                        {stockLogSearchQuery ? 'Tidak ada hasil pencarian.' : 'Belum ada riwayat pengeditan stok.'}
                      </p>
                    </div>
                  );
                }

                return filteredList.map(log => {
                  const dateFormatted = new Date(log.changedAt).toLocaleString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <div 
                      key={'stock-log-' + log.id}
                      className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-xs text-slate-900 truncate" title={log.productName}>
                          {log.productName}
                        </h4>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {dateFormatted} WIB <span className="text-slate-300">•</span> Oleh <strong className="text-slate-700">{log.changedBy}</strong>
                        </div>
                      </div>

                      <div className="text-right shrink-0 font-mono">
                        <div className="flex items-center gap-1.5 justify-end text-xs">
                          <span className="text-slate-500">{log.oldStock}</span>
                          <span className="text-slate-300">➔</span>
                          <span className="font-bold text-slate-900">{log.newStock}</span>
                        </div>
                        <div className={`text-xs font-bold mt-0.5 ${
                          log.changeAmount > 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {log.changeAmount > 0 ? `+${log.changeAmount}` : log.changeAmount} unit
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-100 bg-white flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">
                Total: <strong className="text-slate-900 font-bold">{stockHistory.length}</strong> entri
              </span>
              <button
                onClick={() => setIsStockLogModalOpen(false)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer active:scale-95 text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL PETUGAS ADMIN AKTIF REALTIME (Clean Executive Design) ── */}
      {isOnlineAdminsModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in" 
          onClick={() => setIsOnlineAdminsModalOpen(false)}
        >
          <div 
            className="w-full max-w-xs bg-white border border-slate-200 rounded-2xl p-5 shadow-xl overflow-hidden animate-pop-in space-y-4" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">Petugas Aktif</h3>
              </div>
              <button 
                onClick={() => setIsOnlineAdminsModalOpen(false)} 
                className="p-1 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* List of Active Admins */}
            <div className="space-y-2">
              {activeOnlineAdmins.length === 0 ? (
                <div className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-200/60 rounded-xl text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                  <strong className="font-bold text-slate-900 truncate">{currentAdminUser?.name || 'Admin'} (Anda)</strong>
                </div>
              ) : (
                activeOnlineAdmins.map((admin, idx) => (
                  <div key={'online-admin-' + idx} className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-200/60 rounded-xl text-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                    <strong className="font-bold text-slate-900 truncate">
                      {admin.name} {admin.name === currentAdminUser?.name ? '(Anda)' : ''}
                    </strong>
                  </div>
                ))
              )}
            </div>

            {/* Close Button */}
            <button
              onClick={() => setIsOnlineAdminsModalOpen(false)}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all cursor-pointer active:scale-95 text-xs"
            >
              Tutup
            </button>
          </div>
        </div>
      )}


      <AIChatWidget />

      {/* ── TOAST NOTIFICATION ── */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl font-bold tracking-wide text-xs z-50 flex items-center gap-2 border border-slate-700 animate-pop-in">
          <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span>{toastMsg}</span>
        </div>
      )}

    </div>
  );
}
