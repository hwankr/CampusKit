import { useI18n } from "../../../shared/i18n/useI18n";

type SplitFormProps = {
  inputPath: string;
  outputDir: string;
  pageRangeText: string;
  validationMessage: string | null;
  canSubmit: boolean;
  isRunning: boolean;
  onInputBrowse: () => void;
  onOutputBrowse: () => void;
  onRangeChange: (value: string) => void;
  onSubmit: () => void;
};

export function SplitForm({
  inputPath,
  outputDir,
  pageRangeText,
  validationMessage,
  canSubmit,
  isRunning,
  onInputBrowse,
  onOutputBrowse,
  onRangeChange,
  onSubmit,
}: SplitFormProps) {
  const { t } = useI18n();

  return (
    <section className="panel-card">
      <div className="section-badge">{t("pdfSplitFormBadge")}</div>
      <h2 className="section-title">{t("pdfSplitFormTitle")}</h2>
      <p className="section-copy">{t("pdfSplitFormBody")}</p>

      <div className="field-grid">
        <label className="field-block">
          <span className="field-label">{t("inputFileLabel")}</span>
          <div className="field-row">
            <input className="field-input" value={inputPath} readOnly placeholder={t("inputFilePlaceholder")} />
            <button type="button" className="ghost-button" onClick={onInputBrowse}>
              {t("browseFileAction")}
            </button>
          </div>
        </label>

        <label className="field-block">
          <span className="field-label">{t("outputDirLabel")}</span>
          <div className="field-row">
            <input className="field-input" value={outputDir} readOnly placeholder={t("outputDirPlaceholder")} />
            <button type="button" className="ghost-button" onClick={onOutputBrowse}>
              {t("browseFolderAction")}
            </button>
          </div>
        </label>

        <label className="field-block">
          <span className="field-label">{t("pageRangeLabel")}</span>
          <textarea
            className="field-textarea"
            value={pageRangeText}
            onChange={(event) => onRangeChange(event.currentTarget.value)}
            placeholder={t("pageRangePlaceholder")}
            rows={4}
          />
        </label>
      </div>

      {validationMessage ? <div className="validation-banner">{validationMessage}</div> : null}

      <div className="section-actions">
        <button type="button" className="primary-button" disabled={!canSubmit || isRunning} onClick={onSubmit}>
          {isRunning ? t("splitRunningAction") : t("splitSubmitAction")}
        </button>
      </div>
    </section>
  );
}
