import { useEffect, useState } from "preact/hooks";
import type { FrameSettings, ScreenId } from "../../shared/control";
import { restartKiosk, type FrameControl } from "../control/useFrameControl";
import { Icon, type IconName } from "../icons";
import { playChime } from "../lib/chime";
import { clockParts } from "../lib/dates";
import { useTheme } from "../lib/theme";
import { useNow } from "../lib/useNow";

export interface ScreenEntry {
  id: ScreenId;
  label: string;
  icon: IconName;
}

/** The screen buttons and the clock at the top right. The clock opens the device settings. */
export function Menu({
  screens,
  screen,
  onPick,
  control,
}: {
  screens: readonly ScreenEntry[];
  screen: ScreenId;
  onPick: (id: ScreenId) => void;
  control: FrameControl;
}) {
  const [open, setOpen] = useState(false);
  const [touchedAt, setTouchedAt] = useState(0);
  const { time, period } = clockParts(useNow());
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setOpen(false), 30_000);
    return () => clearTimeout(timer);
  }, [open, touchedAt]);

  return (
    <div class={`menu${open ? " is-open" : ""}`}>
      <div class="menu-scrim" onClick={() => setOpen(false)} />
      <nav class="menu-screens">
        {screens.map(({ id, label, icon }) => (
          <button
            key={id}
            class={id === screen ? "is-on" : ""}
            aria-label={label}
            onClick={() => {
              onPick(id);
              setOpen(false);
            }}
          >
            <Icon name={icon} size={30} />
          </button>
        ))}
      </nav>
      <button
        class="menu-btn"
        aria-label="Device settings"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span class="num">{time}</span>
        {period && <span class="label">{period}</span>}
        <Icon name="down" size={24} />
      </button>
      <div
        class="menu-panel"
        aria-hidden={!open}
        onPointerDown={() => setTouchedAt(Date.now())}
      >
        <DeviceSettings control={control} onClose={() => setOpen(false)} />
      </div>
    </div>
  );
}

function DeviceSettings({
  control,
  onClose,
}: {
  control: FrameControl;
  onClose: () => void;
}) {
  const { settings, preview, send } = control;
  const [theme, toggleTheme] = useTheme();
  const save = (changes: Partial<FrameSettings>) =>
    send({ type: "set", settings: changes });

  return (
    <>
      <Slider
        icon="sun"
        label="Brightness"
        min={1}
        value={settings.brightness}
        onInput={(brightness) => preview({ brightness })}
        onChange={(brightness) => save({ brightness })}
      />
      <Slider
        icon="volume"
        label="Volume"
        min={0}
        value={settings.volume}
        onInput={(volume) => preview({ volume })}
        onChange={(volume) => {
          save({ volume });
          playChime();
        }}
      />
      <div class="dev-group">
        <Toggle
          icon="moon"
          label="Dark mode"
          on={theme === "dark"}
          onToggle={toggleTheme}
        />
        <Toggle
          icon="bell"
          label="Event chimes"
          on={settings.chimes}
          onToggle={() => save({ chimes: !settings.chimes })}
        />
      </div>
      <div class="dev-actions">
        <button
          class="dev-action"
          onClick={() => {
            onClose();
            save({ screenOn: false });
          }}
        >
          <Icon name="power" />
          Screen off
        </button>
        <button class="dev-action" onClick={restartKiosk}>
          <Icon name="restart" />
          Restart
        </button>
      </div>
    </>
  );
}

function Slider({
  icon,
  label,
  min,
  value,
  onInput,
  onChange,
}: {
  icon: IconName;
  label: string;
  min: number;
  value: number;
  onInput: (value: number) => void;
  onChange: (value: number) => void;
}) {
  const percent = Math.round(value * 100);
  const filled = ((percent - min) / (100 - min)) * 100;
  const read = (event: Event) =>
    Number((event.currentTarget as HTMLInputElement).value) / 100;
  return (
    <label class="dev-slider">
      <span class="dev-row">
        <Icon name={icon} size={26} />
        <span class="dev-label">{label}</span>
        <span class="num dev-value">{percent}%</span>
      </span>
      <input
        type="range"
        class="range"
        min={min}
        max={100}
        value={percent}
        style={`--filled:${filled}%`}
        onInput={(event) => onInput(read(event))}
        onChange={(event) => onChange(read(event))}
      />
    </label>
  );
}

function Toggle({
  icon,
  label,
  on,
  onToggle,
}: {
  icon: IconName;
  label: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button class="dev-row dev-toggle" aria-pressed={on} onClick={onToggle}>
      <Icon name={icon} size={26} />
      <span class="dev-label">{label}</span>
      <span class={`switch${on ? " is-on" : ""}`} />
    </button>
  );
}
