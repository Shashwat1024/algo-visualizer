import { AlertCircleIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/** Map a raw Python error onto a title and a concrete next step, so failures
 *  read as guidance rather than as a stack trace. */
function explain(message: string): { title: string; hint: string } {
  if (/^SyntaxError|^IndentationError|^TabError/.test(message)) {
    return {
      title: "That code will not parse",
      hint: "Check the highlighted line for a missing colon, bracket, or inconsistent indentation.",
    };
  }
  if (/Step limit of/.test(message)) {
    return {
      title: "Stopped - possible infinite loop",
      hint: "The code ran past the step limit without finishing. Check that every loop makes progress toward its exit condition.",
    };
  }
  if (/No function definition found/.test(message)) {
    return {
      title: "Nothing to run",
      hint: "Define a function that takes a list, or call a function yourself at the bottom of the snippet.",
    };
  }
  if (/Could not run/.test(message)) {
    return {
      title: "Could not call your function",
      hint: "The entry function needs to be callable with a single list argument, or you can call it yourself with your own input.",
    };
  }
  if (/^ModuleNotFoundError|^ImportError/.test(message)) {
    return {
      title: "That import is not available",
      hint: "Code runs in Pyodide in your browser. The standard library works, but third-party packages are not installed.",
    };
  }
  if (/^RecursionError/.test(message)) {
    return {
      title: "Recursion went too deep",
      hint: "Check the base case - the recursion never reached a stopping point.",
    };
  }
  return {
    title: "That code raised an error",
    hint: "The error below came from running your code.",
  };
}

export default function TraceErrorAlert({
  message,
  line,
}: {
  message: string;
  line: number | null;
}) {
  const { title, hint } = explain(message);

  return (
    <Alert variant="destructive" className="text-left">
      <AlertCircleIcon />
      <AlertTitle>
        {title}
        {line !== null && (
          <span className="ml-2 font-mono text-xs font-normal">
            line {line}
          </span>
        )}
      </AlertTitle>
      <AlertDescription className="space-y-2">
        <p>{hint}</p>
        <code className="block rounded bg-destructive/10 px-2 py-1 font-mono text-xs break-all">
          {message}
        </code>
      </AlertDescription>
    </Alert>
  );
}
