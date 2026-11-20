const DB = {
  K: {
    setup:'gs_setup', cash:'gs_cash', products:'gs_products',
    sales:'gs_sales', purchases:'gs_purchases',
    suppliers:'gs_suppliers', customers:'gs_customers',
    draft:'gs_draft', payments:'gs_payments', stocktakes:'gs_stocktakes',
    theme:'gs_theme', license:'gs_license', licenseCheck:'gs_license_check',
    device:'gs_device', lastBackup:'gs_last_backup', seenAt:'gs_seen_at'
  },
  get(k, d){
    try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); }
    catch(e){ return d; }
  },
  set(k, v){
    try {
      localStorage.setItem(k, JSON.stringify(v));
      this.checkStorageDebounced();
      return true;
    } catch(e){
      alert('الذاكرة ممتلئة! قم بنسخة احتياطية واحذف بعض الصور.');
      return false;
    }
  },
  list(name){ return this.get(this.K[name], []); },
  save(name, arr){ return this.set(this.K[name], arr); },
  newId(p){ return p + Date.now().toString(36) + Math.random().toString(36).slice(2,6); },
  esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  },
  round(n){ return Math.round((Number(n)||0)*100)/100; },
  money(n){
    const v = this.round(n);
    return (Number.isInteger(v) ? v : v.toFixed(2).replace(/0$/,'')) + ' جنيه';
  },

  partyName(key, id, fallback){
    if (!id) return fallback || '—';
    const x = this.list(key).find(i => i.id === id);
    return (x && x.name) ? x.name : (fallback || '—');
  },

  storageSize(){
    let total = 0;
    for (let i = 0; i < localStorage.length; i++){
      const k = localStorage.key(i);
      total += k.length + (localStorage.getItem(k) || '').length;
    }
    return total;
  },
  checkStorage(){
    const size = this.storageSize() * 2;
    const limit = 5 * 1024 * 1024;
    if (size > limit * 0.85 && !this._warned){
      this._warned = true;
      alert('⚠️ تنبيه: مساحة التخزين تقترب من الامتلاء (' + Math.round(size/1024) + ' كيلوبايت).\nيُنصح بنسخة احتياطية ثم حذف الصور القديمة.');
    }
  },
  checkStorageDebounced(){
    clearTimeout(this._stT);
    this._stT = setTimeout(() => this.checkStorage(), 400);
  },

  exportBackup(){
    const data = {};
    for (let i = 0; i < localStorage.length; i++){
      const k = localStorage.key(i);
      if (k.startsWith('gs_') && k !== this.K.license && k !== this.K.device){
        try { data[k] = JSON.parse(localStorage.getItem(k)); }
        catch(e){ data[k] = localStorage.getItem(k); }
      }
    }
    const blob = new Blob([JSON.stringify({v:1, at:new Date().toISOString(), data}, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    const stamp = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    a.href = url;
    a.download = 'نسخة-احتياطية-بقالة-' + stamp + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    this.set(this.K.lastBackup, new Date().toISOString());
  },
  async importBackup(file){
    const text = await file.text();
    const obj = JSON.parse(text);
    if (!obj || !obj.data || obj.v !== 1) throw new Error('ملف غير صالح');
    if (!await UI.confirm('سيتم استبدال كل البيانات الحالية. متأكد؟', 'نعم، استعد', 'إلغاء')) return false;
    Object.keys(obj.data).forEach(k => {
      try { localStorage.setItem(k, JSON.stringify(obj.data[k])); }
      catch(e){ console.error('فشل استعادة', k, e); }
    });
    return true;
  },

  isSetupDone(){ return this.get(this.K.setup, false) === true; },
  finishSetup(){ this.set(this.K.setup, true); localStorage.removeItem(this.K.draft); },

  getCash(){ return Number(this.get(this.K.cash, 0)) || 0; },
  setCash(n){ this.set(this.K.cash, Number(n) || 0); },
  addCash(n){ this.setCash(this.round(this.getCash() + n)); },

  generateProductCode(list){
    let max = 1000;
    (list || this.list('products')).forEach(p => {
      const n = parseInt(String(p.code).replace(/\D/g,''), 10);
      if (n > max) max = n;
    });
    return 'PRD-' + (max + 1);
  },
  getProduct(id){ return this.list('products').find(p => p.id === id); },
  addProduct(p){
    const all = this.list('products');
    p.id = p.id || this.newId('p');
    p.code = p.code || this.generateProductCode(all);
    all.push(p); this.save('products', all); return p;
  },
  updateProduct(id, changes){
    const all = this.list('products'), i = all.findIndex(p => p.id === id);
    if (i < 0) return null;
    Object.assign(all[i], changes);
    this.save('products', all); return all[i];
  },

  addSupplier(s){
    const a = this.list('suppliers');
    s.id = s.id || this.newId('s');
    a.push(s); this.save('suppliers', a); return s;
  },
  addCustomer(c){
    const a = this.list('customers');
    c.id = c.id || this.newId('c');
    a.push(c); this.save('customers', a); return c;
  },
  addBalance(name, id, delta){
    const a = this.list(name), x = a.find(i => i.id === id);
    if (!x) return false;
    x.balance = this.round((Number(x.balance) || 0) + delta);
    this.save(name, a);
    return true;
  },
  partyHasOps(key, id){
    const sales = key === 'customers' && this.list('sales').some(s => s.customerId === id);
    const purs = key === 'suppliers' && this.list('purchases').some(p => p.supplierId === id);
    const pays = this.get(this.K.payments, []).some(p => p.party === id && p.kind === key);
    return !!(sales || purs || pays);
  },

  completeSale(items, type, customerId){
    const prods = this.list('products');
    let total = 0;
    const lines = [], missing = [];
    items.forEach(it => {
      const p = prods.find(x => x.id === it.id);
      if (!p) { missing.push(it.id); return; }
      p.qty = this.round((Number(p.qty) || 0) - it.qty);
      total += p.price * it.qty;
      lines.push({ productId:p.id, code:p.code, name:p.name, qty:it.qty, price:p.price, cost:p.buy });
    });
    if (missing.length) return { error: 'أصناف غير موجودة في المخزون', missing };
    this.save('products', prods);
    total = this.round(total);
    if (type === 'cash') this.addCash(total);
    else if (!this.addBalance('customers', customerId, total)) return { error: 'العميل غير موجود' };
    const sales = this.list('sales');
    const sale = { id:this.newId('sale'), date:new Date().toISOString(), type, customerId:customerId||null, items:lines, total };
    sales.push(sale); this.save('sales', sales);
    return { sale };
  },
  returnSale(items, type, customerId){
    const prods = this.list('products');
    let total = 0;
    const lines = [], missing = [];
    items.forEach(it => {
      const p = prods.find(x => x.id === it.id);
      if (!p) { missing.push(it.id); return; }
      p.qty = this.round((Number(p.qty) || 0) + it.qty);
      total += p.price * it.qty;
      lines.push({ productId:p.id, code:p.code, name:p.name, qty:it.qty, price:p.price, cost:p.buy });
    });
    if (missing.length) return { error: 'أصناف غير موجودة في المخزون', missing };
    total = this.round(total);
    this.save('products', prods);
    if (type === 'cash') this.addCash(-total);
    else if (!this.addBalance('customers', customerId, -total)) return { error: 'العميل غير موجود' };
    const a = this.list('sales');
    const r = { id:this.newId('ret'), date:new Date().toISOString(), isReturn:true, type, customerId:customerId||null, items:lines, total };
    a.push(r); this.save('sales', a);
    return { sale: r };
  },

  completePurchase(supplierId, items, paid, meta){
    const prods = this.list('products');
    let total = 0;
    const lines = [], missing = [];
    items.forEach(it => {
      const p = prods.find(x => x.id === it.id);
      if (!p) { missing.push(it.id); return; }
      const oldQty = Number(p.qty) || 0;
      const newQty = oldQty + it.qty;
      p.qty = this.round(newQty);
      p.buy = this.round(((oldQty * (Number(p.buy) || 0)) + (it.qty * it.cost)) / (newQty || 1));
      total += it.cost * it.qty;
      lines.push({ productId:p.id, name:p.name, qty:it.qty, cost:it.cost });
    });
    if (missing.length) return { error: 'أصناف غير موجودة في المخزون', missing };
    this.save('products', prods);
    total = this.round(total);
    this.addCash(-paid);
    if (supplierId) this.addBalance('suppliers', supplierId, total - paid);
    const a = this.list('purchases');
    const pur = Object.assign({
      id:this.newId('pur'), date:new Date().toISOString(),
      supplierId:supplierId||null, items:lines, total, paid, received:0
    }, meta || {});
    a.push(pur); this.save('purchases', a);
    return { purchase: pur };
  },
  returnPurchase(supplierId, items, received, meta){
    const prods = this.list('products');
    let total = 0;
    const lines = [], missing = [];
    items.forEach(it => {
      const p = prods.find(x => x.id === it.id);
      if (!p) { missing.push(it.id); return; }
      p.qty = Math.max(0, this.round((Number(p.qty) || 0) - it.qty));
      total += it.cost * it.qty;
      lines.push({ productId:p.id, name:p.name, qty:it.qty, cost:it.cost });
    });
    if (missing.length) return { error: 'أصناف غير موجودة في المخزون', missing };
    total = this.round(total);
    this.save('products', prods);
    this.addCash(received);
    if (supplierId) this.addBalance('suppliers', supplierId, -(total - received));
    const a = this.list('purchases');
    const r = Object.assign({
      id:this.newId('pret'), date:new Date().toISOString(),
      isReturn:true, supplierId:supplierId||null, items:lines,
      total, received:Number(received)||0
    }, meta || {});
    a.push(r); this.save('purchases', a);
    return { purchase: r };
  },

  getTheme(){ return this.get(this.K.theme, { name:'sage' }); },
  setTheme(t){ this.set(this.K.theme, t); },

  compressImage(file, max=360, quality=0.7){
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = reject;
      fr.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const r = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * r);
          c.height = Math.round(img.height * r);
          const x = c.getContext('2d');
          x.fillStyle = '#fff';
          x.fillRect(0, 0, c.width, c.height);
          x.drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', quality));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }
};
