/** Boxes in a row for stacks, queues, and non-numeric lists. The end that
 *  items enter or leave from is labelled, since that is what distinguishes a
 *  stack from a queue visually. */
export default function SequenceRenderer({
  items,
  role,
}: {
  items: (number | string)[];
  role: "stack" | "queue" | "array";
}) {
  if (items.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        empty
      </div>
    );
  }

  const activeIndex = role === "queue" ? 0 : items.length - 1;
  const activeLabel = role === "queue" ? "front" : role === "stack" ? "top" : null;

  return (
    <div className="flex h-56 w-full flex-wrap content-center items-center justify-center gap-2 py-4">
      {items.map((item, index) => {
        const isActive = activeLabel !== null && index === activeIndex;
        return (
          <div key={index} className="flex flex-col items-center gap-1">
            <div
              className={`flex h-11 min-w-11 items-center justify-center rounded-md px-2 font-mono text-sm transition-colors ${
                isActive
                  ? "bg-bar-compare text-background"
                  : "bg-bar text-background"
              }`}
            >
              {item}
            </div>
            <span className="h-3 font-mono text-[10px] text-muted-foreground">
              {isActive ? activeLabel : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
