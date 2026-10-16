/** Evidence is reviewed per platform. A catalog badge is not evidence for a capability. */
export type WalletPlatform = "ios" | "android" | "desktop" | "browser" | "web" | "hardware";
export type CapabilityKey = "shieldedSend" | "shieldedReceive" | "hardwareSigning" | "multichain" | "securityAudit";
export type SupportState = "supported" | "unsupported" | "unknown";

export interface CapabilityEvidence {
  status: SupportState;
  sources: { url: string; title: string }[];
  /** The date the cited material was checked, not an automated freshness claim. */
  checkedAt: string | null;
  /** Platform, release/channel and integration limits of this specific fact. */
  scope: string;
  note: string;
}

export interface WalletPlatformEvidence {
  availability: CapabilityEvidence;
  shieldedSend: CapabilityEvidence;
  shieldedReceive: CapabilityEvidence;
  hardwareSigning: CapabilityEvidence;
  multichain: CapabilityEvidence;
  /** A public independent report, scoped to this product and platform; not a safety rating. */
  securityAudit: CapabilityEvidence;
}

export interface WalletEvidenceProfile {
  walletName: string;
  /** Public usability/release status. Announced features do not establish availability. */
  availability: CapabilityEvidence;
  platforms: Partial<Record<WalletPlatform, WalletPlatformEvidence>>;
}

export interface WalletRequirements {
  platform: WalletPlatform | "any";
  shielded: "any" | "send" | "receive" | "both";
  hardware: "any" | "required";
  /** Manage native assets on multiple chains; swaps alone do not satisfy this. */
  multichain: "any" | "required";
  audit: "any" | "required";
}

export interface MatchReason {
  requirement: string;
  state: SupportState;
  message: string;
  evidence: CapabilityEvidence;
  platform?: WalletPlatform;
}

export interface WalletMatch {
  walletName: string;
  status: "match" | "unknown" | "excluded";
  /** Only platforms satisfying every hard requirement appear here. */
  platforms: WalletPlatform[];
  /** Evidence for each independently compatible platform; never borrow another platform's sources. */
  platformReasons: { platform: WalletPlatform; reasons: MatchReason[] }[];
  /** One representative assessment for unconfirmed or excluded results. */
  reasons: MatchReason[];
}
