import { defineConfig } from 'vitepress';

const enNav = [
  { text: 'Guide', link: '/guide/getting-started' },
  { text: 'Core', link: '/core/architecture' },
  { text: 'Features', link: '/features/overview' },
  { text: 'Reference', link: '/reference/commands' },
  { text: 'Contributing', link: '/contributing/' },
];

const zhNav = [
  { text: '指南', link: '/zh-CN/guide/getting-started' },
  { text: '核心', link: '/zh-CN/core/architecture' },
  { text: '功能', link: '/zh-CN/features/overview' },
  { text: '参考', link: '/zh-CN/reference/commands' },
  { text: '贡献', link: '/zh-CN/contributing/' },
];

const enSidebar = [
  {
    text: 'Guide',
    items: [
      { text: 'Getting Started', link: '/guide/getting-started' },
      { text: 'Development', link: '/guide/development' },
    ],
  },
  {
    text: 'Core',
    items: [
      { text: 'Architecture', link: '/core/architecture' },
      { text: 'Packages', link: '/core/packages' },
      { text: 'Desktop Runtime', link: '/core/desktop' },
    ],
  },
  {
    text: 'Features',
    items: [{ text: 'Feature Overview', link: '/features/overview' }],
  },
  {
    text: 'Reference',
    items: [
      { text: 'Commands', link: '/reference/commands' },
      { text: 'Environment', link: '/reference/environment' },
    ],
  },
  {
    text: 'Contributing',
    items: [{ text: 'Contributor Guide', link: '/contributing/' }],
  },
];

const zhSidebar = [
  {
    text: '指南',
    items: [
      { text: '快速开始', link: '/zh-CN/guide/getting-started' },
      { text: '开发流程', link: '/zh-CN/guide/development' },
    ],
  },
  {
    text: '核心',
    items: [
      { text: '架构说明', link: '/zh-CN/core/architecture' },
      { text: '分包布局', link: '/zh-CN/core/packages' },
      { text: '桌面运行时', link: '/zh-CN/core/desktop' },
    ],
  },
  {
    text: '功能',
    items: [{ text: '功能总览', link: '/zh-CN/features/overview' }],
  },
  {
    text: '参考',
    items: [
      { text: '命令参考', link: '/zh-CN/reference/commands' },
      { text: '环境变量', link: '/zh-CN/reference/environment' },
    ],
  },
  {
    text: '贡献',
    items: [{ text: '贡献指南', link: '/zh-CN/contributing/' }],
  },
];

export default defineConfig({
  title: 'Claw Studio',
  description: 'Package-first documentation for the Claw Studio workspace, web shell, and Tauri desktop runtime.',
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ['link', { rel: 'icon', href: '/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#0f766e' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'Claw Studio' }],
    ['meta', { property: 'og:description', content: 'A package-first Claw Studio workspace with shared web and desktop shells.' }],
    ['meta', { property: 'og:image', content: '/social-card.svg' }],
  ],
  themeConfig: {
    logo: '/logo.svg',
    search: {
      provider: 'local',
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
          message: 'Built for a feature-package Claw Studio workspace.',
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
      description: '面向 Claw Studio 工作区、Web Shell 与 Tauri 桌面运行时的分包文档站。',
      themeConfig: {
        nav: zhNav,
        sidebar: zhSidebar,
        outline: {
          level: [2, 3],
          label: '本页内容',
        },
        footer: {
          message: '面向 Claw Studio 分包工作区构建。',
          copyright: 'Copyright © 2026 Claw Studio contributors',
        },
        docFooter: {
          prev: '上一页',
          next: '下一页',
        },
        sidebarMenuLabel: '菜单',
        darkModeSwitchLabel: '外观',
        returnToTopLabel: '返回顶部',
        langMenuLabel: '切换语言',
      },
    },
  },
});
