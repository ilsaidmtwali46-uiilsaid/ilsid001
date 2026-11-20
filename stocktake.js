Screens.stocktake = {
  q:'', counts:{},
  $(id){ return document.getElementById(id); },

  render(el){
    el.innerHTML = `<h1>📋 الجرد</h1>
      <p class="big">اكتب الكمية الموجودة فعلاً، واترك الخانة فارغة إذا لم تعدّ الصنف</p>
      <input class="inp" id="q" placeholder="🔍 اكتب اسم الصنف" value="${DB.esc(this.q)}">
      <div id="rows"></div>
      <div class="box big" id="sum"></div>
      <button class="btn ok" id="apply">✅ اعتماد الجرد</button>
      <button class="btn gray" id="reset">مسح الأرقام</button>`;
    this.$('q').oninput = e => { this.q = e.target.value; this.draw(); };
    this.$('rows').oninput = e => {
      const t = e.target;
      if (!t.dataset.id) return;
      this.counts[t.dataset.id] = t.value;
      this.upd(DB.getProduct(t.dataset.id));
      this.sum();
    };
    this.$('apply').onclick = () => this.apply();
    this.$('reset').onclick = () => { this.counts = {}; this.draw(); };
    this.draw();
  },

  diff(p){
    const c = this.counts[p.id];
    if (c === undefined || c === '' || isNaN(parseFloat(c))) return null;
    return DB.round(parseFloat(c) - (Number(p.qty) || 0));
  },

  upd(p){
    const d = this.diff(p), el = this.$('d' + p.id);
    if (!el) return;
    el.textContent = d === null ? '' : d === 0 ? '✔ مطابق' : d > 0 ? '⬆️ زيادة ' + d : '⬇️ عجز ' + (-d);
    el.style.color = d === null || d === 0 ? 'var(--ok)' : d > 0 ? 'var(--blue)' : 'var(--bad)';
  },

  draw(){
    const q = this.q.trim().toLowerCase();
    const list = DB.list('products').filter(p => !q || p.name.toLowerCase().includes(q) || String(p.code).toLowerCase().includes(q));
    this.$('rows').innerHTML = list.map(p => `<div class="line" style="flex-wrap:wrap">
      ${p.img ? `<img src="${p.img}" style="width:56px;height:56px;object-fit:cover;border-radius:10px" alt="">` : '<span style="font-size:2rem">📦</span>'}
      <div class="n">${DB.esc(p.name)}<br><small>في السجل: ${p.qty}</small></div>
      <input class="inp" style="width:130px;margin:0" type="number" inputmode="decimal" step="any" data-id="${p.id}" value="${DB.esc(this.counts[p.id] === undefined ? '' : this.counts[p.id])}">
      <div class="big" id="d${p.id}" style="width:100%"></div></div>`).join('') || '<p class="big">لا توجد أصناف</p>';
    list.forEach(p => this.upd(p));
    this.sum();
  },

  changed(){
    return DB.list('products').filter(p => { const d = this.diff(p); return d !== null && d !== 0; });
  },

  sum(){
    const ch = this.changed();
    const val = DB.round(ch.reduce((s,p) => s + this.diff(p) * (p.buy || 0), 0));
    this.$('sum').innerHTML = `أصناف بها فرق: ${ch.length}<br>فرق القيمة (بسعر الشراء): ${DB.money(val)}`;
  },

  async apply(){
    const ch = this.changed();
    if (ch.some(p => parseFloat(this.counts[p.id]) < 0)) return UI.toast('لا يمكن كتابة رقم بالسالب', true);
    if (!ch.length) return UI.toast('لا توجد فروق', true);
    if (!await UI.confirm(`سيتم تعديل ${ch.length} صنف حسب الجرد. متأكد؟`, 'نعم', 'رجوع')) return;
    const log = DB.get(DB.K.stocktakes, []);
    log.push({
      id: DB.newId('st'),
      date: new Date().toISOString(),
      items: ch.map(p => ({
        productId: p.id, name: p.name,
        before: p.qty, after: parseFloat(this.counts[p.id]),
        cost: p.buy || 0,
        diffValue: DB.round(this.diff(p) * (p.buy || 0))
      })),
      totalDiffValue: DB.round(ch.reduce((s,p) => s + this.diff(p) * (p.buy || 0), 0))
    });
    DB.set(DB.K.stocktakes, log);
    ch.forEach(p => DB.updateProduct(p.id, { qty: parseFloat(this.counts[p.id]) }));
    this.counts = {};
    this.draw();
    UI.toast('تم اعتماد الجرد ✔');
  }
};
