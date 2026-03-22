import type { ElementType } from 'react';
import {
  Box,
  Bot,
  Code,
  Cpu,
  Gauge,
  Github,
  Globe,
  LayoutGrid,
  MessageCircle,
  Router,
  Server,
  Settings,
  Terminal,
} from 'lucide-react';

export interface CommandPaletteInstance {
  id: string;
  name: string;
  ip: string;
  status: string;
}

export interface CommandPaletteCommand {
  id: string;
  title: string;
  subtitle?: string;
  icon: ElementType;
  action: () => void;
  category: string;
}

interface BuildCommandPaletteCommandsOptions {
  instances: CommandPaletteInstance[];
  navigate: (path: string) => void;
  setActiveInstanceId: (id: string | null) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

export function buildCommandPaletteCommands({
  instances,
  navigate,
  setActiveInstanceId,
  t,
}: BuildCommandPaletteCommandsOptions): CommandPaletteCommand[] {
  const baseCommands: CommandPaletteCommand[] = [
    {
      id: 'nav-chat',
      title: t('commandPalette.commands.chat.title'),
      subtitle: t('commandPalette.commands.chat.subtitle'),
      icon: MessageCircle,
      category: t('commandPalette.categories.navigation'),
      action: () => navigate('/chat'),
    },
    {
      id: 'nav-dashboard',
      title: t('commandPalette.commands.dashboard.title'),
      subtitle: t('commandPalette.commands.dashboard.subtitle'),
      icon: Gauge,
      category: t('commandPalette.categories.navigation'),
      action: () => navigate('/dashboard'),
    },
    {
      id: 'nav-apps',
      title: t('commandPalette.commands.apps.title'),
      subtitle: t('commandPalette.commands.apps.subtitle'),
      icon: LayoutGrid,
      category: t('commandPalette.categories.navigation'),
      action: () => navigate('/apps'),
    },
    {
      id: 'nav-agents',
      title: t('commandPalette.commands.agents.title'),
      subtitle: t('commandPalette.commands.agents.subtitle'),
      icon: Bot,
      category: t('commandPalette.categories.navigation'),
      action: () => navigate('/agents'),
    },
    {
      id: 'nav-github',
      title: t('commandPalette.commands.github.title'),
      subtitle: t('commandPalette.commands.github.subtitle'),
      icon: Github,
      category: t('commandPalette.categories.navigation'),
      action: () => navigate('/github'),
    },
    {
      id: 'nav-hf',
      title: t('commandPalette.commands.huggingface.title'),
      subtitle: t('commandPalette.commands.huggingface.subtitle'),
      icon: Box,
      category: t('commandPalette.categories.navigation'),
      action: () => navigate('/huggingface'),
    },
    {
      id: 'nav-upload',
      title: t('commandPalette.commands.upload.title'),
      subtitle: t('commandPalette.commands.upload.subtitle'),
      icon: Globe,
      category: t('commandPalette.categories.navigation'),
      action: () => navigate('/claw-upload'),
    },
    {
      id: 'nav-instances',
      title: t('commandPalette.commands.instances.title'),
      subtitle: t('commandPalette.commands.instances.subtitle'),
      icon: Server,
      category: t('commandPalette.categories.navigation'),
      action: () => navigate('/instances'),
    },
    {
      id: 'nav-devices',
      title: t('commandPalette.commands.devices.title'),
      subtitle: t('commandPalette.commands.devices.subtitle'),
      icon: Cpu,
      category: t('commandPalette.categories.navigation'),
      action: () => navigate('/devices'),
    },
    {
      id: 'nav-codebox',
      title: t('commandPalette.commands.codebox.title'),
      subtitle: t('commandPalette.commands.codebox.subtitle'),
      icon: Code,
      category: t('commandPalette.categories.navigation'),
      action: () => navigate('/codebox'),
    },
    {
      id: 'nav-api-router',
      title: t('commandPalette.commands.apiRouter.title'),
      subtitle: t('commandPalette.commands.apiRouter.subtitle'),
      icon: Router,
      category: t('commandPalette.categories.navigation'),
      action: () => navigate('/api-router'),
    },
    {
      id: 'nav-settings',
      title: t('commandPalette.commands.settings.title'),
      subtitle: t('commandPalette.commands.settings.subtitle'),
      icon: Settings,
      category: t('commandPalette.categories.navigation'),
      action: () => navigate('/settings'),
    },
    {
      id: 'action-terminal',
      title: t('commandPalette.commands.terminal.title'),
      subtitle: t('commandPalette.commands.terminal.subtitle'),
      icon: Terminal,
      category: t('commandPalette.categories.actions'),
      action: () => console.log('Terminal opened'),
    },
  ];

  const instanceCommands: CommandPaletteCommand[] = instances.map((instance) => ({
    id: `switch-instance-${instance.id}`,
    title: t('commandPalette.switchInstanceTitle', { name: instance.name }),
    subtitle: t('commandPalette.instanceSubtitle', {
      ip: instance.ip,
      status: instance.status,
    }),
    icon: Server,
    category: t('commandPalette.categories.instances'),
    action: () => setActiveInstanceId(instance.id),
  }));

  return [...baseCommands, ...instanceCommands];
}
