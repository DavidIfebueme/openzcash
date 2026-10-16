import type {
  CapabilityEvidence, CapabilityKey, MatchReason, WalletEvidenceProfile,
  WalletMatch, WalletPlatform, WalletPlatformEvidence, WalletRequirements,
} from "./types";

export const PLATFORM_LABELS: Record<WalletPlatform, string> = {
  ios: "iPhone / iPad", android: "Android", desktop: "Desktop",
  browser: "Browser extension", web: "Web", hardware: "Hardware device",
};

export const DEFAULT_REQUIREMENTS: WalletRequirements = {
  platform: "any", shielded: "any", hardware: "any", multichain: "any", audit: "any",
};

export function parseWalletRequirements(params: Record<string, string | string[] | undefined>): WalletRequirements {
  const one = (key: string) => typeof params[key] === "string" ? params[key] as string : undefined;
  const platform = one("platform");
  const privacy = one("privacy");
  return {
    platform: platform && Object.hasOwn(PLATFORM_LABELS, platform) ? platform as WalletPlatform : "any",
    shielded: privacy === "send" || privacy === "receive" || privacy === "both" ? privacy : "any",
    hardware: one("hardware") === "required" ? "required" : "any",
    multichain: one("multichain") === "required" ? "required" : "any",
    audit: one("audit") === "required" ? "required" : "any",
  };
}

/** Stable, shareable URL state; no personal data, account, or wallet connection. */
export function walletRequirementsQuery(requirements: WalletRequirements): string {
  const params = new URLSearchParams();
  if (requirements.platform !== "any") params.set("platform", requirements.platform);
  if (requirements.shielded !== "any") params.set("privacy", requirements.shielded);
  if (requirements.hardware !== "any") params.set("hardware", requirements.hardware);
  if (requirements.multichain !== "any") params.set("multichain", requirements.multichain);
  if (requirements.audit !== "any") params.set("audit", requirements.audit);
  return params.toString();
}

const REQUIREMENT_LABELS: Record<CapabilityKey, string> = {
  shieldedSend: "Send shielded ZEC", shieldedReceive: "Receive shielded ZEC",
  hardwareSigning: "Sign with a hardware device", multichain: "Manage assets on multiple blockchains",
  securityAudit: "Public independent audit of this wallet",
};

function unknownPlatform(platform: WalletPlatform): WalletPlatformEvidence {
  const evidence: CapabilityEvidence = {
    status: "unknown", sources: [], checkedAt: null,
    scope: PLATFORM_LABELS[platform],
    note: "This platform has not been confirmed in the evidence record. Check the wallet's official documentation.",
  };
  return { availability: evidence, shieldedSend: evidence, shieldedReceive: evidence,
    hardwareSigning: evidence, multichain: evidence, securityAudit: evidence };
}

export function capabilityReason(requirement: string, evidence: CapabilityEvidence, platform?: WalletPlatform): MatchReason {
  // Defend against incomplete records at runtime too. A bare 'supported' flag cannot produce a match.
  const documented = evidence.sources.length > 0 && !!evidence.checkedAt && !!evidence.scope.trim();
  const state = evidence.status !== "unknown" && !documented ? "unknown" : evidence.status;
  const qualifier = platform ? ` on ${PLATFORM_LABELS[platform]}` : "";
  const outcome = state === "supported" ? "Confirmed" : state === "unsupported" ? "Not supported" : "Not confirmed";
  return {
    requirement, state, platform,
    evidence: state === evidence.status ? evidence : { ...evidence, status: "unknown", note: "The evidence record is incomplete; support cannot be confirmed." },
    message: `${requirement}${qualifier}: ${outcome.toLowerCase()}.`,
  };
}

function statusOf(reasons: MatchReason[]): WalletMatch["status"] {
  if (reasons.some(item => item.state === "unsupported")) return "excluded";
  if (reasons.some(item => item.state === "unknown")) return "unknown";
  return "match";
}

export function matchWallets(profiles: WalletEvidenceProfile[], requirements: WalletRequirements): WalletMatch[] {
  const needed: CapabilityKey[] = [];
  if (requirements.shielded === "send" || requirements.shielded === "both") needed.push("shieldedSend");
  if (requirements.shielded === "receive" || requirements.shielded === "both") needed.push("shieldedReceive");
  if (requirements.hardware === "required") needed.push("hardwareSigning");
  if (requirements.multichain === "required") needed.push("multichain");
  if (requirements.audit === "required") needed.push("securityAudit");
  const rank = { match: 0, unknown: 1, excluded: 2 };

  return profiles.map(profile => {
    const platforms = requirements.platform === "any"
      ? Object.keys(profile.platforms) as WalletPlatform[]
      : [requirements.platform];
    // Each candidate platform must independently satisfy the complete request.
    const candidates = platforms.map(platform => {
      const facts = profile.platforms[platform] ?? unknownPlatform(platform);
      const reasons = [
        capabilityReason("Available to use", profile.availability),
        capabilityReason("Platform available", facts.availability, platform),
        ...needed.map(key => capabilityReason(REQUIREMENT_LABELS[key], facts[key], platform)),
      ];
      return { platform, reasons, status: statusOf(reasons) };
    });
    const best = [...candidates].sort((a, b) => rank[a.status] - rank[b.status])[0];
    const noPlatform: CapabilityEvidence = {
      status: "unknown", sources: [], checkedAt: null, scope: "No reviewed platform",
      note: "No platform-specific capability record has been reviewed for this wallet.",
    };
    const fallbackReasons = [capabilityReason("Available to use", profile.availability), capabilityReason("Platform available", noPlatform)];
    const platformReasons = candidates.filter(item => item.status === "match").map(item => ({
      platform: item.platform,
      reasons: item.reasons,
    }));
    return {
      walletName: profile.walletName,
      status: best?.status ?? statusOf(fallbackReasons),
      platforms: platformReasons.map(item => item.platform),
      platformReasons,
      reasons: best?.reasons ?? fallbackReasons,
    };
  }).sort((a, b) => rank[a.status] - rank[b.status] || a.walletName.localeCompare(b.walletName, "en"));
}

/** Data validation is deliberately separate from factual verification against primary sources. */
export function validateWalletEvidence(profiles: WalletEvidenceProfile[], today = new Date().toISOString().slice(0, 10)): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  function check(evidence: CapabilityEvidence, path: string) {
    if (!["supported", "unsupported", "unknown"].includes(evidence.status)) errors.push(`${path}: invalid support state`);
    if (!evidence.note.trim()) errors.push(`${path}: explanatory note required`);
    if (!evidence.scope.trim()) errors.push(`${path}: scope required`);
    if (evidence.status !== "unknown" && (!evidence.sources.length || !evidence.checkedAt)) errors.push(`${path}: source and checked date required`);
    if (evidence.checkedAt && (!/^\d{4}-\d{2}-\d{2}$/.test(evidence.checkedAt) || !Number.isFinite(Date.parse(`${evidence.checkedAt}T00:00:00Z`)) || new Date(`${evidence.checkedAt}T00:00:00Z`).toISOString().slice(0, 10) !== evidence.checkedAt || evidence.checkedAt > today)) errors.push(`${path}: invalid or future checked date`);
    for (const source of evidence.sources) {
      try {
        const url = new URL(source.url);
        if (url.protocol !== "https:" || url.username || url.password || !source.title.trim()) errors.push(`${path}: invalid source`);
      } catch { errors.push(`${path}: invalid source URL`); }
    }
  }
  for (const profile of profiles) {
    if (!profile.walletName.trim() || seen.has(profile.walletName)) errors.push(`${profile.walletName}: missing or duplicate wallet name`);
    seen.add(profile.walletName);
    check(profile.availability, `${profile.walletName}.availability`);
    if (!Object.keys(profile.platforms).length) errors.push(`${profile.walletName}: at least one reviewed platform required`);
    for (const [platform, facts] of Object.entries(profile.platforms)) {
      if (!Object.hasOwn(PLATFORM_LABELS, platform)) errors.push(`${profile.walletName}: invalid platform ${platform}`);
      for (const key of ["availability", "shieldedSend", "shieldedReceive", "hardwareSigning", "multichain", "securityAudit"] as const) {
        if (!facts[key]) errors.push(`${profile.walletName}.${platform}.${key}: record required`);
        else check(facts[key], `${profile.walletName}.${platform}.${key}`);
      }
    }
  }
  return errors;
}
