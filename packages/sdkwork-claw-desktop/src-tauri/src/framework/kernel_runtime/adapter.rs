use crate::framework::{paths::AppPaths, Result};

use super::KernelRuntimeContract;

pub trait KernelRuntimeAdapter {
    fn runtime_id(&self) -> &'static str;

    fn contract(&self, paths: &AppPaths) -> Result<KernelRuntimeContract>;
}
