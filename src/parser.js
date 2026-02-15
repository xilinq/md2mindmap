(function () {
  window.Mindmap = window.Mindmap || {};
  const TAB_SIZE = window.Mindmap.TAB_SIZE;

  function indentColumns(leadingWs) {
    let col = 0;
    for (const ch of leadingWs) {
      if (ch === '\t') {
        col += TAB_SIZE - (col % TAB_SIZE);
      } else if (ch === ' ') {
        col += 1;
      } else {
        break;
      }
    }
    return col;
  }

  function normalizeSideToken(raw) {
    if (!raw) {
      return null;
    }
    const v = raw.trim().toUpperCase();
    if (v === 'L' || raw.trim() === '左') {
      return 'left';
    }
    if (v === 'R' || raw.trim() === '右') {
      return 'right';
    }
    return null;
  }

  function stripSidePrefix(text) {
    const m = text.match(/^\[(L|R|左|右)\]\s*(.*)$/i);
    if (!m) {
      return { sideHint: null, text: text.trim() };
    }
    return {
      sideHint: normalizeSideToken(m[1]),
      text: (m[2] || '').trim()
    };
  }

  function getChildBySide(parent, side) {
    for (const child of parent.children || []) {
      if (child.side === side) {
        return child;
      }
    }
    return null;
  }

  function sortBySide(children) {
    const order = { left: 0, right: 1 };
    return children.sort((a, b) => {
      const oa = order[a.side] ?? 9;
      const ob = order[b.side] ?? 9;
      return oa - ob;
    });
  }

  function chooseSide(parent, sideHint) {
    if (parent.virtual) {
      return null;
    }

    if (sideHint === 'left' || sideHint === 'right') {
      if (!getChildBySide(parent, sideHint)) {
        return sideHint;
      }
      return null;
    }

    if (!getChildBySide(parent, 'left')) {
      return 'left';
    }
    if (!getChildBySide(parent, 'right')) {
      return 'right';
    }
    return null;
  }

  window.Mindmap.parseMd = function parseMd(md) {
    const lines = md.replace(/\r/g, '').split('\n');
    const tokens = [];
    let minHeading = Infinity;

    for (const raw of lines) {
      if (!raw.trim()) {
        continue;
      }

      const leading = (raw.match(/^[\t ]*/) || [''])[0];
      const rest = raw.slice(leading.length);

      const headingMatch = rest.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        const headingLevel = headingMatch[1].length;
        const parsed = stripSidePrefix(headingMatch[2]);
        minHeading = Math.min(minHeading, headingLevel);
        tokens.push({
          type: 'heading',
          headingLevel,
          sideHint: parsed.sideHint,
          text: parsed.text
        });
        continue;
      }

      const listMatch = rest.match(/^[-*+]\s+(.*)$/);
      if (listMatch) {
        const parsed = stripSidePrefix(listMatch[1]);
        tokens.push({
          type: 'list',
          indentCol: indentColumns(leading),
          sideHint: parsed.sideHint,
          text: parsed.text
        });
        continue;
      }

      const parsed = stripSidePrefix(rest.trim());
      tokens.push({
        type: 'plain',
        indentCol: indentColumns(leading),
        sideHint: parsed.sideHint,
        text: parsed.text
      });
    }

    if (minHeading === Infinity) {
      minHeading = 2;
    }

    let idSeq = 1;
    let overflowDropCount = 0;
    const root = {
      id: 0,
      text: '',
      depth: -1,
      children: [],
      collapsed: false,
      virtual: true,
      side: null
    };
    const stack = [root];

    let sectionBaseDepth = -1;
    let indentStack = [];
    let blockedDepth = null;

    function attach(node, sideHint) {
      const parent = stack[stack.length - 1] || root;
      const side = chooseSide(parent, sideHint);
      if (!parent.virtual && side == null) {
        overflowDropCount += 1;
        return false;
      }

      node.side = side;
      parent.children.push(node);
      sortBySide(parent.children);
      stack.push(node);
      return true;
    }

    for (const token of tokens) {
      let depth = 0;

      if (token.type === 'heading') {
        depth = Math.max(0, token.headingLevel - minHeading);
      } else {
        const indentCol = token.indentCol ?? 0;

        if (indentStack.length === 0) {
          indentStack = [indentCol];
        } else if (indentCol > indentStack[indentStack.length - 1]) {
          indentStack.push(indentCol);
        } else {
          while (indentStack.length && indentCol < indentStack[indentStack.length - 1]) {
            indentStack.pop();
          }
          if (!indentStack.length || indentCol !== indentStack[indentStack.length - 1]) {
            indentStack.push(indentCol);
          }
        }

        const listLevel = Math.max(0, indentStack.length - 1);
        const base = Math.max(-1, sectionBaseDepth);
        depth = base + 1 + listLevel;
      }

      if (blockedDepth != null) {
        if (depth > blockedDepth) {
          continue;
        }
        blockedDepth = null;
      }

      while (stack.length && stack[stack.length - 1].depth >= depth) {
        stack.pop();
      }

      const node = {
        id: idSeq++,
        text: token.text || '未命名节点',
        depth,
        children: [],
        collapsed: false,
        side: null
      };

      const ok = attach(node, token.sideHint || null);
      if (!ok) {
        blockedDepth = depth;
        continue;
      }

      if (token.type === 'heading') {
        sectionBaseDepth = depth;
        indentStack = [];
      }
    }

    window.Mindmap.lastParseOverflowDropCount = overflowDropCount;

    if (root.children.length === 1) {
      root.children[0].virtual = false;
      return root.children[0];
    }

    return root;
  };
})();
