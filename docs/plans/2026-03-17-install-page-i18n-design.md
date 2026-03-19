# Install Page I18n Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove hardcoded copy from the install experience and ensure `react-i18next` fully drives every visible label, toast, and prompt on `Install.tsx`/`InstallDetail.tsx`.

**Architecture:** We keep the existing install components but swap every hardcoded string for `t(...)` calls scoped under an `install` namespace. Shared helper labels (e.g., OS options, terminal output headers) will live inside `install.pages` or `install.detail` sections so both components can reuse them. Toast/confirm text will be routed through helper functions to keep mutation logic clean.

**Tech Stack:** React + TypeScript, `react-i18next`, `sonner` (for toasts), and existing design tokens.

---

### Approach 1: Inline `t` for every string
**Steps:** wrap each literal inside `Install.tsx`/`InstallDetail.tsx` with `t('install.page.xxx')` or `t('install.detail.yyy')`.
**Pros:** Fast, low ceremony, keeps strings close to usage.
**Cons:** Locale file grows inline; repeated strings may diverge if shared phrases get duplicated.

### Approach 2: Centralized helper objects
**Steps:** Build helper objects near each component (e.g., `const INSTALL_METHODS = [...]`) that pull `t(...)` when the component renders, then reference them in the JSX.
**Pros:** Keeps data-driven UI consistent; easier to test.
**Cons:** Slightly more code and indirection.

### Approach 3: Config-driven scenario bundling
**Steps:** Define a config describing layout sections and reuse it for both install hero and detail. Each config entry references translation keys.
**Pros:** Highly maintainable if install experience expands.
**Cons:** Overkill for current scope; adds xml-level abstraction.

**Recommendation:** Use Approach 2; it balances maintainability with effort. We'll keep the current structure but extract the button/hero copy into translation-aware helper data so we can reuse across success/error states without littering the JSX.

Does this design look good so far?
