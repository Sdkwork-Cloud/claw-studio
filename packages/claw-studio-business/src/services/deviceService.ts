import { Device, InstalledSkill } from '@sdkwork/claw-studio-domain';

export const deviceService = {
  getDevices: async (): Promise<Device[]> => {
    // Simulated fetch for UI purposes
    return [
      { id: 'dev-1', name: 'Living Room Hub', ip_address: '192.168.1.105', battery: 100, status: 'online', created_at: new Date().toISOString() },
      { id: 'dev-2', name: 'Garage Controller', ip_address: '192.168.1.112', battery: 85, status: 'online', created_at: new Date().toISOString() },
      { id: 'dev-3', name: 'Outdoor Sensor Node', ip_address: '192.168.1.120', battery: 12, status: 'offline', created_at: new Date().toISOString() },
    ];
  },

  registerDevice: async (name: string): Promise<Device> => {
    // Simulated register
    return {
      id: `dev-${Date.now()}`,
      name,
      ip_address: '192.168.1.x',
      battery: 100,
      status: 'online',
      created_at: new Date().toISOString()
    };
  },

  deleteDevice: async (id: string): Promise<void> => {
    // Simulated delete
    return new Promise(resolve => setTimeout(resolve, 300));
  },

  getDeviceSkills: async (deviceId: string): Promise<InstalledSkill[]> => {
    // Simulated fetch skills
    return [
      { id: 'skill-1', name: 'Smart Home Core', version: '1.2.0', description: 'Core home automation', author: 'Claw Studio', installed_at: new Date().toISOString(), readme: '', icon: '', category: 'core', downloads: 0, rating: 5, size: '2MB' },
      { id: 'skill-2', name: 'Weather Station', version: '2.0.1', description: 'Local weather tracking', author: 'Community', installed_at: new Date().toISOString(), readme: '', icon: '', category: 'utility', downloads: 0, rating: 4.5, size: '1MB' }
    ];
  },

  uninstallSkill: async (deviceId: string, skillId: string): Promise<void> => {
    // Simulated uninstall
    return new Promise(resolve => setTimeout(resolve, 300));
  }
};
