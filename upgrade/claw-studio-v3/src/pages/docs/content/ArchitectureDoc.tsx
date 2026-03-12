import React from 'react';

export function ArchitectureDoc() {
  return (
    <>
      <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 mb-6">Architecture</h1>
      <p className="text-lg text-zinc-600 leading-relaxed mb-8">
        Understanding the core components of the OpenClaw platform.
      </p>
      <p>
        OpenClaw uses a hub-and-spoke architecture. The <strong>Gateway</strong> acts as the central hub, managing state, routing messages, and handling authentication. <strong>Devices</strong> connect to the Gateway via WebSockets or MQTT.
      </p>
      <div className="my-8 p-8 bg-zinc-50 border border-zinc-200 rounded-2xl text-center text-zinc-500 italic">
        [ Architecture Diagram Placeholder ]
      </div>
      <h3>Security Model</h3>
      <p>
        All communication between the Gateway and Devices is encrypted using TLS. Devices authenticate using unique cryptographic tokens generated during the registration process.
      </p>
    </>
  );
}
