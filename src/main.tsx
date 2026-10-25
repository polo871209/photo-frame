import "@fontsource/fira-sans/400.css";
import "@fontsource/fira-sans/600.css";
import "@fontsource/fira-sans/700.css";
import "@fontsource/fira-sans/800.css";
import "@fontsource/fira-sans-condensed/700.css";
import "@fontsource/fira-sans-condensed/800.css";
import "@fontsource/fira-sans-extra-condensed/800.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/calendar.css";
import "./styles/music.css";
import "./styles/weather.css";
import { render } from "preact";
import { App } from "./App";

render(<App />, document.getElementById("app")!);
