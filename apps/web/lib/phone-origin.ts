const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function getPhoneReachableOrigin(pageOrigin: string): string {
  const origin = new URL(pageOrigin);
  if (!LOOPBACK_HOSTS.has(origin.hostname)) return origin.origin;

  const lanHost = process.env.NEXT_PUBLIC_LAN_HOST || '192.168.1.12';
  origin.hostname = lanHost;
  return origin.origin;
}
