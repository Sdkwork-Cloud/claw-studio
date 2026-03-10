use crate::platform;

pub struct AppState {
  pub app_name: String,
  pub app_version: String,
  pub target: String,
}

impl Default for AppState {
  fn default() -> Self {
    Self {
      app_name: "Claw Studio".to_string(),
      app_version: env!("CARGO_PKG_VERSION").to_string(),
      target: platform::current_target().to_string(),
    }
  }
}
