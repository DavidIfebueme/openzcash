import type { CapabilityEvidence, CapabilityKey, WalletEvidenceProfile, WalletPlatformEvidence } from "./types";

// Manual source review, not a transaction test or a claim that upstream pages stay current.
const CHECKED_AT = "2026-10-15";
type Source = CapabilityEvidence["sources"][number];
type Fact = Omit<CapabilityEvidence, "scope"> & { scope?: string };
const source = (url: string, title: string): Source => ({ url, title });
const yes = (sources: Source[], note: string): Fact => ({ status: "supported", sources, checkedAt: CHECKED_AT, note });
const no = (sources: Source[], note: string): Fact => ({ status: "unsupported", sources, checkedAt: CHECKED_AT, note });
const unknown = (note: string, sources: Source[] = []): Fact => ({
  status: "unknown", sources, checkedAt: sources.length ? CHECKED_AT : null, note,
});
const scoped = (scope: string, fact: Fact): CapabilityEvidence => ({ ...fact, scope: fact.scope ?? scope });
function platform(scope: string, availability: Fact, facts: Partial<Record<CapabilityKey, Fact>> = {}): WalletPlatformEvidence {
  return {
    availability: scoped(scope, availability),
    shieldedSend: scoped(scope, facts.shieldedSend ?? unknown("Shielded sending has not been verified for this platform and channel.")),
    shieldedReceive: scoped(scope, facts.shieldedReceive ?? unknown("Shielded receiving has not been verified for this platform and channel.")),
    hardwareSigning: scoped(scope, facts.hardwareSigning ?? unknown("A working dedicated hardware signer for Zcash has not been verified for this platform.")),
    multichain: scoped(scope, facts.multichain ?? unknown("Native assets on other blockchains have not been verified. Swaps alone do not establish this capability.")),
    securityAudit: scoped(scope, facts.securityAudit ?? unknown("A public independent security audit report covering this wallet product and platform was not verified. This does not establish that no audit exists.")),
  };
}

const s = {
  zodl: source("https://zodl.com/", "Zodl: features and mobile downloads"),
  zodlAndroid: source("https://github.com/zodl-inc/zodl-android", "Zodl Android: official distribution channels"),
  zodlIos: source("https://apps.apple.com/us/app/zodl-zcash-wallet/id1672392439", "Zodl: publisher App Store listing"),
  zodlSend: source("https://support.zodl.com/article/41-using-the-zcash-memo-field", "Zodl: sending to shielded addresses"),
  zodlReceive: source("https://support.zodl.com/article/71-why-does-receiving-address-change", "Zodl: shielded receiving addresses"),
  keystoneZodl: source("https://support.zodl.com/article/33-connecting-a-keystone-wallet", "Zodl: connecting Keystone 3 Pro"),
  keystoneMatrix: source("https://www.keyst.one/supported-wallets-and-assets", "Keystone: wallet, platform and firmware compatibility"),
  keystoneFirmware: source("https://www.keyst.one/firmware", "Keystone: firmware releases and supported assets"),
  zingo: source("https://zingolabs.org/zingo/", "Zingo: shielded sending and receiving on mobile"),
  zingoDownload: source("https://zingolabs.org/zingo/download/", "Zingo: stable and beta downloads"),
  ywallet: source("https://ywallet.app/", "Ywallet: Zcash and Ycash"),
  ywalletInstall: source("https://ywallet.app/installation", "Ywallet: installation by operating system"),
  ywalletSend: source("https://ywallet.app/transacting/send", "Ywallet: sending and transaction pools"),
  ywalletReceive: source("https://ywallet.app/transacting/receive", "Ywallet: receiving addresses"),
  ywalletCold: source("https://ywallet.app/coldwallet", "Ywallet: two-device cold wallet workflow"),
  zkoolInstall: source("https://hhanh00.github.io/zkool2/guide/start.html", "zkool: installation and supported platforms"),
  zkoolRepo: source("https://github.com/hhanh00/zkool2", "zkool: official repository and Linux packages"),
  zkoolSend: source("https://hhanh00.github.io/zkool2/guide/pay.html", "zkool: shielded payments and pool selection"),
  zkoolReceive: source("https://hhanh00.github.io/zkool2/guide/addresses.html", "zkool: shielded receiving addresses"),
  zkoolLedger: source("https://hhanh00.github.io/zkool2/recipe/ledger", "zkool: Ledger integration and NU6.1 signing warning"),
  brave: source("https://brave.com/wallet/", "Brave Wallet: assets, downloads and platform limits"),
  braveZcash: source("https://brave.com/blog/shielded-zcash/", "Brave: desktop shielded Zcash release"),
  braveSupport: source("https://support.brave.app/hc/en-us/articles/26390040705165-Zcash-and-Address-Types", "Brave support: Zcash address types and mobile limitation"),
  noirInstall: source("https://docs.zknoir.com/wallet-guide/install-and-setup/", "Noir: Chrome installation and mainnet setup"),
  noirTransactions: source("https://docs.zknoir.com/wallet-guide/send-and-receive/", "Noir: shielded sending and receiving"),
  noirHardware: source("https://docs.zknoir.com/wallet-guide/security/", "Noir: hardware transaction limits"),
  noirOverview: source("https://docs.zknoir.com/overview/", "Noir: current wallet features"),
  snap: source("https://snaps.metamask.io/snap/npm/chainsafe/webzjs-zcash-snap/", "MetaMask directory: ChainSafe Zcash Snap"),
  snapLaunch: source("https://blog.chainsafe.io/zcash-in-the-browser-bringing-shielded-zec-to-metamask/", "ChainSafe: Zcash Snap release announcement"),
  snapIssue: source("https://github.com/ChainSafe/WebZjs/issues/166", "WebZjs issue 166: unresolved user report of NU6.1 broadcast failures"),
  snapIssue167: source("https://github.com/ChainSafe/WebZjs/issues/167", "WebZjs issue 167: later user report of Snap 0.3.0 broadcast and recovery failures"),
  snapIssue168: source("https://github.com/ChainSafe/WebZjs/issues/168", "WebZjs issue 168: user report that the WebWallet companion is unavailable"),
  vizor: source("https://vizor.cash/", "Vizor: platform downloads, shielded transfers and Keystone"),
  cake: source("https://cakewallet.com/", "Cake Wallet: native assets and platform downloads"),
  cakeZcash: source("https://docs.cakewallet.com/cryptos/zcash", "Cake Wallet: Zcash addresses, shielding and sending"),
  edge: source("https://edge.app/", "Edge: native assets in one app"),
  edgeInstall: source("https://edge.app/get-started/", "Edge: iOS and Android installation"),
  edgeZcash: source("https://edge.app/blog/company-news/edge-adds-support-for-zcash/", "Edge: shielded Zcash on iOS and Android"),
  edgeSend: source("https://edge.app/blog/company-news/send-private-zcash-payments-using-names-not-addresses/", "Edge: current shielded Zcash payments"),
  unstoppable: source("https://unstoppable.money/", "Unstoppable: native multichain wallet and releases"),
  unstoppableIos: source("https://apps.apple.com/us/app/unstoppable-crypto-wallet/id1447619907", "Unstoppable: publisher iOS feature and version listing"),
  unstoppableAndroid: source("https://play.google.com/store/apps/details?id=io.horizontalsystems.bankwallet", "Unstoppable: publisher Android feature listing"),
  unstoppableIosReleases: source("https://github.com/horizontalsystems/unstoppable-wallet-ios/releases", "Unstoppable iOS: shielded address and transaction release notes"),
  unstoppableAndroidReleases: source("https://github.com/horizontalsystems/unstoppable-wallet-android/releases", "Unstoppable Android: Ironwood and current release notes"),
  zipher: source("https://zipher.to/", "Zipher: mobile beta and separate CLI alpha downloads"),
  zipherRepo: source("https://github.com/atmospherelabs-dev/zipher-app", "Zipher: mobile beta scope and shielded sending"),
  zstash: source("https://zstash.app/", "zSTASH: coming-soon desktop wallet"),
  zapp: source("https://www.justzappit.xyz/", "Zapp: Android, iOS beta and shielded Zcash payments"),
  gem: source("https://gemwallet.com/", "Gem Wallet: mobile platforms and native blockchains"),
  gemZcash: source("https://docs.gemwallet.com/blockchains/zcash/", "Gem Wallet: transparent-only Zcash support"),
  ledger: source("https://www.ledger.com/coin/wallet/zcash", "Ledger: Zcash hardware products and wallet"),
  ledgerSign: source("https://support.ledger.com/article/4404382228753-zd?redirect=false", "Ledger: device approval and signing"),
  ledgerAssets: source("https://shop.ledger.com/pages/ledger-wallet", "Ledger Wallet: native assets across blockchains"),
  trezor: source("https://trezor.io/coins/wallet/zcash", "Trezor: supported devices and transparent-only Zcash"),
  trezorAssets: source("https://trezor.io/coins", "Trezor: supported native coins and wallet integrations"),
  ywalletAudit: source("https://defuse.ca/zecsec/audits/YWalletAuditReport-FINALv3.pdf", "ZecSec: Ywallet security and privacy audit, January 2023"),
  braveAudit: source("https://doyensec.com/resources/Doyensec_BraveWallet_TestingReport_Q32022_AfterRetest.pdf", "Doyensec: Brave Wallet desktop and mobile audit with retest, November 2022"),
  snapAudit: source("https://hacken.io/audits/zcash/dapp-zcash-snap-may2025/", "Hacken: ChainSafe WebZjs Zcash Snap audit, May 2025"),
  unstoppableAudit: source("https://hackmd.io/isboOL-tSK6QNJvimum5Jg", "CertiK: Unstoppable Mobile Wallet pentest report with retest, February 2021"),
  unstoppableAuditNotice: source("https://www.certik.com/zh-CN/blog/unstoppablemobilewalletapppassesthroughformalvaptwithcertik", "CertiK: publication of Unstoppable mobile audit"),
  gemAudit: source("https://static.gemwallet.com/audits/Gem-Wallet-CertiK-Security-Audit-April-2026.pdf", "CertiK: Gem Wallet iOS and Android security assessment, April 2026"),
  keystoneAudit: source("https://leastauthority.com/wp-content/uploads/2025/03/Least-Authority-ZCG-Keystone-Hardware-Wallet-Final-Audit-Report.pdf", "Least Authority: Keystone Zcash integration audit, March 2025"),
  ledgerLegacyAudit: source("https://defuse.ca/zecsec/audits/zcash-ledger-audit-report-v2.pdf", "ZecSec: legacy zcash-ledger app v1.0.1 audit, September 2023"),
};

const zodlAvailable = yes([s.zodl, s.zodlIos, s.zodlAndroid], "Public mobile app downloads are provided by the publisher.");
const zodlFacts = {
  shieldedSend: yes([s.zodlSend], "Sends ZEC to shielded addresses, with optional encrypted memos."),
  shieldedReceive: yes([s.zodlReceive], "The Receive screen provides rotating shielded addresses."),
  hardwareSigning: yes([s.keystoneZodl, s.keystoneMatrix], "Keystone 3 Pro signs ZEC offline; use current Cypherpunk firmware. Both mobile platforms are listed."),
  multichain: unknown("CrossPay and swaps convert ZEC to other assets; native multichain holdings were not established.", [s.zodl]),
};
const zingoAvailable = yes([s.zingoDownload], "The publisher provides stable mobile downloads, with beta channels listed separately.");
const zingoFacts = {
  shieldedSend: yes([s.zingo], "The mobile wallet explicitly supports shielded sending."),
  shieldedReceive: yes([s.zingo], "The mobile wallet explicitly supports shielded receiving."),
};
const ywalletAvailable = yes([s.ywalletInstall], "Installation instructions provide public builds for this operating system.");
const ywalletFacts = {
  shieldedSend: yes([s.ywalletSend], "The send workflow supports shielded recipients and selectable input pools."),
  shieldedReceive: yes([s.ywalletReceive], "The receive workflow offers unified and Sapling addresses."),
  hardwareSigning: unknown("The documented cold wallet uses a second device running Ywallet; dedicated hardware signer support was not established.", [s.ywalletCold]),
  multichain: yes([s.ywallet], "Manages both Zcash and Ycash native funds."),
  securityAudit: { ...yes([s.ywalletAudit], "ZecSec independently reviewed Ywallet's mobile code and published the final report in January 2023. The reviewed commits precede current 1.15.3; current builds were not audited by this report."), scope: "iOS / Android Ywallet code at the 2022 commits in the ZecSec report; not current 1.15.3" },
};
const ywalletDesktopFacts = {
  ...ywalletFacts,
  securityAudit: { ...unknown("The public ZecSec report describes the 2022 mobile Ywallet app. It does not establish an independent review of the current desktop release.", [s.ywalletAudit]), scope: "Windows, macOS and Linux Ywallet 1.15.3; historical report is mobile-focused" },
};
const zkoolAvailable = yes([s.zkoolInstall, s.zkoolRepo], "The publisher documents mobile stores and desktop builds; store versions can lag GitHub releases.");
const zkoolFacts = {
  shieldedSend: yes([s.zkoolSend], "Software accounts can send to shielded recipients and select shielded input pools."),
  shieldedReceive: yes([s.zkoolReceive], "Software accounts expose shielded receiving addresses."),
  hardwareSigning: unknown("The Ledger recipe warns shielded signing is broken after NU6.1; no working current dedicated signer was verified.", [s.zkoolLedger]),
};
const braveAvailable = yes([s.braveZcash, s.braveSupport], "Zcash is documented in the public desktop browser wallet.");
const braveMobile = no([s.braveSupport, s.braveZcash], "The reviewed Zcash support documentation excludes Android and iOS. General mobile wallet availability does not establish Zcash availability.");
const braveMultichain = yes([s.brave], "The wallet stores and sends native assets on Ethereum and Solana, among other chains.");
const braveAudit = { ...unknown("Doyensec audited Brave Wallet desktop, Android and iOS with a November 2022 retest. This predates the Zcash integration in Brave 1.77; no independent report covering a Zcash-capable release was verified.", [s.braveAudit]), scope: "Brave Wallet 2022 development builds: brave-core 52aa957, brave-ios d30d8a7; before Zcash integration" };
const noirAvailable = yes([s.noirInstall], "The publisher documents a public Chrome Web Store mainnet extension.");
const snapUncertain = unknown("A published Snap exists, but open reports of rejected NU6.1 transactions and an unavailable WebWallet companion prevent confirming current usability. These user reports are not a maintainer-confirmed diagnosis.", [s.snap, s.snapIssue, s.snapIssue167, s.snapIssue168]);
const vizorAvailable = yes([s.vizor], "The publisher provides downloads for this platform.");
const vizorFacts = {
  shieldedSend: yes([s.vizor], "The wallet documents shielded ZEC sending."),
  shieldedReceive: yes([s.vizor], "The wallet documents shielded ZEC receiving."),
  hardwareSigning: yes([s.keystoneMatrix, s.keystoneFirmware], "Keystone 3 Pro with Cypherpunk firmware is listed for Vizor on desktop, iOS and Android."),
  multichain: unknown("The documented cross-chain feature is swaps; holding native assets on other chains was not established.", [s.vizor]),
};
const cakeAvailable = yes([s.cake], "The publisher provides a public download for this platform.");
const cakeMobileFacts = {
  shieldedSend: yes([s.cakeZcash], "Zcash has shielded sending and automatic shielding of eligible transparent funds."),
  shieldedReceive: yes([s.cakeZcash], "The Receive screen offers shielded Ironwood, unified and legacy Sapling addresses."),
  multichain: yes([s.cake, s.cakeZcash], "Separate native wallets include ZEC, BTC, XMR and ETH; Zcash can share a wallet group."),
};
const edgeAvailable = yes([s.edgeInstall], "Public iOS and Android installation is documented.");
const edgeFacts = {
  shieldedSend: yes([s.edgeZcash, s.edgeSend], "Shielded Zcash payments are documented for the mobile app."),
  shieldedReceive: yes([s.edgeZcash], "The publisher documents full shielded Zcash and shielded receiving addresses on both mobile platforms."),
  multichain: yes([s.edge], "The app manages native BTC, ETH, ZEC and other assets."),
};
const unstoppableAudit = { ...unknown("CertiK reviewed both mobile codebases at v0.17.1, then retested findings in February 2021. The review predates shielded Zcash support; no independent report covering a Zcash-capable release was verified.", [s.unstoppableAudit, s.unstoppableAuditNotice]), scope: "Unstoppable iOS/Android v0.17.1 code; December 2020 review, February 2021 retest; pre-shielded Zcash release" };
const zipherAvailable = yes([s.zipher, s.zipherRepo], "The publisher distributes a mobile beta. This is not a stable-release claim.");
const zipherFacts = {
  shieldedSend: yes([s.zipherRepo], "The mobile beta sends from the shielded pool."),
  shieldedReceive: unknown("The reviewed mobile beta material did not separately verify its current shielded receiving workflow.", [s.zipherRepo]),
  multichain: unknown("Cross-chain swaps and alpha Action Wallet features do not establish general native multichain management in the distributed mobile beta.", [s.zipherRepo]),
};
const zstashUnavailable = no([s.zstash], "The official site says Coming Soon; no public usable release is documented.");
const zappFacts = {
  shieldedSend: yes([s.zapp], "The publisher describes shielded Zcash payments in the app."),
  shieldedReceive: yes([s.zapp], "The documented funding flow delivers shielded ZEC into the wallet."),
  multichain: unknown("The Base USDC funding flow converts to ZEC; general native multichain holdings were not established.", [s.zapp]),
};
const gemAvailable = yes([s.gem], "The publisher distributes iOS and Android apps.");
const gemFacts = {
  shieldedSend: no([s.gemZcash], "Gem explicitly supports only transparent Zcash sending."),
  shieldedReceive: no([s.gemZcash], "Gem explicitly does not receive at Sapling or Orchard shielded addresses."),
  multichain: yes([s.gem], "The mobile app manages native assets on multiple blockchains."),
  securityAudit: { ...yes([s.gemAudit], "CertiK assessed Gem Wallet in November 2025 and published an April 2026 final report with remediation through later versions. The report reviews wallet security, not Zcash shielded transfers."), scope: "Gem Wallet iOS 1.3.292 / Android 1.3.47; remediation reviewed through iOS 1.3.355 / Android 2.0.16" },
};
const keystoneAvailable = yes([s.keystoneFirmware, s.keystoneMatrix], "Keystone 3 Pro and its public Cypherpunk firmware support Zcash through companion wallets.");
const ledgerAvailable = yes([s.ledger], "Ledger offers Zcash hardware accounts with companion software; capabilities depend on the device and app.");
const ledgerShielded = unknown("Shielded support varies by integration. zkool documents a broken legacy Ledger app, while newer Noir documents PCZT flows; no single model/app combination was verified here.", [s.zkoolLedger, s.noirHardware]);
const trezorAvailable = yes([s.trezor], "The vendor lists Zcash support for Safe 3, Safe 5 and Safe 7 through Trezor Suite.");
const trezorShielded = no([s.trezor], "The vendor explicitly limits Zcash to transparent addresses and excludes shielded transactions.");

export const WALLET_EVIDENCE: WalletEvidenceProfile[] = [
  {
    walletName: "Zodl", availability: scoped("iOS and Android public mobile channels", zodlAvailable),
    platforms: {
      ios: platform("iOS App Store; listing 3.17.1 and current Zodl support docs", zodlAvailable, zodlFacts),
      android: platform("Android Google Play / official APK / publisher F-Droid channel; current support docs", zodlAvailable, zodlFacts),
    },
  },
  {
    walletName: "Zingo!", availability: scoped("iOS and Android stable channel", zingoAvailable),
    platforms: {
      ios: platform("iOS stable download channel; current Zingo mobile docs", zingoAvailable, zingoFacts),
      android: platform("Android stable download channel; current Zingo mobile docs", zingoAvailable, zingoFacts),
      desktop: platform("Desktop release/channel not verified", unknown("The reviewed Zingo download page establishes mobile channels only; desktop was not verified.", [s.zingoDownload])),
    },
  },
  {
    walletName: "Ywallet", availability: scoped("Published mobile and desktop installations; documentation version 1.15.3", ywalletAvailable),
    platforms: {
      ios: platform("iOS App Store; Ywallet documentation version 1.15.3", ywalletAvailable, ywalletFacts),
      android: platform("Android Google Play / APK; Ywallet documentation version 1.15.3", ywalletAvailable, ywalletFacts),
      desktop: platform("Windows, macOS Intel/Apple Silicon and Linux; published installation docs version 1.15.3", ywalletAvailable, ywalletDesktopFacts),
    },
  },
  {
    walletName: "zkool", availability: scoped("Public mobile stores and GitHub desktop builds; docs updated 2026-08-01", zkoolAvailable),
    platforms: {
      ios: platform("iOS App Store software wallet; docs updated 2026-08-01, store version may lag", zkoolAvailable, zkoolFacts),
      android: platform("Android Google Play software wallet; docs updated 2026-08-01, store version may lag", zkoolAvailable, zkoolFacts),
      desktop: platform("macOS/Windows documented; Linux GitHub packages; software accounts, docs updated 2026-08-01", zkoolAvailable, zkoolFacts),
    },
  },
  {
    walletName: "Brave Wallet", availability: scoped("Public desktop Brave Wallet Zcash integration", braveAvailable),
    platforms: {
      desktop: platform("Desktop Brave stable; shielded integration introduced in 1.77, current support page", braveAvailable, {
        shieldedSend: yes([s.braveZcash, s.braveSupport], "Desktop Brave documents shielded Zcash sending."),
        shieldedReceive: yes([s.braveZcash, s.braveSupport], "Desktop Brave documents shielded Zcash receiving."),
        hardwareSigning: unknown("General desktop Ledger/Trezor support does not establish Zcash signing through those integrations.", [s.brave]),
        multichain: braveMultichain,
        securityAudit: braveAudit,
      }),
      ios: platform("iOS public Brave Wallet; Zcash limitation in reviewed support docs", braveMobile, {
        shieldedSend: braveMobile, shieldedReceive: braveMobile,
        hardwareSigning: no([s.brave], "The vendor marks hardware wallet integration desktop-only."), multichain: braveMultichain,
        securityAudit: braveAudit,
      }),
      android: platform("Android public Brave Wallet; Zcash limitation in reviewed support docs", braveMobile, {
        shieldedSend: braveMobile, shieldedReceive: braveMobile,
        hardwareSigning: no([s.brave], "The vendor marks hardware wallet integration desktop-only."), multichain: braveMultichain,
        securityAudit: braveAudit,
      }),
    },
  },
  {
    walletName: "Noir Wallet", availability: scoped("Chrome mainnet extension; current public documentation", noirAvailable),
    platforms: { browser: platform("Chrome mainnet extension; separate testnet build is outside this scope", noirAvailable, {
      shieldedSend: yes([s.noirTransactions], "The send workflow supports shielded funds and recipients."),
      shieldedReceive: yes([s.noirTransactions], "The Receive screen offers a shielded address."),
      hardwareSigning: yes([s.noirHardware], "Keystone and Ledger use supported PCZT flows. Keystone cannot spend or shield transparent funds; hardware lending/message signing are unavailable."),
      multichain: unknown("Mainnet swaps are documented, but native multichain holdings were not verified.", [s.noirOverview]),
    }) },
  },
  {
    walletName: "MetaMask Snap", availability: scoped("Published ChainSafe Zcash Snap; present network compatibility unconfirmed", snapUncertain),
    platforms: { browser: platform("MetaMask desktop browser extension + ChainSafe WebZjs companion; published Snap", snapUncertain, {
      shieldedSend: unknown("The release announced shielded sending, but unresolved NU6.1 broadcast reports leave current operation unverified.", [s.snapLaunch, s.snapIssue]),
      shieldedReceive: unknown("The release announced shielded receiving; current companion usability and recovery workflow were not verified.", [s.snapLaunch, s.snapIssue]),
      multichain: unknown("The host MetaMask wallet's other chains are not evidence of native multichain management inside this Zcash Snap.", [s.snap]),
      securityAudit: { ...yes([s.snapAudit], "Hacken published an independent audit of the Zcash Snap package in May 2025, with seven findings marked resolved. The companion WebWallet and current network operation were outside this report."), scope: "ChainSafe WebZjs packages/snap; final audited commit 477f078 (May 2025), not the whole companion app" },
    }) },
  },
  {
    walletName: "Vizor", availability: scoped("Public mobile and desktop download channels", vizorAvailable),
    platforms: {
      ios: platform("iOS public download channel; current Vizor docs and Keystone compatibility matrix", vizorAvailable, vizorFacts),
      android: platform("Android public download channel; current Vizor docs and Keystone compatibility matrix", vizorAvailable, vizorFacts),
      desktop: platform("macOS, Windows and Linux public downloads; current Vizor docs and Keystone matrix", vizorAvailable, vizorFacts),
    },
  },
  {
    walletName: "Cake Wallet", availability: scoped("Public mobile and Linux downloads", cakeAvailable),
    platforms: {
      ios: platform("iOS App Store channel; current Zcash docs with 6.4.1 screenshots", cakeAvailable, cakeMobileFacts),
      android: platform("Android Play/APK channel; current Zcash docs with 6.4.1 screenshots", cakeAvailable, cakeMobileFacts),
      desktop: platform("Linux public download; desktop Zcash feature parity not independently established", unknown("A Linux Cake Wallet build exists, but a usable Zcash account on that build was not independently established.", [s.cake, s.cakeZcash]), {
        shieldedSend: unknown("The generic Zcash guide does not establish Linux feature parity in the reviewed release.", [s.cake, s.cakeZcash]),
        shieldedReceive: unknown("The generic Zcash guide does not establish Linux feature parity in the reviewed release.", [s.cake, s.cakeZcash]),
        multichain: yes([s.cake], "The public Linux wallet is offered as the native multi-asset Cake Wallet."),
      }),
    },
  },
  {
    walletName: "Edge", availability: scoped("iOS and Android public mobile apps", edgeAvailable),
    platforms: {
      ios: platform("iOS public app; platform-specific Zcash launch docs plus 2026 payment documentation", edgeAvailable, edgeFacts),
      android: platform("Android public app; platform-specific Zcash launch docs plus 2026 payment documentation", edgeAvailable, edgeFacts),
    },
  },
  {
    walletName: "Unstoppable Wallet", availability: scoped("Public iOS and Android store channels", yes([s.unstoppableIos, s.unstoppableAndroid], "Both mobile stores publish the wallet and its Zcash feature description.")),
    platforms: {
      ios: platform("iOS App Store 0.51; current publisher description and release history", yes([s.unstoppableIos], "Public iPhone release."), {
        shieldedSend: yes([s.unstoppableIos, s.unstoppableIosReleases], "Publisher documentation confirms full shielded Zcash transactions."),
        shieldedReceive: yes([s.unstoppableIosReleases], "Release notes document rotating shielded addresses and the Zcash Receive screen."),
        multichain: yes([s.unstoppableIos], "Native wallets include BTC, XMR, ZEC and other chains."),
        securityAudit: unstoppableAudit,
      }),
      android: platform("Android Google Play listing updated 2026-09-30; releases include Ironwood support", yes([s.unstoppableAndroid, s.unstoppableAndroidReleases], "Public Android release."), {
        shieldedSend: yes([s.unstoppableAndroid, s.unstoppableAndroidReleases], "The current publisher listing confirms full shielded transactions; release notes record Ironwood support."),
        shieldedReceive: yes([s.unstoppableAndroid], "The publisher describes full shielded Zcash wallet support on Android."),
        multichain: yes([s.unstoppableAndroid], "Native wallets include BTC, XMR, ZEC and other chains."),
        securityAudit: unstoppableAudit,
      }),
    },
  },
  {
    walletName: "Zipher", availability: scoped("Mobile beta; separate CLI is alpha", zipherAvailable),
    platforms: {
      ios: platform("iOS 16.4+ TestFlight beta; mobile app scope only", zipherAvailable, zipherFacts),
      android: platform("Android 7.0+ mobile beta; publisher Play download", zipherAvailable, zipherFacts),
      desktop: platform("Desktop GUI not verified; separate CLI alpha is outside the mobile wallet scope", unknown("The source distinguishes a headless CLI alpha from the mobile beta; a desktop GUI release was not verified.", [s.zipher, s.zipherRepo])),
      web: platform("Public web wallet release not verified", unknown("The reviewed distribution page does not establish a usable web wallet.", [s.zipher])),
    },
  },
  {
    walletName: "zSTASH", availability: scoped("Announced desktop product; no public release", zstashUnavailable),
    platforms: { desktop: platform("Coming-soon desktop product; planned features are unverified", zstashUnavailable) },
  },
  {
    walletName: "Zapp", availability: scoped("Android public app and iOS public TestFlight beta", yes([s.zapp], "Both distribution channels are linked by the publisher.")),
    platforms: {
      android: platform("Android Google Play public channel; current publisher documentation", yes([s.zapp], "Public Android app download."), zappFacts),
      ios: platform("iOS public TestFlight beta; not an App Store stable release", yes([s.zapp], "The publisher offers an iOS public beta."), zappFacts),
    },
  },
  {
    walletName: "Gem Wallet", availability: scoped("iOS and Android public mobile apps", gemAvailable),
    platforms: {
      ios: platform("iOS App Store channel; current Gem Zcash support documentation", gemAvailable, gemFacts),
      android: platform("Android Play/APK channel; current Gem Zcash support documentation", gemAvailable, gemFacts),
    },
  },
  {
    walletName: "Keystone", availability: scoped("Keystone 3 Pro with public Cypherpunk firmware", keystoneAvailable),
    platforms: { hardware: platform("Keystone 3 Pro, Cypherpunk 3.0.4; Zodl or Vizor companion required for Zcash", keystoneAvailable, {
      shieldedSend: yes([s.keystoneZodl, s.keystoneFirmware], "Current Cypherpunk firmware signs shielded ZEC through a compatible companion."),
      shieldedReceive: yes([s.zodlReceive, s.keystoneMatrix], "Zodl exposes shielded receiving addresses belonging to the Keystone wallet."),
      hardwareSigning: yes([s.keystoneZodl], "Zcash signing occurs on the offline Keystone device."),
      multichain: yes([s.keystoneFirmware], "The same Cypherpunk firmware supports native BTC, ZEC and XMR; companion apps differ by chain."),
      securityAudit: { ...yes([s.keystoneAudit], "Least Authority published a final audit of Keystone's Zcash signing integration in March 2025. The report covers named firmware and SDK revisions; it does not attest current Cypherpunk 3.0.4 or the Zodl/Vizor apps."), scope: "Keystone 3 Zcash firmware 1.8.2 and SDK Rust 0.0.45, iOS 0.8.5, Android 0.7.8; March 2025" },
    }) },
  },
  {
    walletName: "Ledger", availability: scoped("Public Ledger devices and companion software; model/app-specific support", ledgerAvailable),
    platforms: { hardware: platform("Ledger Zcash hardware account; shielded app/integration not verified as a single supported combination", ledgerAvailable, {
      shieldedSend: ledgerShielded, shieldedReceive: ledgerShielded,
      hardwareSigning: yes([s.ledger, s.ledgerSign], "Ledger accounts require on-device approval and signing; this does not establish shielded Zcash support."),
      multichain: yes([s.ledgerAssets], "Ledger Wallet manages native BTC, ETH, SOL and other assets using a Ledger signer."),
      securityAudit: { ...unknown("A ZecSec audit covers hhanh00's legacy zcash-ledger shielded app v1.0.1. It does not establish an independent review of the current Ledger Zcash account, firmware or companion software.", [s.ledgerLegacyAudit]), scope: "Current Ledger Zcash account; cited historical report covers a separate 2023 app v1.0.1" },
    }) },
  },
  {
    walletName: "Trezor", availability: scoped("Safe 3, Safe 5 and Safe 7 with Trezor Suite; current vendor listing", trezorAvailable),
    platforms: { hardware: platform("Trezor Safe 3/5/7 with Trezor Suite and supported multi-coin firmware; transparent Zcash", trezorAvailable, {
      shieldedSend: trezorShielded, shieldedReceive: trezorShielded,
      hardwareSigning: yes([s.trezor], "Zcash transactions are confirmed on the Trezor device."),
      multichain: yes([s.trezorAssets], "The supported-assets directory lists native coins across multiple chains; use compatible multi-coin firmware."),
    }) },
  },
];
