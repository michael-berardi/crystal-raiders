import { WADArchive } from './wad';
import { MAPFile } from './map';

export class AssetManager {
  private wads: WADArchive[] = [];
  private looseFiles: Map<string, ArrayBuffer> = new Map();
  private loadedMaps: Map<string, MAPFile> = new Map();
  
  async loadWAD(buffer: ArrayBuffer): Promise<void> {
    const wad = new WADArchive();
    await wad.load(buffer);
    this.wads.push(wad);
  }
  
  addLooseFile(name: string, buffer: ArrayBuffer): void {
    this.looseFiles.set(name.toLowerCase(), buffer);
  }
  
  getFile(name: string): ArrayBuffer | undefined {
    // Check loose files first
    const loose = this.looseFiles.get(name.toLowerCase());
    if (loose) return loose;
    
    // Check WADs (last loaded first)
    for (let i = this.wads.length - 1; i >= 0; i--) {
      const file = this.wads[i].getFile(name);
      if (file) {
        const buf = file.data.buffer;
        return buf.slice(file.data.byteOffset, file.data.byteOffset + file.data.byteLength) as ArrayBuffer;
      }
    }
    
    return undefined;
  }
  
  hasFile(name: string): boolean {
    if (this.looseFiles.has(name.toLowerCase())) return true;
    for (let i = this.wads.length - 1; i >= 0; i--) {
      if (this.wads[i].hasFile(name)) return true;
    }
    return false;
  }
  
  loadMAP(name: string): MAPFile | undefined {
    if (this.loadedMaps.has(name)) {
      return this.loadedMaps.get(name);
    }
    
    const buffer = this.getFile(name);
    if (!buffer) return undefined;
    
    const map = new MAPFile();
    map.load(buffer);
    this.loadedMaps.set(name, map);
    return map;
  }
}
