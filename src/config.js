(function () {
  window.Mindmap = window.Mindmap || {};

  window.Mindmap.TAB_SIZE = 4;
  window.Mindmap.cfg = {
    levelGapY: 98,
    siblingGapX: 36,
    padX: 14,
    padY: 10,
    elbow: 60,
    nodeMinW: 120,
    nodeMinH: 42,
    nodeTextH: 22,
    textMeasureFudge: 18,
    badgeW: 26,
    badgeH: 16,
    badgeGap: 6
  };

  window.Mindmap.FONT = '15.5px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", Arial';

  window.Mindmap.EXAMPLE_MD = `## 示例根节点

### 示例分支一
- 示例成员
\t- 示例成员
\t\t- 示例成员

### 示例分支二
- 示例成员
\t- 示例成员
\t\t- 示例成员`;
})();
