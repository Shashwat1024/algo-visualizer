"use client";

import dynamic from "next/dynamic";
import { python } from "@codemirror/lang-python";
import { useTheme } from "next-themes";

// CodeMirror touches the DOM on import, so keep it out of the server bundle.
const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), {
  ssr: false,
  loading: () => (
    <div className="h-72 animate-pulse rounded-lg border bg-muted/40" />
  ),
});

export default function CodeEditor({
  value,
  onChange,
  readOnly = false,
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}) {
  const { resolvedTheme } = useTheme();

  return (
    <div className="overflow-hidden rounded-lg border">
      <CodeMirror
        value={value}
        height="288px"
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        extensions={[python()]}
        onChange={onChange}
        readOnly={readOnly}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: !readOnly,
        }}
      />
    </div>
  );
}
