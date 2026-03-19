import { useState } from "react";
import { AppHeader } from "./layout/AppHeader";
import { AppShell } from "./layout/AppShell";
import { MainPanel } from "./layout/MainPanel";
import { Sidebar } from "./layout/Sidebar";
import { toolRegistry, type ToolId } from "../features/tools/toolRegistry";
import { renderToolView } from "../features/tools/toolViews";

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
