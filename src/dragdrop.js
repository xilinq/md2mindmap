(function () {
  window.Mindmap = window.Mindmap || {};

  window.Mindmap.setupMarkdownDrop = function setupMarkdownDrop(options) {
    const app = options.app;
    const dropZone = options.dropZone;
    const onMarkdown = options.onMarkdown;
    let dragDepth = 0;

    function isMarkdownFile(file) {
      return file && file.name.toLowerCase().endsWith('.md');
    }

    function setDropState(active) {
      if (active) {
        app.classList.add('drop-active');
        dropZone.classList.add('drop-active');
      } else {
        app.classList.remove('drop-active');
        dropZone.classList.remove('drop-active');
      }
    }

    function stop(event) {
      event.preventDefault();
      event.stopPropagation();
    }

    async function handleDrop(event) {
      stop(event);
      setDropState(false);

      const files = Array.from(event.dataTransfer?.files || []);
      const mdFile = files.find(isMarkdownFile);
      if (!mdFile) {
        return;
      }

      const text = await mdFile.text();
      onMarkdown({
        text,
        fileName: mdFile.name || 'mindmap.md'
      });
    }

    window.addEventListener('dragenter', (event) => {
      stop(event);
      dragDepth += 1;
      setDropState(true);
    });

    window.addEventListener('dragover', (event) => {
      stop(event);
      setDropState(true);
    });

    window.addEventListener('dragleave', (event) => {
      stop(event);
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) {
        setDropState(false);
      }
    });

    window.addEventListener('drop', (event) => {
      dragDepth = 0;
      handleDrop(event).catch(() => {
        setDropState(false);
      });
    });
  };
})();
