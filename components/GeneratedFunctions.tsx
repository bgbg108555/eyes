import React from 'react';

interface GeneratedFunctionsProps {
  functions: string[];
}

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-teal-400" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
);

const GeneratedFunctions: React.FC<GeneratedFunctionsProps> = ({ functions }) => {
  if (functions.length === 0) {
    return null;
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-300 mb-3">
        Suggested Functions
      </h2>
      <ul className="space-y-3">
        {functions.map((func, index) => (
          <li key={index} className="flex items-start gap-3 bg-slate-800 p-3 rounded-md border border-slate-700">
            <CheckIcon />
            <span className="text-slate-300">{func}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default GeneratedFunctions;
