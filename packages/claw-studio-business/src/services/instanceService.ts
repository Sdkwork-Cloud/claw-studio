import React from 'react';
import { Apple, Box, Server } from 'lucide-react';

export interface Instance {
  id: string;
  name: string;
  type: string;
  iconType: 'apple' | 'box' | 'server';
  status: 'online' | 'offline' | 'starting' | 'error';
  version: string;
  uptime: string;
  ip: string;
  cpu: number;
  memory: number;
  totalMemory: string;
}

const MOCK_INSTANCES: Instance[] = [
  { 
    id: 'local-mac', 
    name: 'MacBook Pro (Local)', 
    type: 'macOS Native', 
    iconType: 'apple',
    status: 'online', 
    version: 'v0.2.1', 
    uptime: '5d 12h', 
    ip: '127.0.0.1',
    cpu: 12,
    memory: 35,
    totalMemory: '32 GB'
  },
  { 
    id: 'home-server', 
    name: 'Home NAS Gateway', 
    type: 'Docker Container', 
    iconType: 'box',
    status: 'online', 
    version: 'v0.2.1', 
    uptime: '32d 4h', 
    ip: '192.168.1.100',
    cpu: 45,
    memory: 68,
    totalMemory: '16 GB'
  },
  { 
    id: 'aws-node', 
    name: 'AWS EC2 Node', 
    type: 'Ubuntu Linux', 
    iconType: 'server',
    status: 'offline', 
    version: 'v0.2.0', 
    uptime: '-', 
    ip: '3.14.15.92',
    cpu: 0,
    memory: 0,
    totalMemory: '64 GB'
  }
];

export const instanceService = {
  getInstances: async (): Promise<Instance[]> => {
    return new Promise(resolve => setTimeout(() => resolve([...MOCK_INSTANCES]), 300));
  },
  
  getInstanceById: async (id: string): Promise<Instance | undefined> => {
    return new Promise(resolve => setTimeout(() => resolve(MOCK_INSTANCES.find(i => i.id === id)), 300));
  },

  startInstance: async (id: string): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, 500));
  },

  stopInstance: async (id: string): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, 500));
  },

  restartInstance: async (id: string): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, 800));
  }
};
