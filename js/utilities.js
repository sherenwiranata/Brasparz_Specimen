// js/utilities.js (non-module)
// Attaches to window.UTIL to avoid polluting global scope
window.UTIL = {
  padViewBox(svg, pad = 240) {
    const vb = svg.viewBox?.baseVal;
    if (!vb || vb.width === 0) return;
    const x = vb.x - pad, y = vb.y - pad;
    const w = vb.width + pad * 2, h = vb.height + pad * 2;
    svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
  },
  getCenter(svg, el) {
    const b  = el.getBBox();
    const m  = el.getScreenCTM();
    const pt = svg.createSVGPoint();
    pt.x = b.x + b.width / 2;
    pt.y = b.y + b.height / 2;
    const c = pt.matrixTransform(m);
    return { x: c.x, y: c.y };
  }
};
