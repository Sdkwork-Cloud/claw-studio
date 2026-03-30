use std::{
    env, fs,
    path::{Path, PathBuf},
};

const FRONTEND_DIST_RELATIVE_PATH: &str = "../dist";
const GENERATED_BUNDLED_RELATIVE_PATH: &str = "generated/bundled";
const GENERATED_BUNDLED_PLACEHOLDER_FILE_NAME: &str = "placeholder.txt";

fn main() {
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed={FRONTEND_DIST_RELATIVE_PATH}");
    println!("cargo:rerun-if-changed={GENERATED_BUNDLED_RELATIVE_PATH}");

    let manifest_dir = PathBuf::from(
        env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR is always set by Cargo"),
    );

    ensure_required_tauri_paths(&manifest_dir);
    tauri_build::build();
}

fn cargo_warn(message: &str) {
    println!("cargo:warning={message}");
}

fn tauri_debug_enabled() -> bool {
    matches!(
        env::var("SDKWORK_TAURI_DEBUG"),
        Ok(value)
            if matches!(
                value.trim().to_ascii_lowercase().as_str(),
                "1" | "true" | "yes" | "on"
            )
    )
}

fn cargo_debug(label: &str, value: impl AsRef<str>) {
    if tauri_debug_enabled() {
        cargo_warn(&format!("[desktop-tauri-build] {label}: {}", value.as_ref()));
    }
}

fn ensure_required_tauri_paths(manifest_dir: &Path) {
    cargo_debug("manifest_dir", manifest_dir.display().to_string());
    cargo_debug(
        "cargo_target_dir",
        env::var("CARGO_TARGET_DIR").unwrap_or_else(|_| "<unset>".to_string()),
    );
    cargo_debug(
        "profile",
        env::var("PROFILE").unwrap_or_else(|_| "<unset>".to_string()),
    );
    cargo_debug(
        "out_dir",
        env::var("OUT_DIR").unwrap_or_else(|_| "<unset>".to_string()),
    );
    ensure_directory_exists(
        &manifest_dir.join(FRONTEND_DIST_RELATIVE_PATH),
        "frontendDist",
    );
    ensure_generated_bundled_placeholder(
        &manifest_dir.join(GENERATED_BUNDLED_RELATIVE_PATH),
    );
}

fn ensure_directory_exists(directory: &Path, label: &str) {
    if directory.exists() {
        return;
    }

    if let Err(error) = fs::create_dir_all(directory) {
        cargo_warn(&format!(
            "failed to create missing {} directory {}: {}",
            label,
            directory.display(),
            error
        ));
        return;
    }

    cargo_warn(&format!(
        "created missing {} directory {} so clean-clone cargo builds can resolve the Tauri config",
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
