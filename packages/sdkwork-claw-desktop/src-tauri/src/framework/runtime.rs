use crate::framework::Result;

pub fn run_blocking<T, F>(label: &'static str, task: F) -> Result<T>
where
    F: FnOnce() -> Result<T>,
{
    let _ = label;
    task()
}

#[cfg(test)]
mod tests {
    #[test]
    fn run_blocking_returns_task_result() {
        let value = super::run_blocking("echo", || Ok::<_, crate::framework::FrameworkError>(41))
            .expect("blocking result");

        assert_eq!(value, 41);
    }
}
