import type { MessageKey } from "../../shared/i18n/messages/ko";

export type ToolId = "pdfSplit" | "convert" | "merge" | "extract";

export type ToolDescriptor = {
  id: ToolId;
  navLabelKey: MessageKey;
  titleKey: MessageKey;
  descriptionKey: MessageKey;
  status: "active" | "placeholder";
  icon: string;
};

export const toolRegistry: ToolDescriptor[] = [
  {
    id: "pdfSplit",
    navLabelKey: "navPdfSplit",
    titleKey: "pdfSplitTitle",
    descriptionKey: "pdfSplitDescription",
    status: "active",
    icon: "SP",
  },
  {
    id: "convert",
    navLabelKey: "navConvert",
    titleKey: "convertTitle",
    descriptionKey: "convertDescription",
    status: "placeholder",
    icon: "CV",
  },
  {
    id: "merge",
    navLabelKey: "navMerge",
    titleKey: "mergeTitle",
    descriptionKey: "mergeDescription",
    status: "placeholder",
    icon: "MG",
  },
  {
    id: "extract",
    navLabelKey: "navExtract",
    titleKey: "extractTitle",
    descriptionKey: "extractDescription",
    status: "placeholder",
    icon: "EX",
  },
];
