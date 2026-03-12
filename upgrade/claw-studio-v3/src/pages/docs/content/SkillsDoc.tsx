import React from 'react';

export function SkillsDoc() {
  return (
    <>
      <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 mb-6">Skills & Packs</h1>
      <p className="text-lg text-zinc-600 leading-relaxed mb-8">
        Skills are the building blocks of OpenClaw functionality.
      </p>
      <h2>What is a Skill?</h2>
      <p>
        A skill is a self-contained package of code that teaches a device how to perform a specific action. For example, a "Philips Hue" skill teaches a device how to control smart lights.
      </p>
      <h2>Skill Packs</h2>
      <p>
        Skill Packs are curated collections of related skills. Installing a pack is a quick way to set up a device for a specific use case, such as "Smart Home Hub" or "Media Center".
      </p>
      <pre className="bg-zinc-900 text-zinc-50 p-4 rounded-xl overflow-x-auto">
        <code>{`// Example Skill Manifest (manifest.json)
{
  "name": "weather-fetcher",
  "version": "1.0.0",
  "description": "Fetches local weather data",
  "permissions": ["network", "location"]
}`}</code>
      </pre>
    </>
  );
}
