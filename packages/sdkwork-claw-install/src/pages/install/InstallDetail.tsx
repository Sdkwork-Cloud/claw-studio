import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Cloud,
  Copy,
  Github,
  Info,
  Package,
  Play,
  Server,
  SquareTerminal,
  Terminal,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import type { HubInstallRequest } from '@sdkwork/claw-infrastructure';
import { installerService } from '../../services';

type CodeBlockProps = {
  code: string;
  language?: string;
  executable?: boolean;
  installRequest?: HubInstallRequest;
};

function CodeBlock({
  code,
  language = 'bash',
  executable = false,
  installRequest,
}: CodeBlockProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [output, setOutput] = useState('');

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRun = async () => {
    if (!installRequest) {
      return;
    }

    setStatus('running');
    setOutput(`$ ${code}\n${t('install.detail.codeBlock.executingViaTauri')}\n`);
    try {
      const result = await installerService.runHubInstall(installRequest);
      setOutput(
        (previous) =>
          `${previous}\n${t('install.page.modal.output.completed')}\n${result.resolvedInstallRoot}`,
      );
      setStatus(result.success ? 'success' : 'error');
    } catch (error: any) {
      setStatus('error');
      setOutput(
        (previous) =>
          `${previous}\n${t('install.detail.codeBlock.errorPrefix')}: ${
            error.message || String(error)
          }`,
      );
    }
  };

  return (
    <div className="group relative mb-6 mt-3">
      <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-primary-500/20 to-primary-500/10 opacity-0 blur transition duration-500 group-hover:opacity-100" />
      <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-4 py-2">
          <span className="text-xs font-mono text-zinc-400">{language}</span>
          <div className="flex items-center gap-3">
            {executable && installRequest && (
              <button
                onClick={handleRun}
                disabled={status === 'running'}
                className="flex items-center gap-1.5 p-1 text-xs font-medium text-primary-400 transition-colors hover:text-primary-300 disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5" />
                {status === 'running'
                  ? t('install.detail.codeBlock.running')
                  : t('install.detail.codeBlock.run')}
              </button>
            )}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 p-1 text-xs font-medium text-zinc-400 transition-colors hover:text-white"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  {t('common.copied')}
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  {t('common.copy')}
                </>
              )}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto p-4">
          <pre className="text-sm font-mono text-zinc-300">
            <code>{code}</code>
          </pre>
        </div>

        {status !== 'idle' && (
          <div className="border-t border-zinc-800 bg-zinc-950 p-4">
            <div className="mb-2 flex items-center gap-2">
              <SquareTerminal className="h-4 w-4 text-zinc-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                {t('install.detail.codeBlock.terminalOutput')}
              </span>
            </div>
            <pre
              className={`whitespace-pre-wrap text-xs font-mono ${
                status === 'error' ? 'text-red-400' : 'text-zinc-300'
              }`}
            >
              {output}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

export function InstallDetail() {
  const { t } = useTranslation();
  const { method } = useParams<{ method: string }>();
  const navigate = useNavigate();

  const guides = useMemo(
    () => ({
      script: {
        title: t('install.detail.guides.script.title'),
        description: t('install.detail.guides.script.description'),
        icon: <Terminal className="h-8 w-8 text-primary-500 dark:text-primary-400" />,
        steps: [
          {
            title: t('install.detail.guides.script.steps.openTerminal.title'),
            description: t('install.detail.guides.script.steps.openTerminal.description'),
          },
          {
            title: t('install.detail.guides.script.steps.runCommand.title'),
            description: t('install.detail.guides.script.steps.runCommand.description'),
            content: (
              <div className="mt-4 space-y-6">
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {t('install.detail.platforms.macosLinuxWsl')}
                  </h4>
                  <CodeBlock code="curl -fsSL https://openclaw.ai/install.sh | bash" executable />
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {t('install.detail.platforms.windowsPowerShell')}
                  </h4>
                  <CodeBlock
                    code="iwr -useb https://openclaw.ai/install.ps1 | iex"
                    language="powershell"
                    executable
                  />
                </div>
              </div>
            ),
          },
          {
            title: t('install.detail.guides.script.steps.onboarding.title'),
            description: t('install.detail.guides.script.steps.onboarding.description'),
          },
          {
            title: t('install.detail.guides.script.steps.skipOnboarding.title'),
            description: t('install.detail.guides.script.steps.skipOnboarding.description'),
            content: (
              <div className="mt-4 space-y-6">
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {t('install.detail.platforms.macosLinuxWsl')}
                  </h4>
                  <CodeBlock
                    code="curl -fsSL https://openclaw.ai/install.sh | bash -s -- --no-onboard"
                    executable
                  />
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {t('install.detail.platforms.windowsPowerShell')}
                  </h4>
                  <CodeBlock
                    code="& ([scriptblock]::Create((iwr -useb https://openclaw.ai/install.ps1))) -NoOnboard"
                    language="powershell"
                    executable
                  />
                </div>
              </div>
            ),
          },
        ],
      },
      docker: {
        title: t('install.detail.guides.docker.title'),
        description: t('install.detail.guides.docker.description'),
        icon: <Server className="h-8 w-8 text-primary-500 dark:text-primary-400" />,
        steps: [
          {
            title: t('install.detail.guides.docker.steps.download.title'),
            description: t('install.detail.guides.docker.steps.download.description'),
            content: (
              <CodeBlock
                code="curl -O https://raw.githubusercontent.com/openclaw/openclaw/main/docker-setup.sh\nchmod +x docker-setup.sh"
                executable
              />
            ),
          },
          {
            title: t('install.detail.guides.docker.steps.run.title'),
            description: t('install.detail.guides.docker.steps.run.description'),
            content: <CodeBlock code="./docker-setup.sh" executable />,
          },
          {
            title: t('install.detail.guides.docker.steps.enableSandbox.title'),
            description: t('install.detail.guides.docker.steps.enableSandbox.description'),
            content: <CodeBlock code="export OPENCLAW_SANDBOX=1\n./docker-setup.sh" executable />,
          },
          {
            title: t('install.detail.guides.docker.steps.accessUi.title'),
            description: t('install.detail.guides.docker.steps.accessUi.description'),
            content: (
              <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {t('install.detail.guides.docker.steps.accessUi.items.openBrowser')}{' '}
                  <code className="rounded bg-zinc-200 px-1.5 py-0.5 font-mono text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
                    http://127.0.0.1:18789/
                  </code>
                </p>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {t('install.detail.guides.docker.steps.accessUi.items.pasteToken')}
                </p>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {t('install.detail.guides.docker.steps.accessUi.items.needUrlAgain')}
                </p>
                <CodeBlock
                  code="docker compose run --rm openclaw-cli dashboard --no-open"
                  executable
                />
              </div>
            ),
          },
        ],
      },
      npm: {
        title: t('install.detail.guides.npm.title'),
        description: t('install.detail.guides.npm.description'),
        icon: <Package className="h-8 w-8 text-primary-500 dark:text-primary-400" />,
        steps: [
          {
            title: t('install.detail.guides.npm.steps.verifyNode.title'),
            description: t('install.detail.guides.npm.steps.verifyNode.description'),
            content: <CodeBlock code="node --version" executable />,
          },
          {
            title: t('install.detail.guides.npm.steps.installGlobally.title'),
            description: t('install.detail.guides.npm.steps.installGlobally.description'),
            content: (
              <div className="mt-4 space-y-6">
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {t('install.detail.guides.npm.steps.installGlobally.usingNpm')}
                  </h4>
                  <CodeBlock code="npm install -g openclaw@latest" executable />
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {t('install.detail.guides.npm.steps.installGlobally.usingPnpm')}
                  </h4>
                  <CodeBlock code="pnpm add -g openclaw@latest\npnpm approve-builds -g" executable />
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {t('install.detail.guides.npm.steps.installGlobally.pnpmNote')}
                  </p>
                </div>
              </div>
            ),
          },
          {
            title: t('install.detail.guides.npm.steps.runOnboarding.title'),
            description: t('install.detail.guides.npm.steps.runOnboarding.description'),
            content: <CodeBlock code="openclaw onboard --install-daemon" executable />,
          },
          {
            title: t('install.detail.guides.npm.steps.troubleshooting.title'),
            description: t('install.detail.guides.npm.steps.troubleshooting.description'),
            content: (
              <CodeBlock
                code="SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm install -g openclaw@latest"
                executable
              />
            ),
          },
        ],
      },
      cloud: {
        title: t('install.detail.guides.cloud.title'),
        description: t('install.detail.guides.cloud.description'),
        icon: <Cloud className="h-8 w-8 text-primary-500 dark:text-primary-400" />,
        steps: [
          {
            title: t('install.detail.guides.cloud.steps.provisionOs.title'),
            description: t('install.detail.guides.cloud.steps.provisionOs.description'),
            content: (
              <div className="mt-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
                <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" />
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  {t('install.detail.guides.cloud.steps.provisionOs.warning')}
                </p>
              </div>
            ),
          },
          {
            title: t('install.detail.guides.cloud.steps.ssh.title'),
            description: t('install.detail.guides.cloud.steps.ssh.description'),
            content: <CodeBlock code="ssh root@your_server_ip" />,
          },
          {
            title: t('install.detail.guides.cloud.steps.runInstaller.title'),
            description: t('install.detail.guides.cloud.steps.runInstaller.description'),
            content: <CodeBlock code="curl -fsSL https://openclaw.ai/install.sh | bash" />,
          },
          {
            title: t('install.detail.guides.cloud.steps.firewall.title'),
            description: t('install.detail.guides.cloud.steps.firewall.description'),
            content: <CodeBlock code="ufw allow 18789/tcp" />,
          },
        ],
      },
      source: {
        title: t('install.detail.guides.source.title'),
        description: t('install.detail.guides.source.description'),
        icon: <Github className="h-8 w-8 text-primary-500 dark:text-primary-400" />,
        steps: [
          {
            title: t('install.detail.guides.source.steps.clone.title'),
            description: t('install.detail.guides.source.steps.clone.description'),
            content: (
              <CodeBlock
                code="git clone https://github.com/openclaw/openclaw.git\ncd openclaw"
                executable
              />
            ),
          },
          {
            title: t('install.detail.guides.source.steps.installAndBuild.title'),
            description: t('install.detail.guides.source.steps.installAndBuild.description'),
            content: <CodeBlock code="pnpm install\npnpm ui:build\npnpm build" executable />,
          },
          {
            title: t('install.detail.guides.source.steps.linkCli.title'),
            description: t('install.detail.guides.source.steps.linkCli.description'),
            content: <CodeBlock code="pnpm link --global" executable />,
          },
          {
            title: t('install.detail.guides.source.steps.runOnboarding.title'),
            description: t('install.detail.guides.source.steps.runOnboarding.description'),
            content: <CodeBlock code="openclaw onboard --install-daemon" executable />,
          },
        ],
      },
    }),
    [t],
  );

  const guide = method ? guides[method as keyof typeof guides] : undefined;

  if (!guide) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {t('install.detail.notFound.title')}
        </h2>
        <button
          onClick={() => navigate('/install')}
          className="mt-4 text-primary-500 hover:underline dark:text-primary-400"
        >
          {t('install.detail.notFound.back')}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-zinc-50 p-4 dark:bg-zinc-950 md:p-8">
      <div className="mx-auto max-w-4xl">
        <button
          onClick={() => navigate('/install')}
          className="mb-8 flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('install.detail.back')}
        </button>

        <div className="mb-8 rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:p-12">
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-primary-100 bg-primary-50 dark:border-primary-500/20 dark:bg-primary-500/10">
              {guide.icon}
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                {guide.title}
              </h1>
              <p className="mt-1 text-lg text-zinc-500 dark:text-zinc-400">
                {t('install.detail.stepByStepGuide')}
              </p>
            </div>
          </div>

          <p className="mb-10 border-b border-zinc-100 pb-10 text-lg leading-relaxed text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
            {guide.description}
          </p>

          <div className="space-y-12">
            {guide.steps.map((step, index) => (
              <div key={step.title} className="relative pl-10 md:pl-14">
                {index !== guide.steps.length - 1 && (
                  <div className="absolute left-[19px] top-10 bottom-[-48px] w-px bg-zinc-200 dark:bg-zinc-800 md:left-[27px]" />
                )}

                <div className="absolute left-0 top-0 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-lg font-bold text-white shadow-md shadow-zinc-900/20 dark:bg-zinc-100 dark:text-zinc-900 dark:shadow-zinc-100/20 md:left-2">
                  {index + 1}
                </div>

                <div>
                  <h3 className="mb-2 pt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100">
                    {step.title}
                  </h3>
                  <p className="leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {step.description}
                  </p>
                  {step.content && <div className="mt-4">{step.content}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <Info className="mt-0.5 h-6 w-6 shrink-0 text-zinc-400 dark:text-zinc-500" />
          <div>
            <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">
              {t('install.detail.help.title')}
            </h4>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {t('install.detail.help.description.before')}{' '}
              <a href="#" className="text-primary-600 hover:underline dark:text-primary-400">
                {t('install.detail.help.description.troubleshootingGuide')}
              </a>{' '}
              {t('install.detail.help.description.middle')}{' '}
              <a href="#" className="text-primary-600 hover:underline dark:text-primary-400">
                {t('install.detail.help.description.discordCommunity')}
              </a>{' '}
              {t('install.detail.help.description.after')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
