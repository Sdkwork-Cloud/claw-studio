import type { ElementType } from 'react';
import {
  Box,
  Cpu,
  Github,
  LayoutGrid,
  MessageCircle,
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
}

export function buildCommandPaletteCommands({
  instances,
  navigate,
  setActiveInstanceId,
}: BuildCommandPaletteCommandsOptions): CommandPaletteCommand[] {
  const baseCommands: CommandPaletteCommand[] = [
    {
      id: 'nav-apps',
      title: 'Go to App Store',
      subtitle: 'Browse AI applications',
      icon: LayoutGrid,
      category: 'Navigation',
      action: () => navigate('/apps'),
    },
    {
      id: 'nav-github',
      title: 'Go to GitHub Repos',
      subtitle: 'Install open-source projects',
      icon: Github,
      category: 'Navigation',
      action: () => navigate('/github'),
    },
    {
      id: 'nav-hf',
      title: 'Go to Hugging Face',
      subtitle: 'Download AI models',
      icon: Box,
      category: 'Navigation',
      action: () => navigate('/huggingface'),
    },
    {
      id: 'nav-instances',
      title: 'Go to Instances',
      subtitle: 'Manage running containers',
      icon: Server,
      category: 'Navigation',
      action: () => navigate('/instances'),
    },
    {
      id: 'nav-devices',
      title: 'Go to Devices',
      subtitle: 'Hardware & GPU settings',
      icon: Cpu,
      category: 'Navigation',
      action: () => navigate('/devices'),
    },
    {
      id: 'nav-chat',
      title: 'Go to AI Chat',
      subtitle: 'Talk to your local models',
      icon: MessageCircle,
      category: 'Navigation',
      action: () => navigate('/chat'),
    },
    {
      id: 'nav-settings',
      title: 'Go to Settings',
      subtitle: 'Preferences and configuration',
      icon: Settings,
      category: 'Navigation',
      action: () => navigate('/settings'),
    },
    {
      id: 'action-terminal',
      title: 'Open Terminal',
      subtitle: 'Launch local CLI',
      icon: Terminal,
      category: 'Actions',
      action: () => console.log('Terminal opened'),
    },
  ];

  const instanceCommands: CommandPaletteCommand[] = instances.map((instance) => ({
    id: `switch-instance-${instance.id}`,
    title: `Switch Instance: ${instance.name}`,
    subtitle: `${instance.ip} • ${instance.status}`,
    icon: Server,
    category: 'Instances',
    action: () => setActiveInstanceId(instance.id),
  }));

  return [...baseCommands, ...instanceCommands];
}
