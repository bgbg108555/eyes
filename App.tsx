import React, { useState, useCallback } from 'react';
import Header from './components/Header';
import FlowChart from './components/FlowChart';
import { generateFlowFromScript } from './services/geminiService';
import type { FlowData } from './types';
import ResizablePanels from './components/ResizablePanels';
import ControlPanel from './components/ControlPanel';

const defaultScript = `The game starts. The player character, a knight, wakes up in a dark dungeon. They need to find a key to unlock the cell door. The player searches the cell. If they find the key, they can unlock the door and proceed to the next room. If not, they must keep searching. Once out, they encounter a goblin. They must fight the goblin. If they win, they find a treasure chest. If they lose, the game is over. After opening the chest, they find a map to the castle's exit, and the level ends.`;

const App: React.FC = () => {
  const [script, setScript] = useState<string>(defaultScript);
  const [flowData, setFlowData] = useState<FlowData | null>(null);
  const [generatedFunctions, setGeneratedFunctions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyzeScript = useCallback(async () => {
    if (!script.trim()) return;

    setIsLoading(true);
    setError(null);
    setFlowData(null);
    setGeneratedFunctions([]);

    try {
      const result = await generateFlowFromScript(script);
      setFlowData(result.flowchart);
      setGeneratedFunctions(result.functions);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [script]);

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-200 font-sans overflow-hidden">
      <div className="container mx-auto px-4">
        <Header />
      </div>

      <main className="flex-grow container mx-auto px-4 pb-8 mt-4 overflow-hidden">
        <ResizablePanels
          leftPanel={
            <ControlPanel
              script={script}
              setScript={setScript}
              onSubmit={handleAnalyzeScript}
              isLoading={isLoading}
              functions={generatedFunctions}
              error={error}
            />
          }
          rightPanel={<FlowChart data={flowData} />}
        />
      </main>
    </div>
  );
};

export default App;
