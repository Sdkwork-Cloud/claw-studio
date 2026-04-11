!macro NSIS_HOOK_POSTINSTALL
  nsExec::ExecToLog '"$INSTDIR\sdkwork-claw-desktop.exe" --prepare-bundled-openclaw-runtime --install-root "$INSTDIR"'
  Pop $0
  IntCmp $0 0 postinstall_runtime_done
    DetailPrint "Embedded OpenClaw runtime prewarm failed during install (exit code $0)."
    Abort "Embedded OpenClaw runtime prewarm failed during install (exit code $0)."
  postinstall_runtime_done:
  nsExec::ExecToLog '"$INSTDIR\sdkwork-claw-desktop.exe" --register-openclaw-cli --install-root "$INSTDIR"'
  Pop $0
  IntCmp $0 0 postinstall_done
    DetailPrint "Embedded OpenClaw CLI registration deferred to first app launch (exit code $0)."
  postinstall_done:
!macroend
