# Markdown Mindmap (纯前端单页)

一个无需任何依赖的 Markdown 思维导图工具。

- 直接双击 `mindmap.html` 即可运行（支持 `file://`）
- 左侧输入 Markdown，右侧实时渲染为可交互思维导图
- 支持二叉约束：每个节点最多两个子节点（左/右）

## 主要功能

- Markdown 解析与渲染
  - 支持 `#`/`##`/`###` 标题
  - 支持 `-` 列表
  - 支持 Tab/空格缩进
- 二叉左右子节点规则
  - 每个节点最多 2 个子节点：`left` 与 `right`
  - 可在 Markdown 中用 `[L]`、`[R]`（或 `[左]`、`[右]`）标记方向
  - 解析与编辑过程中会自动纠正规则，超额子节点会被丢弃并提示
- 交互能力
  - 点击节点选中
  - 点击节点角标折叠/展开
  - 鼠标拖拽平移、滚轮缩放、`R` 重置视图
- 节点编辑
  - 新增左子节点
  - 新增右子节点
  - 新增同级节点（按左右规则）
  - 编辑节点
  - 删除节点（含子树）
- 导入导出
  - 拖拽 `.md` 文件到页面自动读取并渲染
  - 导出 `SVG`
  - 导出 `MD` 备份

## 项目结构

```text
mindmap/
├─ mindmap.html          # 页面入口
├─ styles/
│  └─ main.css           # 样式
├─ src/
│  ├─ app.js             # 应用主流程、状态管理、按钮事件
│  ├─ config.js          # 全局配置、字体、示例数据
│  ├─ utils.js           # DOM/SVG/遍历工具
│  ├─ parser.js          # Markdown -> 树结构（含左右子节点解析）
│  ├─ markdown.js        # 树结构 -> Markdown（含 [L]/[R] 输出）
│  ├─ layout.js          # 树布局（自顶向下）
│  ├─ renderer.js        # SVG 节点/连线渲染与选中态
│  ├─ viewport.js        # 缩放/平移/重置视图
│  ├─ export.js          # 导出 SVG / MD
│  └─ dragdrop.js        # 拖拽导入 .md
├─ simplecase.md         # 简化样例
└─ testcase.md           # 大样例（已在 .gitignore 忽略）
```

## Markdown 编写规则

### 1) 基础结构

```md
## 根主题

### 分支A
- 节点1
    - 子节点1

### 分支B
- 节点2
```

### 2) 左右子节点标记（推荐）

```md
- 根节点
    - [L] 左子节点
        - [L] 左-左
        - [R] 左-右
    - [R] 右子节点
```

说明：
- `[L]` / `[左]` 表示左子节点
- `[R]` / `[右]` 表示右子节点
- 同一父节点下，左/右各最多一个

## 使用方式

1. 双击打开 `mindmap.html`
2. 在左侧输入或粘贴 Markdown，点击“渲染”
3. 或直接把 `.md` 文件拖入页面
4. 通过右上角按钮进行新增/编辑/删除/导出

## Git 使用（本地同步到 GitHub）

如果你已经在 GitHub 创建了空仓库，执行：

```bash
git add .
git commit -m "init project"
git branch -M main
git remote add origin https://github.com/<用户名>/<仓库名>.git
git push -u origin main
```

如需 SSH：

```bash
git remote add origin git@github.com:<用户名>/<仓库名>.git
git push -u origin main
```

## 已知约束

- 本项目是纯前端单页，不含后端存储
- 复杂历史操作暂不支持撤销/重做
- 对超出二叉规则的输入会自动裁剪并提示
