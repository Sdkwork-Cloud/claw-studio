import * as React from 'react';

function withDefaultClassName(className?: string) {
  return className || 'h-7 w-7';
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={withDefaultClassName(className)} aria-hidden="true">
      <circle cx="14" cy="14" r="11" fill="#229ED9" />
      <path d="M20.7 8.8 8.2 13.6c-.8.3-.8 1.4 0 1.6l3.1 1 1.2 3.8c.2.8 1.3 1 1.8.3l1.8-2.4 3.4 2.5c.6.5 1.5.1 1.7-.7L22 9.9c.2-.8-.5-1.4-1.3-1.1Z" fill="#fff" />
      <path d="m11.2 16.2 7.4-5.5-5.6 6.2" stroke="#229ED9" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={withDefaultClassName(className)} aria-hidden="true">
      <circle cx="14" cy="14" r="11" fill="#25D366" />
      <path d="M10.1 21.1 11 18.3a6.5 6.5 0 1 1 2.9.7l-3.8 2.1Z" fill="#DCFCE7" />
      <path d="M17.6 16.4c-.3.8-1.6 1.5-2.3 1.6-.6 0-1.4.2-4.2-1.7-2.4-1.7-3.9-4.6-4-4.8-.2-.2-1-1.3-1-2.5s.6-1.8.9-2.1c.3-.3.7-.4.9-.4h.7c.2 0 .4 0 .6.5.2.6.8 1.9.8 2.1.1.2.1.4 0 .6-.1.2-.2.4-.4.6-.2.2-.4.5-.6.6-.2.2-.3.4-.1.7.2.3.9 1.5 2 2.5 1.4 1.2 2.5 1.6 2.9 1.8.4.2.6.1.8-.1.2-.3 1-1.1 1.3-1.5.3-.3.5-.3.8-.2.3.2 2 .9 2.3 1.1.4.2.6.2.7.4.1.2.1 1.1-.2 1.9Z" fill="#16A34A" />
    </svg>
  );
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={withDefaultClassName(className)} aria-hidden="true">
      <rect x="4.5" y="6.5" width="19" height="15" rx="7.5" fill="#5865F2" />
      <path d="M10 19c1.5 1 2.8 1.4 4 1.4 1.2 0 2.5-.4 4-1.4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="11.4" cy="13.8" r="1.4" fill="#fff" />
      <circle cx="16.6" cy="13.8" r="1.4" fill="#fff" />
      <path d="M9 10.3 11 9M17 9l2 1.3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SlackIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={withDefaultClassName(className)} aria-hidden="true">
      <rect x="5" y="10.8" width="5.1" height="12.2" rx="2.55" fill="#36C5F0" />
      <rect x="8.7" y="5" width="12.1" height="5.1" rx="2.55" fill="#2EB67D" />
      <rect x="17.9" y="8.7" width="5.1" height="12.2" rx="2.55" fill="#ECB22E" />
      <rect x="7.2" y="17.9" width="12.1" height="5.1" rx="2.55" fill="#E01E5A" />
    </svg>
  );
}

function IrcIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={withDefaultClassName(className)} aria-hidden="true">
      <rect x="4.5" y="5.5" width="19" height="17" rx="5" fill="#334155" />
      <path d="M9.5 9.2v8.6M14 8.2v10.6M18.5 9.2v8.6" stroke="#E2E8F0" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M7.7 12.2h12.6M7.7 15.8h12.6" stroke="#E2E8F0" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M9 22.5 10.7 19h6.6l1.7 3.5" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function GoogleChatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={withDefaultClassName(className)} aria-hidden="true">
      <path d="M6 8.5A3.5 3.5 0 0 1 9.5 5h8A3.5 3.5 0 0 1 21 8.5v5A3.5 3.5 0 0 1 17.5 17H12l-3.6 3c-.6.4-1.4 0-1.4-.8V17A3.5 3.5 0 0 1 6 13.5v-5Z" fill="#4285F4" />
      <path d="M11 17h6.8A3.2 3.2 0 0 1 21 20.2v1.3c0 .8-.9 1.3-1.5.8L17.2 20H11a3 3 0 0 1-3-3v-.8l3-2.4V17Z" fill="#34A853" />
      <path d="M10.2 10.7h7.6" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M10.2 13.6h5.2" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="8.4" cy="13.5" r="2.2" fill="#FBBC05" />
      <circle cx="18.6" cy="8.6" r="2.2" fill="#EA4335" />
    </svg>
  );
}

function SignalIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={withDefaultClassName(className)} aria-hidden="true">
      <circle cx="14" cy="14" r="10" fill="#3B82F6" />
      <circle cx="14" cy="14" r="7.4" fill="#EFF6FF" />
      <path d="M10.2 18.9 10.9 16h6.2l.7 2.9" stroke="#3B82F6" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="11.3" cy="13.4" r="1" fill="#3B82F6" />
      <circle cx="14" cy="13.4" r="1" fill="#3B82F6" />
      <circle cx="16.7" cy="13.4" r="1" fill="#3B82F6" />
      <path d="M6.3 11.5l-1.4-.7M7 8.7 5.7 7.3M8.7 6.9 8 5.3M19.3 6.9l.7-1.6M21 8.7l1.3-1.4M21.7 11.5l1.4-.7M21.7 16.5l1.4.7M21 19.3l1.3 1.4M19.3 21.1l.7 1.6M8.7 21.1 8 22.7M7 19.3l-1.3 1.4M6.3 16.5l-1.4.7" stroke="#93C5FD" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IMessageIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={withDefaultClassName(className)} aria-hidden="true">
      <path d="M5 12.2A7.2 7.2 0 0 1 12.2 5h3.6A7.2 7.2 0 0 1 23 12.2v2.1a7.2 7.2 0 0 1-7.2 7.2H11l-4 2.3c-.7.4-1.5-.2-1.3-1l1-3.4A7 7 0 0 1 5 14.3v-2.1Z" fill="#0A84FF" />
      <path d="M9.7 12.2h8.6M9.7 15.6h5.9" stroke="#F8FAFC" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function LineIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={withDefaultClassName(className)} aria-hidden="true">
      <rect x="4" y="6" width="20" height="16" rx="8" fill="#06C755" />
      <path d="M10 11.2v5.6M10 16.8h3.2M15 11.2v5.6M15 16.8h3.2M20.2 11.2v5.6" stroke="#F0FDF4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.5 22.2 12.2 19h3.6l.7 3.2" stroke="#06C755" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function WeChatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={withDefaultClassName(className)} aria-hidden="true">
      <circle cx="12" cy="12" r="7" fill="#07C160" />
      <circle cx="18.5" cy="16.5" r="5.5" fill="#10B981" />
      <circle cx="9.6" cy="10.8" r="0.9" fill="#fff" />
      <circle cx="13.9" cy="10.8" r="0.9" fill="#fff" />
      <circle cx="17" cy="15.8" r="0.8" fill="#fff" />
      <circle cx="20.2" cy="15.8" r="0.8" fill="#fff" />
      <path d="m8.4 18.2.8-2.1M16.8 22l-.5-1.7" stroke="#047857" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function FeishuIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={withDefaultClassName(className)} aria-hidden="true">
      <path d="M9.2 5.5c2.8 0 5.4 1.5 6.7 3.9l-6.7 3.2V5.5Z" fill="#00C2FF" />
      <path d="M19.8 8.8c1.5 2.6 1.5 5.9 0 8.5l-6-2.9 6-5.6Z" fill="#3370FF" />
      <path d="M8.6 21.7A8 8 0 0 1 5 14.8h8.3l-4.7 6.9Z" fill="#00D6B9" />
      <path d="M17.6 22.2a8 8 0 0 1-7.4-.5l3.6-6.9 3.8 7.4Z" fill="#7B61FF" />
    </svg>
  );
}

function DingTalkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={withDefaultClassName(className)} aria-hidden="true">
      <path d="M20.9 6.2 9.5 11.8l4.4 1.4-2.1 7.6 8.2-9.3-4.2-.9 5.1-4.4Z" fill="#1677FF" />
      <path d="m10 22.2 2.6-8.9 2.5.7-5.1 8.2Z" fill="#60A5FA" />
    </svg>
  );
}

function WeComIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={withDefaultClassName(className)} aria-hidden="true">
      <circle cx="10" cy="14" r="5.6" fill="#1D4ED8" />
      <circle cx="18" cy="10" r="4.7" fill="#60A5FA" />
      <circle cx="18.5" cy="18" r="5.1" fill="#0EA5E9" />
      <path d="M8.1 18.8 6.8 21M19.4 22.1 18.3 20.1M21.7 7l1.4-1.8" stroke="#DBEAFE" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function QqIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={withDefaultClassName(className)} aria-hidden="true">
      <ellipse cx="14" cy="12.8" rx="5.5" ry="6.8" fill="#111827" />
      <ellipse cx="14" cy="12.3" rx="3.2" ry="4.2" fill="#fff" />
      <ellipse cx="12.6" cy="11.6" rx="0.7" ry="0.9" fill="#111827" />
      <ellipse cx="15.4" cy="11.6" rx="0.7" ry="0.9" fill="#111827" />
      <path d="M10.8 19.4c1.1 1.1 2.1 1.5 3.2 1.5s2.1-.4 3.2-1.5" stroke="#111827" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M11.2 18.6 9.8 23h3.1l1.1-3M16.8 18.6 18.2 23h-3.1L14 20" fill="#EF4444" />
      <path d="M10.6 20.3h6.8" stroke="#F59E0B" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function getChannelCatalogIcon(channelId: string) {
  switch (channelId) {
    case 'telegram':
      return <TelegramIcon />;
    case 'whatsapp':
      return <WhatsAppIcon />;
    case 'discord':
      return <DiscordIcon />;
    case 'irc':
      return <IrcIcon />;
    case 'slack':
      return <SlackIcon />;
    case 'googlechat':
      return <GoogleChatIcon />;
    case 'signal':
      return <SignalIcon />;
    case 'imessage':
      return <IMessageIcon />;
    case 'line':
      return <LineIcon />;
    case 'wechat':
      return <WeChatIcon />;
    case 'feishu':
      return <FeishuIcon />;
    case 'dingtalk':
      return <DingTalkIcon />;
    case 'wecom':
      return <WeComIcon />;
    case 'qq':
      return <QqIcon />;
    default:
      return null;
  }
}
