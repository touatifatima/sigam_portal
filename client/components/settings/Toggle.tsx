import { useState } from "react";

type ToggleProps = {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
};

export default function Toggle({ checked, defaultChecked = false, onChange }: ToggleProps) {
  const [internalChecked, setInternalChecked] = useState(defaultChecked);
  const isControlled = typeof checked === "boolean";
  const currentChecked = isControlled ? checked : internalChecked;

  const toggle = () => {
    const next = !currentChecked;
    if (!isControlled) {
      setInternalChecked(next);
    }
    onChange?.(next);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={currentChecked}
      aria-label={currentChecked ? "Désactiver" : "Activer"}
      onClick={toggle}
      style={{
        position: "relative",
        width: 52,
        height: 30,
        padding: 2,
        borderRadius: 9999,
        border: `1px solid ${currentChecked ? "rgba(51, 65, 85, 0.55)" : "rgba(203, 213, 225, 1)"}`,
        background: currentChecked
          ? "linear-gradient(135deg, #334155 0%, #0f172a 100%)"
          : "linear-gradient(135deg, #e2e8f0 0%, #f8fafc 100%)",
        boxShadow: currentChecked
          ? "0 10px 20px rgba(15, 23, 42, 0.18)"
          : "inset 0 1px 2px rgba(15, 23, 42, 0.08)",
        cursor: "pointer",
        transition: "all 180ms ease",
        appearance: "none",
        WebkitAppearance: "none",
        outline: "none",
        flexShrink: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 3,
          left: 3,
          width: 24,
          height: 24,
          borderRadius: 9999,
          background: "#ffffff",
          boxShadow: "0 4px 10px rgba(15, 23, 42, 0.18)",
          transform: currentChecked ? "translateX(22px)" : "translateX(0)",
          transition: "transform 180ms ease, box-shadow 180ms ease",
        }}
      />
    </button>
  );
}
