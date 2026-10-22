import { useEffect, useState } from "preact/hooks";
import { Calendar } from "./calendar/Calendar";

const STAGE_WIDTH = 1280;
const STAGE_HEIGHT = 800;

export function App() {
  const [scale, setScale] = useState(fitScale);
  useEffect(() => {
    const onResize = () => setScale(fitScale());
    addEventListener("resize", onResize);
    return () => removeEventListener("resize", onResize);
  }, []);
  return (
    <div class="stage" style={`transform:scale(${scale})`}>
      <Calendar />
    </div>
  );
}

function fitScale(): number {
  return Math.min(innerWidth / STAGE_WIDTH, innerHeight / STAGE_HEIGHT);
}
