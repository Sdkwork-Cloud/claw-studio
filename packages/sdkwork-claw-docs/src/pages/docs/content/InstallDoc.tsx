import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Terminal, Server, Package, Cloud, Github, AlertCircle } from 'lucide-react';

const CodeBlock = ({ code, language = 'bash' }: { code: string, language?: string }) => {
  return (
    <div className="relative group mt-3 mb-6">
      <div className="relative bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/50 border-b border-zinc-800">
          <span className="text-xs font-mono text-zinc-400">{language}</span>
        </div>
        <div className="p-4 overflow-x-auto">
          <pre className="text-sm font-mono text-zinc-300">
            <code>{code}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};

export function InstallDoc() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '');
      const element = document.getElementById(id);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  }, [location]);

  return (
    <>
      <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 mb-6">Installation Guide</h1>
      <p className="text-lg text-zinc-600 leading-relaxed mb-8">
        Detailed instructions for deploying OpenClaw across different environments.
      </p>

      {/* Script Method */}
      <div id="script" className="scroll-mt-8 mb-16 pt-8 border-t border-zinc-200">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center shrink-0 border border-primary-100">
            <Terminal className="w-6 h-6 text-primary-500" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 m-0">Installer Script</h2>
        </div>
        <p className="mb-6">The recommended, idiot-proof way to install Claw Studio. It handles Node detection, installation, and onboarding in one step.</p>
        
        <h3 className="text-lg font-bold text-zinc-900 mt-6 mb-2">macOS / Linux / WSL2</h3>
        <CodeBlock code="curl -fsSL https://openclaw.ai/install.sh | bash" />
        
        <h3 className="text-lg font-bold text-zinc-900 mt-6 mb-2">Windows (PowerShell)</h3>
        <CodeBlock code="iwr -useb https://openclaw.ai/install.ps1 | iex" language="powershell" />
      </div>

      {/* Docker Method */}
      <div id="docker" className="scroll-mt-8 mb-16 pt-8 border-t border-zinc-200">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0 border border-emerald-100">
            <Server className="w-6 h-6 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 m-0">Docker Gateway</h2>
        </div>
        <p className="mb-6">Run OpenClaw in an isolated container environment using Docker Compose. Perfect for home servers, NAS, or dedicated hardware.</p>
        
        <h3 className="text-lg font-bold text-zinc-900 mt-6 mb-2">1. Download the setup script</h3>
        <CodeBlock code="curl -O https://raw.githubusercontent.com/openclaw/openclaw/main/docker-setup.sh\nchmod +x docker-setup.sh" />
        
        <h3 className="text-lg font-bold text-zinc-900 mt-6 mb-2">2. Run the setup script</h3>
        <CodeBlock code="./docker-setup.sh" />
      </div>

      {/* NPM Method */}
      <div id="npm" className="scroll-mt-8 mb-16 pt-8 border-t border-zinc-200">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center shrink-0 border border-amber-100">
            <Package className="w-6 h-6 text-amber-500" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 m-0">NPM / PNPM</h2>
        </div>
        <p className="mb-6">For users who already have Node 22+ installed and prefer to manage packages themselves.</p>
        
        <h3 className="text-lg font-bold text-zinc-900 mt-6 mb-2">Using npm</h3>
        <CodeBlock code="npm install -g openclaw@latest\nopenclaw onboard --install-daemon" />
        
        <h3 className="text-lg font-bold text-zinc-900 mt-6 mb-2">Using pnpm</h3>
        <CodeBlock code="pnpm add -g openclaw@latest\npnpm approve-builds -g\nopenclaw onboard --install-daemon" />
      </div>

      {/* Cloud Deploy Method */}
      <div id="cloud" className="scroll-mt-8 mb-16 pt-8 border-t border-zinc-200">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center shrink-0 border border-purple-100">
            <Cloud className="w-6 h-6 text-purple-500" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 m-0">Cloud Deploy</h2>
        </div>
        <p className="mb-6">Deploy OpenClaw to a VPS or Cloud Provider like Hetzner, GCP, Fly.io, or AWS.</p>
        
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">Using a clean base image prevents conflicts with pre-installed software and ensures the OpenClaw installer can properly configure the environment.</p>
        </div>
        
        <h3 className="text-lg font-bold text-zinc-900 mt-6 mb-2">SSH into your instance</h3>
        <CodeBlock code="ssh root@your_server_ip" />
        
        <h3 className="text-lg font-bold text-zinc-900 mt-6 mb-2">Run the Installer Script</h3>
        <CodeBlock code="curl -fsSL https://openclaw.ai/install.sh | bash" />
      </div>

      {/* Source Method */}
      <div id="source" className="scroll-mt-8 mb-16 pt-8 border-t border-zinc-200">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-zinc-100 rounded-xl flex items-center justify-center shrink-0 border border-zinc-200">
            <Github className="w-6 h-6 text-zinc-700" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 m-0">From Source</h2>
        </div>
        <p className="mb-6">For contributors or anyone who wants to run from a local checkout to test the latest features.</p>
        
        <h3 className="text-lg font-bold text-zinc-900 mt-6 mb-2">Clone and Build</h3>
        <CodeBlock code="git clone https://github.com/openclaw/openclaw.git\ncd openclaw\npnpm install\npnpm ui:build\npnpm build" />
        
        <h3 className="text-lg font-bold text-zinc-900 mt-6 mb-2">Link and Run</h3>
        <CodeBlock code="pnpm link --global\nopenclaw onboard --install-daemon" />
      </div>
    </>
  );
}
