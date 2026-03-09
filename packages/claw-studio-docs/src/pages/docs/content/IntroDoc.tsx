import React from 'react';
import { Book, Cpu, Package, Zap, Terminal } from 'lucide-react';

export function IntroDoc() {
  return (
    <>
      <div className="flex items-center gap-2 text-primary-600 font-medium mb-4">
        <Book className="w-5 h-5" />
        <span>Getting Started</span>
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 mb-6">What is Claw Studio?</h1>
      <p className="text-lg text-zinc-600 leading-relaxed mb-8">
        OpenClaw is an open-source, decentralized device management and skill execution platform. 
        It allows you to seamlessly connect your hardware, install powerful AI-driven skills from the ClawHub marketplace, 
        and automate tasks across your personal ecosystem.
      </p>

      <h2 className="text-2xl font-bold text-zinc-900 mt-12 mb-4">Key Features</h2>
      <div className="grid sm:grid-cols-2 gap-4 not-prose mb-8">
        <div className="p-5 rounded-2xl border border-zinc-200 bg-zinc-50">
          <Cpu className="w-6 h-6 text-primary-500 mb-3" />
          <h3 className="font-bold text-zinc-900 mb-1">Local First</h3>
          <p className="text-sm text-zinc-600">Runs directly on your hardware, ensuring maximum privacy and minimal latency.</p>
        </div>
        <div className="p-5 rounded-2xl border border-zinc-200 bg-zinc-50">
          <Package className="w-6 h-6 text-primary-500 mb-3" />
          <h3 className="font-bold text-zinc-900 mb-1">Extensible Skills</h3>
          <p className="text-sm text-zinc-600">Browse and install hundreds of community-built skills from the ClawHub marketplace.</p>
        </div>
        <div className="p-5 rounded-2xl border border-zinc-200 bg-zinc-50">
          <Zap className="w-6 h-6 text-primary-500 mb-3" />
          <h3 className="font-bold text-zinc-900 mb-1">AI Powered</h3>
          <p className="text-sm text-zinc-600">Built-in integration with state-of-the-art LLMs to process natural language commands.</p>
        </div>
        <div className="p-5 rounded-2xl border border-zinc-200 bg-zinc-50">
          <Terminal className="w-6 h-6 text-primary-500 mb-3" />
          <h3 className="font-bold text-zinc-900 mb-1">Developer Friendly</h3>
          <p className="text-sm text-zinc-600">Comprehensive APIs, CLI tools, and clear documentation to build your own skills.</p>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-zinc-900 mt-12 mb-4">How it works</h2>
      <p>
        The OpenClaw ecosystem consists of three main components:
      </p>
      <ul>
        <li><strong>Manager (This App):</strong> The central control panel where you manage devices, install skills, and configure settings.</li>
        <li><strong>Gateway (Instance):</strong> The background service that coordinates communication between the Manager and your devices.</li>
        <li><strong>Devices:</strong> The physical or virtual endpoints that execute the installed skills.</li>
      </ul>
    </>
  );
}
