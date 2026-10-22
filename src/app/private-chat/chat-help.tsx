import { IconPrivateChat } from "@/components/icons";
import { ChevronIcon, HelpIcon } from "./chat-ui-icons";
import styles from "./private-chat.module.css";
const QUESTIONS = [
  [
    "Do I need an account or wallet?",
    "No. Choose a temporary alias. No email, phone number or wallet is required.",
  ],
  [
    "Can I talk to several people in one tab?",
    "Yes. Choose New chat to create another invite or join with a link. Switch between people in Your chats; unread badges show new messages. You can keep up to 8 separate conversations open, each with its own message keys. On a phone, tap Chats above the conversation to return to the list. Reloading or leaving clears every chat in this tab.",
  ],
  [
    "Can I reply to one message or react to it?",
    "Yes. Hover a message, or tap it on a phone, and choose Reply or React. A reply quotes the original message; tapping the quote jumps back to it. Reactions use a fixed set of six emoji, one per person per message, and choosing another replaces yours. Both travel end to end through Nym like messages and are kept only in this tab.",
  ],
  [
    "How private is it?",
    "Messages, replies and reactions are encrypted end to end and travel through Nym between the two browsers. No server stores them. The site host and Nym entry gateway can see your IP. This chat has not had an independent audit.",
  ],
  [
    "Do I need a paid VPN?",
    "No VPN subscription is required. The chat uses the Nym mixnet directly. This protects chat traffic, not every connection made by your browser.",
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
    "Invites last 5 minutes. Everyone who opens the link appears under Requests until you accept or decline, and each accepted request opens its own chat. Revoking or disconnecting invalidates the invite. Create a new one to start again.",
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
                Create an invite and share the link. Everyone who opens it
                appears under Requests.
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Accept & say hello</h3>
              <p>
                Accept the request, then send a message. Hover or tap a message
                to reply with a quote or react with an emoji.
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
