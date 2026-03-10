use crate::framework::{FrameworkError, Result};
use tauri::{AppHandle, Runtime};
use tauri_plugin_opener::OpenerExt;

#[derive(Clone, Debug, Default)]
pub struct BrowserService;

impl BrowserService {
  pub fn new() -> Self {
    Self
  }

  pub fn validate_url(&self, url: &str) -> Result<()> {
    validate_external_url(url)
  }

  pub fn open_external<R: Runtime>(&self, app: &AppHandle<R>, url: &str) -> Result<()> {
    self.validate_url(url)?;
    app
      .opener()
      .open_url(url.trim(), None::<String>)
      .map_err(|error| FrameworkError::Internal(error.to_string()))
  }
}

pub fn validate_external_url(url: &str) -> Result<()> {
  let trimmed = url.trim();
  if trimmed.is_empty() {
    return Err(FrameworkError::ValidationFailed(
      "external url must not be empty".to_string(),
    ));
  }

  if trimmed.chars().any(char::is_whitespace) {
    return Err(FrameworkError::ValidationFailed(
      "external url must not contain whitespace".to_string(),
    ));
  }

  let Some((scheme, _rest)) = trimmed.split_once(':') else {
    return Err(FrameworkError::ValidationFailed(
      "external url must include a scheme".to_string(),
    ));
  };

  let allowed = matches!(scheme.to_ascii_lowercase().as_str(), "http" | "https" | "mailto" | "tel");
  if allowed {
    return Ok(());
  }

  Err(FrameworkError::PolicyDenied {
    resource: scheme.to_string(),
    reason: "external url scheme is not allowed".to_string(),
  })
}

#[cfg(test)]
mod tests {
  use super::BrowserService;

  #[test]
  fn browser_service_rejects_unsafe_urls() {
    let service = BrowserService::new();

    assert!(service.validate_url("https://sdk.work").is_ok());
    assert!(service.validate_url("javascript:alert(1)").is_err());
    assert!(service.validate_url("file:///C:/Windows").is_err());
  }
}
