import React, { useEffect, useState, type ComponentType } from "react";

// Safe wrapper that loads the Vercel Speed Insights React component lazily.
// This avoids a hard dependency on server-only or Next-specific runtime code.
export function SpeedInsightsWrapper(): React.ReactNode {
  const [Component, setComponent] = useState<ComponentType | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const mod = await import("@vercel/speed-insights/react");
        const LoadedComponent = (mod as any).SpeedInsights || (mod as any).default;
        if (mounted && LoadedComponent) {
          setComponent(() => LoadedComponent as ComponentType);
        }
      } catch {
        // ignore missing package or incompatible environment
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return Component ? <Component /> : null;
}
