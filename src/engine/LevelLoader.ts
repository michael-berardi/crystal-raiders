import { AssetManager } from '../assets/AssetManager';
import { MAPFile } from '../assets/map';

export interface LevelData {
  name: string;
  terrainMAP: MAPFile;
  predugMAP?: MAPFile;
  surfaceMAP?: MAPFile;
  pathMAP?: MAPFile;
  blockSize: number;
}

export class LevelLoader {
  constructor(private assets: AssetManager) {}
  
  async loadLevel(levelName: string): Promise<LevelData | null> {
    // Standard Rock Raiders level files:
    // - <level>.ol (object list)
    // - <level>.map (terrain height/texture)
    // - <level>.predug (pre-dug areas)
    // - <level>.surface (surface types)
    // - <level>.path (pathing data)
    
    const terrainMAP = this.assets.loadMAP(`${levelName}.map`);
    if (!terrainMAP) {
      console.error(`Could not load terrain MAP: ${levelName}.map`);
      return null;
    }
    
    // Try to load optional maps
    const predugMAP = this.assets.loadMAP(`${levelName}.predug`);
    const surfaceMAP = this.assets.loadMAP(`${levelName}.surf`);
    const pathMAP = this.assets.loadMAP(`${levelName}.path`);
    
    return {
      name: levelName,
      terrainMAP,
      predugMAP: predugMAP || undefined,
      surfaceMAP: surfaceMAP || undefined,
      pathMAP: pathMAP || undefined,
      blockSize: 40
    };
  }
  
  listAvailableLevels(): string[] {
    // Scan for .map files and extract level names
    const levels: string[] = [];
    // This would need to scan WADs - for now return empty
    return levels;
  }
}
