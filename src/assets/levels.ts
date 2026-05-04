import { MAPFile } from './map';
import { SurfaceType } from '../game/GameState';

export interface LevelConfig {
  name: string;
  description: string;
  width: number;
  height: number;
  crystalsNeeded: number;
  timeLimit: number;
  startingUnits: number;
  hasLava: boolean;
  hasWater: boolean;
  wallDensity: number;
  crystalDensity: number;
  oreDensity: number;
}

export const LEVELS: LevelConfig[] = [
  {
    name: 'Tutorial',
    description: 'Learn the basics. Collect 5 crystals.',
    width: 40,
    height: 40,
    crystalsNeeded: 5,
    timeLimit: 300,
    startingUnits: 3,
    hasLava: false,
    hasWater: false,
    wallDensity: 0.6,
    crystalDensity: 0.08,
    oreDensity: 0.05
  },
  {
    name: 'Driller Night!',
    description: 'Build a Support Station. Collect 10 crystals.',
    width: 50,
    height: 50,
    crystalsNeeded: 10,
    timeLimit: 480,
    startingUnits: 4,
    hasLava: false,
    hasWater: false,
    wallDensity: 0.7,
    crystalDensity: 0.06,
    oreDensity: 0.08
  },
  {
    name: 'Hot Stuff',
    description: 'Watch out for lava! Collect 15 crystals.',
    width: 60,
    height: 60,
    crystalsNeeded: 15,
    timeLimit: 600,
    startingUnits: 5,
    hasLava: true,
    hasWater: false,
    wallDensity: 0.65,
    crystalDensity: 0.05,
    oreDensity: 0.1
  }
];

export function createLevelMap(config: LevelConfig): MAPFile {
  const map = new MAPFile();
  const { width, height } = config;
  const blocks = new Uint16Array(width * height);
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let h = 2;
      let tex = 0x00;

      const distFromCenter = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const maxDist = Math.sqrt(cx ** 2 + cy ** 2);
      const normalizedDist = distFromCenter / maxDist;

      if (normalizedDist > 0.15) {
        const wallThreshold = 1.0 - config.wallDensity;
        if (normalizedDist < 0.3) {
          h = 10;
          tex = 0x02;
        } else if (normalizedDist < 0.5) {
          h = 14;
          tex = 0x03;
        } else if (normalizedDist < 0.7) {
          h = 18;
          tex = 0x04;
        } else if (normalizedDist < 0.9) {
          h = 22;
          tex = 0x04;
        } else {
          h = 26;
          tex = 0x05;
        }

        // Add noise to walls
        const noise = Math.sin(x * 0.3) * Math.cos(y * 0.3) * 0.1;
        if (normalizedDist + noise < 0.15) {
          h = 2;
          tex = 0x00;
        }
      }

      // Crystal seams
      if (tex === 0x03 && Math.random() < config.crystalDensity) {
        tex = 0x20;
      }

      // Ore seams
      if (tex === 0x02 && Math.random() < config.oreDensity) {
        tex = 0x40;
      }

      // Corridors from center
      if (Math.abs(x - cx) < 2 || Math.abs(y - cy) < 2 ||
          Math.abs((x - cx) - (y - cy)) < 2 ||
          Math.abs((x - cx) + (y - cy)) < 2) {
        if (normalizedDist < 0.6) {
          h = 2;
          tex = 0x00;
        }
      }

      // Lava
      if (config.hasLava && normalizedDist > 0.4 && normalizedDist < 0.5) {
        if (Math.random() < 0.3) {
          h = 1;
          tex = 0x70; // Lava texture
        }
      }

      blocks[y * width + x] = (tex << 8) | h;
    }
  }

  (map as any).dimensions = { width, height };
  (map as any).blocks = blocks;

  return map;
}
