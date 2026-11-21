const branches = ['haim', 'yehuda', 'medina', 'keha', 'extended', 'shlomo', 'zechariah', 'zechariah-tzadok', 'kehat'];

// Activate only after the dedicated Workers have been deployed and verified.
// These public origins are configuration, not credentials.
export function familyAppOrigins(env = {}) {
  let configured = env.FAMILY_APP_ORIGINS ?? verifiedOrigins;
  if (typeof configured === 'string') {
    try { configured = JSON.parse(configured); } catch { return {}; }
  }
  const origins = {};
  for (const branch of branches) {
    try {
      const url = new URL(configured?.[branch]);
      if (url.protocol === 'https:' && !url.username && !url.password && url.href === url.origin + '/') origins[branch] = url.origin;
    } catch { /* Leave undeployed families on their existing working URL. */ }
  }
  return origins;
}
import verifiedOrigins from './family-app-origins.generated.mjs';

