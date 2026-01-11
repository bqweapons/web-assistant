type MockElement = {
  id: string;
  type: 'button' | 'link' | 'area';
  text: string;
  selector: string;
  position: string;
  style: Record<string, string>;
  pageUrl: string;
  siteUrl: string;
  frameUrl: string;
  frameSelectors: string[];
  floating: boolean;
  createdAt: number;
  updatedAt: number;
  beforeSelector?: string;
  afterSelector?: string;
  actionFlowId?: string;
  actionFlowLocked?: boolean;
  actionFlow?: string;
  containerId?: string;
  scope?: 'page' | 'site' | 'global';
  stylePreset?: string;
  layout?: 'row' | 'column';
  href?: string;
  linkTarget?: 'new-tab' | 'same-tab';
};

type MockFlow = {
  id: string;
  name: string;
  description?: string;
  site: string;
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
    id: '56bb644c-ac15-42cf-a3f6-9b7b7b76f7a4',
    type: 'link',
    text: 'Dashboard',
    href: '/sitesettings/stats',
    linkTarget: 'same-tab',
    selector: 'div#__layout > div > div > header > div',
    position: 'append',
    style: {
      color: '#2563eb',
      fontSize: '11px',
    },
    pageUrl: 'https://note.com',
    siteUrl: 'https://note.com',
    frameUrl: 'https://note.com/',
    frameSelectors: [],
    floating: false,
    createdAt: 1763452627914,
    updatedAt: 1763858504570,
  },
  {
    id: '358dabbd-23f0-437e-be55-9e6d57262199',
    type: 'area',
    text: 'Highlight area',
    selector: 'body',
    position: 'append',
    layout: 'row',
    style: {
      backgroundColor: '#f59e0b30',
      borderRadius: '14px',
      color: '#0f172a',
      height: '80px',
      left: '398px',
      position: 'absolute',
      top: '7px',
      width: '329px',
      zIndex: '2147482000',
    },
    pageUrl: 'https://note.com/sitesettings/stats',
    siteUrl: 'https://note.com',
    frameUrl: 'https://note.com/sitesettings/stats',
    frameSelectors: [],
    floating: true,
    createdAt: 1765326879172,
    updatedAt: 1765326919396,
  },
  {
    id: '9a3dd7c1-d5a4-4003-a259-ffa12e1b6de6',
    type: 'button',
    text: 'Publish',
    selector: 'body',
    actionFlowId: 'flow-publish',
    actionFlowLocked: false,
    containerId: '358dabbd-23f0-437e-be55-9e6d57262199',
    position: 'append',
    style: {
      backgroundColor: '#1b84ff',
      borderRadius: '8px',
      color: '#ffffff',
      fontSize: '12px',
      fontWeight: '600',
    },
    pageUrl: 'https://note.com/',
    siteUrl: 'https://note.com',
    frameUrl: 'https://note.com/sitesettings/stats',
    frameSelectors: [],
    floating: false,
    createdAt: 1765326888518,
    updatedAt: 1765326905920,
  },
];

export const mockFlows: MockFlow[] = [
  {
    id: '7b35d69b',
    name: 'test1',
    description: 'Login flow for the test page.',
    site: 'file://',
    steps: 10,
    updatedAt: '2026-01-03 14:05:08',
  },
  {
    id: 'd183df69',
    name: 'test2',
    description: 'Form submit with validation.',
    site: 'file://',
    steps: 6,
    updatedAt: '2026-01-03 18:22:41',
  },
  {
    id: 'e308ee5c',
    name: 'C23',
    description: 'Core flow for primary actions.',
    site: 'file://',
    steps: 5,
    updatedAt: '2026-01-03 20:09:36',
  },
  {
    id: '466bc61a',
    name: 'template-short',
    description: 'Quick template run.',
    site: 'file://',
    steps: 3,
    updatedAt: '2026-01-03 20:20:16',
  },
  {
    id: 'flow-gmail-1',
    name: 'gmail-cleanup',
    description: 'Archive and label a thread.',
    site: 'mail.google.com',
    steps: 4,
    updatedAt: '2026-01-02 10:02:44',
  },
  {
    id: 'flow-note-1',
    name: 'note-stats',
    description: 'Open stats and export data.',
    site: 'note.com',
    steps: 6,
    updatedAt: '2026-01-02 12:10:31',
  },
  {
    id: 'flow-pay-1',
    name: 'payment-checkout',
    description: 'Fill billing form fields.',
    site: 'pay.openai.com',
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
