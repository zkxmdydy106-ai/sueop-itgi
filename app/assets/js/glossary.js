/* 수업잇기 엔진 · glossary.js — 핵심어 눌러 뜻 보기
   textbook.glossary = [{ term, def, page(처음 나온 쪽), screen(그 개념 화면 id) }]
   수업 화면의 굵은 핵심어(.term)와 교과서 원본 쪽 위의 용어 자리(textbook.terms) 어디서든 같은 말풍선이 뜬다. */
(function () {
  'use strict';
  const DT = window.DT;
  const G = (DT.gloss = {});
  G.find = function (term) {
    const tb = window.TEXTBOOK; if (!tb) return null;
    const n = DT.norm(term);
    const list = tb.glossary || [];
    return list.find((g) => DT.norm(g.term) === n) || list.find((g) => n.includes(DT.norm(g.term)) || DT.norm(g.term).includes(n)) || null;
  };
  let cur = null;
  G.close = () => { if (cur) { cur.remove(); cur = null; document.removeEventListener('pointerdown', outside, true); } };
  function outside(e) { if (cur && !cur.contains(e.target)) G.close(); }
  /* anchor: 화면 위 요소 또는 {left,top,width,height} / opt: { onPage(n), onScreen(id), here } */
  G.pop = function (anchor, term, opt) {
    opt = opt || {}; G.close();
    const g = G.find(term) || { term };
    const tb = window.TEXTBOOK;
    const box = DT.el('div', { class: 'gpop', role: 'dialog', 'aria-label': g.term + ' 뜻' });
    box.append(DT.el('div', { class: 'gpop__term' }, g.term));
    box.append(DT.el('div', { class: 'gpop__def', html: g.def ? DT.md(g.def) : '이 용어의 뜻은 아직 정리되지 않았어요. (Code에게 "용어 사전 채워줘"라고 하면 교과서 문장으로 채워요)' }));
    const acts = DT.el('div', { class: 'gpop__acts' });
    if (g.page && opt.onPage && g.page !== opt.here) acts.append(DT.el('button', { class: 'btn btn--sm btn--ink', type: 'button', html: DT.icon('book') + '처음 나온 ' + g.page + '쪽 보기', onclick: () => { G.close(); opt.onPage(g.page); } }));
    if (g.screen && opt.onScreen && tb && tb._byId && tb._byId[g.screen]) acts.append(DT.el('button', { class: 'btn btn--sm', type: 'button', html: DT.icon('board') + '개념 화면으로', onclick: () => { G.close(); opt.onScreen(g.screen); } }));
    acts.append(DT.el('button', { class: 'btn btn--sm btn--ghost', type: 'button', onclick: G.close }, '닫기'));
    box.append(acts);
    document.body.append(box); cur = box;
    const r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : anchor;
    const w = box.offsetWidth, h = box.offsetHeight;
    let x = DT.clamp(r.left + r.width / 2 - w / 2, 10, innerWidth - w - 10), y = r.top + r.height + 10;
    if (y + h > innerHeight - 10) y = Math.max(10, r.top - h - 10);
    box.style.left = x + 'px'; box.style.top = y + 'px';
    setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
    return box;
  };
})();
