#!/bin/sh

set -eu

resolve_install_root_override() {
  if [ -n "${SDKWORK_CLAW_INSTALL_ROOT:-}" ]; then
    printf '%s\n' "$SDKWORK_CLAW_INSTALL_ROOT"
    return 0
  fi

  rpm_install_root="$(resolve_rpm_install_root || true)"
  if [ -n "$rpm_install_root" ]; then
    printf '%s\n' "$rpm_install_root"
    return 0
  fi

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --install-root)
        shift
        if [ "$#" -eq 0 ] || [ -z "${1:-}" ]; then
          echo "Missing value for --install-root." >&2
          exit 1
        fi

        printf '%s\n' "$1"
        return 0
        ;;
      --install-root=*)
        printf '%s\n' "${1#--install-root=}"
        return 0
        ;;
    esac

    shift
  done

  return 1
}

resolve_rpm_install_root() {
  if [ -z "${RPM_INSTALL_PREFIX:-}" ]; then
    return 1
  fi

  install_root="$(find_install_root_from_prefix "$RPM_INSTALL_PREFIX" || true)"
  if [ -n "$install_root" ]; then
    printf '%s\n' "$install_root"
    return 0
  fi

  printf '%s\n' "$RPM_INSTALL_PREFIX"
}

find_install_root_from_prefix() {
  prefix="$1"

  for manifest_path in \
    "$prefix/resources/openclaw/manifest.json" \
    "$prefix/bin/resources/openclaw/manifest.json" \
    "$prefix/lib/"*/resources/openclaw/manifest.json \
    "$prefix/lib64/"*/resources/openclaw/manifest.json
  do
    if [ ! -f "$manifest_path" ]; then
      continue
    fi

    dirname "$(dirname "$(dirname "$manifest_path")")"
    return 0
  done

  return 1
}

find_install_root() {
  for manifest_path in \
    /usr/bin/resources/openclaw/manifest.json \
    /usr/lib/*/resources/openclaw/manifest.json \
    /usr/lib64/*/resources/openclaw/manifest.json \
    /opt/*/resources/openclaw/manifest.json
  do
    if [ ! -f "$manifest_path" ]; then
      continue
    fi

    dirname "$(dirname "$(dirname "$manifest_path")")"
    return 0
  done

  return 1
}

find_runtime_prepare_binary() {
  install_root="$1"

  for candidate in \
    "$install_root/sdkwork-claw-desktop" \
    "$install_root/claw-studio" \
    "$install_root/Claw Studio"
  do
    if [ -x "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  candidate="$(find "$install_root" -maxdepth 1 -type f -perm -u+x 2>/dev/null | head -n 1 || true)"
  if [ -n "$candidate" ]; then
    printf '%s\n' "$candidate"
    return 0
  fi

  candidate="$(command -v claw-studio 2>/dev/null || true)"
  if [ -n "$candidate" ]; then
    printf '%s\n' "$candidate"
    return 0
  fi

  candidate="$(command -v sdkwork-claw-desktop 2>/dev/null || true)"
  if [ -n "$candidate" ]; then
    printf '%s\n' "$candidate"
    return 0
  fi

  return 1
}

main() {
  install_root="$(resolve_install_root_override "$@" || true)"
  if [ -z "$install_root" ]; then
    install_root="$(find_install_root || true)"
  fi

  if [ -z "$install_root" ]; then
    echo "Unable to resolve Claw Studio install root from the packaged OpenClaw manifest." >&2
    exit 1
  fi

  binary_path="$(find_runtime_prepare_binary "$install_root" || true)"
  if [ -z "$binary_path" ]; then
    echo "Unable to locate the installed Claw Studio binary under $install_root." >&2
    exit 1
  fi

  "$binary_path" --prepare-bundled-openclaw-runtime --install-root "$install_root"
}

main "$@"
