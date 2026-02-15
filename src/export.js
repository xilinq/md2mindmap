(function () {
  window.Mindmap = window.Mindmap || {};

  function saveTextFile(text, filename, mimeType) {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  window.Mindmap.exportSvg = function exportSvg(svg) {
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    const data = new XMLSerializer().serializeToString(clone);
    saveTextFile(data, 'mindmap.svg', 'image/svg+xml;charset=utf-8');
  };

  window.Mindmap.exportMarkdown = function exportMarkdown(markdownText) {
    saveTextFile(markdownText, 'mindmap-backup.md', 'text/markdown;charset=utf-8');
  };
})();
