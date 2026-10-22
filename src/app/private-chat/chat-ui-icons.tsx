import type { ReactNode } from "react";
function glyph(children: ReactNode) {
  return function Glyph({ className }: { className?: string }) {
    return (
      <svg
        className={className}
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {children}
      </svg>
    );
  };
}
export const PowerIcon = glyph(
  <>
    <path d="M12 3v9M6.3 5.8a8.5 8.5 0 1 0 11.4 0" />
  </>,
);
export const SmileIcon = glyph(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 14.5c1.8 2.7 6.2 2.7 8 0M8.5 9h.01M15.5 9h.01" />
  </>,
);
export const SendIcon = glyph(
  <>
    <path d="m21 3-7 18-4-7-7-4 18-7ZM10 14 21 3" />
  </>,
);
export const LinkIcon = glyph(
  <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2" />,
);
export const HelpIcon = glyph(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1.1.7-1.5 1.2-1.5 2.5M12 17h.01" />
  </>,
);
export const ChevronIcon = glyph(<path d="m8 10 4 4 4-4" />);
export const ExitIcon = glyph(
  <>
    <path d="M10 4H5v16h5M10 12h11m-4-4 4 4-4 4" />
  </>,
);
export const ChatIcon = glyph(
  <path d="M20 15a3 3 0 0 1-3 3H9l-5 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v9Z" />,
);
export const ClockIcon = glyph(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </>,
);
export const DoubleCheckIcon = glyph(
  <>
    <path d="m2 12 4 4L16 6M10 14l2 2L22 6" />
  </>,
);
export const ReplyIcon = glyph(
  <path d="M9 14 4 9l5-5M4 9h9a7 7 0 0 1 7 7v4" />,
);
