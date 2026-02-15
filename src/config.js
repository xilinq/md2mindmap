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

  window.Mindmap.EXAMPLE_MD = `## 王亚基A17168908

### 金文忠C17224571
- 宋燕C17455260
\t- 赵小卫B17478783
\t\t- 王见C17511419

### 吴莉c17446413
- 张益玲D17446423
\t- 张小梅E17446471
\t\t- 王艳C17528855`;
})();
