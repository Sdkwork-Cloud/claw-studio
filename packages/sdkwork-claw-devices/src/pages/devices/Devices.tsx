import React, { useEffect, useState } from 'react';
import {
  Activity,
  Battery,
  Cpu,
  DownloadCloud,
  HardDrive,
  MemoryStick,
  MoreVertical,
  Plus,
  Settings,
  Trash2,
  Wifi,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Label, Modal } from '@sdkwork/claw-ui';
import type { Device, InstalledSkill } from '@sdkwork/claw-types';
import { deviceService } from '../../services';

function formatVersionLabel(version: string, t: (key: string, options?: Record<string, unknown>) => string) {
  return t('devices.page.skillVersion', { version });
}

export function Devices() {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<Device[]>([]);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [deviceSkills, setDeviceSkills] = useState<InstalledSkill[]>([]);

  useEffect(() => {
    const fetchDevices = async () => {
      const data = await deviceService.getDevices();
      setDevices(data);
    };

    fetchDevices();
  }, []);

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newDeviceName.trim()) {
      return;
    }

    const newDevice = await deviceService.registerDevice(newDeviceName);
    setDevices((previous) => [...previous, newDevice]);
    setNewDeviceName('');
    setIsRegisterModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(t('devices.page.confirmUnregister'))
    ) {
      return;
    }

    await deviceService.deleteDevice(id);
    setDevices((previous) => previous.filter((device) => device.id !== id));
    if (selectedDevice?.id === id) {
      setSelectedDevice(null);
    }
  };

  const viewDeviceDetails = async (device: Device) => {
    setSelectedDevice(device);
    const skills = await deviceService.getDeviceSkills(device.id);
    setDeviceSkills(skills);
  };

  const handleUninstall = async (skillId: string) => {
    if (
      !selectedDevice ||
      !confirm(t('devices.page.confirmUninstallSkill'))
    ) {
      return;
    }

    await deviceService.uninstallSkill(selectedDevice.id, skillId);
    setDeviceSkills((previous) => previous.filter((skill) => skill.id !== skillId));
  };

  return (
    <div className="mx-auto h-full max-w-7xl overflow-y-auto p-6 scrollbar-hide md:p-10">
      <div className="relative mb-10 flex flex-col items-center justify-between gap-6 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-xl dark:border-zinc-800/50 dark:bg-zinc-900/50 sm:flex-row sm:p-8">
        <div className="absolute right-0 top-0 h-64 w-64 translate-x-1/3 -translate-y-1/2 rounded-full bg-primary-500/10 blur-3xl" />
        <div className="relative z-10 flex items-start gap-5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-primary-500 dark:border-zinc-800/50 dark:bg-zinc-950">
            <DownloadCloud className="h-7 w-7" />
          </div>
          <div>
            <h2 className="mb-1 text-xl font-bold text-white">
              {t('devices.page.banner.title')}
            </h2>
            <p className="max-w-xl text-sm leading-relaxed text-zinc-400">
              {t('devices.page.banner.description')}
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsRegisterModalOpen(true)}
          className="relative z-10 flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-primary-900/20 transition-colors hover:bg-primary-700 sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          {t('devices.page.actions.registerDevice')}
        </button>
      </div>

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {t('devices.page.title')}
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
            {t('devices.page.subtitle')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {devices.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-100 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
                <Cpu className="h-8 w-8 text-zinc-400 dark:text-zinc-500" />
              </div>
              <h3 className="mb-1 text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {t('devices.page.empty.title')}
              </h3>
              <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
                {t('devices.page.empty.description')}
              </p>
              <button
                onClick={() => setIsRegisterModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                <Plus className="h-4 w-4" />
                {t('devices.page.actions.registerDevice')}
              </button>
            </div>
          ) : (
            devices.map((device, index) => (
              <motion.div
                key={device.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                onClick={() => viewDeviceDetails(device)}
                className={`group cursor-pointer rounded-2xl border bg-white p-5 transition-all dark:bg-zinc-900 ${
                  selectedDevice?.id === device.id
                    ? 'border-primary-500 ring-1 ring-primary-500 shadow-md dark:border-primary-500/50 dark:ring-primary-500/50'
                    : 'border-zinc-200 hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:hover:border-zinc-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-inner ${
                        selectedDevice?.id === device.id
                          ? 'bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400'
                          : 'border border-zinc-100 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}
                    >
                      <Cpu className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="flex items-center gap-2 text-base font-bold text-zinc-900 dark:text-zinc-100">
                        {device.name}
                        {device.battery > 0 && (
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                          </span>
                        )}
                      </h3>
                      <div className="mt-1 flex items-center gap-3">
                        <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                          {device.id}
                        </span>
                        <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                        <span className="flex items-center gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                          <Wifi className="h-3 w-3" />
                          {device.ip_address}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        {device.battery}%
                        <Battery
                          className={`h-4 w-4 ${
                            device.battery > 20 ? 'text-emerald-500' : 'text-red-500'
                          }`}
                        />
                      </div>
                      <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        {t('devices.page.powerLabel')}
                      </span>
                    </div>

                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleDelete(device.id);
                      }}
                      aria-label={t('devices.page.actions.remove')}
                      className="rounded-lg p-2 text-zinc-400 opacity-0 transition-colors group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 dark:text-zinc-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        <div>
          {selectedDevice ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="sticky top-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/20 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none"
            >
              <div className="mb-6 flex items-center justify-between border-b border-zinc-100 pb-6 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400">
                    <Settings className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900 dark:text-zinc-100">
                      {selectedDevice.name}
                    </h3>
                    <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                      {selectedDevice.ip_address}
                    </p>
                  </div>
                </div>
                <button
                  aria-label={t('devices.page.moreActions')}
                  className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                >
                  <MoreVertical className="h-5 w-5" />
                </button>
              </div>

              {selectedDevice.hardwareSpecs && (
                <div className="mb-8 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/50">
                    <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      <Cpu className="h-3.5 w-3.5" />
                      {t('devices.page.specs.soc')}
                    </div>
                    <div className="text-sm font-mono text-zinc-900 dark:text-zinc-100">
                      {selectedDevice.hardwareSpecs.soc}
                    </div>
                  </div>
                  <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/50">
                    <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      <MemoryStick className="h-3.5 w-3.5" />
                      {t('devices.page.specs.ram')}
                    </div>
                    <div className="text-sm font-mono text-zinc-900 dark:text-zinc-100">
                      {selectedDevice.hardwareSpecs.ram}
                    </div>
                  </div>
                  <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/50">
                    <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      <HardDrive className="h-3.5 w-3.5" />
                      {t('devices.page.specs.storage')}
                    </div>
                    <div className="text-sm font-mono text-zinc-900 dark:text-zinc-100">
                      {selectedDevice.hardwareSpecs.storage}
                    </div>
                  </div>
                  <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/50">
                    <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      <Activity className="h-3.5 w-3.5" />
                      {t('devices.page.specs.latency')}
                    </div>
                    <div
                      className={`text-sm font-mono ${
                        selectedDevice.hardwareSpecs.latency !== '-'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-zinc-500 dark:text-zinc-400'
                      }`}
                    >
                      {selectedDevice.hardwareSpecs.latency}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h4 className="mb-4 flex items-center justify-between text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {t('devices.page.installedSkills')}
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    {deviceSkills.length}
                  </span>
                </h4>

                {deviceSkills.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-100 bg-zinc-50 py-8 text-center dark:border-zinc-800 dark:bg-zinc-800/50">
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {t('devices.page.noSkillsInstalled')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {deviceSkills.map((skill) => (
                      <div
                        key={skill.id}
                        className="group flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 p-3 transition-colors hover:border-zinc-200 dark:border-zinc-700/50 dark:bg-zinc-800/50 dark:hover:border-zinc-700"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-xs font-bold uppercase text-zinc-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                            {skill.name.substring(0, 2)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {skill.name}
                            </p>
                            <p className="mt-0.5 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                              {formatVersionLabel(skill.version, t)}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => void handleUninstall(skill.id)}
                          className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 opacity-0 transition-opacity hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 group-hover:opacity-100"
                        >
                          {t('devices.page.actions.remove')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <div className="sticky top-8 flex h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-200 bg-zinc-50 p-8 text-center text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500">
              <Cpu className="mb-4 h-10 w-10 opacity-20" />
              <p className="text-sm font-medium">
                {t('devices.page.selectDeviceHint')}
              </p>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        title={t('devices.page.modal.title')}
      >
        <form onSubmit={handleRegister} className="space-y-5">
          <div>
            <Label className="mb-1.5 block">
              {t('devices.page.modal.deviceName')}
            </Label>
            <Input
              type="text"
              value={newDeviceName}
              onChange={(event) => setNewDeviceName(event.target.value)}
              placeholder={t('devices.page.modal.deviceNamePlaceholder')}
              autoFocus
            />
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              {t('devices.page.modal.deviceNameDescription')}
            </p>
          </div>
          <div className="pt-2">
            <Button
              type="submit"
              disabled={!newDeviceName.trim()}
              className="h-auto w-full py-3 text-sm font-bold"
            >
              {t('devices.page.actions.registerDevice')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
