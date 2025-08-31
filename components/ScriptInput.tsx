
import React from 'react';
import Loader from './Loader';

interface ScriptInputProps {
  script: string;
  setScript: (script: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

const ScriptInput: React.FC<ScriptInputProps> = ({ script, setScript, onSubmit, isLoading }) => {
  return (
    <div className="flex flex-col h-full">
      <label htmlFor="script-input" className="text-lg font-semibold text-slate-300 mb-2">
        Enter Your Plot Script
      </label>
      <textarea
        id="script-input"
        value={script}
        onChange={(e) => setScript(e.target.value)}
        placeholder="Describe the flow of your story or program here..."
        className="flex-grow bg-slate-800 border border-slate-700 rounded-md p-4 text-slate-300 focus:ring-2 focus:ring-teal-500 focus:outline-none resize-none"
        rows={15}
      />
      <button
        onClick={onSubmit}
        disabled={isLoading || !script.trim()}
        className="mt-4 w-full flex justify-center items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-md transition-colors duration-300"
      >
        {isLoading ? <Loader /> : null}
        {isLoading ? 'Analyzing...' : 'Generate Flow'}
      </button>
    </div>
  );
};

export default ScriptInput;
