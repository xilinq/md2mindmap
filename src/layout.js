(function () {
  window.Mindmap = window.Mindmap || {};
  const cfg = window.Mindmap.cfg;
  const FONT = window.Mindmap.FONT;
  const walk = window.Mindmap.walk;

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  context.font = FONT;

  function measure(node) {
    context.font = FONT;
    const textW = Math.ceil(context.measureText(node.text).width);
    const hasChildren = (node.children?.length || 0) > 0;
    const badgeReserve = hasChildren ? (cfg.badgeW + cfg.badgeGap + 8) : 0;
    node.w = Math.max(cfg.nodeMinW, textW + cfg.padX * 2 + cfg.textMeasureFudge + badgeReserve);
    node.h = Math.max(cfg.nodeMinH, cfg.nodeTextH + cfg.padY * 2);
  }

  function computeSubtreeWidth(node) {
    measure(node);
    if (node.virtual) {
      node.w = 1;
      node.h = 1;
    }

    const children = node.collapsed ? [] : node.children;
    if (!children.length) {
      node.subW = node.w;
      return node.subW;
    }

    let total = 0;
    for (const child of children) {
      total += computeSubtreeWidth(child);
    }
    total += cfg.siblingGapX * (children.length - 1);

    node.subW = Math.max(node.w, total);
    return node.subW;
  }

  function assignPositions(node, leftX, depth) {
    node.y = depth * cfg.levelGapY;
    node.x = leftX + node.subW / 2;

    const children = node.collapsed ? [] : node.children;
    if (!children.length) {
      return;
    }

    const totalChildrenWidth = children.reduce((sum, child) => sum + child.subW, 0) + cfg.siblingGapX * (children.length - 1);
    let cursor = leftX + (node.subW - totalChildrenWidth) / 2;

    for (const child of children) {
      assignPositions(child, cursor, depth + 1);
      cursor += child.subW + cfg.siblingGapX;
    }
  }

  function normalizeXY(root) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;

    walk(root, (node) => {
      minX = Math.min(minX, node.x - node.w / 2);
      maxX = Math.max(maxX, node.x + node.w / 2);
      minY = Math.min(minY, node.y - node.h / 2);
    });

    const centerX = (minX + maxX) / 2;
    const offsetY = -minY + 40;

    walk(root, (node) => {
      node.x -= centerX;
      node.y += offsetY;
    });
  }

  window.Mindmap.layoutTopDown = function layoutTopDown(root) {
    computeSubtreeWidth(root);
    assignPositions(root, 0, 0);
    normalizeXY(root);
  };
})();
