import * as React from "react";
import { Info } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type FieldHelpProps = {
  label: string;
  helpText: string;
  htmlFor?: string;
  required?: boolean;
  className?: string;
};

export function FieldHelp({ label, helpText, htmlFor, required, className }: FieldHelpProps) {
  const safeHelpText = helpText.trim() || "Information à compléter.";

  return (
    <TooltipProvider delayDuration={70}>
      <div
        className={className}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.3rem",
          flexWrap: "wrap",
          minWidth: 0,
        }}
      >
        {htmlFor ? (
          <label
            htmlFor={htmlFor}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.22rem",
              fontSize: "0.86rem",
              fontWeight: 600,
              lineHeight: 1.2,
              color: "#2d1b27",
            }}
          >
            <span>{label}</span>
            {required ? <span style={{ color: "#c1124f" }}>*</span> : null}
          </label>
        ) : (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.22rem",
              fontSize: "0.86rem",
              fontWeight: 600,
              lineHeight: 1.2,
              color: "#2d1b27",
            }}
          >
            <span>{label}</span>
            {required ? <span style={{ color: "#c1124f" }}>*</span> : null}
          </span>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`Aide sur le champ ${label}`}
              style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                width: 16,
                height: 16,
                borderRadius: 9999,
                border: "1px solid rgba(100, 116, 139, 0.4)",
                background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
                color: "#64748b",
                boxShadow: "0 1px 1px rgba(15, 23, 42, 0.08)",
                cursor: "help",
                padding: 0,
                transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, color 160ms ease, background 160ms ease",
                flex: "0 0 auto",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(71, 85, 105, 0.55)";
                e.currentTarget.style.background =
                  "linear-gradient(180deg, #ffffff 0%, #f3f4f6 100%)";
                e.currentTarget.style.color = "#334155";
                e.currentTarget.style.boxShadow = "0 2px 6px rgba(15, 23, 42, 0.10)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(100, 116, 139, 0.4)";
                e.currentTarget.style.background =
                  "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)";
                e.currentTarget.style.color = "#64748b";
                e.currentTarget.style.boxShadow = "0 1px 1px rgba(15, 23, 42, 0.08)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "rgba(71, 85, 105, 0.55)";
                e.currentTarget.style.boxShadow =
                  "0 0 0 3px rgba(71, 85, 105, 0.12), 0 2px 6px rgba(15, 23, 42, 0.10)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = "0 1px 1px rgba(15, 23, 42, 0.08)";
              }}
            >
              <Info style={{ width: 10, height: 10 }} aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" align="start">
            <div style={{ fontSize: 11.5, lineHeight: 1.45, color: "#334155", whiteSpace: "normal" }}>
              {safeHelpText}
            </div>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

type FieldHelpLabelProps = Omit<FieldHelpProps, "helpText"> & {
  helpText?: string;
};

export function FieldHelpLabel({
  label,
  helpText = "Renseignez ce champ comme demandé dans le dossier.",
  htmlFor,
  required,
  className,
}: FieldHelpLabelProps) {
  return (
    <FieldHelp
      label={label}
      helpText={helpText}
      htmlFor={htmlFor}
      required={required}
      className={className}
    />
  );
}
