import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Terminal, Server, Package, Cloud, Github, Check, Copy, ChevronRight, AlertCircle, Info, Play, SquareTerminal } from 'lucide-react';
import { installerService } from '../../services';

const CodeBlock = ({ code, language = 'bash', executable = false }: { code: string, language?: string, executable?: boolean }) => {
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [output, setOutput] = useState<string>('');

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRun = async () => {
    setStatus('running');
    setOutput(`$ ${code}\nExecuting via Tauri backend...\n`);
    try {
      const result = await installerService.executeInstallScript(code);
      setOutput(prev => prev + '\n' + result);
      setStatus('success');
    } catch (e: any) {
      setStatus('error');
      setOutput(prev => prev + '\nError: ' + (e.message || String(e)));
    }
  };

  return (
    <div className="relative group mt-3 mb-6">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary-500/20 to-primary-500/10 rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
      <div className="relative bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/50 border-b border-zinc-800">
          <span className="text-xs font-mono text-zinc-400">{language}</span>
          <div className="flex items-center gap-3">
            {executable && (
              <button 
                onClick={handleRun}
                disabled={status === 'running'}
                className="flex items-center gap-1.5 text-xs font-medium text-primary-400 hover:text-primary-300 transition-colors p-1 disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" /> {status === 'running' ? 'Running...' : 'Run'}
              </button>
            )}
            <button 
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors p-1"
            >
              {copied ? (
                <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copied</>
              ) : (
                <><Copy className="w-3.5 h-3.5" /> Copy</>
              )}
            </button>
          </div>
        </div>
        <div className="p-4 overflow-x-auto">
          <pre className="text-sm font-mono text-zinc-300">
            <code>{code}</code>
          </pre>
        </div>
        
        {status !== 'idle' && (
          <div className="border-t border-zinc-800 bg-zinc-950 p-4">
            <div className="flex items-center gap-2 mb-2">
              <SquareTerminal className="w-4 h-4 text-zinc-500" />
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Terminal Output</span>
            </div>
            <pre className={`text-xs font-mono whitespace-pre-wrap ${status === 'error' ? 'text-red-400' : 'text-zinc-300'}`}>
              {output}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export function InstallDetail() {
  const { method } = useParams<{ method: string }>();
  const navigate = useNavigate();

  const guides: Record<string, any> = {
    script: {
      title: 'Installer Script',
      icon: <Terminal className="w-8 h-8 text-primary-500 dark:text-primary-400" />,
      description: 'The recommended, idiot-proof way to install Claw Studio. It handles Node detection, installation, and onboarding in one step.',
      steps: [
        {
          title: 'Open your Terminal or PowerShell',
          description: 'Ensure you have an active internet connection. On Windows, we strongly recommend running OpenClaw under WSL2.',
        },
        {
          title: 'Run the installation command',
          description: 'Click "Run" to execute the command directly via Tauri, or copy and paste it into your terminal:',
          content: (
            <div className="space-y-6 mt-4">
              <div>
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">macOS / Linux / WSL2</h4>
                <CodeBlock code="curl -fsSL https://openclaw.ai/install.sh | bash" executable />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Windows (PowerShell)</h4>
                <CodeBlock code="iwr -useb https://openclaw.ai/install.ps1 | iex" language="powershell" executable />
              </div>
            </div>
          )
        },
        {
          title: 'Follow the Onboarding Wizard',
          description: 'The script will automatically download the CLI, install it globally, and launch the interactive onboarding wizard. Just follow the on-screen prompts to connect your devices.',
        },
        {
          title: 'Optional: Skip Onboarding',
          description: 'If you are automating the installation and want to skip the interactive wizard, use these flags:',
          content: (
            <div className="space-y-6 mt-4">
              <div>
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">macOS / Linux / WSL2</h4>
                <CodeBlock code="curl -fsSL https://openclaw.ai/install.sh | bash -s -- --no-onboard" executable />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Windows (PowerShell)</h4>
                <CodeBlock code="& ([scriptblock]::Create((iwr -useb https://openclaw.ai/install.ps1))) -NoOnboard" language="powershell" executable />
              </div>
            </div>
          )
        }
      ]
    },
    docker: {
      title: 'Docker Gateway',
      icon: <Server className="w-8 h-8 text-primary-500 dark:text-primary-400" />,
      description: 'Run OpenClaw in an isolated container environment using Docker Compose. Perfect for home servers, NAS, or dedicated hardware.',
      steps: [
        {
          title: 'Download the setup script',
          description: 'First, download the Docker setup script to your machine.',
          content: <CodeBlock code="curl -O https://raw.githubusercontent.com/openclaw/openclaw/main/docker-setup.sh\nchmod +x docker-setup.sh" executable />
        },
        {
          title: 'Run the setup script',
          description: 'This script builds the gateway image locally, runs the onboarding wizard, and starts the gateway via Docker Compose.',
          content: <CodeBlock code="./docker-setup.sh" executable />
        },
        {
          title: 'Optional: Enable Agent Sandbox',
          description: 'For enhanced security, you can enable the Docker gateway sandbox bootstrap. This isolates skills and agents.',
          content: <CodeBlock code="export OPENCLAW_SANDBOX=1\n./docker-setup.sh" executable />
        },
        {
          title: 'Access the Control UI',
          description: 'Once the container is running, open your browser and navigate to the Control UI.',
          content: (
            <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 mt-4">
              <p className="text-zinc-600 dark:text-zinc-400 text-sm">1. Open <code className="bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-900 dark:text-zinc-100 font-mono">http://127.0.0.1:18789/</code> in your browser.</p>
              <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-2">2. Paste the generated token into the Control UI (Settings → token).</p>
              <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-2">Need the URL again? Run:</p>
              <CodeBlock code="docker compose run --rm openclaw-cli dashboard --no-open" executable />
            </div>
          )
        }
      ]
    },
    npm: {
      title: 'NPM / PNPM',
      icon: <Package className="w-8 h-8 text-primary-500 dark:text-primary-400" />,
      description: 'For users who already have Node 22+ installed and prefer to manage packages themselves.',
      steps: [
        {
          title: 'Verify Node.js Version',
          description: 'Ensure you are running Node.js version 22 or higher.',
          content: <CodeBlock code="node --version" executable />
        },
        {
          title: 'Install Globally',
          description: 'Install the OpenClaw CLI globally using your preferred package manager.',
          content: (
            <div className="space-y-6 mt-4">
              <div>
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Using npm</h4>
                <CodeBlock code="npm install -g openclaw@latest" executable />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Using pnpm</h4>
                <CodeBlock code="pnpm add -g openclaw@latest\npnpm approve-builds -g" executable />
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Note: pnpm requires explicit approval for packages with build scripts.</p>
              </div>
            </div>
          )
        },
        {
          title: 'Run Onboarding & Install Daemon',
          description: 'Initialize OpenClaw and install the background daemon.',
          content: <CodeBlock code="openclaw onboard --install-daemon" executable />
        },
        {
          title: 'Troubleshooting: Sharp Build Errors',
          description: 'If you have libvips installed globally (common on macOS via Homebrew) and `sharp` fails, force prebuilt binaries:',
          content: <CodeBlock code="SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm install -g openclaw@latest" executable />
        }
      ]
    },
    cloud: {
      title: 'Cloud Deploy',
      icon: <Cloud className="w-8 h-8 text-primary-500 dark:text-primary-400" />,
      description: 'Deploy OpenClaw to a VPS or Cloud Provider like Hetzner, GCP, Fly.io, or AWS.',
      steps: [
        {
          title: 'Provision a clean base OS',
          description: 'Avoid third-party "1-click" marketplace images when possible. Prefer a clean base OS image (for example Ubuntu LTS 22.04 or 24.04).',
          content: (
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4 mt-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-200">Using a clean base image prevents conflicts with pre-installed software and ensures the OpenClaw installer can properly configure the environment.</p>
            </div>
          )
        },
        {
          title: 'SSH into your instance',
          description: 'Connect to your newly provisioned server.',
          content: <CodeBlock code="ssh root@your_server_ip" />
        },
        {
          title: 'Run the Installer Script',
          description: 'Execute the standard Linux installer script. It will handle Node.js installation and setup.',
          content: <CodeBlock code="curl -fsSL https://openclaw.ai/install.sh | bash" />
        },
        {
          title: 'Configure Firewall (Optional)',
          description: 'If you plan to access the Control UI remotely, ensure port 18789 is open, or set up a reverse proxy (like Nginx or Caddy) with SSL.',
          content: <CodeBlock code="ufw allow 18789/tcp" />
        }
      ]
    },
    source: {
      title: 'From Source',
      icon: <Github className="w-8 h-8 text-primary-500 dark:text-primary-400" />,
      description: 'For contributors or anyone who wants to run from a local checkout to test the latest features.',
      steps: [
        {
          title: 'Clone the repository',
          description: 'Clone the official OpenClaw repository from GitHub.',
          content: <CodeBlock code="git clone https://github.com/openclaw/openclaw.git\ncd openclaw" executable />
        },
        {
          title: 'Install dependencies and build',
          description: 'Use pnpm to install dependencies and build the UI and core packages.',
          content: <CodeBlock code="pnpm install\npnpm ui:build\npnpm build" executable />
        },
        {
          title: 'Link the CLI globally',
          description: 'Make the `openclaw` command available globally on your system.',
          content: <CodeBlock code="pnpm link --global" executable />
        },
        {
          title: 'Run onboarding',
          description: 'Initialize the daemon and connect your devices.',
          content: <CodeBlock code="openclaw onboard --install-daemon" executable />
        }
      ]
    }
  };

  const guide = guides[method || 'script'];

  if (!guide) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Guide not found</h2>
        <button onClick={() => navigate('/install')} className="mt-4 text-primary-500 dark:text-primary-400 hover:underline">Return to Install Hub</button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto bg-zinc-50 dark:bg-zinc-950 min-h-full">
      <button 
        onClick={() => navigate('/install')}
        className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors text-sm font-medium mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Install Options
      </button>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 md:p-12 shadow-sm mb-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-primary-50 dark:bg-primary-500/10 rounded-2xl flex items-center justify-center shrink-0 border border-primary-100 dark:border-primary-500/20">
            {guide.icon}
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{guide.title}</h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1 text-lg">Step-by-step installation guide</p>
          </div>
        </div>
        
        <p className="text-zinc-600 dark:text-zinc-400 text-lg leading-relaxed mb-10 pb-10 border-b border-zinc-100 dark:border-zinc-800">
          {guide.description}
        </p>

        <div className="space-y-12">
          {guide.steps.map((step: any, index: number) => (
            <div key={index} className="relative pl-10 md:pl-14">
              {/* Step Line */}
              {index !== guide.steps.length - 1 && (
                <div className="absolute left-[19px] md:left-[27px] top-10 bottom-[-48px] w-px bg-zinc-200 dark:bg-zinc-800"></div>
              )}
              
              {/* Step Number */}
              <div className="absolute left-0 md:left-2 top-0 w-10 h-10 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-full flex items-center justify-center font-bold text-lg shadow-md shadow-zinc-900/20 dark:shadow-zinc-100/20 z-10">
                {index + 1}
              </div>

              <div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2 pt-1">{step.title}</h3>
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">{step.description}</p>
                {step.content && (
                  <div className="mt-4">
                    {step.content}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 flex items-start gap-4">
        <Info className="w-6 h-6 text-zinc-400 dark:text-zinc-500 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">Need help?</h4>
          <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-1">If you encounter any issues during installation, check out our <a href="#" className="text-primary-600 dark:text-primary-400 hover:underline">Troubleshooting Guide</a> or join our <a href="#" className="text-primary-600 dark:text-primary-400 hover:underline">Discord Community</a> for support.</p>
        </div>
      </div>
    </div>
  );
}
