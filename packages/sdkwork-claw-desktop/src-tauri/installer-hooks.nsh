!macro NSIS_HOOK_POSTINSTALL
  nsExec::ExecToLog '"$INSTDIR\Claw Studio.exe" --register-openclaw-cli'
  Pop $0
  IntCmp $0 0 postinstall_done
    DetailPrint "Embedded OpenClaw CLI registration deferred to first app launch (exit code $0)."
  postinstall_done:
!macroend
