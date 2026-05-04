import * as THREE from 'three';
import { GameState, Building, SurfaceType } from './GameState';

export enum BuildingType {
  TOOL_STORE = 'tool_store',
  TELEPORT_PAD = 'teleport_pad',
  POWER_STATION = 'power_station',
  SUPPORT_STATION = 'support_station',
  GEODOME = 'geodome',
  REFINERY = 'refinery',
  SUPER_TELEPORT = 'super_teleport'
}

export interface BuildingDef {
  type: BuildingType;
  name: string;
  cost: { ore: number; crystals: number };
  size: number; // blocks
  powered: boolean;
  model: string;
}

export const BUILDING_DEFS: Record<BuildingType, BuildingDef> = {
  [BuildingType.TOOL_STORE]: {
    type: BuildingType.TOOL_STORE,
    name: 'Tool Store',
    cost: { ore: 0, crystals: 0 },
    size: 2,
    powered: false,
    model: 'tool_store'
  },
  [BuildingType.TELEPORT_PAD]: {
    type: BuildingType.TELEPORT_PAD,
    name: 'Teleport Pad',
    cost: { ore: 0, crystals: 0 },
    size: 2,
    powered: true,
    model: 'teleport_pad'
  },
  [BuildingType.POWER_STATION]: {
    type: BuildingType.POWER_STATION,
    name: 'Power Station',
    cost: { ore: 10, crystals: 1 },
    size: 2,
    powered: false,
    model: 'power_station'
  },
  [BuildingType.SUPPORT_STATION]: {
    type: BuildingType.SUPPORT_STATION,
    name: 'Support Station',
    cost: { ore: 15, crystals: 2 },
    size: 2,
    powered: true,
    model: 'support_station'
  },
  [BuildingType.GEODOME]: {
    type: BuildingType.GEODOME,
    name: 'Geo-Dome',
    cost: { ore: 20, crystals: 3 },
    size: 2,
    powered: true,
    model: 'geodome'
  },
  [BuildingType.REFINERY]: {
    type: BuildingType.REFINERY,
    name: 'Refinery',
    cost: { ore: 15, crystals: 1 },
    size: 2,
    powered: true,
    model: 'refinery'
  },
  [BuildingType.SUPER_TELEPORT]: {
    type: BuildingType.SUPER_TELEPORT,
    name: 'Super Teleport',
    cost: { ore: 30, crystals: 5 },
    size: 2,
    powered: true,
    model: 'super_teleport'
  }
};

export class BuildingSystem {
  private gameState: GameState;
  private scene: THREE.Scene;
  private buildingMeshes = new Map<string, THREE.Group>();
  private onResourcesSpent: ((ore: number, crystals: number) => void) | null = null;
  
  constructor(gameState: GameState, scene: THREE.Scene) {
    this.gameState = gameState;
    this.scene = scene;
  }
  
  setResourceCallback(callback: (ore: number, crystals: number) => void): void {
    this.onResourcesSpent = callback;
  }
  
  canPlaceBuilding(bx: number, by: number, buildingType: BuildingType): boolean {
    const def = BUILDING_DEFS[buildingType];
    
    // Check if we can afford it
    if (this.gameState.resources.ore < def.cost.ore || 
        this.gameState.resources.crystals < def.cost.crystals) {
      return false;
    }
    
    // Check if area is clear
    for (let dy = 0; dy < def.size; dy++) {
      for (let dx = 0; dx < def.size; dx++) {
        const nx = bx + dx;
        const ny = by + dy;
        if (ny >= this.gameState.blocks.length || nx >= this.gameState.blocks[0].length) {
          return false;
        }
        const block = this.gameState.blocks[ny][nx];
        if (block.surfaceType !== SurfaceType.Floor) {
          return false;
        }
        // Check if another building is here
        if (this.gameState.buildings.some(b => 
          bx >= b.bx && bx < b.bx + def.size &&
          by >= b.by && by < b.by + def.size
        )) {
          return false;
        }
      }
    }
    
    return true;
  }
  
  placeBuilding(bx: number, by: number, buildingType: BuildingType): Building | null {
    if (!this.canPlaceBuilding(bx, by, buildingType)) {
      return null;
    }
    
    const def = BUILDING_DEFS[buildingType];
    
    // Deduct resources
    this.gameState.resources.ore -= def.cost.ore;
    this.gameState.resources.crystals -= def.cost.crystals;
    
    if (this.onResourcesSpent) {
      this.onResourcesSpent(def.cost.ore, def.cost.crystals);
    }
    
    const building: Building = {
      id: `building_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: buildingType,
      bx,
      by,
      health: 100,
      maxHealth: 100,
      powered: !def.powered // Auto-powered if doesn't need power
    };
    
    this.gameState.buildings.push(building);
    this.createBuildingMesh(building, def);
    
    // Mark blocks as occupied
    for (let dy = 0; dy < def.size; dy++) {
      for (let dx = 0; dx < def.size; dx++) {
        this.gameState.blocks[by + dy][bx + dx].flags |= 0x01; // Occupied flag
      }
    }
    
    return building;
  }
  
  private createBuildingMesh(building: Building, def: BuildingDef): void {
    const group = new THREE.Group();
    group.name = `building_${building.id}`;
    
    const worldPos = this.blockToWorld(building.bx, building.by);
    
    // Base platform
    const baseGeo = new THREE.BoxGeometry(def.size * 40, 4, def.size * 40);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x666666 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 2;
    base.castShadow = true;
    group.add(base);
    
    // Building color based on type
    const colors: Record<string, number> = {
      tool_store: 0xFF6B00,
      teleport_pad: 0x4488FF,
      power_station: 0xFF4444,
      support_station: 0x44FF44,
      geodome: 0x44FFFF,
      refinery: 0xFFAA00,
      super_teleport: 0xFF00FF
    };
    
    const mainColor = colors[def.model] || 0x888888;
    
    // Main structure
    const mainGeo = new THREE.BoxGeometry(def.size * 35, 20, def.size * 35);
    const mainMat = new THREE.MeshStandardMaterial({ color: mainColor });
    const main = new THREE.Mesh(mainGeo, mainMat);
    main.position.y = 14;
    main.castShadow = true;
    group.add(main);
    
    // Roof
    const roofGeo = new THREE.BoxGeometry(def.size * 30, 4, def.size * 30);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 26;
    group.add(roof);
    
    // Power indicator
    if (def.powered) {
      const lightGeo = new THREE.SphereGeometry(3, 8, 8);
      const lightMat = new THREE.MeshBasicMaterial({ 
        color: building.powered ? 0x00FF00 : 0xFF0000,
        transparent: true,
        opacity: 0.8
      });
      const light = new THREE.Mesh(lightGeo, lightMat);
      light.position.y = 32;
      group.add(light);
    }
    
    group.position.set(worldPos.x, worldPos.y, worldPos.z);
    this.scene.add(group);
    this.buildingMeshes.set(building.id, group);
  }
  
  private blockToWorld(bx: number, by: number): { x: number; y: number; z: number } {
    const blockSize = 40;
    const width = this.gameState.blocks[0]?.length || 40;
    const height = this.gameState.blocks.length || 40;
    const worldOffsetX = -((width - 1) * blockSize * 0.5);
    const worldOffsetY = (height - 1) * blockSize * 0.5;
    
    return {
      x: worldOffsetX + bx * blockSize + blockSize * 0.5,
      y: -(this.gameState.blocks[by]?.[bx]?.height || 0) * 8,
      z: worldOffsetY - by * blockSize - blockSize * 0.5
    };
  }
  
  updatePowerConnectivity(): void {
    // Simple power path connectivity - buildings connected by power paths are powered
    const poweredBuildings = new Set<string>();
    
    // Find power stations
    const powerStations = this.gameState.buildings.filter(b => b.type === BuildingType.POWER_STATION);
    for (const ps of powerStations) {
      poweredBuildings.add(ps.id);
    }
    
    // Propagate power through power paths
    // TODO: Implement proper path connectivity check
    for (const building of this.gameState.buildings) {
      const def = BUILDING_DEFS[building.type as BuildingType];
      if (!def.powered) {
        building.powered = true;
      }
    }
  }
  
  getToolStorePosition(): { x: number; y: number } | null {
    const toolStore = this.gameState.buildings.find(b => b.type === BuildingType.TOOL_STORE);
    if (toolStore) {
      return { x: toolStore.bx, y: toolStore.by };
    }
    return null;
  }

  private spawnTimer = 0;
  private readonly SPAWN_INTERVAL = 15.0;
  private healTimer = 0;
  private readonly HEAL_INTERVAL = 2.0;
  private onUnitSpawned: ((bx: number, by: number) => void) | null = null;

  setSpawnCallback(callback: (bx: number, by: number) => void): void {
    this.onUnitSpawned = callback;
  }

  update(deltaTime: number): void {
    // Teleport Pad: spawn new raiders
    const teleportPads = this.gameState.buildings.filter(
      b => b.type === BuildingType.TELEPORT_PAD && b.powered
    );
    if (teleportPads.length > 0) {
      this.spawnTimer += deltaTime;
      if (this.spawnTimer >= this.SPAWN_INTERVAL) {
        this.spawnTimer = 0;
        // Spawn a new raider at a random teleport pad
        const pad = teleportPads[Math.floor(Math.random() * teleportPads.length)];
        if (this.onUnitSpawned) {
          // Spawn at adjacent floor block
          const spawnPos = this.findAdjacentFloor(pad.bx, pad.by);
          if (spawnPos) {
            this.onUnitSpawned(spawnPos.x, spawnPos.y);
          }
        }
      }
    }

    // Support Station: heal nearby units
    const supportStations = this.gameState.buildings.filter(
      b => b.type === BuildingType.SUPPORT_STATION && b.powered
    );
    if (supportStations.length > 0) {
      this.healTimer += deltaTime;
      if (this.healTimer >= this.HEAL_INTERVAL) {
        this.healTimer = 0;
        for (const station of supportStations) {
          for (const unit of this.gameState.units) {
            const dx = unit.x - station.bx;
            const dy = unit.y - station.by;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 8) {
              unit.health = Math.min(unit.maxHealth, unit.health + 10);
            }
          }
        }
      }
    }
  }

  private findAdjacentFloor(bx: number, by: number): { x: number; y: number } | null {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = bx + dx;
        const ny = by + dy;
        if (ny >= 0 && ny < this.gameState.blocks.length &&
            nx >= 0 && nx < this.gameState.blocks[0].length) {
          if (this.gameState.blocks[ny][nx].surfaceType === SurfaceType.Floor) {
            return { x: nx, y: ny };
          }
        }
      }
    }
    return null;
  }

  dispose(): void {
    for (const [id, mesh] of this.buildingMeshes) {
      this.scene.remove(mesh);
    }
    this.buildingMeshes.clear();
  }
}
