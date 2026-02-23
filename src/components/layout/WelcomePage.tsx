import { useState, useEffect } from "react";
import { detectLocale, createT } from "../../i18n";
import type { TranslateFn } from "../../i18n";
import { WelcomeIllustration } from "../illustrations";

export function WelcomePage() {
  const [t, setT] = useState<TranslateFn>(() => createT("en"));

  useEffect(() => {
    detectLocale().then((locale) => {
      setT(() => createT(locale));
    });
  }, []);

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Draggable title bar area */}
      <div className="h-10 shrink-0" data-tauri-drag-region />

      <div className="flex-1 flex items-center justify-center">
        <div className="text-center p-8 max-w-lg select-none">
          <WelcomeIllustration
            className="w-56 h-auto mx-auto mb-2 text-text animate-fade-in-up"
          />

          <h1
            className="text-3xl text-text font-sans font-semibold mb-2 tracking-[-0.01em] animate-fade-in-up"
            style={{ animationDelay: "100ms" }}
          >
            {t("welcome.title")}
          </h1>
          <p
            className="text-text-muted mb-6 animate-fade-in-up"
            style={{ animationDelay: "100ms" }}
          >
            {t("welcome.description")}
          </p>
        </div>
      </div>
    </div>
  );
}
