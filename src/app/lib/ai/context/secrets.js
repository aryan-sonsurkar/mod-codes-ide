const SECRET_BASENAMES = new Set([
  ".env",
  ".env.example",
  ".env.local",
  ".env.development",
  ".env.production",
  ".npmrc",
  ".pypirc",
  ".netrc",
  "credentials",
  "credentials.json",
  "secrets",
  "secrets.json",
  ".htpasswd",
  "id_rsa",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
  ".gitconfig",
  ".git-credentials",
]);

const SECRET_PATTERNS = [
  /\.env(?:\.\w+)*$/i,
  /\.pem$/i,
  /\.key$/i,
  /\.p12$/i,
  /\.pfx$/i,
  /\.keystore$/i,
  /\.jks$/i,
  /^(?:credentials|secrets)(?:\.(?:txt|json|yaml|yml|toml|ini|cfg))?$/i,
  /id_(?:rsa|dsa|ecdsa|ed25519)(?:\.pub)?$/i,
  /\.git-credentials$/i,
];

export function isSecretPath(path) {
  if (typeof path !== "string" || path.length === 0) {
    return false;
  }

  const basename = path.split("/").pop() || "";
  if (SECRET_BASENAMES.has(basename)) {
    return true;
  }

  return SECRET_PATTERNS.some((pattern) => pattern.test(basename));
}

export function excludeSecretPaths(paths) {
  return paths.filter((path) => !isSecretPath(path));
}