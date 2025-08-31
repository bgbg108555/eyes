import React, { useState, useRef, useCallback, useEffect } from 'react';

interface ResizablePanelsProps {
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  initialLeftWidth?: number;
  minWidth?: number;
}

const ResizablePanels: React.FC<ResizablePanelsProps> = ({
  leftPanel,
  rightPanel,
  initialLeftWidth = 40,
  minWidth = 25,
}) => {
  const [leftWidth, setLeftWidth] = useState(initialLeftWidth);
  const isResizing = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    isResizing.current = true;
    e.preventDefault(); // Prevent text selection during drag
  };

  const handleMouseUp = useCallback(() => {
    isResizing.current = false;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    
    const newWidthClamped = Math.max(minWidth, Math.min(newLeftWidth, 100 - minWidth));
    setLeftWidth(newWidthClamped);
  }, [minWidth]);
  
  useEffect(() => {
    const mouseMoveHandler = (e: MouseEvent) => handleMouseMove(e);
    const mouseUpHandler = () => handleMouseUp();

    if (isResizing.current) {
      window.addEventListener('mousemove', mouseMoveHandler);
      window.addEventListener('mouseup', mouseUpHandler);
    }
    
    return () => {
      window.removeEventListener('mousemove', mouseMoveHandler);
      window.removeEventListener('mouseup', mouseUpHandler);
    };
  }, [handleMouseMove, handleMouseUp]);


  return (
    <div ref={containerRef} className="flex w-full h-full">
      <div style={{ width: `${leftWidth}%` }} className="h-full min-w-0">
        {leftPanel}
      </div>
      <div
        onMouseDown={handleMouseDown}
        className="w-2 h-full cursor-col-resize flex items-center justify-center group"
        aria-label="Resize panels"
        role="separator"
      >
        <div className="w-0.5 h-12 bg-slate-700 group-hover:bg-teal-500 transition-colors duration-200 rounded-full" />
      </div>
      <div style={{ width: `calc(100% - ${leftWidth}% - 8px)` }} className="h-full min-w-0">
        {rightPanel}
      </div>
    </div>
  );
};

export default ResizablePanels;
