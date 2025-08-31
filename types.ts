
import type { SimulationNodeDatum } from 'd3';

export enum NodeType {
  Start = 'start',
  Process = 'process',
  Decision = 'decision',
  End = 'end',
}

export interface NodeData extends SimulationNodeDatum {
  id: string;
  label: string;
  type: NodeType;
  description?: string;
}

export interface EdgeData {
  source: string;
  target: string;
  label?: string;
}

export interface FlowData {
  nodes: NodeData[];
  edges: EdgeData[];
}

export interface GeminiResponse {
  flowchart: FlowData;
  functions: string[];
}
