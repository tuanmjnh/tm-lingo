import dns from 'node:dns/promises';
import net from 'node:net';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
  'instance-data',
]);

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // Link-local & cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // Carrier-grade NAT
  if (a === 198 && (b === 18 || b === 19)) return true; // Benchmark
  if (a >= 224) return true; // Multicast & reserved
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::' || lower === '::1') return true;
  if (lower.startsWith('::ffff:')) {
    const mappedV4 = lower.slice(7);
    if (net.isIP(mappedV4) === 4) {
      return isPrivateIpv4(mappedV4);
    }
  }
  // fc00::/7 (unique local), fe80::/10 (link-local), ff00::/8 (multicast)
  if (
    lower.startsWith('fc') ||
    lower.startsWith('fd') ||
    lower.startsWith('fe8') ||
    lower.startsWith('fe9') ||
    lower.startsWith('fea') ||
    lower.startsWith('feb') ||
    lower.startsWith('ff')
  ) {
    return true;
  }
  return false;
}

function isBlockedIp(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family === 6) return isPrivateIpv6(address);
  return true;
}

export function validateExternalUrlSyntax(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error('URL không hợp lệ.');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Chỉ chấp nhận giao thức HTTP hoặc HTTPS.');
  }

  if (parsed.username || parsed.password) {
    throw new Error('URL không được chứa thông tin xác thực nhúng.');
  }

  const host = parsed.hostname.toLowerCase();
  if (
    !host ||
    BLOCKED_HOSTNAMES.has(host) ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.arpa')
  ) {
    throw new Error('Tên miền nội bộ không được phép truy cập.');
  }

  const ipVersion = net.isIP(host.replace(/^\[|\]$/g, ''));
  if (ipVersion !== 0 && isBlockedIp(host.replace(/^\[|\]$/g, ''))) {
    throw new Error('Địa chỉ IP nội bộ không được phép truy cập.');
  }

  return parsed;
}

export async function assertSafeExternalUrl(
  rawUrl: string,
  options?: { allowedHostSuffixes?: string[] }
): Promise<URL> {
  const parsed = validateExternalUrlSyntax(rawUrl);
  const host = parsed.hostname.toLowerCase();

  if (options?.allowedHostSuffixes && options.allowedHostSuffixes.length > 0) {
    const matched = options.allowedHostSuffixes.some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`)
    );
    if (!matched) {
      throw new Error('Địa chỉ nguồn không nằm trong danh sách tên miền được phép.');
    }
  }

  // Resolve DNS to block DNS rebinding to private/metadata IPs
  if (net.isIP(host.replace(/^\[|\]$/g, '')) === 0) {
    const records = await dns.lookup(host, { all: true }).catch(() => []);
    if (records.length === 0) {
      throw new Error('Không thể phân giải tên miền nguồn truyện.');
    }
    for (const rec of records) {
      if (isBlockedIp(rec.address)) {
        throw new Error('Tên miền trỏ tới địa chỉ mạng nội bộ không được phép.');
      }
    }
  }

  return parsed;
}

export function sanitizeExternalMediaUrl(rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    const parsed = validateExternalUrlSyntax(trimmed);
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function safeExternalFetch(
  rawUrl: string,
  options?: {
    timeoutMs?: number;
    maxBytes?: number;
    accept?: string;
    allowedHostSuffixes?: string[];
  }
): Promise<{ text: string; contentType: string; finalUrl: string }> {
  const timeoutMs = options?.timeoutMs ?? 9000;
  const maxBytes = options?.maxBytes ?? 1_500_000;
  const maxRedirects = 3;

  let currentUrl = rawUrl;
  let response: Response | null = null;

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const validated = await assertSafeExternalUrl(currentUrl, {
      allowedHostSuffixes: options?.allowedHostSuffixes,
    });

    const res = await fetch(validated.toString(), {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': 'TM-Lingo-StoryCatalog/1.0 (+educational-reader)',
        Accept: options?.accept || 'application/json, application/rss+xml, application/xml, text/xml, text/plain;q=0.9, */*;q=0.5',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location || hop === maxRedirects) {
        throw new Error('Nguồn truyện chuyển hướng quá nhiều lần.');
      }
      currentUrl = new URL(location, validated.toString()).toString();
      continue;
    }

    response = res;
    currentUrl = validated.toString();
    break;
  }

  if (!response) {
    throw new Error('Không thể kết nối tới nguồn truyện.');
  }

  if (!response.ok) {
    throw new Error(`Nguồn truyện phản hồi mã lỗi ${response.status}.`);
  }

  const contentLength = Number(response.headers.get('content-length') || '0');
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error('Nội dung từ nguồn truyện vượt quá dung lượng cho phép.');
  }

  // Stream with strict byte cap
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    return {
      text: text.slice(0, maxBytes),
      contentType: response.headers.get('content-type') || 'text/plain',
      finalUrl: currentUrl,
    };
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        const remaining = maxBytes - (totalBytes - value.byteLength);
        if (remaining > 0) {
          chunks.push(value.subarray(0, remaining));
        }
        await reader.cancel().catch(() => undefined);
        break;
      }
      chunks.push(value);
    }
  }

  const merged = new Uint8Array(Math.min(totalBytes, maxBytes));
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const decoder = new TextDecoder('utf-8', { fatal: false });
  return {
    text: decoder.decode(merged),
    contentType: response.headers.get('content-type') || 'text/plain',
    finalUrl: currentUrl,
  };
}
