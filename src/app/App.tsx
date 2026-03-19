import { useState } from "react";
import { AppHeader } from "./layout/AppHeader";
import { AppShell } from "./layout/AppShell";
import { MainPanel } from "./layout/MainPanel";
import { Sidebar } from "./layout/Sidebar";
import { PlaceholderToolPage } from "../features/placeholders/PlaceholderToolPage";
import { PdfSplitPage } from "../features/pdf-split/PdfSplitPage";
import { toolRegistry, type ToolDescriptor, type ToolId } from "../features/tools/toolRegistry";

function renderToolView(tool: ToolDescriptor) {
  if (tool.id === "pdfSplit") {
    return <PdfSplitPage />;
  }

  return <PlaceholderToolPage tool={tool} />;
}

function App() {
  const [activeToolId, setActiveToolId] = useState<ToolId>("pdfSplit");
  const activeTool = toolRegistry.find((tool) => tool.id === activeToolId) ?? toolRegistry[0];

  return (
    <AppShell
      sidebar={
        <Sidebar tools={toolRegistry} activeToolId={activeTool.id} onSelectTool={setActiveToolId} />
      }
      header={<AppHeader tool={activeTool} />}
      main={<MainPanel>{renderToolView(activeTool)}</MainPanel>}
    />
  );
}

export default App;
