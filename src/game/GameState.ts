export interface Vector2 {
  x: number;
  y: number;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export enum SurfaceType {
  Floor = 0,
  WallSoil = 1,
  WallLoose = 2,
  WallMedium = 3,
  WallHard = 4,
  WallImmovable = 5,
  CrystalSeam = 0x20,
  OreSeam = 0x40,
  Lava = 0x70,
  Water = 0x71,
}

export interface Block {
  bx: number;
  by: number;
  height: number;
  texture: number;
  surfaceType: SurfaceType;
  flags: number;
}

export interface Unit {
  id: string;
  type: string;
  x: number;
  y: number;
  z: number;
  health: number;
  maxHealth: number;
  selected: boolean;
  task: string | null;
}

export interface Building {
  id: string;
  type: string;
  bx: number;
  by: number;
  health: number;
  maxHealth: number;
  powered: boolean;
}

export interface GameResources {
  ore: number;
  crystals: number;
  studs: number;
  minifigures: number;
}

export interface GameObjectives {
  crystalsNeeded: number;
  crystalsCollected: number;
  timeLimit: number;
  timeElapsed: number;
  completed: boolean;
}

export interface GameState {
  blocks: Block[][];
  units: Unit[];
  buildings: Building[];
  resources: GameResources;
  selectedUnits: Set<string>;
  hoveredBlock: { bx: number; by: number } | null;
  objectives: GameObjectives;
  terrainDirty: boolean;
  initializeBlocks(width: number, height: number): void;
  setBlockHeight(bx: number, by: number, height: number): void;
  setBlockTexture(bx: number, by: number, texture: number): void;
  spawnUnit(type: string, x: number, y: number, z: number): Unit;
  selectUnit(id: string): void;
  selectUnitsInArea(x1: number, y1: number, x2: number, y2: number): void;
  getSelectedUnits(): Unit[];
}

export class GameStateImpl implements GameState {
  public blocks: Block[][] = [];
  public units: Unit[] = [];
  public buildings: Building[] = [];
  public resources: GameResources = {
    ore: 0,
    crystals: 0,
    studs: 0,
    minifigures: 0
  };
  
  public selectedUnits: Set<string> = new Set();
  public hoveredBlock: { bx: number; by: number } | null = null;
  public objectives: GameObjectives = {
    crystalsNeeded: 0,
    crystalsCollected: 0,
    timeLimit: 0,
    timeElapsed: 0,
    completed: false
  };
  public terrainDirty = false;
  
  initializeBlocks(width: number, height: number): void {
    this.blocks = [];
    for (let by = 0; by < height; by++) {
      const row: Block[] = [];
      for (let bx = 0; bx < width; bx++) {
        row.push({
          bx,
          by,
          height: 0,
          texture: 0,
          surfaceType: SurfaceType.Floor,
          flags: 0
        });
      }
      this.blocks.push(row);
    }
  }
  
  setBlockHeight(bx: number, by: number, height: number): void {
    if (this.blocks[by] && this.blocks[by][bx]) {
      this.blocks[by][bx].height = height;
      this.terrainDirty = true;
    }
  }

  setBlockTexture(bx: number, by: number, texture: number): void {
    if (this.blocks[by] && this.blocks[by][bx]) {
      this.blocks[by][bx].texture = texture;
      this.terrainDirty = true;
    }
  }
  
  spawnUnit(type: string, x: number, y: number, z: number): Unit {
    const unit: Unit = {
      id: `unit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      x,
      y,
      z,
      health: 100,
      maxHealth: 100,
      selected: false,
      task: null
    };
    this.units.push(unit);
    return unit;
  }
  
  selectUnit(id: string): void {
    this.selectedUnits.clear();
    this.selectedUnits.add(id);
    this.units.forEach(u => u.selected = (u.id === id));
  }
  
  selectUnitsInArea(x1: number, y1: number, x2: number, y2: number): void {
    this.selectedUnits.clear();
    this.units.forEach(u => {
      const selected = u.x >= Math.min(x1, x2) && u.x <= Math.max(x1, x2) &&
                      u.y >= Math.min(y1, y2) && u.y <= Math.max(y1, y2);
      u.selected = selected;
      if (selected) this.selectedUnits.add(u.id);
    });
  }
  
  getSelectedUnits(): Unit[] {
    return this.units.filter(u => this.selectedUnits.has(u.id));
  }
}
