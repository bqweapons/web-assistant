import type { ReactNode } from 'react';
import {
  AArrowDown,
  AArrowUp,
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Italic,
  Underline,
} from 'lucide-react';
import SelectMenu from '../../components/SelectMenu';
import { t } from '../../utils/i18n';
import type { StylePreset } from './styleUtils';

// Pure presentational block extracted from ElementsSection — every
// mutation and computed value is passed in via props so the component
// has no dependency on the owning section's state beyond what appears
// here. Keep this file free of storage / messaging concerns so it can
// be reused for a future standalone style-editing surface.

type StyleEditorProps = {
  stylePresets: StylePreset[];
  currentPresetValue: string;
  shadowOptions: Array<{ value: string; label: string }>;
  positionOptions: Array<{ value: string; label: string }>;
  customCssValue: string;
  selectButtonClass: string;
  // Toolbar state
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  textAlignValue: string;
  // Resolved color values
  textColorValue: string;
  backgroundColorValue: string;
  // Layout values
  borderValue: string;
  borderRadiusValue: string;
  boxShadowValue: string;
  paddingValue: string;
  marginValue: string;
  // Position values
  positionValue: string;
  widthValue: string;
  heightValue: string;
  leftValue: string;
  topValue: string;
  zIndexValue: string;
  // Callbacks
  onApplyStylePreset: (value: string) => void;
  onApplyCustomCssUpdates: (updates: Record<string, string | undefined>) => void;
  onApplyCustomCssText: (raw: string) => void;
  onAdjustNumericStyle: (key: string, delta: number, unit: string, fallback: number) => void;
  onUpdateNumericStyle: (key: string, rawValue: string, unit: string) => void;
  resolveColorValue: (value: string, fallback: string) => string;
  renderColorSwatches: (fieldKey: string) => ReactNode;
};

export default function ElementStyleEditor({
  stylePresets,
  currentPresetValue,
  shadowOptions,
  positionOptions,
  customCssValue,
  selectButtonClass,
  isBold,
  isItalic,
  isUnderline,
  textAlignValue,
  textColorValue,
  backgroundColorValue,
  borderValue,
  borderRadiusValue,
  boxShadowValue,
  paddingValue,
  marginValue,
  positionValue,
  widthValue,
  heightValue,
  leftValue,
  topValue,
  zIndexValue,
  onApplyStylePreset,
  onApplyCustomCssUpdates,
  onApplyCustomCssText,
  onAdjustNumericStyle,
  onUpdateNumericStyle,
  resolveColorValue,
  renderColorSwatches,
}: StyleEditorProps) {
  return (
    <div className="rounded border border-border bg-card p-3">
      <div className="text-xs font-semibold text-foreground">
        {t('sidepanel_elements_styles_title', 'Styles')}
      </div>
      <div className="mt-2 grid gap-3">
        <div className="grid gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t('sidepanel_elements_style_preset', 'Preset')}
          </span>
          <SelectMenu
            value={currentPresetValue}
            options={stylePresets.map((preset) => ({
              value: preset.value,
              label: preset.label,
            }))}
            useInputStyle={false}
            buttonClassName={selectButtonClass}
            onChange={(value) => onApplyStylePreset(value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded border border-border bg-muted p-2 sm:flex-nowrap">
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="btn-toolbar"
              aria-label={t('sidepanel_elements_font_decrease', 'Decrease font size')}
              onClick={() => onAdjustNumericStyle('fontSize', -1, 'px', 12)}
            >
              <AArrowDown className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="btn-toolbar"
              aria-label={t('sidepanel_elements_font_increase', 'Increase font size')}
              onClick={() => onAdjustNumericStyle('fontSize', 1, 'px', 12)}
            >
              <AArrowUp className="h-3.5 w-3.5" />
            </button>
          </div>
          <span className="h-6 w-px bg-border" />
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`btn-toolbar ${isBold ? 'bg-accent text-accent-foreground' : ''}`}
              aria-pressed={isBold}
              onClick={() => onApplyCustomCssUpdates({ fontWeight: isBold ? '' : '700' })}
            >
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className={`btn-toolbar ${isItalic ? 'bg-accent text-accent-foreground' : ''}`}
              aria-pressed={isItalic}
              onClick={() => onApplyCustomCssUpdates({ fontStyle: isItalic ? '' : 'italic' })}
            >
              <Italic className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className={`btn-toolbar ${isUnderline ? 'bg-accent text-accent-foreground' : ''}`}
              aria-pressed={isUnderline}
              onClick={() =>
                onApplyCustomCssUpdates({
                  textDecoration: isUnderline ? '' : 'underline',
                })
              }
            >
              <Underline className="h-3.5 w-3.5" />
            </button>
          </div>
          <span className="h-6 w-px bg-border" />
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`btn-toolbar ${textAlignValue === 'left' ? 'bg-accent text-accent-foreground' : ''}`}
              aria-pressed={textAlignValue === 'left'}
              onClick={() => onApplyCustomCssUpdates({ textAlign: 'left' })}
            >
              <AlignLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className={`btn-toolbar ${textAlignValue === 'center' ? 'bg-accent text-accent-foreground' : ''}`}
              aria-pressed={textAlignValue === 'center'}
              onClick={() => onApplyCustomCssUpdates({ textAlign: 'center' })}
            >
              <AlignCenter className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className={`btn-toolbar ${textAlignValue === 'right' ? 'bg-accent text-accent-foreground' : ''}`}
              aria-pressed={textAlignValue === 'right'}
              onClick={() => onApplyCustomCssUpdates({ textAlign: 'right' })}
            >
              <AlignRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="grid gap-3 rounded border border-border bg-muted p-2">
          <div className="grid gap-2">
            <div className="grid gap-1">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                {t('sidepanel_elements_style_text', 'Text')}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="h-7 w-6.5 cursor-pointer rounded-md border border-border p-0"
                  value={resolveColorValue(textColorValue, '#0f172a')}
                  onChange={(event) => onApplyCustomCssUpdates({ color: event.target.value })}
                />
                <span className="h-6 w-px bg-border" />
                {renderColorSwatches('color')}
              </div>
            </div>
            <div className="grid gap-1">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                {t('sidepanel_elements_style_background', 'Background')}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="h-7 w-6.5 cursor-pointer rounded-md border border-border p-0"
                  value={resolveColorValue(backgroundColorValue, '#ffffff')}
                  onChange={(event) =>
                    onApplyCustomCssUpdates({ backgroundColor: event.target.value })
                  }
                />
                <span className="h-6 w-px bg-border" />
                {renderColorSwatches('backgroundColor')}
              </div>
            </div>
          </div>
        </div>

        <details className="group">
          <summary className="cursor-pointer list-none">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span>{t('sidepanel_field_layout', 'Layout')}</span>
              <span className="h-px flex-1 bg-border" />
              <ChevronDown className="h-4 w-4 text-muted-foreground transition group-open:rotate-180" />
            </div>
          </summary>
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded border border-border p-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                {t('sidepanel_elements_style_border', 'Border')}
              </span>
              <input
                className="input h-8 w-40 px-2 text-xs"
                value={borderValue}
                onChange={(event) => onApplyCustomCssUpdates({ border: event.target.value })}
                placeholder={t('sidepanel_elements_border_placeholder', '1px solid #000')}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                {t('sidepanel_elements_style_radius', 'Radius')}
              </span>
              <input
                className="input h-8 w-16 px-2 text-xs"
                type="number"
                value={borderRadiusValue}
                onChange={(event) =>
                  onUpdateNumericStyle('borderRadius', event.target.value, 'px')
                }
                placeholder={t('sidepanel_elements_radius_placeholder', '8')}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                {t('sidepanel_elements_style_shadow', 'Shadow')}
              </span>
              <SelectMenu
                value={shadowOptions.some((option) => option.value === boxShadowValue) ? boxShadowValue : ''}
                options={shadowOptions}
                placeholder={t('sidepanel_elements_shadow_custom', 'Custom')}
                useInputStyle
                buttonClassName="h-8 w-28 px-2 text-xs"
                onChange={(value) => onApplyCustomCssUpdates({ boxShadow: value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                {t('sidepanel_elements_style_padding', 'Padding')}
              </span>
              <input
                className="input h-8 w-28 px-2 text-xs"
                value={paddingValue}
                onChange={(event) => onApplyCustomCssUpdates({ padding: event.target.value })}
                placeholder={t('sidepanel_elements_padding_placeholder', '8px 16px')}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                {t('sidepanel_elements_style_margin', 'Margin')}
              </span>
              <input
                className="input h-8 w-28 px-2 text-xs"
                value={marginValue}
                onChange={(event) => onApplyCustomCssUpdates({ margin: event.target.value })}
                placeholder={t('sidepanel_elements_margin_placeholder', '0 auto')}
              />
            </div>
          </div>
        </details>

        <details className="group">
          <summary className="cursor-pointer list-none">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span>{t('sidepanel_elements_style_position', 'Position')}</span>
              <span className="h-px flex-1 bg-border" />
              <ChevronDown className="h-4 w-4 text-muted-foreground transition group-open:rotate-180" />
            </div>
          </summary>
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded border border-border p-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                {t('sidepanel_elements_position_mode', 'Mode')}
              </span>
              <SelectMenu
                value={positionValue}
                options={positionOptions}
                placeholder={t('sidepanel_elements_position_auto', 'Auto')}
                useInputStyle
                buttonClassName="h-8 w-24 px-2 text-xs"
                onChange={(value) => onApplyCustomCssUpdates({ position: value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                {t('sidepanel_elements_position_width', 'W')}
              </span>
              <input
                className="input h-8 w-16 px-2 text-xs"
                type="number"
                value={widthValue}
                onChange={(event) => onUpdateNumericStyle('width', event.target.value, 'px')}
                placeholder={t('sidepanel_elements_position_width_placeholder', '120')}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                {t('sidepanel_elements_position_height', 'H')}
              </span>
              <input
                className="input h-8 w-16 px-2 text-xs"
                type="number"
                value={heightValue}
                onChange={(event) => onUpdateNumericStyle('height', event.target.value, 'px')}
                placeholder={t('sidepanel_elements_position_height_placeholder', '40')}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                {t('sidepanel_elements_position_x', 'X')}
              </span>
              <input
                className="input h-8 w-16 px-2 text-xs"
                type="number"
                value={leftValue}
                onChange={(event) => onUpdateNumericStyle('left', event.target.value, 'px')}
                placeholder={t('sidepanel_elements_position_x_placeholder', '12')}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                {t('sidepanel_elements_position_y', 'Y')}
              </span>
              <input
                className="input h-8 w-16 px-2 text-xs"
                type="number"
                value={topValue}
                onChange={(event) => onUpdateNumericStyle('top', event.target.value, 'px')}
                placeholder={t('sidepanel_elements_position_y_placeholder', '12')}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                {t('sidepanel_elements_position_z', 'Z')}
              </span>
              <input
                className="input h-8 w-16 px-2 text-xs"
                type="number"
                value={zIndexValue}
                onChange={(event) => onUpdateNumericStyle('zIndex', event.target.value, '')}
                placeholder={t('sidepanel_elements_position_z_placeholder', '999')}
              />
            </div>
          </div>
        </details>

        <label className="grid gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t('sidepanel_elements_custom_styles', 'Custom Styles')}
          </span>
          <textarea
            className="input min-h-[88px] font-mono text-[11px]"
            rows={3}
            value={customCssValue}
            onChange={(event) => onApplyCustomCssText(event.target.value)}
            placeholder={t('sidepanel_elements_custom_styles_placeholder', 'color: #0f172a; padding: 8px;')}
          />
        </label>
      </div>
    </div>
  );
}
