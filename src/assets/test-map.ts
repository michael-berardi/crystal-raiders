import { MAPFile } from './map';

export function createTestMap(width: number = 32, height: number = 32): MAPFile {
  const map = new MAPFile();
  
  // Create a simple test terrain with some variation
  const blocks = new Uint16Array(width * height);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Create a simple heightfield with some noise-like variation
      let h = 0;
      
      // Base terrain - higher in corners
      h = Math.floor(
        (Math.sin(x * 0.2) + Math.cos(y * 0.2)) * 3 +
        (Math.sin(x * 0.1 + y * 0.1) * 4) +
        8
      );
      
      // Clamp to valid range
      h = Math.max(0, Math.min(255, h));
      
      // Create some walls (higher difference areas)
      if (x > 10 && x < 22 && y > 10 && y < 22) {
        if (x === 11 || x === 21 || y === 11 || y === 21) {
          h = 20; // Wall ring
        } else {
          h = 2; // Interior cavern
        }
      }
      
      // Texture in upper 8 bits
      let tex = 0;
      if (h > 15) {
        tex = 0x05; // Hard wall
      } else if (h > 10) {
        tex = 0x03; // Medium wall
      } else if (h > 5) {
        tex = 0x02; // Loose wall
      } else {
        tex = 0x00; // Floor
      }
      
      blocks[y * width + x] = (tex << 8) | h;
    }
  }
  
  // Manually set up the map
  (map as any).dimensions = { width, height };
  (map as any).blocks = blocks;
  
  return map;
}
