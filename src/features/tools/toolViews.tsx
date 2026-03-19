import type { ReactElement } from "react";
import { PlaceholderToolPage } from "../placeholders/PlaceholderToolPage";
import { PdfSplitPage } from "../pdf-split/PdfSplitPage";
import type { ToolDescriptor, ToolId } from "./toolRegistry";

type ToolViewRenderer = (tool: ToolDescriptor) => ReactElement;

const renderPlaceholderTool: ToolViewRenderer = (tool) => <PlaceholderToolPage tool={tool} />;

const toolViews: Record<ToolId, ToolViewRenderer> = {
  pdfSplit: () => <PdfSplitPage />,
  convert: renderPlaceholderTool,
  merge: renderPlaceholderTool,
  extract: renderPlaceholderTool,
};

export function renderToolView(tool: ToolDescriptor) {
  return toolViews[tool.id](tool);
}
