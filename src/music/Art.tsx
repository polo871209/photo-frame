import { Icon } from "../icons";

export function Art({
  src,
  class: className,
}: {
  src: string | null;
  class: string;
}) {
  if (!src) {
    return (
      <div class={`${className} music-art-empty`}>
        <Icon name="music" size={40} />
      </div>
    );
  }
  return <img class={className} src={src} alt="" />;
}
