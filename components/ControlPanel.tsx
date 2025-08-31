import React, { useState } from 'react';
import ScriptInput from './ScriptInput';
import GeneratedFunctions from './GeneratedFunctions';

interface ControlPanelProps {
  script: string;
  setScript: (script: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  functions: string[];
  error: string | null;
}

type Tab = 'script' | 'functions';

const ControlPanel: React.FC<ControlPanelProps> = ({ script, setScript, onSubmit, isLoading, functions, error }) => {
    const [activeTab, setActiveTab] = useState<Tab>('script');
    
    const TabButton: React.FC<{tabId: Tab, label: string, count?: number}> = ({tabId, label, count}) => (
        <button
            onClick={() => setActiveTab(tabId)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tabId
                ? 'border-teal-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
        >
            {label}
            {count !== undefined && count > 0 && (
                <span className="bg-slate-700 text-teal-300 text-xs font-bold px-2 py-0.5 rounded-full">{count}</span>
            )}
        </button>
    );

    return (
        <div className="flex flex-col h-full bg-slate-800/50 rounded-lg border border-slate-700/50">
            <div className="flex border-b border-slate-700/50 px-2">
                <TabButton tabId="script" label="Script" />
                <TabButton tabId="functions" label="Functions" count={functions.length} />
            </div>
            <div className="flex-grow p-6 overflow-y-auto">
                {activeTab === 'script' && (
                     <div className="flex flex-col h-full">
                        <ScriptInput
                            script={script}
                            setScript={setScript}
                            onSubmit={onSubmit}
                            isLoading={isLoading}
                        />
                    </div>
                )}
                 {activeTab === 'functions' && (
                    functions.length > 0 ? (
                        <GeneratedFunctions functions={functions} />
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-500">
                            <p>Suggested functions will appear here after analysis.</p>
                        </div>
                    )
                )}
            </div>
            {error && (
                <div className="m-6 mt-0 p-3 bg-red-900/50 border border-red-700 text-red-300 rounded-md">
                    <strong>Error:</strong> {error}
                </div>
            )}
        </div>
    );
};

export default ControlPanel;
