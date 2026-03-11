use crate::framework::{paths::AppPaths, policy::ExecutionPolicy, Result};

pub mod browser;
pub mod dialog;
pub mod filesystem;
pub mod jobs;
pub mod process;
pub mod system;

use self::{
  browser::BrowserService,
  dialog::DialogService,
  filesystem::FileSystemService,
  jobs::JobService,
  process::ProcessService,
  system::SystemService,
};

#[derive(Clone, Debug)]
pub struct FrameworkServices {
  pub system: SystemService,
  pub browser: BrowserService,
  pub dialog: DialogService,
  pub filesystem: FileSystemService,
  pub process: ProcessService,
  pub jobs: JobService,
}

impl FrameworkServices {
  pub fn new(paths: &AppPaths) -> Result<Self> {
    let policy = ExecutionPolicy::for_paths(paths)?;

    Ok(Self {
      system: SystemService::new(),
      browser: BrowserService::new(),
      dialog: DialogService::new(),
      filesystem: FileSystemService::new(),
      process: ProcessService::new(policy),
      jobs: JobService::new(),
    })
  }
}
