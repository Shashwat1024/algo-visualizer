import { pickIndices } from "../../lib/structures";

export default function BarsRenderer({
  items,
  scalars,
}: {
  items: (number | string)[];
  scalars: Record<string, number | string>;
}) {
  const values = items.map((item) =>
    typeof item === "number" ? item : Number(item) || 0
  );
  const max = Math.max(...values, 1);
  const highlighted = new Set(pickIndices(scalars, values.length));
  const showLabels = values.length <= 20;

  if (values.length === 0) {
    return <EmptyRow />;
  }

  return (
    <div className="flex h-56 w-full items-end justify-center gap-1">
      {values.map((value, index) => (
        <div
          key={index}
          title={String(value)}
          className={`flex w-full max-w-10 flex-col items-center justify-end rounded-t-md transition-all duration-150 ${
            highlighted.has(index) ? "bg-bar-compare" : "bg-bar"
          }`}
          style={{ height: `${(value / max) * 100}%` }}
        >
          {showLabels && (
            <span className="mb-1 font-mono text-[11px] tabular-nums text-background">
              {value}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function EmptyRow() {
  return (
    <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
      empty
    </div>
  );
}
