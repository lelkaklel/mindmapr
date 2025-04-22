export interface Node {
  id: string;
  text: string;
  children: Node[];
  position?: { x: number; y: number };
}

export interface MindMapData {
  root: Node;
} 