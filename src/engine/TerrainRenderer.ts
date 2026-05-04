import * as THREE from 'three';
import { MAPFile } from '../assets/map';
import { GameState, SurfaceType } from '../game/GameState';

export interface TerrainConfig {
  blockSize: number;
  roughLevel: number;
}

const SURFACE_COLORS: Record<number, THREE.Color> = {
  0x00: new THREE.Color(0x8B7355),
  0x01: new THREE.Color(0x5C4033),
  0x02: new THREE.Color(0x6B5B45),
  0x03: new THREE.Color(0x7A6B55),
  0x04: new THREE.Color(0x8A7B65),
  0x05: new THREE.Color(0x9A9A9A),
  0x20: new THREE.Color(0x00FF88),
  0x40: new THREE.Color(0xFF8800),
  0x60: new THREE.Color(0x4488FF),
  0x70: new THREE.Color(0xFF3300),
  0x71: new THREE.Color(0x0066FF),
};

function getSurfaceColor(textureId: number): THREE.Color {
  if (SURFACE_COLORS[textureId]) {
    return SURFACE_COLORS[textureId];
  }
  if ((textureId & 0xF0) === 0x00) return SURFACE_COLORS[0x00];
  if ((textureId & 0xF0) === 0x10) return SURFACE_COLORS[0x01];
  if ((textureId & 0xF0) === 0x20) return SURFACE_COLORS[0x20];
  if ((textureId & 0xF0) === 0x30) return SURFACE_COLORS[0x01];
  if ((textureId & 0xF0) === 0x40) return SURFACE_COLORS[0x40];
  if ((textureId & 0xF0) === 0x50) return SURFACE_COLORS[0x00];
  if ((textureId & 0xF0) === 0x60) return SURFACE_COLORS[0x60];
  if ((textureId & 0xF0) === 0x70) return SURFACE_COLORS[0x70];
  return SURFACE_COLORS[0x00];
}

export class TerrainRenderer {
  private mesh: THREE.Mesh | null = null;
  private geometry: THREE.BufferGeometry | null = null;
  private material: THREE.MeshStandardMaterial | null = null;
  private config: TerrainConfig = { blockSize: 40, roughLevel: 8 };
  private map: MAPFile | null = null;
  
  createTerrain(map: MAPFile, config: TerrainConfig = { blockSize: 40, roughLevel: 8 }): THREE.Mesh {
    this.map = map;
    this.config = config;
    return this.buildMesh();
  }
  
  updateFromGameState(gameState: GameState): void {
    if (!this.mesh || !gameState.blocks.length) return;
    
    const geometry = this.mesh.geometry as THREE.BufferGeometry;
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
    const colors = geometry.getAttribute('color') as THREE.BufferAttribute;
    
    if (!positions || !colors) return;
    
    const { blockSize, roughLevel } = this.config;
    const width = gameState.blocks[0].length;
    const height = gameState.blocks.length;
    const blockWidth = width;
    const blockHeight = height;
    const worldOffsetX = -((blockWidth - 1) * blockSize * 0.5);
    const worldOffsetY = (blockHeight - 1) * blockSize * 0.5;
    
    let vertIdx = 0;
    let colorIdx = 0;
    
    for (let by = 0; by < blockHeight - 1; by++) {
      for (let bx = 0; bx < blockWidth - 1; bx++) {
        const h00 = gameState.blocks[by][bx].height;
        const h10 = gameState.blocks[by][bx + 1].height;
        const h11 = gameState.blocks[by + 1][bx + 1].height;
        const h01 = gameState.blocks[by + 1][bx].height;
        
        const t00 = gameState.blocks[by][bx].texture;
        const t10 = gameState.blocks[by][bx + 1].texture;
        const t11 = gameState.blocks[by + 1][bx + 1].texture;
        const t01 = gameState.blocks[by + 1][bx].texture;
        
        const x0 = worldOffsetX + bx * blockSize;
        const x1 = x0 + blockSize;
        const z0 = worldOffsetY - by * blockSize;
        const z1 = z0 - blockSize;
        
        const y00 = -(h00 * roughLevel);
        const y10 = -(h10 * roughLevel);
        const y11 = -(h11 * roughLevel);
        const y01 = -(h01 * roughLevel);
        
        // Update positions
        positions.setXYZ(vertIdx, x0, y00, z0);
        positions.setXYZ(vertIdx + 1, x1, y10, z0);
        positions.setXYZ(vertIdx + 2, x1, y11, z1);
        positions.setXYZ(vertIdx + 3, x0, y01, z1);
        
        // Update colors
        const c00 = getSurfaceColor(t00);
        const c10 = getSurfaceColor(t10);
        const c11 = getSurfaceColor(t11);
        const c01 = getSurfaceColor(t01);
        
        colors.setXYZ(colorIdx, c00.r, c00.g, c00.b);
        colors.setXYZ(colorIdx + 1, c10.r, c10.g, c10.b);
        colors.setXYZ(colorIdx + 2, c11.r, c11.g, c11.b);
        colors.setXYZ(colorIdx + 3, c01.r, c01.g, c01.b);
        
        vertIdx += 4;
        colorIdx += 4;
      }
    }
    
    positions.needsUpdate = true;
    colors.needsUpdate = true;
    geometry.computeVertexNormals();
  }
  
  private buildMesh(): THREE.Mesh {
    if (!this.map) throw new Error('No map data');
    
    const { width, height } = this.map.dimensions;
    const { blockSize, roughLevel } = this.config;
    
    const blockWidth = width - 1;
    const blockHeight = height - 1;
    
    if (blockWidth <= 0 || blockHeight <= 0) {
      throw new Error(`Invalid map dimensions: ${width}x${height}`);
    }
    
    const worldOffsetX = -(blockWidth * blockSize * 0.5);
    const worldOffsetY = blockHeight * blockSize * 0.5;
    
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const colorArray: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    
    for (let by = 0; by < blockHeight; by++) {
      for (let bx = 0; bx < blockWidth; bx++) {
        const baseIndex = vertices.length / 3;
        
        const h00 = this.map.getBlockHeight(bx, by);
        const h10 = this.map.getBlockHeight(bx + 1, by);
        const h11 = this.map.getBlockHeight(bx + 1, by + 1);
        const h01 = this.map.getBlockHeight(bx, by + 1);
        
        const t00 = this.map.getBlockTexture(bx, by);
        const t10 = this.map.getBlockTexture(bx + 1, by);
        const t11 = this.map.getBlockTexture(bx + 1, by + 1);
        const t01 = this.map.getBlockTexture(bx, by + 1);
        
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
        
        const c00 = getSurfaceColor(t00);
        const c10 = getSurfaceColor(t10);
        const c11 = getSurfaceColor(t11);
        const c01 = getSurfaceColor(t01);
        
        colorArray.push(
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
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colorArray, 3));
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
