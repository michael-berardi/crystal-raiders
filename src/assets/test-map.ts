import { MAPFile } from './map';

export function createTestMap(width: number = 40, height: number = 40): MAPFile {
  const map = new MAPFile();
  
  const blocks = new Uint16Array(width * height);
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let h = 2; // Base floor height
      let tex = 0x00; // Floor
      
      // Distance from center
      const distFromCenter = Math.max(Math.abs(x - cx), Math.abs(y - cy));
      
      if (distFromCenter > 3) {
        // Outer ring - walls
        if (distFromCenter < 6) {
          // Inner wall ring - loose rock
          h = 12;
          tex = 0x02;
        } else if (distFromCenter < 9) {
          // Medium rock
          h = 16;
          tex = 0x03;
        } else if (distFromCenter < 12) {
          // Hard rock
          h = 20;
          tex = 0x04;
        } else {
          // Immovable boundary
          h = 24;
          tex = 0x05;
        }
      }
      
      // Add some crystal seams in the medium rock
      if (tex === 0x03 && ((x + y) % 7 === 0)) {
        tex = 0x20; // Crystal seam
      }
      
      // Add some ore seams in loose rock
      if (tex === 0x02 && ((x * y) % 11 === 0)) {
        tex = 0x40; // Ore seam
      }
      
      // Create some corridors/chambers
      if (Math.abs(x - cx) < 2 || Math.abs(y - cy) < 2) {
        h = 2;
        tex = 0x00;
      }
      
      // Random caverns
      if ((x * 7 + y * 13) % 23 === 0 && distFromCenter > 5 && distFromCenter < 11) {
        h = 2;
        tex = 0x00;
      }
      
      blocks[y * width + x] = (tex << 8) | h;
    }
  }
  
  (map as any).dimensions = { width, height };
  (map as any).blocks = blocks;
  
  return map;
}
