use serde::Deserialize;
use std::{
    collections::BTreeMap,
    env, fs,
    path::{Component, Path, PathBuf},
};

const ARTIFACTS_DIR_RELATIVE_PATH: &str = "vendor/sdkwork-api-router-artifacts";
const MANIFEST_RELATIVE_PATH: &str = "vendor/sdkwork-api-router-artifacts/manifest.json";
const BUNDLED_MANIFEST_RELATIVE_PATH: &str = "sdkwork-api-router-artifacts/manifest.json";

#[derive(Debug, Deserialize)]
struct ArtifactManifest {
    version: String,
    archives: BTreeMap<String, ArtifactArchive>,
}

#[derive(Debug, Deserialize)]
struct ArtifactArchive {
    path: String,
    binaries: Vec<String>,
}

fn main() {
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed={MANIFEST_RELATIVE_PATH}");
    println!("cargo:rerun-if-changed={ARTIFACTS_DIR_RELATIVE_PATH}");

    emit_optional_artifact_metadata();
    tauri_build::build();
}

fn emit_optional_artifact_metadata() {
    let manifest_dir = PathBuf::from(
        env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR is always set by Cargo"),
    );
    let manifest_path = manifest_dir.join(MANIFEST_RELATIVE_PATH);
    let manifest = match load_artifact_manifest(&manifest_path) {
        Ok(manifest) => manifest,
        Err(message) => {
            cargo_warn(&message);
            return;
        }
    };
    let target_key = resolve_target_key();
    let archive = match manifest.archives.get(&target_key) {
        Some(archive) => archive,
        None => {
            cargo_warn(&format!(
                "sdkwork-api-router artifact manifest {} does not declare target {}; continuing without embedded prebuilt archive metadata",
                manifest_path.display(),
                target_key
            ));
            return;
        }
    };

    if let Err(message) = validate_archive_metadata(&target_key, archive) {
        cargo_warn(&message);
        return;
    }

    let archive_relative_path = match normalize_relative_artifact_path(&archive.path) {
        Ok(relative_path) => relative_path,
        Err(message) => {
            cargo_warn(&message);
            return;
        }
    };
    let archive_path = manifest_dir
        .join(ARTIFACTS_DIR_RELATIVE_PATH)
        .join(&archive_relative_path);
    println!("cargo:rerun-if-changed={}", archive_path.display());

    if !archive_path.is_file() {
        cargo_warn(&format!(
            "missing sdkwork-api-router prebuilt archive for target {}: {}; continuing without embedded prebuilt archive metadata",
            target_key,
            archive_path.display()
        ));
        return;
    }

    let bundled_archive_relative_path =
        format!("sdkwork-api-router-artifacts/{archive_relative_path}");
    println!("cargo:rustc-env=SDKWORK_API_ROUTER_TARGET_KEY={target_key}");
    println!(
        "cargo:rustc-env=SDKWORK_API_ROUTER_ARTIFACT_VERSION={}",
        manifest.version
    );
    println!(
        "cargo:rustc-env=SDKWORK_API_ROUTER_MANIFEST_RELATIVE_PATH={BUNDLED_MANIFEST_RELATIVE_PATH}"
    );
    println!(
        "cargo:rustc-env=SDKWORK_API_ROUTER_ARCHIVE_RELATIVE_PATH={bundled_archive_relative_path}"
    );
}

fn cargo_warn(message: &str) {
    println!("cargo:warning={message}");
}

fn load_artifact_manifest(path: &Path) -> Result<ArtifactManifest, String> {
    let content = fs::read_to_string(path).map_err(|error| {
        format!(
            "failed to read sdkwork-api-router artifact manifest {}: {}",
            path.display(),
            error
        )
    })?;
    let manifest: ArtifactManifest = serde_json::from_str(&content).map_err(|error| {
        format!(
            "failed to parse sdkwork-api-router artifact manifest {}: {}",
            path.display(),
            error
        )
    })?;

    if manifest.version.trim().is_empty() {
        return Err(format!(
            "sdkwork-api-router artifact manifest {} must include a non-empty version",
            path.display()
        ));
    }

    if manifest.archives.is_empty() {
        return Err(format!(
            "sdkwork-api-router artifact manifest {} must include at least one archive entry",
            path.display()
        ));
    }

    Ok(manifest)
}

fn validate_archive_metadata(target_key: &str, archive: &ArtifactArchive) -> Result<(), String> {
    if archive.path.trim().is_empty() {
        return Err(format!(
            "sdkwork-api-router archive path must not be empty for target {target_key}"
        ));
    }

    if archive.binaries.is_empty() {
        return Err(format!(
            "sdkwork-api-router archive binaries must not be empty for target {target_key}"
        ));
    }

    Ok(())
}

fn normalize_relative_artifact_path(path: &str) -> Result<String, String> {
    let candidate = Path::new(path);
    if candidate.is_absolute() {
        return Err(format!(
            "sdkwork-api-router archive path must stay relative: {path}"
        ));
    }

    let mut segments = Vec::new();
    for component in candidate.components() {
        match component {
            Component::Normal(segment) => segments.push(segment.to_string_lossy().into_owned()),
            Component::CurDir => {}
            Component::ParentDir | Component::Prefix(_) | Component::RootDir => {
                return Err(format!(
                    "sdkwork-api-router archive path must not escape the artifact root: {path}"
                ));
            }
        }
    }

    if segments.is_empty() {
        return Err("sdkwork-api-router archive path resolved to an empty relative path".into());
    }

    Ok(segments.join("/"))
}

fn resolve_target_key() -> String {
    let target_os = env::var("CARGO_CFG_TARGET_OS").expect("Cargo always provides target os");
    let target_arch =
        env::var("CARGO_CFG_TARGET_ARCH").expect("Cargo always provides target architecture");

    match (target_os.as_str(), target_arch.as_str()) {
        ("windows", "x86_64") => "windows-x64".to_string(),
        ("windows", "aarch64") => "windows-arm64".to_string(),
        ("linux", "x86_64") => "linux-x64".to_string(),
        ("linux", "aarch64") => "linux-arm64".to_string(),
        ("macos", "x86_64") => "macos-x64".to_string(),
        ("macos", "aarch64") => "macos-aarch64".to_string(),
        _ => format!("{target_os}-{target_arch}"),
    }
}
