import { defineConfig } from 'vitepress';
import { localSearchOptions, publicDocsSrcExclude } from './searchIndexPolicy';

const enNav = [
  { text: 'Guide', link: '/guide/getting-started' },
  { text: 'Architecture', link: '/core/architecture' },
  { text: 'API Reference', link: '/reference/api-reference' },
  { text: 'Reference', link: '/reference/commands' },
  { text: 'Contributing', link: '/contributing/' },
];

const zhNav = [
  { text: '指南', link: '/zh-CN/guide/getting-started' },
  { text: '架构', link: '/zh-CN/core/architecture' },
  { text: 'API 参考', link: '/zh-CN/reference/api-reference' },
  { text: '参考', link: '/zh-CN/reference/commands' },
  { text: '贡献', link: '/zh-CN/contributing/' },
];

const enSidebar = {
  '/guide/': [
    {
      text: 'Guide',
      items: [
        { text: 'Getting Started', link: '/guide/getting-started' },
        { text: 'Application Modes', link: '/guide/application-modes' },
        { text: 'Install And Deploy', link: '/guide/install-and-deploy' },
        { text: 'Development', link: '/guide/development' },
      ],
    },
  ],
  '/core/': [
    {
      text: 'Architecture',
      items: [
        { text: 'Architecture', link: '/core/architecture' },
        { text: 'Packages', link: '/core/packages' },
        { text: 'Desktop Runtime', link: '/core/desktop' },
        { text: 'Release And Deployment', link: '/core/release-and-deployment' },
      ],
    },
  ],
  '/reference/': [
    {
      text: 'API Reference',
      items: [
        { text: 'API Overview', link: '/reference/api-reference' },
        { text: 'Claw Server Runtime', link: '/reference/claw-server-runtime' },
        { text: 'Claw Rollout API', link: '/reference/claw-rollout-api' },
      ],
    },
    {
      text: 'Operations Reference',
      items: [
        { text: 'Commands', link: '/reference/commands' },
        { text: 'Environment', link: '/reference/environment' },
        { text: 'Upstream Integration', link: '/reference/upstream-integration' },
      ],
    },
  ],
  '/contributing/': [
    {
      text: 'Contributing',
      items: [{ text: 'Contributor Guide', link: '/contributing/' }],
    },
  ],
};

const zhSidebar = {
  '/zh-CN/guide/': [
    {
      text: '指南',
      items: [
        { text: '快速开始', link: '/zh-CN/guide/getting-started' },
        { text: '应用模式', link: '/zh-CN/guide/application-modes' },
        { text: '安装与部署', link: '/zh-CN/guide/install-and-deploy' },
        { text: '开发流程', link: '/zh-CN/guide/development' },
      ],
    },
  ],
  '/zh-CN/core/': [
    {
      text: '架构',
      items: [
        { text: '架构说明', link: '/zh-CN/core/architecture' },
        { text: '分包布局', link: '/zh-CN/core/packages' },
        { text: '桌面运行时', link: '/zh-CN/core/desktop' },
        { text: '发布与部署', link: '/zh-CN/core/release-and-deployment' },
      ],
    },
  ],
  '/zh-CN/reference/': [
    {
      text: 'API 参考',
      items: [
        { text: 'API 总览', link: '/zh-CN/reference/api-reference' },
        { text: 'Claw Server 运行时', link: '/zh-CN/reference/claw-server-runtime' },
        { text: 'Claw Rollout API', link: '/zh-CN/reference/claw-rollout-api' },
      ],
    },
    {
      text: '运维参考',
      items: [
        { text: '命令参考', link: '/zh-CN/reference/commands' },
        { text: '环境变量', link: '/zh-CN/reference/environment' },
        { text: '上游运行时集成', link: '/zh-CN/reference/upstream-integration' },
      ],
    },
  ],
  '/zh-CN/contributing/': [
    {
      text: '贡献',
      items: [{ text: '贡献指南', link: '/zh-CN/contributing/' }],
    },
  ],
};

export default defineConfig({
  title: 'Claw Studio',
  description:
    'Official Claw Studio documentation for web, desktop, native server, container, and Kubernetes deployment modes.',
  cleanUrls: true,
  lastUpdated: true,
  srcExclude: publicDocsSrcExclude,
  head: [
    ['link', { rel: 'icon', href: '/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#0f766e' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'Claw Studio' }],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'Official Claw Studio documentation for the package-first workspace, native control plane, and release system.',
      },
    ],
    ['meta', { property: 'og:image', content: '/social-card.svg' }],
  ],
  themeConfig: {
    logo: '/logo.svg',
    search: {
      provider: 'local',
      options: localSearchOptions,
    },
  },
  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
      themeConfig: {
        nav: enNav,
        sidebar: enSidebar,
        outline: {
          level: [2, 3],
          label: 'On this page',
        },
        footer: {
          message: 'Built for a package-first Claw Studio workspace and unified host platform.',
          copyright: 'Copyright © 2026 Claw Studio contributors',
        },
        docFooter: {
          prev: 'Previous page',
          next: 'Next page',
        },
        sidebarMenuLabel: 'Menu',
        darkModeSwitchLabel: 'Appearance',
        returnToTopLabel: 'Back to top',
        langMenuLabel: 'Change language',
      },
    },
    'zh-CN': {
      label: '简体中文',
      lang: 'zh-CN',
      link: '/zh-CN/',
      description:
        'Claw Studio 官方文档站，覆盖 Web、桌面端、原生 Server、Docker 与 Kubernetes 部署模式。',
      themeConfig: {
        nav: zhNav,
        sidebar: zhSidebar,
        outline: {
          level: [2, 3],
          label: '本页内容',
        },
        footer: {
          message: '面向分包工作区、统一控制平面与多部署形态的 Claw Studio 文档站。',
          copyright: 'Copyright © 2026 Claw Studio contributors',
        },
        docFooter: {
          prev: '上一页',
          next: '下一页',
        },
        sidebarMenuLabel: '目录',
        darkModeSwitchLabel: '外观',
        returnToTopLabel: '返回顶部',
        langMenuLabel: '切换语言',
      },
    },
  },
});
