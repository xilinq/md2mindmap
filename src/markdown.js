(function () {
  window.Mindmap = window.Mindmap || {};

  function orderedChildren(node) {
    const order = { left: 0, right: 1 };
    return [...(node.children || [])].sort((a, b) => {
      const oa = order[a.side] ?? 9;
      const ob = order[b.side] ?? 9;
      return oa - ob;
    });
  }

  function sidePrefix(node, parentIsVirtual) {
    if (parentIsVirtual) {
      return '';
    }
    if (node.side === 'left') {
      return '[L] ';
    }
    if (node.side === 'right') {
      return '[R] ';
    }
    return '';
  }

  window.Mindmap.serializeTreeToMarkdown = function serializeTreeToMarkdown(root) {
    if (!root) {
      return '';
    }

    const lines = [];

    function emit(node, level, parentIsVirtual) {
      if (!node.virtual) {
        const prefix = sidePrefix(node, parentIsVirtual);
        lines.push(`${' '.repeat(level * 4)}- ${prefix}${node.text}`);
      }

      const nextLevel = node.virtual ? level : level + 1;
      for (const child of orderedChildren(node)) {
        emit(child, nextLevel, !!node.virtual);
      }
    }

    emit(root, 0, true);
    return lines.join('\n');
  };
})();
