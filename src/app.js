(function () {
  window.Mindmap = window.Mindmap || {};

  const EXAMPLE_MD = window.Mindmap.EXAMPLE_MD;
  const $ = window.Mindmap.$;
  const parseMd = window.Mindmap.parseMd;
  const serializeTreeToMarkdown = window.Mindmap.serializeTreeToMarkdown;
  const renderMindmap = window.Mindmap.renderMindmap;
  const clearMindmap = window.Mindmap.clearMindmap;
  const createViewportController = window.Mindmap.createViewportController;
  const exportSvg = window.Mindmap.exportSvg;
  const exportMarkdown = window.Mindmap.exportMarkdown;
  const setupMarkdownDrop = window.Mindmap.setupMarkdownDrop;

  const appEl = $('app');
  const dropZoneEl = $('dropZone');
  const mdEl = $('md');
  const svgEl = $('svg');
  const viewportEl = $('viewport');
  const statusEl = $('status');

  let currentRoot = null;
  let selectedNodeId = null;
  let nextNodeId = 1;
  let nodeCount = 0;

  function traverseAll(node, fn) {
    if (!node) {
      return;
    }
    fn(node);
    for (const child of node.children || []) {
      traverseAll(child, fn);
    }
  }

  function countSubtree(node) {
    let total = 0;
    traverseAll(node, function (n) {
      if (!n.virtual) {
        total += 1;
      }
    });
    return total;
  }

  function countAllNodes(root) {
    return countSubtree(root);
  }

  function refreshNodeCount() {
    nodeCount = countAllNodes(currentRoot);
  }

  function refreshIdSeed() {
    let maxId = 0;
    traverseAll(currentRoot, function (node) {
      if (!node.virtual) {
        maxId = Math.max(maxId, node.id || 0);
      }
    });
    nextNodeId = maxId + 1;
  }

  function makeEmptyRoot() {
    return {
      id: 0,
      text: '',
      depth: -1,
      children: [],
      collapsed: false,
      virtual: true,
      side: null
    };
  }

  function toContainerRoot(root) {
    if (!root) {
      return makeEmptyRoot();
    }
    if (root.virtual) {
      return root;
    }
    return {
      id: 0,
      text: '',
      depth: -1,
      children: [root],
      collapsed: false,
      virtual: true,
      side: null
    };
  }

  function normalizeRoot(container) {
    if (!container || !container.children || container.children.length === 0) {
      return makeEmptyRoot();
    }
    if (container.children.length === 1 && !container.children[0].virtual) {
      return container.children[0];
    }
    return {
      id: 0,
      text: '',
      depth: -1,
      children: container.children,
      collapsed: false,
      virtual: true,
      side: null
    };
  }

  function recomputeDepths(root, baseDepth) {
    if (!root) {
      return;
    }
    root.depth = baseDepth;
    const nextDepth = baseDepth + 1;
    for (const child of root.children || []) {
      recomputeDepths(child, nextDepth);
    }
  }

  function childOrderValue(side) {
    if (side === 'left') {
      return 0;
    }
    if (side === 'right') {
      return 1;
    }
    return 9;
  }

  function sortChildrenBySide(node) {
    node.children = [...(node.children || [])].sort(function (a, b) {
      return childOrderValue(a.side) - childOrderValue(b.side);
    });
  }

  function getChildBySide(node, side) {
    for (const child of node.children || []) {
      if (child.side === side) {
        return child;
      }
    }
    return null;
  }

  function enforceBinary(node) {
    if (!node) {
      return 0;
    }

    let dropped = 0;

    if (!node.virtual) {
      let left = null;
      let right = null;
      const unresolved = [];

      for (const child of node.children || []) {
        if (child.side === 'left' && !left) {
          left = child;
        } else if (child.side === 'right' && !right) {
          right = child;
        } else {
          unresolved.push(child);
        }
      }

      for (const child of unresolved) {
        if (!left) {
          child.side = 'left';
          left = child;
        } else if (!right) {
          child.side = 'right';
          right = child;
        } else {
          dropped += countSubtree(child);
        }
      }

      const kept = [];
      if (left) {
        kept.push(left);
      }
      if (right) {
        kept.push(right);
      }
      node.children = kept;
    }

    sortChildrenBySide(node);
    for (const child of node.children || []) {
      dropped += enforceBinary(child);
    }
    return dropped;
  }

  function findSelectedNode() {
    if (!currentRoot || selectedNodeId == null) {
      return null;
    }

    const container = toContainerRoot(currentRoot);
    let found = null;

    function dfs(node, parent) {
      if (found) {
        return;
      }
      if (!node.virtual && node.id === selectedNodeId) {
        found = { node, parent, container };
        return;
      }
      for (const child of node.children || []) {
        dfs(child, node);
      }
    }

    dfs(container, null);
    return found;
  }

  function updateStatus() {
    if (!currentRoot) {
      statusEl.textContent = '未渲染';
      return;
    }

    const selectedText = selectedNodeId == null ? '无' : String(selectedNodeId);
    statusEl.textContent = `节点: ${nodeCount} | 缩放: ${viewport.getScale().toFixed(2)}x | 选中: ${selectedText}`;
  }

  function redrawCurrent() {
    if (!currentRoot) {
      clearMindmap(viewportEl);
      updateStatus();
      return;
    }

    renderMindmap(currentRoot, viewportEl, {
      selectedId: selectedNodeId,
      onToggle: redrawCurrent,
      onSelect: function (id) {
        selectedNodeId = id;
        redrawCurrent();
      }
    });
    updateStatus();
  }

  const viewport = createViewportController(svgEl, viewportEl, updateStatus);

  function syncMarkdownFromTree() {
    mdEl.value = serializeTreeToMarkdown(currentRoot);
  }

  function commitTreeChange(container, droppedCount) {
    recomputeDepths(container, -1);
    const localDrop = enforceBinary(container);
    currentRoot = normalizeRoot(container);
    refreshIdSeed();
    refreshNodeCount();
    syncMarkdownFromTree();
    redrawCurrent();

    const totalDropped = (droppedCount || 0) + localDrop;
    if (totalDropped > 0) {
      alert(`已按二叉规则纠正并丢弃 ${totalDropped} 个超额节点。`);
    }
  }

  function doRender() {
    currentRoot = parseMd(mdEl.value || '');
    selectedNodeId = null;

    const container = toContainerRoot(currentRoot);
    recomputeDepths(container, -1);
    const overflowDropped = Number(window.Mindmap.lastParseOverflowDropCount || 0);
    const enforcedDropped = enforceBinary(container);

    currentRoot = normalizeRoot(container);
    refreshIdSeed();
    refreshNodeCount();
    redrawCurrent();

    const totalDropped = overflowDropped + enforcedDropped;
    if (totalDropped > 0) {
      alert(`已按二叉规则读取思维导图，并丢弃 ${totalDropped} 个超额节点。`);
      syncMarkdownFromTree();
    }
  }

  function setMarkdownAndRender(markdown) {
    mdEl.value = markdown;
    doRender();
  }

  function requireSelection() {
    const hit = findSelectedNode();
    if (!hit) {
      alert('请先点击一个节点再执行该操作。');
      return null;
    }
    return hit;
  }

  function addChildNode(targetSide) {
    const hit = requireSelection();
    if (!hit) {
      return;
    }

    if (targetSide !== 'left' && targetSide !== 'right') {
      return;
    }

    if (getChildBySide(hit.node, targetSide)) {
      alert(`该节点已有${targetSide === 'left' ? '左' : '右'}子节点，无法继续新增。`);
      return;
    }

    const text = prompt('输入子节点内容：', '新节点');
    if (!text || !text.trim()) {
      return;
    }

    const node = {
      id: nextNodeId++,
      text: text.trim(),
      depth: hit.node.depth + 1,
      children: [],
      collapsed: false,
      side: targetSide
    };

    hit.node.children.push(node);
    sortChildrenBySide(hit.node);
    hit.node.collapsed = false;
    selectedNodeId = node.id;
    commitTreeChange(hit.container, 0);
  }

  function addSiblingNode() {
    const hit = requireSelection();
    if (!hit || !hit.parent) {
      return;
    }

    const text = prompt('输入同级节点内容：', '新节点');
    if (!text || !text.trim()) {
      return;
    }

    const siblings = hit.parent.children;
    const index = siblings.indexOf(hit.node);
    if (index < 0) {
      return;
    }

    if (hit.parent.virtual) {
      const node = {
        id: nextNodeId++,
        text: text.trim(),
        depth: hit.node.depth,
        children: [],
        collapsed: false,
        side: null
      };
      siblings.splice(index + 1, 0, node);
      selectedNodeId = node.id;
      commitTreeChange(hit.container, 0);
      return;
    }

    const targetSide = hit.node.side === 'left' ? 'right' : 'left';
    if (!targetSide) {
      alert('当前节点未定义左右属性，无法新增同级。请先通过左右子节点按钮新增。');
      return;
    }

    if (getChildBySide(hit.parent, targetSide)) {
      alert(`父节点的${targetSide === 'left' ? '左' : '右'}子节点已存在，无法新增同级。`);
      return;
    }

    const node = {
      id: nextNodeId++,
      text: text.trim(),
      depth: hit.node.depth,
      children: [],
      collapsed: false,
      side: targetSide
    };

    siblings.push(node);
    sortChildrenBySide(hit.parent);
    selectedNodeId = node.id;
    commitTreeChange(hit.container, 0);
  }

  function editNode() {
    const hit = requireSelection();
    if (!hit) {
      return;
    }

    const text = prompt('修改节点内容：', hit.node.text);
    if (!text || !text.trim()) {
      return;
    }

    hit.node.text = text.trim();
    commitTreeChange(hit.container, 0);
  }

  function deleteNode() {
    const hit = requireSelection();
    if (!hit || !hit.parent) {
      return;
    }

    const ok = confirm(`确认删除节点“${hit.node.text}”及其全部子节点？`);
    if (!ok) {
      return;
    }

    const siblings = hit.parent.children;
    const index = siblings.indexOf(hit.node);
    if (index < 0) {
      return;
    }
    siblings.splice(index, 1);

    selectedNodeId = null;
    commitTreeChange(hit.container, 0);
  }

  $('renderBtn').addEventListener('click', doRender);
  $('resetViewBtn').addEventListener('click', function () {
    viewport.resetView();
  });
  $('exportBtn').addEventListener('click', function () {
    exportSvg(svgEl);
  });
  $('exportMdBtn').addEventListener('click', function () {
    exportMarkdown(mdEl.value || '');
  });
  $('addLeftChildBtn').addEventListener('click', function () {
    addChildNode('left');
  });
  $('addRightChildBtn').addEventListener('click', function () {
    addChildNode('right');
  });
  $('addSiblingBtn').addEventListener('click', addSiblingNode);
  $('editNodeBtn').addEventListener('click', editNode);
  $('deleteNodeBtn').addEventListener('click', deleteNode);

  $('clearBtn').addEventListener('click', function () {
    mdEl.value = '';
    currentRoot = makeEmptyRoot();
    selectedNodeId = null;
    refreshIdSeed();
    refreshNodeCount();
    clearMindmap(viewportEl);
    viewport.resetView();
    updateStatus();
  });

  $('exampleBtn').addEventListener('click', function () {
    mdEl.value = EXAMPLE_MD;
  });

  svgEl.addEventListener('click', function () {
    if (selectedNodeId != null) {
      selectedNodeId = null;
      redrawCurrent();
    }
  });

  setupMarkdownDrop({
    app: appEl,
    dropZone: dropZoneEl,
    onMarkdown: setMarkdownAndRender
  });

  $('exampleBtn').click();
  doRender();
  viewport.resetView();
  updateStatus();
})();
