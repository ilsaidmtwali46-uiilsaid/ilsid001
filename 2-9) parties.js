window.makeParties = function(cfg){
  const $ = id => document.getElementById(id);
  return {
    q: '',
    all(){ return DB.list(cfg.key); },

    render(el){
      el.innerHTML = `<h1>${cfg.title}</h1>
        <button class="btn ok" id="new">➕ ${cfg.addLabel}</button>
        <input class="inp" id="q" placeholder="🔍 اكتب الاسم أو رقم الهاتف" value="${DB.esc(this.q)}">
        <div id="list"></div>`;
      $('new').onclick = () => this.form(null);
      $('q').oninput = e => { this.q = e.target.value; this.draw(); };
      $('list').onclick = e => { const b = e.target.closest('[data-id]'); if (b) this.detail(b.dataset.id); };
      this.draw();
    },

    draw(){
      const q = this.q.trim().toLowerCase(), all = this.all();
      const sum = DB.round(all.reduce((s, x) => s + (x.balance || 0), 0));
      const list = all.filter(x => !q || (x.name + ' ' + (x.phone || '')).toLowerCase().includes(q));
      $('list').innerHTML = `<div class="box big">${cfg.sumLabel}: ${DB.money(sum)}</div>` +
        (list.map(x => `<button class="btn" data-id="${x.id}" style="background:var(--${(x.balance || 0) > 0 ? 'warn' : 'ok'})">
          ${DB.esc(x.name)}<br><small>${cfg.balLabel}: ${DB.money(x.balance)}</small></button>`).join('') || '<p class="big">لا يوجد أحد بعد</p>');
    },

    ops(id){
      const rows = [];
      cfg.docs().filter(d => d[cfg.link] === id).forEach(d =>
        rows.push({ date: d.date, t: (d.isReturn ? '↩️ مرتجع ' : cfg.docLabel + ' ') + DB.money(d.total) }));
      DB.get(DB.K.payments, []).filter(p => p.party === id && p.kind === cfg.key).forEach(p =>
        rows.push({ date: p.date, t: '💵 ' + cfg.payDone + ' ' + DB.money(p.amount) }));
      rows.sort((a, b) => b.date.localeCompare(a.date));
      return rows.slice(0, 30).map(r => `<div class="line"><div class="n">${new Date(r.date).toLocaleDateString('ar-EG')}<br>${r.t}</div></div>`).join('') || '<p>لا توجد عمليات بعد</p>';
    },

    detail(id){
      const x = this.all().find(i => i.id === id);
      if (!x) return;
      const m = UI.modal(`<h2>${DB.esc(x.name)}</h2>
        <div class="total" style="font-size:2rem">${cfg.balLabel}: ${DB.money(x.balance)}</div>
        <p>${DB.esc(x.phone || '')} ${DB.esc(x.address || '')}<br>${DB.esc(x.notes || '')}</p>
        <button class="btn ok" id="pay">💵 ${cfg.payLabel}</button>
        ${x.phone ? `<a class="btn" style="display:block;text-align:center;text-decoration:none;padding-top:16px" href="tel:${DB.esc(x.phone)}">📞 اتصال</a>` : ''}
        <button class="btn gray" id="edit">✏️ تعديل</button>
        <h2>📜 كشف الحساب</h2>${this.ops(id)}
        <button class="btn gray" id="x">رجوع</button>`);
      m.querySelector('#x').onclick = () => m.close();
      m.querySelector('#edit').onclick = () => { m.close(); this.form(x); };
      m.querySelector('#pay').onclick = () => this.pay(x, m);
    },

    pay(x, m){
      const p = UI.modal(`<h2>${cfg.payLabel}</h2><p class="big">${cfg.balLabel}: ${DB.money(x.balance)}</p>
        <input class="inp" id="amt" type="number" inputmode="decimal" step="any" placeholder="المبلغ">
        <button class="btn ok" id="go">✅ تأكيد</button><button class="btn gray" id="no">رجوع</button>`);
      p.querySelector('#no').onclick = () => p.close();
      p.querySelector('#go').onclick = () => {
        const a = DB.round(parseFloat(p.querySelector('#amt').value));
        if (!(a > 0)) return UI.toast('اكتب المبلغ', true);
        // للعملاء: لا يزيد عن الرصيد. للموردين: يُسمح بدفعة مقدمة.
        if (cfg.cashSign === 1 && a > (x.balance || 0)) return UI.toast('المبلغ أكبر من الرصيد', true);
        if (!DB.addBalance(cfg.key, x.id, -a)) return UI.toast('تعذر تحديث الرصيد', true);
        DB.addCash(cfg.cashSign * a);
        const pays = DB.get(DB.K.payments, []);
        pays.push({ id: DB.newId('pay'), date:new Date().toISOString(), kind: cfg.key, party: x.id, amount: a });
        DB.set(DB.K.payments, pays);
        p.close(); m.close(); this.draw();
        UI.toast('تم التسجيل ✔');
      };
    },

    form(x){
      const n = !x, d = x || { name:'', phone:'', address:'', balance:0, notes:'' };
      const m = UI.modal(`<h2>${n ? '➕ ' + cfg.addLabel : '✏️ تعديل'}</h2>
        <label>الاسم</label><input class="inp" id="fn" value="${DB.esc(d.name)}">
        <label>رقم الهاتف</label><input class="inp" id="fp" type="tel" value="${DB.esc(d.phone)}">
        <label>العنوان</label><input class="inp" id="fa" value="${DB.esc(d.address)}">
        <label>${cfg.balLabel} (الرصيد)</label><input class="inp" id="fb" type="number" inputmode="decimal" step="any" value="${d.balance}">
        <label>ملاحظات</label><input class="inp" id="fo" value="${DB.esc(d.notes)}">
        <button class="btn ok" id="ok">💾 حفظ</button>
        ${n ? '' : '<button class="btn bad" id="del">🗑️ حذف</button>'}
        <button class="btn gray" id="x">رجوع</button>`);
      const v = id => m.querySelector('#' + id).value;
      m.querySelector('#x').onclick = () => m.close();
      m.querySelector('#ok').onclick = () => {
        const name = v('fn').trim();
        if (!name) return UI.toast('اكتب الاسم', true);
        const data = {
          name,
          phone: v('fp').trim(),
          address: v('fa').trim(),
          balance: DB.round(parseFloat(v('fb')) || 0),
          notes: v('fo').trim()
        };
        if (n) cfg.add(data);
        else {
          const a = this.all(), i = a.findIndex(i => i.id === x.id);
          if (i < 0) return UI.toast('غير موجود', true);
          Object.assign(a[i], data);
          DB.save(cfg.key, a);
        }
        m.close(); this.draw();
        UI.toast('تم الحفظ ✔');
      };
      if (!n) m.querySelector('#del').onclick = async () => {
        if (Math.abs(Number(x.balance) || 0) > 0 || DB.partyHasOps(cfg.key, x.id)){
          return UI.toast('لا يمكن الحذف لوجود رصيد أو عمليات', true);
        }
        if (!await UI.confirm('حذف نهائي؟', 'نعم، احذف', 'رجوع')) return;
        DB.save(cfg.key, this.all().filter(i => i.id !== x.id));
        m.close(); this.draw();
        UI.toast('تم الحذف');
      };
    }
  };
};