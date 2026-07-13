import { isIP } from "node:net";
import { resolve4, resolve6 } from "node:dns/promises";
import { Agent, type Dispatcher } from "undici";
import { AppError } from "@wp-agent-studio/shared";

type FetchInit = RequestInit & { dispatcher?: Dispatcher };

const blockedV4 = [/^0\./, /^10\./, /^127\./, /^169\.254\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^100\.(6[4-9]|[78]\d|9\d|1[01]\d|12[0-7])\./, /^198\.18\./, /^224\./, /^255\./];
const blockedV6 = [/^::1$/, /^::$/, /^fc/i, /^fd/i, /^fe8/i, /^fe9/i, /^fea/i, /^feb/i, /^ff/i];
export const isBlockedIp = (ip: string): boolean => isIP(ip) === 4 ? blockedV4.some((rule) => rule.test(ip)) : isIP(ip) === 6 ? blockedV6.some((rule) => rule.test(ip)) || ip.toLowerCase().startsWith("::ffff:") && isBlockedIp(ip.slice(7)) : true;

export async function validateRemoteUrl(raw: string, options: { allowPrivate?: boolean; production?: boolean } = {}): Promise<{ url: URL; addresses: string[] }> {
  let url: URL;
  try { url = new URL(raw); } catch { throw new AppError("INVALID_URL", "URL WordPress invalide"); }
  if (!(["http:", "https:"] as string[]).includes(url.protocol)) throw new AppError("INVALID_PROTOCOL", "Seuls HTTP et HTTPS sont autorisés");
  if (options.production && url.protocol !== "https:") throw new AppError("HTTPS_REQUIRED", "HTTPS est obligatoire en production");
  if (url.username || url.password) throw new AppError("URL_CREDENTIALS_FORBIDDEN", "Les identifiants ne doivent pas figurer dans l’URL");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(hostname) ? [hostname] : [...await resolve4(hostname).catch(() => []), ...await resolve6(hostname).catch(() => [])];
  if (addresses.length === 0) throw new AppError("DNS_RESOLUTION_FAILED", "La destination WordPress ne peut pas être résolue");
  if (!options.allowPrivate && addresses.some(isBlockedIp)) throw new AppError("PRIVATE_NETWORK_BLOCKED", "Les réseaux privés, localhost et métadonnées cloud sont bloqués");
  return { url, addresses };
}

// Épingle la connexion TCP/TLS sur l'IP déjà validée : sans cela, fetch() referait sa
// propre résolution DNS au moment de se connecter, et un domaine hostile changeant de
// réponse entre la validation et l'appel (DNS rebinding) contournerait le filtrage.
function pinnedDispatcher(addresses: string[]): Agent {
  const address = addresses[0];
  if (!address) throw new AppError("DNS_RESOLUTION_FAILED", "La destination WordPress ne peut pas être résolue");
  const family = isIP(address) === 6 ? 6 : 4;
  return new Agent({ connect: { lookup: (_hostname, _options, callback) => callback(null, address, family) } });
}

export async function safeFetch(raw: string, init: RequestInit = {}, options: { allowPrivate?: boolean; production?: boolean; maxRedirects?: number; maxBytes?: number; timeoutMs?: number } = {}): Promise<Response> {
  const maxRedirects = options.maxRedirects ?? 3;
  const maxBytes = options.maxBytes ?? 5_000_000;
  let { url, addresses } = await validateRemoteUrl(raw, options);
  for (let redirect = 0; redirect <= maxRedirects; redirect++) {
    const dispatcher = pinnedDispatcher(addresses);
    let response: Response;
    try {
      const requestInit: FetchInit = { ...init, redirect: "manual", signal: AbortSignal.timeout(options.timeoutMs ?? 10_000), dispatcher };
      response = await fetch(url, requestInit);
    } finally {
      void dispatcher.close();
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirect === maxRedirects) throw new AppError("REDIRECT_BLOCKED", "Trop de redirections WordPress");
      ({ url, addresses } = await validateRemoteUrl(new URL(location, url).toString(), options));
      continue;
    }
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > maxBytes) throw new AppError("RESPONSE_TOO_LARGE", "La réponse WordPress dépasse la taille autorisée");
    return response;
  }
  throw new AppError("REDIRECT_BLOCKED", "Redirection refusée");
}
