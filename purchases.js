Screens.purchases = {
  cart:{}, q:'', ret:false, supplierId:null, paid:null, invoiceImg:'',
  $(id){ return document.getElementById(id); },
  total(){
    return DB.round(Object.keys(this.cart).reduce((s,id) => s + this.cart[id].qty * this.cart[id].cost, 0));
  },
  render(el){
    el.innerHTML = `<button class="btn warn" id="retBtn"></button>
      <div class="sale"><section>
        <input class="inp" id="q" placeholder="🔍 اكتب اسم الصنف هنا" value="${DB.esc(this.q)}">
        <div class="grid" id="grid"></div>
        <div class="box" style="margin-top:14px">
          <h2>🧾 صورة الفاتورة</h2>
          <img id="invPrev" class="preview ${this.invoiceImg ? '' : 'hide'}" ${this.invoiceImg ? `src="${this.invoiceImg}"` : ''} alt="">
          <div class="row">
            <button class="btn warn" id="invShoot">📷 تصوير</button>
            <button class="btn gray" id="invPick">🖼️ اختيار</button>
          </div>
          <input type="file" id="invF1" accept="image/*" capture="environment" class="hide">
          <input type="file" id="invF2" accept="image/*" class="hide">
          <button class="btn gray" id="viewInvs">📂 الفواتير المحفوظة</button>
        </div>
      </section>
      <aside class="cart" id="cart"></aside></div>`;

    this.$('retBtn').onclick = () => { this.ret = !this.ret; this.cart = {}; this.paid = null; this.drawCart(); };
    this.$('q').oninput = e => { this.q = e.target.value; this.drawGrid(); };
    this.$('grid').onclick = e => { const c = e.target.closest('.card'); if (c) this.add(c.dataset.id); };

    this.$('invShoot').onclick = () => this.$('invF1').click();
    this.$('invPick').onclick = () => this.$('invF2').click();
    const onInv = async e => {
      const f = e.target.files[0]; if (!f) return;
      try {
        this.invoiceImg = await DB.compressImage(f, 640, 0.72);
        this.$('invPrev').src = this.invoiceImg;
        this.$('invPrev').classList.remove('hide');
        UI.toast('تم إرفاق الفاتورة ✔');
      } catch(x){ UI.toast('تعذر قراءة الصورة', true); }
      e.target.value = '';
    };
    this.$('invF1').onchange = onInv;
    this.$('invF2').onchange = onInv;
    this.$('viewInvs').onclick = () => this.showInvoices();

    const cart = this.$('cart');
    cart.onclick = e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const a = b.dataset.act;
      if (a === 'del'){ delete this.cart[b.dataset.id]; this.drawCart(); }
      else if (a === 'sup') this.pickSupplier();
      else if (a === 'save') this.save();
    };
    cart.oninput = e => {
      const t = e.target;
      if (t.id === 'paid') this.paid = t.value === '' ? null : (parseFloat(t.value) || 0);
      else if (t.dataset.f) this.cart[t.dataset.id][t.dataset.f] = parseFloat(t.value) || 0;
      this.drawTotals();
    };
    this.drawGrid();
    this.drawCart();
  },

  drawGrid(){
    const q = this.q.trim().toLowerCase();
    const list = DB.list('products').filter(p => !q || p.name.toLowerCase().includes(q) || String(p.code).toLowerCase().includes(q));
    this.$('grid').innerHTML = list.length ? list.map(p => UI.card(p)).join('') : '<p class="big">لا توجد أصناف. أضفها من المخزون</p>';
  },

  add(id){
    const p = DB.getProduct(id); if (!p) return;
    const cur = this.cart[id];
    if (this.ret && (cur ? cur.qty : 0) + 1 > p.qty) return UI.toast('الكمية لا تكفي للمرتجع', true);
    if (cur) cur.qty = DB.round(cur.qty + 1);
    else this.cart[id] = { qty:1, cost:p.buy || 0 };
    this.drawCart();
  },

  supInfo(){ return DB.list('suppliers').find(x => x.id === this.supplierId) || null; },
  supName(){ const s = this.supInfo(); return s ? s.name : 'اضغط لاختيار المورد'; },

  drawCart(){
    const r = this.ret, ids = Object.keys(this.cart), s = this.supInfo();
    this.$('retBtn').textContent = r ? '📥 رجوع للشراء العادي' : '↩️ مرتجع شراء';
    const rows = ids.map(id => {
      const p = DB.getProduct(id), c = this.cart[id];
      return `<div class="line" style="flex-wrap:wrap"><div class="n">${DB.esc(p.name)}</div>
        <button data-act="del" data-id="${id}" style="color:var(--bad)">✖</button>
        <div class="row" style="width:100%">
          <div><label>الكمية</label><input class="inp" type="number" inputmode="decimal" step="any" data-id="${id}" data-f="qty" value="${c.qty}"></div>
          <div><label>سعر الواحد</label><input class="inp" type="number" inputmode="decimal" step="any" data-id="${id}" data-f="cost" value="${c.cost}"></div>
        </div></div>`;
    }).join('');
    const cart = this.$('cart');
    cart.className = 'cart' + (r ? ' ret' : '');
    cart.innerHTML = `<h2>${r ? '↩️ مرتجع شراء' : '📥 فاتورة شراء'}</h2>
      ${rows || '<p class="big">اضغط على صورة الصنف لإضافته</p>'}
      <div class="total" id="tot"></div>
      <button class="btn gray" data-act="sup" id="supBtn">🚚 ${DB.esc(this.supName())}</button>
      ${s ? `<p class="big" style="font-size:.95rem">📞 ${DB.esc(s.phone || '—')} | 📍 ${DB.esc(s.address || '—')}</p>` : ''}
      <label>${r ? 'المبلغ المستلم من المورد' : 'المبلغ المدفوع الآن'}</label>
      <input class="inp" id="paid" type="number" inputmode="decimal" step="any">
      <div class="big" id="rem"></div>
      <button class="btn ${r ? 'warn' : 'ok'}" data-act="save">✅ ${r ? 'حفظ المرتجع' : 'حفظ الشراء'}</button>`;
    this.drawTotals();
  },

  drawTotals(){
    const t = this.total(), paid = this.paid === null ? t : this.paid, rem = DB.round(t - paid);
    this.$('tot').textContent = DB.money(t);
    if (this.paid === null) this.$('paid').value = t || '';
    this.$('rem').textContent = (this.ret ? 'يُخصم من حساب المورد: ' : 'الباقي للمورد: ') + DB.money(rem);
  },

  pickSupplier(){
    const sups = DB.list('suppliers');
    const m = UI.modal(`<h2>اختر المورد</h2>
      ${sups.map(s => `<button class="btn" data-s="${s.id}">${DB.esc(s.name)}<br><small>له علينا: ${DB.money(s.balance)} ${s.phone ? '— ' + DB.esc(s.phone) : ''}</small></button>`).join('')}
      <button class="btn gray" data-s="">بدون مورد (نقدي)</button>
      <h2>➕ مورد جديد</h2>
      <input class="inp" id="sn" placeholder="الاسم">
      <input class="inp" id="sp" type="tel" placeholder="رقم الهاتف">
      <input class="inp" id="sa" placeholder="العنوان">
      <button class="btn ok" id="sadd">حفظ واختيار</button>
      <button class="btn gray" id="sx">رجوع</button>`);
    const pick = id => { this.supplierId = id || null; m.close(); this.drawCart(); };
    m.querySelectorAll('[data-s]').forEach(b => b.onclick = () => pick(b.dataset.s));
    m.querySelector('#sx').onclick = () => m.close();
    m.querySelector('#sadd').onclick = () => {
      const n = m.querySelector('#sn').value.trim();
      if (!n) return UI.toast('اكتب اسم المورد', true);
      pick(DB.addSupplier({
        name:n,
        phone:m.querySelector('#sp').value.trim(),
        address:m.querySelector('#sa').value.trim(),
        balance:0, notes:''
      }).id);
    };
  },

  showInvoices(){
    const sups = DB.list('suppliers');
    const list = DB.list('purchases').filter(p => p.invoiceImg).slice().reverse();
    const body = list.length ? list.map(p => {
      const s = sups.find(x => x.id === p.supplierId);
      const name = (s && s.name) || p.supplierName || 'مورد عام';
      const phone = (s && s.phone) || p.supplierPhone || '—';
      const addr = (s && s.address) || p.supplierAddress || '—';
      return `<div class="box">
        <div class="big">🧾 ${DB.esc(name)} — ${DB.money(p.total)}</div>
        <div>📞 ${DB.esc(phone)} | 📍 ${DB.esc(addr)}</div>
        <div style="font-size:.85rem;opacity:.8">${new Date(p.date).toLocaleString('ar-EG')}</div>
        <img src="${p.invoiceImg}" style="width:100%;max-height:260px;object-fit:contain;border-radius:10px;margin-top:8px" alt="">
      </div>`;
    }).join('') : '<p class="big">لا توجد فواتير مصوّرة محفوظة</p>';
    const m = UI.modal(`<h2>📂 الفواتير المصوّرة</h2>${body}<button class="btn gray" id="x">رجوع</button>`);
    m.querySelector('#x').onclick = () => m.close();
  },

  save(){
    const its = Object.keys(this.cart).map(id => ({ id, qty:this.cart[id].qty, cost:this.cart[id].cost }));
    if (!its.length) return UI.toast('الفاتورة فارغة', true);
    if (its.some(i => !(i.qty > 0))) return UI.toast('راجع الكميات', true);
    if (its.some(i => !(i.cost >= 0))) return UI.toast('راجع الأسعار', true);
    const t = this.total(), paid = DB.round(this.paid === null ? t : this.paid);
    if (paid < 0) return UI.toast('المبلغ لا يمكن أن يكون سالبًا', true);
    if (paid > t) return UI.toast('المبلغ أكبر من إجمالي الفاتورة', true);
    if (paid < t && !this.supplierId) return UI.toast('اختر المورد لتسجيل الباقي عليه', true);
    if (this.ret && its.some(i => {
      const p = DB.getProduct(i.id);
      return !p || i.qty > p.qty;
    })) return UI.toast('كمية المرتجع أكبر من الموجود', true);

    const s = this.supInfo();
    const meta = {
      invoiceImg: this.invoiceImg || '',
      supplierName: s ? s.name : '',
      supplierPhone: s ? s.phone : '',
      supplierAddress: s ? s.address : ''
    };
    const r = this.ret
      ? DB.returnPurchase(this.supplierId, its, paid, meta)
      : DB.completePurchase(this.supplierId, its, paid, meta);
    if (r.error) return UI.toast(r.error, true);

    UI.toast(this.ret ? 'تم حفظ المرتجع ✔' : 'تم حفظ الشراء ✔');
    this.cart = {}; this.supplierId = null; this.paid = null; this.invoiceImg = '';
    this.render(document.getElementById('app'));
  }
};
