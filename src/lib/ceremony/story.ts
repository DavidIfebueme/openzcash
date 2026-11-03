import type { Link } from "./people";

/**
 * Parts I and V of the Zcash Ceremony pages. The chapters come from the
 * "Zcash at 10" draft (branch zcash-at-10), checked against the original
 * papers and primary reporting. The timeline keeps only what a primary source
 * or this site's own verified records support; figures the draft could not
 * source were left out, and the Major Grants history follows the February 2022
 * rename to Zcash Community Grants.
 */

export const GENESIS = "2016-10-28";
export const TENTH_ANNIVERSARY = "2026-10-28";

/** Calendar years and remaining days since launch, using UTC dates and leap years. */
export function genesisAge(now: Date): { years: number; days: number } {
  const genesis = new Date(`${GENESIS}T00:00:00Z`);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (today <= genesis.getTime()) return { years: 0, days: 0 };
  const month = genesis.getUTCMonth();
  const day = genesis.getUTCDate();
  let year = now.getUTCFullYear();
  if (today < Date.UTC(year, month, day)) year -= 1;
  return {
    years: year - genesis.getUTCFullYear(),
    days: (today - Date.UTC(year, month, day)) / 86_400_000,
  };
}

/** Whole days from `now` to the start (UTC) of `dateIso`; 0 once it has come. */
export function daysUntil(dateIso: string, now: Date): number {
  const target = new Date(`${dateIso}T00:00:00Z`).getTime();
  return Math.max(0, Math.ceil((target - now.getTime()) / 86_400_000));
}

export type Chapter = {
  id: string;
  era: string;
  title: string;
  who: string;
  text: string[];
  /** A primary-source line, verbatim and short, shown after paragraph `after` (0-based). */
  quote?: { text: string; by: string; href: string; after: number };
  /** A period recording, played in a click-to-load embed after paragraph `after`. */
  film?: {
    youtubeId: string;
    title: string;
    caption: string;
    lengthS: number;
    after: number;
  };
  links?: Link[];
};

export const CHAPTERS: Chapter[] = [
  {
    id: "untraceable-money",
    era: "1982",
    title: "The idea of untraceable money",
    who: "David Chaum",
    text: [
      "Long before blockchains, cryptographer David Chaum published “Blind Signatures for Untraceable Payments” (1982): a bank could sign a digital coin without seeing it, so the coin could later be spent without the bank linking it back to you. Digital cash that behaved like cash.",
      "Chaum founded DigiCash in 1989 to build it. Its eCash ran a real pilot at a US bank in 1995, but the company went bankrupt in 1998. The world was not ready, and the money still needed a bank at the center.",
      "One detail matters for this story: in 1996 a computer science student named Zooko Wilcox took a leave of absence to work as a junior coder at DigiCash. The company failed; the apprenticeship did not.",
    ],
  },
  {
    id: "cypherpunks",
    era: "1992",
    title: "The cypherpunks",
    who: "Hughes, May, Gilmore and a mailing list",
    text: [
      "In 1992 a mailing list formed around a simple position: privacy in the electronic age would have to be built with code, not requested from institutions. Eric Hughes opened his 1993 manifesto with the line “Privacy is necessary for an open society in the electronic age.”",
      "The list became the proving ground for everything that followed: remailers, digital cash schemes, and the culture of shipping working cryptography instead of position papers. Zooko Wilcox, who later brought Zcash to life, was posting to the list by 1997: an “original cypherpunk,” as Zcash’s own site puts it.",
    ],
  },
  {
    id: "missing-pieces",
    era: "1997–2004",
    title: "The missing pieces",
    who: "Back, Dai, Szabo, Finney",
    text: [
      "Adam Back’s Hashcash (1997) made computation itself a scarce stamp. Wei Dai’s b-money and Nick Szabo’s bit gold (late 1990s) sketched money without a central issuer. Each solved a piece; none shipped as money.",
      "Hal Finney, veteran cypherpunk and PGP developer, also wrote working code for zero-knowledge proofs. At the rump session of the Crypto ’98 conference in Santa Barbara, on August 25, 1998, he gave a five-minute talk, “A zero-knowledge proof of possession of a pre-image of a SHA-1 hash”: a program that proves you know a message with a given SHA-1 hash without revealing the message, built on a proof system Ronald Cramer and Ivan Damgård presented at the same conference. It was a talk, not a paper, and the session was filmed.",
      "In 2004 Finney built RPOW, reusable proofs of work: tokens minted from hashcash that could pass from person to person. The prototype ran on a central server and never took off. When Bitcoin appeared he was, by his own account, the first person besides its creator to run it, and he received the first Bitcoin transaction ever sent (January 12, 2009).",
      "Finney died in 2014. The problem he spent decades on, private electronic cash that needs no permission, is the problem Zcash exists to finish.",
    ],
    film: {
      youtubeId: "YjHVNstGLIQ",
      title: "Hal Finney at the Crypto ’98 rump session",
      caption:
        "Santa Barbara, August 25, 1998. Filmed by Takeshi Shimoyama, edited by Kevin McCurley.",
      lengthS: 434,
      after: 1,
    },
    links: [
      {
        label: "Crypto ’98 rump session program",
        href: "https://www.iacr.org/conferences/crypto98/rump.html",
      },
      {
        label: "Cramer and Damgård, Crypto ’98",
        href: "https://doi.org/10.1007/BFb0055745",
      },
      {
        label: "Crypto ’98 rump session videos",
        href: "https://mccurley.org/video/rump.html",
      },
    ],
  },
  {
    id: "bitcoin",
    era: "2008–2009",
    title: "Bitcoin ships, and exposes everything",
    who: "Satoshi Nakamoto",
    text: [
      "The Bitcoin whitepaper (October 31, 2008) and genesis block (January 3, 2009) solved decentralized consensus. Money finally worked without a bank.",
      "But it worked in public. Every amount, every counterparty, every balance, forever, on a ledger anyone can read. Bitcoin realized the cypherpunk dream of permissionless money while inverting its premise of privacy.",
    ],
  },
  {
    id: "open-problem",
    era: "2009–2010",
    title: "The problem Satoshi left open",
    who: "Satoshi Nakamoto, Zooko Wilcox, Daira-Emma Hopwood",
    text: [
      "On January 26, 2009, eighteen days after Bitcoin’s first release, Zooko Wilcox wrote a short post on his own blog, Zooko’s Hack Log, about why digital cash had failed at DigiCash and where it might work next. It ends by pointing to bit gold, b-money and “BitCoin by Satoshi Nakamoto.” It is one of the earliest known blog posts to mention Bitcoin, and Zooko has called it the first. By March 2009, bitcoin.org listed “Zooko’s blog” among its related links, beside b-money and bit gold. The link led into Tahoe-LAFS, the decentralized storage system Zooko was building at allmydata: the blog lived on its test grid.",
      "In August 2010 a BitcoinTalk thread asked whether Bitcoin could work without publishing every transaction, and another user suggested zero-knowledge proofs. Satoshi called the problem a very interesting one and said a solution would make a much better Bitcoin possible. He doubted the tool, though: to rule out a double-spend, a node seemed to need to know about every transaction.",
      "In August 2010, two days after his first response in the same BitcoinTalk thread, Satoshi floated “key blinding”, a fresh, unlinkable key for every payment, and pointed to an unfinished draft on recipient-hiding encryption. He named no author. The draft is widely attributed to Daira-Emma Hopwood, writing under a former name. By then Hopwood was also a Tahoe-LAFS developer alongside Zooko, and in 2016 was the first-named author of the Zcash protocol specification.",
      "On August 21, 2010, Tahoe-LAFS began accepting bitcoin donations, and Zooko, signing as the project’s community organizer, opened a thread about building Bitcoin payments into it. Satoshi’s reply left the proposal aside. It opened with Zooko’s name and thanked him, in public, for blogging about Bitcoin back when it was announced on the Cryptography mailing list. His last forum post came that December. In 2022 Zooko pointed back to the August thread: four months later Satoshi was gone, and three years after that, a solution was found.",
    ],
    quote: {
      text: "It's hard to think of how to apply zero-knowledge-proofs in this case.",
      by: "Satoshi Nakamoto, BitcoinTalk, August 11, 2010",
      href: "https://bitcointalk.org/index.php?topic=770.msg8637#msg8637",
      after: 1,
    },
    links: [
      {
        label: "Zooko’s post, Jan 2009",
        href: "https://tahoe-lafs.org/~warner/blog.html#%5B%5BDecentralized%20Money%5D%5D",
      },
      {
        label: "bitcoin.org, Mar 2009",
        href: "https://web.archive.org/web/20090303195936/http://bitcoin.org:80/",
      },
      {
        label: "Satoshi on key blinding",
        href: "https://bitcointalk.org/index.php?topic=770.msg9074#msg9074",
      },
      {
        label: "Tahoe-LAFS takes bitcoin",
        href: "https://bitcointalk.org/index.php?topic=30.msg10592#msg10592",
      },
      {
        label: "Satoshi thanks Zooko",
        href: "https://bitcointalk.org/index.php?topic=890.msg10723#msg10723",
      },
      {
        label: "Zcash protocol specification, 2016",
        href: "https://github.com/zcash/zips/blob/939cce45623fa4c27d638db4a7c61ed287ca17e9/protocol/protocol.pdf",
      },
      {
        label: "Zooko, 2022",
        href: "https://x.com/zooko/status/1499478874375163904",
      },
    ],
  },
  {
    id: "zerocash",
    era: "2013–2014",
    title: "Zerocoin, then Zerocash",
    who: "Johns Hopkins, MIT, Technion, Tel Aviv",
    text: [
      "Zerocoin (2013, Miers, Garman, Green and Rubin at Johns Hopkins) proposed a cryptographic washing machine bolted onto Bitcoin. Zerocash (2014, Ben-Sasson, Chiesa, Garman, Green, Miers, Tromer and Virza) went further: a full currency where sender, receiver and amount are hidden, yet every transaction is verified.",
      "The tool that made it possible was the zk-SNARK, a succinct proof that a statement is true without revealing why. The proofs predate these papers; Zerocash was the moment they became a payment system on paper. It needed a team willing to make it real.",
    ],
    links: [
      {
        label: "Zerocoin, IEEE S&P 2013",
        href: "https://doi.org/10.1109/SP.2013.34",
      },
      {
        label: "Zerocash, IEEE S&P 2014",
        href: "https://eprint.iacr.org/2014/349",
      },
    ],
  },
  {
    id: "ceremony",
    era: "2016",
    title: "The Ceremony",
    who: "Six witnesses, air-gapped machines, one secret guest",
    text: [
      "Zcash’s original proving system required secret parameters that, if any single party kept them, could be used to counterfeit coins invisibly. So on October 22 and 23, 2016 the launch team ran a multi-party ceremony: six witnesses in separate places, air-gapped hardware, destroyed key material. If even one of them was honest, the combined secret could never be rebuilt.",
      "The stations were paranoia made real. Peter Todd ran his from a rented car on a drive through British Columbia, a trip he called the “Cypherpunk Desert Bus.” At the Denver station, a phone behaved strangely enough mid-ceremony that the moment became a Radiolab story. And one witness, known only as “John Dobbertin,” stayed pseudonymous for six years: in April 2022, Zcash Media revealed he was Edward Snowden.",
      "On October 28, 2016 the genesis block was mined. That day, in a thin early market on the Poloniex exchange, one ZEC briefly reached roughly 3,300 BTC, and it still traded at 48 BTC later in the day, CoinDesk reported. The experiment was live.",
    ],
    links: [
      {
        label: "The Design of the Ceremony",
        href: "https://github.com/zodl-inc/zcash-blog/blob/master/_posts/2016-10-26-the-design-of-the-ceremony.md",
      },
      {
        label: "Denver footage",
        href: "https://archive.org/details/ThePhoneAnomalyDuringTheZcashCeremonyDenverStation",
      },
      {
        label: "Ceremony data",
        href: "https://archive.org/details/zcashfinalmpc",
      },
      {
        label: "Desert Bus",
        href: "https://archive.org/details/cypherpunk-desert-bus-2016",
      },
      { label: "Radiolab", href: "https://radiolab.org/podcast/ceremony" },
    ],
  },
];

export type Year = {
  year: string;
  title: string;
  items: { label: string; text: string }[];
};

export const TIMELINE: Year[] = [
  {
    year: "2016",
    title: "Launch",
    items: [
      {
        label: "Oct 28 · Genesis",
        text: "Mainnet launches with Sprout shielded transactions, a 21M cap, 2.5-minute blocks and a 12.5 ZEC subsidy, ramped in over a 34-day slow start. The Founders’ Reward directs 20% of the subsidy to the founding team, investors and the Zcash Foundation for the first four years, 10% of total supply.",
      },
    ],
  },
  {
    year: "2018",
    title: "The quiet save, then Sapling",
    items: [
      {
        label: "Mar 1 · A flaw found",
        text: "Ariel Gabizon finds a flaw in the proving system Sprout used that could have allowed invisible counterfeiting. It is fixed quietly by the Sapling upgrade in October and disclosed in February 2019. No evidence of exploitation was ever found.",
      },
      {
        label: "Oct 28 · Sapling",
        text: "A redesign of shielded transactions cuts proving time and memory sharply, making shielded payments practical on phones. It ships on the network’s second birthday, on parameters from a new, larger ceremony.",
      },
    ],
  },
  {
    year: "2019",
    title: "Blossom",
    items: [
      {
        label: "Dec 11 · 75-second blocks",
        text: "Block time drops from 150 to 75 seconds and the per-block subsidy from 12.5 to 6.25 ZEC, keeping issuance per hour unchanged. It is why the first halving lands on 3.125, not 6.25.",
      },
    ],
  },
  {
    year: "2020",
    title: "First halving and the Dev Fund",
    items: [
      {
        label: "Jul · Heartwood",
        text: "Shielded coinbase: miners can receive block rewards directly into shielded addresses.",
      },
      {
        label: "Nov 18 · Canopy, the first halving",
        text: "The subsidy halves to 3.125 ZEC. The Founders’ Reward ends and ZIP 1014’s Dev Fund begins: 7% to Bootstrap (ECC), 5% to the Zcash Foundation and 8% to Major Grants, run by ZOMG and renamed Zcash Community Grants in February 2022.",
      },
    ],
  },
  {
    year: "2022",
    title: "NU5: no more ceremonies",
    items: [
      {
        label: "May 31 · Orchard and Halo 2",
        text: "The Halo 2 proving system removes the trusted setup for the new Orchard pool, and Unified Addresses bundle transparent, Sapling and Orchard receivers into one address.",
      },
      {
        label: "Jun · Sandblasting",
        text: "A sustained spam attack bloats the chain and exposes wallet sync pain. It forces the fee overhaul of ZIP 317 and a generation of faster sync work.",
      },
    ],
  },
  {
    year: "2024",
    title: "Second halving and the lockbox",
    items: [
      {
        label: "2023–2024 · New stewards",
        text: "Zooko hands the ECC CEO role to Josh Swihart in December 2023. Zashi ships as ECC’s mobile wallet in 2024, while Zebra, the Foundation’s Rust node, reaches production alongside zcashd.",
      },
      {
        label: "Nov 23 · NU6, the second halving",
        text: "The subsidy halves to 1.5625 ZEC. 8% goes to Zcash Community Grants, paid to the Financial Privacy Foundation, and 12%, 0.1875 ZEC per block, accrues in an in-protocol lockbox.",
      },
    ],
  },
  {
    year: "2025",
    title: "Coinholders take the wheel",
    items: [
      {
        label: "Nov 24 · NU6.1",
        text: "The lockbox pays its 78,750 ZEC to a coinholder-controlled fund, and the 8% and 12% streams continue to the third halving (ZIP 271, ZIP 1016). Coinholders now vote on grants from the fund; key-holders sign the payouts.",
      },
    ],
  },
  {
    year: "2026",
    title: "The Orchard emergency, then year ten",
    items: [
      {
        label: "Mar 16 · A veto",
        text: "Two key-holders, the Zcash Foundation and Shielded Labs, announce a veto of the $2.67M Q4 2025 grant to Bootstrap (ECC), approved by coinholders months earlier.",
      },
      {
        label: "Jun 2–3 · The Orchard emergency",
        text: "A soundness flaw in the Orchard circuit leads to an emergency soft fork that disables Orchard at block 3,363,426; the NU6.2 network upgrade at block 3,364,600 re-enables it with a corrected circuit (ZIP 257).",
      },
      {
        label: "Jul 28 · Ironwood",
        text: "NU6.3 activates at block 3,428,143 with a new shielded pool, Ironwood (ZIP 258). Orchard stops taking new funds, and balances move out into Ironwood.",
      },
      {
        label: "Sep 14 · NU7’s scope",
        text: "Coinholders vote to keep the halvings, retire v4 transactions at NU7 and move to 25-second blocks; 2.4M ZEC took part in the first question. They also back reissuance from February 2031, but coinholder and community polls reach no shared majority on the date, and NU7 takes 2031 as the more conservative choice.",
      },
      {
        label: "Oct 28 · Ten years",
        text: "Ten years since the genesis block.",
      },
    ],
  },
];

/** Claims that keep circulating, kept honest here. */
export const CORRECTIONS: { claim: string; fact: string }[] = [
  {
    claim: "“The reward halved from 12.5 to 6.25 in 2020”",
    fact: "No. Blossom (2019) moved to 75-second blocks and 6.25 ZEC per block with unchanged hourly issuance. The 2020 halving went to 3.125, and 2024 to 1.5625.",
  },
  {
    claim: "“Zerocash created zk-SNARKs”",
    fact: "Zero-knowledge proofs date to 1985, and the first known SNARK construction, Micali’s CS proofs, to 1994; the zk-SNARKs Zerocash used come from the early 2010s. Zerocash was the first full payment design built on them, hiding sender, receiver and amount; Zcash made it run in production.",
  },
  {
    claim: "“Zcash is governed by a DAO”",
    fact: "There is no Zcash DAO. Decisions run through the ZIP process, ZCAP and coinholder polls, coinholder votes on the fund (ZIP 1016) and independent organizations. ZecHub runs a DAO, and it governs a community project, not the protocol.",
  },
  {
    claim: "“ZOMG runs the Major Grants”",
    fact: "Not since February 2022, when Zcash Open Major Grants was renamed Zcash Community Grants. It still funds independent teams doing major ongoing development; since NU6 in November 2024 its stream is paid to the Financial Privacy Foundation.",
  },
];
