export interface ClawInstance {
  id: string;
  name: string;
  status: 'online' | 'offline';
  ip: string;
  version: string;
  os: string;
  uptime: string;
  cpuUsage: number;
  ramUsage: number;
  lastSeen: string;
  location: string;
}

export interface ClawDetail extends ClawInstance {
  kernel: string;
  diskUsage: number;
  macAddress: string;
  connectedDevices: number;
  activeTasks: number;
}

const MOCK_CLAWS: ClawInstance[] = [
  {
    id: 'claw-001',
    name: 'Main Server Claw',
    status: 'online',
    ip: '192.168.1.100',
    version: 'v2.1.0',
    os: 'Ubuntu 22.04',
    uptime: '14 days, 2 hours',
    cpuUsage: 45,
    ramUsage: 62,
    lastSeen: 'Just now',
    location: 'Data Center A',
  },
  {
    id: 'claw-002',
    name: 'Office Gateway',
    status: 'online',
    ip: '10.0.0.50',
    version: 'v2.1.0',
    os: 'Debian 11',
    uptime: '5 days, 12 hours',
    cpuUsage: 12,
    ramUsage: 34,
    lastSeen: '2 mins ago',
    location: 'NY Office',
  },
  {
    id: 'claw-003',
    name: 'Home Assistant Node',
    status: 'offline',
    ip: '192.168.50.20',
    version: 'v2.0.5',
    os: 'Raspberry Pi OS',
    uptime: 'Offline',
    cpuUsage: 0,
    ramUsage: 0,
    lastSeen: '2 hours ago',
    location: 'Living Room',
  },
  {
    id: 'claw-004',
    name: 'Edge Worker 1',
    status: 'online',
    ip: '172.16.0.10',
    version: 'v2.1.0',
    os: 'Alpine Linux',
    uptime: '45 days, 1 hour',
    cpuUsage: 88,
    ramUsage: 91,
    lastSeen: 'Just now',
    location: 'Edge Node B',
  }
];

const MOCK_CLAW_DETAIL: ClawDetail = {
  id: 'claw-001',
  name: 'Main Server Claw',
  status: 'online',
  ip: '192.168.1.100',
  version: 'v2.1.0',
  os: 'Ubuntu 22.04 LTS',
  kernel: 'Linux 5.15.0-88-generic',
  uptime: '14 days, 2 hours, 15 minutes',
  cpuUsage: 45,
  ramUsage: 62,
  diskUsage: 28,
  lastSeen: 'Just now',
  location: 'Data Center A',
  macAddress: '00:1A:2B:3C:4D:5E',
  connectedDevices: 12,
  activeTasks: 5,
};

export const clawService = {
  getClaws: async (): Promise<ClawInstance[]> => {
    return new Promise(resolve => setTimeout(() => resolve([...MOCK_CLAWS]), 300));
  },
  
  getClawById: async (id: string): Promise<ClawInstance | undefined> => {
    return new Promise(resolve => setTimeout(() => resolve(MOCK_CLAWS.find(c => c.id === id)), 300));
  },

  getClawDetail: async (id: string): Promise<ClawDetail | undefined> => {
    return new Promise(resolve => setTimeout(() => resolve({ ...MOCK_CLAW_DETAIL, id }), 300));
  }
};
