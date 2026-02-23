import { useState, useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { showUpdateToast } from "../../App";
import { Button } from "../ui";
import { RefreshCwIcon, SpinnerIcon, GithubIcon } from "../icons";
import { useT, useI18n } from "../../i18n";

export function AboutSettingsSection() {
  const t = useT();
  const { locale } = useI18n();
  const [appVersion, setAppVersion] = useState<string>("");
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  useEffect(() => {
    getVersion()
      .then(setAppVersion)
      .catch(() => {});
  }, []);

  const handleCheckForUpdates = async () => {
    setCheckingUpdate(true);
    const result = await showUpdateToast();
    setCheckingUpdate(false);
    if (result === "no-update") {
      toast.success(t("about.latestVersion"));
    } else if (result === "error") {
      toast.error(t("about.checkFailed"));
    }
  };

  const handleOpenUrl = async (url: string) => {
    try {
      await invoke("open_url_safe", { url });
    } catch (err) {
      console.error("Failed to open URL:", err);
      toast.error(err instanceof Error ? err.message : "Failed to open URL");
    }
  };

  return (
    <div className="space-y-8 py-8">
      {/* Version */}
      <section className="pb-2">
        <h2 className="text-xl font-medium mb-0.5">{t("about.version")}</h2>
        <p className="text-sm text-text-muted mb-4">
          {t("about.currentVersion", { version: appVersion || "..." })}
        </p>
        <Button
          onClick={handleCheckForUpdates}
          disabled={checkingUpdate}
          variant="outline"
          size="md"
          className="gap-1.25"
        >
          {checkingUpdate ? (
            <>
              <SpinnerIcon className="w-4.5 h-4.5 stroke-[1.5] animate-spin" />
              {t("about.checking")}
            </>
          ) : (
            <>
              <RefreshCwIcon className="w-4.5 h-4.5 stroke-[1.5]" />
              {t("about.checkUpdates")}
            </>
          )}
        </Button>
      </section>

      {/* Divider */}
      <div className="border-t border-border border-dashed" />

      {/* About Section */}
      <section className="pb-2">
        <h2 className="text-xl font-medium mb-1">{t("about.title")}</h2>
        <p className="text-sm text-text-muted mb-4">
          {t("about.description")}
        </p>
        <p className="text-sm text-text-muted mb-4">
          {t("about.createdBy")}{" "}
          <button
            onClick={() => handleOpenUrl(locale === "zh-CN" ? "https://imzl.com" : "https://x.com/zhoulianglen")}
            className="text-text-muted border-b border-text-muted/50 hover:text-text hover:border-text cursor-pointer transition-colors"
          >
            {t("about.authorName")}
          </button>
        </p>
        <div className="flex items-center gap-1">
          <Button
            onClick={() => handleOpenUrl("https://github.com/zhoulianglen/verso")}
            variant="outline"
            size="md"
            className="gap-1.25"
          >
            <GithubIcon className="w-4.5 h-4.5 stroke-[1.5]" />
            {t("about.viewGithub")}
          </Button>
          <Button
            onClick={() =>
              handleOpenUrl("https://github.com/zhoulianglen/verso/issues")
            }
            variant="ghost"
            size="md"
            className="gap-1.25 text-text"
          >
            {t("about.submitFeedback")}
          </Button>
        </div>
      </section>
    </div>
  );
}
