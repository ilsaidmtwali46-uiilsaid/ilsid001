Screens.inventory = {
  q:'', low:false,
  $(id){ return document.getElementById(id); },
  isLow(p){ return (Number(p.qty) || 0) <= (Number(p.min) || 0); },

  render(el){
    el.innerHTML = `<div class="box" id="stats"></div>
      <button class="btn ok" id="new">➕ صنف جديد</button>
      <button class="btn warn" id="lowBtn"></button>
      <input class="inp" id="q" placeholder="🔍 اكتب اسم الصنف هنا" value="${DB.esc(this.q)}">
      <div class="grid" id="grid"></div>`;
    this.$('new').onclick = () => this.form(null);
    this.$('lowBtn').onclick = () => { this.low = !this.low; this.draw(); };
    this.$('q').oninput = e => { this.q = e.target.value; this.draw(); };
    this.$('grid').onclick = e => { const c = e.target.closest('.card'); if (c) this.form(DB.getProduct(c.dataset.id)); };
    this.draw();
  },

  draw(){
    const all = DB.list('products'), q = this.q.trim().toLowerCase();
    const lows = all.filter(p => this.isLow(p)).length;
    const value = DB.round(all.reduce((s,p) => s + (p.buy || 0) * (p.qty || 0), 0));
    this.$('stats').innerHTML = `<div class="big">📦 عدد الأصناف: ${all.length}</div>
      <div class="big" style="color:var(--warn)">⚠️ أصناف قاربت على النفاذ: ${lows}</div>
      <div class="big">💰 قيمة المخزون: ${DB.money(value)}</div>`;
    this.$('lowBtn').textContent = this.low ? '📦 عرض الكل' : '⚠️ عرض الناقص';
    const list = all.filter(p => (!this.low || this.isLow(p)) &&
      (!q || p.name.toLowerCase().includes(q) || String(p.code).toLowerCase().includes(q)));
    this.$('grid').innerHTML = list.length ? list.map(p => UI.card(p)).join('') : '<p class="big">لا توجد أصناف</p>';
  },

  form(p){
    const isNew = !p;
    const d = p ? Object.assign({}, p) : { code: DB.generateProductCode(), name:'', img:'', buy:'', price:'', qty:'', min:5 };
    let img = d.img || '';
    const m = UI.modal(`<h2>${isNew ? '➕ صنف جديد' : '✏️ تعديل'}</h2>
      <div class="codebox">${DB.esc(d.code)}</div>
      <img id="pv" class="preview ${img ? '' : 'hide'}" ${img ? `src="${img}"` : ''} alt="">
      <div class="row"><button class="btn warn" id="shoot">📷 تصوير</button><button class="btn gray" id="pick">🖼️ اختيار</button></div>
      <input type="file" id="f1" accept="image/*" capture="environment" class="hide">
      <input type="file" id="f2" accept="image/*" class="hide">
      <label>اسم الصنف</label><input class="inp" id="pn" value="${DB.esc(d.name)}">
      <label>سعر الشراء</label><input class="inp" id="pb" type="number" inputmode="decimal" step="any" value="${d.buy}">
      <label>سعر البيع</label><input class="inp" id="ps" type="number" inputmode="decimal" step="any" value="${d.price}">
      <label>الكمية</label><input class="inp" id="pq" type="number" inputmode="decimal" step="any" value="${d.qty}">
      <label>أقل كمية</label><input class="inp" id="pm" type="number" inputmode="decimal" step="any" value="${d.min}">
      <button class="btn ok" id="ok">💾 حفظ</button>
      ${isNew ? '' : '<button class="btn bad" id="del">🗑️ حذف</button>'}
      <button class="btn gray" id="x">رجوع</button>`);
    const $ = id => m.querySelector('#' + id), v = id => $(id).value;
    $('shoot').onclick = () => $('f1').click();
    $('pick').onclick = () => $('f2').click();
    const onFile = async e => {
      const f = e.target.files[0]; if (!f) return;
      try {
        img = await DB.compressImage(f);
        $('pv').src = img;
        $('pv').classList.remove('hide');
      } catch(x){ UI.toast('تعذر قراءة الصورة', true); }
      e.target.value = '';
    };
    $('f1').onchange = onFile;
    $('f2').onchange = onFile;
    $('x').onclick = () => m.close();
    $('ok').onclick = () => {
      const name = v('pn').trim(), price = parseFloat(v('ps'));
      if (!name || isNaN(price)) return UI.toast('اكتب الاسم وسعر البيع', true);
      const data = {
        name, img,
        buy: parseFloat(v('pb')) || 0,
        price,
        qty: parseFloat(v('pq')) || 0,
        min: parseFloat(v('pm')) || 0
      };
      if (isNew) DB.addProduct(Object.assign({ code: d.code }, data));
      else DB.updateProduct(p.id, data);
      m.close(); this.draw();
      UI.toast('تم الحفظ ✔');
    };
    if (!isNew) $('del').onclick = async () => {
      const hasOps = DB.list('sales').some(s => s.items.some(i => i.productId === p.id)) ||
                     DB.list('purchases').some(s => s.items.some(i => i.productId === p.id));
      if (hasOps) return UI.toast('لا يمكن الحذف: يوجد حركات مسجلة', true);
      if (!await UI.confirm('حذف نهائي؟', 'نعم', 'رجوع')) return;
      DB.save('products', DB.list('products').filter(x => x.id !== p.id));
      m.close(); this.draw();
      UI.toast('تم الحذف');
    };
  }
};
