use crate::{
    commands::run_hub_install::{
        resolve_bundled_registry_path, resolve_registry_source, vendor_registry_source,
        HubInstallAssessmentInstallationMethod, RunHubInstallRequest,
    },
    framework::{runtime, FrameworkError, Result as FrameworkResult},
};
use hub_installer_rs::{
    manifest::load_manifest,
    registry::{
        load_registry, resolve_software_entry, LoadedSoftwareRegistry, SoftwareRegistryEntry,
    },
    types::SupportedPlatform,
};
use std::{collections::BTreeMap, path::Path};
use tauri::{AppHandle, Runtime};

#[derive(Debug, Clone, serde::Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct HubInstallCatalogQuery {
    #[serde(default)]
    pub host_platform: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HubInstallCatalogVariant {
    pub id: String,
    pub label: String,
    pub summary: String,
    pub software_name: String,
    pub host_platforms: Vec<String>,
    pub runtime_platform: String,
    pub manifest_name: Option<String>,
    pub manifest_description: Option<String>,
    pub manifest_homepage: Option<String>,
    pub installation_method: Option<HubInstallAssessmentInstallationMethod>,
    pub request: RunHubInstallRequest,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HubInstallCatalogEntry {
    pub app_id: String,
    pub title: String,
    pub developer: String,
    pub category: String,
    pub summary: String,
    pub description: Option<String>,
    pub homepage: Option<String>,
    pub tags: Vec<String>,
    pub default_variant_id: String,
    pub default_software_name: String,
    pub supported_host_platforms: Vec<String>,
    pub variants: Vec<HubInstallCatalogVariant>,
}

#[derive(Clone, Copy)]
struct CatalogSeed {
    app_id: &'static str,
    title: &'static str,
    developer: &'static str,
    category: &'static str,
    summary_software_name: &'static str,
    variants: &'static [CatalogVariantSeed],
}

#[derive(Clone, Copy)]
struct CatalogVariantSeed {
    id: &'static str,
    software_name: &'static str,
    runtime_platform: &'static str,
    host_platforms: &'static [&'static str],
    label_override: Option<&'static str>,
    summary_override: Option<&'static str>,
    container_runtime_preference: Option<&'static str>,
}

const SHARED_HOST_PLATFORMS: &[&str] = &["windows", "macos", "ubuntu"];
const CATALOG_HOST_PLATFORMS: &[SupportedPlatform] = &[
    SupportedPlatform::Windows,
    SupportedPlatform::Macos,
    SupportedPlatform::Ubuntu,
];
const OPENCLAW_APP_ID: &str = "app-openclaw";
const OPENCLAW_LEGACY_SOFTWARE_NAME: &str = "openclaw-all";
const DEFAULT_VARIANT_SEED: CatalogVariantSeed = CatalogVariantSeed {
    id: "",
    software_name: "",
    runtime_platform: "host",
    host_platforms: &[],
    label_override: None,
    summary_override: None,
    container_runtime_preference: None,
};

const CATALOG_SEEDS: &[CatalogSeed] = &[
    CatalogSeed {
        app_id: "app-openclaw",
        title: "OpenClaw",
        developer: "OpenClaw",
        category: "AI Agents",
        summary_software_name: "openclaw",
        variants: &[],
    },
    CatalogSeed {
        app_id: "app-nodejs",
        title: "Node.js",
        developer: "Node.js Foundation",
        category: "Runtimes",
        summary_software_name: "nodejs",
        variants: &[CatalogVariantSeed {
            id: "shared-host",
            software_name: "nodejs",
            runtime_platform: "host",
            host_platforms: SHARED_HOST_PLATFORMS,
            ..DEFAULT_VARIANT_SEED
        }],
    },
    CatalogSeed {
        app_id: "app-npm",
        title: "npm",
        developer: "npm",
        category: "Package Managers",
        summary_software_name: "npm",
        variants: &[CatalogVariantSeed {
            id: "shared-host",
            software_name: "npm",
            runtime_platform: "host",
            host_platforms: SHARED_HOST_PLATFORMS,
            ..DEFAULT_VARIANT_SEED
        }],
    },
    CatalogSeed {
        app_id: "app-pnpm",
        title: "pnpm",
        developer: "pnpm",
        category: "Package Managers",
        summary_software_name: "pnpm",
        variants: &[CatalogVariantSeed {
            id: "shared-host",
            software_name: "pnpm",
            runtime_platform: "host",
            host_platforms: SHARED_HOST_PLATFORMS,
            ..DEFAULT_VARIANT_SEED
        }],
    },
    CatalogSeed {
        app_id: "app-homebrew",
        title: "Homebrew",
        developer: "Homebrew",
        category: "Package Managers",
        summary_software_name: "brew",
        variants: &[
            CatalogVariantSeed {
                id: "windows-wsl",
                software_name: "brew",
                runtime_platform: "wsl",
                host_platforms: &["windows"],
                ..DEFAULT_VARIANT_SEED
            },
            CatalogVariantSeed {
                id: "macos-host",
                software_name: "brew",
                runtime_platform: "host",
                host_platforms: &["macos"],
                ..DEFAULT_VARIANT_SEED
            },
            CatalogVariantSeed {
                id: "ubuntu-host",
                software_name: "brew",
                runtime_platform: "host",
                host_platforms: &["ubuntu"],
                ..DEFAULT_VARIANT_SEED
            },
        ],
    },
    CatalogSeed {
        app_id: "app-python",
        title: "Python",
        developer: "Python Software Foundation",
        category: "Runtimes",
        summary_software_name: "python",
        variants: &[CatalogVariantSeed {
            id: "shared-host",
            software_name: "python",
            runtime_platform: "host",
            host_platforms: SHARED_HOST_PLATFORMS,
            ..DEFAULT_VARIANT_SEED
        }],
    },
    CatalogSeed {
        app_id: "app-git",
        title: "Git",
        developer: "Git",
        category: "Developer Foundations",
        summary_software_name: "git",
        variants: &[CatalogVariantSeed {
            id: "shared-host",
            software_name: "git",
            runtime_platform: "host",
            host_platforms: SHARED_HOST_PLATFORMS,
            ..DEFAULT_VARIANT_SEED
        }],
    },
    CatalogSeed {
        app_id: "app-ffmpeg",
        title: "FFmpeg",
        developer: "FFmpeg",
        category: "Developer Foundations",
        summary_software_name: "ffmpeg",
        variants: &[CatalogVariantSeed {
            id: "shared-host",
            software_name: "ffmpeg",
            runtime_platform: "host",
            host_platforms: SHARED_HOST_PLATFORMS,
            ..DEFAULT_VARIANT_SEED
        }],
    },
];

#[tauri::command]
pub async fn list_hub_install_catalog<R: Runtime>(
    query: Option<HubInstallCatalogQuery>,
    app: AppHandle<R>,
) -> Result<Vec<HubInstallCatalogEntry>, String> {
    runtime::run_blocking_async("installer.list_hub_install_catalog", move || {
        list_hub_install_catalog_at(query, &app)
    })
    .await
    .map_err(|error| error.to_string())
}

pub fn list_hub_install_catalog_at<R: Runtime>(
    query: Option<HubInstallCatalogQuery>,
    app: &AppHandle<R>,
) -> FrameworkResult<Vec<HubInstallCatalogEntry>> {
    let registry_source = resolve_registry_source(
        None,
        resolve_bundled_registry_path(app),
        vendor_registry_source(),
    )?;

    catalog_from_registry_source(query, &registry_source)
}

fn catalog_from_registry_source(
    query: Option<HubInstallCatalogQuery>,
    registry_source: &Path,
) -> FrameworkResult<Vec<HubInstallCatalogEntry>> {
    let loaded_registry = load_registry(&registry_source.display().to_string())
        .map_err(|error| FrameworkError::Internal(error.to_string()))?;
    let host_platform = query
        .and_then(|value| value.host_platform)
        .unwrap_or_else(|| "windows".to_string());

    CATALOG_SEEDS
        .iter()
        .map(|seed| build_catalog_entry(&loaded_registry, seed, &host_platform))
        .collect()
}

fn build_catalog_entry(
    loaded_registry: &LoadedSoftwareRegistry,
    seed: &CatalogSeed,
    host_platform: &str,
) -> FrameworkResult<HubInstallCatalogEntry> {
    if seed.app_id == OPENCLAW_APP_ID {
        return build_openclaw_catalog_entry(loaded_registry, seed, host_platform);
    }

    let summary_entry = resolve_entry(loaded_registry, seed.summary_software_name, host_platform)?;
    let variants = seed
        .variants
        .iter()
        .map(|variant| build_catalog_variant(loaded_registry, variant))
        .collect::<FrameworkResult<Vec<_>>>()?;
    let default_variant = seed
        .variants
        .iter()
        .find(|variant| variant.host_platforms.contains(&host_platform))
        .unwrap_or_else(|| &seed.variants[0]);

    Ok(HubInstallCatalogEntry {
        app_id: seed.app_id.to_string(),
        title: seed.title.to_string(),
        developer: seed.developer.to_string(),
        category: seed.category.to_string(),
        summary: summary_entry
            .description
            .clone()
            .unwrap_or_else(|| format!("Install {} through hub-installer.", seed.title)),
        description: summary_entry.description.clone(),
        homepage: summary_entry.homepage.clone(),
        tags: summary_entry.tags.clone(),
        default_variant_id: default_variant.id.to_string(),
        default_software_name: default_variant.software_name.to_string(),
        supported_host_platforms: supported_host_platforms(seed),
        variants,
    })
}

fn build_openclaw_catalog_entry(
    loaded_registry: &LoadedSoftwareRegistry,
    seed: &CatalogSeed,
    host_platform: &str,
) -> FrameworkResult<HubInstallCatalogEntry> {
    let summary_entry = resolve_entry(loaded_registry, seed.summary_software_name, host_platform)?;
    let normalized_host_platform = normalize_catalog_host_platform(host_platform)?;
    let mut variants = build_openclaw_catalog_variants(loaded_registry)?;
    variants.retain(|variant| variant_supports_host_platform(variant, normalized_host_platform));
    variants.sort_by(|left, right| compare_openclaw_variant(left, right));

    let default_variant = resolve_default_openclaw_variant(&variants, normalized_host_platform)
        .ok_or_else(|| FrameworkError::NotFound("openclaw catalog variant".to_string()))?;

    Ok(HubInstallCatalogEntry {
        app_id: seed.app_id.to_string(),
        title: seed.title.to_string(),
        developer: seed.developer.to_string(),
        category: seed.category.to_string(),
        summary: summary_entry
            .description
            .clone()
            .unwrap_or_else(|| format!("Install {} through hub-installer.", seed.title)),
        description: summary_entry.description.clone(),
        homepage: summary_entry.homepage.clone(),
        tags: summary_entry.tags.clone(),
        default_variant_id: default_variant.id.clone(),
        default_software_name: default_variant.software_name.clone(),
        supported_host_platforms: supported_host_platforms_from_variants(&variants),
        variants,
    })
}

#[derive(Debug, Clone)]
struct DynamicCatalogVariantSeed {
    id: String,
    software_name: String,
    runtime_platform: String,
    host_platforms: Vec<String>,
    label: String,
    summary: String,
    manifest_name: Option<String>,
    manifest_description: Option<String>,
    manifest_homepage: Option<String>,
    installation_method: Option<HubInstallAssessmentInstallationMethod>,
    container_runtime_preference: Option<String>,
}

fn build_openclaw_catalog_variants(
    loaded_registry: &LoadedSoftwareRegistry,
) -> FrameworkResult<Vec<HubInstallCatalogVariant>> {
    let mut variants = Vec::new();

    for software_name in loaded_registry
        .registry
        .entries
        .iter()
        .map(|entry| entry.name.as_str())
        .filter(|software_name| is_openclaw_profile_software(software_name))
    {
        let dynamic_variants =
            build_openclaw_dynamic_variant_seeds(loaded_registry, software_name)?;
        variants.extend(
            dynamic_variants
                .into_iter()
                .map(build_dynamic_catalog_variant),
        );
    }

    Ok(variants)
}

fn is_openclaw_profile_software(software_name: &str) -> bool {
    software_name == "openclaw"
        || (software_name.starts_with("openclaw-")
            && software_name != OPENCLAW_LEGACY_SOFTWARE_NAME)
}

fn build_openclaw_dynamic_variant_seeds(
    loaded_registry: &LoadedSoftwareRegistry,
    software_name: &str,
) -> FrameworkResult<Vec<DynamicCatalogVariantSeed>> {
    let manifest = resolve_catalog_manifest_for_any_host(loaded_registry, software_name)?;
    let supported_hosts = supported_host_platforms_from_manifest(&manifest.manifest.platforms);
    if supported_hosts.is_empty() {
        return Ok(Vec::new());
    }

    let installation_method = manifest.manifest.installation.as_ref().map(|installation| {
        HubInstallAssessmentInstallationMethod::from(installation.method.clone())
    });
    let default_label = installation_method
        .as_ref()
        .map(|method| method.label.clone())
        .unwrap_or_else(|| manifest.manifest.metadata.name.clone());
    let default_summary = installation_method
        .as_ref()
        .map(|method| method.summary.clone())
        .or_else(|| manifest.manifest.metadata.description.clone())
        .unwrap_or_else(|| format!("Install {software_name} through hub-installer."));

    let base_seed = DynamicCatalogVariantSeed {
        id: openclaw_catalog_variant_id(software_name),
        software_name: software_name.to_string(),
        runtime_platform: "host".to_string(),
        host_platforms: supported_hosts.clone(),
        label: openclaw_catalog_label_override(software_name)
            .unwrap_or(&default_label)
            .to_string(),
        summary: openclaw_catalog_summary_override(software_name)
            .unwrap_or(&default_summary)
            .to_string(),
        manifest_name: Some(manifest.manifest.metadata.name.clone()),
        manifest_description: manifest.manifest.metadata.description.clone(),
        manifest_homepage: manifest.manifest.metadata.homepage.clone(),
        installation_method,
        container_runtime_preference: None,
    };

    if software_name == "openclaw-wsl" {
        return Ok(vec![DynamicCatalogVariantSeed {
            id: "windows-wsl".to_string(),
            runtime_platform: "wsl".to_string(),
            host_platforms: vec!["windows".to_string()],
            ..base_seed
        }]);
    }

    if software_name == "openclaw-docker" {
        let mut variants = Vec::new();

        if supported_hosts.iter().any(|platform| platform == "windows") {
            variants.push(DynamicCatalogVariantSeed {
                id: "windows-docker-host".to_string(),
                host_platforms: vec!["windows".to_string()],
                label: "Docker workflow (Windows host)".to_string(),
                summary: "Run the OpenClaw Docker workflow on the Windows host with host-side container integration.".to_string(),
                container_runtime_preference: Some("host".to_string()),
                ..base_seed.clone()
            });
            variants.push(DynamicCatalogVariantSeed {
                id: "windows-docker-wsl".to_string(),
                runtime_platform: "wsl".to_string(),
                host_platforms: vec!["windows".to_string()],
                label: "Docker workflow via WSL".to_string(),
                summary: "Run the OpenClaw Docker workflow inside WSL while orchestrating it from the Windows host.".to_string(),
                container_runtime_preference: Some("wsl".to_string()),
                ..base_seed.clone()
            });
        }

        let unix_hosts: Vec<String> = supported_hosts
            .into_iter()
            .filter(|platform| platform != "windows")
            .collect();
        if !unix_hosts.is_empty() {
            variants.push(DynamicCatalogVariantSeed {
                id: "unix-docker".to_string(),
                host_platforms: unix_hosts,
                container_runtime_preference: Some("host".to_string()),
                ..base_seed
            });
        }

        return Ok(variants);
    }

    Ok(vec![base_seed])
}

fn resolve_catalog_manifest_for_any_host(
    loaded_registry: &LoadedSoftwareRegistry,
    software_name: &str,
) -> FrameworkResult<hub_installer_rs::manifest::LoadedManifest> {
    for host_platform in CATALOG_HOST_PLATFORMS {
        if let Ok(resolved) = resolve_software_entry(loaded_registry, software_name, *host_platform)
        {
            return load_manifest(&resolved.manifest_source)
                .map_err(|error| FrameworkError::Internal(error.to_string()));
        }
    }

    Err(FrameworkError::NotFound(format!(
        "openclaw catalog manifest for {software_name}"
    )))
}

fn supported_host_platforms_from_manifest(platforms: &[SupportedPlatform]) -> Vec<String> {
    platforms
        .iter()
        .filter_map(|platform| match platform {
            SupportedPlatform::Windows | SupportedPlatform::Macos | SupportedPlatform::Ubuntu => {
                Some(platform.as_str().to_string())
            }
            _ => None,
        })
        .collect()
}

fn build_dynamic_catalog_variant(seed: DynamicCatalogVariantSeed) -> HubInstallCatalogVariant {
    HubInstallCatalogVariant {
        id: seed.id.clone(),
        label: seed.label,
        summary: seed.summary,
        software_name: seed.software_name.clone(),
        host_platforms: seed.host_platforms.clone(),
        runtime_platform: seed.runtime_platform.clone(),
        manifest_name: seed.manifest_name,
        manifest_description: seed.manifest_description,
        manifest_homepage: seed.manifest_homepage,
        installation_method: seed.installation_method,
        request: build_install_request_from_fields(
            &seed.software_name,
            &seed.runtime_platform,
            seed.container_runtime_preference.as_deref(),
        ),
    }
}

fn openclaw_catalog_variant_id(software_name: &str) -> String {
    match software_name {
        "openclaw" => "shared-installer-script".to_string(),
        "openclaw-cli-script" => "unix-installer-cli".to_string(),
        "openclaw-git" => "shared-installer-git".to_string(),
        "openclaw-npm" => "shared-npm".to_string(),
        "openclaw-pnpm" => "shared-pnpm".to_string(),
        "openclaw-source" => "shared-source-build".to_string(),
        "openclaw-podman" => "unix-podman".to_string(),
        "openclaw-bun" => "unix-bun".to_string(),
        "openclaw-ansible" => "unix-ansible".to_string(),
        "openclaw-nix" => "unix-nix".to_string(),
        other => other.to_string(),
    }
}

fn openclaw_catalog_label_override(software_name: &str) -> Option<&'static str> {
    match software_name {
        "openclaw" => Some("Official installer script"),
        "openclaw-cli-script" => Some("Installer CLI local prefix"),
        "openclaw-git" => Some("Installer script (git mode)"),
        "openclaw-podman" => Some("Podman workflow"),
        "openclaw-bun" => Some("Bun experimental workflow"),
        "openclaw-ansible" => Some("Ansible workflow"),
        "openclaw-nix" => Some("Nix workflow"),
        _ => None,
    }
}

fn openclaw_catalog_summary_override(software_name: &str) -> Option<&'static str> {
    match software_name {
        "openclaw" => Some(
            "Run the upstream OpenClaw installer script with hub-installer-managed defaults.",
        ),
        "openclaw-cli-script" => Some(
            "Install OpenClaw into a managed local prefix with the documented install-cli workflow.",
        ),
        "openclaw-git" => Some(
            "Use the official installer in git mode to keep a local working tree under hub-installer control.",
        ),
        "openclaw-podman" => Some(
            "Run the documented rootless Podman deployment workflow on the current Unix host.",
        ),
        "openclaw-bun" => Some(
            "Build OpenClaw from source with the documented Bun runtime workflow on the current Unix host.",
        ),
        "openclaw-ansible" => Some(
            "Install OpenClaw through the documented openclaw-ansible automation repository on the current Unix host.",
        ),
        "openclaw-nix" => Some(
            "Install OpenClaw with the documented nix-openclaw flake workflows on the current Unix host.",
        ),
        _ => None,
    }
}

fn compare_openclaw_variant(
    left: &HubInstallCatalogVariant,
    right: &HubInstallCatalogVariant,
) -> std::cmp::Ordering {
    openclaw_variant_sort_key(left)
        .cmp(&openclaw_variant_sort_key(right))
        .then_with(|| left.software_name.cmp(&right.software_name))
        .then_with(|| left.id.cmp(&right.id))
}

fn openclaw_variant_sort_key(variant: &HubInstallCatalogVariant) -> (usize, usize, usize) {
    (
        match variant.id.as_str() {
            "windows-wsl" => 0,
            "shared-installer-script" => 1,
            "unix-installer-cli" => 2,
            "shared-installer-git" => 3,
            "shared-npm" => 4,
            "shared-pnpm" => 5,
            "shared-source-build" => 6,
            "windows-docker-host" => 7,
            "windows-docker-wsl" => 8,
            "unix-docker" => 9,
            "unix-podman" => 10,
            "unix-bun" => 11,
            "unix-ansible" => 12,
            "unix-nix" => 13,
            _ => 100,
        },
        match variant.runtime_platform.as_str() {
            "wsl" => 0,
            _ => 1,
        },
        match variant.host_platforms.first().map(String::as_str) {
            Some("windows") => 0,
            Some("macos") => 1,
            Some("ubuntu") => 2,
            _ => 3,
        },
    )
}

fn resolve_default_openclaw_variant<'a>(
    variants: &'a [HubInstallCatalogVariant],
    host_platform: &str,
) -> Option<&'a HubInstallCatalogVariant> {
    let preferred_ids: &[&str] = match host_platform {
        "windows" => &["windows-wsl", "shared-installer-script"],
        "macos" | "ubuntu" | "linux" => &["shared-installer-script", "windows-wsl"],
        _ => &["shared-installer-script", "windows-wsl"],
    };

    for preferred_id in preferred_ids {
        if let Some(variant) = variants.iter().find(|variant| variant.id == *preferred_id) {
            return Some(variant);
        }
    }

    variants
        .iter()
        .find(|variant| {
            variant
                .host_platforms
                .iter()
                .any(|platform| platform == host_platform)
        })
        .or_else(|| variants.first())
}

fn supported_host_platforms_from_variants(variants: &[HubInstallCatalogVariant]) -> Vec<String> {
    let mut values = Vec::new();

    for platform in ["windows", "macos", "ubuntu"] {
        if variants
            .iter()
            .any(|variant| variant.host_platforms.iter().any(|value| value == platform))
        {
            values.push(platform.to_string());
        }
    }

    values
}

fn normalize_catalog_host_platform(host_platform: &str) -> FrameworkResult<&'static str> {
    Ok(parse_supported_platform(host_platform)?.as_str())
}

fn variant_supports_host_platform(variant: &HubInstallCatalogVariant, host_platform: &str) -> bool {
    variant
        .host_platforms
        .iter()
        .any(|value| value == host_platform)
}

fn build_catalog_variant(
    loaded_registry: &LoadedSoftwareRegistry,
    seed: &CatalogVariantSeed,
) -> FrameworkResult<HubInstallCatalogVariant> {
    let manifest_platform = seed.host_platforms.first().copied().unwrap_or("windows");
    let resolved = resolve_software_entry(
        loaded_registry,
        seed.software_name,
        parse_supported_platform(manifest_platform)?,
    )
    .map_err(|error| FrameworkError::Internal(error.to_string()))?;
    let loaded_manifest = load_manifest(&resolved.manifest_source)
        .map_err(|error| FrameworkError::Internal(error.to_string()))?;
    let manifest = loaded_manifest.manifest;
    let installation_method = manifest.installation.as_ref().map(|installation| {
        HubInstallAssessmentInstallationMethod::from(installation.method.clone())
    });
    let label = seed
        .label_override
        .map(|value| value.to_string())
        .or_else(|| {
            installation_method
                .as_ref()
                .map(|method| method.label.clone())
        })
        .unwrap_or_else(|| manifest.metadata.name.clone());
    let summary = seed
        .summary_override
        .map(|value| value.to_string())
        .or_else(|| {
            installation_method
                .as_ref()
                .map(|method| method.summary.clone())
        })
        .or_else(|| manifest.metadata.description.clone())
        .unwrap_or_else(|| format!("Install {} through hub-installer.", seed.software_name));

    Ok(HubInstallCatalogVariant {
        id: seed.id.to_string(),
        label,
        summary,
        software_name: seed.software_name.to_string(),
        host_platforms: seed
            .host_platforms
            .iter()
            .map(|value| value.to_string())
            .collect(),
        runtime_platform: seed.runtime_platform.to_string(),
        manifest_name: Some(manifest.metadata.name),
        manifest_description: manifest.metadata.description,
        manifest_homepage: manifest.metadata.homepage,
        installation_method,
        request: build_install_request(seed),
    })
}

fn build_install_request(seed: &CatalogVariantSeed) -> RunHubInstallRequest {
    build_install_request_from_fields(
        seed.software_name,
        seed.runtime_platform,
        seed.container_runtime_preference,
    )
}

fn build_install_request_from_fields(
    software_name: &str,
    runtime_platform: &str,
    container_runtime_preference: Option<&str>,
) -> RunHubInstallRequest {
    RunHubInstallRequest {
        software_name: software_name.to_string(),
        registry_source: None,
        request_id: None,
        install_scope: None,
        effective_runtime_platform: if runtime_platform == "wsl" {
            Some("wsl".to_string())
        } else {
            None
        },
        container_runtime_preference: container_runtime_preference.map(|value| value.to_string()),
        wsl_distribution: None,
        docker_context: None,
        docker_host: None,
        dry_run: false,
        verbose: false,
        sudo: false,
        timeout_ms: None,
        installer_home: None,
        install_root: None,
        work_root: None,
        bin_dir: None,
        data_root: None,
        variables: BTreeMap::new(),
    }
}

fn resolve_entry(
    loaded_registry: &LoadedSoftwareRegistry,
    software_name: &str,
    host_platform: &str,
) -> FrameworkResult<SoftwareRegistryEntry> {
    let resolved = resolve_software_entry(
        loaded_registry,
        software_name,
        parse_supported_platform(host_platform)?,
    )
    .map_err(|error| FrameworkError::Internal(error.to_string()))?;

    Ok(resolved.entry)
}

fn parse_supported_platform(value: &str) -> FrameworkResult<SupportedPlatform> {
    match value.trim().to_ascii_lowercase().as_str() {
        "windows" => Ok(SupportedPlatform::Windows),
        "macos" | "darwin" => Ok(SupportedPlatform::Macos),
        "ubuntu" | "linux" => Ok(SupportedPlatform::Ubuntu),
        other => Err(FrameworkError::ValidationFailed(format!(
            "unsupported catalog host platform {other}",
        ))),
    }
}

fn supported_host_platforms(seed: &CatalogSeed) -> Vec<String> {
    let mut values: Vec<String> = Vec::new();

    for variant in seed.variants {
        for host_platform in variant.host_platforms {
            if !values.iter().any(|current| current == host_platform) {
                values.push((*host_platform).to_string());
            }
        }
    }

    values
}

#[cfg(test)]
mod tests {
    use super::catalog_from_registry_source;
    use std::{fs, path::PathBuf};

    fn registry_source() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("vendor")
            .join("hub-installer")
            .join("registry")
            .join("software-registry.yaml")
    }

    fn openclaw_source_manifest() -> String {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("vendor")
            .join("hub-installer")
            .join("registry")
            .join("manifests")
            .join("openclaw-source.hub.yaml")
            .to_string_lossy()
            .replace('\\', "/")
    }

    fn registry_dir() -> PathBuf {
        registry_source()
            .parent()
            .expect("registry dir")
            .to_path_buf()
    }

    #[test]
    fn hub_catalog_prefers_wsl_variant_for_windows_openclaw() {
        let entries = catalog_from_registry_source(
            Some(super::HubInstallCatalogQuery {
                host_platform: Some("windows".to_string()),
            }),
            &registry_source(),
        )
        .expect("catalog should load");

        let openclaw = entries
            .iter()
            .find(|entry| entry.app_id == "app-openclaw")
            .expect("openclaw entry");
        let default_variant = openclaw
            .variants
            .iter()
            .find(|variant| variant.id == openclaw.default_variant_id)
            .expect("default variant");

        assert_eq!(openclaw.default_software_name, "openclaw-wsl");
        assert_eq!(default_variant.runtime_platform, "wsl");
        assert_eq!(
            default_variant
                .installation_method
                .as_ref()
                .map(|method| method.id.as_str()),
            Some("wsl")
        );
    }

    #[test]
    fn hub_catalog_surfaces_developer_package_manager_descriptors() {
        let entries = catalog_from_registry_source(None, &registry_source()).expect("catalog");

        let brew = entries
            .iter()
            .find(|entry| entry.app_id == "app-homebrew")
            .expect("brew entry");
        let npm = entries
            .iter()
            .find(|entry| entry.app_id == "app-npm")
            .expect("npm entry");

        assert!(brew.tags.iter().any(|tag| tag == "package-manager"));
        assert_eq!(brew.variants.len(), 3);
        assert_eq!(
            brew.variants[0].manifest_homepage.as_deref(),
            Some("https://brew.sh/")
        );
        assert_eq!(npm.default_software_name, "npm");
        assert_eq!(
            npm.variants[0]
                .installation_method
                .as_ref()
                .map(|method| method.id.as_str()),
            Some("npm-global")
        );
    }

    #[test]
    fn hub_catalog_omits_codex_seed_from_desktop_catalog() {
        let entries = catalog_from_registry_source(None, &registry_source()).expect("catalog");

        assert!(
            entries.iter().all(|entry| entry.app_id != "app-codex"),
            "desktop catalog should stay focused on OpenClaw plus shared runtime/package-manager prerequisites"
        );
    }

    #[test]
    fn hub_catalog_surfaces_openclaw_multi_profile_matrix() {
        let entries = catalog_from_registry_source(
            Some(super::HubInstallCatalogQuery {
                host_platform: Some("windows".to_string()),
            }),
            &registry_source(),
        )
        .expect("catalog");

        let openclaw = entries
            .iter()
            .find(|entry| entry.app_id == "app-openclaw")
            .expect("openclaw entry");
        let variant_ids: Vec<&str> = openclaw
            .variants
            .iter()
            .map(|variant| variant.id.as_str())
            .collect();

        assert!(variant_ids.contains(&"windows-wsl"));
        assert!(variant_ids.contains(&"shared-installer-script"));
        assert!(variant_ids.contains(&"shared-source-build"));
        assert!(variant_ids.contains(&"windows-docker-host"));
        assert!(variant_ids.contains(&"windows-docker-wsl"));
    }

    #[test]
    fn hub_catalog_surfaces_openclaw_extended_unix_profiles() {
        let entries = catalog_from_registry_source(
            Some(super::HubInstallCatalogQuery {
                host_platform: Some("macos".to_string()),
            }),
            &registry_source(),
        )
        .expect("catalog");

        let openclaw = entries
            .iter()
            .find(|entry| entry.app_id == "app-openclaw")
            .expect("openclaw entry");
        let variant_ids: Vec<&str> = openclaw
            .variants
            .iter()
            .map(|variant| variant.id.as_str())
            .collect();

        assert!(variant_ids.contains(&"shared-installer-script"));
        assert!(variant_ids.contains(&"unix-installer-cli"));
        assert!(variant_ids.contains(&"shared-installer-git"));
        assert!(variant_ids.contains(&"shared-npm"));
        assert!(variant_ids.contains(&"shared-pnpm"));
        assert!(variant_ids.contains(&"shared-source-build"));
        assert!(variant_ids.contains(&"unix-docker"));
        assert!(variant_ids.contains(&"unix-podman"));
        assert!(variant_ids.contains(&"unix-bun"));
        assert!(variant_ids.contains(&"unix-nix"));
        assert!(!variant_ids.contains(&"unix-ansible"));
    }

    #[test]
    fn hub_catalog_surfaces_openclaw_ansible_only_on_ubuntu_hosts() {
        let entries = catalog_from_registry_source(
            Some(super::HubInstallCatalogQuery {
                host_platform: Some("ubuntu".to_string()),
            }),
            &registry_source(),
        )
        .expect("catalog");

        let openclaw = entries
            .iter()
            .find(|entry| entry.app_id == "app-openclaw")
            .expect("openclaw entry");
        let variant_ids: Vec<&str> = openclaw
            .variants
            .iter()
            .map(|variant| variant.id.as_str())
            .collect();

        assert!(variant_ids.contains(&"unix-ansible"));
    }

    #[test]
    fn hub_catalog_maps_linux_query_to_ubuntu_openclaw_profiles() {
        let entries = catalog_from_registry_source(
            Some(super::HubInstallCatalogQuery {
                host_platform: Some("linux".to_string()),
            }),
            &registry_source(),
        )
        .expect("catalog");

        let openclaw = entries
            .iter()
            .find(|entry| entry.app_id == "app-openclaw")
            .expect("openclaw entry");
        let variant_ids: Vec<&str> = openclaw
            .variants
            .iter()
            .map(|variant| variant.id.as_str())
            .collect();

        assert!(variant_ids.contains(&"unix-ansible"));
        assert!(variant_ids.iter().all(|id| *id != "windows-wsl"));
    }

    #[test]
    fn hub_catalog_tracks_new_openclaw_profiles_from_registry_without_parent_seed_updates() {
        let registry = fs::read_to_string(registry_source()).expect("read registry");
        let temp_registry = registry_dir().join("software-registry.test-openclaw-custom.yaml");
        let custom_manifest = openclaw_source_manifest();

        fs::write(
            &temp_registry,
            format!(
                "{registry}\n  - name: \"openclaw-custom\"\n    aliases: [\"claw-custom\"]\n    description: \"OpenClaw custom profile for regression coverage.\"\n    homepage: \"https://docs.openclaw.ai/install\"\n    tags: [\"ai\", \"agent\", \"gateway\", \"custom\"]\n    manifest: \"{custom_manifest}\"\n    variables:\n      hub_software_name: \"openclaw\"\n      hub_install_control_level: \"managed\"\n"
            ),
        )
        .expect("write temp registry");
        let entries = catalog_from_registry_source(
            Some(super::HubInstallCatalogQuery {
                host_platform: Some("macos".to_string()),
            }),
            &temp_registry,
        )
        .expect("catalog");

        let openclaw = entries
            .iter()
            .find(|entry| entry.app_id == "app-openclaw")
            .expect("openclaw entry");
        let custom_present = openclaw
            .variants
            .iter()
            .any(|variant| variant.software_name == "openclaw-custom");

        fs::remove_file(&temp_registry).expect("remove temp registry");

        assert!(
            custom_present,
            "new openclaw profiles from the submodule registry should surface without parent-side seed edits"
        );
    }
}
