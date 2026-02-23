import { useMemo } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useI18n, useT } from "../../i18n";
import { Button, Input, Select } from "../ui";
import type { FontFamily, TextDirection, EditorWidth, LocaleSetting } from "../../types/note";
import { EyeIcon } from "../icons";
import { all, createLowlight } from "lowlight";
import { toHtml } from "hast-util-to-html";

const previewLowlight = createLowlight(all);

// Text direction options
const textDirectionOptions: { value: TextDirection; label: string }[] = [
  { value: "ltr", label: "LTR" },
  { value: "rtl", label: "RTL" },
];

// Page width options
const editorWidthOptions: { value: EditorWidth; label: string }[] = [
  { value: "narrow", label: "Narrow" },
  { value: "normal", label: "Normal" },
  { value: "wide", label: "Wide" },
  { value: "full", label: "Full" },
];

// Font family options
const fontFamilyOptions: { value: FontFamily; label: string }[] = [
  { value: "system-sans", label: "Sans" },
  { value: "serif", label: "Serif" },
  { value: "monospace", label: "Mono" },
];

// Bold weight options (medium excluded for monospace)
const boldWeightOptions = [
  { value: 500, label: "Medium", excludeForMonospace: true },
  { value: 600, label: "Semibold", excludeForMonospace: false },
  { value: 700, label: "Bold", excludeForMonospace: false },
  { value: 800, label: "Extra Bold", excludeForMonospace: false },
];

export function AppearanceSettingsSection() {
  const {
    theme,
    resolvedTheme,
    setTheme,
    editorFontSettings,
    setEditorFontSetting,
    resetEditorFontSettings,
    textDirection,
    setTextDirection,
    editorWidth,
    setEditorWidth,
  } = useTheme();
  const { locale, localeSetting, setLocaleSetting } = useI18n();
  const t = useT();
  const isZh = locale === "zh-CN";

  const previewCodeHtml = useMemo(() => {
    const code = isZh
      ? `// 百草园的四季\nfunction seasons(garden: Garden) {\n  const spring = garden.bloom("菜畦", "桑椹");\n  const summer = garden.listen("蝉鸣", "蟋蟀");\n  const autumn = garden.harvest("覆盆子");\n\n  return { spring, summer, autumn };\n}`
      : `// Stray birds in code\nfunction strayBirds(sky: Sky) {\n  const summer = sky.watch("birds sing");\n  const autumn = sky.watch("leaves fall");\n  const stars = sky.count("after tears");\n\n  return { summer, autumn, stars };\n}`;
    const tree = previewLowlight.highlight("typescript", code);
    return toHtml(tree);
  }, [isZh]);

  // Validated numeric change handler
  const handleNumericChange = (
    field: "baseFontSize" | "lineHeight",
    value: string,
    min: number,
    max: number,
  ) => {
    const parsed = parseFloat(value);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.min(Math.max(parsed, min), max);
    setEditorFontSetting(field, clamped);
  };

  // Check if settings differ from defaults
  const hasCustomFonts =
    editorFontSettings.baseFontFamily !== "system-sans" ||
    editorFontSettings.baseFontSize !== 17 ||
    editorFontSettings.boldWeight !== 600 ||
    editorFontSettings.lineHeight !== 1.6 ||
    textDirection !== "ltr" ||
    editorWidth !== "normal";

  // Filter weight options based on font family
  const isMonospace = editorFontSettings.baseFontFamily === "monospace";
  const availableWeightOptions = boldWeightOptions.filter(
    (opt) => !isMonospace || !opt.excludeForMonospace,
  );

  // Handle font family change - bump up weight if needed
  const handleFontFamilyChange = (newFamily: FontFamily) => {
    setEditorFontSetting("baseFontFamily", newFamily);
    // If switching to monospace and current weight is medium, bump to semibold
    if (newFamily === "monospace" && editorFontSettings.boldWeight === 500) {
      setEditorFontSetting("boldWeight", 600);
    }
  };

  return (
    <div className="space-y-8 py-8">
      {/* Language Section */}
      <section className="pb-2">
        <h2 className="text-xl font-medium mb-3">Language / 语言</h2>
        <div className="flex gap-2 p-1 rounded-[10px] border border-border">
          {([
            { value: "auto" as LocaleSetting, label: "Auto (System)" },
            { value: "en" as LocaleSetting, label: "English" },
            { value: "zh-CN" as LocaleSetting, label: "中文" },
          ]).map((opt) => (
            <Button
              key={opt.value}
              onClick={() => setLocaleSetting(opt.value)}
              variant={localeSetting === opt.value ? "primary" : "ghost"}
              size="md"
              className="flex-1"
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="border-t border-border border-dashed" />

      {/* Theme Section */}
      <section className="pb-2">
        <h2 className="text-xl font-medium mb-3">{t("appearance.theme")}</h2>
        <div className="flex gap-2 p-1 rounded-[10px] border border-border">
          {(["light", "dark", "system"] as const).map((mode) => (
            <Button
              key={mode}
              onClick={() => setTheme(mode)}
              variant={theme === mode ? "primary" : "ghost"}
              size="md"
              className="flex-1"
            >
              {t(`appearance.${mode}` as any)}
            </Button>
          ))}
        </div>
        {theme === "system" && (
          <p className="mt-3 text-sm text-text-muted">
            {t("appearance.systemUsing", { mode: resolvedTheme })}
          </p>
        )}
      </section>

      {/* Divider */}
      <div className="border-t border-border border-dashed" />

      {/* Typography Section */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-xl font-medium">{t("appearance.typography")}</h2>
          {hasCustomFonts && (
            <Button onClick={resetEditorFontSettings} variant="ghost" size="sm">
              {t("appearance.resetDefaults")}
            </Button>
          )}
        </div>

        <div className="rounded-[10px] border border-border pl-4 py-3 pr-3 space-y-2">
          {/* Font Family */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-text font-medium">{t("appearance.font")}</label>
            <Select
              value={editorFontSettings.baseFontFamily}
              onChange={(e) =>
                handleFontFamilyChange(e.target.value as FontFamily)
              }
              className="w-40"
            >
              {fontFamilyOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Base Font Size */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-text font-medium">{t("appearance.size")}</label>
            <div className="relative w-40">
              <Input
                type="number"
                min="12"
                max="24"
                value={editorFontSettings.baseFontSize}
                onChange={(e) =>
                  handleNumericChange("baseFontSize", e.target.value, 12, 24)
                }
                className="w-full h-9 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>

          {/* Bold Weight */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-text font-medium">{t("appearance.boldWeight")}</label>
            <Select
              value={editorFontSettings.boldWeight}
              onChange={(e) =>
                setEditorFontSetting("boldWeight", Number(e.target.value))
              }
              className="w-40"
            >
              {availableWeightOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Line Height */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-text font-medium">{t("appearance.lineHeight")}</label>
            <div className="relative w-40">
              <Input
                type="number"
                min="1.0"
                max="2.5"
                step="0.1"
                value={editorFontSettings.lineHeight}
                onChange={(e) =>
                  handleNumericChange("lineHeight", e.target.value, 1.0, 2.5)
                }
                className="w-full h-9 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>

          {/* Text Direction */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-text font-medium">
              {t("appearance.textDirection")}
            </label>
            <Select
              value={textDirection}
              onChange={(e) =>
                setTextDirection(e.target.value as TextDirection)
              }
              className="w-40"
            >
              {textDirectionOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Page Width */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-text font-medium">{t("appearance.pageWidth")}</label>
            <Select
              value={editorWidth}
              onChange={(e) => setEditorWidth(e.target.value as EditorWidth)}
              className="w-40"
            >
              {editorWidthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Preview */}
        <div className="mt-3 relative">
          <div className="absolute top-3 left-4 flex items-center text-sm font-medium text-text-muted/70 gap-1">
            <EyeIcon className="w-4.5 h-4.5 stroke-[1.5]" />
            <span>{t("appearance.preview")}</span>
          </div>
          <div className="border border-border rounded-[10px] bg-bg p-6 pt-20 max-h-240 overflow-hidden rounded-t-lg">
            <div
              className="prose prose-lg dark:prose-invert max-w-xl mx-auto"
              dir={textDirection}
              style={{
                fontFamily:
                  editorFontSettings.baseFontFamily === "system-sans"
                    ? "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                    : editorFontSettings.baseFontFamily === "serif"
                      ? "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif"
                      : "ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace",
                fontSize: `${editorFontSettings.baseFontSize}px`,
              }}
            >
              {isZh ? (
                <>
                  <h1>从百草园到三味书屋</h1>
                  <p>
                    我家的后面有一个很大的园，相传叫作<strong>百草园</strong>。现在是早已并屋子一起卖给朱文公的子孙了，连那最末次的相见也已经隔了七八年，其中似乎确凿只有一些野草；但那时却是我的<em>乐园</em>。
                  </p>
                  <h2>碧绿的菜畦</h2>
                  <p>
                    不必说碧绿的菜畦，光滑的石井栏，高大的皂荚树，紫红的桑椹；也不必说鸣蝉在树叶里长吟，肥胖的黄蜂伏在菜花上，轻捷的叫天子（云雀）忽然从草间直窜向云霄里去了。单是周围的短短的泥墙根一带，就有<strong>无限趣味</strong>。
                  </p>
                  <ul>
                    <li>油蛉在这里低唱，蟋蟀们在这里弹琴</li>
                    <li>翻开断砖来，有时会遇见蜈蚣</li>
                    <li>还有斑蝥，倘若用手指按住它的脊梁，便会拍的一声，从后窍喷出一阵烟雾</li>
                    <li>何首乌藤和木莲藤缠络着，木莲有莲房一般的果实</li>
                  </ul>
                  <blockquote><p>如果不怕刺，还可以摘到覆盆子，像小珊瑚珠攒成的小球，又酸又甜，色味都比桑椹要好得远。</p></blockquote>
                </>
              ) : (
                <>
                  <h1>Stray Birds</h1>
                  <p>
                    Stray birds of summer come to my window to <strong>sing and fly away</strong>. And yellow leaves of autumn, which have no songs, flutter and fall there with a sigh.
                  </p>
                  <h2>Fragments of Light</h2>
                  <p>
                    If you shed tears when you miss the sun, you also miss the stars. The world puts off its mask of vastness to its lover. It becomes small as one song, as <em>one kiss of the eternal</em>.
                  </p>
                  <ul>
                    <li>It is the tears of the earth that keep her smiles in bloom</li>
                    <li>The mighty desert is burning for the love of a blade of grass who shakes her head and laughs and flies away</li>
                    <li>If you shut your door to all errors, truth will be shut out</li>
                    <li>I think of other ages that floated behind the mind — and I feel the freedom of great spaces within me</li>
                  </ul>
                  <blockquote><p>Let life be beautiful like summer flowers and death like autumn leaves. Do not linger to gather flowers to keep them, but walk on, for flowers will keep themselves blooming all your way.</p></blockquote>
                </>
              )}
              <pre>
                <code dangerouslySetInnerHTML={{ __html: previewCodeHtml }} />
              </pre>
            </div>
          </div>
          {/* Fade overlay - content to muted background */}
          <div className="absolute bottom-0 left-0 right-0 h-40 bg-linear-to-t from-bg to-transparent pointer-events-none" />
        </div>
      </section>
    </div>
  );
}
