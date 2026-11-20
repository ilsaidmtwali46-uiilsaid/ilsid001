const Setup = {
  d: null, img: '', onDone: null,
  load(){
    this.d = DB.get(DB.K.draft, null) || { cash:'', products:[], suppliers:[], customers:[] };
  },
  save(){ return DB.set(DB.K.draft, this.d); },
  partyForm(k, title, balLabel){
    return `<div class="box"><h2>${title}</h2>
      <label>الاسم</label><input class="inp" id="${k}n">
      <label>رقم الهاتف</label><input class="inp" id="${k}p" type="tel">
      <label>العنوان</label><input class="inp" id="${k}a">
      <label>${balLabel}</label><input class="inp" id="${k}b" type="number" inputmode="decimal" step="any" value="0">
      <label>ملاحظات</label><input class="inp" id="${k}o">
      <button class="btn" id="${k}add">➕ إضافة</button><div id="${k}list"></div></div>`;
  },
  render(el, onDone){
    this.load();
    this.img = '';
    this.onDone = onDone;
    el.innerHTML = `
      <h1>🏪 تجهيز المحل لأول مرة</h1>
      <div class="box"><h2>1) 💰 فلوس الخزنة الآن</h2>
        <input class="inp" id="cash" type="number" inputmode="decimal" step="any" placeholder="0" value="${DB.esc(this.d.cash)}"></div>
      <div class="box"><h2>2) 📦 الأصناف الموجودة</h2>
        <div class="codebox" id="pcode"></div>
        <img id="pprev" class="preview hide" alt="">
        <div class="row">
          <button class="btn warn" id="shoot">📷 تصوير</button>
          <button class="btn gray" id="pick">🖼️ اختيار صورة</button>
        </div>
        <input type="file" id="f1" accept="image/*" capture="environment" class="hide">
        <input type="file" id="f2" accept="image/*" class="hide">
        <label>اسم الصنف</label><input class="inp" id="pn">
        <label>سعر الشراء</label><input class="inp" id="pb" type="number" inputmode="decimal" step="any">
        <label>سعر البيع</label><input class="inp" id="ps" type="number" inputmode="decimal" step="any">
        <label>الكمية</label><input class="inp" id="pq" type="number" inputmode="decimal" step="any">
        <label>أقل كمية</label><input class="inp" id="pm" type="number" inputmode="decimal" step="any" value="5">
        <button class="btn ok" id="padd">➕ إضافة الصنف</button>
        <div class="grid" id="plist"></div></div>
      ${this.partyForm('supplier','3) 🚚 الموردين','المبلغ اللي علينا له')}
      ${this.partyForm('customer','4) 👥 العملاء','المبلغ اللي عليه لنا')}
      <button class="btn ok" id="finish">✅ اعتماد البيانات وبدء العمل</button>`;

    const $ = id => el.querySelector('#' + id);
    $('cash').oninput = e => { this.d.cash = e.target.value; this.save(); };
    $('shoot').onclick = () => $('f1').click();
    $('pick').onclick = () => $('f2').click();
    const onFile = async e => {
      const f = e.target.files[0]; if (!f) return;
      try {
        this.img = await DB.compressImage(f);
        $('pprev').src = this.img;
        $('pprev').classList.remove('hide');
      } catch(x){ UI.toast('تعذر قراءة الصورة', true); }
      e.target.value = '';
    };
    $('f1').onchange = onFile;
    $('f2').onchange = onFile;

    const showCode = () => { $('pcode').textContent = DB.generateProductCode(this.d.products); };
    const drawProducts = () => {
      $('plist').innerHTML = this.d.products.map(p => UI.card(p, true)).join('');
      $('plist').querySelectorAll('[data-del]').forEach(b => b.onclick = e => {
        e.stopPropagation();
        this.d.products = this.d.products.filter(p => p.id !== b.dataset.del);
        this.save(); drawProducts(); showCode();
      });
    };
    showCode(); drawProducts();

    $('padd').onclick = () => {
      const name = $('pn').value.trim(), price = parseFloat($('ps').value);
      if (!name || isNaN(price)) return UI.toast('اكتب اسم الصنف وسعر البيع', true);
      this.d.products.push({
        id: DB.newId('p'),
        code: DB.generateProductCode(this.d.products),
        name, img: this.img,
        buy: parseFloat($('pb').value) || 0,
        price,
        qty: parseFloat($('pq').value) || 0,
        min: parseFloat($('pm').value) || 0
      });
      if (!this.save()){ this.d.products.pop(); return; }
      this.img = '';
      $('pprev').classList.add('hide');
      ['pn','pb','ps','pq'].forEach(i => $(i).value = '');
      $('pm').value = 5;
      drawProducts(); showCode();
      UI.toast('تمت الإضافة ✔');
    };

    [['supplier','suppliers'],['customer','customers']].forEach(([k, arr]) => {
      const draw = () => {
        $(k + 'list').innerHTML = this.d[arr].map(x => `<div class="line"><div class="n">${DB.esc(x.name)} — ${DB.money(x.balance)}</div>
          <button data-del="${x.id}" style="color:var(--bad)">✖</button></div>`).join('');
        $(k + 'list').querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
          this.d[arr] = this.d[arr].filter(x => x.id !== b.dataset.del);
          this.save(); draw();
        });
      };
      draw();
      $(k + 'add').onclick = () => {
        const name = $(k + 'n').value.trim();
        if (!name) return UI.toast('اكتب الاسم', true);
        this.d[arr].push({
          id: DB.newId(k[0]),
          name,
          phone: $(k + 'p').value.trim(),
          address: $(k + 'a').value.trim(),
          balance: parseFloat($(k + 'b').value) || 0,
          notes: $(k + 'o').value.trim()
        });
        this.save();
        ['n','p','a','o'].forEach(s => $(k + s).value = '');
        $(k + 'b').value = 0;
        draw();
        UI.toast('تمت الإضافة ✔');
      };
    });

    $('finish').onclick = async () => {
      if (!this.d.products.length){
        if (!await UI.confirm('لم تُضف أي أصناف. هل تريد المتابعة على أي حال؟', 'نعم', 'رجوع')) return;
      }
      const ok = await UI.confirm('اعتماد البيانات وبدء العمل؟', 'نعم، ابدأ', 'رجوع');
      if (!ok) return;
      DB.setCash(parseFloat(this.d.cash) || 0);
      DB.save('products', this.d.products);
      DB.save('suppliers', this.d.suppliers);
      DB.save('customers', this.d.customers);
      DB.finishSetup();
      this.onDone();
    };
  }
};