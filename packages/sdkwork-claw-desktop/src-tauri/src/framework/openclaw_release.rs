pub const BUNDLED_OPENCLAW_VERSION: &str = env!("SDKWORK_BUNDLED_OPENCLAW_VERSION");

pub fn bundled_openclaw_version() -> &'static str {
    BUNDLED_OPENCLAW_VERSION
}
