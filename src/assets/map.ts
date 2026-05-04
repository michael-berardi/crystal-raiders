/**
 * MAP file parser for LEGO Rock Raiders terrain
 * Based on MapFileInfo structure from decompilation:
 * - Signature: "MAP " (4 bytes)
 * - fileSize: U32
 * - dimensions: Size2I (width, height as U16)
 * - blocks: U16 array
 */

export interface MapDimensions {
  width: number;
  height: number;
}

export interface MapBlock {
  value: number;
  height: number;      // Lower 8 bits
  texture: number;     // Upper 8 bits
}

export class MAPFile {
  public dimensions: MapDimensions = { width: 0, height: 0 };
  public blocks: Uint16Array = new Uint16Array(0);
  
  load(buffer: ArrayBuffer): void {
    const view = new DataView(buffer);
    let offset = 0;
    
    // Check signature
    const sig = new TextDecoder().decode(new Uint8Array(buffer, 0, 4));
    if (sig !== 'MAP ') {
      throw new Error(`Invalid MAP signature: ${sig}`);
    }
    offset += 4;
    
    // fileSize
    const fileSize = view.getUint32(offset, true);
    offset += 4;
    
    // dimensions
    this.dimensions.width = view.getUint16(offset, true);
    this.dimensions.height = view.getUint16(offset + 2, true);
    offset += 4;
    
    // blocks array
    const numBlocks = this.dimensions.width * this.dimensions.height;
    this.blocks = new Uint16Array(buffer, offset, numBlocks);
  }
  
  getBlock(x: number, y: number): number {
    if (x < 0 || x >= this.dimensions.width || y < 0 || y >= this.dimensions.height) {
      return 0;
    }
    return this.blocks[y * this.dimensions.width + x];
  }
  
  getBlockHeight(x: number, y: number): number {
    return this.getBlock(x, y) & 0xFF;
  }
  
  getBlockTexture(x: number, y: number): number {
    return (this.getBlock(x, y) >> 8) & 0xFF;
  }
}
