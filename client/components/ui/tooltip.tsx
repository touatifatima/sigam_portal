import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, children, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={className}
      style={{
        zIndex: 9999,
        overflow: "hidden",
        borderRadius: 12,
        border: "1px solid rgba(226, 232, 240, 0.95)",
        background: "rgba(255, 255, 255, 0.98)",
        padding: "8px 10px",
        color: "#334155",
        fontSize: 12,
        lineHeight: 1.45,
        boxShadow: "0 14px 32px rgba(15, 23, 42, 0.12)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        maxWidth: 280,
      }}
      {...props}
    >
      <div style={{ position: "relative", zIndex: 1 }}>
        {children}
      </div>
      <TooltipPrimitive.Arrow
        width={8}
        height={4}
        style={{
          fill: "rgba(255, 255, 255, 0.98)",
          stroke: "rgba(226, 232, 240, 0.95)",
          strokeWidth: 1,
        }}
      />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
