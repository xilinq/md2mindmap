(function () {
  window.Mindmap = window.Mindmap || {};

  window.Mindmap.createViewportController = function createViewportController(svg, viewport, onChange) {
    let view = { x: 0, y: 0, s: 1 };
    let dragging = false;
    let last = { x: 0, y: 0 };

    function applyTransform() {
      viewport.setAttribute('transform', `translate(${view.x},${view.y}) scale(${view.s})`);
      onChange();
    }

    function resetView() {
      view = { x: 0, y: 0, s: 1 };
      applyTransform();
    }

    svg.addEventListener('mousedown', (event) => {
      dragging = true;
      last = { x: event.clientX, y: event.clientY };
    });

    window.addEventListener('mousemove', (event) => {
      if (!dragging) {
        return;
      }
      const dx = event.clientX - last.x;
      const dy = event.clientY - last.y;
      last = { x: event.clientX, y: event.clientY };
      view.x += dx;
      view.y += dy;
      applyTransform();
    });

    window.addEventListener('mouseup', () => {
      dragging = false;
    });

    svg.addEventListener('wheel', (event) => {
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.08 : 0.92;

      const pt = svg.createSVGPoint();
      pt.x = event.clientX;
      pt.y = event.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) {
        return;
      }
      const p = pt.matrixTransform(ctm.inverse());

      const before = {
        x: (p.x - view.x) / view.s,
        y: (p.y - view.y) / view.s
      };

      view.s = Math.max(0.15, Math.min(4.0, view.s * factor));

      const after = {
        x: before.x * view.s + view.x,
        y: before.y * view.s + view.y
      };

      view.x += p.x - after.x;
      view.y += p.y - after.y;
      applyTransform();
    }, { passive: false });

    window.addEventListener('keydown', (event) => {
      if (event.key.toLowerCase() === 'r') {
        resetView();
      }
    });

    applyTransform();

    return {
      resetView,
      getScale: function getScale() {
        return view.s;
      }
    };
  };
})();
