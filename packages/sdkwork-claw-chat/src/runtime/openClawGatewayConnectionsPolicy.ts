function normalizePathname(pathname: string) {
  return pathname.split(/[?#]/, 1)[0] || pathname;
}

export function shouldWarmOpenClawGatewayConnections(pathname: string) {
  return normalizePathname(pathname) === '/chat';
}
