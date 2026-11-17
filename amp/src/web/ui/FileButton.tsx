import { useRef, type ReactNode } from "react";
import { Button, type ButtonVariant } from "./Button";

/**
 * A designed control that chooses a file: a button, with the browser's file
 * input kept out of sight and out of the tab order behind it. `label` names
 * the choice for assistive technology and tests ("Choose a roster file").
 */
export function FileButton({
  label,
  accept,
  onFile,
  variant,
  busy,
  disabled,
  children,
}: {
  label: string;
  accept?: string;
  onFile: (file: File) => void;
  variant: ButtonVariant;
  busy?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        tabIndex={-1}
        aria-label={label}
        accept={accept}
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: "none",
        }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          // The same file can be chosen again after a fix.
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
      <Button
        variant={variant}
        aria-busy={busy}
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        {children}
      </Button>
    </>
  );
}
