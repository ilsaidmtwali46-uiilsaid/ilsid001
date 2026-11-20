Screens.daily = {
  day: null,
  key(x){
    const d = x instanceof Date ? x : new Date(x);
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  },
  shift(n){
    const d = new Date(this.day + 'T12:00:00');
    d.setDate(d.getDate() + n);
    this.day = this.key(d);
    this.render(document.getElementById('app'));
  },
  render(el){
    if (!this.day) this.day = this.key(new Date());
    const k = this.day, sum = (a, f) => DB.round(a.reduce((s,x) => s + f(x), 0));
    const sales = DB.list('sales').filter(s => this.key(s.date) === k);
    const purs = DB.list('purchases').filter(s => this.key(s.date) === k);
    const pays = DB.get(DB.K.payments, []).filter(s => this.key(s.date) === k);
    const nm = (key, id, fb) => DB.esc(DB.partyName(key, id, fb));
    const S = c => sum(sales.filter(c), s => s.total);
    const cashSales = S(s => !s.isReturn && s.type === 'cash');
    const creditSales = S(s => !s.isReturn && s.type === 'credit');
    const retCash = S(s => s.isReturn && s.type === 'cash');
    const retCredit = S(s => s.isReturn && s.type === 'credit');
    const profit = sum(sales, s => (s.isReturn ? -1 : 1) * s.items.reduce((a,i) => a + (i.price - (i.cost || 0)) * i.qty, 0));
    const bp = purs.filter(p => !p.isReturn), rp = purs.filter(p => p.isReturn);
    const buys = sum(bp, p => p.total), buyPaid = sum(bp, p => p.paid);
    const pRet = sum(rp, p => p.total), pRetCash = sum(rp, p => p.received || 0);
    const custIn = sum(pays.filter(p => p.kind === 'customers'), p => p.amount);
    const supOut = sum(pays.filter(p => p.kind === 'suppliers'), p => p.amount);
    const cin = DB.round(cashSales + custIn + pRetCash);
    const cout = DB.round(retCash + buyPaid + supOut);
    const netPurchases = DB.round(buys - pRet);
    const row = (l,v,c) => `<div class="line"><div class="n">${l}</div><b style="${c ? 'color:var(--' + c + ')' : ''}">${DB.money(v)}</b></div>`;

    const ops = [];
    sales.forEach(s => ops.push({ d:s.date, v:s.total, t:(s.isReturn ? '↩️ مرتجع بيع ' : s.type === 'cash' ? '🛒 بيع نقدي ' : '📒 بيع آجل ') + (s.customerId ? '(' + nm('customers', s.customerId) + ')' : '') }));
    purs.forEach(p => ops.push({ d:p.date, v:p.total, t:(p.isReturn ? '↩️ مرتجع شراء ' : '📥 شراء ') + (p.supplierId ? '(' + nm('suppliers', p.supplierId, p.supplierName) + ')' : (p.supplierName ? '(' + DB.esc(p.supplierName) + ')' : '')) }));
    pays.forEach(p => ops.push({ d:p.date, v:p.amount, t: p.kind === 'customers' ? '💵 استلام من ' + nm('customers', p.party) : '💵 سداد إلى ' + nm('suppliers', p.party) }));
    ops.sort((a,b) => a.d.localeCompare(b.d));

    const li = window.License && License.info;
    el.innerHTML = `<h1>📊 كشف الحساب اليومي</h1>
      ${li ? `<p class="big">${DB.esc(li.b)} — ${DB.esc(li.u)}</p>` : ''}
      <div class="row noprint"><button class="btn gray" id="prev">اليوم السابق</button><button class="btn gray" id="next">اليوم التالي</button></div>
      <input class="inp noprint" type="date" id="dt" value="${k}">
      <p class="big">📅 ${new Date(k + 'T12:00:00').toLocaleDateString('ar-EG', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
      <div class="box"><h2>🛒 المبيعات</h2>${row('بيع نقدي', cashSales)}${row('بيع آجل', creditSales)}
        ${row('مرتجع المبيعات', retCash + retCredit, 'warn')}${row('صافي المبيعات', cashSales + creditSales - retCash - retCredit, 'ok')}${row('الربح التقديري', profit, 'ok')}</div>
      <div class="box"><h2>📥 المشتريات</h2>${row('المشتريات', buys)}${row('المدفوع منها', buyPaid)}${row('مرتجع المشتريات', pRet, 'warn')}${row('صافي المشتريات', netPurchases)}</div>
      <div class="box"><h2>💵 الدفعات</h2>${row('استلمنا من العملاء', custIn)}${row('سددنا للموردين', supOut)}</div>
      <div class="box"><h2>💰 حركة الخزنة</h2>${row('داخل الخزنة', cin, 'ok')}${row('خارج الخزنة', cout, 'bad')}
        ${row('صافي حركة اليوم', cin - cout)}${row('الخزنة الآن', DB.getCash(), 'ok')}</div>
      <div class="box"><h2>📜 عمليات اليوم (${ops.length})</h2>
        ${ops.map(o => `<div class="line"><div class="n">${new Date(o.d).toLocaleTimeString('ar-EG', { hour:'2-digit', minute:'2-digit' })} — ${o.t}</div><b>${DB.money(o.v)}</b></div>`).join('') || '<p class="big">لا توجد عمليات في هذا اليوم</p>'}</div>
      <button class="btn noprint" onclick="window.print()">🖨️ طباعة الكشف</button>`;
    document.getElementById('prev').onclick = () => this.shift(-1);
    document.getElementById('next').onclick = () => this.shift(1);
    document.getElementById('dt').onchange = e => { if (e.target.value){ this.day = e.target.value; this.render(el); } };
  }
};
