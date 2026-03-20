use crate::{
    commands::run_hub_install::{
        resolve_bundled_registry_path, resolve_registry_source, vendor_registry_source,
        HubInstallAssessmentInstallationMethod, RunHubInstallRequest,
    },
    framework::{FrameworkError, Result as FrameworkResult},
};
use hub_installer_rs::{
    manifest::load_manifest,
    registry::{load_registry, resolve_software_entry, LoadedSoftwareRegistry, SoftwareRegistryEntry},
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
const UNIX_HOST_PLATFORMS: &[&str] = &["macos", "ubuntu"];
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
        variants: &[
            CatalogVariantSeed {
                id: "windows-wsl",
                software_name: "openclaw-wsl",
                runtime_platform: "wsl",
                host_platforms: &["windows"],
                ..DEFAULT_VARIANT_SEED
            },
            CatalogVariantSeed {
                id: "shared-installer-script",
                software_name: "openclaw",
                runtime_platform: "host",
                host_platforms: SHARED_HOST_PLATFORMS,
                label_override: Some("Official installer script"),
                summary_override: Some(
                    "Run the upstream OpenClaw installer script with hub-installer-managed defaults.",
                ),
                ..DEFAULT_VARIANT_SEED
            },
            CatalogVariantSeed {
                id: "unix-installer-cli",
                software_name: "openclaw-cli-script",
                runtime_platform: "host",
                host_platforms: UNIX_HOST_PLATFORMS,
                label_override: Some("Installer CLI local prefix"),
                summary_override: Some(
                    "Install OpenClaw into a managed local prefix with the documented install-cli workflow.",
                ),
                ..DEFAULT_VARIANT_SEED
            },
            CatalogVariantSeed {
                id: "shared-installer-git",
                software_name: "openclaw-git",
                runtime_platform: "host",
                host_platforms: SHARED_HOST_PLATFORMS,
                label_override: Some("Installer script (git mode)"),
                summary_override: Some(
                    "Use the official installer in git mode to keep a local working tree under hub-installer control.",
                ),
                ..DEFAULT_VARIANT_SEED
            },
            CatalogVariantSeed {
                id: "shared-npm",
                software_name: "openclaw-npm",
                runtime_platform: "host",
                host_platforms: SHARED_HOST_PLATFORMS,
                ..DEFAULT_VARIANT_SEED
            },
            CatalogVariantSeed {
                id: "shared-pnpm",
                software_name: "openclaw-pnpm",
                runtime_platform: "host",
                host_platforms: SHARED_HOST_PLATFORMS,
                ..DEFAULT_VARIANT_SEED
            },
            CatalogVariantSeed {
                id: "shared-source-build",
                software_name: "openclaw-source",
                runtime_platform: "host",
                host_platforms: SHARED_HOST_PLATFORMS,
                ..DEFAULT_VARIANT_SEED
            },
            CatalogVariantSeed {
                id: "windows-docker-host",
                software_name: "openclaw-docker",
                runtime_platform: "host",
                host_platforms: &["windows"],
                label_override: Some("Docker workflow (Windows host)"),
                summary_override: Some(
                    "Run the OpenClaw Docker workflow on the Windows host with host-side container integration.",
                ),
                container_runtime_preference: Some("host"),
                ..DEFAULT_VARIANT_SEED
            },
            CatalogVariantSeed {
                id: "windows-docker-wsl",
                software_name: "openclaw-docker",
                runtime_platform: "wsl",
                host_platforms: &["windows"],
                label_override: Some("Docker workflow via WSL"),
                summary_override: Some(
                    "Run the OpenClaw Docker workflow inside WSL while orchestrating it from the Windows host.",
                ),
                container_runtime_preference: Some("wsl"),
                ..DEFAULT_VARIANT_SEED
            },
            CatalogVariantSeed {
                id: "unix-docker",
                software_name: "openclaw-docker",
                runtime_platform: "host",
                host_platforms: UNIX_HOST_PLATFORMS,
                container_runtime_preference: Some("host"),
                ..DEFAULT_VARIANT_SEED
            },
            CatalogVariantSeed {
                id: "unix-podman",
                software_name: "openclaw-podman",
                runtime_platform: "host",
                host_platforms: UNIX_HOST_PLATFORMS,
                label_override: Some("Podman workflow"),
                summary_override: Some(
                    "Run the documented rootless Podman deployment workflow on the current Unix host.",
                ),
                ..DEFAULT_VARIANT_SEED
            },
        ],
    },
    CatalogSeed {
        app_id: "app-codex",
        title: "Codex",
        developer: "OpenAI",
        category: "AI Agents",
        summary_software_name: "codex",
        variants: &[CatalogVariantSeed {
            id: "shared-host",
            software_name: "codex",
            runtime_platform: "host",
            host_platforms: SHARED_HOST_PLATFORMS,
            ..DEFAULT_VARIANT_SEED
        }],
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
pub fn list_hub_install_catalog<R: Runtime>(
    query: Option<HubInstallCatalogQuery>,
    app: AppHandle<R>,
) -> Result<Vec<HubInstallCatalogEntry>, String> {
    list_hub_install_catalog_at(query, &app).map_err(|error| error.to_string())
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

fn build_catalog_variant(
    loaded_registry: &LoadedSoftwareRegistry,
    seed: &CatalogVariantSeed,
) -> FrameworkResult<HubInstallCatalogVariant> {
    let manifest_platform = seed
        .host_platforms
        .first()
        .copied()
        .unwrap_or("windows");
    let resolved = resolve_software_entry(
        loaded_registry,
        seed.software_name,
        parse_supported_platform(manifest_platform)?,
    )
    .map_err(|error| FrameworkError::Internal(error.to_string()))?;
    let loaded_manifest = load_manifest(&resolved.manifest_source)
        .map_err(|error| FrameworkError::Internal(error.to_string()))?;
    let manifest = loaded_manifest.manifest;
    let installation_method = manifest
        .installation
        .as_ref()
        .map(|installation| {
            HubInstallAssessmentInstallationMethod::from(installation.method.clone())
        });
    let label = seed
        .label_override
        .map(|value| value.to_string())
        .or_else(|| installation_method
            .as_ref()
            .map(|method| method.label.clone()))
        .unwrap_or_else(|| manifest.metadata.name.clone());
    let summary = seed
        .summary_override
        .map(|value| value.to_string())
        .or_else(|| installation_method
            .as_ref()
            .map(|method| method.summary.clone()))
        .or_else(|| manifest.metadata.description.clone())
        .unwrap_or_else(|| format!("Install {} through hub-installer.", seed.software_name));

    Ok(HubInstallCatalogVariant {
        id: seed.id.to_string(),
        label,
        summary,
        software_name: seed.software_name.to_string(),
        host_platforms: seed.host_platforms.iter().map(|value| value.to_string()).collect(),
        runtime_platform: seed.runtime_platform.to_string(),
        manifest_name: Some(manifest.metadata.name),
        manifest_description: manifest.metadata.description,
        manifest_homepage: manifest.metadata.homepage,
        installation_method,
        request: build_install_request(seed),
    })
}

fn build_install_request(seed: &CatalogVariantSeed) -> RunHubInstallRequest {
    RunHubInstallRequest {
        software_name: seed.software_name.to_string(),
        registry_source: None,
        request_id: None,
        install_scope: None,
        effective_runtime_platform: if seed.runtime_platform == "wsl" {
            Some("wsl".to_string())
        } else {
            None
        },
        container_runtime_preference: seed
            .container_runtime_preference
            .map(|value| value.to_string()),
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
    use std::path::PathBuf;

    fn registry_source() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("vendor")
            .join("hub-installer")
            .join("registry")
            .join("software-registry.yaml")
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
            default_variant.installation_method.as_ref().map(|method| method.id.as_str()),
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
            brew.variants[0]
                .manifest_homepage
                .as_deref(),
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
}
