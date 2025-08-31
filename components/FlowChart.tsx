
// FIX: Corrected the React import to ensure hooks like useEffect, useRef, and useState are available.
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { FlowData, NodeType } from '../types';

// Let TypeScript know that these libraries exist as global variables from the CDN scripts
declare const dagre: any;
declare const jspdf: any;

interface FlowChartProps {
  data: FlowData | null;
}

interface TooltipState {
    visible: boolean;
    content: string;
    x: number;
    y: number;
}

interface NodeStyle {
    color1: string;
    color2: string;
    stroke: string;
    textColor: string;
    fontSize: number;
}

type NodeStyles = Record<Exclude<NodeType, 'default'>, NodeStyle>;

const defaultNodeStyles: NodeStyles = {
    start: { color1: '#a3e635', color2: '#16a34a', stroke: '#15803d', textColor: '#ffffff', fontSize: 14 },
    end: { color1: '#f87171', color2: '#e11d48', stroke: '#be123c', textColor: '#ffffff', fontSize: 14 },
    decision: { color1: '#fbbf24', color2: '#f97316', stroke: '#ea580c', textColor: '#ffffff', fontSize: 14 },
    process: { color1: '#38bdf8', color2: '#2563eb', stroke: '#1d4ed8', textColor: '#ffffff', fontSize: 14 },
};

const NODE_WIDTH = 150;
const NODE_HEIGHT = 60;

// Helper to create a styled canvas from the SVG, used by PNG and PDF exporters
const createCanvasFromSVG = (svgElement: SVGSVGElement, svgGroupElement: SVGGElement, scale: number = 2): Promise<HTMLCanvasElement> => {
    return new Promise((resolve, reject) => {
        const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
        const g = clonedSvg.querySelector('g');
        if (!g) return reject(new Error("SVG group not found"));

        const bbox = svgGroupElement.getBBox();
        const padding = 20;

        const canvasWidth = (bbox.width + padding * 2) * scale;
        const canvasHeight = (bbox.height + padding * 2) * scale;

        clonedSvg.setAttribute('width', `${canvasWidth}`);
        clonedSvg.setAttribute('height', `${canvasHeight}`);

        g.setAttribute('transform', `translate(${(-bbox.x + padding) * scale}, ${(-bbox.y + padding) * scale}) scale(${scale})`);

        const style = document.createElement('style');
        // This style block is critical for exports to render text correctly
        // It injects styles that might be defined in external CSS into the SVG itself
        const customStyles = Array.from(document.styleSheets)
          .map(sheet => {
            try {
              return Array.from(sheet.cssRules)
                .map(rule => rule.cssText)
                .join('');
            } catch (e) {
              console.log('Access to stylesheet %s is denied. Ignoring...', sheet.href);
              return '';
            }
          })
          .join('');

        style.textContent = `
          ${customStyles}
          .node text { font-family: sans-serif; font-weight: 500; text-anchor: middle; }
          .edge-label { font-family: sans-serif; font-size: 14px; fill: #cbd5e1; text-anchor: middle; }
        `;
        clonedSvg.insertBefore(style, clonedSvg.firstChild);

        const svgString = new XMLSerializer().serializeToString(clonedSvg);
        const svgUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));

        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = canvasWidth;
          canvas.height = canvasHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error("Could not get canvas context"));

          ctx.fillStyle = '#1e293b'; // bg-slate-800
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);

          resolve(canvas);
        };
        img.onerror = () => reject(new Error("Image failed to load from SVG data URL"));
        img.src = svgUrl;
    });
};

const StyleEditor: React.FC<{
    styles: NodeStyles,
    onStyleChange: (type: string, key: keyof NodeStyle, value: any) => void,
    onReset: () => void,
    onClose: () => void,
}> = ({ styles, onStyleChange, onReset, onClose }) => (
    <div className="absolute top-4 right-4 z-20 bg-slate-800/80 backdrop-blur-sm border border-slate-700 rounded-lg shadow-xl w-72">
        <div className="flex justify-between items-center p-3 border-b border-slate-700">
            <h3 className="font-semibold text-slate-200">Customize Nodes</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-white">&times;</button>
        </div>
        <div className="p-3 max-h-[calc(100vh-12rem)] overflow-y-auto space-y-3">
            {/* FIX: Cast the result of Object.entries to properly type the style values, resolving type errors. */}
            {(Object.entries(styles) as [string, NodeStyle][]).map(([type, styleValues]) => (
                <div key={type} className="p-3 bg-slate-900/50 rounded-md">
                    <h4 className="font-medium text-slate-300 capitalize mb-2">{type}</h4>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                        {(['color1', 'color2', 'stroke', 'textColor'] as const).map(key => (
                             <label key={key} className="flex items-center justify-between">
                                <span className="text-slate-400 capitalize">{key.replace('color', 'Color ')}</span>
                                <input type="color" value={styleValues[key]} onChange={e => onStyleChange(type, key, e.target.value)} className="w-8 h-6 p-0 border-0 bg-transparent rounded cursor-pointer" />
                            </label>
                        ))}
                        <label className="col-span-2 flex items-center justify-between mt-1">
                            <span className="text-slate-400">Font Size</span>
                            <input type="number" min="8" max="24" step="1" value={styleValues.fontSize} onChange={e => onStyleChange(type, 'fontSize', parseInt(e.target.value, 10))} className="w-20 bg-slate-700 border border-slate-600 rounded px-2 py-0.5 text-right" />
                        </label>
                    </div>
                </div>
            ))}
        </div>
        <div className="p-3 border-t border-slate-700">
            <button onClick={onReset} className="w-full text-sm text-center py-2 bg-slate-700 hover:bg-slate-600 rounded-md transition-colors">Reset to Defaults</button>
        </div>
    </div>
);


const FlowChart: React.FC<FlowChartProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgGroupRef = useRef<SVGGElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [fitToA4, setFitToA4] = useState<boolean>(true);
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, content: '', x: 0, y: 0 });
  const [customNodeStyles, setCustomNodeStyles] = useState<NodeStyles>(defaultNodeStyles);
  const [isStyleEditorOpen, setIsStyleEditorOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'svg' | 'png'>('idle');

  const handleStyleChange = (nodeType: string, property: keyof NodeStyle, value: string | number) => {
    setCustomNodeStyles(prevStyles => ({
        ...prevStyles,
        [nodeType]: {
            ...prevStyles[nodeType as keyof NodeStyles],
            [property]: value,
        }
    }));
  };
  
  const getSVGString = (): string | null => {
    if (!svgRef.current || !svgGroupRef.current) return null;
  
    const svgElement = svgRef.current.cloneNode(true) as SVGSVGElement;
    const g = svgElement.querySelector('g');
  
    if (!g) return null;
    const bbox = svgGroupRef.current.getBBox();
    
    const padding = 20;
  
    svgElement.setAttribute('width', `${bbox.width + padding * 2}`);
    svgElement.setAttribute('height', `${bbox.height + padding * 2}`);
    
    g.setAttribute('transform', `translate(${-bbox.x + padding}, ${-bbox.y + padding})`);
    
    const style = document.createElement('style');
    const typeStyles = (Object.entries(customNodeStyles) as [string, NodeStyle][]).map(([type, styles]) => {
        return `.node.${type} text { fill: ${styles.textColor}; font-size: ${styles.fontSize}px; }`
    }).join('\n');

    style.textContent = `
      .node text { font-family: sans-serif; font-weight: 500; text-anchor: middle; }
      ${typeStyles}
      .edge-label { font-family: sans-serif; font-size: 14px; fill: #cbd5e1; text-anchor: middle; }
    `;
    svgElement.insertBefore(style, svgElement.firstChild);
  
    return new XMLSerializer().serializeToString(svgElement);
  };

  const handleExportSVG = () => {
    const svgString = getSVGString();
    if (!svgString) return;

    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flowchart.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setIsExportMenuOpen(false);
  };
  
  const handleExportPNG = async () => {
    if (!svgRef.current || !svgGroupRef.current) return;
    try {
        const canvas = await createCanvasFromSVG(svgRef.current, svgGroupRef.current, 2); // 2x scale for high-res PNG
        const pngUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = 'flowchart.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch (error) {
        console.error("Failed to export PNG:", error);
    } finally {
        setIsExportMenuOpen(false);
    }
  };

  const handleExportPDF = async () => {
    if (!svgRef.current || !svgGroupRef.current) return;

    try {
        const canvas = await createCanvasFromSVG(svgRef.current, svgGroupRef.current, 2); // 2x scale for quality
        const { jsPDF } = jspdf;

        if (fitToA4) {
            const PADDING_MM = 10;
            const A4_WIDTH_MM = 210;
            const A4_HEIGHT_MM = 297;
            const canvasAspectRatio = canvas.width / canvas.height;
            
            const isLandscape = canvasAspectRatio > 1;
            const doc = new jsPDF({
                orientation: isLandscape ? 'landscape' : 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const pageWidth = isLandscape ? A4_HEIGHT_MM : A4_WIDTH_MM;
            const pageHeight = isLandscape ? A4_WIDTH_MM : A4_HEIGHT_MM;

            const usableWidth = pageWidth - (PADDING_MM * 2);
            const usableHeight = pageHeight - (PADDING_MM * 2);

            let imgWidth = usableWidth;
            let imgHeight = imgWidth / canvasAspectRatio;

            if (imgHeight > usableHeight) {
                imgHeight = usableHeight;
                imgWidth = imgHeight * canvasAspectRatio;
            }

            const x = (pageWidth - imgWidth) / 2;
            const y = (pageHeight - imgHeight) / 2;

            doc.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, imgWidth, imgHeight);
            doc.save('flowchart-a4.pdf');

        } else {
            const isLandscape = canvas.width > canvas.height;
            const doc = new jsPDF({
                orientation: isLandscape ? 'l' : 'p',
                unit: 'px',
                format: [canvas.width, canvas.height]
            });
            doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
            doc.save('flowchart.pdf');
        }
    } catch (error) {
        console.error("Failed to export PDF:", error);
    } finally {
        setIsExportMenuOpen(false);
    }
  };
  
  const handleCopySVG = async () => {
    const svgString = getSVGString();
    if (!svgString) return;
    try {
      await navigator.clipboard.writeText(svgString);
      setCopyStatus('svg');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to copy SVG to clipboard:', err);
      alert('Failed to copy SVG. See console for details.');
    } finally {
      setIsExportMenuOpen(false);
    }
  };

  const handleCopyPNG = async () => {
    if (!svgRef.current || !svgGroupRef.current) return;
    try {
      const canvas = await createCanvasFromSVG(svgRef.current, svgGroupRef.current, 2);
      canvas.toBlob(async (blob) => {
        if (!blob) {
          throw new Error('Canvas toBlob returned null');
        }
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        setCopyStatus('png');
        setTimeout(() => setCopyStatus('idle'), 2000);
      }, 'image/png');
    } catch (err) {
      console.error('Failed to copy image to clipboard:', err);
      alert('Failed to copy image. Your browser might not support this feature. See console for details.');
    } finally {
      setIsExportMenuOpen(false);
    }
  };

  useEffect(() => {
    if (!data || !svgRef.current || !containerRef.current || !data.nodes.length) {
      d3.select(svgRef.current).selectAll('*').remove();
      return;
    }

    const { nodes, edges } = data;
    const { width: containerWidth, height: containerHeight } = containerRef.current.getBoundingClientRect();
    const svg = d3.select(svgRef.current);

    svg.selectAll('*').remove(); // Clear previous chart

    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 80 }); // Increased ranksep for more vertical space
    g.setDefaultEdgeLabel(() => ({}));

    nodes.forEach((node) => {
      g.setNode(node.id, { label: node.label, width: NODE_WIDTH, height: NODE_HEIGHT, type: node.type, description: node.description });
    });
    edges.forEach((edge) => {
      g.setEdge(edge.source, edge.target, { label: edge.label });
    });

    dagre.layout(g);

    const svgGroup = svg.append('g');
    svgGroupRef.current = svgGroup.node();

    const defs = svg.append('defs');

    // FIX: Cast the result of Object.entries to properly type the style values, resolving type errors.
    (Object.entries(customNodeStyles) as [string, NodeStyle][]).forEach(([type, styles]) => {
        const gradId = `${type}-gradient`;
        const linearGradient = defs.append('linearGradient')
            .attr('id', gradId)
            .attr('x1', '0%').attr('y1', '0%')
            .attr('x2', '0%').attr('y2', '100%');

        linearGradient.append('stop')
            .attr('offset', '0%')
            .style('stop-color', styles.color1);

        linearGradient.append('stop')
            .attr('offset', '100%')
            .style('stop-color', styles.color2);
    });

    defs.append('marker')
        .attr('id', 'arrowhead')
        .attr('viewBox', '-0 -5 10 10')
        .attr('refX', 10)
        .attr('refY', 0)
        .attr('orient', 'auto')
        .attr('markerWidth', 8)
        .attr('markerHeight', 8)
        .append('svg:path')
        .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
        .attr('fill', '#94a3b8');

    // Use a monotonic curve for cleaner vertical edge routing
    const lineGenerator = d3.line<any>().x(d => d.x).y(d => d.y).curve(d3.curveMonotoneY);

    const edgePaths = svgGroup
      .append('g')
      .selectAll('path')
      .data(g.edges())
      .enter()
      .append('path')
      .attr('class', 'edge-path')
      .attr('d', (e: any) => lineGenerator(g.edge(e).points))
      .attr('fill', 'none')
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', 2)
      .attr('marker-end', 'url(#arrowhead)');
      
    const edgeLabels = svgGroup
        .append("g")
        .selectAll("text")
        .data(g.edges().filter((e: any) => g.edge(e).label))
        .enter()
        .append("text")
        .attr('class', 'edge-label')
        .attr('transform', (e: any) => `translate(${g.edge(e).x}, ${g.edge(e).y})`)
        .attr('text-anchor', 'middle')
        .attr('dy', '-0.5em')
        .attr("fill", "#cbd5e1")
        .style("font-size", "14px")
        .text((e: any) => g.edge(e).label);

    const node = svgGroup
      .append('g')
      .selectAll('g')
      .data(g.nodes())
      .enter()
      .append('g')
      .attr('class', d => `node ${g.node(d).type}`)
      .attr('transform', d => `translate(${g.node(d).x}, ${g.node(d).y})`);

    node.append('path')
      .attr('d', d => {
        const nodeInfo = g.node(d);
        const w = nodeInfo.width / 2;
        const h = nodeInfo.height / 2;
        switch (nodeInfo.type) {
            case 'decision': return `M 0 -${h} L ${w} 0 L 0 ${h} L -${w} 0 Z`;
            case 'start':
            case 'end': return `M -${w-h} -${h} L ${w-h} -${h} A ${h} ${h} 0 0 1 ${w-h} ${h} L -${w-h} ${h} A ${h} ${h} 0 0 1 -${w-h} -${h} Z`;
            default: return `M -${w} -${h} H ${w} V ${h} H -${w} Z`;
        }
      })
      .style('fill', d => {
        const type = g.node(d).type as keyof NodeStyles;
        return type ? `url(#${type}-gradient)` : '#64748b';
      })
      .style('stroke', d => {
        const type = g.node(d).type as keyof NodeStyles;
        return customNodeStyles[type]?.stroke || '#475569';
      })
      .style('stroke-width', 3);

    const wrapText = (selection: any, width: number) => {
      selection.each(function(this: SVGTextElement) {
        const text = d3.select(this);
        const words = text.text().split(/\s+/).reverse();
        let word;
        let line: string[] = [];
        let lineNumber = 0;
        const lineHeight = 1.1; // ems
        const dy = 0.3; // ems from original dy
        let tspan = text.text(null).append("tspan").attr("x", 0).attr("y", 0).attr("dy", dy + "em");
        const initialY = tspan.node()!.getBBox().y;

        while (word = words.pop()) {
          line.push(word);
          tspan.text(line.join(" "));
          if (tspan.node()!.getComputedTextLength() > width && line.length > 1) {
            line.pop();
            tspan.text(line.join(" "));
            line = [word];
            tspan = text.append("tspan").attr("x", 0).attr("dy", lineHeight + "em").text(word);
            lineNumber++;
          }
        }
        
        const textHeight = text.node()!.getBBox().height;
        text.attr("transform", `translate(0, -${textHeight/2 - initialY})`);
      });
    }

    node.append('text')
      .text(d => g.node(d).label)
      .attr('text-anchor', 'middle')
      .attr('fill', d => {
          const type = g.node(d).type as keyof NodeStyles;
          return customNodeStyles[type]?.textColor || 'white';
      })
      .style('font-size', d => {
          const type = g.node(d).type as keyof NodeStyles;
          return `${customNodeStyles[type]?.fontSize || 14}px`;
      })
      .style('font-weight', '500')
      .call(wrapText, NODE_WIDTH - 25);

    const dragHandler = d3.drag()
      .on('start', function() {
        d3.select(this).raise().style('cursor', 'grabbing');
      })
      .on('drag', function(event, d) {
        const nodeId = d as string;
        const nodeData = g.node(nodeId);

        nodeData.x = event.x;
        nodeData.y = event.y;

        d3.select(this).attr('transform', `translate(${nodeData.x}, ${nodeData.y})`);

        edgePaths
          .filter((e: any) => e.v === nodeId || e.w === nodeId)
          .each(function(e: any) {
              const edgeData = g.edge(e);
              const sourceNode = g.node(e.v);
              const targetNode = g.node(e.w);

              // Simple straight line for dragging feedback
              const newPoints = [{x: sourceNode.x, y: sourceNode.y}, {x: targetNode.x, y: targetNode.y}];
              d3.select(this).attr('d', lineGenerator(newPoints));
          });
          
        edgeLabels
          .filter((e: any) => e.v === nodeId || e.w === nodeId)
          .each(function(e: any) {
              const edgeData = g.edge(e);
              const sourceNode = g.node(e.v);
              const targetNode = g.node(e.w);
              
              edgeData.x = (sourceNode.x + targetNode.x) / 2;
              edgeData.y = (sourceNode.y + targetNode.y) / 2;
              d3.select(this).attr('transform', `translate(${edgeData.x}, ${edgeData.y})`);
          });
      })
      .on('end', function(event, d) {
        d3.select(this).style('cursor', 'grab');
        // A full re-layout on drag end can be expensive.
        // The current implementation provides good enough visual feedback.
        // For perfect edge re-routing, a more complex solution would be needed.
      });

    node.style('cursor', 'grab').call(dragHandler as any);

    node.on('mouseover', (event, d) => {
        const nodeInfo = g.node(d);
        if (nodeInfo.description) {
            const [x, y] = d3.pointer(event, containerRef.current);
            setTooltip({
                visible: true,
                content: nodeInfo.description,
                x: x + 15,
                y: y + 15
            });
        }
    }).on('mousemove', (event) => {
        const [x, y] = d3.pointer(event, containerRef.current);
        setTooltip(prev => ({...prev, x: x + 15, y: y + 15}));
    }).on('mouseout', () => {
        setTooltip(prev => ({...prev, visible: false}));
    });
    
    const graphWidth = g.graph().width;
    const graphHeight = g.graph().height;
    const zoom = d3.zoom().scaleExtent([0.1, 4]).on('zoom', (event) => {
        svgGroup.attr('transform', event.transform);
    });

    svg.call(zoom as any);

    if (graphWidth > 0 && graphHeight > 0) {
      const scale = Math.min(
          (containerWidth - 80) / graphWidth, 
          (containerHeight - 80) / graphHeight,
          1.5
      );
  
      const translateX = (containerWidth - graphWidth * scale) / 2;
      const translateY = (containerHeight - graphHeight * scale) / 2;
      
      const transform = d3.zoomIdentity.translate(translateX, translateY).scale(scale);

      svg.call(zoom.transform as any, transform);
    }

  }, [data, customNodeStyles]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      {tooltip.visible && (
        <div 
          className="absolute z-30 p-2 text-sm text-slate-200 bg-slate-900/80 border border-slate-700 rounded-md shadow-lg max-w-xs backdrop-blur-sm pointer-events-none transition-opacity"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
            {tooltip.content}
        </div>
      )}
      {data?.nodes && data.nodes.length > 0 && (
          <>
            <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
                <div className='flex items-center gap-2'>
                    <button onClick={() => setIsStyleEditorOpen(!isStyleEditorOpen)} className="px-3 py-1.5 bg-slate-700 text-slate-200 text-sm font-medium rounded-md hover:bg-slate-600 transition-colors" title="Customize Styles">Customize</button>
                    <div className="relative" ref={exportMenuRef}>
                        <button 
                          onClick={() => setIsExportMenuOpen(prev => !prev)} 
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 text-slate-200 text-sm font-medium rounded-md hover:bg-slate-600 transition-colors" 
                          title="Export options"
                        >
                            Export
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        </button>
                        {isExportMenuOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-md shadow-lg overflow-hidden py-1">
                                <button onClick={handleExportSVG} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700">Export as SVG</button>
                                <button onClick={handleExportPNG} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700">Export as PNG</button>
                                <button onClick={handleExportPDF} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700">Export as PDF</button>
                                <div className="my-1 h-px bg-slate-700"></div>
                                <button onClick={handleCopySVG} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-50" disabled={copyStatus !== 'idle'}>
                                    {copyStatus === 'svg' ? 'Copied!' : 'Copy as SVG'}
                                </button>
                                <button onClick={handleCopyPNG} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-50" disabled={copyStatus !== 'idle'}>
                                    {copyStatus === 'png' ? 'Copied!' : 'Copy as PNG'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                <label htmlFor="a4-fit" className="flex items-center gap-2 cursor-pointer bg-slate-700/80 backdrop-blur-sm px-2 py-1 rounded-md">
                    <input type="checkbox" id="a4-fit" checked={fitToA4} onChange={(e) => setFitToA4(e.target.checked)} className="h-4 w-4 rounded bg-slate-900 border-slate-600 text-teal-500 focus:ring-teal-500 focus:ring-offset-0 focus:ring-2" />
                    <span className="text-xs text-slate-300 select-none">Fit to A4 (PDF)</span>
                </label>
            </div>
            {isStyleEditorOpen && (
                <StyleEditor 
                    styles={customNodeStyles}
                    onStyleChange={handleStyleChange}
                    onReset={() => setCustomNodeStyles(defaultNodeStyles)}
                    onClose={() => setIsStyleEditorOpen(false)}
                />
            )}
          </>
      )}
      {!data?.nodes?.length && (
        <div className="w-full h-full flex items-center justify-center text-slate-500">
          <p>Your generated flowchart will appear here.</p>
        </div>
      )}
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
};

export default FlowChart;
