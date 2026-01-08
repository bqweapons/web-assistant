type MockElement = {
  id: string;
  label: string;
  type: string;
  site: string;
  page: string;
  scope: string;
  updatedAt: string;
  flowName?: string;
  url?: string;
  areaCount?: number;
  linkTarget?: 'new-tab' | 'same-tab';
  tooltipPosition?: 'top' | 'right' | 'bottom' | 'left';
  tooltipPersistent?: boolean;
  layout?: 'row' | 'column';
};

type MockFlow = {
  id: string;
  name: string;
  description?: string;
  site: string;
  scope: string;
  steps: number;
  updatedAt: string;
};

type MockHiddenRule = {
  id: string;
  name: string;
  note?: string;
  scope: string;
  site: string;
  selector: string;
  updatedAt: string;
  enabled?: boolean;
};

export const mockElements: MockElement[] = [
  {
    id: 'd071b99d',
    label: 'Floating area',
    type: 'Area',
    areaCount: 3,
    site: 'file://',
    page: 'test-page.html',
    scope: 'page',
    updatedAt: '2026-01-03 10:12:04',
  },
  {
    id: '9277912d',
    label: 'middle',
    type: 'Button',
    flowName: 'Form submit',
    site: 'file://',
    page: 'test-page.html',
    scope: 'page',
    updatedAt: '2026-01-03 11:05:22',
  },
  {
    id: 'a000d2a8',
    label: 'Button23',
    type: 'Button',
    flowName: 'Primary action',
    site: 'file://',
    page: 'test-page.html',
    scope: 'page',
    updatedAt: '2026-01-03 16:17:52',
  },
  {
    id: '1fbc2aec',
    label: 'A',
    type: 'Button',
    flowName: 'Onboarding',
    site: 'file://',
    page: 'test-page.html',
    scope: 'site',
    updatedAt: '2026-01-03 19:03:11',
  },
  {
    id: '8b333467',
    label: 'test',
    type: 'Link',
    url: 'https://google.com',
    site: 'mail.google.com',
    page: 'mail.google.com',
    scope: 'site',
    updatedAt: '2026-01-02 09:44:30',
  },
  {
    id: '9148934e',
    label: 'Quick action',
    type: 'Button',
    flowName: 'Archive flow',
    site: 'mail.google.com',
    page: 'mail.google.com',
    scope: 'page',
    updatedAt: '2026-01-02 09:50:12',
  },
  {
    id: '56bb644c',
    label: 'Settings link',
    type: 'Link',
    url: '/sitesettings/stats',
    site: 'note.com',
    page: 'note.com',
    scope: 'site',
    updatedAt: '2026-01-02 11:20:03',
  },
  {
    id: 'e9f65cf7',
    label: 'Stats button',
    type: 'Button',
    flowName: 'Open stats',
    site: 'note.com',
    page: 'note.com/sitesettings/stats',
    scope: 'page',
    updatedAt: '2026-01-02 11:25:49',
  },
  {
    id: '358dabbd',
    label: 'Highlight area',
    type: 'Area',
    areaCount: 2,
    site: 'note.com',
    page: 'note.com/sitesettings/stats',
    scope: 'page',
    updatedAt: '2026-01-02 11:26:31',
  },
  {
    id: '9a3dd7c1',
    label: 'Primary CTA',
    type: 'Button',
    flowName: 'Primary CTA',
    site: 'note.com',
    page: 'note.com/sitesettings/stats',
    scope: 'page',
    updatedAt: '2026-01-02 11:27:10',
  },
  {
    id: 'befa536c',
    label: 'Login',
    type: 'Button',
    flowName: 'Login flow',
    site: 'avanade.service-now.com',
    page: 'avanade.service-now.com',
    scope: 'site',
    updatedAt: '2026-01-01 08:14:03',
  },
  {
    id: 'ed2ea86e',
    label: 'Add info',
    type: 'Button',
    flowName: 'Billing form',
    site: 'pay.openai.com',
    page: 'pay.openai.com',
    scope: 'page',
    updatedAt: '2026-01-01 14:44:50',
  },
  {
    id: '79524958',
    label: 'Login',
    type: 'Button',
    flowName: 'Login flow',
    site: 'type.jp',
    page: 'type.jp/login',
    scope: 'page',
    updatedAt: '2026-01-01 09:10:40',
  },
  {
    id: 'file0001',
    label: 'CTA banner',
    type: 'Area',
    areaCount: 4,
    site: 'file://',
    page: 'test-page2.html',
    scope: 'page',
    updatedAt: '2026-01-03 21:10:18',
  },
  {
    id: 'file0002',
    label: 'Submit button',
    type: 'Button',
    flowName: 'Submit form',
    site: 'file://',
    page: 'test-page2.html',
    scope: 'page',
    updatedAt: '2026-01-03 21:12:05',
  },
  {
    id: 'file0003',
    label: 'Helper tip',
    type: 'Tooltip',
    site: 'file://',
    page: 'test-page3.html',
    scope: 'page',
    updatedAt: '2026-01-03 21:18:44',
  },
  {
    id: 'file0004',
    label: 'Footer link',
    type: 'Link',
    url: 'https://example.com/docs',
    site: 'file://',
    page: 'test-page3.html',
    scope: 'page',
    updatedAt: '2026-01-03 21:22:51',
  },
  {
    id: 'note0001',
    label: 'Editor button',
    type: 'Button',
    flowName: 'Publish flow',
    site: 'note.com',
    page: 'note.com/editor',
    scope: 'page',
    updatedAt: '2026-01-02 12:40:03',
  },
  {
    id: 'note0002',
    label: 'Draft link',
    type: 'Link',
    url: '/drafts',
    site: 'note.com',
    page: 'note.com/drafts',
    scope: 'page',
    updatedAt: '2026-01-02 12:44:57',
  },
  {
    id: 'gmail001',
    label: 'Archive pill',
    type: 'Button',
    flowName: 'Archive flow',
    site: 'mail.google.com',
    page: 'mail.google.com/inbox',
    scope: 'page',
    updatedAt: '2026-01-02 10:20:39',
  },
  {
    id: 'gmail002',
    label: 'Label chip',
    type: 'Button',
    flowName: 'Label flow',
    site: 'mail.google.com',
    page: 'mail.google.com/inbox',
    scope: 'page',
    updatedAt: '2026-01-02 10:22:18',
  },
];

export const mockFlows: MockFlow[] = [
  {
    id: '7b35d69b',
    name: 'test1',
    description: 'Login flow for the test page.',
    site: 'file://',
    scope: 'site',
    steps: 10,
    updatedAt: '2026-01-03 14:05:08',
  },
  {
    id: 'd183df69',
    name: 'test2',
    description: 'Form submit with validation.',
    site: 'file://',
    scope: 'page',
    steps: 6,
    updatedAt: '2026-01-03 18:22:41',
  },
  {
    id: 'e308ee5c',
    name: 'C23',
    description: 'Core flow for primary actions.',
    site: 'file://',
    scope: 'global',
    steps: 5,
    updatedAt: '2026-01-03 20:09:36',
  },
  {
    id: '466bc61a',
    name: 'template-short',
    description: 'Quick template run.',
    site: 'file://',
    scope: 'global',
    steps: 3,
    updatedAt: '2026-01-03 20:20:16',
  },
  {
    id: 'flow-gmail-1',
    name: 'gmail-cleanup',
    description: 'Archive and label a thread.',
    site: 'mail.google.com',
    scope: 'page',
    steps: 4,
    updatedAt: '2026-01-02 10:02:44',
  },
  {
    id: 'flow-note-1',
    name: 'note-stats',
    description: 'Open stats and export data.',
    site: 'note.com',
    scope: 'site',
    steps: 6,
    updatedAt: '2026-01-02 12:10:31',
  },
  {
    id: 'flow-pay-1',
    name: 'payment-checkout',
    description: 'Fill billing form fields.',
    site: 'pay.openai.com',
    scope: 'page',
    steps: 5,
    updatedAt: '2026-01-01 15:01:28',
  },
];

export const mockHiddenRules: MockHiddenRule[] = [
  {
    id: 'e8611d35',
    name: 'Hidden rule',
    note: 'Auto-hide popup ads.',
    scope: 'page',
    site: '51cg1.com',
    selector: 'div.adspop',
    updatedAt: '2026-01-03 12:01:11',
    enabled: true,
  },
  {
    id: 'ca5d7ab9',
    name: 'Hidden rule',
    note: 'Hide sticky chat widget.',
    scope: 'page',
    site: 'missav.ai',
    selector: 'div.bottomRight--h0VsQ',
    updatedAt: '2026-01-03 12:05:42',
    enabled: true,
  },
  {
    id: '9157b809',
    name: 'Hidden rule',
    note: 'Suppress header ads.',
    scope: 'page',
    site: 'www.yahoo.co.jp',
    selector: '#google_ads_iframe_/21827365205',
    updatedAt: '2026-01-03 12:20:05',
    enabled: true,
  },
  {
    id: 'd397b324',
    name: 'Hidden rule',
    note: 'Remove right rail promos.',
    scope: 'page',
    site: 'www.yahoo.co.jp',
    selector: 'div._2KBoKJuH-NgDoy7jHj4A7f',
    updatedAt: '2026-01-03 12:22:49',
    enabled: true,
  },
  {
    id: '039fe1fb',
    name: 'Hidden rule',
    note: 'Remove post card ads.',
    scope: 'page',
    site: '51cg1.com',
    selector: 'div.post-card-ads',
    updatedAt: '2026-01-03 12:30:02',
    enabled: true,
  },
  {
    id: '1806d3b2',
    name: 'Hidden rule',
    note: 'Hide horizontal banner.',
    scope: 'page',
    site: '51cg1.com',
    selector: 'div.horizontal-banner',
    updatedAt: '2026-01-03 12:31:18',
    enabled: true,
  },
  {
    id: 'rule-yahoo-3',
    name: 'Hidden rule',
    note: 'Hide footer widgets.',
    scope: 'page',
    site: 'www.yahoo.co.jp',
    selector: 'div.footer-ads',
    updatedAt: '2026-01-03 12:35:47',
    enabled: true,
  },
];
