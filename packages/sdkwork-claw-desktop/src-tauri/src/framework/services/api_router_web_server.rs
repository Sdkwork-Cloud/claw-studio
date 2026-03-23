use crate::framework::{FrameworkError, Result};
use axum::{
    body::{to_bytes, Body},
    extract::State,
    http::{
        header::{
            ACCESS_CONTROL_ALLOW_HEADERS, ACCESS_CONTROL_ALLOW_METHODS,
            ACCESS_CONTROL_ALLOW_ORIGIN, ACCESS_CONTROL_MAX_AGE, ACCESS_CONTROL_REQUEST_HEADERS,
            ACCESS_CONTROL_REQUEST_METHOD, CACHE_CONTROL, CONTENT_LENGTH, CONTENT_TYPE, HOST,
            ORIGIN, VARY,
        },
        HeaderMap, HeaderName, HeaderValue, Method, Request, Response, StatusCode,
    },
    routing::any,
    Router,
};
use std::{
    fs,
    io::{Read, Write},
    net::{SocketAddr, TcpListener, TcpStream},
    path::{Path, PathBuf},
    sync::Arc,
    thread::{self, JoinHandle},
    time::Duration,
};
use tokio::sync::oneshot;

pub(crate) const API_ROUTER_WEB_SERVER_HEALTH_PATH: &str = "/_claw/api-router-host/health";
const DEFAULT_CORS_ALLOW_HEADERS: &str = "Authorization, Content-Type, Accept";
const DEFAULT_CORS_ALLOW_METHODS: &str = "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD";
const DEFAULT_CORS_MAX_AGE_SECS: &str = "600";
const ACCESS_CONTROL_ALLOW_PRIVATE_NETWORK: &str = "access-control-allow-private-network";
const ACCESS_CONTROL_REQUEST_PRIVATE_NETWORK: &str = "access-control-request-private-network";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum RuntimeSite {
    Admin,
    Portal,
}

impl RuntimeSite {
    fn mount_prefix(self) -> &'static str {
        match self {
            Self::Admin => "/admin",
            Self::Portal => "/portal",
        }
    }

    pub(crate) fn label(self) -> &'static str {
        match self {
            Self::Admin => "admin",
            Self::Portal => "portal",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum RuntimeRoute {
    Redirect(String),
    Proxy {
        upstream: &'static str,
        request_path: String,
    },
    Static {
        site: RuntimeSite,
        request_path: String,
    },
    Health,
    NotFound,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct SiteAsset {
    pub site: RuntimeSite,
    pub filesystem_path: PathBuf,
    pub content_type: String,
    pub cache_control: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct ApiRouterWebServerConfig {
    pub bind_addr: String,
    pub gateway_upstream_base_url: String,
    pub admin_upstream_base_url: String,
    pub portal_upstream_base_url: String,
    pub admin_site_dir: Option<PathBuf>,
    pub portal_site_dir: Option<PathBuf>,
    pub enable_admin: bool,
    pub enable_portal: bool,
}

#[derive(Clone)]
struct ApiRouterWebServerState {
    config: Arc<ApiRouterWebServerConfig>,
    client: reqwest::Client,
}

pub(crate) struct ApiRouterWebServerHandle {
    bind_addr: String,
    shutdown: Option<oneshot::Sender<()>>,
    thread: Option<JoinHandle<()>>,
}

impl std::fmt::Debug for ApiRouterWebServerHandle {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ApiRouterWebServerHandle")
            .field("bind_addr", &self.bind_addr)
            .finish()
    }
}

impl ApiRouterWebServerHandle {
    pub fn start(config: ApiRouterWebServerConfig) -> Result<Self> {
        let socket_addr = parse_socket_addr(&config.bind_addr)?;
        let listener = TcpListener::bind(socket_addr)?;
        listener.set_nonblocking(true)?;
        let bind_addr = listener.local_addr()?.to_string();
        let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();
        let state = ApiRouterWebServerState {
            config: Arc::new(ApiRouterWebServerConfig {
                bind_addr: bind_addr.clone(),
                ..config
            }),
            client: reqwest::Client::builder()
                .redirect(reqwest::redirect::Policy::none())
                .build()
                .map_err(|error| FrameworkError::Internal(error.to_string()))?,
        };
        let thread = thread::Builder::new()
            .name("sdkwork-api-router-web-server".to_string())
            .spawn(move || {
                let runtime = match tokio::runtime::Builder::new_current_thread()
                    .enable_all()
                    .build()
                {
                    Ok(runtime) => runtime,
                    Err(error) => {
                        eprintln!("[api-router-web-server] failed to build runtime: {error}");
                        return;
                    }
                };

                runtime.block_on(async move {
                    let listener = match tokio::net::TcpListener::from_std(listener) {
                        Ok(listener) => listener,
                        Err(error) => {
                            eprintln!("[api-router-web-server] failed to adopt listener: {error}");
                            return;
                        }
                    };
                    let app = Router::new()
                        .fallback(any(handle_request))
                        .with_state(state);
                    let server = axum::serve(listener, app).with_graceful_shutdown(async {
                        let _ = shutdown_rx.await;
                    });
                    if let Err(error) = server.await {
                        eprintln!("[api-router-web-server] server error: {error}");
                    }
                });
            })
            .map_err(FrameworkError::from)?;

        Ok(Self {
            bind_addr,
            shutdown: Some(shutdown_tx),
            thread: Some(thread),
        })
    }

    pub fn bind_addr(&self) -> &str {
        &self.bind_addr
    }

    pub fn stop(&mut self) -> Result<()> {
        if let Some(shutdown) = self.shutdown.take() {
            let _ = shutdown.send(());
        }
        if let Some(thread) = self.thread.take() {
            thread.join().map_err(|_| {
                FrameworkError::Internal("api router web server thread panicked".to_string())
            })?;
        }

        Ok(())
    }
}

pub(crate) fn classify_request(request_path: &str) -> RuntimeRoute {
    let path = strip_request_suffix(request_path);

    if path == API_ROUTER_WEB_SERVER_HEALTH_PATH {
        return RuntimeRoute::Health;
    }

    if path == "/" {
        return RuntimeRoute::Redirect("/portal/".to_string());
    }

    if path == "/admin" {
        return RuntimeRoute::Redirect("/admin/".to_string());
    }

    if path == "/portal" {
        return RuntimeRoute::Redirect("/portal/".to_string());
    }

    if let Some(suffix) = path.strip_prefix("/api/admin") {
        return RuntimeRoute::Proxy {
            upstream: "admin",
            request_path: rewrite_proxy_path("/admin", suffix),
        };
    }

    if let Some(suffix) = path.strip_prefix("/api/portal") {
        return RuntimeRoute::Proxy {
            upstream: "portal",
            request_path: rewrite_proxy_path("/portal", suffix),
        };
    }

    if let Some(suffix) = path.strip_prefix("/api/v1") {
        return RuntimeRoute::Proxy {
            upstream: "gateway",
            request_path: rewrite_proxy_path("/v1", suffix),
        };
    }

    if path.starts_with("/admin/") {
        return RuntimeRoute::Static {
            site: RuntimeSite::Admin,
            request_path: request_path.to_string(),
        };
    }

    if path.starts_with("/portal/") {
        return RuntimeRoute::Static {
            site: RuntimeSite::Portal,
            request_path: request_path.to_string(),
        };
    }

    RuntimeRoute::NotFound
}

pub(crate) fn resolve_static_asset(
    site: RuntimeSite,
    request_path: &str,
    site_root: &Path,
) -> Result<SiteAsset> {
    let path = strip_request_suffix(request_path);
    let site_relative_path = path.strip_prefix(site.mount_prefix()).ok_or_else(|| {
        FrameworkError::ValidationFailed("request path does not belong to site mount".to_string())
    })?;

    let asset_path = if should_serve_index(site_relative_path) {
        site_root.join("index.html")
    } else {
        site_root.join(normalize_relative_path(site_relative_path)?)
    };

    let cache_control = if asset_path.extension().and_then(|value| value.to_str()) == Some("html") {
        "no-cache".to_string()
    } else {
        "public, max-age=31536000, immutable".to_string()
    };

    Ok(SiteAsset {
        site,
        filesystem_path: asset_path.clone(),
        content_type: guess_content_type(&asset_path).to_string(),
        cache_control,
    })
}

pub(crate) fn probe_api_router_web_server(bind_addr: &str, timeout_ms: u64) -> bool {
    let Ok(socket_addr) = parse_socket_addr(bind_addr) else {
        return false;
    };
    let timeout = Duration::from_millis(timeout_ms);
    let mut stream = match TcpStream::connect_timeout(&socket_addr, timeout) {
        Ok(stream) => stream,
        Err(_) => return false,
    };
    let _ = stream.set_read_timeout(Some(timeout));
    let _ = stream.set_write_timeout(Some(timeout));
    let request = format!(
        "GET {} HTTP/1.1\r\nHost: {socket_addr}\r\nConnection: close\r\n\r\n",
        API_ROUTER_WEB_SERVER_HEALTH_PATH
    );
    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }
    let mut response = String::new();
    if stream.read_to_string(&mut response).is_err() {
        return false;
    }

    response.starts_with("HTTP/1.1 200") || response.starts_with("HTTP/1.0 200")
}

async fn handle_request(
    State(state): State<ApiRouterWebServerState>,
    request: Request<Body>,
) -> Response<Body> {
    let request_headers = request.headers().clone();
    let cors_origin = resolve_cors_origin(request.headers());
    if request.method() == Method::OPTIONS {
        return finalize_response_with_cors(
            if is_cors_preflight_request(request.headers()) {
                match cors_origin.as_ref() {
                    Some(_) => cors_preflight_response(request.headers()),
                    None => text_response(StatusCode::FORBIDDEN, "origin not allowed"),
                }
            } else {
                text_response(StatusCode::METHOD_NOT_ALLOWED, "method not allowed")
            },
            cors_origin.as_ref(),
            &request_headers,
        );
    }

    let route = request
        .uri()
        .path_and_query()
        .map(|value| value.as_str())
        .map(classify_request)
        .unwrap_or_else(|| classify_request(request.uri().path()));

    finalize_response_with_cors(
        match route {
            RuntimeRoute::Health => text_response(StatusCode::OK, "ok"),
            RuntimeRoute::Redirect(location) => redirect_response(&location),
            RuntimeRoute::Proxy {
                upstream,
                request_path,
            } => handle_proxy_request(state, request, upstream, &request_path).await,
            RuntimeRoute::Static { site, request_path } => {
                handle_static_request(&state.config, request, site, &request_path)
            }
            RuntimeRoute::NotFound => text_response(StatusCode::NOT_FOUND, "not found"),
        },
        cors_origin.as_ref(),
        &request_headers,
    )
}

fn handle_static_request(
    config: &ApiRouterWebServerConfig,
    request: Request<Body>,
    site: RuntimeSite,
    request_path: &str,
) -> Response<Body> {
    if (site == RuntimeSite::Admin && !config.enable_admin)
        || (site == RuntimeSite::Portal && !config.enable_portal)
    {
        return text_response(
            StatusCode::NOT_FOUND,
            &format!("sdkwork-api-router {} site is disabled", site.label()),
        );
    }

    if request.method() != Method::GET && request.method() != Method::HEAD {
        return text_response(
            StatusCode::METHOD_NOT_ALLOWED,
            &format!("{} static site only supports GET and HEAD", site.label()),
        );
    }

    let site_root = match site {
        RuntimeSite::Admin => config.admin_site_dir.as_deref(),
        RuntimeSite::Portal => config.portal_site_dir.as_deref(),
    };

    if let Some(site_root) = site_root {
        match resolve_static_asset(site, request_path, site_root) {
            Ok(asset) if asset.filesystem_path.is_file() => {
                return serve_static_asset(asset, request.method() == Method::HEAD);
            }
            Ok(_) | Err(_) => {}
        }
    }

    if should_serve_index(
        strip_request_suffix(request_path)
            .strip_prefix(site.mount_prefix())
            .unwrap_or_default(),
    ) {
        return html_response(
            StatusCode::OK,
            "no-cache",
            &build_site_placeholder_html(site, config, site_root),
        );
    }

    text_response(StatusCode::NOT_FOUND, "static asset not found")
}

async fn handle_proxy_request(
    state: ApiRouterWebServerState,
    request: Request<Body>,
    upstream: &'static str,
    request_path: &str,
) -> Response<Body> {
    if (upstream == "admin" && !state.config.enable_admin)
        || (upstream == "portal" && !state.config.enable_portal)
    {
        return text_response(
            StatusCode::NOT_FOUND,
            &format!("sdkwork-api-router {upstream} route is disabled"),
        );
    }

    let upstream_base_url = match upstream {
        "admin" => state.config.admin_upstream_base_url.as_str(),
        "portal" => state.config.portal_upstream_base_url.as_str(),
        _ => state.config.gateway_upstream_base_url.as_str(),
    };
    let (parts, body) = request.into_parts();
    let body_bytes = match to_bytes(body, usize::MAX).await {
        Ok(bytes) => bytes,
        Err(error) => {
            return text_response(
                StatusCode::BAD_REQUEST,
                &format!("failed to read request body: {error}"),
            );
        }
    };
    let mut target_url = format!("{upstream_base_url}{request_path}");
    if let Some(query) = parts.uri.query() {
        target_url.push('?');
        target_url.push_str(query);
    }

    let mut upstream_request = state.client.request(parts.method.clone(), target_url);
    for (name, value) in &parts.headers {
        if *name == HOST {
            continue;
        }
        upstream_request = upstream_request.header(name, value);
    }

    let upstream_response = match upstream_request.body(body_bytes).send().await {
        Ok(response) => response,
        Err(error) => {
            return text_response(
                StatusCode::BAD_GATEWAY,
                &format!("sdkwork-api-router upstream request failed: {error}"),
            );
        }
    };
    let status = upstream_response.status();
    let headers = upstream_response.headers().clone();
    let response_bytes = match upstream_response.bytes().await {
        Ok(bytes) => bytes,
        Err(error) => {
            return text_response(
                StatusCode::BAD_GATEWAY,
                &format!("failed to read sdkwork-api-router upstream response: {error}"),
            );
        }
    };

    let mut response = Response::builder().status(status);
    {
        let response_headers = response
            .headers_mut()
            .expect("response headers should be available");
        copy_response_headers(&headers, response_headers);
        if let Ok(content_length) = HeaderValue::from_str(&response_bytes.len().to_string()) {
            response_headers.insert(CONTENT_LENGTH, content_length);
        }
    }
    response
        .body(Body::from(response_bytes))
        .unwrap_or_else(|error| {
            text_response(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string())
        })
}

fn copy_response_headers(source: &HeaderMap, target: &mut HeaderMap) {
    for (name, value) in source {
        if name.as_str().eq_ignore_ascii_case("transfer-encoding")
            || name.as_str().eq_ignore_ascii_case("connection")
        {
            continue;
        }

        target.insert(name, value.clone());
    }
}

fn serve_static_asset(asset: SiteAsset, head_only: bool) -> Response<Body> {
    match fs::read(&asset.filesystem_path) {
        Ok(bytes) => {
            let mut response = Response::builder().status(StatusCode::OK);
            {
                let headers = response
                    .headers_mut()
                    .expect("response headers should be available");
                headers.insert(
                    CONTENT_TYPE,
                    HeaderValue::from_str(&asset.content_type)
                        .unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream")),
                );
                headers.insert(
                    CACHE_CONTROL,
                    HeaderValue::from_str(&asset.cache_control)
                        .unwrap_or_else(|_| HeaderValue::from_static("no-cache")),
                );
                headers.insert(
                    CONTENT_LENGTH,
                    HeaderValue::from_str(&bytes.len().to_string())
                        .unwrap_or_else(|_| HeaderValue::from_static("0")),
                );
            }
            response
                .body(if head_only {
                    Body::empty()
                } else {
                    Body::from(bytes)
                })
                .unwrap_or_else(|error| {
                    text_response(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string())
                })
        }
        Err(error) => text_response(StatusCode::NOT_FOUND, &error.to_string()),
    }
}

fn build_site_placeholder_html(
    site: RuntimeSite,
    config: &ApiRouterWebServerConfig,
    site_root: Option<&Path>,
) -> String {
    let api_base_url = match site {
        RuntimeSite::Admin => "/api/admin",
        RuntimeSite::Portal => "/api/portal",
    };
    let site_root_label = site_root
        .map(|path| path.to_string_lossy().into_owned())
        .unwrap_or_else(|| "not bundled".to_string());

    format!(
        "<!doctype html><html><head><meta charset=\"utf-8\"><title>sdkwork-api-router {site_label}</title><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><style>body{{font-family:Segoe UI,system-ui,sans-serif;background:#f7f8fa;color:#17202a;margin:0;padding:32px}}main{{max-width:720px;margin:0 auto;background:#fff;border:1px solid #dde3ea;border-radius:16px;padding:24px;box-shadow:0 12px 32px rgba(15,23,42,.06)}}code{{background:#f1f5f9;padding:2px 6px;border-radius:6px}}a{{color:#0f62fe}}</style></head><body><main><h1>sdkwork-api-router {site_label}</h1><p>Claw Studio has started the built-in web server, but the static {site_label} bundle is not currently available.</p><p>You can still access the proxied API at <code>{api_base_url}</code>.</p><p>Resolved site directory: <code>{site_root_label}</code></p><p>Public host bind: <code>{bind_addr}</code></p></main></body></html>",
        site_label = site.label(),
        api_base_url = api_base_url,
        site_root_label = site_root_label,
        bind_addr = config.bind_addr,
    )
}

fn redirect_response(location: &str) -> Response<Body> {
    let mut response = Response::builder().status(StatusCode::FOUND);
    {
        let headers = response
            .headers_mut()
            .expect("response headers should be available");
        headers.insert(
            HeaderName::from_static("location"),
            HeaderValue::from_str(location)
                .unwrap_or_else(|_| HeaderValue::from_static("/portal/")),
        );
        headers.insert(CACHE_CONTROL, HeaderValue::from_static("no-cache"));
        headers.insert(CONTENT_LENGTH, HeaderValue::from_static("0"));
    }
    response.body(Body::empty()).unwrap_or_else(|error| {
        text_response(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string())
    })
}

fn cors_preflight_response(request_headers: &HeaderMap) -> Response<Body> {
    let mut response = Response::builder().status(StatusCode::NO_CONTENT);
    {
        let headers = response
            .headers_mut()
            .expect("response headers should be available");
        headers.insert(
            ACCESS_CONTROL_ALLOW_METHODS,
            HeaderValue::from_static(DEFAULT_CORS_ALLOW_METHODS),
        );
        headers.insert(
            ACCESS_CONTROL_ALLOW_HEADERS,
            request_headers
                .get(ACCESS_CONTROL_REQUEST_HEADERS)
                .cloned()
                .unwrap_or_else(|| HeaderValue::from_static(DEFAULT_CORS_ALLOW_HEADERS)),
        );
        headers.insert(
            ACCESS_CONTROL_MAX_AGE,
            HeaderValue::from_static(DEFAULT_CORS_MAX_AGE_SECS),
        );
        if request_headers
            .get(ACCESS_CONTROL_REQUEST_PRIVATE_NETWORK)
            .is_some_and(|value| value.as_bytes().eq_ignore_ascii_case(b"true"))
        {
            headers.insert(
                HeaderName::from_static(ACCESS_CONTROL_ALLOW_PRIVATE_NETWORK),
                HeaderValue::from_static("true"),
            );
        }
        headers.insert(CONTENT_LENGTH, HeaderValue::from_static("0"));
        headers.insert(CACHE_CONTROL, HeaderValue::from_static("no-cache"));
    }
    response.body(Body::empty()).unwrap_or_else(|error| {
        text_response(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string())
    })
}

fn finalize_response_with_cors(
    mut response: Response<Body>,
    cors_origin: Option<&HeaderValue>,
    request_headers: &HeaderMap,
) -> Response<Body> {
    apply_cors_headers(response.headers_mut(), cors_origin, request_headers);
    response
}

fn apply_cors_headers(
    headers: &mut HeaderMap,
    cors_origin: Option<&HeaderValue>,
    request_headers: &HeaderMap,
) {
    if let Some(origin) = cors_origin {
        headers.insert(ACCESS_CONTROL_ALLOW_ORIGIN, origin.clone());
        append_vary_header(headers, "Origin");
        append_vary_header(headers, "Access-Control-Request-Method");
        append_vary_header(headers, "Access-Control-Request-Headers");
    }

    if request_headers
        .get(ACCESS_CONTROL_REQUEST_PRIVATE_NETWORK)
        .is_some_and(|value| value.as_bytes().eq_ignore_ascii_case(b"true"))
    {
        headers.insert(
            HeaderName::from_static(ACCESS_CONTROL_ALLOW_PRIVATE_NETWORK),
            HeaderValue::from_static("true"),
        );
    }
}

fn append_vary_header(headers: &mut HeaderMap, value: &str) {
    let new_value = match headers.get(VARY).and_then(|current| current.to_str().ok()) {
        Some(current)
            if current
                .split(',')
                .any(|part| part.trim().eq_ignore_ascii_case(value)) =>
        {
            return;
        }
        Some(current) if !current.trim().is_empty() => format!("{current}, {value}"),
        _ => value.to_string(),
    };

    if let Ok(vary) = HeaderValue::from_str(&new_value) {
        headers.insert(VARY, vary);
    }
}

fn is_cors_preflight_request(headers: &HeaderMap) -> bool {
    headers.contains_key(ORIGIN) && headers.contains_key(ACCESS_CONTROL_REQUEST_METHOD)
}

fn resolve_cors_origin(headers: &HeaderMap) -> Option<HeaderValue> {
    let origin = headers.get(ORIGIN)?.to_str().ok()?.trim();
    if origin.is_empty() || origin.eq_ignore_ascii_case("null") || !is_allowed_origin(origin) {
        return None;
    }

    HeaderValue::from_str(origin).ok()
}

fn is_allowed_origin(origin: &str) -> bool {
    if matches!(
        origin,
        "tauri://localhost" | "https://tauri.localhost" | "http://tauri.localhost"
    ) {
        return true;
    }

    let Ok(url) = reqwest::Url::parse(origin) else {
        return false;
    };

    if !matches!(url.scheme(), "http" | "https") {
        return false;
    }

    let Some(host) = url.host_str() else {
        return false;
    };
    if host.eq_ignore_ascii_case("localhost") {
        return true;
    }

    host.parse::<std::net::IpAddr>()
        .map(|address| address.is_loopback())
        .unwrap_or(false)
}

fn html_response(status: StatusCode, cache_control: &str, html: &str) -> Response<Body> {
    let mut response = Response::builder().status(status);
    {
        let headers = response
            .headers_mut()
            .expect("response headers should be available");
        headers.insert(
            CONTENT_TYPE,
            HeaderValue::from_static("text/html; charset=utf-8"),
        );
        headers.insert(
            CACHE_CONTROL,
            HeaderValue::from_str(cache_control)
                .unwrap_or_else(|_| HeaderValue::from_static("no-cache")),
        );
        headers.insert(
            CONTENT_LENGTH,
            HeaderValue::from_str(&html.len().to_string())
                .unwrap_or_else(|_| HeaderValue::from_static("0")),
        );
    }
    response
        .body(Body::from(html.to_string()))
        .unwrap_or_else(|error| {
            text_response(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string())
        })
}

fn text_response(status: StatusCode, message: &str) -> Response<Body> {
    let mut response = Response::builder().status(status);
    {
        let headers = response
            .headers_mut()
            .expect("response headers should be available");
        headers.insert(
            CONTENT_TYPE,
            HeaderValue::from_static("text/plain; charset=utf-8"),
        );
        headers.insert(CACHE_CONTROL, HeaderValue::from_static("no-cache"));
        headers.insert(
            CONTENT_LENGTH,
            HeaderValue::from_str(&message.len().to_string())
                .unwrap_or_else(|_| HeaderValue::from_static("0")),
        );
    }
    response
        .body(Body::from(message.to_string()))
        .unwrap_or_else(|_| Response::new(Body::empty()))
}

fn strip_request_suffix(request_path: &str) -> &str {
    request_path
        .split(['#', '?'])
        .next()
        .filter(|value| !value.is_empty())
        .unwrap_or("/")
}

fn rewrite_proxy_path(prefix: &str, suffix: &str) -> String {
    if suffix.is_empty() {
        prefix.to_string()
    } else {
        format!("{prefix}{suffix}")
    }
}

fn should_serve_index(site_relative_path: &str) -> bool {
    let trimmed = site_relative_path.trim_start_matches('/');
    trimmed.is_empty() || !trimmed.rsplit('/').next().unwrap_or_default().contains('.')
}

fn normalize_relative_path(site_relative_path: &str) -> Result<PathBuf> {
    let mut normalized = PathBuf::new();

    for segment in site_relative_path.trim_start_matches('/').split('/') {
        if segment.is_empty() || segment == "." {
            continue;
        }
        if segment == ".." {
            return Err(FrameworkError::ValidationFailed(
                "path traversal is not allowed".to_string(),
            ));
        }
        normalized.push(segment);
    }

    if normalized.as_os_str().is_empty() {
        return Err(FrameworkError::ValidationFailed(
            "empty static asset path".to_string(),
        ));
    }

    Ok(normalized)
}

fn guess_content_type(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
    {
        "html" => "text/html; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "ico" => "image/x-icon",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "txt" => "text/plain; charset=utf-8",
        _ => "application/octet-stream",
    }
}

fn parse_socket_addr(bind_addr: &str) -> Result<SocketAddr> {
    bind_addr.parse::<SocketAddr>().map_err(|error| {
        FrameworkError::ValidationFailed(format!(
            "invalid api router web server bind address {bind_addr}: {error}"
        ))
    })
}

pub(crate) fn upstream_base_url_for_bind(bind_addr: &str) -> Result<String> {
    Ok(format!("http://{}", parse_socket_addr(bind_addr)?))
}

#[cfg(test)]
mod tests {
    use super::{
        append_vary_header, build_site_placeholder_html, classify_request, cors_preflight_response,
        is_allowed_origin, resolve_cors_origin, resolve_static_asset, RuntimeRoute, RuntimeSite,
        SiteAsset,
    };
    use axum::http::{
        header::{ACCESS_CONTROL_ALLOW_HEADERS, ACCESS_CONTROL_ALLOW_METHODS, ORIGIN},
        HeaderMap, HeaderName, HeaderValue,
    };
    use std::path::PathBuf;

    #[test]
    fn classify_request_redirects_root_to_portal() {
        assert_eq!(
            classify_request("/"),
            RuntimeRoute::Redirect("/portal/".to_string())
        );
    }

    #[test]
    fn classify_request_rewrites_api_routes_to_service_paths() {
        assert_eq!(
            classify_request("/api/admin/users/operators"),
            RuntimeRoute::Proxy {
                upstream: "admin",
                request_path: "/admin/users/operators".to_string(),
            }
        );
        assert_eq!(
            classify_request("/api/portal/dashboard"),
            RuntimeRoute::Proxy {
                upstream: "portal",
                request_path: "/portal/dashboard".to_string(),
            }
        );
        assert_eq!(
            classify_request("/api/v1/models"),
            RuntimeRoute::Proxy {
                upstream: "gateway",
                request_path: "/v1/models".to_string(),
            }
        );
    }

    #[test]
    fn classify_request_identifies_static_site_mounts() {
        assert_eq!(
            classify_request("/portal/assets/index.js"),
            RuntimeRoute::Static {
                site: RuntimeSite::Portal,
                request_path: "/portal/assets/index.js".to_string(),
            }
        );
        assert_eq!(
            classify_request("/admin/#overview"),
            RuntimeRoute::Static {
                site: RuntimeSite::Admin,
                request_path: "/admin/#overview".to_string(),
            }
        );
    }

    #[test]
    fn resolve_static_asset_uses_index_for_route_navigation() {
        let portal_root = PathBuf::from("/tmp/sdkwork-router-runtime-tests").join("portal");
        assert_eq!(
            resolve_static_asset(RuntimeSite::Portal, "/portal/", &portal_root).unwrap(),
            SiteAsset {
                site: RuntimeSite::Portal,
                filesystem_path: portal_root.join("index.html"),
                content_type: "text/html; charset=utf-8".to_string(),
                cache_control: "no-cache".to_string(),
            }
        );
        assert_eq!(
            resolve_static_asset(RuntimeSite::Portal, "/portal/dashboard", &portal_root).unwrap(),
            SiteAsset {
                site: RuntimeSite::Portal,
                filesystem_path: portal_root.join("index.html"),
                content_type: "text/html; charset=utf-8".to_string(),
                cache_control: "no-cache".to_string(),
            }
        );
    }

    #[test]
    fn resolve_static_asset_maps_hashed_assets_and_rejects_traversal() {
        let admin_root = PathBuf::from("/tmp/sdkwork-router-runtime-tests").join("admin");
        assert_eq!(
            resolve_static_asset(
                RuntimeSite::Admin,
                "/admin/assets/index-abc123.js",
                &admin_root
            )
            .unwrap(),
            SiteAsset {
                site: RuntimeSite::Admin,
                filesystem_path: admin_root.join("assets").join("index-abc123.js"),
                content_type: "text/javascript; charset=utf-8".to_string(),
                cache_control: "public, max-age=31536000, immutable".to_string(),
            }
        );
        assert!(
            resolve_static_asset(RuntimeSite::Admin, "/admin/../../secret.txt", &admin_root)
                .is_err()
        );
    }

    #[test]
    fn placeholder_page_mentions_public_api_base() {
        let html = build_site_placeholder_html(
            RuntimeSite::Admin,
            &super::ApiRouterWebServerConfig {
                bind_addr: "127.0.0.1:12103".to_string(),
                gateway_upstream_base_url: "http://127.0.0.1:12100".to_string(),
                admin_upstream_base_url: "http://127.0.0.1:12101".to_string(),
                portal_upstream_base_url: "http://127.0.0.1:12102".to_string(),
                admin_site_dir: None,
                portal_site_dir: None,
                enable_admin: true,
                enable_portal: true,
            },
            None,
        );

        assert!(html.contains("/api/admin"));
        assert!(html.contains("127.0.0.1:12103"));
    }

    #[test]
    fn cors_origin_allows_loopback_and_tauri_origins_only() {
        assert!(is_allowed_origin("http://127.0.0.1:1420"));
        assert!(is_allowed_origin("http://localhost:3001"));
        assert!(is_allowed_origin("https://tauri.localhost"));
        assert!(is_allowed_origin("tauri://localhost"));
        assert!(!is_allowed_origin("https://example.com"));
    }

    #[test]
    fn resolve_cors_origin_rejects_external_origins() {
        let mut headers = HeaderMap::new();
        headers.insert(ORIGIN, HeaderValue::from_static("https://example.com"));
        assert_eq!(resolve_cors_origin(&headers), None);

        headers.insert(ORIGIN, HeaderValue::from_static("http://127.0.0.1:1420"));
        assert_eq!(
            resolve_cors_origin(&headers),
            Some(HeaderValue::from_static("http://127.0.0.1:1420"))
        );
    }

    #[test]
    fn cors_preflight_response_allows_authorization_headers() {
        let mut request_headers = HeaderMap::new();
        request_headers.insert(
            HeaderName::from_static("access-control-request-headers"),
            HeaderValue::from_static("authorization, content-type"),
        );
        let response = cors_preflight_response(&request_headers);

        assert_eq!(response.status(), super::StatusCode::NO_CONTENT);
        assert_eq!(
            response.headers().get(ACCESS_CONTROL_ALLOW_METHODS),
            Some(&HeaderValue::from_static(
                "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD"
            ))
        );
        assert_eq!(
            response.headers().get(ACCESS_CONTROL_ALLOW_HEADERS),
            Some(&HeaderValue::from_static("authorization, content-type"))
        );
    }

    #[test]
    fn append_vary_header_avoids_duplicates() {
        let mut headers = HeaderMap::new();
        append_vary_header(&mut headers, "Origin");
        append_vary_header(&mut headers, "Origin");
        append_vary_header(&mut headers, "Access-Control-Request-Headers");

        assert_eq!(
            headers.get(super::VARY),
            Some(&HeaderValue::from_static(
                "Origin, Access-Control-Request-Headers"
            ))
        );
    }
}
