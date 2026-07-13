import { AppError } from "@wp-agent-studio/shared";

const allowed = [
  /^wp\s+(theme|plugin)\s+(install|activate|deactivate)\s+[a-z0-9._/-]+(?:\s+--force)?$/,
  /^wp\s+db\s+export\s+[a-zA-Z0-9._/-]+$/,
  /^wp\s+core\s+(is-installed|install)(?:\s+--[a-z-]+=[^\s;&|]+)*$/,
  /^wp\s+option\s+(get|update)\s+[a-zA-Z0-9_-]+(?:\s+[^;&|]+)?$/
];

export function assertAllowedWpCliCommand(command: string): string {
  const normalized = command.trim().replace(/\s+/g, " ");
  if (/[;&|`$><\r\n]/.test(normalized) || !allowed.some((pattern) => pattern.test(normalized))) {
    throw new AppError("COMMAND_NOT_ALLOWED", "La commande WP-CLI n’appartient pas à la liste autorisée", 403);
  }
  return normalized;
}
