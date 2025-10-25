const baseMessages = {
  app: {
    title: 'Page Augmentor',
    subtitle: 'Create custom UI for this page and review saved elements everywhere.',
    language: {
      label: 'Language',
    },
  },
  context: {
    loading: 'Loading active page...',
    noActiveTab: 'No active tab found.',
    resolveError: 'Unable to resolve active tab: {error}',
    pageUrlUnavailable: 'The page URL is not available yet.',
    tabUnavailable: 'Unable to identify the active tab.',
    focusRequiresActivation: 'Activate the tab before focusing an element.',
  },
  manage: {
    loadError: 'Unable to load elements: {error}',
    picker: {
      selectedWithPreview: 'Selected {preview}.',
      selected: 'Target selected.',
      cancelled: 'Selection cancelled.',
      instructions: 'Click an element on the page to select it.',
      startError: 'Unable to start picker: {error}',
    },
    delete: {
      confirm: 'Delete this element?',
      success: 'Element deleted.',
      error: 'Unable to delete the element: {error}',
    },
    export: {
      success: 'Downloaded {filename}.',
      error: 'Unable to export data: {error}',
    },
    import: {
      success: 'Imported {elements} elements across {pages} pages.',
      error: 'Unable to import data: {error}',
    },
    focusError: 'Unable to focus the element: {error}',
    openBubble: {
      success: 'Opened the bubble editor on the page.',
      error: 'Unable to open the bubble: {error}',
    },
    sections: {
      add: {
        title: 'Add element',
        description: 'Pick a target on the page to open the bubble editor.',
      },
      filters: {
        searchLabel: 'Search',
        searchPlaceholder: 'Filter by text, selector, or URL',
        filterLabel: 'Filter',
        options: {
          all: 'All',
          button: 'Button',
          link: 'Link',
          tooltip: 'Tooltip',
        },
      },
    },
    actions: {
      pick: 'Pick target',
      picking: 'Picking...',
      cancel: 'Cancel',
      export: 'Export data',
      exporting: 'Exporting...',
      import: 'Import data',
      importing: 'Importing...',
    },
    empty: 'No elements match the current filters.',
    item: {
      noText: '(No text)',
      actionSelector: 'Forward clicks to: {selector}',
      actionFlow: 'Flow configured ({steps} steps)',
      frameContext: 'Frame: {frame}',
      frameFallback: 'Unnamed frame',
      tooltipDetails: 'Placement: {position} / {mode}',
      focus: 'Focus',
      openBubble: 'Open bubble',
      delete: 'Delete',
    },
  },
  type: {
    button: 'Button',
    link: 'Link',
    tooltip: 'Tooltip',
  },
  tooltip: {
    position: {
      top: 'Top',
      right: 'Right',
      bottom: 'Bottom',
      left: 'Left',
    },
    mode: {
      persistent: 'Always visible',
      hover: 'Show on hover/focus',
    },
  },
  picker: {
    previewTarget: 'Target element',
  },
  overview: {
    heading: 'All saved elements',
    pageCount: {
      label: 'Pages',
    },
    elementCount: {
      label: 'Elements',
    },
    refresh: 'Refresh',
    refreshing: 'Refreshing...',
    empty: 'No elements have been saved yet.',
    pageSummary: '{count} elements',
    openPage: 'Open page',
    clearPage: 'Clear page',
    clearConfirm: 'Remove all elements saved for this page?',
    clearSuccess: 'Cleared every element for the page.',
    clearError: 'Unable to clear the page: {error}',
    deleteConfirm: 'Delete this element?',
    deleteSuccess: 'Element deleted.',
    deleteError: 'Unable to delete the element: {error}',
    focusError: 'Unable to focus the element: {error}',
    openBubbleError: 'Unable to open the bubble: {error}',
    openedNewTab: 'Opened a new tab. Open the side panel manually, then try again.',
    statusLoadError: 'Unable to load data: {error}',
  },
  editor: {
    title: 'Configure element',
    titleCreate: 'Add element',
    titleEdit: 'Edit element',
    selectorLabel: 'Target selector',
    previewLabel: 'Live preview',
    typeLabel: 'Element type',
    textLabel: 'Text',
    textPlaceholder: 'Element text',
    tooltipTextPlaceholder: 'Tooltip text',
    hrefLabel: 'Link URL',
    hrefOptionalLabel: 'Optional URL',
    hrefTooltipLabel: 'Link URL',
    hrefPlaceholder: 'https://example.com',
    hrefOptionalPlaceholder: 'https://example.com (optional)',
    hrefTooltipPlaceholder: 'Tooltips do not need a URL',
    actionLabel: 'Click action (optional)',
    actionPlaceholder: 'e.g. #submit-button',
    actionPick: 'Capture from page',
    actionCancel: 'Cancel selection',
    actionHintDefault: 'Pick an existing button to copy its click behavior.',
    actionHintSelected: 'Clicks will forward to "{selector}"',
    actionHintPicking: 'Click the button to copy (Esc to cancel).',
    actionFlowLabel: 'Action flow (optional)',
    actionFlowPlaceholder: '[\n  {"type":"click","selector":"#target"}\n]',
    actionFlowHintDefault:
      'Optional JSON array describing sequential steps (max {limit} chars). Supports click, wait, input, if, while, navigate.',
    actionFlowHintConfigured: 'Flow configured with {count} step(s).',
    actionFlowHintError: 'Flow error: {error}',
    tooltipPositionLabel: 'Tooltip placement',
    tooltipPersistenceLabel: 'Display',
    tooltipPersistenceCheckbox: 'Keep tooltip visible',
    tooltipPersistenceHint: 'When disabled, the tooltip appears on hover or focus.',
    positionLabel: 'Insertion position',
    actionBuilder: {
      add: 'Add action',
      empty: 'No actions yet. Use "Add action" to build a sequence.',
      advancedNotice: 'This flow uses advanced features. Edit the JSON directly below.',
      typeLabel: 'Action type',
      selectorLabel: 'Target selector',
      selectorPlaceholder: 'CSS selector for the target element',
      valueLabel: 'Text to enter',
      valuePlaceholder: 'Content to type',
      delayLabel: 'Wait duration (ms)',
      pick: 'Pick element',
      remove: 'Remove',
      type: {
        click: 'Click element',
        input: 'Fill input',
        wait: 'Wait',
      },
      error: {
        selector: 'Step #{index} requires a selector.',
        value: 'Step #{index} requires input text.',
        delay: 'Step #{index} requires a non-negative wait time.',
      },
    },
    sections: {
      basics: {
        title: 'Basics',
        description: 'Choose the element type and the text visitors will see.',
      },
      behavior: {
        title: 'Behavior and actions',
        description: 'Control destination links, click forwarding, and optional flows.',
      },
      tooltip: {
        title: 'Tooltip options',
        description: 'Decide how the tooltip should appear for visitors.',
      },
      placement: {
        title: 'Placement',
        description: 'Select where to insert the element relative to the target.',
      },
      appearance: {
        title: 'Appearance',
        description: 'Fine-tune colors, spacing, and other visual styles.',
      },
    },
    stylesLegend: 'Style settings',
    stylesHint: 'Leave fields blank to use the defaults.',
    styles: {
      color: 'Text color',
      backgroundColor: 'Background color',
      fontSize: 'Font size',
      fontWeight: 'Font weight',
      padding: 'Padding',
      borderRadius: 'Border radius',
      textDecoration: 'Text decoration',
    },
    cancel: 'Cancel',
    save: 'Save',
    saveCreate: 'Create',
    saveUpdate: 'Save changes',
    errorTextRequired: 'Enter text for the element.',
    errorUrlRequired: 'Links require a URL.',
    errorFlowInvalid: 'Invalid action flow: {error}',
    previewButton: 'Button preview',
    previewLink: 'Link preview',
    previewTooltip: 'Tooltip preview',
  },
  position: {
    append: 'Append to end',
    prepend: 'Insert at start',
    before: 'Insert before',
    after: 'Insert after',
  },
};

function cloneMessages(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeMessages(target, source) {
  Object.keys(source).forEach((key) => {
    const value = source[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      mergeMessages(target[key], value);
    } else {
      target[key] = value;
    }
  });
}

const jaMessages = cloneMessages(baseMessages);
mergeMessages(jaMessages, {
  app: {
    subtitle: 'このページ向けのカスタムUIを作成し、保存した要素をいつでも確認できます。',
    language: { label: '言語' },
  },
  context: {
    loading: 'アクティブなページを読み込み中...',
    noActiveTab: 'アクティブなタブが見つかりません。',
    resolveError: 'アクティブなタブを取得できません: {error}',
    pageUrlUnavailable: 'ページのURLはまだ利用できません。',
    tabUnavailable: 'アクティブなタブを特定できません。',
    focusRequiresActivation: '要素をフォーカスする前にタブをアクティブにしてください。',
  },
  manage: {
    loadError: '要素を読み込めませんでした: {error}',
    picker: {
      selectedWithPreview: '{preview} を選択しました。',
      selected: 'ターゲットを選択しました。',
      cancelled: '選択をキャンセルしました。',
      instructions: 'ページ上の要素をクリックして選択してください。',
      startError: '要素の選択を開始できません: {error}',
    },
    delete: {
      confirm: 'この要素を削除しますか？',
      success: '要素を削除しました。',
      error: '要素を削除できませんでした: {error}',
    },
    export: {
      success: '{filename} をダウンロードしました。',
      error: 'データをエクスポートできませんでした: {error}',
    },
    import: {
      success: '{pages} ページに {elements} 件の要素を読み込みました。',
      error: 'データをインポートできませんでした: {error}',
    },
    focusError: '要素をフォーカスできませんでした: {error}',
    openBubble: {
      success: 'ページでバブルエディターを開きました。',
      error: 'バブルを開けませんでした: {error}',
    },
    sections: {
      add: {
        title: '要素を追加',
        description: 'ページでターゲット要素を選択するとバブルエディターが開きます。',
      },
      filters: {
        searchLabel: '検索',
        searchPlaceholder: 'テキスト・セレクター・URLでフィルター',
        filterLabel: 'フィルター',
        options: {
          all: 'すべて',
          button: 'ボタン',
          link: 'リンク',
          tooltip: 'ツールチップ',
        },
      },
    },
    actions: {
      pick: 'ターゲットを選択',
      picking: '選択中...',
      cancel: 'キャンセル',
      export: 'エクスポート',
      exporting: 'エクスポート中...',
      import: 'インポート',
      importing: 'インポート中...',
    },
    empty: '条件に一致する要素がありません。',
    item: {
      noText: '(テキストなし)',
      actionSelector: 'クリックを転送: {selector}',
      actionFlow: 'フロー設定済み ({steps} ステップ)',
      frameContext: 'フレーム: {frame}',
      frameFallback: '名称未設定のフレーム',
      tooltipDetails: '位置: {position} / {mode}',
      focus: 'フォーカス',
      openBubble: 'バブルを開く',
      delete: '削除',
    },
  },
  type: {
    button: 'ボタン',
    link: 'リンク',
    tooltip: 'ツールチップ',
  },
  tooltip: {
    position: {
      top: '上',
      right: '右',
      bottom: '下',
      left: '左',
    },
    mode: {
      persistent: '常に表示',
      hover: 'ホバー/フォーカス時に表示',
    },
  },
  picker: {
    previewTarget: '対象要素',
  },
  overview: {
    heading: '保存済み要素一覧',
    pageCount: {
      label: 'ページ数',
    },
    elementCount: {
      label: '要素数',
    },
    refresh: '更新',
    refreshing: '更新中...',
    empty: 'まだ保存された要素はありません。',
    pageSummary: '{count} 件の要素',
    openPage: 'ページを開く',
    clearPage: 'ページをクリア',
    clearConfirm: 'このページの要素をすべて削除しますか？',
    clearSuccess: 'ページの要素をすべて削除しました。',
    clearError: 'ページの要素を削除できませんでした: {error}',
    deleteConfirm: 'この要素を削除しますか？',
    deleteSuccess: '要素を削除しました。',
    deleteError: '要素を削除できませんでした: {error}',
    focusError: '要素をフォーカスできませんでした: {error}',
    openBubbleError: 'バブルを開けませんでした: {error}',
    openedNewTab: '新しいタブを開きました。サイドパネルを開いてからもう一度お試しください。',
    statusLoadError: 'データを読み込めませんでした: {error}',
  },
  editor: {
    title: '要素を設定',
    titleCreate: '要素を追加',
    titleEdit: '要素を編集',
    selectorLabel: '対象セレクター',
    previewLabel: 'ライブプレビュー',
    typeLabel: '要素タイプ',
    textLabel: 'テキスト',
    textPlaceholder: '要素のテキスト',
    tooltipTextPlaceholder: 'ツールチップのテキスト',
    hrefLabel: 'リンクURL',
    hrefOptionalLabel: '任意のURL',
    hrefTooltipLabel: 'リンクURL',
    hrefPlaceholder: 'https://example.com',
    hrefOptionalPlaceholder: 'https://example.com (任意)',
    hrefTooltipPlaceholder: 'ツールチップにURLは不要です',
    actionLabel: 'クリックアクション (任意)',
    actionPlaceholder: '例: #submit-button',
    actionPick: 'ページから取得',
    actionCancel: '選択をキャンセル',
    actionHintDefault: '既存のボタンを選ぶと、そのクリック動作をコピーできます。',
    actionHintSelected: 'クリックは「{selector}」に転送されます。',
    actionHintPicking: 'コピーしたいボタンをクリックしてください (Escでキャンセル)。',
    actionFlowLabel: 'アクションフロー (任意)',
    actionFlowPlaceholder: '[\n  {"type":"click","selector":"#target"}\n]',
    actionFlowHintDefault:
      '連続する操作をJSON配列で記述します (最大 {limit} 文字)。click、wait、input、if、while、navigateをサポートします。',
    actionFlowHintConfigured: '{count} ステップで構成されたフローです。',
    actionFlowHintError: 'フローエラー: {error}',
    tooltipPositionLabel: 'ツールチップ位置',
    tooltipPersistenceLabel: '表示方法',
    tooltipPersistenceCheckbox: '常に表示する',
    tooltipPersistenceHint: 'オフの場合はホバーまたはフォーカス時に表示されます。',
    positionLabel: '挿入位置',
    actionBuilder: {
      add: 'アクションを追加',
      empty: 'まだアクションがありません。「アクションを追加」を押してステップを作成してください。',
      advancedNotice: 'このフローは高度な設定を含みます。下の JSON を直接編集してください。',
      typeLabel: 'アクション種類',
      selectorLabel: '対象セレクター',
      selectorPlaceholder: '操作対象の CSS セレクター',
      valueLabel: '入力する内容',
      valuePlaceholder: '入力するテキスト',
      delayLabel: '待機時間 (ミリ秒)',
      pick: '要素を選択',
      remove: '削除',
      type: {
        click: '要素をクリック',
        input: 'テキストを入力',
        wait: '待機',
      },
      error: {
        selector: 'ステップ #{index} にセレクターを指定してください。',
        value: 'ステップ #{index} に入力内容を指定してください。',
        delay: 'ステップ #{index} の待機時間は 0 以上で指定してください。',
      },
    },
    sections: {
      basics: {
        title: '基本設定',
        description: '要素タイプと表示するテキストを選択します。',
      },
      behavior: {
        title: '挙動とアクション',
        description: 'リンク先、クリック転送、任意フローを設定します。',
      },
      tooltip: {
        title: 'ツールチップ設定',
        description: '訪問者にどのように表示するかを指定します。',
      },
      placement: {
        title: '配置',
        description: '対象との位置関係を選択します。',
      },
      appearance: {
        title: '見た目',
        description: '色・余白などのスタイルを調整します。',
      },
    },
    stylesLegend: 'スタイル設定',
    stylesHint: '空欄の項目はデフォルト値を使用します。',
    styles: {
      color: '文字色',
      backgroundColor: '背景色',
      fontSize: 'フォントサイズ',
      fontWeight: 'フォント太さ',
      padding: '余白',
      borderRadius: '角丸',
      textDecoration: '装飾',
    },
    cancel: 'キャンセル',
    save: '保存',
    saveCreate: '作成',
    saveUpdate: '変更を保存',
    errorTextRequired: '要素のテキストを入力してください。',
    errorUrlRequired: 'リンクにはURLが必要です。',
    errorFlowInvalid: 'アクションフローが正しくありません: {error}',
    previewButton: 'ボタンのプレビュー',
    previewLink: 'リンクのプレビュー',
    previewTooltip: 'ツールチップのプレビュー',
  },
  position: {
    append: '末尾に追加',
    prepend: '先頭に挿入',
    before: '前に挿入',
    after: '後ろに挿入',
  },
});

const zhCNMessages = cloneMessages(baseMessages);
mergeMessages(zhCNMessages, {
  app: {
    subtitle: '为当前页面创建自定义界面，并在任意位置查看已保存的元素。',
    language: { label: '语言' },
  },
  context: {
    loading: '正在加载活动页面...',
    noActiveTab: '未找到活动标签页。',
    resolveError: '无法定位活动标签页：{error}',
    pageUrlUnavailable: '页面 URL 尚不可用。',
    tabUnavailable: '无法识别活动标签页。',
    focusRequiresActivation: '聚焦元素前请先激活标签页。',
  },
  manage: {
    loadError: '无法加载元素：{error}',
    picker: {
      selectedWithPreview: '已选择 {preview}。',
      selected: '已选择目标。',
      cancelled: '已取消选择。',
      instructions: '点击页面上的元素进行选择。',
      startError: '无法启动选择器：{error}',
    },
    delete: {
      confirm: '确定要删除此元素吗？',
      success: '元素已删除。',
      error: '无法删除该元素：{error}',
    },
    export: {
      success: '{filename} 下载完成。',
      error: '无法导出数据：{error}',
    },
    import: {
      success: '已在 {pages} 个页面中导入 {elements} 个元素。',
      error: '无法导入数据：{error}',
    },
    focusError: '无法定位到该元素：{error}',
    openBubble: {
      success: '已在页面中打开气泡编辑器。',
      error: '无法打开气泡：{error}',
    },
    sections: {
      add: {
        title: '添加元素',
        description: '选择页面上的目标元素以打开气泡编辑器。',
      },
      filters: {
        searchLabel: '搜索',
        searchPlaceholder: '按文本、选择器或 URL 过滤',
        filterLabel: '筛选',
        options: {
          all: '全部',
          button: '按钮',
          link: '链接',
          tooltip: '提示',
        },
      },
    },
    actions: {
      pick: '选择目标',
      picking: '选择中...',
      cancel: '取消',
      export: '导出数据',
      exporting: '正在导出...',
      import: '导入数据',
      importing: '正在导入...',
    },
    empty: '没有符合条件的元素。',
    item: {
      noText: '（无文本）',
      actionSelector: '转发点击到：{selector}',
      actionFlow: '已配置流程（{steps} 步）',
      frameContext: '框架：{frame}',
      frameFallback: '未命名框架',
      tooltipDetails: '位置：{position} / {mode}',
      focus: '定位',
      openBubble: '打开气泡',
      delete: '删除',
    },
  },
  type: {
    button: '按钮',
    link: '链接',
    tooltip: '提示',
  },
  tooltip: {
    position: {
      top: '上',
      right: '右',
      bottom: '下',
      left: '左',
    },
    mode: {
      persistent: '始终显示',
      hover: '悬停或聚焦时显示',
    },
  },
  picker: {
    previewTarget: '目标元素',
  },
  overview: {
    heading: '已保存元素',
    pageCount: {
      label: '页面',
    },
    elementCount: {
      label: '元素',
    },
    refresh: '刷新',
    refreshing: '正在刷新...',
    empty: '当前尚未保存任何元素。',
    pageSummary: '{count} 个元素',
    openPage: '打开页面',
    clearPage: '清空页面',
    clearConfirm: '确定要清除该页面保存的全部元素吗？',
    clearSuccess: '已清除该页面的所有元素。',
    clearError: '无法清除页面：{error}',
    deleteConfirm: '确定要删除此元素吗？',
    deleteSuccess: '元素已删除。',
    deleteError: '无法删除该元素：{error}',
    focusError: '无法定位到该元素：{error}',
    openBubbleError: '无法打开气泡：{error}',
    openedNewTab: '已打开新的标签页。请手动打开侧边栏后重试。',
    statusLoadError: '无法加载数据：{error}',
  },
  editor: {
    title: '配置元素',
    titleCreate: '添加元素',
    titleEdit: '编辑元素',
    selectorLabel: '目标选择器',
    previewLabel: '实时预览',
    typeLabel: '元素类型',
    textLabel: '文本',
    textPlaceholder: '元素文本',
    tooltipTextPlaceholder: '提示文本',
    hrefLabel: '链接地址',
    hrefOptionalLabel: '可选地址',
    hrefTooltipLabel: '链接地址',
    hrefPlaceholder: 'https://example.com',
    hrefOptionalPlaceholder: 'https://example.com（可选）',
    hrefTooltipPlaceholder: '提示无需填写链接地址',
    actionLabel: '点击动作（可选）',
    actionPlaceholder: '例如：#submit-button',
    actionPick: '从页面选取',
    actionCancel: '取消选择',
    actionHintDefault: '选择现有按钮即可复制其点击行为。',
    actionHintSelected: '点击事件将转发到“{selector}”。',
    actionHintPicking: '点击要复制的按钮（按 Esc 取消）。',
    actionFlowLabel: '动作流程（可选）',
    actionFlowPlaceholder: '[\n  {"type":"click","selector":"#target"}\n]',
    actionFlowHintDefault:
      '使用 JSON 数组描述连续步骤（最多 {limit} 个字符）。支持 click、wait、input、if、while、navigate。',
    actionFlowHintConfigured: '已配置 {count} 个步骤的流程。',
    actionFlowHintError: '流程错误：{error}',
    tooltipPositionLabel: '提示位置',
    tooltipPersistenceLabel: '显示模式',
    tooltipPersistenceCheckbox: '始终显示提示',
    tooltipPersistenceHint: '关闭后仅在悬停或聚焦时显示。',
    positionLabel: '插入位置',
    actionBuilder: {
      add: '新增动作',
      empty: '暂无动作。点击“新增动作”开始构建流程。',
      advancedNotice: '该流程包含高级设置，请直接编辑下方的 JSON。',
      typeLabel: '动作类型',
      selectorLabel: '目标选择器',
      selectorPlaceholder: '需要操作的 CSS 选择器',
      valueLabel: '输入内容',
      valuePlaceholder: '要填写的文本',
      delayLabel: '等待时长（毫秒）',
      pick: '拾取元素',
      remove: '删除',
      type: {
        click: '点击元素',
        input: '填写输入框',
        wait: '等待',
      },
      error: {
        selector: '步骤 #{index} 需要指定选择器。',
        value: '步骤 #{index} 需要指定输入内容。',
        delay: '步骤 #{index} 的等待时间必须大于等于 0。',
      },
    },
    sections: {
      basics: {
        title: '基础',
        description: '选择元素类型以及访客看到的文本。',
      },
      behavior: {
        title: '行为与动作',
        description: '设置链接去向、点击转发和可选流程。',
      },
      tooltip: {
        title: '提示选项',
        description: '决定提示对访客的展示方式。',
      },
      placement: {
        title: '放置位置',
        description: '选择相对目标的插入位置。',
      },
      appearance: {
        title: '外观',
        description: '微调颜色、间距等样式。',
      },
    },
    stylesLegend: '样式设置',
    stylesHint: '留空则使用默认值。',
    styles: {
      color: '文字颜色',
      backgroundColor: '背景颜色',
      fontSize: '字号',
      fontWeight: '字重',
      padding: '内边距',
      borderRadius: '圆角',
      textDecoration: '文本装饰',
    },
    cancel: '取消',
    save: '保存',
    saveCreate: '创建',
    saveUpdate: '保存更改',
    errorTextRequired: '请输入元素文本。',
    errorUrlRequired: '链接需要填写 URL。',
    errorFlowInvalid: '动作流程无效：{error}',
    previewButton: '按钮预览',
    previewLink: '链接预览',
    previewTooltip: '提示预览',
  },
  position: {
    append: '追加到末尾',
    prepend: '插入到开头',
    before: '插入到前面',
    after: '插入到后面',
  },
});

const messages = {
  en: baseMessages,
  ja: jaMessages,
  'zh-CN': zhCNMessages,
};

const SUPPORTED_LOCALES = Object.keys(messages);
const FALLBACK_LOCALE = 'en';

const LOCALE_LABELS = {
  en: 'English',
  ja: '日本語',
  'zh-CN': '简体中文',
};

const STORAGE_KEY = 'pageAugmentor.locale';

const systemLocale = resolveLocale(typeof navigator !== 'undefined' ? navigator.language : FALLBACK_LOCALE);

let currentLocale = systemLocale;
const subscribers = new Set();

/**
 * Resolves a locale string to the closest supported locale.
 * @param {string} input
 * @returns {keyof typeof messages}
 */
export function resolveLocale(input) {
  if (!input) {
    return FALLBACK_LOCALE;
  }
  const normalized = String(input).trim();
  if (messages[normalized]) {
    return /** @type {keyof typeof messages} */ (normalized);
  }
  const lower = normalized.toLowerCase();
  const direct = SUPPORTED_LOCALES.find((locale) => locale.toLowerCase() === lower);
  if (direct) {
    return /** @type {keyof typeof messages} */ (direct);
  }
  const base = lower.split('-')[0];
  const baseMatch = SUPPORTED_LOCALES.find(
    (locale) => locale.toLowerCase() === base || locale.toLowerCase().startsWith(`${base}-`),
  );
  if (baseMatch) {
    return /** @type {keyof typeof messages} */ (baseMatch);
  }
  return FALLBACK_LOCALE;
}

/**
 * Returns the currently active locale.
 * @returns {keyof typeof messages}
 */
export function getLocale() {
  return currentLocale;
}

/**
 * Updates the active locale and notifies subscribers.
 * @param {string} locale
 * @returns {keyof typeof messages}
 */
export function setLocale(locale) {
  const resolved = resolveLocale(locale);
  if (resolved === currentLocale) {
    return currentLocale;
  }
  currentLocale = resolved;
  persistLocale(resolved);
  notifySubscribers();
  return currentLocale;
}

/**
 * Persists the current locale to storage when available.
 * @param {string} locale
 */
function persistLocale(locale) {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ [STORAGE_KEY]: locale });
    }
  } catch (_error) {
    // Ignore persistence failures.
  }
}

/**
 * Notifies all subscribed listeners of the locale change.
 */
function notifySubscribers() {
  subscribers.forEach((listener) => {
    try {
      listener(currentLocale);
    } catch (_error) {
      // Ignore listener failures.
    }
  });
}

/**
 * Subscribes to locale changes.
 * @param {(locale: keyof typeof messages) => void} listener
 * @returns {() => void}
 */
export function subscribe(listener) {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

/**
 * Retrieves a localized string for the provided key.
 * @param {string} key
 * @param {Record<string, string | number>} [values]
 * @returns {string}
 */
export function t(key, values) {
  const localeMessage = resolveMessage(messages[currentLocale], key);
  const fallbackMessage = localeMessage === undefined ? resolveMessage(messages[FALLBACK_LOCALE], key) : undefined;
  const template = localeMessage ?? fallbackMessage;
  if (typeof template !== 'string') {
    return key;
  }
  if (!values) {
    return template;
  }
  return template.replace(/\{([^}]+)\}/g, (match, token) => {
    if (Object.prototype.hasOwnProperty.call(values, token)) {
      return String(values[token]);
    }
    return match;
  });
}

/**
 * Resolves a nested value from the messages object.
 * @param {any} source
 * @param {string} key
 * @returns {unknown}
 */
function resolveMessage(source, key) {
  if (!source) {
    return undefined;
  }
  return key.split('.').reduce((value, part) => {
    if (value && typeof value === 'object' && part in value) {
      return value[part];
    }
    return undefined;
  }, source);
}

/**
 * Returns the available locale options with labels.
 * @returns {{ value: string; label: string }[]}
 */
export function getLocaleOptions() {
  const seen = new Set();
  const ordered = [currentLocale, ...SUPPORTED_LOCALES];
  return ordered
    .filter((locale) => {
      if (seen.has(locale)) {
        return false;
      }
      seen.add(locale);
      return true;
    })
    .map((locale) => ({
      value: locale,
      label: LOCALE_LABELS[locale] || locale,
    }));
}

/**
 * Formats a timestamp using the active locale.
 * @param {number} timestamp
 * @returns {string}
 */
export function formatDateTime(timestamp) {
  try {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat(currentLocale, {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(date);
  } catch (_error) {
    const date = new Date(timestamp);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  }
}

/**
 * Loads any persisted locale preference.
 * @returns {Promise<keyof typeof messages>}
 */
async function loadPersistedLocale() {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return currentLocale;
  }
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const stored = result?.[STORAGE_KEY];
    if (stored) {
      const resolved = resolveLocale(stored);
      if (resolved !== currentLocale) {
        currentLocale = resolved;
        notifySubscribers();
      }
    }
  } catch (_error) {
    // Ignore retrieval failures.
  }
  return currentLocale;
}

export const ready = loadPersistedLocale();

export const SYSTEM_LOCALE = systemLocale;
export const SUPPORTED = SUPPORTED_LOCALES;
export const DEFAULT_LOCALE = FALLBACK_LOCALE;
