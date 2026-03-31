use serde::Deserialize;
use std::{
    collections::BTreeMap,
    env, fs,
    io::ErrorKind,
    path::{Component, Path, PathBuf},
};

const ARTIFACTS_DIR_RELATIVE_PATH: &str = "vendor/sdkwork-api-router-artifacts";
const MANIFEST_RELATIVE_PATH: &str = "vendor/sdkwork-api-router-artifacts/manifest.json";
const BUNDLED_MANIFEST_RELATIVE_PATH: &str = "sdkwork-api-router-artifacts/manifest.json";
const FRONTEND_DIST_RELATIVE_PATH: &str = "../dist";
const GENERATED_BUNDLED_RELATIVE_PATH: &str = "generated/bundled";
const GENERATED_BUNDLED_PLACEHOLDER_FILE_NAME: &str = "placeholder.txt";
const API_ROUTER_RESOURCES_RELATIVE_PATH: &str = "resources/sdkwork-api-router-runtime";
const API_ROUTER_RUNTIME_RELATIVE_PATH: &str = "resources/sdkwork-api-router-runtime/runtime";
const API_ROUTER_RUNTIME_PLACEHOLDER_RELATIVE_PATH: &str =
    "resources/sdkwork-api-router-runtime/runtime/placeholder.txt";

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
    println!("cargo:rerun-if-changed={FRONTEND_DIST_RELATIVE_PATH}");
    println!("cargo:rerun-if-changed={GENERATED_BUNDLED_RELATIVE_PATH}");
    println!("cargo:rerun-if-changed={API_ROUTER_RESOURCES_RELATIVE_PATH}");

    let manifest_dir = PathBuf::from(
        env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR is always set by Cargo"),
    );

    ensure_required_tauri_paths(&manifest_dir);
    emit_optional_artifact_metadata(&manifest_dir);
    tauri_build::build();
}

fn emit_optional_artifact_metadata(manifest_dir: &Path) {
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

fn ensure_required_tauri_paths(manifest_dir: &Path) {
    ensure_directory_exists(
        &manifest_dir.join(FRONTEND_DIST_RELATIVE_PATH),
        "frontendDist",
    );
    ensure_generated_bundled_placeholder(
        &manifest_dir.join(GENERATED_BUNDLED_RELATIVE_PATH),
    );
    ensure_api_router_runtime_placeholder(manifest_dir);
}

fn ensure_directory_exists(directory: &Path, label: &str) {
    if directory.exists() {
        return;
    }

    match fs::create_dir_all(directory) {
        Ok(()) => {
            cargo_warn(&format!(
                "created missing {} directory {} so clean-clone cargo builds can resolve the Tauri config",
                label,
                directory.display()
            ));
        }
        Err(error) if error.kind() == ErrorKind::AlreadyExists => {
            repair_stale_directory_entry(directory, label);
        }
        Err(error) => {
            cargo_warn(&format!(
                "failed to create missing {} directory {}: {}",
                label,
                directory.display(),
                error
            ));
        }
    }
}

fn repair_stale_directory_entry(directory: &Path, label: &str) {
    let metadata = match fs::symlink_metadata(directory) {
        Ok(metadata) => metadata,
        Err(error) => {
            cargo_warn(&format!(
                "failed to inspect stale {} path {}: {}",
                label,
                directory.display(),
                error
            ));
            return;
        }
    };

    if metadata.is_dir() {
        return;
    }

    let remove_result = if metadata.file_type().is_symlink() || metadata.is_file() {
        fs::remove_file(directory)
    } else {
        fs::remove_dir_all(directory)
    };

    if let Err(error) = remove_result {
        cargo_warn(&format!(
            "failed to remove stale {} path {}: {}",
            label,
            directory.display(),
            error
        ));
        return;
    }

    if let Err(error) = fs::create_dir_all(directory) {
        cargo_warn(&format!(
            "failed to recreate {} directory {} after removing a stale path: {}",
            label,
            directory.display(),
            error
        ));
        return;
    }

    cargo_warn(&format!(
        "recreated {} directory {} after removing a stale clean-clone path",
        label,
        directory.display()
    ));
}

fn ensure_generated_bundled_placeholder(directory: &Path) {
    ensure_directory_exists(directory, "generated bundled resources");

    let placeholder_path = directory.join(GENERATED_BUNDLED_PLACEHOLDER_FILE_NAME);
    let has_real_entries = match fs::read_dir(directory) {
        Ok(entries) => entries
            .filter_map(Result::ok)
            .any(|entry| entry.file_name() != GENERATED_BUNDLED_PLACEHOLDER_FILE_NAME),
        Err(error) => {
            cargo_warn(&format!(
                "failed to inspect generated bundled resources at {}: {}",
                directory.display(),
                error
            ));
            return;
        }
    };

    if has_real_entries {
        if placeholder_path.is_file() {
            if let Err(error) = fs::remove_file(&placeholder_path) {
                cargo_warn(&format!(
                    "failed to remove stale generated bundled placeholder {}: {}",
                    placeholder_path.display(),
                    error
                ));
            }
        }
        return;
    }

    if placeholder_path.is_file() {
        return;
    }

    if let Err(error) = fs::write(
        &placeholder_path,
        "Generated placeholder file for clean-clone cargo builds.\n",
    ) {
        cargo_warn(&format!(
            "failed to write generated bundled placeholder {}: {}",
            placeholder_path.display(),
            error
        ));
        return;
    }

    cargo_warn(&format!(
        "seeded generated bundled placeholder {} so Tauri resource glob resolution stays valid before sync",
        placeholder_path.display()
    ));
}

fn ensure_api_router_runtime_placeholder(manifest_dir: &Path) {
    let runtime_directory = manifest_dir.join(API_ROUTER_RUNTIME_RELATIVE_PATH);
    ensure_directory_exists(&runtime_directory, "sdkwork-api-router bundled runtime");

    let placeholder_path = manifest_dir.join(API_ROUTER_RUNTIME_PLACEHOLDER_RELATIVE_PATH);
    let has_real_entries = match fs::read_dir(&runtime_directory) {
        Ok(entries) => entries
            .filter_map(Result::ok)
            .any(|entry| entry.file_name() != GENERATED_BUNDLED_PLACEHOLDER_FILE_NAME),
        Err(error) => {
            cargo_warn(&format!(
                "failed to inspect sdkwork-api-router bundled runtime at {}: {}",
                runtime_directory.display(),
                error
            ));
            return;
        }
    };

    if has_real_entries {
        if placeholder_path.is_file() {
            if let Err(error) = fs::remove_file(&placeholder_path) {
                cargo_warn(&format!(
                    "failed to remove stale sdkwork-api-router runtime placeholder {}: {}",
                    placeholder_path.display(),
                    error
                ));
            }
        }
        return;
    }

    if placeholder_path.is_file() {
        return;
    }

    if let Err(error) = fs::write(
        &placeholder_path,
        "Bundled sdkwork-api-router runtime placeholder for clean-clone cargo builds.\n",
    ) {
        cargo_warn(&format!(
            "failed to write sdkwork-api-router runtime placeholder {}: {}",
            placeholder_path.display(),
            error
        ));
        return;
    }

    cargo_warn(&format!(
        "seeded sdkwork-api-router runtime placeholder {} so the Tauri resource glob stays valid before runtime preparation",
        placeholder_path.display()
    ));
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
