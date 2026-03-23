export type OpenClawInstallDetailId =
  | 'wsl'
  | 'installer'
  | 'installerCli'
  | 'git'
  | 'npm'
  | 'pnpm'
  | 'source'
  | 'docker'
  | 'podman'
  | 'bun'
  | 'ansible'
  | 'nix'
  | 'cloud';

export type OpenClawInstallDetailDocLink = {
  label: string;
  url: string;
  description: string;
};

export type OpenClawInstallDetail = {
  id: OpenClawInstallDetailId;
  title: string;
  summary: string;
  supportedHosts: Array<'windows' | 'macos' | 'linux'>;
  bestFor: string[];
  prerequisites: string[];
  platformNotes: string[];
  followUp: string[];
  docs: OpenClawInstallDetailDocLink[];
  aliases: string[];
};

const DOCS = {
  install: 'https://docs.openclaw.ai/install',
  installer: 'https://docs.openclaw.ai/install/installer',
  wizard: 'https://docs.openclaw.ai/start/wizard',
  gettingStarted: 'https://docs.openclaw.ai/start/getting-started',
  windows: 'https://docs.openclaw.ai/platforms/windows',
  docker: 'https://docs.openclaw.ai/install/docker',
  podman: 'https://docs.openclaw.ai/install/podman',
  bun: 'https://docs.openclaw.ai/install/bun',
  ansible: 'https://docs.openclaw.ai/install/ansible',
  nix: 'https://docs.openclaw.ai/install/nix',
  node: 'https://docs.openclaw.ai/install/node',
  digitalocean: 'https://docs.openclaw.ai/install/digitalocean',
  azure: 'https://docs.openclaw.ai/install/azure',
} as const;

const DETAILS: Record<OpenClawInstallDetailId, OpenClawInstallDetail> = {
  wsl: {
    id: 'wsl',
    title: 'Windows via WSL2',
    summary:
      'Recommended Windows path for the smoothest OpenClaw CLI, Gateway, and daemon experience.',
    supportedHosts: ['windows'],
    bestFor: [
      'Windows workstations that need the most stable day-to-day OpenClaw setup',
      'Users who want Linux-style daemon management and better tooling compatibility',
      'Install flows that should match the upstream recommended path',
    ],
    prerequisites: [
      'Enable WSL2 and install a modern Ubuntu distro before running the guided install.',
      'Turn on systemd inside WSL before installing the Gateway daemon.',
      'Inside WSL, Node 24 is recommended and Node 22.16+ remains supported.',
    ],
    platformNotes: [
      'OpenClaw docs explicitly call WSL2 the more stable Windows path and recommend it for the full experience.',
      'For headless startup before Windows login, the docs call out enabling linger and bootstrapping WSL on boot.',
    ],
    followUp: [
      'Run onboarding with daemon install after the profile finishes.',
      'Confirm Gateway health from inside WSL before connecting Claw Studio or mobile clients.',
    ],
    docs: [
      {
        label: 'Windows guide',
        url: DOCS.windows,
        description: 'WSL2 setup, native Windows caveats, and service-install guidance.',
      },
      {
        label: 'Install overview',
        url: DOCS.install,
        description: 'Official install entry point with installer-script and package-manager paths.',
      },
      {
        label: 'Onboarding (CLI)',
        url: DOCS.wizard,
        description: 'Gateway bootstrap, provider auth, workspace setup, and verification.',
      },
    ],
    aliases: ['wsl', 'windows-wsl', 'openclaw-wsl'],
  },
  installer: {
    id: 'installer',
    title: 'Official installer script',
    summary:
      'Fastest general-purpose path. The upstream installer detects the host, installs prerequisites when needed, and can launch onboarding.',
    supportedHosts: ['windows', 'macos', 'linux'],
    bestFor: [
      'Fresh installs on macOS, Linux, or Windows where you want the supported default path',
      'Users who want the least manual setup and the closest alignment with upstream docs',
      'Interactive installs that should immediately hand off into onboarding',
    ],
    prerequisites: [
      'Node 24 is recommended. Node 22.16+ remains supported for compatibility.',
      'Windows is supported, but WSL2 is still the steadier full-experience path.',
      'Use the dedicated installer internals doc when you need automation flags, dry runs, or CI behavior.',
    ],
    platformNotes: [
      'The install overview describes the installer script as the recommended and fastest installation path.',
      'The installer internals doc explains install.sh, install-cli.sh, and install.ps1 separately so automation stays aligned with upstream behavior.',
    ],
    followUp: [
      'Continue into onboarding to configure Gateway, workspace, channels, and skills.',
      'Verify the CLI, doctor, and Gateway status once the script completes.',
    ],
    docs: [
      {
        label: 'Installer internals',
        url: DOCS.installer,
        description: 'Flags, automation modes, git mode, dry run support, and Windows PowerShell behavior.',
      },
      {
        label: 'Getting started',
        url: DOCS.gettingStarted,
        description: 'Fast path from installation into onboarding and first chat.',
      },
      {
        label: 'Install overview',
        url: DOCS.install,
        description: 'Current official matrix for installer, npm/pnpm, source, and container methods.',
      },
    ],
    aliases: ['installer', 'script', 'shared-installer-script', 'openclaw'],
  },
  installerCli: {
    id: 'installerCli',
    title: 'Installer CLI local prefix',
    summary:
      'Local-prefix workflow that keeps Node and OpenClaw inside a managed directory without requiring a system-wide runtime.',
    supportedHosts: ['macos', 'linux'],
    bestFor: [
      'Hosts where you want a self-contained OpenClaw prefix under ~/.openclaw or a custom directory',
      'Automation that should not rely on a preinstalled system Node runtime',
      'Unix environments where you want the official scripted path but not a global install',
    ],
    prerequisites: [
      'macOS or Linux host with curl and a shell environment that can run the upstream install-cli script.',
      'Git is still required by the upstream workflow when it needs to fetch source content.',
      'Use the installer internals doc for prefix, JSON output, and automation flags.',
    ],
    platformNotes: [
      'The installer internals doc positions install-cli.sh as the local-prefix alternative to install.sh.',
      'This method stays Unix-only in the current hub-installer registry and should not be surfaced on Windows.',
    ],
    followUp: [
      'Add the managed prefix bin directory to PATH if your shell session does not pick it up automatically.',
      'Run onboarding after the prefix install if you want Gateway and provider setup immediately.',
    ],
    docs: [
      {
        label: 'Installer internals',
        url: DOCS.installer,
        description: 'install-cli.sh flow, prefix handling, JSON output, and automation switches.',
      },
      {
        label: 'Onboarding (CLI)',
        url: DOCS.wizard,
        description: 'Provider auth, Gateway setup, and first-run verification after the prefix install.',
      },
    ],
    aliases: ['installercli', 'installer-cli', 'install-cli', 'unix-installer-cli', 'openclaw-cli-script'],
  },
  git: {
    id: 'git',
    title: 'Installer script (git mode)',
    summary:
      'Use the official installer while keeping a managed local checkout for builds and updates.',
    supportedHosts: ['windows', 'macos', 'linux'],
    bestFor: [
      'Power users who want the official installer flow but prefer a local checkout',
      'Debugging or patching scenarios where a managed git working tree is useful',
      'Upstream-aligned scripted installs that need git instead of npm binaries',
    ],
    prerequisites: [
      'Git must be available or installable by the upstream script.',
      'Node 24 is recommended, and pnpm is used when the git build path is selected.',
      'Windows users should still prefer WSL2 when running the full git workflow.',
    ],
    platformNotes: [
      'Installer internals document git mode as an install.sh/install.ps1 option rather than a separate top-level guide.',
      'This path is best when you intentionally want a managed checkout, not just the CLI binary on PATH.',
    ],
    followUp: [
      'Keep the managed checkout updated through the same installer path instead of manual drift.',
      'Run doctor after updates so Gateway and config migrations stay clean.',
    ],
    docs: [
      {
        label: 'Installer internals',
        url: DOCS.installer,
        description: 'Git mode, checkout selection, no-prompt behavior, and update flags.',
      },
      {
        label: 'Install overview',
        url: DOCS.install,
        description: 'How the git path fits into the current supported install matrix.',
      },
    ],
    aliases: ['git', 'shared-installer-git', 'openclaw-git'],
  },
  npm: {
    id: 'npm',
    title: 'npm global install',
    summary:
      'Manual package-manager path for hosts that already manage Node and want a global CLI install.',
    supportedHosts: ['windows', 'macos', 'linux'],
    bestFor: [
      'Developer workstations that already standardize on Node and npm',
      'Hosts where you want explicit control over the runtime instead of the installer managing it',
      'Teams that need a familiar package-manager workflow before onboarding',
    ],
    prerequisites: [
      'Install Node 24 if possible. Node 22.16+ is still supported.',
      'Use the Node setup guide when PATH or runtime ownership is uncertain.',
      'Run onboarding after the package install so Gateway and provider auth are configured.',
    ],
    platformNotes: [
      'The install overview keeps npm as an alternative path when you already manage Node yourself.',
      'Windows remains supported here, but WSL2 is still the steadier full-experience route.',
    ],
    followUp: [
      'Verify the global binary resolves from the same shell PATH that Claw Studio will inherit.',
      'If the install finishes but the command is missing, use the official Node troubleshooting guide.',
    ],
    docs: [
      {
        label: 'Install overview',
        url: DOCS.install,
        description: 'npm and pnpm commands, onboarding handoff, and current alternative-method guidance.',
      },
      {
        label: 'Node.js setup',
        url: DOCS.node,
        description: 'Version requirements, install options, and PATH troubleshooting.',
      },
      {
        label: 'Getting started',
        url: DOCS.gettingStarted,
        description: 'Quick verification steps after the package install completes.',
      },
    ],
    aliases: ['npm', 'shared-npm', 'openclaw-npm'],
  },
  pnpm: {
    id: 'pnpm',
    title: 'pnpm global install',
    summary:
      'Package-manager path for pnpm-based environments that want a global OpenClaw install with explicit build approval.',
    supportedHosts: ['windows', 'macos', 'linux'],
    bestFor: [
      'Teams that already standardize on pnpm and want OpenClaw to follow the same tooling path',
      'Developer machines where global package installs are already centrally managed',
      'Install flows that want a manual Node/runtime contract instead of the installer handling it',
    ],
    prerequisites: [
      'Install Node 24 if possible. Node 22.16+ is still supported.',
      'pnpm requires an explicit pnpm approve-builds -g step after the first global install.',
      'Run onboarding after the package install so Gateway and auth setup match the official quickstart.',
    ],
    platformNotes: [
      'The install overview calls out the pnpm build-approval step explicitly and treats it as part of the supported workflow.',
      'This method is available across host platforms, but Windows users still get the best overall experience through WSL2.',
    ],
    followUp: [
      'Verify the approved build completed before assuming the CLI is ready.',
      'If PATH or shell discovery is inconsistent, use the Node troubleshooting guide before re-running onboarding.',
    ],
    docs: [
      {
        label: 'Install overview',
        url: DOCS.install,
        description: 'Current pnpm install flow, approval note, and onboarding handoff.',
      },
      {
        label: 'Node.js setup',
        url: DOCS.node,
        description: 'Version requirements plus PATH repair steps if the binary is not discovered.',
      },
    ],
    aliases: ['pnpm', 'shared-pnpm', 'openclaw-pnpm'],
  },
  source: {
    id: 'source',
    title: 'Source build',
    summary:
      'Clone, build, and run OpenClaw from a local checkout when you need full repository control.',
    supportedHosts: ['windows', 'macos', 'linux'],
    bestFor: [
      'Contributors, patch authors, and advanced debugging sessions',
      'Hosts where you want to step through the source tree directly',
      'Workflows that need local edits before onboarding or packaging',
    ],
    prerequisites: [
      'Git, Node 24, and pnpm should all be available before attempting a source build.',
      'Use WSL2 rather than native Windows when you want the most friction-free source workflow on Windows.',
      'Source installs are the most manual path and should only be chosen intentionally.',
    ],
    platformNotes: [
      'The install overview keeps source as a contributor-focused alternative rather than the default setup path.',
      'The hub-installer source profile is useful for guided local builds, but the official docs remain the authority on development prerequisites.',
    ],
    followUp: [
      'Keep the checkout and linked CLI in sync when switching branches or updating dependencies.',
      'Run onboarding or invoke the CLI from inside the repo once the build finishes.',
    ],
    docs: [
      {
        label: 'Install overview',
        url: DOCS.install,
        description: 'Official source-build entry point and the current command sequence.',
      },
      {
        label: 'Getting started',
        url: DOCS.gettingStarted,
        description: 'Verification and onboarding flow once the build is complete.',
      },
    ],
    aliases: ['source', 'shared-source-build', 'openclaw-source'],
  },
  docker: {
    id: 'docker',
    title: 'Docker workflow',
    summary:
      'Containerized deployment path for headless, isolated, or VPS-style OpenClaw installs.',
    supportedHosts: ['windows', 'macos', 'linux'],
    bestFor: [
      'Headless or server-style installs where isolation matters more than local shell integration',
      'Windows hosts using Docker Desktop or a WSL-backed Docker workflow',
      'Operators who want container lifecycle control or a VPS/cloud-friendly path',
    ],
    prerequisites: [
      'Docker must be available on the host or inside the selected WSL runtime.',
      'Git is still required because the upstream Docker workflow fetches the OpenClaw source tree.',
      'Use the Docker-specific docs when you need sandboxing, VM runtime notes, or long-lived host guidance.',
    ],
    platformNotes: [
      'The hub-installer registry already distinguishes Windows host Docker and Windows-via-WSL Docker variants.',
      'The official Docker guide is the source of truth for container-specific runtime and sandbox expectations.',
    ],
    followUp: [
      'Verify the container stack and Gateway health from the runtime that owns Docker.',
      'Use the Docker docs when you need remote-host or VM runtime setup beyond local guided install.',
    ],
    docs: [
      {
        label: 'Docker guide',
        url: DOCS.docker,
        description: 'Containerized install, onboarding, sandboxing, and dashboard access guidance.',
      },
      {
        label: 'Install overview',
        url: DOCS.install,
        description: 'How Docker fits into the current supported install matrix.',
      },
    ],
    aliases: [
      'docker',
      'windows-docker-host',
      'windows-docker-wsl',
      'unix-docker',
      'openclaw-docker',
    ],
  },
  podman: {
    id: 'podman',
    title: 'Podman workflow',
    summary:
      'Rootless container path for Unix hosts that prefer Podman over Docker.',
    supportedHosts: ['macos', 'linux'],
    bestFor: [
      'Unix hosts that standardize on rootless Podman',
      'Operators who want a containerized OpenClaw deployment without Docker',
      'Hosts that need the documented Quadlet-friendly Podman path',
    ],
    prerequisites: [
      'Podman and Git should both be available before starting this workflow.',
      'This path is currently Unix-only and should not be surfaced on Windows.',
      'Use the dedicated Podman docs for rootless service and image details.',
    ],
    platformNotes: [
      'The hub-installer manifest links Podman directly to the official Podman guide and treats it as a distinct container method.',
      'This path is intended for current Unix hosts rather than generic cross-platform onboarding.',
    ],
    followUp: [
      'Verify the rootless container service and data paths under the chosen user account.',
      'Keep the Podman-specific lifecycle steps aligned with the official docs instead of copying Docker assumptions.',
    ],
    docs: [
      {
        label: 'Podman guide',
        url: DOCS.podman,
        description: 'Rootless container setup, optional Quadlet service integration, and operational guidance.',
      },
      {
        label: 'Install overview',
        url: DOCS.install,
        description: 'Where Podman sits inside the official alternative-install matrix.',
      },
    ],
    aliases: ['podman', 'unix-podman', 'openclaw-podman'],
  },
  bun: {
    id: 'bun',
    title: 'Bun experimental workflow',
    summary:
      'Experimental source-oriented runtime path for advanced Unix users who explicitly want Bun.',
    supportedHosts: ['macos', 'linux'],
    bestFor: [
      'Advanced Unix users who intentionally want the Bun-based workflow',
      'Experiments that need Bun specifically rather than the default Node/pnpm path',
      'Cases where you understand the tradeoffs and do not need the default recommended runtime',
    ],
    prerequisites: [
      'Treat this as experimental and prefer the installer or package-manager paths unless you specifically need Bun.',
      'This method is Unix-only in both docs and registry coverage.',
      'Read the Bun guide before choosing it because upstream explicitly frames it as a gotchas-and-tradeoffs path.',
    ],
    platformNotes: [
      'The dedicated Bun page exists because this path has different constraints than the default Node-based setup.',
      'The install overview positions Bun as an alternative rather than a default install recommendation.',
    ],
    followUp: [
      'Verify the runtime and Gateway behavior before adopting this path broadly.',
      'If you need the most predictable support surface, switch back to installer, npm, or pnpm instead.',
    ],
    docs: [
      {
        label: 'Bun guide',
        url: DOCS.bun,
        description: 'Experimental Bun-specific workflow, tradeoffs, and setup details.',
      },
      {
        label: 'Install overview',
        url: DOCS.install,
        description: 'How the Bun path fits into the current alternative-method matrix.',
      },
    ],
    aliases: ['bun', 'unix-bun', 'openclaw-bun'],
  },
  ansible: {
    id: 'ansible',
    title: 'Ansible workflow',
    summary:
      'Automated, hardened installation path for managed Linux fleets and repeatable infrastructure.',
    supportedHosts: ['linux'],
    bestFor: [
      'Infrastructure teams provisioning repeatable Linux installs',
      'Operators who want a more hardened, automated host setup',
      'Remote or fleet scenarios where manual workstation-style onboarding is not enough',
    ],
    prerequisites: [
      'Choose this when you want infrastructure automation, not a quick local desktop install.',
      'Plan for a Debian 11+ or Ubuntu 20.04+ host with root or sudo access before starting the playbook.',
      'The Ansible docs are required reading because this workflow assumes host-provisioning context.',
      'This path is Debian/Ubuntu-focused and should not be presented as a macOS or Windows install method.',
    ],
    platformNotes: [
      'The official Ansible guide targets Debian 11+ and Ubuntu 20.04+ production hosts rather than general Unix workstations.',
      'The hub-installer manifest links directly to the automation repository flow, so Claw Studio should defer to those docs for exact host preparation and fleet hardening.',
    ],
    followUp: [
      'Validate service status, logs, and provider login from the provisioned host account.',
      'Keep host policy and firewall assumptions in sync with the official automation guide.',
    ],
    docs: [
      {
        label: 'Ansible guide',
        url: DOCS.ansible,
        description: 'Automated install, hardened defaults, and post-provision operational steps.',
      },
      {
        label: 'Install overview',
        url: DOCS.install,
        description: 'Where the Ansible workflow fits into the official install matrix.',
      },
    ],
    aliases: ['ansible', 'unix-ansible', 'openclaw-ansible'],
  },
  nix: {
    id: 'nix',
    title: 'Nix workflow',
    summary:
      'Declarative install path for Nix-based environments that want pinned OpenClaw configuration.',
    supportedHosts: ['macos', 'linux'],
    bestFor: [
      'Nix-native workstations and reproducible developer environments',
      'Teams that want a declarative OpenClaw install contract',
      'Users who already manage tooling through flakes and profiles',
    ],
    prerequisites: [
      'Choose this only if you already operate in a Nix-based environment.',
      'This method is Unix-only in the current registry and docs coverage.',
      'Read the dedicated Nix guide instead of assuming the default installer behavior applies unchanged.',
    ],
    platformNotes: [
      'The Nix docs are the authoritative source for pinned versions, flakes, and declarative updates.',
      'Claw Studio should treat this as an advanced method, not the default interactive desktop path.',
    ],
    followUp: [
      'Verify the resulting profile or flake output matches the host account that will run Gateway.',
      'Use the same declarative path for updates so the environment does not drift.',
    ],
    docs: [
      {
        label: 'Nix guide',
        url: DOCS.nix,
        description: 'Declarative OpenClaw install with nix-openclaw workflows.',
      },
      {
        label: 'Install overview',
        url: DOCS.install,
        description: 'How Nix fits into the supported alternative-method matrix.',
      },
    ],
    aliases: ['nix', 'unix-nix', 'openclaw-nix'],
  },
  cloud: {
    id: 'cloud',
    title: 'Remote Linux host',
    summary:
      'Legacy route alias preserved for compatibility. Use an official VPS or cloud-host guide for long-lived remote OpenClaw installs.',
    supportedHosts: ['windows', 'macos', 'linux'],
    bestFor: [
      'Users who want OpenClaw running 24/7 on a remote Linux host',
      'Teams comparing cloud/VPS targets instead of a local desktop install',
      'Scenarios where Claw Studio should send people to the official deployment guides instead of improvising commands',
    ],
    prerequisites: [
      'Pick a target host guide first; remote installs are deployment workflows, not a single generic command.',
      'Use a modern Ubuntu or comparable Linux VM that matches the official platform guidance.',
      'Treat this as a docs handoff rather than a local hub-installer profile inside Claw Studio.',
    ],
    platformNotes: [
      'There is no current local cloud profile in the Claw Studio catalog surface, so this page exists only to preserve old routes safely.',
      'Official cloud guides are the source of truth for firewalling, durable state, and remote Gateway exposure.',
    ],
    followUp: [
      'Choose one deployment target and follow its official guide end to end instead of mixing steps across providers.',
      'After the remote host is live, connect Claw Studio or other clients to the reachable Gateway endpoint.',
    ],
    docs: [
      {
        label: 'DigitalOcean guide',
        url: DOCS.digitalocean,
        description: 'Beginner-friendly VPS deployment flow for a durable OpenClaw host.',
      },
      {
        label: 'Azure guide',
        url: DOCS.azure,
        description: 'Azure Linux VM deployment for a long-lived Gateway host.',
      },
      {
        label: 'Install overview',
        url: DOCS.install,
        description: 'Entry point for the broader deployment matrix and related install docs.',
      },
    ],
    aliases: ['cloud'],
  },
};

const DETAIL_ALIAS_INDEX = Object.values(DETAILS).reduce<Record<string, OpenClawInstallDetailId>>(
  (accumulator, detail) => {
    for (const alias of detail.aliases) {
      accumulator[normalizeInstallDetailAlias(alias)] = detail.id;
    }
    return accumulator;
  },
  {},
);

function normalizeInstallDetailAlias(value: string) {
  return value.trim().toLowerCase().replace(/[_\s]+/g, '-');
}

export function resolveOpenClawInstallDetail(
  value: string | null | undefined,
): OpenClawInstallDetail | null {
  if (!value) {
    return null;
  }

  const canonicalId = DETAIL_ALIAS_INDEX[normalizeInstallDetailAlias(value)];
  if (!canonicalId) {
    return null;
  }

  return DETAILS[canonicalId];
}
