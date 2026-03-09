import React from 'react';

export function CliDoc() {
  return (
    <>
      <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 mb-6">CLI Commands</h1>
      <p className="text-lg text-zinc-600 leading-relaxed mb-8">
        Manage your OpenClaw instance directly from the terminal.
      </p>
      
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-bold text-zinc-900 mb-2">oc status</h3>
          <p className="mb-2">Check the status of the local gateway.</p>
          <pre className="bg-zinc-900 text-zinc-50 p-4 rounded-xl"><code>$ oc status
Gateway: Running (v2.4.1)
Uptime: 14 days, 2 hours
Connected Devices: 3</code></pre>
        </div>

        <div>
          <h3 className="text-lg font-bold text-zinc-900 mb-2">oc install &lt;skill_id&gt;</h3>
          <p className="mb-2">Install a skill from ClawHub to the default device.</p>
          <pre className="bg-zinc-900 text-zinc-50 p-4 rounded-xl"><code>$ oc install weather-pro
Downloading weather-pro...
Installing dependencies...
Success! Skill installed.</code></pre>
        </div>
      </div>
    </>
  );
}
