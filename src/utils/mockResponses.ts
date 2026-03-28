import { ContentBlock } from '../types';

/**
 * Structured mock responses showcasing all 7 content block types.
 * Each response is an array of ContentBlocks for the streaming system.
 */

export interface MockResponse {
  /** Text blocks are streamed character-by-character; non-text blocks appear instantly */
  blocks: ContentBlock[];
}

export const STRUCTURED_MOCK_RESPONSES: MockResponse[] = [
  // Response 0: Form table in chat (3 cols × 5 rows) — supermarket demo
  {
    blocks: [
      { type: 'text', content: '以下是超市商品库存信息，请核对并编辑：' },
      {
        type: 'form_table',
        title: '超市商品库存',
        columns: [
          { key: 'product', label: '商品名称', type: 'text' },
          { key: 'price', label: '单价（元）', type: 'text' },
          { key: 'category', label: '分类', type: 'select', options: ['生鲜果蔬', '乳制品', '粮油调味', '零食饮料', '日用百货'] },
        ],
        rows: [
          { product: '有机西红柿', price: '8.90', category: '生鲜果蔬' },
          { product: '伊利纯牛奶 1L', price: '12.50', category: '乳制品' },
          { product: '金龙鱼菜籽油 5L', price: '59.90', category: '粮油调味' },
          { product: '乐事薯片 原味', price: '7.50', category: '零食饮料' },
          { product: '维达抽纸 3包装', price: '15.80', category: '日用百货' },
        ],
        submitLabel: '确认提交',
      },
      { type: 'text', content: '你可以直接在表格中编辑商品信息、添加或删除行，确认无误后点击提交。' },
    ]
  },

  // Response 1: Showcase ALL 7 block types
  {
    blocks: [
      { type: 'text', content: '让我帮你完成这个任务。' },
      { type: 'skill', skill: 'brainstorming', args: '--depth=3', status: 'done', duration: 1.2 },
      { type: 'todolist', items: [
        { id: 't1', label: '分析项目结构', status: 'done' },
        { id: 't2', label: '实现核心功能', status: 'in_progress' },
        { id: 't3', label: '编写测试用例', status: 'pending' },
      ]},
      { type: 'tool_call', tool: 'glob', args: 'src/**/*.tsx', duration: 0.3, status: 'done' },
      { type: 'tool_call', tool: 'read', args: 'src/App.tsx', duration: 0.1, status: 'done' },
      { type: 'tool_call', tool: 'bash', args: 'npm run lint', duration: 2.1, status: 'done' },
      { type: 'tool_call', tool: 'write', args: 'src/components/Feature.tsx', description: 'src/components/Feature.tsx — 新建组件', duration: 0.2, status: 'done' },
      {
        type: 'subagent',
        agentId: 'research-1',
        task: '调研最佳实践和相关依赖',
        status: 'done',
        summary: '推荐使用 React.memo + useMemo 优化',
        blocks: [
          { type: 'skill', skill: 'brainstorming', status: 'done', duration: 0.6 },
          { type: 'tool_call', tool: 'glob', args: 'src/**/*.{ts,tsx}', duration: 0.2, status: 'done' },
          { type: 'tool_call', tool: 'read', args: 'src/components/SessionWindow.tsx', duration: 0.1, status: 'done' },
          { type: 'text', content: '建议优先缓存高频计算结果，并避免在顶层组件中创建不稳定的对象字面量。' },
        ],
      },
      { type: 'askuser', questions: [
        { id: 'q1', question: '是否需要添加国际化支持？', options: ['是，添加 i18n', '否，暂不需要'] },
        { id: 'q2', question: '首选的状态管理方案？', options: ['Context API', 'Zustand', 'Jotai'] },
        { id: 'q3', question: '是否需要 SSR 支持？', options: ['是，使用 Next.js', '否，纯 SPA'] },
      ]},
      { type: 'file_changes', title: '文件差异', files: [
        { path: 'src/components/Feature.tsx', status: 'new', additions: 42, deletions: 0 },
        { path: 'src/components/App.tsx', status: 'modified', additions: 12, deletions: 3 },
        { path: 'src/utils/memoHelper.ts', status: 'new', additions: 28, deletions: 0 },
        { path: 'src/types.ts', status: 'modified', additions: 5, deletions: 1 },
        { path: 'src/legacy/OldFeature.tsx', status: 'deleted', additions: 0, deletions: 45 },
      ]},
      { type: 'text', content: '### 进展总结\n\n已完成核心功能实现：\n\n- **组件创建** — 新建了 Feature 组件\n- **性能优化** — 使用 `React.memo` 减少重渲染\n\n```typescript\nexport const Feature = React.memo(({ data }: Props) => {\n  return <div>{data.title}</div>;\n});\n```\n\n> 等待你的回复后继续下一步。' },
    ]
  },

  // Response 1: Full workflow with tool calls, subagent, and markdown
  {
    blocks: [
      { type: 'text', content: '好的，让我来分析一下这个项目的结构并进行重构。' },
      { type: 'skill', skill: 'brainstorming', status: 'done', duration: 1.2 },
      { type: 'todolist', items: [
        { id: '1', label: '分析现有代码结构', status: 'done' },
        { id: '2', label: '重构认证模块', status: 'done' },
        { id: '3', label: '添加单元测试', status: 'done' },
        { id: '4', label: '更新文档', status: 'in_progress' },
      ]},
      { type: 'tool_call', tool: 'glob', args: 'src/auth/**/*.{ts,tsx}', duration: 0.3, status: 'done' },
      { type: 'tool_call', tool: 'read', args: 'src/auth/AuthProvider.tsx', duration: 0.1, status: 'done' },
      { type: 'tool_call', tool: 'bash', args: 'npm test -- --coverage src/auth/', duration: 3.2, status: 'done' },
      { type: 'tool_call', tool: 'write', args: 'src/auth/AuthProvider.tsx', description: 'src/auth/AuthProvider.tsx — refactored with useReducer', duration: 0.2, status: 'done' },
      { type: 'text', content: '### 重构完成\n\n主要改动：\n\n1. 将 `useState` 替换为 `useReducer`，状态转换更清晰\n2. 提取 token 管理到独立的 `tokenService.ts`\n3. 添加了 **6 个新单元测试**\n4. 测试覆盖率从 *72%* 提升至 *94.3%*\n\n```typescript\nconst authReducer = (state: AuthState, action: AuthAction) => {\n  switch (action.type) {\n    case \'LOGIN_SUCCESS\':\n      return { ...state, user: action.payload, isAuthenticated: true };\n    case \'LOGOUT\':\n      return { ...state, user: null, isAuthenticated: false };\n    default:\n      return state;\n  }\n};\n```\n\n> 所有测试已通过，可以安全合并到主分支。' },
    ]
  },

  // Response 2: Subagent + askuser scenario
  {
    blocks: [
      { type: 'text', content: '我来帮你实现这个功能。先让我研究一下现有代码库。' },
      { type: 'tool_call', tool: 'glob', args: 'src/components/**/*.tsx', duration: 0.2, status: 'done' },
      { type: 'tool_call', tool: 'read', args: 'src/components/App.tsx', duration: 0.1, status: 'done' },
      {
        type: 'subagent',
        agentId: 'explore-1',
        task: '搜索所有使用 useEffect 的组件并分析依赖数组',
        status: 'done',
        summary: '发现 12 个组件，3 个有潜在的依赖问题',
        blocks: [
          { type: 'tool_call', tool: 'glob', args: 'src/components/**/*.tsx', duration: 0.2, status: 'done' },
          { type: 'tool_call', tool: 'read', args: 'src/components/App.tsx', duration: 0.1, status: 'done' },
          { type: 'todolist', items: [
            { id: 'sg-1', label: '定位所有 useEffect 调用点', status: 'done' },
            { id: 'sg-2', label: '检查依赖数组缺失项', status: 'done' },
            { id: 'sg-3', label: '归纳高风险组件', status: 'done' },
          ]},
          { type: 'text', content: '高风险点集中在依赖数组遗漏和闭包引用旧值这两类问题。' },
        ],
      },
      { type: 'askuser', questions: [
        { id: 'r1', question: '我发现了 3 种可能的实现方式，你更倾向于哪种？', options: ['Context API', 'Zustand', '保持 Props Drilling'] },
      ]},
      { type: 'text', content: '在你做出选择之前，让我简要说明每种方案的优劣：\n\n- **Context API** — 零依赖，但可能导致不必要的重渲染\n- **Zustand** — 轻量级状态管理，性能优秀\n- **Props Drilling** — 最简单，但随着组件层级增加会变得难以维护' },
    ]
  },

  // Response 3: Code-heavy with markdown
  {
    blocks: [
      { type: 'text', content: '### 分析完成\n\n我检查了代码库，发现了几个需要修复的关键问题。' },
      { type: 'tool_call', tool: 'grep', args: 'TODO|FIXME|HACK', duration: 0.5, status: 'done' },
      { type: 'tool_call', tool: 'read', args: 'src/utils/helpers.ts', duration: 0.1, status: 'done' },
      { type: 'skill', skill: 'systematic-debugging', status: 'done', duration: 0.8 },
      { type: 'todolist', items: [
        { id: '1', label: '修复内存泄漏问题 (useEffect cleanup)', status: 'done' },
        { id: '2', label: '优化渲染性能 (React.memo)', status: 'done' },
        { id: '3', label: '修复类型定义错误', status: 'pending' },
      ]},
      { type: 'tool_call', tool: 'edit', args: 'src/components/Canvas.tsx', description: 'src/components/Canvas.tsx — 添加 cleanup 函数', duration: 0.2, status: 'done' },
      { type: 'tool_call', tool: 'bash', args: 'npm run lint', duration: 2.1, status: 'done' },
      { type: 'text', content: '已修复前两个问题。以下是关键改动：\n\n```typescript\nuseEffect(() => {\n  const controller = new AbortController();\n  fetchData({ signal: controller.signal });\n  \n  return () => controller.abort();\n}, [sessionId]);\n```\n\n> 性能优化后，重渲染次数减少了 **60%**。\n\n剩余的类型定义问题需要等上游库更新后再处理。' },
    ]
  },

];

/** Plain text mock responses for backward compatibility */
export const PLAIN_MOCK_RESPONSES = [
  "好的，我来帮你分析一下这个问题。\n\n首先，我们需要理解整体架构。这个项目使用了 React 19 + TypeScript + Vite 的技术栈，采用组件化设计，状态通过 props 从 App.tsx 向下传递。\n\n主要的改动点包括：\n1. 修改组件的 props 接口\n2. 添加新的状态管理逻辑\n3. 更新样式以匹配设计稿\n\n让我开始实现这些变更。",
  "我已经检查了代码库，发现了几个关键文件：\n\n```typescript\n// src/types.ts\nexport interface Session {\n  id: string;\n  title: string;\n  model: string;\n  status: SessionStatus;\n  messages: Message[];\n}\n```\n\n这个接口定义了 Session 的核心结构。我建议我们在此基础上扩展，添加必要的字段。\n\n接下来我会修改相关组件，确保类型安全和向后兼容。所有改动都经过了 TypeScript 类型检查。",
  "任务完成！以下是本次修改的摘要：\n\n**修改的文件：**\n- `src/components/SessionWindow.tsx` — 添加了新功能\n- `src/types.ts` — 更新了类型定义\n\n**新增功能：**\n- 支持内联编辑\n- 自动保存机制\n- 键盘快捷键支持（Enter 保存，Escape 取消）\n\n**测试建议：**\n1. 验证编辑功能在各个视图模式下正常工作\n2. 测试边界情况（空字符串、超长文本）\n3. 确认拖拽交互不受影响\n\n如果有任何问题，随时告诉我！"
];
