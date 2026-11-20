window.Screens = {};
window.UI = {
  toast(msg, bad){
    const t = document.createElement('div');
    t.className = 'toast' + (bad ? ' bad' : '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  },
  modal(html){
    const b = document.createElement('div');
    b.className = 'backdrop';
    b.innerHTML = '<div class="modal">' + html + '</div>';
    document.body.appendChild(b);
    b.close = () => b.remove();
    return b;
  },
  confirm(msg, yes='نعم', no='لا'){
    return new Promise(res => {
      const m = UI.modal(`<p class="big">${msg}</p><div class="row"><button class="btn ok" id="y">${yes}</button><button class="btn bad" id="n">${no}</button></div>`);
      m.querySelector('#y').onclick = () => { m.close(); res(true); };
      m.querySelector('#n').onclick = () => { m.close(); res(false); };
    });
  },
  card(p, withDel){
    const q = Number(p.qty) || 0;
    const mn = Number(p.min) || 0;
    const cls = q <= 0 ? 'out' : (q <= mn ? 'low' : '');
    const warn = q <= 0 ? '⛔ نفذت' : (q <= mn ? '⚠️ قليلة: ' + q : 'المتاح: ' + q);
    return `<div class="card ${cls}" data-id="${p.id}">
      ${withDel ? `<button class="x" data-del="${p.id}">✖</button>` : ''}
      ${p.img ? `<img src="${p.img}" alt="">` : '<div class="noimg">📦</div>'}
      <div class="code">${DB.esc(p.code)}</div>
      <div class="name">${DB.esc(p.name)}</div>
      <div class="price">${DB.money(p.price)}</div>
      <div class="qty">${warn}</div></div>`;
  }
};
