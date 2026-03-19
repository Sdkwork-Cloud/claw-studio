use std::path::PathBuf;

use hub_installer_rs::{ApplyManifestOptions, InstallEngine, RegistryInstallOptions};
use hub_installer_rs::types::SupportedPlatform;

fn registry_source() -> String {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("registry")
        .join("software-registry.yaml")
        .display()
        .to_string()
}

#[test]
fn inspection_reports_dependency_guidance_for_rust_native_profiles() {
    let result = InstallEngine::inspect_from_registry(
        "zeroclaw-source",
        RegistryInstallOptions {
            registry_source: Some(registry_source()),
            apply: ApplyManifestOptions {
                platform: Some(SupportedPlatform::Windows),
                dry_run: true,
                ..ApplyManifestOptions::default()
            },
        },
    )
    .expect("registry inspection should succeed");

    assert_eq!(
        result.assessment_result.manifest_name,
        "ZeroClaw Install (Source)"
    );
    assert_eq!(
        result.assessment_result.platform,
        SupportedPlatform::Windows
    );
    assert!(result.assessment_result.ready || !result.assessment_result.issues.is_empty());

    let cargo_dependency = result
        .assessment_result
        .dependencies
        .iter()
        .find(|dependency| dependency.id == "cargo")
        .expect("cargo dependency should be included");

    assert_eq!(cargo_dependency.check_type, "command");
    assert_eq!(cargo_dependency.target, "cargo");
    assert!(!cargo_dependency.remediation_commands.is_empty());
    assert!(
        result
            .assessment_result
            .runtime
            .command_availability
            .contains_key("cargo")
    );
}
