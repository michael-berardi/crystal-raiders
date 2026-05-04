/**
 * WAD file parser for LEGO Rock Raiders
 * Format:
 * - Header: "WWAD" (4 bytes)
 * - numFiles: int32
 * - WAD names: null-terminated strings
 * - File names: null-terminated strings  
 * - Entries: WadEntry[numFiles]
 *   - compression: int32
 *   - fileLength: int32
 *   - decompressedLength: int32
 *   - addr: int32
 */

export interface WadEntry {
  compression: number;
  fileLength: number;
  decompressedLength: number;
  addr: number;
}

export interface WadFile {
  name: string;
  data: Uint8Array;
  compression: number;
}

export class WADArchive {
  private files: Map<string, WadFile> = new Map();
  
  async load(buffer: ArrayBuffer): Promise<void> {
    const view = new DataView(buffer);
    let offset = 0;
    
    // Check header
    const header = new TextDecoder().decode(new Uint8Array(buffer, 0, 4));
    if (header !== 'WWAD') {
      throw new Error(`Invalid WAD header: ${header}`);
    }
    offset += 4;
    
    const numFiles = view.getInt32(offset, true);
    offset += 4;
    
    // Read WAD names
    const wadNames: string[] = [];
    for (let i = 0; i < numFiles; i++) {
      const name = this.readCString(view, offset);
      wadNames.push(name);
      offset += name.length + 1;
    }
    
    // Read file names
    const fileNames: string[] = [];
    for (let i = 0; i < numFiles; i++) {
      const name = this.readCString(view, offset);
      fileNames.push(name);
      offset += name.length + 1;
    }
    
    // Read entries
    for (let i = 0; i < numFiles; i++) {
      const compression = view.getInt32(offset, true);
      const fileLength = view.getInt32(offset + 4, true);
      const decompressedLength = view.getInt32(offset + 8, true);
      const addr = view.getInt32(offset + 12, true);
      offset += 16;
      
      // Extract file data
      const fileData = new Uint8Array(buffer, addr, fileLength);
      
      // TODO: Handle RNC compression if needed
      // Most files are uncompressed
      
      this.files.set(fileNames[i].toLowerCase(), {
        name: fileNames[i],
        data: fileData,
        compression
      });
    }
  }
  
  getFile(name: string): WadFile | undefined {
    return this.files.get(name.toLowerCase());
  }
  
  hasFile(name: string): boolean {
    return this.files.has(name.toLowerCase());
  }
  
  listFiles(): string[] {
    return Array.from(this.files.keys());
  }
  
  private readCString(view: DataView, startOffset: number): string {
    const bytes: number[] = [];
    let offset = startOffset;
    while (offset < view.byteLength) {
      const byte = view.getUint8(offset);
      if (byte === 0) break;
      bytes.push(byte);
      offset++;
    }
    return new TextDecoder().decode(new Uint8Array(bytes));
  }
}
