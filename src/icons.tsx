const PATHS = {
  left: "M15 18l-6-6 6-6",
  right: "M9 6l6 6-6 6",
  close: "M6 6l12 12M18 6L6 18",
  pin: "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z M12 12.2a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2",
  calendar: "M4 6h16v15H4z M4 10h16 M8 3v4 M16 3v4",
  notes: "M5 4h14v16H5z M8 9h8 M8 13h8 M8 17h5",
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  return (
    <svg
      class="i"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
