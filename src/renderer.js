(function () {
  window.Mindmap = window.Mindmap || {};
  const cfg = window.Mindmap.cfg;
  const createSvgEl = window.Mindmap.createSvgEl;
  const layoutTopDown = window.Mindmap.layoutTopDown;

  function clearSvg(viewport) {
    while (viewport.firstChild) {
      viewport.removeChild(viewport.firstChild);
    }
  }

  window.Mindmap.renderMindmap = function renderMindmap(root, viewport, options) {
    const opts = options || {};
    const selectedId = opts.selectedId ?? null;
    const onToggle = opts.onToggle || function () {};
    const onSelect = opts.onSelect || function () {};

    clearSvg(viewport);
    layoutTopDown(root);

    const edgesG = createSvgEl('g');
    const nodesG = createSvgEl('g');
    viewport.appendChild(edgesG);
    viewport.appendChild(nodesG);

    function drawLinks(parent) {
      if (parent.collapsed) {
        return;
      }

      for (const child of parent.children) {
        if (!parent.virtual) {
          const sx = parent.x;
          const sy = parent.y + parent.h / 2;
          const ex = child.x;
          const ey = child.y - child.h / 2;

          const c1x = sx;
          const c1y = sy + cfg.elbow;
          const c2x = ex;
          const c2y = ey - cfg.elbow;

          const path = createSvgEl('path');
          path.setAttribute('class', 'link');
          path.setAttribute('d', `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${ex} ${ey}`);
          edgesG.appendChild(path);
        }
        drawLinks(child);
      }
    }

    function drawNode(node) {
      if (!node.virtual) {
        const g = createSvgEl('g');
        g.setAttribute('class', node.id === selectedId ? 'node selected' : 'node');
        g.setAttribute('transform', `translate(${node.x},${node.y})`);

        const rect = createSvgEl('rect');
        rect.setAttribute('x', String(-node.w / 2));
        rect.setAttribute('y', String(-node.h / 2));
        rect.setAttribute('width', String(node.w));
        rect.setAttribute('height', String(node.h));

        const text = createSvgEl('text');
        text.setAttribute('x', '0');
        text.setAttribute('y', '0');
        text.setAttribute('text-anchor', 'middle');
        text.textContent = node.text;

        g.appendChild(rect);
        g.appendChild(text);

        if ((node.children?.length || 0) > 0) {
          const badgeW = cfg.badgeW;
          const badgeH = cfg.badgeH;
          const bx = node.w / 2 - badgeW - cfg.badgeGap;
          const by = -node.h / 2 + 6;

          const badgeGroup = createSvgEl('g');

          const badgeRect = createSvgEl('rect');
          badgeRect.setAttribute('class', 'badge');
          badgeRect.setAttribute('x', String(bx));
          badgeRect.setAttribute('y', String(by));
          badgeRect.setAttribute('width', String(badgeW));
          badgeRect.setAttribute('height', String(badgeH));
          badgeRect.setAttribute('rx', '6');
          badgeRect.setAttribute('ry', '6');

          const badgeText = createSvgEl('text');
          badgeText.setAttribute('class', 'badgeText');
          badgeText.setAttribute('x', String(bx + badgeW / 2));
          badgeText.setAttribute('y', String(by + badgeH / 2 + 0.5));
          badgeText.setAttribute('text-anchor', 'middle');
          badgeText.textContent = node.collapsed ? '+' : '-';

          badgeGroup.appendChild(badgeRect);
          badgeGroup.appendChild(badgeText);
          badgeGroup.addEventListener('click', (event) => {
            event.stopPropagation();
            node.collapsed = !node.collapsed;
            onToggle();
          });
          g.appendChild(badgeGroup);
        }

        g.addEventListener('click', (event) => {
          event.stopPropagation();
          onSelect(node.id);
        });

        nodesG.appendChild(g);
      }

      if (!node.collapsed) {
        for (const child of node.children) {
          drawNode(child);
        }
      }
    }

    drawLinks(root);
    drawNode(root);
  };

  window.Mindmap.clearMindmap = function clearMindmap(viewport) {
    clearSvg(viewport);
  };
})();
