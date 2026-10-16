import { IconPrivateChat } from "@/components/icons";
import { ChevronIcon, HelpIcon } from "./chat-ui-icons";
import styles from "./private-chat.module.css";
const pilot = process.env.NEXT_PUBLIC_PRIVATE_CHAT_PILOT === "true";
const QUESTIONS = [
  [
    "Do I need an account or wallet?",
    "No. Choose a temporary alias. No email, phone number or wallet is required.",
  ],
  [
    "Who can find me in Discover?",
    "People with the room link can see you when you opt in, and anyone can forward that link. Turning availability off revokes your invite locally; the listing can take up to 2 minutes to disappear if the connection drops.",
  ],
  [
    "Is a private room a group chat?",
    "No. The room helps people with the link find each other. Only members who turn on availability appear in Discover. A request opens a one-to-one chat after acceptance, with one active conversation per tab. There is no public people list or group chat.",
  ],
  [
    "How private is it?",
    "Messages are encrypted end to end and travel through Nym, along with Discover requests. Room listings are encrypted for people with the link. The directory sees room IDs, request times and a temporary key linking your availability updates. " + (pilot ? "This pilot uses anonymous replies. " : "This local preview also exposes a Nym return address. ") + "The site host and Nym entry gateway can see your IP. Discover pauses when Nym is unavailable. This chat has not had an independent audit.",
  ],
  [
    "Do I need a paid VPN?",
    "No VPN subscription is required. The chat uses the Nym mixnet directly. This protects chat and Discover traffic, not every connection made by your browser.",
  ],
  [
    "Why can delivery take a little longer?",
    "Nym routes messages through a mixnet. Connected via Nym means a signal returned through Nym; your contact is checked separately. Delivered confirms arrival, not that the message was read. If confirmation is missing, check the connection before retrying.",
  ],
  [
    "Can I trust an alias?",
    "Aliases are chosen by users and do not prove who someone is. Compare the full safety code with your contact through another trusted channel before sharing anything sensitive.",
  ],
  [
    "Are old messages safe if a key is exposed?",
    "Each conversation uses Olm Double Ratchet, which evolves message keys. Losing a tab identity key alone is not enough to decrypt captured conversation messages. Messages visible in an open tab are still exposed if that device is compromised. This integration has not had an independent security audit.",
  ],
  [
    "Are my messages saved?",
    "Messages live in this tab while the session is open. Leaving, navigating away or reloading clears them from the app. This is not secure erasure: copied content and encrypted Nym transport data may remain in browser storage.",
  ],
  [
    "Why did my invite expire?",
    "Invites last 5 minutes and are consumed when accepted. Revoking, disconnecting, leaving the room or turning availability off also invalidates them. Create a new invite to start again.",
  ],
];
export function ChatHelp() {
  return (
    <details
      className={styles.help}
      onToggle={(event) => {
        if (event.target === event.currentTarget && event.currentTarget.open) {
          event.currentTarget.scrollIntoView?.({
            block: "nearest",
            behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")
              ?.matches
              ? "auto"
              : "smooth",
          });
        }
      }}
    >
      <summary>
        <span>
          <HelpIcon />
          Quick guide & FAQ
        </span>
        <span className={styles.helpHint}>
          <ChevronIcon />
        </span>
      </summary>
      <div className={styles.helpContent}>
        <div className={styles.helpIntro}>
          <IconPrivateChat />
          <div>
            <h2>Getting started</h2>
          </div>
        </div>
        <ol className={styles.tutorial}>
          <li>
            <span>01</span>
            <div>
              <h3>Choose & connect</h3>
              <p>
                Pick an alias and tap Continue. Switch Nym on below your alias,
                then wait for Connected via Nym.
              </p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Invite someone</h3>
              <p>
                Share a chat invite, or use a private Discover room to find each
                other.
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Accept & say hello</h3>
              <p>
                Accept the request, then send a message. The smile button adds
                emoji.
              </p>
            </div>
          </li>
        </ol>
        <div className={styles.faq}>
          {QUESTIONS.map(([question, answer]) => (
            <details key={question}>
              <summary>
                {question}
                <ChevronIcon />
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </details>
  );
}
