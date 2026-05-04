import { Block, SurfaceType } from './GameState';

export interface PathNode {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: PathNode | null;
}

export class Pathfinder {
  private blocks: Block[][] = [];
  private width = 0;
  private height = 0;

  setBlocks(blocks: Block[][]): void {
    this.blocks = blocks;
    this.height = blocks.length;
    this.width = blocks.length > 0 ? blocks[0].length : 0;
  }

  private isWalkable(bx: number, by: number): boolean {
    if (by < 0 || by >= this.height || bx < 0 || bx >= this.width) return false;
    const block = this.blocks[by][bx];
    // Floor, path, crystal seam, ore seam are walkable
    // Walls are not walkable (must drill first)
    // Lava is not walkable
    if (block.surfaceType >= 1 && block.surfaceType <= 5) return false; // Walls
    if (block.surfaceType === SurfaceType.Lava) return false; // Lava
    return true;
  }

  private getNeighbors(node: PathNode): PathNode[] {
    const neighbors: PathNode[] = [];
    const dirs = [
      { x: 0, y: -1 }, { x: 0, y: 1 },
      { x: -1, y: 0 }, { x: 1, y: 0 },
      { x: -1, y: -1 }, { x: 1, y: -1 },
      { x: -1, y: 1 }, { x: 1, y: 1 }
    ];

    for (const dir of dirs) {
      const nx = node.x + dir.x;
      const ny = node.y + dir.y;
      if (this.isWalkable(nx, ny)) {
        neighbors.push({
          x: nx, y: ny,
          g: 0, h: 0, f: 0,
          parent: null
        });
      }
    }
    return neighbors;
  }

  private heuristic(a: PathNode, b: PathNode): number {
    // Diagonal distance
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    return Math.max(dx, dy) + (Math.sqrt(2) - 1) * Math.min(dx, dy);
  }

  findPath(startX: number, startY: number, endX: number, endY: number): { x: number; y: number }[] | null {
    if (!this.isWalkable(endX, endY)) {
      // Try to find nearest walkable point
      let nearest = null;
      let nearestDist = Infinity;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const nx = endX + dx;
          const ny = endY + dy;
          if (this.isWalkable(nx, ny)) {
            const dist = Math.abs(dx) + Math.abs(dy);
            if (dist < nearestDist) {
              nearestDist = dist;
              nearest = { x: nx, y: ny };
            }
          }
        }
      }
      if (nearest) {
        endX = nearest.x;
        endY = nearest.y;
      } else {
        return null;
      }
    }

    const startNode: PathNode = {
      x: Math.floor(startX),
      y: Math.floor(startY),
      g: 0, h: 0, f: 0,
      parent: null
    };

    const endNode: PathNode = {
      x: Math.floor(endX),
      y: Math.floor(endY),
      g: 0, h: 0, f: 0,
      parent: null
    };

    const openList: PathNode[] = [startNode];
    const closedSet = new Set<string>();
    const openSet = new Set<string>();
    openSet.add(`${startNode.x},${startNode.y}`);

    while (openList.length > 0) {
      // Get node with lowest f
      let current = openList[0];
      let currentIdx = 0;
      for (let i = 1; i < openList.length; i++) {
        if (openList[i].f < current.f) {
          current = openList[i];
          currentIdx = i;
        }
      }

      openList.splice(currentIdx, 1);
      openSet.delete(`${current.x},${current.y}`);
      closedSet.add(`${current.x},${current.y}`);

      if (current.x === endNode.x && current.y === endNode.y) {
        // Reconstruct path
        const path: { x: number; y: number }[] = [];
        let node: PathNode | null = current;
        while (node) {
          path.unshift({ x: node.x, y: node.y });
          node = node.parent;
        }
        return path;
      }

      const neighbors = this.getNeighbors(current);
      for (const neighbor of neighbors) {
        const key = `${neighbor.x},${neighbor.y}`;
        if (closedSet.has(key)) continue;

        const isDiagonal = neighbor.x !== current.x && neighbor.y !== current.y;
        const moveCost = isDiagonal ? 1.414 : 1;
        const gScore = current.g + moveCost;

        if (!openSet.has(key) || gScore < neighbor.g) {
          neighbor.g = gScore;
          neighbor.h = this.heuristic(neighbor, endNode);
          neighbor.f = neighbor.g + neighbor.h;
          neighbor.parent = current;

          if (!openSet.has(key)) {
            openList.push(neighbor);
            openSet.add(key);
          }
        }
      }
    }

    return null; // No path found
  }
}
