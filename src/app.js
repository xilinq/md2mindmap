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

  const modifiedSync = {
    sourceFileName: null,
    targetFileName: null,
    fileHandle: null,
    eol: '\n',
    enabled: false,
    lastContent: null,
    writeChain: Promise.resolve(),
    writeErrorShown: false
  };

  const history = {
    undo: [],
    redo: [],
    current: '',
    max: 300,
    applying: false
  };

  function isEditableTarget(target) {
    if (!target) {
      return false;
    }
    if (target === mdEl) {
      return true;
    }
    const tag = String(target.tagName || '').toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || !!target.isContentEditable;
  }

  function updateHistoryButtons() {
    const undoBtn = $('undoBtn');
    const redoBtn = $('redoBtn');
    if (undoBtn) {
      undoBtn.disabled = history.undo.length === 0;
    }
    if (redoBtn) {
      redoBtn.disabled = history.redo.length === 0;
    }
  }

  function initHistory(initialText) {
    history.undo = [];
    history.redo = [];
    history.current = initialText || '';
    updateHistoryButtons();
  }

  function pushHistorySnapshot(nextText) {
    if (history.applying) {
      return;
    }
    const normalized = nextText || '';
    if (normalized === history.current) {
      return;
    }
    history.undo.push(history.current);
    if (history.undo.length > history.max) {
      history.undo.shift();
    }
    history.current = normalized;
    history.redo = [];
    updateHistoryButtons();
  }

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

  function detectEol(text) {
    return text.includes('\r\n') ? '\r\n' : '\n';
  }

  function normalizeEol(text, eol) {
    const lf = (text || '').replace(/\r\n/g, '\n');
    return eol === '\r\n' ? lf.replace(/\n/g, '\r\n') : lf;
  }

  function buildModifiedFileName(fileName) {
    const name = fileName || 'mindmap.md';
    const dot = name.lastIndexOf('.');
    if (dot > 0) {
      return `${name.slice(0, dot)}.modified${name.slice(dot)}`;
    }
    return `${name}.modified`;
  }

  async function initModifiedFileSync(sourceFileName, sourceText) {
    modifiedSync.sourceFileName = sourceFileName || 'mindmap.md';
    modifiedSync.targetFileName = buildModifiedFileName(modifiedSync.sourceFileName);
    modifiedSync.eol = detectEol(sourceText || '');
    modifiedSync.fileHandle = null;
    modifiedSync.enabled = false;
    modifiedSync.lastContent = null;
    modifiedSync.writeErrorShown = false;

    if (typeof window.showSaveFilePicker !== 'function') {
      alert('当前浏览器不支持直接写入本地文件。请使用 Chromium 内核浏览器以启用 .modified 实时同步。');
      return;
    }

    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: modifiedSync.targetFileName,
        types: [{
          description: 'Markdown',
          accept: {
            'text/markdown': ['.md', '.markdown', '.txt']
          }
        }]
      });

      modifiedSync.fileHandle = handle;
      modifiedSync.enabled = true;
      queueModifiedWrite(mdEl.value || sourceText || '', true);
    } catch {
      alert('未选择 .modified 输出文件，已跳过实时同步。');
    }
  }

  function queueModifiedWrite(content, force) {
    if (!modifiedSync.enabled || !modifiedSync.fileHandle) {
      return;
    }

    const normalized = normalizeEol(content || '', modifiedSync.eol);
    if (!force && modifiedSync.lastContent === normalized) {
      return;
    }

    modifiedSync.lastContent = normalized;
    modifiedSync.writeChain = modifiedSync.writeChain.then(async function () {
      const writer = await modifiedSync.fileHandle.createWritable();
      await writer.write(normalized);
      await writer.close();
    }).catch(function () {
      modifiedSync.enabled = false;
      if (!modifiedSync.writeErrorShown) {
        modifiedSync.writeErrorShown = true;
        alert('写入 .modified 文件失败，已停止实时同步。');
      }
    });
  }

  function syncMarkdownFromTree() {
    mdEl.value = serializeTreeToMarkdown(currentRoot);
    queueModifiedWrite(mdEl.value, false);
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

    pushHistorySnapshot(mdEl.value || '');
  }

  function doRender(options) {
    const opts = options || {};
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

    queueModifiedWrite(mdEl.value || '', false);

    const totalDropped = overflowDropped + enforcedDropped;
    if (totalDropped > 0) {
      alert(`已按二叉规则读取思维导图，并丢弃 ${totalDropped} 个超额节点。`);
      syncMarkdownFromTree();
    }

    if (!opts.skipHistory) {
      pushHistorySnapshot(mdEl.value || '');
    }
  }

  function applyHistorySnapshot(snapshot) {
    history.applying = true;
    mdEl.value = snapshot || '';
    doRender({ skipHistory: true });
    history.applying = false;
  }

  function undoOneStep() {
    if (history.undo.length === 0) {
      return;
    }
    const previous = history.undo.pop();
    history.redo.push(history.current);
    history.current = previous;
    applyHistorySnapshot(previous);
    updateHistoryButtons();
  }

  function redoOneStep() {
    if (history.redo.length === 0) {
      return;
    }
    const next = history.redo.pop();
    history.undo.push(history.current);
    history.current = next;
    applyHistorySnapshot(next);
    updateHistoryButtons();
  }

  function setMarkdownAndRender(payload) {
    if (typeof payload === 'string') {
      mdEl.value = payload;
      doRender();
      return;
    }

    const text = payload?.text || '';
    const fileName = payload?.fileName || 'mindmap.md';
    mdEl.value = text;
    doRender();
    initModifiedFileSync(fileName, text);
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

  function setNodeSide(targetSide) {
    const hit = requireSelection();
    if (!hit || !hit.parent) {
      return;
    }

    if (targetSide !== 'left' && targetSide !== 'right') {
      return;
    }

    if (hit.parent.virtual) {
      alert('根层节点不支持设置为左子或右子。');
      return;
    }

    if (hit.node.side === targetSide) {
      alert(`该节点已经是${targetSide === 'left' ? '左子节点' : '右子节点'}。`);
      return;
    }

    const occupied = getChildBySide(hit.parent, targetSide);
    if (occupied && occupied !== hit.node) {
      const originalSide = hit.node.side;
      if (originalSide !== 'left' && originalSide !== 'right') {
        alert(`父节点的${targetSide === 'left' ? '左子节点' : '右子节点'}已存在，当前节点无法交换。`);
        return;
      }
      occupied.side = originalSide;
    }

    hit.node.side = targetSide;
    sortChildrenBySide(hit.parent);
    selectedNodeId = hit.node.id;
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

  $('renderBtn').addEventListener('click', function () {
    doRender();
  });
  $('undoBtn').addEventListener('click', undoOneStep);
  $('redoBtn').addEventListener('click', redoOneStep);
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
  $('setAsLeftBtn').addEventListener('click', function () {
    setNodeSide('left');
  });
  $('setAsRightBtn').addEventListener('click', function () {
    setNodeSide('right');
  });
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
    queueModifiedWrite('', true);
    updateStatus();
    pushHistorySnapshot('');
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

  window.addEventListener('keydown', function (event) {
    if (!event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
      return;
    }
    if (isEditableTarget(event.target)) {
      return;
    }

    const key = String(event.key || '').toLowerCase();
    if (key === 'z') {
      event.preventDefault();
      undoOneStep();
      return;
    }

    if (key === 'y') {
      event.preventDefault();
      redoOneStep();
    }
  });

  setupMarkdownDrop({
    app: appEl,
    dropZone: dropZoneEl,
    onMarkdown: setMarkdownAndRender
  });

  $('exampleBtn').click();
  doRender({ skipHistory: true });
  initHistory(mdEl.value || '');
  viewport.resetView();
  updateStatus();
})();

