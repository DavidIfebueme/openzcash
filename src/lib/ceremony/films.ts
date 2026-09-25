/**
 * Every public film, clip, talk and podcast about the Zcash ceremonies that a
 * research pass of 2026-09-25 opened and confirmed (YouTube oEmbed and watch
 * pages, Internet Archive metadata, the linking primary sources). YouTube
 * items play in a light, privacy-enhanced embed that loads only on click;
 * everything else links to where it lives.
 */
export type Film = {
  id: string;
  title: string;
  by: string;
  /** ISO date of the recording or first release. */
  date: string;
  lengthS: number | null;
  /** 11-character YouTube id, when the film plays in the page. */
  youtubeId?: string;
  /** Where to start, in seconds, when only part of a talk is about the ceremony. */
  start?: number;
  href: string;
  source: string;
  note: string;
};

export type FilmGroup = {
  id: string;
  title: string;
  lede: string;
  films: Film[];
};

const yt = (id: string) => `https://www.youtube.com/watch?v=${id}`;

export const FILM_GROUPS: FilmGroup[] = [
  {
    id: "stations",
    title: "The other stations",
    lede: "Two more witnesses filmed their air-gapped machines from purchase to the end of the ceremony.",
    films: [
      {
        id: "orlando",
        title: "Orlando Station Report",
        by: "Andrew Miller",
        date: "2016-10-27",
        lengthS: 4173,
        youtubeId: "RfFLvtkzau8",
        href: yt("RfFLvtkzau8"),
        source: "YouTube",
        note: "Nearly 48 hours at his station in Florida, cut to seventy minutes: choosing a store by coin flip, buying the desktop, pulling its hard drive and wireless card, the rounds, and yanking the RAM at the end.",
      },
      {
        id: "dc",
        title: "Timestamped photos of the DC station",
        by: "Peter Van Valkenburgh",
        date: "2016-11-02",
        lengthS: 570,
        youtubeId: "K_dlc2ryiBI",
        href: yt("K_dlc2ryiBI"),
        source: "YouTube",
        note: "A GoPro photo every ten seconds, from bringing the compute node home to the end of the ceremony. He cut both RAM sticks with tin snips on October 23.",
      },
      {
        id: "dc-album",
        title: "Final run, Zcash parameter generation",
        by: "Peter Van Valkenburgh",
        date: "2016-10-21",
        lengthS: null,
        href: "https://goo.gl/photos/AZvgdL4DQT9m8Fvw6",
        source: "Google Photos",
        note: "His phone photos and video clips from October 21 to 24, linked from his written account of the DC station.",
      },
    ],
  },
  {
    id: "film",
    title: "The short film",
    lede: "Electric Coin Company's own account, released in January 2017.",
    films: [
      {
        id: "ecc-film",
        title: "Zcash Ceremony",
        by: "Electric Coin Company",
        date: "2017-01-04",
        lengthS: 256,
        youtubeId: "D6dY-3x3teM",
        href: yt("D6dY-3x3teM"),
        source: "YouTube",
        note: "The story of the ceremony, with images and video by Peter Todd, Andrew Miller, Peter Van Valkenburgh, NCC Group, Nathaniel Kramer and Zcash.",
      },
    ],
  },
  {
    id: "snowden",
    title: "Who was John Dobbertin",
    lede: "The last pseudonym, revealed in 2022.",
    films: [
      {
        id: "zcash-media-2022",
        title: "Why Snowden Helped Launch Zcash",
        by: "Zcash Media",
        date: "2022-04-27",
        lengthS: 524,
        youtubeId: "8qSA29vWWds",
        href: yt("8qSA29vWWds"),
        source: "YouTube",
        note: "First released as “The End of Zcash’s Trusted Setup: Who is John Dobbertin?”, with Edward Snowden, Sean Bowe and Zooko Wilcox.",
      },
      {
        id: "zcash-media-2024",
        title: "Edward Snowden on why he took part",
        by: "Zcash Media",
        date: "2024-12-05",
        lengthS: 149,
        youtubeId: "lZm6idmT3EA",
        href: yt("lZm6idmT3EA"),
        source: "YouTube",
        note: "A short excerpt of the same interview.",
      },
    ],
  },
  {
    id: "next",
    title: "The next ceremonies",
    lede: "Powers of Tau (2017–2018) let anyone take part, and some participants went further with their air gaps.",
    films: [
      {
        id: "tau-41",
        title: "Powers of Tau, round 41",
        by: "Andrew Miller and Ryan Pierce",
        date: "2018-01-23",
        lengthS: 247,
        youtubeId: "I4cDAqeEmpU",
        href: yt("I4cDAqeEmpU"),
        source: "YouTube",
        note: "A contribution computed in a private airplane, with radioactive waste from Chernobyl as the entropy source.",
      },
      {
        id: "tau-85",
        title: "The Greatest Secret",
        by: "Patrick Mylund Nielsen and Amber Baldet",
        date: "2018-03-17",
        lengthS: 94,
        youtubeId: "eC4vBgyyo6s",
        href: yt("eC4vBgyyo6s"),
        source: "YouTube",
        note: "Round 85 in New York: street recordings from dice-chosen cameras, cut into chunks and fed to the air-gapped laptop as entropy.",
      },
      {
        id: "tau-6",
        title: "Drilling the RAM",
        by: "Hudson Jameson and Steven Schroeder",
        date: "2017-11-16",
        lengthS: 13,
        href: "https://imgur.com/vujhLby",
        source: "Imgur",
        note: "Round 6: a foil Faraday cage in a windowless bathroom, then the RAM, USB drive and CPU destroyed with a drill and a hammer.",
      },
    ],
  },
  {
    id: "talks",
    title: "Talks and podcasts",
    lede: "The people who designed and ran the ceremonies, in their own words.",
    films: [
      {
        id: "zcash-review-2",
        title: "Zcash Review, episode 2: Design of the Ceremony",
        by: "Zooko Wilcox and Andreas Antonopoulos",
        date: "2016-11-20",
        lengthS: 4272,
        href: "https://podcasts.apple.com/us/podcast/zcash-review-episode-2-design-ceremony-zooko-wilcox/id1210599738?i=1000382659564",
        source: "Apple Podcasts",
        note: "Recorded four weeks after the ceremony, on its design and execution.",
      },
      {
        id: "btck-212",
        title: "Peter Todd and Zcash",
        by: "Bitcoin Knowledge Podcast",
        date: "2017-01-31",
        lengthS: 1640,
        youtubeId: "hggKfPcP9dE",
        href: yt("hggKfPcP9dE"),
        source: "YouTube",
        note: "The Desert Bus witness on his experience of the trusted setup.",
      },
      {
        id: "radiolab",
        title: "The Ceremony",
        by: "Radiolab, WNYC Studios",
        date: "2017-07-14",
        lengthS: 2840,
        href: "https://radiolab.org/podcast/ceremony",
        source: "Radiolab",
        note: "Morgen Peck tells Molly Webster the story of the ceremony, from inside the Denver station.",
      },
      {
        id: "devcon3-miller",
        title: "Parameter Generation",
        by: "Andrew Miller, Devcon3",
        date: "2017-11-26",
        lengthS: 1599,
        youtubeId: "3hK2CKEeIMU",
        href: yt("3hK2CKEeIMU"),
        source: "YouTube",
        note: "An open-ended talk on how the Zcash Foundation could help set up zk-SNARK parameters, given at Devcon3 in Cancún days before Powers of Tau took its first contribution.",
      },
      {
        id: "devcon3-bowe",
        title: "Democratizing zk-SNARKs",
        by: "Sean Bowe, Devcon3",
        date: "2017-11-26",
        lengthS: 890,
        youtubeId: "7BxoyEw6LUY",
        href: yt("7BxoyEw6LUY"),
        source: "YouTube",
        note: "The multi-party computation protocol behind Powers of Tau, among the next generation of zk-SNARKs.",
      },
      {
        id: "zcon0-bowe",
        title: "Cultivating Sapling",
        by: "Sean Bowe, Zcon0",
        date: "2018-07-02",
        lengthS: 1130,
        youtubeId: "t5krRSD-GYM",
        start: 540,
        href: `${yt("t5krRSD-GYM")}&t=540`,
        source: "YouTube",
        note: "Starts at 9:00, where Powers of Tau and the Sapling MPC are covered.",
      },
      {
        id: "mcc-todd",
        title: "Cryptographic Hocus-Pocus Meaning Nothing",
        by: "Peter Todd, Magical Crypto Conference",
        date: "2019-05-01",
        lengthS: 1502,
        youtubeId: "YHieWJWwVbE",
        href: yt("YHieWJWwVbE"),
        source: "YouTube",
        note: "A witness on the trusted setup he took part in.",
      },
      {
        id: "zk-76",
        title:
          "Sean Bowe on SNARKs, Trusted Setups and Elliptic Curve Cryptography",
        by: "Zero Knowledge Podcast, episode 76",
        date: "2019-05-08",
        lengthS: 5484,
        youtubeId: "KYD1ioJwd7I",
        href: yt("KYD1ioJwd7I"),
        source: "YouTube",
        note: "The author of the Sprout and Sapling setups on the story of Zcash and Powers of Tau.",
      },
    ],
  },
];

/** Peter Todd kept his Desert Bus footage; his account says it is unreleased. */
export const UNRELEASED = {
  text: "Peter Todd’s two GoPros recorded hours of the Cypherpunk Desert Bus, switched off while he typed his entropy, but he has not released the footage; his repository only commits to the files by hash.",
  links: [
    {
      label: "His account, Nov 14, 2016",
      href: "https://petertodd.org/2016/cypherpunk-desert-bus-zcash-trusted-setup-ceremony",
    },
    {
      label: "Evidence archive",
      href: "https://github.com/petertodd/cypherpunk-desert-bus-2016",
    },
  ],
};

export const allFilms = () => FILM_GROUPS.flatMap((g) => g.films);
