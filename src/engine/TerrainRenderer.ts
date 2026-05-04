import * as THREE from 'three';
import { MAPFile } from '../assets/map';

export interface TerrainConfig {
  blockSize: number;
  roughLevel: number;
}

// Surface texture colors based on decompilation SurfaceTexture enum
const SURFACE_COLORS: Record<number, THREE.Color> = {
  0x00: new THREE.Color(0x8B7355), // FLOOR_STD - brown floor
  0x01: new THREE.Color(0x5C4033), // WALL_SOIL - dark soil
  0x02: new THREE.Color(0x6B5B45), // WALL_LOOSE - loose rock
  0x03: new THREE.Color(0x7A6B55), // WALL_MED - medium rock
  0x04: new THREE.Color(0x8A7B65), // WALL_HARD - hard rock
  0x05: new THREE.Color(0x9A9A9A), // WALL_IMM - immovable/solid rock
  0x20: new THREE.Color(0x00FF88), // WALL_CRYSTALSEAM - crystal green
  0x40: new THREE.Color(0xFF8800), // WALL_ORESEAM - ore orange
  0x60: new THREE.Color(0x4488FF), // FLOOR_PATH_4SIDES - power path blue
  0x70: new THREE.Color(0x2A2A3A), // ROOF_STD - dark roof
};

function getSurfaceColor(textureId: number): THREE.Color {
  // Check exact match first
  if (SURFACE_COLORS[textureId]) {
    return SURFACE_COLORS[textureId];
  }
  
  // Check by category
  if ((textureId & 0xF0) === 0x00) return SURFACE_COLORS[0x00]; // Floor
  if ((textureId & 0xF0) === 0x10) return SURFACE_COLORS[0x01]; // Wall variants
  if ((textureId & 0xF0) === 0x20) return SURFACE_COLORS[0x20]; // Crystal
  if ((textureId & 0xF0) === 0x30) return SURFACE_COLORS[0x01]; // Corner variants
  if ((textureId & 0xF0) === 0x40) return SURFACE_COLORS[0x40]; // Ore
  if ((textureId & 0xF0) === 0x50) return SURFACE_COLORS[0x00]; // Corner variants
  if ((textureId & 0xF0) === 0x60) return SURFACE_COLORS[0x60]; // Path
  if ((textureId & 0xF0) === 0x70) return SURFACE_COLORS[0x70]; // Roof/Powered
  
  return SURFACE_COLORS[0x00]; // Default floor
}

export class TerrainRenderer {
  private mesh: THREE.Mesh | null = null;
  private geometry: THREE.BufferGeometry | null = null;
  private material: THREE.MeshStandardMaterial | null = null;
  
  createTerrain(map: MAPFile, config: TerrainConfig = { blockSize: 40, roughLevel: 8 }): THREE.Mesh {
    const { width, height } = map.dimensions;
    const { blockSize, roughLevel } = config;
    
    const blockWidth = width - 1;
    const blockHeight = height - 1;
    
    if (blockWidth <= 0 || blockHeight <= 0) {
      throw new Error(`Invalid map dimensions: ${width}x${height}`);
    }
    
    const worldOffsetX = -(blockWidth * blockSize * 0.5);
    const worldOffsetY = blockHeight * blockSize * 0.5;
    
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    
    for (let by = 0; by < blockHeight; by++) {
      for (let bx = 0; bx < blockWidth; bx++) {
        const baseIndex = vertices.length / 3;
        
        const h00 = map.getBlockHeight(bx, by);
        const h10 = map.getBlockHeight(bx + 1, by);
        const h11 = map.getBlockHeight(bx + 1, by + 1);
        const h01 = map.getBlockHeight(bx, by + 1);
        
        const t00 = map.getBlockTexture(bx, by);
        const t10 = map.getBlockTexture(bx + 1, by);
        const t11 = map.getBlockTexture(bx + 1, by + 1);
        const t01 = map.getBlockTexture(bx, by + 1);
        
        const x0 = worldOffsetX + bx * blockSize;
        const x1 = x0 + blockSize;
        const z0 = worldOffsetY - by * blockSize;
        const z1 = z0 - blockSize;
        
        const y00 = -(h00 * roughLevel);
        const y10 = -(h10 * roughLevel);
        const y11 = -(h11 * roughLevel);
        const y01 = -(h01 * roughLevel);
        
        vertices.push(
          x0, y00, z0,
          x1, y10, z0,
          x1, y11, z1,
          x0, y01, z1
        );
        
        // Vertex colors based on surrounding texture
        const c00 = getSurfaceColor(t00);
        const c10 = getSurfaceColor(t10);
        const c11 = getSurfaceColor(t11);
        const c01 = getSurfaceColor(t01);
        
        colors.push(
          c00.r, c00.g, c00.b,
          c10.r, c10.g, c10.b,
          c11.r, c11.g, c11.b,
          c01.r, c01.g, c01.b
        );
        
        uvs.push(
          0, 0,
          1, 0,
          1, 1,
          0, 1
        );
        
        indices.push(
          baseIndex, baseIndex + 1, baseIndex + 3,
          baseIndex + 1, baseIndex + 2, baseIndex + 3
        );
      }
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.1,
      flatShading: false,
      side: THREE.DoubleSide
    });
    
    this.geometry = geometry;
    this.material = material;
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'terrain';
    
    return this.mesh;
  }
  
  dispose(): void {
    this.geometry?.dispose();
    this.material?.dispose();
    this.mesh = null;
  }
}
