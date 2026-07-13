export type RuntimeService = "web" | "worker" | "all";

export type RuntimeConfigurationResult = {
  issues: string[];
  warnings: string[];
};

type RuntimeConfigurationOptions = {
  service?: RuntimeService;
  production?: boolean;
};

const insecureAuthSecrets = new Set([
  "local-development-secret-change-me-32",
  "replace-with-at-least-32-random-characters"
]);

function isCanonicalBase64(value: string, byteLength: number) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
  const decoded = Buffer.from(value, "base64");
  return decoded.length === byteLength && decoded.toString("base64") === value;
}

function validateUrl(
  env: NodeJS.ProcessEnv,
  key: string,
  protocols: readonly string[],
  issues: string[]
) {
  const value = env[key];
  if (!value) {
    issues.push(`${key} est requis`);
    return undefined;
  }
  try {
    const parsed = new URL(value);
    if (!protocols.includes(parsed.protocol)) issues.push(`${key} utilise un protocole non autorisé`);
    return parsed;
  } catch {
    issues.push(`${key} doit être une URL valide`);
    return undefined;
  }
}

export function validateRuntimeConfiguration(
  env: NodeJS.ProcessEnv = process.env,
  options: RuntimeConfigurationOptions = {}
): RuntimeConfigurationResult {
  const service = options.service ?? "all";
  const production = options.production ?? env.NODE_ENV === "production";
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!production) return { issues, warnings };

  validateUrl(env, "DATABASE_URL", ["postgres:", "postgresql:"], issues);
  const redisUrl = validateUrl(env, "REDIS_URL", ["redis:", "rediss:"], issues);

  if (!env.ARTIFACTS_DIR?.trim()) issues.push("ARTIFACTS_DIR est requis");

  const encryptionKey = env.ENCRYPTION_KEY?.trim();
  if (!encryptionKey) issues.push("ENCRYPTION_KEY est requis");
  else if (!isCanonicalBase64(encryptionKey, 32)) issues.push("ENCRYPTION_KEY doit être une valeur base64 canonique de 32 octets");

  if (service === "web" || service === "all") {
    const appUrl = validateUrl(env, "APP_URL", ["https:"], issues);
    if (appUrl?.username || appUrl?.password) issues.push("APP_URL ne doit pas contenir d’identifiants");

    const authSecret = env.AUTH_SECRET ?? "";
    if (authSecret.length < 32) issues.push("AUTH_SECRET doit contenir au moins 32 caractères");
    else if (insecureAuthSecrets.has(authSecret)) issues.push("AUTH_SECRET utilise une valeur d’exemple interdite");
  }

  const agentMode = env.AGENT_MODE ?? "mock";
  if (agentMode !== "mock" && agentMode !== "real") issues.push("AGENT_MODE doit valoir mock ou real");
  if (agentMode === "mock") warnings.push("AGENT_MODE=mock est actif en production");
  if (agentMode === "real") {
    for (const key of ["ANTHROPIC_API_KEY", "CLAUDE_MODEL", "CODEX_MODEL"] as const) {
      if (!env[key]?.trim()) issues.push(`${key} est requis quand AGENT_MODE=real`);
    }
    if (!env.OPENAI_API_KEY?.trim() && !env.CODEX_HOME?.trim()) {
      issues.push("OPENAI_API_KEY ou CODEX_HOME est requis quand AGENT_MODE=real");
    }
  }

  if (redisUrl?.protocol === "redis:" && !["localhost", "127.0.0.1", "::1"].includes(redisUrl.hostname)) {
    warnings.push("REDIS_URL distant devrait utiliser TLS avec rediss://");
  }
  if (env.ENABLE_PRIVATE_NETWORK_TARGETS === "true") warnings.push("Les cibles réseau privées sont activées");
  if (env.ENABLE_REMOTE_DEPLOYMENT === "true") warnings.push("Le déploiement distant est activé");

  return { issues, warnings };
}

export function assertRuntimeConfiguration(
  env: NodeJS.ProcessEnv = process.env,
  options: RuntimeConfigurationOptions = {}
) {
  const result = validateRuntimeConfiguration(env, options);
  if (result.issues.length > 0) {
    throw new Error(`Configuration de production invalide : ${result.issues.join(" ; ")}`);
  }
  return result;
}
