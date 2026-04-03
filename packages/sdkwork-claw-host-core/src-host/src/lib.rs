pub mod domain;
pub mod internal;
pub mod projection;
pub mod rollout;
pub mod storage;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HostCoreMetadata {
    pub package_name: &'static str,
}

pub fn host_core_metadata() -> HostCoreMetadata {
    HostCoreMetadata {
        package_name: "sdkwork-claw-host-core",
    }
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    use crate::internal::error::{
        InternalErrorCategory, InternalErrorEnvelope, InternalErrorResolution,
    };
    use crate::internal::node_sessions::{
        NodeSessionAckDesiredStateApplySummary, NodeSessionAckDesiredStateInput,
        NodeSessionAckDesiredStateResponse, NodeSessionAdmitInput,
        NodeSessionCloseInput, NodeSessionCloseResponse,
        NodeSessionCompatibilityPreview, NodeSessionCompatibilityState,
        NodeSessionDesiredStateAckResult, NodeSessionDesiredStateProjectionRecord,
        NodeSessionHeartbeatInput, NodeSessionHelloInput, NodeSessionHelloNodeClaim,
        NodeSessionHelloResponseAction, NodeSessionHelloVersionManifest,
        NodeSessionPullDesiredStateInput, NodeSessionPullDesiredStateResponse,
        NodeSessionRegistry, NodeSessionRegistryError, NodeSessionState,
    };
    use crate::projection::compiler::{DesiredStateInput, ProjectionCompiler};
    use crate::rollout::control_plane::{PreviewRolloutInput, RolloutControlPlane};
    use crate::rollout::engine::{
        preflight_target, PreflightOutcome, RolloutPolicy, RolloutPreflightTarget,
    };
    use crate::domain::rollout::RolloutPhase;

    #[test]
    fn internal_error_envelope_preserves_retry_guidance() {
        let envelope = InternalErrorEnvelope::new(
            "projection_version_unsupported",
            InternalErrorCategory::Compatibility,
            "Projection version is not supported by the current node runtime.",
            409,
            true,
            InternalErrorResolution::FetchLatestProjection,
        );

        assert_eq!(envelope.error.code, "projection_version_unsupported");
        assert_eq!(envelope.error.retryable, true);
        assert_eq!(
            envelope.error.resolution,
            InternalErrorResolution::FetchLatestProjection
        );
    }

    #[test]
    fn compiler_reuses_revision_for_identical_projection() {
        let compiler = ProjectionCompiler::new();
        let input = DesiredStateInput {
            node_id: "node-a".to_string(),
            config_projection_version: "v1".to_string(),
            semantic_payload: "listeners=1;routes=2".to_string(),
        };

        let first = compiler.compile(&input);
        let second = compiler.compile(&input);

        assert_eq!(first.desired_state_revision, 1);
        assert_eq!(second.desired_state_revision, 1);
        assert_eq!(first.desired_state_hash, second.desired_state_hash);
    }

    #[test]
    fn rollout_preflight_blocks_node_without_required_capability() {
        let target = RolloutPreflightTarget {
            node_id: "node-b".to_string(),
            capabilities: vec!["internal.node-sessions.hello".to_string()],
            trusted: true,
            compatible: true,
        };
        let policy = RolloutPolicy {
            required_capabilities: vec!["desired-state.pull".to_string()],
            allow_degraded_targets: false,
        };

        let outcome = preflight_target(&target, &policy);

        assert_eq!(outcome, PreflightOutcome::BlockedByCapability);
    }

    #[test]
    fn rollout_control_plane_lists_seeded_rollouts() {
        let rollout_store_path = create_test_rollout_store_path("list");
        let control_plane = RolloutControlPlane::open(rollout_store_path)
            .expect("control plane should open the test rollout store");

        let list = control_plane
            .list_rollouts()
            .expect("rollout list should load from the control plane");

        assert!(list.total >= 1);
        assert!(list.items.iter().any(|item| item.id == "rollout-a"));
    }

    #[test]
    fn rollout_control_plane_preview_persists_candidate_revisions() {
        let rollout_store_path = create_test_rollout_store_path("preview");
        let control_plane = RolloutControlPlane::open(rollout_store_path.clone())
            .expect("control plane should open the test rollout store");

        let preview = control_plane
            .preview_rollout(PreviewRolloutInput {
                rollout_id: "rollout-a".to_string(),
                force_recompute: false,
                include_targets: true,
            })
            .expect("preview should succeed for the seeded rollout");

        assert!(preview.candidate_revision_summary.is_some());
        assert_eq!(preview.rollout_id, "rollout-a");
        drop(control_plane);

        let reopened = RolloutControlPlane::open(rollout_store_path)
            .expect("control plane should reopen the persisted rollout store");
        let list = reopened
            .list_rollouts()
            .expect("reopened rollout list should succeed");
        let rollout = list
            .items
            .iter()
            .find(|item| item.id == "rollout-a")
            .expect("seeded rollout should still exist after preview persistence");

        assert_eq!(rollout.phase, RolloutPhase::Ready);
        assert_eq!(rollout.attempt, preview.attempt);
    }

    #[test]
    fn rollout_control_plane_start_requires_preview_and_persists_promoting_state() {
        let rollout_store_path = create_test_rollout_store_path("start");
        let control_plane = RolloutControlPlane::open(rollout_store_path.clone())
            .expect("control plane should open the test rollout store");

        let start_error = control_plane
            .start_rollout("rollout-a")
            .expect_err("start should fail before preview has run");

        assert!(matches!(
            start_error,
            crate::rollout::control_plane::RolloutControlPlaneError::PreviewRequired { .. }
        ));

        control_plane
            .preview_rollout(PreviewRolloutInput {
                rollout_id: "rollout-a".to_string(),
                force_recompute: false,
                include_targets: true,
            })
            .expect("preview should succeed for the seeded rollout");

        let started = control_plane
            .start_rollout("rollout-a")
            .expect("start should succeed after preview");

        assert_eq!(started.phase, RolloutPhase::Promoting);
        drop(control_plane);

        let reopened = RolloutControlPlane::open(rollout_store_path)
            .expect("control plane should reopen the persisted rollout store");
        let list = reopened
            .list_rollouts()
            .expect("reopened rollout list should succeed");
        let rollout = list
            .items
            .iter()
            .find(|item| item.id == "rollout-a")
            .expect("seeded rollout should still exist after start persistence");

        assert_eq!(rollout.phase, RolloutPhase::Promoting);
    }

    #[test]
    fn rollout_control_plane_lists_rollout_waves() {
        let rollout_store_path = create_test_rollout_store_path("waves");
        let control_plane = RolloutControlPlane::open(rollout_store_path)
            .expect("control plane should open the test rollout store");

        let waves = control_plane
            .list_rollout_waves("rollout-b")
            .expect("rollout waves should load from the control plane");

        assert_eq!(waves.rollout_id, "rollout-b");
        assert_eq!(waves.attempt, 1);
        assert_eq!(waves.total, 2);
        assert_eq!(waves.items.len(), 2);
        assert_eq!(waves.items[0].wave_id, "wave-1");
        assert_eq!(waves.items[0].index, 1);
        assert_eq!(waves.items[0].phase.as_str(), "failed");
        assert_eq!(waves.items[0].target_count, 1);
        assert_eq!(waves.items[0].blocked_count, 1);
        assert_eq!(waves.items[1].wave_id, "wave-2");
        assert_eq!(waves.items[1].index, 2);
        assert_eq!(waves.items[1].phase.as_str(), "failed");
        assert_eq!(waves.items[1].target_count, 1);
        assert_eq!(waves.items[1].blocked_count, 1);
    }

    #[test]
    fn rollout_control_plane_projects_admissible_node_sessions() {
        let rollout_store_path = create_test_rollout_store_path("node-sessions-admissible");
        let control_plane = RolloutControlPlane::open(rollout_store_path)
            .expect("control plane should open the test rollout store");

        let sessions = control_plane
            .list_projected_node_sessions("rollout-a", true, "server-combined", 1234)
            .expect("projected node sessions should succeed");

        assert_eq!(sessions.len(), 2);
        assert!(sessions.iter().all(|session| session.state == NodeSessionState::Admitted));
        assert!(sessions.iter().all(|session| {
            session.compatibility_state == NodeSessionCompatibilityState::Compatible
        }));
        assert!(sessions
            .iter()
            .all(|session| session.last_seen_at == 1234));
        assert!(sessions
            .iter()
            .any(|session| session.node_id == "local-built-in"));
        assert!(sessions
            .iter()
            .any(|session| session.node_id == "managed-remote"));
    }

    #[test]
    fn rollout_control_plane_projects_blocked_node_sessions_when_host_is_degraded() {
        let rollout_store_path = create_test_rollout_store_path("node-sessions-blocked");
        let control_plane = RolloutControlPlane::open(rollout_store_path)
            .expect("control plane should open the test rollout store");

        let sessions = control_plane
            .list_projected_node_sessions("rollout-b", false, "server-combined", 5678)
            .expect("projected node sessions should succeed");

        assert_eq!(sessions.len(), 2);
        assert!(sessions.iter().all(|session| session.state == NodeSessionState::Degraded));
        assert!(sessions.iter().all(|session| {
            session.compatibility_state == NodeSessionCompatibilityState::Blocked
        }));
        assert!(sessions
            .iter()
            .all(|session| session.last_seen_at == 5678));
        assert!(sessions
            .iter()
            .all(|session| session.desired_state_revision.is_none()));
        assert!(sessions
            .iter()
            .all(|session| session.desired_state_hash.is_none()));
    }

    #[test]
    fn node_session_registry_hello_creates_pending_live_session() {
        let node_session_store_path = create_test_rollout_store_path("node-session-registry");
        let registry = NodeSessionRegistry::open(node_session_store_path)
            .expect("node session registry should open the test store");

        let response = registry
            .hello(
                NodeSessionHelloInput {
                    boot_id: "boot-local-1".to_string(),
                    node_claim: NodeSessionHelloNodeClaim {
                        claimed_node_id: Some("local-built-in".to_string()),
                        host_platform: Some("linux".to_string()),
                        host_arch: Some("x64".to_string()),
                    },
                    version_manifest: NodeSessionHelloVersionManifest {
                        internal_api_version: "v1".to_string(),
                        config_projection_version: Some("v1".to_string()),
                    },
                    capabilities: vec![
                        "desired-state.pull".to_string(),
                        "runtime.apply".to_string(),
                    ],
                },
                NodeSessionCompatibilityPreview {
                    compatibility_state: NodeSessionCompatibilityState::Compatible,
                    desired_state_revision: Some(1),
                    desired_state_hash: Some("hash-a".to_string()),
                    reason: None,
                },
                1234,
            )
            .expect("hello should create a live session");
        let sessions = registry
            .list_sessions()
            .expect("live node sessions should be readable");

        assert_eq!(response.next_action, NodeSessionHelloResponseAction::CallAdmit);
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].node_id, "local-built-in");
        assert_eq!(sessions[0].state, NodeSessionState::Pending);
        assert_eq!(
            sessions[0].compatibility_state,
            NodeSessionCompatibilityState::Compatible
        );
        assert_eq!(sessions[0].last_seen_at, 1234);
    }

    #[test]
    fn node_session_registry_admit_transitions_pending_session_to_admitted() {
        let node_session_store_path = create_test_rollout_store_path("node-session-admit");
        let registry = NodeSessionRegistry::open(node_session_store_path)
            .expect("node session registry should open the test store");
        let hello = registry
            .hello(
                NodeSessionHelloInput {
                    boot_id: "boot-local-1".to_string(),
                    node_claim: NodeSessionHelloNodeClaim {
                        claimed_node_id: Some("local-built-in".to_string()),
                        host_platform: Some("linux".to_string()),
                        host_arch: Some("x64".to_string()),
                    },
                    version_manifest: NodeSessionHelloVersionManifest {
                        internal_api_version: "v1".to_string(),
                        config_projection_version: Some("v1".to_string()),
                    },
                    capabilities: vec![
                        "desired-state.pull".to_string(),
                        "runtime.apply".to_string(),
                    ],
                },
                NodeSessionCompatibilityPreview {
                    compatibility_state: NodeSessionCompatibilityState::Compatible,
                    desired_state_revision: Some(1),
                    desired_state_hash: Some("hash-a".to_string()),
                    reason: None,
                },
                1234,
            )
            .expect("hello should create a live session");

        let admit = registry
            .admit(
                &hello.session_id,
                NodeSessionAdmitInput {
                    hello_token: hello.hello_token.clone(),
                },
                2345,
            )
            .expect("admit should transition the session");
        let sessions = registry
            .list_sessions()
            .expect("live node sessions should be readable");

        assert_eq!(admit.session_id, hello.session_id);
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].state, NodeSessionState::Admitted);
        assert_eq!(sessions[0].last_seen_at, 2345);
    }

    #[test]
    fn node_session_registry_heartbeat_refreshes_admitted_session_lease() {
        let node_session_store_path = create_test_rollout_store_path("node-session-heartbeat");
        let registry = NodeSessionRegistry::open(node_session_store_path)
            .expect("node session registry should open the test store");
        let hello = registry
            .hello(
                NodeSessionHelloInput {
                    boot_id: "boot-local-1".to_string(),
                    node_claim: NodeSessionHelloNodeClaim {
                        claimed_node_id: Some("local-built-in".to_string()),
                        host_platform: Some("linux".to_string()),
                        host_arch: Some("x64".to_string()),
                    },
                    version_manifest: NodeSessionHelloVersionManifest {
                        internal_api_version: "v1".to_string(),
                        config_projection_version: Some("v1".to_string()),
                    },
                    capabilities: vec![
                        "desired-state.pull".to_string(),
                        "runtime.apply".to_string(),
                    ],
                },
                NodeSessionCompatibilityPreview {
                    compatibility_state: NodeSessionCompatibilityState::Compatible,
                    desired_state_revision: Some(1),
                    desired_state_hash: Some("hash-a".to_string()),
                    reason: None,
                },
                1234,
            )
            .expect("hello should create a live session");
        let admit = registry
            .admit(
                &hello.session_id,
                NodeSessionAdmitInput {
                    hello_token: hello.hello_token.clone(),
                },
                2345,
            )
            .expect("admit should transition the session");

        let heartbeat = registry
            .heartbeat(
                &hello.session_id,
                NodeSessionHeartbeatInput {
                    lease_id: admit.lease.lease_id.clone(),
                    last_seen_revision: None,
                },
                3456,
            )
            .expect("heartbeat should refresh the session");
        let sessions = registry
            .list_sessions()
            .expect("live node sessions should be readable");

        assert_eq!(heartbeat.lease.issued_at, 3456);
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].state, NodeSessionState::Admitted);
        assert_eq!(sessions[0].last_seen_at, 3456);
    }

    #[test]
    fn node_session_registry_pull_desired_state_returns_projection_then_not_modified() {
        let rollout_store_path = create_test_rollout_store_path("node-session-pull-rollout");
        let node_session_store_path = create_test_rollout_store_path("node-session-pull-runtime");
        let control_plane = RolloutControlPlane::open(rollout_store_path)
            .expect("control plane should open the test rollout store");
        let registry = NodeSessionRegistry::open(node_session_store_path)
            .expect("node session registry should open the test store");
        let hello = registry
            .hello(
                NodeSessionHelloInput {
                    boot_id: "boot-local-1".to_string(),
                    node_claim: NodeSessionHelloNodeClaim {
                        claimed_node_id: Some("local-built-in".to_string()),
                        host_platform: Some("linux".to_string()),
                        host_arch: Some("x64".to_string()),
                    },
                    version_manifest: NodeSessionHelloVersionManifest {
                        internal_api_version: "v1".to_string(),
                        config_projection_version: Some("v1".to_string()),
                    },
                    capabilities: vec![
                        "desired-state.pull".to_string(),
                        "runtime.apply".to_string(),
                    ],
                },
                NodeSessionCompatibilityPreview {
                    compatibility_state: NodeSessionCompatibilityState::Compatible,
                    desired_state_revision: Some(1),
                    desired_state_hash: Some("hash-a".to_string()),
                    reason: None,
                },
                1234,
            )
            .expect("hello should create a live session");
        let admit = registry
            .admit(
                &hello.session_id,
                NodeSessionAdmitInput {
                    hello_token: hello.hello_token.clone(),
                },
                2345,
            )
            .expect("admit should transition the session");
        let desired_state = control_plane
            .resolve_node_desired_state("rollout-a", "local-built-in")
            .expect("desired state lookup should succeed")
            .expect("seeded rollout should target local-built-in");

        let first_pull = registry
            .pull_desired_state(
                &hello.session_id,
                NodeSessionPullDesiredStateInput {
                    lease_id: admit.lease.lease_id.clone(),
                    known_revision: None,
                    known_hash: None,
                    supported_config_projection_versions: vec!["v1".to_string()],
                    effective_capabilities: vec![
                        "desired-state.pull".to_string(),
                        "runtime.apply".to_string(),
                    ],
                },
                desired_state.clone(),
                3456,
            )
            .expect("first pull should return the current projection");

        let NodeSessionPullDesiredStateResponse::Projection {
            desired_state_revision,
            desired_state_hash,
            projection,
            apply_policy,
            ..
        } = first_pull
        else {
            panic!("first pull should return projection mode");
        };

        assert_eq!(projection.node_id, "local-built-in");
        assert_eq!(projection.desired_state_revision, desired_state_revision);
        assert_eq!(projection.desired_state_hash, desired_state_hash);
        assert_eq!(apply_policy.mandatory, true);

        let second_pull = registry
            .pull_desired_state(
                &hello.session_id,
                NodeSessionPullDesiredStateInput {
                    lease_id: admit.lease.lease_id,
                    known_revision: Some(desired_state_revision),
                    known_hash: Some(desired_state_hash),
                    supported_config_projection_versions: vec!["v1".to_string()],
                    effective_capabilities: vec![
                        "desired-state.pull".to_string(),
                        "runtime.apply".to_string(),
                    ],
                },
                desired_state,
                4567,
            )
            .expect("second pull should detect no desired state change");

        assert!(matches!(
            second_pull,
            NodeSessionPullDesiredStateResponse::NotModified { .. }
        ));
    }

    #[test]
    fn node_session_registry_ack_desired_state_records_apply_markers() {
        let rollout_store_path = create_test_rollout_store_path("node-session-ack-rollout");
        let node_session_store_path = create_test_rollout_store_path("node-session-ack-runtime");
        let control_plane = RolloutControlPlane::open(rollout_store_path)
            .expect("control plane should open the test rollout store");
        let registry = NodeSessionRegistry::open(node_session_store_path)
            .expect("node session registry should open the test store");
        let hello = registry
            .hello(
                NodeSessionHelloInput {
                    boot_id: "boot-local-1".to_string(),
                    node_claim: NodeSessionHelloNodeClaim {
                        claimed_node_id: Some("local-built-in".to_string()),
                        host_platform: Some("linux".to_string()),
                        host_arch: Some("x64".to_string()),
                    },
                    version_manifest: NodeSessionHelloVersionManifest {
                        internal_api_version: "v1".to_string(),
                        config_projection_version: Some("v1".to_string()),
                    },
                    capabilities: vec![
                        "desired-state.pull".to_string(),
                        "runtime.apply".to_string(),
                    ],
                },
                NodeSessionCompatibilityPreview {
                    compatibility_state: NodeSessionCompatibilityState::Compatible,
                    desired_state_revision: Some(1),
                    desired_state_hash: Some("hash-a".to_string()),
                    reason: None,
                },
                1234,
            )
            .expect("hello should create a live session");
        let admit = registry
            .admit(
                &hello.session_id,
                NodeSessionAdmitInput {
                    hello_token: hello.hello_token.clone(),
                },
                2345,
            )
            .expect("admit should transition the session");
        let desired_state = control_plane
            .resolve_node_desired_state("rollout-a", "local-built-in")
            .expect("desired state lookup should succeed")
            .expect("seeded rollout should target local-built-in");
        let pulled = registry
            .pull_desired_state(
                &hello.session_id,
                NodeSessionPullDesiredStateInput {
                    lease_id: admit.lease.lease_id.clone(),
                    known_revision: None,
                    known_hash: None,
                    supported_config_projection_versions: vec!["v1".to_string()],
                    effective_capabilities: vec![
                        "desired-state.pull".to_string(),
                        "runtime.apply".to_string(),
                    ],
                },
                desired_state,
                3456,
            )
            .expect("pull should return the current projection");

        let NodeSessionPullDesiredStateResponse::Projection {
            desired_state_revision,
            desired_state_hash,
            ..
        } = pulled
        else {
            panic!("pull should return projection mode before ack");
        };

        let ack = registry
            .ack_desired_state(
                &hello.session_id,
                NodeSessionAckDesiredStateInput {
                    lease_id: admit.lease.lease_id,
                    desired_state_revision,
                    desired_state_hash: desired_state_hash.clone(),
                    result: NodeSessionDesiredStateAckResult::Applied,
                    effective_capabilities: vec![
                        "desired-state.pull".to_string(),
                        "runtime.apply".to_string(),
                    ],
                    observed_endpoints: vec!["http://127.0.0.1:18797".to_string()],
                    apply_summary: NodeSessionAckDesiredStateApplySummary {
                        applied_at: Some(4567),
                        last_known_good_revision: None,
                        compatibility_reasons: Vec::new(),
                        errors: Vec::new(),
                        warnings: Vec::new(),
                    },
                },
                4567,
            )
            .expect("ack should record the applied desired state");
        let sessions = registry
            .list_sessions()
            .expect("live node sessions should be readable");

        let NodeSessionAckDesiredStateResponse {
            recorded,
            next_expected_revision,
            management_posture,
        } = ack;

        assert_eq!(recorded, true);
        assert_eq!(next_expected_revision, Some(desired_state_revision));
        assert_eq!(
            management_posture.compatibility_state,
            NodeSessionCompatibilityState::Compatible
        );
        assert!(management_posture
            .allowed_operations
            .iter()
            .any(|operation| operation == "ackDesiredState"));
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].last_applied_revision, Some(desired_state_revision));
        assert_eq!(sessions[0].last_applied_hash.as_deref(), Some(desired_state_hash.as_str()));
        assert_eq!(sessions[0].last_known_good_revision, Some(desired_state_revision));
        assert_eq!(
            sessions[0].last_known_good_hash.as_deref(),
            Some(desired_state_hash.as_str())
        );
        assert_eq!(
            sessions[0].last_apply_result,
            Some(NodeSessionDesiredStateAckResult::Applied)
        );
    }

    #[test]
    fn node_session_registry_ack_desired_state_rejects_conflicting_revision() {
        let rollout_store_path = create_test_rollout_store_path("node-session-ack-conflict-rollout");
        let node_session_store_path = create_test_rollout_store_path("node-session-ack-conflict-runtime");
        let control_plane = RolloutControlPlane::open(rollout_store_path)
            .expect("control plane should open the test rollout store");
        let registry = NodeSessionRegistry::open(node_session_store_path)
            .expect("node session registry should open the test store");
        let hello = registry
            .hello(
                NodeSessionHelloInput {
                    boot_id: "boot-local-1".to_string(),
                    node_claim: NodeSessionHelloNodeClaim {
                        claimed_node_id: Some("local-built-in".to_string()),
                        host_platform: Some("linux".to_string()),
                        host_arch: Some("x64".to_string()),
                    },
                    version_manifest: NodeSessionHelloVersionManifest {
                        internal_api_version: "v1".to_string(),
                        config_projection_version: Some("v1".to_string()),
                    },
                    capabilities: vec![
                        "desired-state.pull".to_string(),
                        "runtime.apply".to_string(),
                    ],
                },
                NodeSessionCompatibilityPreview {
                    compatibility_state: NodeSessionCompatibilityState::Compatible,
                    desired_state_revision: Some(1),
                    desired_state_hash: Some("hash-a".to_string()),
                    reason: None,
                },
                1234,
            )
            .expect("hello should create a live session");
        let admit = registry
            .admit(
                &hello.session_id,
                NodeSessionAdmitInput {
                    hello_token: hello.hello_token.clone(),
                },
                2345,
            )
            .expect("admit should transition the session");
        let desired_state = control_plane
            .resolve_node_desired_state("rollout-a", "local-built-in")
            .expect("desired state lookup should succeed")
            .expect("seeded rollout should target local-built-in");
        registry
            .pull_desired_state(
                &hello.session_id,
                NodeSessionPullDesiredStateInput {
                    lease_id: admit.lease.lease_id.clone(),
                    known_revision: None,
                    known_hash: None,
                    supported_config_projection_versions: vec!["v1".to_string()],
                    effective_capabilities: vec![
                        "desired-state.pull".to_string(),
                        "runtime.apply".to_string(),
                    ],
                },
                desired_state,
                3456,
            )
            .expect("pull should return the current projection");

        let error = registry
            .ack_desired_state(
                &hello.session_id,
                NodeSessionAckDesiredStateInput {
                    lease_id: admit.lease.lease_id,
                    desired_state_revision: 999,
                    desired_state_hash: "wrong-hash".to_string(),
                    result: NodeSessionDesiredStateAckResult::Rejected,
                    effective_capabilities: vec![
                        "desired-state.pull".to_string(),
                        "runtime.apply".to_string(),
                    ],
                    observed_endpoints: Vec::new(),
                    apply_summary: NodeSessionAckDesiredStateApplySummary {
                        applied_at: None,
                        last_known_good_revision: None,
                        compatibility_reasons: vec!["stale".to_string()],
                        errors: vec!["revision mismatch".to_string()],
                        warnings: Vec::new(),
                    },
                },
                4567,
            )
            .expect_err("ack should reject a conflicting revision or hash");

        assert!(matches!(
            error,
            NodeSessionRegistryError::DesiredStateConflict { .. }
        ));
    }

    #[test]
    fn node_session_registry_ack_desired_state_rejects_stale_revision() {
        let node_session_store_path = create_test_rollout_store_path("node-session-ack-stale");
        let registry = NodeSessionRegistry::open(node_session_store_path)
            .expect("node session registry should open the test store");
        let hello = registry
            .hello(
                NodeSessionHelloInput {
                    boot_id: "boot-local-1".to_string(),
                    node_claim: NodeSessionHelloNodeClaim {
                        claimed_node_id: Some("local-built-in".to_string()),
                        host_platform: Some("linux".to_string()),
                        host_arch: Some("x64".to_string()),
                    },
                    version_manifest: NodeSessionHelloVersionManifest {
                        internal_api_version: "v1".to_string(),
                        config_projection_version: Some("v1".to_string()),
                    },
                    capabilities: vec![
                        "desired-state.pull".to_string(),
                        "runtime.apply".to_string(),
                    ],
                },
                NodeSessionCompatibilityPreview {
                    compatibility_state: NodeSessionCompatibilityState::Compatible,
                    desired_state_revision: Some(1),
                    desired_state_hash: Some("hash-a".to_string()),
                    reason: None,
                },
                1_234,
            )
            .expect("hello should create a live session");
        let admit = registry
            .admit(
                &hello.session_id,
                NodeSessionAdmitInput {
                    hello_token: hello.hello_token.clone(),
                },
                2_345,
            )
            .expect("admit should transition the session");
        let compiler = ProjectionCompiler::new();
        let desired_state_v1 = NodeSessionDesiredStateProjectionRecord {
            required_capabilities: vec![
                "desired-state.pull".to_string(),
                "runtime.apply".to_string(),
            ],
            projection: compiler.compile(&DesiredStateInput {
                node_id: "local-built-in".to_string(),
                config_projection_version: "v1".to_string(),
                semantic_payload: "service=openclaw;mode=combined".to_string(),
            }),
        };
        let first_pull = registry
            .pull_desired_state(
                &hello.session_id,
                NodeSessionPullDesiredStateInput {
                    lease_id: admit.lease.lease_id.clone(),
                    known_revision: None,
                    known_hash: None,
                    supported_config_projection_versions: vec!["v1".to_string()],
                    effective_capabilities: vec![
                        "desired-state.pull".to_string(),
                        "runtime.apply".to_string(),
                    ],
                },
                desired_state_v1,
                3_456,
            )
            .expect("initial pull should return the first desired state");
        let NodeSessionPullDesiredStateResponse::Projection {
            desired_state_revision,
            desired_state_hash,
            ..
        } = first_pull
        else {
            panic!("initial pull should return projection mode");
        };
        let desired_state_v2 = NodeSessionDesiredStateProjectionRecord {
            required_capabilities: vec![
                "desired-state.pull".to_string(),
                "runtime.apply".to_string(),
            ],
            projection: compiler.compile(&DesiredStateInput {
                node_id: "local-built-in".to_string(),
                config_projection_version: "v1".to_string(),
                semantic_payload: "service=openclaw;mode=combined;generation=2".to_string(),
            }),
        };
        let refreshed_pull = registry
            .pull_desired_state(
                &hello.session_id,
                NodeSessionPullDesiredStateInput {
                    lease_id: admit.lease.lease_id.clone(),
                    known_revision: Some(desired_state_revision),
                    known_hash: Some(desired_state_hash.clone()),
                    supported_config_projection_versions: vec!["v1".to_string()],
                    effective_capabilities: vec![
                        "desired-state.pull".to_string(),
                        "runtime.apply".to_string(),
                    ],
                },
                desired_state_v2,
                4_000,
            )
            .expect("refreshed pull should advance the desired state");
        let NodeSessionPullDesiredStateResponse::Projection {
            desired_state_revision: next_desired_state_revision,
            desired_state_hash: next_desired_state_hash,
            ..
        } = refreshed_pull
        else {
            panic!("refreshed pull should return projection mode");
        };

        let error = registry
            .ack_desired_state(
                &hello.session_id,
                NodeSessionAckDesiredStateInput {
                    lease_id: admit.lease.lease_id,
                    desired_state_revision,
                    desired_state_hash: desired_state_hash.clone(),
                    result: NodeSessionDesiredStateAckResult::Applied,
                    effective_capabilities: vec![
                        "desired-state.pull".to_string(),
                        "runtime.apply".to_string(),
                    ],
                    observed_endpoints: vec!["http://127.0.0.1:18797".to_string()],
                    apply_summary: NodeSessionAckDesiredStateApplySummary {
                        applied_at: Some(4_567),
                        last_known_good_revision: None,
                        compatibility_reasons: Vec::new(),
                        errors: Vec::new(),
                        warnings: Vec::new(),
                    },
                },
                4_567,
            )
            .expect_err("stale ack should be rejected after the target has advanced");
        let sessions = registry
            .list_sessions()
            .expect("live node sessions should be readable");

        assert!(next_desired_state_revision > desired_state_revision);
        assert_eq!(
            error.to_string(),
            format!(
                "node session desired state acknowledgement was stale: {}",
                hello.session_id
            )
        );
        assert_eq!(sessions.len(), 1);
        assert_eq!(
            sessions[0].desired_state_revision,
            Some(next_desired_state_revision)
        );
        assert_eq!(
            sessions[0].desired_state_hash.as_deref(),
            Some(next_desired_state_hash.as_str())
        );
        assert_eq!(sessions[0].last_applied_revision, None);
        assert_eq!(sessions[0].last_applied_hash, None);
        assert_eq!(sessions[0].last_known_good_revision, None);
        assert_eq!(sessions[0].last_known_good_hash, None);
        assert_eq!(sessions[0].last_apply_result, None);
    }

    #[test]
    fn node_session_registry_rejects_expired_lease_for_runtime_actions() {
        let rollout_store_path = create_test_rollout_store_path("node-session-expired-lease-rollout");
        let node_session_store_path = create_test_rollout_store_path("node-session-expired-lease-runtime");
        let control_plane = RolloutControlPlane::open(rollout_store_path)
            .expect("control plane should open the test rollout store");
        let registry = NodeSessionRegistry::open(node_session_store_path)
            .expect("node session registry should open the test store");
        let hello = registry
            .hello(
                NodeSessionHelloInput {
                    boot_id: "boot-local-1".to_string(),
                    node_claim: NodeSessionHelloNodeClaim {
                        claimed_node_id: Some("local-built-in".to_string()),
                        host_platform: Some("linux".to_string()),
                        host_arch: Some("x64".to_string()),
                    },
                    version_manifest: NodeSessionHelloVersionManifest {
                        internal_api_version: "v1".to_string(),
                        config_projection_version: Some("v1".to_string()),
                    },
                    capabilities: vec![
                        "desired-state.pull".to_string(),
                        "runtime.apply".to_string(),
                    ],
                },
                NodeSessionCompatibilityPreview {
                    compatibility_state: NodeSessionCompatibilityState::Compatible,
                    desired_state_revision: Some(1),
                    desired_state_hash: Some("hash-a".to_string()),
                    reason: None,
                },
                1_000,
            )
            .expect("hello should create a live session");
        let admit = registry
            .admit(
                &hello.session_id,
                NodeSessionAdmitInput {
                    hello_token: hello.hello_token.clone(),
                },
                2_000,
            )
            .expect("admit should transition the session");
        let desired_state = control_plane
            .resolve_node_desired_state("rollout-a", "local-built-in")
            .expect("desired state lookup should succeed")
            .expect("seeded rollout should target local-built-in");
        let expired_at = 40_000;

        let heartbeat_error = registry
            .heartbeat(
                &hello.session_id,
                NodeSessionHeartbeatInput {
                    lease_id: admit.lease.lease_id.clone(),
                    last_seen_revision: None,
                },
                expired_at,
            )
            .expect_err("heartbeat should reject an expired lease");
        let pull_error = registry
            .pull_desired_state(
                &hello.session_id,
                NodeSessionPullDesiredStateInput {
                    lease_id: admit.lease.lease_id.clone(),
                    known_revision: None,
                    known_hash: None,
                    supported_config_projection_versions: vec!["v1".to_string()],
                    effective_capabilities: vec![
                        "desired-state.pull".to_string(),
                        "runtime.apply".to_string(),
                    ],
                },
                desired_state,
                expired_at,
            )
            .expect_err("pull should reject an expired lease");
        let ack_error = registry
            .ack_desired_state(
                &hello.session_id,
                NodeSessionAckDesiredStateInput {
                    lease_id: admit.lease.lease_id,
                    desired_state_revision: 1,
                    desired_state_hash: "hash-a".to_string(),
                    result: NodeSessionDesiredStateAckResult::Rejected,
                    effective_capabilities: vec![
                        "desired-state.pull".to_string(),
                        "runtime.apply".to_string(),
                    ],
                    observed_endpoints: Vec::new(),
                    apply_summary: NodeSessionAckDesiredStateApplySummary {
                        applied_at: None,
                        last_known_good_revision: None,
                        compatibility_reasons: Vec::new(),
                        errors: Vec::new(),
                        warnings: Vec::new(),
                    },
                },
                expired_at,
            )
            .expect_err("ack should reject an expired lease");

        assert!(matches!(
            heartbeat_error,
            NodeSessionRegistryError::LeaseExpired { .. }
        ));
        assert!(matches!(
            pull_error,
            NodeSessionRegistryError::LeaseExpired { .. }
        ));
        assert!(matches!(
            ack_error,
            NodeSessionRegistryError::LeaseExpired { .. }
        ));
    }

    #[test]
    fn node_session_registry_close_transitions_session_to_closed() {
        let node_session_store_path = create_test_rollout_store_path("node-session-close");
        let registry = NodeSessionRegistry::open(node_session_store_path)
            .expect("node session registry should open the test store");
        let hello = registry
            .hello(
                NodeSessionHelloInput {
                    boot_id: "boot-local-1".to_string(),
                    node_claim: NodeSessionHelloNodeClaim {
                        claimed_node_id: Some("local-built-in".to_string()),
                        host_platform: Some("linux".to_string()),
                        host_arch: Some("x64".to_string()),
                    },
                    version_manifest: NodeSessionHelloVersionManifest {
                        internal_api_version: "v1".to_string(),
                        config_projection_version: Some("v1".to_string()),
                    },
                    capabilities: vec![
                        "desired-state.pull".to_string(),
                        "runtime.apply".to_string(),
                    ],
                },
                NodeSessionCompatibilityPreview {
                    compatibility_state: NodeSessionCompatibilityState::Compatible,
                    desired_state_revision: Some(1),
                    desired_state_hash: Some("hash-a".to_string()),
                    reason: None,
                },
                1234,
            )
            .expect("hello should create a live session");
        let admit = registry
            .admit(
                &hello.session_id,
                NodeSessionAdmitInput {
                    hello_token: hello.hello_token.clone(),
                },
                2345,
            )
            .expect("admit should transition the session");

        let close = registry
            .close(
                &hello.session_id,
                NodeSessionCloseInput {
                    lease_id: admit.lease.lease_id.clone(),
                    reason: "shutdown".to_string(),
                    successor_hint: None,
                },
                3456,
            )
            .expect("close should transition the session to closed");
        let sessions = registry
            .list_sessions()
            .expect("live node sessions should be readable");

        let NodeSessionCloseResponse {
            closed,
            replacement_expected,
        } = close;

        assert_eq!(closed, true);
        assert_eq!(replacement_expected, false);
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].state, NodeSessionState::Closed);
        assert_eq!(sessions[0].last_seen_at, 3456);
    }

    #[test]
    fn node_session_registry_close_records_successor_hint() {
        let node_session_store_path = create_test_rollout_store_path("node-session-close-successor");
        let registry = NodeSessionRegistry::open(node_session_store_path)
            .expect("node session registry should open the test store");
        let compatibility_preview = NodeSessionCompatibilityPreview {
            compatibility_state: NodeSessionCompatibilityState::Compatible,
            desired_state_revision: Some(1),
            desired_state_hash: Some("hash-a".to_string()),
            reason: None,
        };
        let first_hello = registry
            .hello(
                NodeSessionHelloInput {
                    boot_id: "boot-local-1".to_string(),
                    node_claim: NodeSessionHelloNodeClaim {
                        claimed_node_id: Some("local-built-in".to_string()),
                        host_platform: Some("linux".to_string()),
                        host_arch: Some("x64".to_string()),
                    },
                    version_manifest: NodeSessionHelloVersionManifest {
                        internal_api_version: "v1".to_string(),
                        config_projection_version: Some("v1".to_string()),
                    },
                    capabilities: vec![
                        "desired-state.pull".to_string(),
                        "runtime.apply".to_string(),
                    ],
                },
                compatibility_preview.clone(),
                1_000,
            )
            .expect("first hello should create a live session");
        let first_admit = registry
            .admit(
                &first_hello.session_id,
                NodeSessionAdmitInput {
                    hello_token: first_hello.hello_token.clone(),
                },
                2_000,
            )
            .expect("first admit should transition the session");
        let second_hello = registry
            .hello(
                NodeSessionHelloInput {
                    boot_id: "boot-local-2".to_string(),
                    node_claim: NodeSessionHelloNodeClaim {
                        claimed_node_id: Some("local-built-in".to_string()),
                        host_platform: Some("linux".to_string()),
                        host_arch: Some("x64".to_string()),
                    },
                    version_manifest: NodeSessionHelloVersionManifest {
                        internal_api_version: "v1".to_string(),
                        config_projection_version: Some("v1".to_string()),
                    },
                    capabilities: vec![
                        "desired-state.pull".to_string(),
                        "runtime.apply".to_string(),
                    ],
                },
                compatibility_preview,
                3_000,
            )
            .expect("second hello should create a replacement live session");
        let second_admit = registry
            .admit(
                &second_hello.session_id,
                NodeSessionAdmitInput {
                    hello_token: second_hello.hello_token.clone(),
                },
                4_000,
            )
            .expect("second admit should transition the replacement session");

        let close = registry
            .close(
                &first_hello.session_id,
                NodeSessionCloseInput {
                    lease_id: first_admit.lease.lease_id.clone(),
                    reason: "restart".to_string(),
                    successor_hint: Some(second_hello.session_id.clone()),
                },
                5_000,
            )
            .expect("close should persist the replacement hint");
        let sessions = registry
            .list_sessions()
            .expect("live node sessions should be readable");
        let closed_session = sessions
            .iter()
            .find(|session| session.session_id == first_hello.session_id)
            .expect("closed session should remain visible");
        let closed_session_json =
            serde_json::to_value(closed_session).expect("closed session should serialize to json");
        let successor_session = sessions
            .iter()
            .find(|session| session.session_id == second_hello.session_id)
            .expect("successor session should remain visible");

        assert_eq!(close.closed, true);
        assert_eq!(close.replacement_expected, true);
        assert_eq!(closed_session.state, NodeSessionState::Closed);
        assert_eq!(successor_session.state, NodeSessionState::Admitted);
        assert_eq!(successor_session.last_seen_at, second_admit.lease.issued_at);
        assert_eq!(
            closed_session_json
                .get("successorSessionId")
                .and_then(|value| value.as_str()),
            Some(second_hello.session_id.as_str())
        );
    }

    #[test]
    fn node_session_registry_admit_replaces_older_same_node_session() {
        let node_session_store_path =
            create_test_rollout_store_path("node-session-replaced-admit");
        let registry = NodeSessionRegistry::open(node_session_store_path)
            .expect("node session registry should open the test store");
        let compatibility_preview = NodeSessionCompatibilityPreview {
            compatibility_state: NodeSessionCompatibilityState::Compatible,
            desired_state_revision: Some(1),
            desired_state_hash: Some("hash-a".to_string()),
            reason: None,
        };
        let first_hello = registry
            .hello(
                NodeSessionHelloInput {
                    boot_id: "boot-local-1".to_string(),
                    node_claim: NodeSessionHelloNodeClaim {
                        claimed_node_id: Some("local-built-in".to_string()),
                        host_platform: Some("linux".to_string()),
                        host_arch: Some("x64".to_string()),
                    },
                    version_manifest: NodeSessionHelloVersionManifest {
                        internal_api_version: "v1".to_string(),
                        config_projection_version: Some("v1".to_string()),
                    },
                    capabilities: vec![
                        "desired-state.pull".to_string(),
                        "runtime.apply".to_string(),
                    ],
                },
                compatibility_preview.clone(),
                1_000,
            )
            .expect("first hello should create a live session");
        registry
            .admit(
                &first_hello.session_id,
                NodeSessionAdmitInput {
                    hello_token: first_hello.hello_token.clone(),
                },
                2_000,
            )
            .expect("first admit should transition the session");
        let second_hello = registry
            .hello(
                NodeSessionHelloInput {
                    boot_id: "boot-local-2".to_string(),
                    node_claim: NodeSessionHelloNodeClaim {
                        claimed_node_id: Some("local-built-in".to_string()),
                        host_platform: Some("linux".to_string()),
                        host_arch: Some("x64".to_string()),
                    },
                    version_manifest: NodeSessionHelloVersionManifest {
                        internal_api_version: "v1".to_string(),
                        config_projection_version: Some("v1".to_string()),
                    },
                    capabilities: vec![
                        "desired-state.pull".to_string(),
                        "runtime.apply".to_string(),
                    ],
                },
                compatibility_preview,
                3_000,
            )
            .expect("second hello should create a replacement live session");
        registry
            .admit(
                &second_hello.session_id,
                NodeSessionAdmitInput {
                    hello_token: second_hello.hello_token.clone(),
                },
                4_000,
            )
            .expect("second admit should replace the older session");
        let sessions = registry
            .list_sessions()
            .expect("live node sessions should be readable");
        let replaced_session = sessions
            .iter()
            .find(|session| session.session_id == first_hello.session_id)
            .expect("older session should still be visible for diagnostics");
        let replaced_session_json = serde_json::to_value(replaced_session)
            .expect("replaced session should serialize to json");
        let successor_session = sessions
            .iter()
            .find(|session| session.session_id == second_hello.session_id)
            .expect("successor session should remain visible");

        assert_eq!(
            replaced_session_json
                .get("state")
                .and_then(|value| value.as_str()),
            Some("replaced")
        );
        assert_eq!(
            replaced_session_json
                .get("successorSessionId")
                .and_then(|value| value.as_str()),
            Some(second_hello.session_id.as_str())
        );
        assert_eq!(successor_session.state, NodeSessionState::Admitted);
    }

    #[test]
    fn node_session_registry_rejects_runtime_actions_for_replaced_session() {
        let node_session_store_path =
            create_test_rollout_store_path("node-session-replaced-runtime");
        let registry = NodeSessionRegistry::open(node_session_store_path)
            .expect("node session registry should open the test store");
        let compatibility_preview = NodeSessionCompatibilityPreview {
            compatibility_state: NodeSessionCompatibilityState::Compatible,
            desired_state_revision: Some(1),
            desired_state_hash: Some("hash-a".to_string()),
            reason: None,
        };
        let first_hello = registry
            .hello(
                NodeSessionHelloInput {
                    boot_id: "boot-local-1".to_string(),
                    node_claim: NodeSessionHelloNodeClaim {
                        claimed_node_id: Some("local-built-in".to_string()),
                        host_platform: Some("linux".to_string()),
                        host_arch: Some("x64".to_string()),
                    },
                    version_manifest: NodeSessionHelloVersionManifest {
                        internal_api_version: "v1".to_string(),
                        config_projection_version: Some("v1".to_string()),
                    },
                    capabilities: vec![
                        "desired-state.pull".to_string(),
                        "runtime.apply".to_string(),
                    ],
                },
                compatibility_preview.clone(),
                1_000,
            )
            .expect("first hello should create a live session");
        let first_admit = registry
            .admit(
                &first_hello.session_id,
                NodeSessionAdmitInput {
                    hello_token: first_hello.hello_token.clone(),
                },
                2_000,
            )
            .expect("first admit should transition the session");
        let second_hello = registry
            .hello(
                NodeSessionHelloInput {
                    boot_id: "boot-local-2".to_string(),
                    node_claim: NodeSessionHelloNodeClaim {
                        claimed_node_id: Some("local-built-in".to_string()),
                        host_platform: Some("linux".to_string()),
                        host_arch: Some("x64".to_string()),
                    },
                    version_manifest: NodeSessionHelloVersionManifest {
                        internal_api_version: "v1".to_string(),
                        config_projection_version: Some("v1".to_string()),
                    },
                    capabilities: vec![
                        "desired-state.pull".to_string(),
                        "runtime.apply".to_string(),
                    ],
                },
                compatibility_preview,
                3_000,
            )
            .expect("second hello should create a replacement live session");
        registry
            .admit(
                &second_hello.session_id,
                NodeSessionAdmitInput {
                    hello_token: second_hello.hello_token.clone(),
                },
                4_000,
            )
            .expect("second admit should replace the older session");

        let error = registry
            .heartbeat(
                &first_hello.session_id,
                NodeSessionHeartbeatInput {
                    lease_id: first_admit.lease.lease_id.clone(),
                    last_seen_revision: None,
                },
                5_000,
            )
            .expect_err("replaced session heartbeat should be rejected");

        assert_eq!(
            error.to_string(),
            format!(
                "node session was replaced by a newer session: {}",
                first_hello.session_id
            )
        );
    }

    fn create_test_rollout_store_path(label: &str) -> PathBuf {
        let unique_suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after unix epoch")
            .as_nanos();
        let directory = std::env::temp_dir().join(format!(
            "sdkwork-claw-host-core-rollouts-{label}-{}-{unique_suffix}",
            std::process::id()
        ));
        fs::create_dir_all(&directory).expect("test rollout directory should be created");
        directory.join("rollouts.json")
    }
}
