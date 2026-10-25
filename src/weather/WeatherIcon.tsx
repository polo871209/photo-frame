export type Sky =
  | "clear"
  | "partly"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "heavy"
  | "showers"
  | "storm";

export function WeatherIcon({
  sky,
  isDay,
  size,
}: {
  sky: Sky;
  isDay: boolean;
  size: number;
}) {
  return (
    <svg
      class="i wxi"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
    >
      {SHAPES[sky](isDay)}
    </svg>
  );
}

export function RainDrop({ size }: { size: number }) {
  return (
    <svg
      class="i wxi"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        class="wxi-rain"
        d="M12 2.5C8.2 7.3 5.5 10.9 5.5 14.5a6.5 6.5 0 0 0 13 0c0-3.6-2.7-7.2-6.5-12z"
      />
    </svg>
  );
}

const SHAPES: Record<Sky, (isDay: boolean) => preact.JSX.Element> = {
  clear: (isDay) =>
    isDay ? <Sun x={24} y={24} r={9} /> : <Moon at="translate(4.4 4.4) scale(1.6)" />,
  partly: (isDay) => (
    <>
      {isDay ? (
        <Sun x={17} y={17} r={7} />
      ) : (
        <Moon at="scale(1.1)" />
      )}
      <Cloud at="translate(8 8) scale(.85)" />
    </>
  ),
  cloudy: () => <Cloud />,
  fog: () => (
    <>
      <Cloud at="translate(0 -7)" />
      <path class="wxi-fog" d="M8 38h26 M14 45h26" />
    </>
  ),
  drizzle: () => (
    <>
      <Cloud at="translate(0 -7)" />
      <path class="wxi-drop" d="M16 36l-1.5 5 M32 36l-1.5 5 M24 41l-1.5 5" />
    </>
  ),
  rain: () => (
    <>
      <Cloud at="translate(0 -7)" />
      <path class="wxi-drop" d="M17 36l-2 7 M25 36l-2 7 M33 36l-2 7" />
    </>
  ),
  heavy: () => (
    <>
      <Cloud at="translate(0 -7)" dark />
      <path
        class="wxi-drop"
        d="M14 36l-3 9 M21 36l-3 9 M28 36l-3 9 M35 36l-3 9"
      />
    </>
  ),
  showers: (isDay) => (
    <>
      {isDay ? (
        <Sun x={13} y={13} r={7} rays={false} />
      ) : (
        <Moon at="scale(.8)" />
      )}
      <Cloud at="translate(4 -7)" />
      <path class="wxi-drop" d="M22 36l-2 7 M30 36l-2 7 M38 36l-2 7" />
    </>
  ),
  storm: () => (
    <>
      <path class="wxi-bolt" d="M27 26L16 40h8l-4 8 13-14h-8l4-8z" />
      <Cloud at="translate(0 -7)" dark />
    </>
  ),
};

function Cloud({ at, dark }: { at?: string; dark?: boolean }) {
  return (
    <g class={dark ? "wxi-cloud-dark" : "wxi-cloud"} transform={at}>
      <circle cx="15" cy="30" r="9" />
      <circle cx="25" cy="22" r="12" />
      <circle cx="35" cy="31" r="8" />
      <rect x="15" y="30" width="20" height="9" />
    </g>
  );
}

function Sun({
  x,
  y,
  r,
  rays = true,
}: {
  x: number;
  y: number;
  r: number;
  rays?: boolean;
}) {
  const lines = rays
    ? Array.from({ length: 8 }, (_, i) => {
        const dx = Math.cos((i * Math.PI) / 4);
        const dy = Math.sin((i * Math.PI) / 4);
        return `M${x + dx * (r + 4)} ${y + dy * (r + 4)}L${x + dx * (r + 7)} ${y + dy * (r + 7)}`;
      }).join("")
    : "";
  return (
    <>
      <circle class="wxi-sun" cx={x} cy={y} r={r} />
      {rays && <path class="wxi-ray" d={lines} />}
    </>
  );
}

function Moon({ at }: { at: string }) {
  return (
    <path
      class="wxi-moon"
      transform={at}
      d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"
    />
  );
}
