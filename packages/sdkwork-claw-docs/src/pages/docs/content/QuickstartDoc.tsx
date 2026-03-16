import React from 'react';
import { Zap } from 'lucide-react';

export function QuickstartDoc() {
  return (
    <>
      <div className="flex items-center gap-2 text-primary-600 font-medium mb-4">
        <Zap className="w-5 h-5" />
        <span>Getting Started</span>
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 mb-6">Quick Start</h1>
      <p className="text-lg text-zinc-600 leading-relaxed mb-8">
        Get up and running with OpenClaw in less than 5 minutes.
      </p>

      <h2 className="text-2xl font-bold text-zinc-900 mt-10 mb-4">1. Install the Gateway</h2>
      <p>The easiest way to install the OpenClaw Gateway is using our installation script:</p>
      <pre className="bg-zinc-900 text-zinc-50 p-4 rounded-xl overflow-x-auto">
        <code>curl -fsSL https://openclaw.dev/install.sh | bash</code>
      </pre>

      <h2 className="text-2xl font-bold text-zinc-900 mt-10 mb-4">2. Register a Device</h2>
      <p>Once the gateway is running, navigate to the <strong>Devices</strong> tab in the sidebar and click <strong>Register Device</strong>. Follow the on-screen instructions to link your first device.</p>

      <h2 className="text-2xl font-bold text-zinc-900 mt-10 mb-4">3. Install your first Skill</h2>
      <p>Go to <strong>ClawHub</strong>, search for a skill (like "System Monitor" or "Weather"), and click Install. Select the device you just registered.</p>
    </>
  );
}
