import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Settings, Cpu, Battery, Wifi, DownloadCloud, ArrowRight, HardDrive, MemoryStick, Activity, MoreVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../components/Modal';
import { motion } from 'motion/react';
import type { Device, InstalledSkill } from '../../types';
import { deviceService } from '../../services/deviceService';

export function Devices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [deviceSkills, setDeviceSkills] = useState<InstalledSkill[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    const data = await deviceService.getDevices();
    setDevices(data);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceName.trim()) return;
    
    const newDevice = await deviceService.registerDevice(newDeviceName);
    setDevices([...devices, newDevice]);
    setNewDeviceName('');
    setIsRegisterModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to unregister this device?')) return;
    await deviceService.deleteDevice(id);
    setDevices(devices.filter(d => d.id !== id));
    if (selectedDevice?.id === id) setSelectedDevice(null);
  };

  const viewDeviceDetails = async (device: Device) => {
    setSelectedDevice(device);
    const skills = await deviceService.getDeviceSkills(device.id);
    setDeviceSkills(skills);
  };

  const handleUninstall = async (skillId: string) => {
    if (!selectedDevice) return;
    if (!confirm('Uninstall this skill?')) return;
    await deviceService.uninstallSkill(selectedDevice.id, skillId);
    setDeviceSkills(deviceSkills.filter(s => s.id !== skillId));
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto h-full overflow-y-auto scrollbar-hide">
      {/* Install Banner */}
      <div className="mb-10 bg-zinc-950 dark:bg-zinc-900/50 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden shadow-xl border border-zinc-800 dark:border-zinc-800/50">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10 flex items-start gap-5">
          <div className="w-14 h-14 bg-zinc-900 dark:bg-zinc-950 text-primary-500 rounded-2xl flex items-center justify-center shrink-0 border border-zinc-800 dark:border-zinc-800/50">
            <DownloadCloud className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Add New Hardware</h2>
            <p className="text-zinc-400 text-sm max-w-xl leading-relaxed">
              Connect external sensors, smart home hubs, or edge computing nodes to your OpenClaw network.
            </p>
          </div>
        </div>
        <button 
          onClick={() => setIsRegisterModalOpen(true)}
          className="relative z-10 shrink-0 w-full sm:w-auto flex items-center justify-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-primary-700 transition-colors shadow-lg shadow-primary-900/20"
        >
          <Plus className="w-4 h-4" />
          Register Device
        </button>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Connected Devices</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1.5 text-sm">Manage hardware endpoints and edge nodes.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Device List */}
        <div className="lg:col-span-2 space-y-4">
          {devices.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-dashed rounded-3xl p-12 text-center shadow-sm">
              <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-zinc-100 dark:border-zinc-700">
                <Cpu className="w-8 h-8 text-zinc-400 dark:text-zinc-500" />
              </div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">No devices found</h3>
              <p className="text-zinc-500 dark:text-zinc-400 mb-6 text-sm">Register your first hardware device to get started.</p>
              <button 
                onClick={() => setIsRegisterModalOpen(true)}
                className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2.5 rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors font-medium text-sm inline-flex items-center gap-2 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Register Device
              </button>
            </div>
          ) : (
            devices.map((device, idx) => (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.05 }}
                key={device.id} 
                className={`bg-white dark:bg-zinc-900 border rounded-2xl p-5 transition-all cursor-pointer group ${selectedDevice?.id === device.id ? 'border-primary-500 dark:border-primary-500/50 ring-1 ring-primary-500 dark:ring-primary-500/50 shadow-md' : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm'}`}
                onClick={() => viewDeviceDetails(device)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-inner shrink-0 ${selectedDevice?.id === device.id ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400' : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-100 dark:border-zinc-700'}`}>
                      <Cpu className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        {device.name}
                        {device.battery > 0 && (
                          <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                        )}
                      </h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">{device.id}</span>
                        <span className="flex items-center gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                          <Wifi className="w-3 h-3" /> {device.ip_address}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        {device.battery}%
                        <Battery className={`w-4 h-4 ${device.battery > 20 ? 'text-emerald-500' : 'text-red-500'}`} />
                      </div>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-semibold mt-0.5">Power</span>
                    </div>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(device.id);
                      }}
                      className="p-2 text-zinc-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Device Details Panel */}
        <div>
          {selectedDevice ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sticky top-8 shadow-xl shadow-zinc-200/20 dark:shadow-none"
            >
              <div className="flex items-center justify-between mb-6 pb-6 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 rounded-xl flex items-center justify-center">
                    <Settings className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{selectedDevice.name}</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">{selectedDevice.ip_address}</p>
                  </div>
                </div>
                <button className="p-2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>

              {/* Hardware Specs */}
              {selectedDevice.hardwareSpecs && (
                <div className="grid grid-cols-2 gap-3 mb-8">
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 border border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                      <Cpu className="w-3.5 h-3.5" /> SoC
                    </div>
                    <div className="font-mono text-sm text-zinc-900 dark:text-zinc-100">{selectedDevice.hardwareSpecs.soc}</div>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 border border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                      <MemoryStick className="w-3.5 h-3.5" /> RAM
                    </div>
                    <div className="font-mono text-sm text-zinc-900 dark:text-zinc-100">{selectedDevice.hardwareSpecs.ram}</div>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 border border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                      <HardDrive className="w-3.5 h-3.5" /> Storage
                    </div>
                    <div className="font-mono text-sm text-zinc-900 dark:text-zinc-100">{selectedDevice.hardwareSpecs.storage}</div>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 border border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                      <Activity className="w-3.5 h-3.5" /> Latency
                    </div>
                    <div className={`font-mono text-sm ${selectedDevice.hardwareSpecs.latency !== '-' ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500 dark:text-zinc-400'}`}>
                      {selectedDevice.hardwareSpecs.latency}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center justify-between">
                  Installed Skills
                  <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 py-0.5 px-2 rounded-full text-xs">{deviceSkills.length}</span>
                </h4>
                
                {deviceSkills.length === 0 ? (
                  <div className="text-center py-8 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800 border-dashed">
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm">No skills installed.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {deviceSkills.map(skill => (
                      <div key={skill.id} className="flex items-center justify-between group p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700/50 rounded-xl hover:border-zinc-200 dark:hover:border-zinc-700 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                            {skill.name.substring(0, 2)}
                          </div>
                          <div>
                            <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">{skill.name}</p>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">v{skill.version}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleUninstall(skill.id)}
                          className="text-xs font-medium text-red-600 dark:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity bg-red-50 dark:bg-red-500/10 px-2.5 py-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/20"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-dashed rounded-3xl p-8 text-center text-zinc-400 dark:text-zinc-500 flex flex-col items-center justify-center h-64 sticky top-8">
              <Cpu className="w-10 h-10 mb-4 opacity-20" />
              <p className="text-sm font-medium">Select a device to view hardware specs and skills</p>
            </div>
          )}
        </div>
      </div>

      <Modal 
        isOpen={isRegisterModalOpen} 
        onClose={() => setIsRegisterModalOpen(false)}
        title="Register New Device"
      >
        <form onSubmit={handleRegister} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-1.5">Device Name</label>
            <input 
              type="text" 
              value={newDeviceName}
              onChange={e => setNewDeviceName(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-sm dark:text-zinc-100"
              placeholder="e.g. Living Room Sensor"
              autoFocus
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">Give your device a recognizable name for the dashboard.</p>
          </div>
          <div className="pt-2">
            <button 
              type="submit"
              disabled={!newDeviceName.trim()}
              className="w-full bg-primary-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-900/20"
            >
              Register Device
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
