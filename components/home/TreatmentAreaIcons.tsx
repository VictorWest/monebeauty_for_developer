/**
 * Line art for the three treatment areas on the homepage.
 *
 * Phosphor has no equivalent for any of these: its closest matches read as a face-scanner,
 * a stick figure and a salon hairdryer: so they are drawn here to match the client's
 * reference mockup. Weight and cap/join style deliberately mirror the `weight="thin"`
 * Phosphor icons used elsewhere on the page so the set reads as one family.
 */

type IconProps = { size?: number };
type DecorativeIconProps = { className?: string };

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.45,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
} as const;

/** A woman's face in profile, with the swept hair and fine facial detail from the reference. */
export function FaceProfileIcon({ size = 40 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" {...base}>
      <path d="M29.5 5.5c-9.2 0-16.7 7.3-16.7 16.4 0 2.8-.8 5.1-2.5 7l-2.4 2.7c-.8.9-.3 2.3.9 2.5l3.5.6-.1 2.5c-.1 3.1 2.4 5.7 5.5 5.7h5.7" />
      <path d="M29.5 5.5c8.8 1.1 14.5 9.6 12.6 18.2-1.1 5-4.2 9.3-8.6 11.8l-2.8 1.6" />
      <path d="M29.5 5.5c-5.8 2.7-9.3 7.6-9.6 13.5-.2 4.6 1.5 8.7 5 12.1" />
      <path d="M23.4 42.9v4" />
      <path d="M30.7 37.1v3.2c0 3.5 2.8 6.3 6.3 6.3" />
      <path d="M13.2 22.4c1.5-.8 3.2-.9 4.8-.2" />
      <path d="M13 26.1c1 .5 2 .5 3 0" />
      <path d="M11.8 37.6c1.7.7 3.5.7 5.2 0" />
      <path d="M25 31.1c2.3-.1 4.1-2 4.1-4.3 0-2.1-1.5-3.9-3.5-4.3" />
    </svg>
  );
}

/** A balanced front-facing torso with the reference's long waist and curved hip line. */
export function BodyIcon({ size = 40 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" {...base}>
      <path d="M15.1 4.8c2.3-1.4 4.8-2.1 7.4-2.1h3c2.6 0 5.1.7 7.4 2.1" />
      <path d="M15.1 4.8c-1.1 3.5-3.3 6.4-6.5 8.5 3.2 4.7 5.1 9.3 5.5 13.9.3 3.4-.8 6.9-2.5 10.4-1.2 2.5-1.1 5.5.3 7.9" />
      <path d="M32.9 4.8c1.1 3.5 3.3 6.4 6.5 8.5-3.2 4.7-5.1 9.3-5.5 13.9-.3 3.4.8 6.9 2.5 10.4 1.2 2.5 1.1 5.5-.3 7.9" />
      <path d="M15.1 4.8c.2 6.8 3.2 10.4 8.9 10.7 5.7-.3 8.7-3.9 8.9-10.7" />
      <path d="M14.1 27.2c2.8 2.2 6.1 3.3 9.9 3.3s7.1-1.1 9.9-3.3" />
      <path d="M12 45.5c3.6-2.4 7.6-3.6 12-3.6s8.4 1.2 12 3.6" />
      <path d="M24 15.5v15" />
    </svg>
  );
}

/** A profile framed by long, flowing hair rather than the previous sparse head outline. */
export function HairIcon({ size = 40 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" {...base}>
      <path d="M23.7 4.4c8.7 0 15.8 7.1 15.8 15.8 0 2.7.8 5 2.4 6.9l2.1 2.4c.8.9.3 2.3-.9 2.5l-3 .5c.2 2.4-.6 4.4-2.4 5.7-2 1.5-4.8 1.6-7.3.7" />
      <path d="M23.7 4.4C14 5.8 7.6 14.7 9.1 24.5c.5 3.1 1.8 5.9 3.9 8.4" />
      <path d="M11.7 18.9C6.2 27.5 7.3 38.8 14.5 46" />
      <path d="M16.1 20.7c-3.3 8-1.3 17.5 5.2 23.3" />
      <path d="M20.4 21.7c-1.8 7.3.5 15.2 6.1 20.2" />
      <path d="M30.4 38.9v2.3c0 3.1 2.5 5.6 5.6 5.6" />
      <path d="M38.9 21.2c-1.7-.8-3.5-.9-5.2-.1" />
      <path d="M39.5 25.2c-1 .5-2 .5-3 0" />
      <path d="M40.1 35.2c-1.7.7-3.5.7-5.2 0" />
    </svg>
  );
}

/** Compact male symbol sized optically to the three anatomical drawings. */
export function MaleIcon({ size = 40 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" {...base}>
      <circle cx="19" cy="29" r="10.5" />
      <path d="M26.5 21.5 40 8" />
      <path d="M31.5 8H40v8.5" />
    </svg>
  );
}

/** Airy dried-flower line art that sits behind the benefits disc in the desktop reference. */
export function BotanicalSprig({ className }: DecorativeIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 118 190"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15 188C39 152 52 117 57 76C60 50 70 25 88 3" />
        <path d="M41 145C60 132 75 114 85 91" />
        <path d="M52 111C38 98 28 83 22 65" />
        <path d="M60 75C78 66 92 52 102 34" />
        <path d="M67 54C58 43 54 31 55 18" />
        <path d="M84 92C98 84 108 72 114 57" />
      </g>
      <g fill="currentColor">
        <circle cx="89" cy="4" r="3.1" />
        <circle cx="103" cy="33" r="2.8" />
        <circle cx="115" cy="56" r="2.5" />
        <circle cx="56" cy="17" r="2.7" />
        <circle cx="21" cy="64" r="2.8" />
        <circle cx="85" cy="90" r="2.5" />
      </g>
    </svg>
  );
}
