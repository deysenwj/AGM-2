import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';

interface Product {
  id: string;
  name: string;
  category: string; // 'furniture' | 'electronics'
  subcategory: string; // sub-products
  description: string;
  price: number;
  stock: number;
  unit: string;
  image: string;
  discount: number;
  arrivalType?: 'BARANG BARU' | 'EKSKLUSIF' | 'PRE-ORDER' | '';
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



const StockControlInput = ({ 
  stock, 
  onCommit 
}: { 
  stock: number; 
  onCommit: (val: number) => void; 
}) => {
  const [localVal, setLocalVal] = useState(String(stock));

  useEffect(() => {
    setLocalVal(String(stock));
  }, [stock]);

  const handleBlurOrSubmit = () => {
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
      onChange={(e) => setLocalVal(e.target.value)}
      onBlur={handleBlurOrSubmit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          handleBlurOrSubmit();
        }
      }}
      className="w-14 text-center font-bold text-sm text-primary py-1 bg-transparent border-none focus:ring-0 outline-none"
    />
  );
};

export default function App() {
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('agm2_inventory');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Only use cache if it does not contain old mock IDs ('1', '2', etc.)
        if (Array.isArray(parsed) && parsed.length > 0 && !['1','2','3','4','5','6'].includes(String(parsed[0].id))) {
          return parsed;
        }
      } catch (e) {}
    }
    return [];
  });
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentView, setCurrentView] = useState<'catalog' | 'stock' | 'dashboard'>('catalog');
  const [filterCategory, setFilterCategory] = useState<'all' | 'furniture' | 'electronics'>('all');
  const [filterSubcategory, setFilterSubcategory] = useState<string>('all');
  const [globalSearch, setGlobalSearch] = useState('');
  
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
  const [formArrivalType, setFormArrivalType] = useState<'BARANG BARU' | 'EKSKLUSIF' | 'PRE-ORDER' | ''>('');

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  // Helper to map DB row to Product interface
  const mapDbToProduct = (item: any): Product => ({
    id: String(item.id),
    name: item.name || '',
    category: item.category || 'furniture',
    subcategory: item.subcategory || '',
    description: item.description || '',
    price: Number(item.price) || 0,
    discount: Number(item.discount) || 0,
    stock: isNaN(Number(item.stock)) ? 0 : Math.max(0, Number(item.stock)),
    unit: item.unit || 'Pcs',
    image: item.image || '',
    arrivalType: item.arrival_type || ''
  });

  // Load state from Supabase 100% directly
  const fetchProducts = async () => {
    setIsFetchingData(true);
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error mengambil data dari Supabase:', error.message);
      } else if (data) {
        const dbProducts = data.map(mapDbToProduct);
        setProducts(dbProducts);
        localStorage.setItem('agm2_inventory', JSON.stringify(dbProducts));
      }
    } else {
      setProducts([]);
    }
    setIsFetchingData(false);
  };

  // Realtime subscription & initial load
  useEffect(() => {
    fetchProducts();

    let productsChannel: any = null;

    if (isSupabaseConfigured) {
      productsChannel = supabase
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
              setProducts(prev => prev.map(p => p.id === updatedItem.id ? { ...p, ...updatedItem } : p));
            } else if (payload.eventType === 'DELETE') {
              const deletedId = String(payload.old.id);
              setProducts(prev => prev.filter(p => p.id !== deletedId));
            }
          }
        )
        .subscribe();
    }

    const auth = localStorage.getItem('agm2_admin_mode');
    if (auth === 'true') {
      setIsAdmin(true);
    }

    return () => {
      if (productsChannel) supabase.removeChannel(productsChannel);
    };
  }, []);

  const saveProducts = (list: Product[]) => {
    setProducts(list);
    localStorage.setItem('agm2_inventory', JSON.stringify(list));
  };

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
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

  // Auth Handling
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setLoginError('');

    setTimeout(() => {
      if (username.toLowerCase() === 'admin' && password === 'admin123') {
        setIsAdmin(true);
        localStorage.setItem('agm2_admin_mode', 'true');
        setIsLoginOpen(false);
        setUsername('');
        setPassword('');
        triggerToast('Autentikasi Admin Berhasil');
      } else {
        setLoginError('Username atau Password Admin salah.');
      }
      setIsAuthenticating(false);
    }, 1200);
  };

  const handleLogout = () => {
    setIsAdmin(false);
    localStorage.setItem('agm2_admin_mode', 'false');
    setCurrentView('catalog');
    triggerToast('Berhasil Keluar');
  };

  // Super-Responsive Stock Update Functions (0ms optimistic delay)
  const adjustStock = async (id: string, amount: number) => {
    let updatedStock = 0;

    setProducts(prev => {
      const updatedList = prev.map(p => {
        if (p.id === id) {
          const current = typeof p.stock === 'number' && !isNaN(p.stock) ? p.stock : (parseInt(String(p.stock)) || 0);
          updatedStock = Math.max(0, current + amount);
          return { ...p, stock: updatedStock };
        }
        return p;
      });
      try {
        localStorage.setItem('agm2_inventory', JSON.stringify(updatedList));
      } catch (e) {}
      return updatedList;
    });

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('products')
          .update({ stock: updatedStock })
          .eq('id', id);

        if (error) {
          console.warn('Sync notice:', error.message);
        }
      } catch (e) {
        console.warn('Sync notice:', e);
      }
    }
  };

  const setDirectStock = async (id: string, newStockVal: number) => {
    const sanitizedStock = isNaN(newStockVal) ? 0 : Math.max(0, Math.floor(Number(newStockVal) || 0));

    setProducts(prev => {
      const updatedList = prev.map(p => p.id === id ? { ...p, stock: sanitizedStock } : p);
      try {
        localStorage.setItem('agm2_inventory', JSON.stringify(updatedList));
      } catch (e) {}
      return updatedList;
    });

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('products')
          .update({ stock: sanitizedStock })
          .eq('id', id);

        if (error) {
          console.warn('Sync notice:', error.message);
        }
      } catch (e) {
        console.warn('Sync notice:', e);
      }
    }
  };

  // Optimistic Add / Edit Form Submission
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const priceVal = parseInt(formPrice.replace(/\D/g, '')) || 0;
    const discountVal = parseInt(formDiscount.replace(/\D/g, '')) || 0;
    const stockVal = parseInt(formStock) || 0;

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
        image: formImage,
        arrivalType: formArrivalType
      };

      // Optimistic update
      setProducts(prev => [newItem, ...prev]);
      setIsFormOpen(false);
      triggerToast('Produk ditambahkan!');

      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('products')
          .insert([{
            name: formName,
            category: formCategory,
            subcategory: formSubcategory,
            description: formDescription,
            price: priceVal,
            discount: discountVal,
            stock: stockVal,
            unit: formUnit,
            image: formImage,
            arrival_type: formArrivalType
          }])
          .select();

        if (error) {
          triggerToast('Gagal menyinkronkan ke server: ' + error.message);
          setProducts(prev => prev.filter(p => p.id !== tempId));
        } else if (data && data[0]) {
          const createdItem = mapDbToProduct(data[0]);
          setProducts(prev => prev.map(p => p.id === tempId ? createdItem : p));
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
        image: formImage,
        arrivalType: formArrivalType
      };

      // Optimistic update
      setProducts(prev => prev.map(p => p.id === editingId ? updatedItem : p));
      setIsFormOpen(false);
      triggerToast('Produk diperbarui!');

      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('products')
          .update({
            name: formName,
            category: formCategory,
            subcategory: formSubcategory,
            description: formDescription,
            price: priceVal,
            discount: discountVal,
            stock: stockVal,
            unit: formUnit,
            image: formImage,
            arrival_type: formArrivalType
          })
          .eq('id', editingId);

        if (error) {
          triggerToast('Gagal memperbarui di server: ' + error.message);
          fetchProducts();
        }
      } else {
        saveProducts(products.map(p => p.id === editingId ? updatedItem : p));
      }
    }
  };

  // Optimistic Product Deletion
  const deleteProduct = async (id: string) => {
    // Optimistic update
    setProducts(prev => prev.filter(p => p.id !== id));
    setDeleteConfirmId(null);
    triggerToast('Produk dihapus.');

    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) {
        triggerToast('Gagal menghapus di server: ' + error.message);
        fetchProducts();
      }
    } else {
      saveProducts(products.filter(p => p.id !== id));
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
    setFormImage(p.image);
    setFormArrivalType(p.arrivalType || '');
    setIsFormOpen(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const r = new FileReader();
      r.onloadend = () => {
        setFormImage(r.result as string);
      };
      r.readAsDataURL(file);
    }
  };

  // Filter application
  const filteredProducts = products.filter(p => {
    const matchCategory = filterCategory === 'all' || p.category === filterCategory;
    const matchSubcategory = filterSubcategory === 'all' || p.subcategory === filterSubcategory;
    const matchSearch = p.name.toLowerCase().includes(globalSearch.toLowerCase()) || 
                          p.description.toLowerCase().includes(globalSearch.toLowerCase());
    
    // Check In Stock & Backorder statuses
    const isInStock = p.stock > 0;
    if (showInStock && isInStock) return matchCategory && matchSubcategory && matchSearch;
    if (showBackorder && !isInStock) return matchCategory && matchSubcategory && matchSearch;

    return false;
  });

  const getStockLabel = (stock: number) => {
    const s = isNaN(stock) ? 0 : Math.max(0, Number(stock) || 0);
    if (s === 0) return <span className="font-label-md text-label-md text-error flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">cancel</span> HABIS</span>;
    if (s <= 3) return <span className="font-label-md text-label-md text-warning flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">error</span> TERBATAS</span>;
    return <span className="font-label-md text-label-md text-status-blue flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">check_circle</span> TERSEDIA</span>;
  };

  return (
    <div className="bg-surface text-on-surface selection:bg-primary-fixed selection:text-primary min-h-screen flex flex-col font-body-md">
      
      {/* ── TOP NAV BAR ── */}
      <nav className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-margin-mobile md:px-margin-desktop h-16 bg-surface/80 backdrop-blur-xl border-b border-border-light">
        <div className="flex items-center gap-3 lg:gap-12">
          {/* Mobile hamburger menu */}
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden text-primary flex items-center justify-center p-2 rounded-lg hover:bg-surface-container transition-colors"
            title="Buka Menu"
          >
            <span className="material-symbols-outlined text-[24px]">menu</span>
          </button>
          <div className="font-display-lg text-headline-md tracking-tighter text-primary select-none cursor-pointer" onClick={() => setCurrentView('catalog')}>
            AGM 2
          </div>
          <div className="hidden lg:flex items-center gap-6">
            <button
              onClick={() => { selectCategoryFilter('furniture'); setCurrentView('catalog'); }}
              className={`font-body-md text-body-md uppercase tracking-widest pb-1 transition-all ${filterCategory === 'furniture' && currentView === 'catalog' ? 'text-primary font-bold border-b-2 border-primary' : 'text-secondary hover:text-primary'}`}
            >
              Furniture
            </button>
            <button
              onClick={() => { selectCategoryFilter('electronics'); setCurrentView('catalog'); }}
              className={`font-body-md text-body-md uppercase tracking-widest pb-1 transition-all ${filterCategory === 'electronics' && currentView === 'catalog' ? 'text-primary font-bold border-b-2 border-primary' : 'text-secondary hover:text-primary'}`}
            >
              Elektronik
            </button>
            {isAdmin && (
              <>
                <button
                  onClick={() => setCurrentView('stock')}
                  className={`font-body-md text-body-md uppercase tracking-widest pb-1 transition-all ${currentView === 'stock' ? 'text-primary font-bold border-b-2 border-primary' : 'text-secondary hover:text-primary'}`}
                >
                  Inventaris
                </button>
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className={`font-body-md text-body-md uppercase tracking-widest pb-1 transition-all ${currentView === 'dashboard' ? 'text-primary font-bold border-b-2 border-primary' : 'text-secondary hover:text-primary'}`}
                >
                  Analisis
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right Top Items (Responsive Search and Login) */}
        <div className="flex items-center gap-3 sm:gap-6">
          <div className="relative max-w-[120px] sm:max-w-xs">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary text-base">search</span>
            <input
              type="text"
              placeholder="Cari..."
              className="pl-8 pr-3 py-1.5 bg-surface-container border-none text-xs rounded-lg w-full focus:ring-1 focus:ring-primary focus:bg-surface-container-high transition-all"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
            />
          </div>
          
          {isAdmin ? (
            <button 
              onClick={handleLogout}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
              title="Logout Admin"
            >
              <span className="material-symbols-outlined">logout</span>
              <span className="hidden md:inline font-bold text-xs uppercase tracking-wider">LOGOUT</span>
            </button>
          ) : (
            <button 
              onClick={() => setIsLoginOpen(true)}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
              title="Login Admin"
            >
              <span className="material-symbols-outlined">account_circle</span>
              <span className="hidden md:inline font-bold text-xs uppercase tracking-wider">LOGIN ADMIN</span>
            </button>
          )}
        </div>
      </nav>

      {/* ── SIDEBAR (DESKTOP) ── */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-16 bottom-0 w-64 p-6 gap-y-8 bg-surface border-r border-border-light overflow-y-auto">
        <div>
          <h3 className="font-label-md text-label-md uppercase tracking-[0.1em] text-secondary mb-4">Navigasi</h3>
          <div className="space-y-1">
            <button
              onClick={() => setCurrentView('catalog')}
              className={`w-full text-left flex items-center gap-3 p-3 rounded-lg transition-all ${currentView === 'catalog' ? 'bg-secondary-container text-primary font-semibold' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              <span className="material-symbols-outlined text-[20px]">person_search</span>
              <span className="font-body-md text-body-md">Katalog Pelanggan</span>
            </button>

            {isAdmin && (
              <>
                <button
                  onClick={() => setCurrentView('stock')}
                  className={`w-full text-left flex items-center gap-3 p-3 rounded-lg transition-all ${currentView === 'stock' ? 'bg-secondary-container text-primary font-semibold' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
                >
                  <span className="material-symbols-outlined text-[20px]">inventory_2</span>
                  <span className="font-body-md text-body-md">Kontrol Stok</span>
                </button>
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className={`w-full text-left flex items-center gap-3 p-3 rounded-lg transition-all ${currentView === 'dashboard' ? 'bg-secondary-container text-primary font-semibold' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
                >
                  <span className="material-symbols-outlined text-[20px]">dashboard</span>
                  <span className="font-body-md text-body-md">Dasbor</span>
                </button>
              </>
            )}
          </div>
        </div>

        <div>
          <h3 className="font-label-md text-label-md uppercase tracking-[0.1em] text-secondary mb-4">Saring Pencarian</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="font-label-md text-label-md block text-secondary">Status</label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={showInStock}
                    onChange={(e) => setShowInStock(e.target.checked)}
                    className="w-4 h-4 rounded-sm border-border-light text-primary focus:ring-primary"
                  />
                  <span className="font-body-md text-body-md text-on-surface">Tersedia</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input 
                    type="checkbox"
                    checked={showBackorder}
                    onChange={(e) => setShowBackorder(e.target.checked)}
                    className="w-4 h-4 rounded-sm border-border-light text-primary focus:ring-primary"
                  />
                  <span className="font-body-md text-body-md text-on-surface">Pre-Order</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MOBILE DRAWER SIDEBAR ── */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex" onClick={() => setIsSidebarOpen(false)}>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-surface/50 backdrop-blur-sm transition-opacity" />
          
          {/* Drawer Panel */}
          <aside 
            className="relative flex flex-col w-64 max-w-[280px] h-full p-6 gap-y-8 bg-surface border-r border-border-light overflow-y-auto animate-slide-in shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header / Close */}
            <div className="flex justify-between items-center pb-2 border-b border-border-light">
              <span className="font-bold text-primary tracking-tight">Navigasi &amp; Filter</span>
              <button onClick={() => setIsSidebarOpen(false)} className="text-secondary hover:text-primary flex items-center justify-center">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div>
              <h3 className="font-label-md text-label-md uppercase tracking-[0.1em] text-secondary mb-4">Navigasi</h3>
              <div className="space-y-1">
                <button
                  onClick={() => { setCurrentView('catalog'); setIsSidebarOpen(false); }}
                  className={`w-full text-left flex items-center gap-3 p-3 rounded-lg transition-all ${currentView === 'catalog' ? 'bg-secondary-container text-primary font-semibold' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
                >
                  <span className="material-symbols-outlined text-[20px]">person_search</span>
                  <span className="font-body-md text-body-md">Katalog Pelanggan</span>
                </button>

                {isAdmin && (
                  <>
                    <button
                      onClick={() => { setCurrentView('stock'); setIsSidebarOpen(false); }}
                      className={`w-full text-left flex items-center gap-3 p-3 rounded-lg transition-all ${currentView === 'stock' ? 'bg-secondary-container text-primary font-semibold' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
                    >
                      <span className="material-symbols-outlined text-[20px]">inventory_2</span>
                      <span className="font-body-md text-body-md">Kontrol Stok</span>
                    </button>
                    <button
                      onClick={() => { setCurrentView('dashboard'); setIsSidebarOpen(false); }}
                      className={`w-full text-left flex items-center gap-3 p-3 rounded-lg transition-all ${currentView === 'dashboard' ? 'bg-secondary-container text-primary font-semibold' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
                    >
                      <span className="material-symbols-outlined text-[20px]">dashboard</span>
                      <span className="font-body-md text-body-md">Dasbor</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-label-md text-label-md uppercase tracking-[0.1em] text-secondary mb-4">Kategori Utama</h3>
              <div className="space-y-1">
                <button
                  onClick={() => { selectCategoryFilter('furniture'); setCurrentView('catalog'); setIsSidebarOpen(false); }}
                  className={`w-full text-left flex items-center gap-3 p-3 rounded-lg transition-all ${filterCategory === 'furniture' && currentView === 'catalog' ? 'bg-secondary-container text-primary font-semibold' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
                >
                  <span className="material-symbols-outlined text-[20px]">table_restaurant</span>
                  <span className="font-body-md text-body-md">Furniture</span>
                </button>
                <button
                  onClick={() => { selectCategoryFilter('electronics'); setCurrentView('catalog'); setIsSidebarOpen(false); }}
                  className={`w-full text-left flex items-center gap-3 p-3 rounded-lg transition-all ${filterCategory === 'electronics' && currentView === 'catalog' ? 'bg-secondary-container text-primary font-semibold' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
                >
                  <span className="material-symbols-outlined text-[20px]">devices</span>
                  <span className="font-body-md text-body-md">Elektronik</span>
                </button>
              </div>
            </div>

            <div>
              <h3 className="font-label-md text-label-md uppercase tracking-[0.1em] text-secondary mb-4">Saring Pencarian</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="font-label-md text-label-md block text-secondary">Status</label>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={showInStock}
                        onChange={(e) => setShowInStock(e.target.checked)}
                        className="w-4 h-4 rounded-sm border-border-light text-primary focus:ring-primary"
                      />
                      <span className="font-body-md text-body-md text-on-surface">Tersedia</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input 
                        type="checkbox"
                        checked={showBackorder}
                        onChange={(e) => setShowBackorder(e.target.checked)}
                        className="w-4 h-4 rounded-sm border-border-light text-primary focus:ring-primary"
                      />
                      <span className="font-body-md text-body-md text-on-surface">Pre-Order</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ── MAIN CONTENT CANVAS ── */}
      <main className="lg:ml-64 pt-16 min-h-screen flex flex-col transition-all">
        
        {/* ── HERO BANNER ── */}
        <header className="w-full px-margin-mobile lg:px-margin-desktop py-8 lg:py-10 border-b border-border-light bg-surface-bright">
          <div className="max-w-container-max mx-auto">
            <p className="font-label-md text-label-md uppercase tracking-[0.2em] text-secondary mb-3">KETERSEDIAAN &amp; INVENTARIS</p>
            <h1 className="font-display-lg text-display-lg-mobile lg:text-display-lg text-primary tracking-tighter mb-4 max-w-2xl">
              Solusi Furniture &amp; Elektronik Berkualitas untuk Setiap Kebutuhan Anda
            </h1>
            <div className="flex gap-4">
              <div className="px-6 py-2 bg-surface-container-highest rounded-full font-label-md text-label-md">
                {products.length} Produk Aktif
              </div>
            </div>
          </div>
        </header>

        {/* ── CATALOG VIEW ── */}
        {currentView === 'catalog' && (
          <section className="px-margin-mobile lg:px-margin-desktop pt-6 pb-12 max-w-container-max mx-auto w-full flex-grow">
            
            {/* Guest pricing notice */}
            {!isAdmin && (
              <div className="mb-6 p-4 bg-surface-container-low border border-border-light flex items-center gap-3 text-secondary rounded-lg">
                <span className="material-symbols-outlined text-primary text-xl shrink-0">lock</span>
                <span className="text-body-md text-sm leading-relaxed">
                  Harga produk disembunyikan untuk Tamu. Silakan hubungi admin untuk mengetahui harga barang
                </span>
              </div>
            )}

            {/* Grid Filters Row */}
            <div className="flex flex-col gap-6 mb-8">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border-light pb-4">
                <div className="flex gap-2 overflow-x-auto hide-scrollbar w-full md:w-auto -mx-margin-mobile px-margin-mobile md:mx-0 md:px-0">
                  <button
                    onClick={() => selectCategoryFilter('all')}
                    className={`whitespace-nowrap px-6 py-2.5 border text-xs font-bold uppercase transition-all ${filterCategory === 'all' ? 'border-primary bg-primary text-pure-white' : 'border-border-light hover:border-primary text-secondary'}`}
                  >
                    SEMUA PRODUK
                  </button>
                  <button
                    onClick={() => selectCategoryFilter('furniture')}
                    className={`whitespace-nowrap px-6 py-2.5 border text-xs font-bold uppercase transition-all ${filterCategory === 'furniture' ? 'border-primary bg-primary text-pure-white' : 'border-border-light hover:border-primary text-secondary'}`}
                  >
                    FURNITURE
                  </button>
                  <button
                    onClick={() => selectCategoryFilter('electronics')}
                    className={`whitespace-nowrap px-6 py-2.5 border text-xs font-bold uppercase transition-all ${filterCategory === 'electronics' ? 'border-primary bg-primary text-pure-white' : 'border-border-light hover:border-primary text-secondary'}`}
                  >
                    ELEKTRONIK
                  </button>
                </div>
                <div className="flex items-center justify-between md:justify-end gap-2 w-full md:w-auto text-xs text-secondary font-semibold">
                  <span>Menampilkan {filteredProducts.length} dari {products.length} produk</span>
                  <span className="material-symbols-outlined cursor-pointer ml-2">sort</span>
                </div>
              </div>

              {/* Sub-product Filter Dropdown */}
              {filterCategory !== 'all' && (
                <div className="flex items-center gap-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-secondary whitespace-nowrap">Sub Produk:</label>
                  <select
                    value={filterSubcategory}
                    onChange={(e) => setFilterSubcategory(e.target.value)}
                    className="bg-surface-container border border-border-light text-xs font-bold rounded-lg px-4 py-2 text-primary focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none"
                  >
                    <option value="all">Semua</option>
                    {(filterCategory === 'furniture' ? FURNITURE_SUBCATEGORIES : ELECTRONICS_SUBCATEGORIES).map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Bento-Inspired Product Grid */}
            {filteredProducts.length === 0 ? (
              <div className="text-center py-16 text-secondary">
                <span className="material-symbols-outlined text-4xl block mb-2 text-border-light">inventory_2</span>
                <p className="text-sm">Tidak ada produk yang cocok dengan kriteria.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {filteredProducts.map(p => (
                  <div key={p.id} className="product-card group relative flex flex-col bg-pure-white border border-transparent hover:border-border-light transition-all duration-500 overflow-hidden">
                    <div className="aspect-square overflow-hidden bg-surface-container relative">
                      {p.image ? (
                        <img 
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                          src={p.image} 
                          alt={p.name}
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-surface-container-high text-secondary">
                          <span className="material-symbols-outlined text-3xl">image_not_supported</span>
                          <span className="text-[10px] uppercase mt-1">Tidak Ada Foto</span>
                        </div>
                      )}
                      {p.arrivalType && (
                        <div className="absolute top-2 left-2 bg-pure-white/90 backdrop-blur px-2 py-0.5 font-label-md text-[10px] text-primary font-bold uppercase">
                          {p.arrivalType}
                        </div>
                      )}
                    </div>
                    
                    <div className="p-3 sm:p-4 flex flex-col justify-between flex-grow">
                      <div className="space-y-1 min-w-0">
                        <h3 className="font-bold text-sm text-primary uppercase tracking-tight truncate" title={p.name}>{p.name}</h3>
                        <p className="text-xs text-secondary truncate" title={p.description}>{p.description}</p>
                        
                        {/* Subcategory Label in guest view */}
                        {p.subcategory && (
                          <div className="pt-0.5">
                            <span className="inline-block text-[9px] bg-surface-container-highest text-secondary px-1.5 py-0.5 rounded uppercase font-bold">
                              {p.subcategory}
                            </span>
                          </div>
                        )}

                        {/* Render Price for Admin ONLY */}
                        {isAdmin ? (
                          <div className="mt-1">
                            <span className="font-bold text-sm text-primary">
                              Rp {(p.price - p.discount).toLocaleString('id-ID')}
                            </span>
                            {p.discount > 0 && (
                              <span className="text-[10px] text-secondary line-through block">
                                Rp {p.price.toLocaleString('id-ID')}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-secondary bg-surface-container-low px-1.5 py-0.5 rounded">
                            <span className="material-symbols-outlined text-[10px]">lock</span> Harga Terkunci
                          </div>
                        )}
                      </div>
                      
                      {/* Availability status: row on mobile, col on desktop */}
                      <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-1 mt-3 pt-2 border-t border-border-light/40">
                        {getStockLabel(p.stock)}
                        <span className="text-[10px] text-secondary font-semibold">{p.stock} {p.unit}</span>
                      </div>
                    </div>

                    {/* Quick Edit/Delete buttons on Desktop/Admin hover */}
                    {isAdmin && (
                      <div className="absolute bottom-3 left-3 right-3 flex gap-2 opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                        <button 
                          onClick={() => openEdit(p)}
                          className="flex-1 bg-primary text-pure-white py-2 text-xs font-bold hover:bg-opacity-80 active:scale-[0.98] transition-all"
                        >
                          EDIT
                        </button>
                        <button 
                          onClick={() => setDeleteConfirmId(p.id)}
                          className="bg-error text-pure-white px-3 py-2 text-xs font-bold hover:bg-opacity-90 active:scale-[0.98] transition-all"
                        >
                          HAPUS
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── STOCK CONTROL TABLE VIEW ── */}
        {currentView === 'stock' && isAdmin && (
          <section className="px-margin-mobile lg:px-margin-desktop py-8 max-w-container-max mx-auto w-full flex-grow">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h2 className="font-headline-lg text-headline-lg text-primary">Inventaris Gudang A1</h2>
              <button onClick={openAdd} className="bg-primary text-pure-white px-6 py-3 font-button text-button uppercase tracking-wider rounded-sm w-full sm:w-auto">
                Tambah SKU Baru
              </button>
            </div>

            <div className="bg-pure-white border border-border-light rounded-sm overflow-hidden shadow-sm">
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
                          {p.image ? (
                            <img src={p.image} className="w-16 h-12 object-cover border border-border-light rounded" alt={p.name} />
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
                          <div className="flex justify-end gap-2">
                            <button onClick={() => openEdit(p)} className="p-2 border border-border-light text-secondary hover:text-primary transition-colors">
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            <button onClick={() => setDeleteConfirmId(p.id)} className="p-2 border border-border-light text-error hover:bg-error/10 transition-colors">
                              <span className="material-symbols-outlined text-[18px]">delete</span>
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
          const stockIntegrityRatio = products.length > 0 ? Math.round((healthyStockCount / products.length) * 100) : 0;

          const furnitureProducts = products.filter(p => p.category === 'furniture');
          const electronicsProducts = products.filter(p => p.category === 'electronics');

          const furnitureVal = furnitureProducts.reduce((acc, p) => acc + ((p.price - p.discount) * p.stock), 0);
          const electronicsVal = electronicsProducts.reduce((acc, p) => acc + ((p.price - p.discount) * p.stock), 0);

          const totalValAll = totalInventoryValue || 1;
          const furnitureValPercent = Math.round((furnitureVal / totalValAll) * 100);
          const electronicsValPercent = Math.round((electronicsVal / totalValAll) * 100);

          return (
            <section className="px-margin-mobile lg:px-margin-desktop py-8 max-w-container-max mx-auto w-full flex-grow">
              
              {/* Header Title & Supabase Status Badge */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                  <h2 className="font-headline-lg text-headline-lg text-primary">Dasbor Analisis Inventaris</h2>
                  <p className="text-xs text-secondary mt-1">Ringkasan stok dan aset toko tersinkronisasi langsung dengan Supabase Database</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full border flex items-center gap-1.5 ${
                    isSupabaseConfigured 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${isFetchingData ? 'bg-emerald-500 animate-ping' : isSupabaseConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                    {isFetchingData ? 'Menyinkronkan Data...' : (isSupabaseConfigured ? 'Terhubung ke Supabase' : 'Mode Local Storage')}
                  </span>
                </div>
              </div>

              {/* ── 1. RINGKASAN KPI UTAMA INVENTARIS ── */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="p-5 bg-pure-white border border-border-light rounded-xl shadow-xs hover:border-primary/40 transition-all">
                  <div className="flex items-center justify-between text-secondary mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-secondary">Total Nilai Inventaris</span>
                    <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-xl">payments</span>
                    </div>
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-primary truncate" title={`Rp ${totalInventoryValue.toLocaleString('id-ID')}`}>
                    Rp {totalInventoryValue.toLocaleString('id-ID')}
                  </div>
                  <span className="text-xs text-secondary mt-1 block">Akumulasi nilai aset di gudang</span>
                </div>

                <div className="p-5 bg-pure-white border border-border-light rounded-xl shadow-xs hover:border-primary/40 transition-all">
                  <div className="flex items-center justify-between text-secondary mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-secondary">Total Produk &amp; Unit Fisik</span>
                    <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-xl">inventory_2</span>
                    </div>
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-primary flex items-baseline gap-2 flex-wrap">
                    <span>{products.length} SKU</span>
                    <span className="text-base text-status-blue font-bold">({totalUnits} Unit Fisik)</span>
                  </div>
                  <span className="text-xs text-secondary mt-1 block">{furnitureProducts.length} SKU Furniture / {electronicsProducts.length} SKU Elektronik</span>
                </div>

                <div className="p-5 bg-pure-white border border-border-light rounded-xl shadow-xs hover:border-primary/40 transition-all">
                  <div className="flex items-center justify-between text-secondary mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-secondary">Stok Kritis / Habis</span>
                    <div className="w-9 h-9 rounded-lg bg-error/10 flex items-center justify-center text-error">
                      <span className="material-symbols-outlined text-xl">warning_amber</span>
                    </div>
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-error">
                    {lowStockProducts.length + outOfStockProducts.length} SKU
                  </div>
                  <span className="text-xs text-error font-semibold mt-1 block">{outOfStockProducts.length} Habis / {lowStockProducts.length} Menipis</span>
                </div>
              </div>

              {/* ── 2. ANALISIS KATEGORI & INTEGRITAS STOK ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Distribusi Nilai per Kategori */}
                <div className="bg-pure-white border border-border-light p-6 rounded-xl shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-base text-primary flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">pie_chart</span> Distribusi Kategori Produk
                      </h3>
                      <span className="text-xs text-secondary font-medium">Berdasarkan Nilai Aset</span>
                    </div>
                    <p className="text-xs text-secondary mb-6">Proporsi nilai barang tersimpan di database Supabase</p>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-2">
                        <span className="text-primary flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-full bg-primary inline-block" /> Furniture ({furnitureProducts.length} SKU)
                        </span>
                        <span>{furnitureValPercent}% (Rp {furnitureVal.toLocaleString('id-ID')})</span>
                      </div>
                      <div className="w-full bg-surface-container h-3 rounded-full overflow-hidden">
                        <div className="bg-primary h-full transition-all duration-500" style={{ width: `${furnitureValPercent}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold mb-2">
                        <span className="text-status-blue flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-full bg-status-blue inline-block" /> Elektronik ({electronicsProducts.length} SKU)
                        </span>
                        <span>{electronicsValPercent}% (Rp {electronicsVal.toLocaleString('id-ID')})</span>
                      </div>
                      <div className="w-full bg-surface-container h-3 rounded-full overflow-hidden">
                        <div className="bg-status-blue h-full transition-all duration-500" style={{ width: `${electronicsValPercent}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rasio Integritas Stok */}
                <div className="bg-pure-white border border-border-light p-6 rounded-xl shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-base text-primary flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">assessment</span> Rasio Kesehatan Stok
                      </h3>
                      <span className="text-xs font-bold text-status-blue bg-status-blue/10 px-2.5 py-1 rounded-full">
                        {stockIntegrityRatio}% Sehat
                      </span>
                    </div>
                    <p className="text-xs text-secondary mb-6">Persentase tingkat ketersediaan stok fisik barang</p>
                  </div>

                  <div>
                    <div className="h-4 w-full bg-surface-container rounded-full overflow-hidden flex mb-4">
                      <div 
                        className="bg-emerald-500 h-full transition-all duration-500"
                        style={{ width: `${products.length > 0 ? (healthyStockCount / products.length) * 100 : 0}%` }}
                        title="Tersedia Sehat"
                      />
                      <div 
                        className="bg-amber-500 h-full transition-all duration-500"
                        style={{ width: `${products.length > 0 ? (lowStockProducts.length / products.length) * 100 : 0}%` }}
                        title="Stok Menipis"
                      />
                      <div 
                        className="bg-red-500 h-full transition-all duration-500"
                        style={{ width: `${products.length > 0 ? (outOfStockProducts.length / products.length) * 100 : 0}%` }}
                        title="Stok Habis"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
                      <div className="p-2 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200">
                        <span className="block text-[10px] text-emerald-600 font-semibold">Tersedia (&gt;3)</span>
                        {healthyStockCount} SKU
                      </div>
                      <div className="p-2 bg-amber-50 text-amber-800 rounded-lg border border-amber-200">
                        <span className="block text-[10px] text-amber-600 font-semibold">Menipis (1-3)</span>
                        {lowStockProducts.length} SKU
                      </div>
                      <div className="p-2 bg-red-50 text-red-800 rounded-lg border border-red-200">
                        <span className="block text-[10px] text-red-600 font-semibold">Habis (0)</span>
                        {outOfStockProducts.length} SKU
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── 3. NOTIFIKASI SYSTEM REAL-TIME (READ-ONLY ANALYTICS) ── */}
              <div className="grid grid-cols-1 gap-6 mb-8">
                {/* Notifikasi Real-time System */}
                <div className="bg-pure-white border border-border-light p-6 rounded-xl shadow-sm">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6 pb-3 border-b border-border-light">
                    <div>
                      <h3 className="font-bold text-base text-primary flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">notifications</span> Notifikasi System &amp; Status Stok
                      </h3>
                      <p className="text-xs text-secondary mt-0.5">Pemantauan otomatis stok barang dari database Supabase (Analisis Read-Only)</p>
                    </div>
                    <span className="text-xs font-bold text-secondary bg-surface-container px-2.5 py-1 rounded-md">Live Realtime</span>
                  </div>

                  <div className="space-y-3">
                    {outOfStockProducts.map(p => (
                      <div key={'notif-out-' + p.id} className="p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-xs">
                        <span className="material-symbols-outlined text-error text-base shrink-0 mt-0.5">cancel</span>
                        <div>
                          <strong className="text-error block">Stok Habis (0 Unit)</strong>
                          <span className="text-secondary">Produk <strong>{p.name}</strong> saat ini 0 unit tersisa. Silakan kelola stok melalui menu <strong>Kontrol Stok</strong>.</span>
                        </div>
                      </div>
                    ))}

                    {lowStockProducts.map(p => (
                      <div key={'notif-low-' + p.id} className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3 text-xs">
                        <span className="material-symbols-outlined text-amber-600 text-base shrink-0 mt-0.5">error</span>
                        <div>
                          <strong className="text-amber-800 block">Peringatan Stok Menipis</strong>
                          <span className="text-secondary">Produk <strong>{p.name}</strong> sisa {p.stock} {p.unit} (di bawah batas minimum 3 Unit).</span>
                        </div>
                      </div>
                    ))}

                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3 text-xs">
                      <span className="material-symbols-outlined text-emerald-600 text-base shrink-0 mt-0.5">check_circle</span>
                      <div>
                        <strong className="text-emerald-800 block">Sistem Sinkronisasi Supabase Aktif</strong>
                        <span className="text-secondary">Kelola stok dan penambahan produk dilakukan secara terpusat di menu <strong>Kontrol Stok</strong>.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </section>
          );
        })()}

        {/* ── TECHNICAL FOOTER ── */}
        <footer className="bg-surface-dim px-margin-mobile lg:px-margin-desktop py-6 border-t border-border-light mt-auto flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <span className="font-label-md text-label-md text-secondary">
            © 2026 AGM 2 OPERATIONS. ALL RIGHTS RESERVED.
          </span>
          <span className="font-label-md text-label-md text-secondary font-semibold max-w-md md:text-right">
            Alamat Toko : Jalan Rahadi Ismail, Desa Padang, Kecamatan Benua Kayong, Kabupaten Ketapang, Kalimantan Barat
          </span>
        </footer>
      </main>

 

       {/* ── LOGIN MODAL ── */}
      {isLoginOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface/90 backdrop-blur-md animate-fade-in" onClick={() => setIsLoginOpen(false)}>
          <div className="w-full max-w-[400px] bg-pure-white border border-border-light rounded-xl p-6 sm:p-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 text-left">
              <h1 className="font-headline-lg text-headline-lg text-primary mb-2">Login Admin</h1>
            </div>

            {loginError && (
              <div className="mb-4 text-xs text-error font-bold bg-error/10 p-3 rounded-lg border border-error/20">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="relative group">
                <label className="block font-label-md text-label-md text-on-surface-variant mb-1.5 ml-1 text-xs">Username</label>
                <input
                  type="text"
                  required
                  className="w-full bg-surface-container-low border-none rounded-lg px-4 py-2.5 font-body-md text-sm focus:bg-surface-container-high focus:ring-0"
                  placeholder="Masukkan username admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pt-5 text-secondary">
                  <span className="material-symbols-outlined text-sm">person</span>
                </div>
              </div>

              <div className="relative group">
                <label className="block font-label-md text-label-md text-on-surface-variant mb-1.5 ml-1 text-xs">Password</label>
                <input
                  type="password"
                  required
                  className="w-full bg-surface-container-low border-none rounded-lg px-4 py-2.5 font-body-md text-sm focus:bg-surface-container-high focus:ring-0"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pt-5 text-secondary">
                  <span className="material-symbols-outlined text-sm">lock</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isAuthenticating}
                className="w-full bg-primary text-on-primary font-button text-sm py-3.5 rounded-full transition-all hover:bg-opacity-90 mt-4 uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {isAuthenticating ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span> Memproses...
                  </>
                ) : (
                  <>
                    Masuk
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
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

      {/* ── ADD / EDIT SKU FORM MODAL ── */}
      {isFormOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface/90 backdrop-blur-md" onClick={() => setIsFormOpen(false)}>
          <div className="w-full max-w-[500px] bg-pure-white border border-border-light rounded-xl p-6 sm:p-8 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6">
              <h2 className="font-headline-lg text-headline-lg text-primary">
                {formMode === 'add' ? 'Tambah Produk Baru' : 'Edit Detail Produk'}
              </h2>
              <p className="font-body-md text-body-md text-secondary text-sm">Perbarui data sistem inventaris toko.</p>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-1 text-xs">Nama Produk</label>
                <input
                  type="text"
                  required
                  className="w-full bg-surface-container-low border-none rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:bg-surface-container"
                  placeholder="cth: KONTUR LOUNGE"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-1 text-xs">Deskripsi / Spesifikasi</label>
                <input
                  type="text"
                  required
                  className="w-full bg-surface-container-low border-none rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:bg-surface-container"
                  placeholder="cth: Seri 04 / Serat Karbon & Wol"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-label-md text-label-md text-on-surface-variant mb-1 text-xs">Kategori</label>
                  <select
                    className="w-full bg-surface-container-low border-none rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:bg-surface-container"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                  >
                    <option value="furniture">Furniture</option>
                    <option value="electronics">Elektronik</option>
                  </select>
                </div>
                <div>
                  <label className="block font-label-md text-label-md text-on-surface-variant mb-1 text-xs">Sub-Kategori</label>
                  <select
                    className="w-full bg-surface-container-low border-none rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:bg-surface-container"
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-label-md text-label-md text-on-surface-variant mb-1 text-xs">Satuan</label>
                  <select
                    className="w-full bg-surface-container-low border-none rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:bg-surface-container"
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                  >
                    <option value="Unit">Unit</option>
                    <option value="Pcs">Pcs</option>
                    <option value="Set">Set</option>
                  </select>
                </div>
                <div>
                  <label className="block font-label-md text-label-md text-on-surface-variant mb-1 text-xs">Tag Kategori</label>
                  <select
                    className="w-full bg-surface-container-low border-none rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:bg-surface-container"
                    value={formArrivalType}
                    onChange={(e) => setFormArrivalType(e.target.value as any)}
                  >
                    <option value="">Tidak ada</option>
                    <option value="BARANG BARU">Barang Baru</option>
                    <option value="EKSKLUSIF">Eksklusif</option>
                    <option value="PRE-ORDER">Pre-Order</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-label-md text-label-md text-on-surface-variant mb-1 text-xs">Harga Dasar (Rp)</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-surface-container-low border-none rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:bg-surface-container"
                    placeholder="cth: 5.000.000"
                    value={formPrice}
                    onChange={(e) => setFormPrice(formatRupiahInput(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block font-label-md text-label-md text-on-surface-variant mb-1 text-xs">Diskon (Rp)</label>
                  <input
                    type="text"
                    className="w-full bg-surface-container-low border-none rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:bg-surface-container"
                    placeholder="cth: 500.000"
                    value={formDiscount}
                    onChange={(e) => setFormDiscount(formatRupiahInput(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-label-md text-label-md text-on-surface-variant mb-1 text-xs">Jumlah Stok</label>
                  <input
                    type="number"
                    required
                    min="0"
                    className="w-full bg-surface-container-low border-none rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:bg-surface-container"
                    placeholder="cth: 10"
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-1 text-xs">URL Foto Produk atau Unggah File</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 bg-surface-container-low border-none rounded-lg px-4 py-2.5 text-xs focus:ring-1 focus:ring-primary focus:bg-surface-container"
                    placeholder="Masukkan URL foto..."
                    value={formImage}
                    onChange={(e) => setFormImage(e.target.value)}
                  />
                  <label className="cursor-pointer bg-primary text-pure-white px-3 flex items-center justify-center rounded-lg text-[10px] uppercase font-bold hover:bg-opacity-80 shrink-0">
                    Unggah
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                </div>
                {formImage && (
                  <div className="mt-2 relative inline-block border border-border-light rounded-sm overflow-hidden">
                    <img src={formImage} className="max-h-20 object-cover" alt="preview" />
                    <button type="button" onClick={() => setFormImage('')} className="absolute top-1 right-1 bg-primary text-pure-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]">✕</button>
                  </div>
                )}
              </div>

              <div className="flex gap-4 pt-2">
                <button type="button" onClick={() => setIsFormOpen(false)} className="flex-1 py-3 border border-border-light text-secondary font-button text-xs uppercase rounded-sm hover:border-primary transition-all">
                  Batal
                </button>
                <button type="submit" className="flex-grow py-3 bg-primary text-pure-white font-button text-xs uppercase rounded-sm hover:bg-opacity-90 transition-all">
                  Simpan Produk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface/90 backdrop-blur-md" onClick={() => setDeleteConfirmId(null)}>
          <div className="w-full max-w-[360px] bg-pure-white border border-border-light rounded-xl p-6 sm:p-8 shadow-xl text-center" onClick={(e) => e.stopPropagation()}>
            <span className="material-symbols-outlined text-[40px] text-error mb-2">delete_forever</span>
            <h3 className="font-headline-md text-headline-md text-primary mb-2 text-base">Konfirmasi Hapus</h3>
            <p className="font-body-md text-body-md text-secondary text-sm mb-6">Apakah Anda yakin ingin menghapus produk ini? Tindakan ini bersifat permanen.</p>
            <div className="flex gap-4">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-2.5 border border-border-light text-secondary font-button text-xs uppercase rounded-sm hover:border-primary transition-all">
                Batal
              </button>
              <button onClick={() => deleteProduct(deleteConfirmId)} className="flex-grow py-2.5 bg-error text-pure-white font-button text-xs uppercase rounded-sm hover:bg-opacity-90 transition-all">
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST NOTIFICATION ── */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-primary text-pure-white px-5 py-3 rounded-sm shadow-xl font-bold uppercase tracking-widest text-[10px] z-50 flex items-center gap-2 border border-border-light">
          <span className="material-symbols-outlined text-sm">check_circle</span>
          {toastMsg}
        </div>
      )}

    </div>
  );
}
