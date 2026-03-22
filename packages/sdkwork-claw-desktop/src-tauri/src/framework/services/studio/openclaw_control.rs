use super::{
    openclaw_workbench::read_openclaw_cron_run_entries, StudioWorkbenchTaskExecutionRecord,
};
use crate::framework::{
    paths::AppPaths,
    services::{
        openclaw_runtime::ActivatedOpenClawRuntime,
        supervisor::{ManagedServiceLifecycle, SupervisorService, SERVICE_ID_OPENCLAW_GATEWAY},
    },
    FrameworkError, Result,
};
use serde_json::{json, Value};
use std::{
    env, fs,
    path::Path,
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};

pub(super) fn require_running_openclaw_runtime(
    supervisor: &SupervisorService,
) -> Result<ActivatedOpenClawRuntime> {
    let runtime = supervisor
        .configured_openclaw_runtime()?
        .ok_or_else(|| FrameworkError::NotFound("configured openclaw runtime".to_string()))?;
    let snapshot = supervisor.snapshot()?;
    let gateway = snapshot
        .services
        .into_iter()
        .find(|service| service.id == SERVICE_ID_OPENCLAW_GATEWAY)
        .ok_or_else(|| FrameworkError::NotFound("managed service openclaw_gateway".to_string()))?;

    if gateway.lifecycle != ManagedServiceLifecycle::Running {
        return Err(FrameworkError::Conflict(
            "the bundled OpenClaw gateway is offline; start the built-in instance before managing cron tasks"
                .to_string(),
        ));
    }

    Ok(runtime)
}

pub(super) fn clone_openclaw_task(
    paths: &AppPaths,
    runtime: &ActivatedOpenClawRuntime,
    task_id: &str,
    name: Option<&str>,
) -> Result<()> {
    let mut params = read_openclaw_task_definition(paths, task_id)?;
    let object = params.as_object_mut().ok_or_else(|| {
        FrameworkError::ValidationFailed("OpenClaw cron job must be an object".to_string())
    })?;
    object.remove("id");
    object.remove("createdAtMs");
    object.remove("updatedAtMs");
    object.remove("state");
    if let Some(name) = name.map(str::trim).filter(|value| !value.is_empty()) {
        object.insert("name".to_string(), Value::String(name.to_string()));
    }

    let _ = run_openclaw_gateway_call(runtime, paths, "cron.add", &params)?;
    Ok(())
}

pub(super) fn run_openclaw_task_now(
    paths: &AppPaths,
    runtime: &ActivatedOpenClawRuntime,
    task_id: &str,
) -> Result<StudioWorkbenchTaskExecutionRecord> {
    let response = run_openclaw_gateway_call(
        runtime,
        paths,
        "cron.run",
        &json!({
            "id": task_id,
            "mode": "force",
        }),
    )?;
    let run_id = response
        .get("runId")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string);
    let now_ms = unix_timestamp_ms()?;

    Ok(StudioWorkbenchTaskExecutionRecord {
        id: run_id
            .clone()
            .unwrap_or_else(|| format!("{task_id}-manual-{now_ms}")),
        task_id: task_id.to_string(),
        status: "running".to_string(),
        trigger: "manual".to_string(),
        started_at: format_timestamp_ms(now_ms),
        finished_at: None,
        summary: "Manual OpenClaw cron run queued.".to_string(),
        details: run_id.map(|value| format!("runId={value}")),
    })
}

pub(super) fn list_openclaw_task_executions(
    paths: &AppPaths,
    task_id: &str,
) -> Result<Vec<StudioWorkbenchTaskExecutionRecord>> {
    read_openclaw_cron_run_entries(paths, task_id)
}

pub(super) fn update_openclaw_task_status(
    paths: &AppPaths,
    runtime: &ActivatedOpenClawRuntime,
    task_id: &str,
    status: &str,
) -> Result<()> {
    let enabled = match status {
        "active" => true,
        "paused" => false,
        other => {
            return Err(FrameworkError::ValidationFailed(format!(
                "unsupported OpenClaw task status {other}"
            )))
        }
    };

    let _ = run_openclaw_gateway_call(
        runtime,
        paths,
        "cron.update",
        &json!({
            "id": task_id,
            "patch": {
                "enabled": enabled,
            },
        }),
    )?;
    Ok(())
}

pub(super) fn delete_openclaw_task(
    paths: &AppPaths,
    runtime: &ActivatedOpenClawRuntime,
    task_id: &str,
) -> Result<bool> {
    let response = run_openclaw_gateway_call(
        runtime,
        paths,
        "cron.remove",
        &json!({
            "id": task_id,
        }),
    )?;

    Ok(response
        .get("removed")
        .and_then(Value::as_bool)
        .unwrap_or(true))
}

fn read_openclaw_task_definition(paths: &AppPaths, task_id: &str) -> Result<Value> {
    let store_path = resolve_openclaw_jobs_store_path(paths);
    let root = read_json_document(&store_path)?;
    let jobs = root.get("jobs").and_then(Value::as_array).ok_or_else(|| {
        FrameworkError::ValidationFailed(format!(
            "invalid OpenClaw cron store at {}: missing jobs array",
            store_path.display()
        ))
    })?;

    jobs.iter()
        .find(|job| {
            job.get("id")
                .and_then(Value::as_str)
                .map(|value| value == task_id)
                .unwrap_or(false)
        })
        .cloned()
        .ok_or_else(|| FrameworkError::NotFound(format!("openclaw cron task \"{task_id}\"")))
}

fn resolve_openclaw_jobs_store_path(paths: &AppPaths) -> std::path::PathBuf {
    paths.openclaw_state_dir.join("cron").join("jobs.json")
}

fn read_json_document(path: &Path) -> Result<Value> {
    if !path.exists() {
        return Err(FrameworkError::NotFound(format!(
            "OpenClaw cron store {}",
            path.display()
        )));
    }

    let content = fs::read_to_string(path)?;
    serde_json::from_str::<Value>(&content).map_err(Into::into)
}

fn run_openclaw_gateway_call(
    runtime: &ActivatedOpenClawRuntime,
    paths: &AppPaths,
    method: &str,
    params: &Value,
) -> Result<Value> {
    let ws_url = format!("ws://127.0.0.1:{}", runtime.gateway_port);
    let params_json = serde_json::to_string(params)?;
    let mut command = Command::new(&runtime.node_path);
    command.arg(&runtime.cli_path);
    command.arg("gateway");
    command.arg("call");
    command.arg(method);
    command.arg("--params");
    command.arg(params_json);
    command.arg("--url");
    command.arg(ws_url);
    command.arg("--token");
    command.arg(runtime.gateway_auth_token.as_str());
    command.arg("--timeout");
    command.arg("30000");
    command.arg("--json");
    command.current_dir(&runtime.runtime_dir);
    command.env("PATH", prepend_path_env(&paths.user_bin_dir));
    command.envs(runtime.managed_env());

    let output = command.output()?;
    if !output.status.success() {
        return Err(FrameworkError::ProcessFailed {
            command: format!(
                "\"{}\" \"{}\" gateway call {}",
                runtime.node_path.display(),
                runtime.cli_path.display(),
                method
            ),
            exit_code: output.status.code(),
            stderr_tail: stderr_tail(&output.stderr),
        });
    }

    parse_gateway_call_output(method, &output.stdout)
}

fn parse_gateway_call_output(method: &str, stdout: &[u8]) -> Result<Value> {
    let text = String::from_utf8_lossy(stdout).trim().to_string();
    if text.is_empty() {
        return Ok(Value::Null);
    }

    serde_json::from_str::<Value>(&text).map_err(|error| {
        FrameworkError::ValidationFailed(format!(
            "invalid OpenClaw gateway call output for {method}: {error}"
        ))
    })
}

fn prepend_path_env(user_bin_dir: &Path) -> String {
    let current = env::var_os("PATH")
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_default();
    let separator = if cfg!(windows) { ';' } else { ':' };
    let user_bin = user_bin_dir.to_string_lossy();

    if current
        .split(separator)
        .any(|entry| entry.eq_ignore_ascii_case(user_bin.as_ref()))
    {
        return current;
    }

    if current.is_empty() {
        return user_bin.into_owned();
    }

    format!("{user_bin}{separator}{current}")
}

fn stderr_tail(stderr: &[u8]) -> String {
    let text = String::from_utf8_lossy(stderr).trim().to_string();
    if text.chars().count() <= 4000 {
        return text;
    }

    text.chars()
        .rev()
        .take(4000)
        .collect::<String>()
        .chars()
        .rev()
        .collect()
}

fn unix_timestamp_ms() -> Result<u64> {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| FrameworkError::Internal(error.to_string()))?;
    Ok(duration.as_millis() as u64)
}

fn format_timestamp_ms(timestamp_ms: u64) -> String {
    let seconds = i64::try_from(timestamp_ms / 1000).unwrap_or(0);
    OffsetDateTime::from_unix_timestamp(seconds)
        .ok()
        .and_then(|datetime| datetime.format(&Rfc3339).ok())
        .unwrap_or_else(|| timestamp_ms.to_string())
}

#[cfg(test)]
mod tests {
    use super::{
        clone_openclaw_task, delete_openclaw_task, require_running_openclaw_runtime,
        run_openclaw_task_now, update_openclaw_task_status,
    };
    use crate::framework::{
        paths::resolve_paths_for_root,
        services::{
            openclaw_runtime::ActivatedOpenClawRuntime,
            supervisor::{SupervisorService, SERVICE_ID_OPENCLAW_GATEWAY},
        },
    };
    use serde_json::Value;
    use std::fs;

    #[test]
    fn clone_reuses_gateway_call_with_the_exact_job_shape() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let runtime = create_runtime_fixture(&paths);

        fs::create_dir_all(paths.openclaw_state_dir.join("cron")).expect("cron dir");
        fs::write(
            paths.openclaw_state_dir.join("cron").join("jobs.json"),
            r#"{
  "version": 1,
  "jobs": [
    {
      "id": "job-1",
      "name": "Nightly Review",
      "description": "Summarize overnight updates.",
      "enabled": true,
      "deleteAfterRun": false,
      "agentId": "main",
      "sessionKey": "agent:main:cron:job-1",
      "schedule": {
        "kind": "cron",
        "expr": "0 7 * * *",
        "tz": "Asia/Shanghai",
        "staggerMs": 0
      },
      "sessionTarget": "isolated",
      "wakeMode": "now",
      "payload": {
        "kind": "agentTurn",
        "message": "Summarize overnight updates.",
        "model": "openai/gpt-5.4",
        "fallbacks": ["openai/gpt-5.3"],
        "thinking": "medium",
        "timeoutSeconds": 600,
        "lightContext": true
      },
      "delivery": {
        "mode": "announce",
        "channel": "telegram",
        "to": "123456",
        "accountId": "bot-default",
        "bestEffort": true
      },
      "failureAlert": false,
      "createdAtMs": 100,
      "updatedAtMs": 101,
      "state": {
        "nextRunAtMs": 200
      }
    }
  ]
}"#,
        )
        .expect("jobs store");

        clone_openclaw_task(&paths, &runtime, "job-1", Some("Nightly Review Copy"))
            .expect("clone task");

        let captured = read_capture(&paths).expect("capture entry");
        assert_eq!(captured.method, "cron.add");
        assert_eq!(
            captured.params.get("name").and_then(Value::as_str),
            Some("Nightly Review Copy")
        );
        assert!(captured.params.get("id").is_none());
        assert!(captured.params.get("state").is_none());
        assert_eq!(
            captured
                .params
                .pointer("/payload/fallbacks/0")
                .and_then(Value::as_str),
            Some("openai/gpt-5.3")
        );
        assert_eq!(
            captured
                .params
                .pointer("/delivery/accountId")
                .and_then(Value::as_str),
            Some("bot-default")
        );
        assert_eq!(
            captured.params.get("failureAlert").and_then(Value::as_bool),
            Some(false)
        );
    }

    #[test]
    fn update_run_and_delete_use_the_managed_gateway_call_surface() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let runtime = create_runtime_fixture(&paths);

        update_openclaw_task_status(&paths, &runtime, "job-2", "paused").expect("pause task");
        let queued = run_openclaw_task_now(&paths, &runtime, "job-2").expect("queue run");
        let deleted = delete_openclaw_task(&paths, &runtime, "job-2").expect("delete task");

        let captures = read_all_captures(&paths);
        assert_eq!(captures.len(), 3);
        assert_eq!(captures[0].method, "cron.update");
        assert_eq!(
            captures[0]
                .params
                .pointer("/patch/enabled")
                .and_then(Value::as_bool),
            Some(false)
        );
        assert_eq!(captures[1].method, "cron.run");
        assert_eq!(
            captures[1].params.get("mode").and_then(Value::as_str),
            Some("force")
        );
        assert_eq!(captures[2].method, "cron.remove");
        assert_eq!(queued.status, "running");
        assert_eq!(queued.trigger, "manual");
        assert_eq!(queued.details.as_deref(), Some("runId=run-123"));
        assert!(deleted);
    }

    #[test]
    fn runtime_resolution_requires_the_gateway_to_be_running() {
        let temp = tempfile::tempdir().expect("temp dir");
        let paths = resolve_paths_for_root(temp.path()).expect("paths");
        let supervisor = SupervisorService::new();
        let runtime = create_runtime_fixture(&paths);

        supervisor
            .configure_openclaw_gateway(&runtime)
            .expect("configure runtime");

        let error = require_running_openclaw_runtime(&supervisor)
            .expect_err("runtime should require a running gateway");
        assert!(error.to_string().contains("gateway is offline"));

        supervisor
            .record_running(SERVICE_ID_OPENCLAW_GATEWAY, Some(42))
            .expect("record running");
        let resolved = require_running_openclaw_runtime(&supervisor).expect("resolve runtime");
        assert_eq!(resolved.gateway_port, runtime.gateway_port);
    }

    #[derive(Debug)]
    struct CapturedGatewayCall {
        method: String,
        params: Value,
    }

    fn create_runtime_fixture(
        paths: &crate::framework::paths::AppPaths,
    ) -> ActivatedOpenClawRuntime {
        let install_dir = paths.openclaw_runtime_dir.join("test-runtime");
        let runtime_dir = install_dir.join("runtime");
        let cli_path = runtime_dir.join("package").join("openclaw.mjs");
        let node_path = resolve_test_node_executable();

        fs::create_dir_all(cli_path.parent().expect("cli parent")).expect("cli dir");
        fs::write(
            &cli_path,
            r#"import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const capturePath = path.join(process.env.OPENCLAW_STATE_DIR, 'capture.jsonl');
const method = args[2];
const paramsIndex = args.indexOf('--params');
const params = paramsIndex >= 0 ? JSON.parse(args[paramsIndex + 1]) : null;
fs.mkdirSync(path.dirname(capturePath), { recursive: true });
fs.appendFileSync(capturePath, JSON.stringify({ method, params }) + '\n');

if (method === 'cron.run') {
  process.stdout.write(JSON.stringify({ ok: true, enqueued: true, runId: 'run-123' }));
  process.exit(0);
}

if (method === 'cron.remove') {
  process.stdout.write(JSON.stringify({ removed: true }));
  process.exit(0);
}

process.stdout.write(JSON.stringify({ ok: true, method, params }));
"#,
        )
        .expect("cli script");

        ActivatedOpenClawRuntime {
            install_key: "test-runtime".to_string(),
            install_dir,
            runtime_dir,
            node_path,
            cli_path,
            home_dir: paths.openclaw_home_dir.clone(),
            state_dir: paths.openclaw_state_dir.clone(),
            workspace_dir: paths.openclaw_workspace_dir.clone(),
            config_path: paths.openclaw_config_file.clone(),
            gateway_port: 18_789,
            gateway_auth_token: "test-token".to_string(),
        }
    }

    #[cfg(windows)]
    fn resolve_test_node_executable() -> std::path::PathBuf {
        std::env::var_os("PATH")
            .into_iter()
            .flat_map(|value| std::env::split_paths(&value).collect::<Vec<_>>())
            .map(|entry| entry.join("node.exe"))
            .find(|candidate| candidate.exists())
            .expect("node.exe should be available on PATH for OpenClaw control tests")
    }

    #[cfg(not(windows))]
    fn resolve_test_node_executable() -> std::path::PathBuf {
        std::env::var_os("PATH")
            .into_iter()
            .flat_map(|value| std::env::split_paths(&value).collect::<Vec<_>>())
            .map(|entry| entry.join("node"))
            .find(|candidate| candidate.exists())
            .expect("node should be available on PATH for OpenClaw control tests")
    }

    fn read_capture(paths: &crate::framework::paths::AppPaths) -> Option<CapturedGatewayCall> {
        read_all_captures(paths).into_iter().last()
    }

    fn read_all_captures(paths: &crate::framework::paths::AppPaths) -> Vec<CapturedGatewayCall> {
        let capture_path = paths.openclaw_state_dir.join("capture.jsonl");
        fs::read_to_string(capture_path)
            .unwrap_or_default()
            .lines()
            .filter(|line| !line.trim().is_empty())
            .map(|line| serde_json::from_str::<Value>(line).expect("capture json"))
            .map(|value| CapturedGatewayCall {
                method: value
                    .get("method")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string(),
                params: value.get("params").cloned().unwrap_or(Value::Null),
            })
            .collect()
    }
}
