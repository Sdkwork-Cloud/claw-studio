use std::fs;
use std::path::{Component, Path, PathBuf};

use axum::{
    Router,
    body::Body,
    http::{StatusCode, Uri, header},
    response::{Html, IntoResponse, Response},
    routing::get,
};

#[derive(Debug, Clone)]
pub struct StaticAssetMount {
    dist_dir: PathBuf,
}

impl StaticAssetMount {
    pub fn from_web_dist(path: impl AsRef<Path>) -> Self {
        Self {
            dist_dir: PathBuf::from(path.as_ref()),
        }
    }

    pub fn attach(self, router: Router) -> Router {
        let dist_dir = self.dist_dir.clone();
        router.fallback(get(move |uri: Uri| {
            let dist_dir = dist_dir.clone();
            let request_path = uri.path().to_string();
            async move { serve_browser_path(dist_dir, &request_path).await }
        }))
    }
}

async fn serve_browser_path(dist_dir: PathBuf, request_path: &str) -> Response {
    if let Some(relative_path) = resolve_browser_relative_path(request_path) {
        let candidate_path = dist_dir.join(&relative_path);

        if candidate_path.is_file() {
            return serve_static_file(candidate_path);
        }

        if candidate_path.extension().is_some() {
            return StatusCode::NOT_FOUND.into_response();
        }
    }

    serve_index_html(dist_dir).await
}

async fn serve_index_html(dist_dir: PathBuf) -> Response {
    let index_path = dist_dir.join("index.html");
    match fs::read_to_string(index_path) {
        Ok(html) => Html(inject_server_host_metadata(&html)).into_response(),
        Err(_) => StatusCode::SERVICE_UNAVAILABLE.into_response(),
    }
}

fn inject_server_host_metadata(html: &str) -> String {
    if html.contains("sdkwork-claw-host-mode") {
        return html.to_string();
    }

    let metadata = concat!(
        "\n    <meta name=\"sdkwork-claw-host-mode\" content=\"server\" />\n",
        "    <meta name=\"sdkwork-claw-manage-base-path\" content=\"/claw/manage/v1\" />\n",
        "    <meta name=\"sdkwork-claw-internal-base-path\" content=\"/claw/internal/v1\" />\n",
    );

    match html.find("</head>") {
        Some(index) => {
            let mut injected = String::with_capacity(html.len() + metadata.len());
            injected.push_str(&html[..index]);
            injected.push_str(metadata);
            injected.push_str(&html[index..]);
            injected
        }
        None => format!("{metadata}{html}"),
    }
}

fn resolve_browser_relative_path(request_path: &str) -> Option<PathBuf> {
    let trimmed_path = request_path.trim_start_matches('/');
    if trimmed_path.is_empty() {
        return None;
    }

    let mut relative_path = PathBuf::new();
    for component in Path::new(trimmed_path).components() {
        match component {
            Component::Normal(value) => relative_path.push(value),
            _ => return None,
        }
    }

    if relative_path.as_os_str().is_empty() {
        None
    } else {
        Some(relative_path)
    }
}

fn serve_static_file(path: PathBuf) -> Response {
    match fs::read(&path) {
        Ok(body) => Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, content_type_for_path(&path))
            .body(Body::from(body))
            .expect("static asset response should build"),
        Err(_) => StatusCode::NOT_FOUND.into_response(),
    }
}

fn content_type_for_path(path: &Path) -> &'static str {
    match path.extension().and_then(|value| value.to_str()).unwrap_or_default() {
        "css" => "text/css; charset=utf-8",
        "js" => "application/javascript; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "svg" => "image/svg+xml",
        "html" => "text/html; charset=utf-8",
        "txt" => "text/plain; charset=utf-8",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "ico" => "image/x-icon",
        _ => "application/octet-stream",
    }
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    use axum::body::to_bytes;
    use axum::http::StatusCode;

    use super::{inject_server_host_metadata, serve_browser_path};

    #[test]
    fn inject_server_host_metadata_marks_server_mode_and_base_paths() {
        let html = inject_server_host_metadata("<html><head></head><body></body></html>");

        assert!(html.contains("sdkwork-claw-host-mode"));
        assert!(html.contains("sdkwork-claw-manage-base-path"));
        assert!(html.contains("sdkwork-claw-internal-base-path"));
        assert!(html.contains("content=\"server\""));
    }

    #[tokio::test]
    async fn serve_browser_path_prefers_real_asset_files_before_index_fallback() {
        let dist_dir = create_test_dist_dir();
        let assets_dir = dist_dir.join("assets");
        fs::create_dir_all(&assets_dir).expect("assets directory should be created");
        fs::write(
            dist_dir.join("index.html"),
            "<html><head></head><body><div id=\"root\"></div></body></html>",
        )
        .expect("index.html should be written");
        fs::write(assets_dir.join("app.js"), "console.log('asset ok');")
            .expect("asset file should be written");

        let response = serve_browser_path(dist_dir, "/assets/app.js").await;
        let status = response.status();
        let content_type = response
            .headers()
            .get("content-type")
            .and_then(|value| value.to_str().ok())
            .unwrap_or("")
            .to_string();
        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("asset response body should be readable");
        let text = String::from_utf8(body.to_vec()).expect("asset response body should be utf-8");

        assert_eq!(status, StatusCode::OK);
        assert!(content_type.contains("javascript"));
        assert_eq!(text, "console.log('asset ok');");
    }

    fn create_test_dist_dir() -> std::path::PathBuf {
        let unique_suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after unix epoch")
            .as_nanos();
        let directory = std::env::temp_dir().join(format!(
            "sdkwork-claw-server-static-assets-{}-{unique_suffix}",
            std::process::id()
        ));
        fs::create_dir_all(&directory).expect("test dist directory should be created");
        directory
    }
}
