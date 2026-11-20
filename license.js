const License = {
  PUBLIC_KEY:{"kty":"EC","crv":"P-256","x":"JPiLhZfTREyfi47bilILNM50L24xGA88AgLPLot2z0M","y":"aL9Mqq68V-Mw0TBPCg0zg3QgTusGky_yFEsdv2v3WhA"},
  info: null,

  dec(s){
    return Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
  },
  deviceId(){
    let d = localStorage.getItem(DB.K.device);
    if (!d){
      const a = crypto.getRandomValues(new Uint8Array(9));
      const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const s = Array.from(a, x => c[x % c.length]).join('');
      d = 'GS-' + s.slice(0,3) + '-' + s.slice(3,6) + '-' + s.slice(6,9);
      localStorage.setItem(DB.K.device, d);
    }
    return d;
  },

  async verify(token){
    try {
      if (!this.PUBLIC_KEY) return null;
      const parts = String(token).trim().split('.');
      if (parts.length !== 2) return null;
      const [p, s] = parts;
      const key = await crypto.subtle.importKey('jwk', this.PUBLIC_KEY, {name:'ECDSA',namedCurve:'P-256'}, false, ['verify']);
      if (!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'}, key, this.dec(s), this.dec(p))) return null;
      const info = JSON.parse(new TextDecoder().decode(this.dec(p)));
      return info.d === this.deviceId() ? info : null;
    } catch(e){ return null; }
  },

  daysLeft(){
    if (!this.info || !this.info.exp) return null;
    return Math.ceil((this.info.exp - Date.now()) / 86400000);
  },

  async activate(code){
    const info = await this.verify(code);
    if (!info) return false;

    // دمج: لو كود تجديد (بدون b/u/s) نحتفظ بالبيانات القديمة
    if (info.renew){
      const old = this.info || JSON.parse(new TextDecoder().decode(this.dec(String(localStorage.getItem(DB.K.license) || '').split('.')[0] || '')) || '{}';
      // نحاول نقرأ القديم بأمان
      let prev = null;
      try {
        const raw = localStorage.getItem(DB.K.license);
        if (raw){
          const p0 = raw.split('.')[0];
          prev = JSON.parse(new TextDecoder().decode(this.dec(p0)));
        }
      } catch(_){}
      if (prev){
        if (!info.s && prev.s) info.s = prev.s;
        if (!info.b && prev.b) info.b = prev.b;
        if (!info.u && prev.u) info.u = prev.u;
      }
    }

    localStorage.setItem(DB.K.license, String(code).trim());
    this.info = info;
    this.show();
    this.warnIfExpiring();
    return true;
  },

  show(){
    const el = document.getElementById('title');
    if (!el || !this.info) return;
    const shop = this.info.s || this.info.b || '';
    const dl = this.daysLeft();
    let sub = '🛒 ' + DB.esc(this.info.b) + ' — 👤 ' + DB.esc(this.info.u);
    if (dl !== null) sub += ' — ⏳ ' + (dl >= 0 ? dl + ' يوم' : 'منتهٍ');
    el.innerHTML = '🏪 ' + DB.esc(shop) + '<br><small>' + sub + '</small>';
  },

  warnIfExpiring(){
    const dl = this.daysLeft();
    if (dl !== null && dl >= 0 && dl <= 3){
      setTimeout(() => UI.toast('⚠️ ينتهي الاشتراك بعد ' + dl + ' يوم — جدد الآن', true), 800);
    }
  },

  async gate(onOk){
    const titleEl = document.getElementById('title');
    if (titleEl) titleEl.textContent = '';
    const raw = localStorage.getItem(DB.K.license);
    if (!raw) return this.screen(onOk, 'none');
    const info = await this.verify(raw);
    if (!info) return this.screen(onOk, 'invalid');
    if (info.exp && Date.now() > info.exp) return this.screen(onOk, 'exp');
    this.info = info;
    this.show();
    this.warnIfExpiring();
    return onOk();
  },

  screen(onOk, reason){
    const id = this.deviceId();
    const nav = document.getElementById('nav');
    const dayBtn = document.getElementById('dayBtn');
    if (nav) nav.classList.add('hide');
    if (dayBtn) dayBtn.classList.add('hide');
    const wa = 'https://wa.me/201115197980?text=' + encodeURIComponent('أرغب في تجديد الاشتراك. رقم الجهاز: ' + id);
    const titles = {
      exp: '⏰ انتهت مدة الاشتراك',
      none: '🔒 التطبيق غير مفعّل على هذا الجهاز',
      invalid: '⚠️ كود التفعيل غير صالح أو لا يخص هذا الجهاز'
    };
    document.getElementById('app').innerHTML = `<div class="box">
      <h1>${titles[reason] || titles.none}</h1>
      <p class="big">رقم جهازك (أرسله للإدارة):</p>
      <div class="codebox">${id}</div>
      <a class="btn ok" href="${wa}" target="_blank" rel="noopener" style="display:block;text-align:center;text-decoration:none;padding-top:16px">📱 تجديد الاشتراك عبر واتساب</a>
      <hr style="margin:16px 0;border:0;border-top:2px dashed var(--line)">
      <label>🔓 عندي كود تجديد من الإدارة</label>
      <textarea class="inp" id="lic" rows="3" dir="ltr"></textarea>
      <button class="btn" id="act">تفعيل الكود</button>
      <p class="hint" style="margin-top:10px">لو الكود مش شغال، تأكد إن الإدارة بعتته لنفس رقم الجهاز الظاهر فوق.</p>
    </div>`;
    document.getElementById('act').onclick = async () => {
      if (await this.activate(document.getElementById('lic').value)) onOk();
      else UI.toast('الكود غير صحيح أو لا يخص هذا الجهاز', true);
    };
  },

  update(){
    const cur = this.info || {};
    const dl = this.daysLeft();
    const wa = 'https://wa.me/201115197980?text=' + encodeURIComponent('أرغب في تجديد الاشتراك. رقم الجهاز: ' + this.deviceId());
    const m = UI.modal(`<h2>🔑 بيانات التفعيل</h2>
      <p class="big">رقم الجهاز</p><div class="codebox">${this.deviceId()}</div>
      <p>المحل: ${DB.esc(cur.s || '—')}<br>النشاط: ${DB.esc(cur.b || '—')}<br>المستخدم: ${DB.esc(cur.u || '—')}${dl !== null ? '<br>المتبقي: ' + (dl >= 0 ? dl + ' يوم' : 'منتهٍ') : ''}</p>
      <a class="btn ok" href="${wa}" target="_blank" rel="noopener" style="display:block;text-align:center;text-decoration:none;padding-top:16px">📱 تجديد عبر واتساب</a>
      <label>كود تجديد من الإدارة</label>
      <textarea class="inp" id="nl" rows="3" dir="ltr"></textarea>
      <button class="btn ok" id="go">تحديث</button><button class="btn gray" id="x">رجوع</button>`);
    m.querySelector('#x').onclick = () => m.close();
    m.querySelector('#go').onclick = async () => {
      if (await this.activate(m.querySelector('#nl').value)){
        m.close(); UI.toast('تم التجديد ✔');
        if (window.afterLicense) window.afterLicense();
      } else {
        UI.toast('الكود غير صحيح أو لا يخص هذا الجهاز', true);
      }
    };
  }
};
