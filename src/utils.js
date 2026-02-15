(function () {
  window.Mindmap = window.Mindmap || {};

  window.Mindmap.$ = function $(id) {
    return document.getElementById(id);
  };

  window.Mindmap.walk = function walk(node, fn) {
    fn(node);
    if (!node.collapsed) {
      for (const child of node.children) {
        walk(child, fn);
      }
    }
  };

  window.Mindmap.createSvgEl = function createSvgEl(tag) {
    return document.createElementNS('http://www.w3.org/2000/svg', tag);
  };
})();
