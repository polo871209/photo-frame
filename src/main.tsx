import "@fontsource-variable/archivo/wdth.css";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/calendar.css";
import { render } from "preact";
import { App } from "./App";

render(<App />, document.getElementById("app")!);
