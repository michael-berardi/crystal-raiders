import * as THREE from 'three';
import { MAPFile } from '../assets/map';

export interface WallConfig {
  blockSize: number;
  roughLevel: number;
}

export class WallRenderer {
  private mesh: THREE.Mesh | null = null;
  private geometry: THREE.BufferGeometry | null = null;
  private material: THREE.MeshStandardMaterial | null = null;
  
  createWalls(map: MAPFile, config: WallConfig = { blockSize: 40, roughLevel: 8 }): THREE.Mesh | null {
    const { width, height } = map.dimensions;
    const { blockSize, roughLevel } = config;
    
    const blockWidth = width - 1;
    const blockHeight = height - 1;
    
    if (blockWidth <= 0 || blockHeight <= 0) return null;
    
    const worldOffsetX = -(blockWidth * blockSize * 0.5);
    const worldOffsetY = blockHeight * blockSize * 0.5;
    
    const vertices: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    
    const addWallFace = (
      x1: number, z1: number, y1a: number, y1b: number,
      x2: number, z2: number, y2a: number, y2b: number,
      color: THREE.Color
    ) => {
      const baseIndex = vertices.length / 3;
      
      vertices.push(
        x1, y1a, z1,
        x2, y2a, z2,
        x2, y2b, z2,
        x1, y1b, z1
      );
      
      // Calculate normal
      const v0 = new THREE.Vector3(x1, y1a, z1);
      const v1 = new THREE.Vector3(x2, y2a, z2);
      const v2 = new THREE.Vector3(x2, y2b, z2);
      const edge1 = new THREE.Vector3().subVectors(v1, v0);
      const edge2 = new THREE.Vector3().subVectors(v2, v0);
      const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();
      
      normals.push(
        normal.x, normal.y, normal.z,
        normal.x, normal.y, normal.z,
        normal.x, normal.y, normal.z,
        normal.x, normal.y, normal.z
      );
      
      colors.push(
        color.r, color.g, color.b,
        color.r, color.g, color.b,
        color.r, color.g, color.b,
        color.r, color.g, color.b
      );
      
      indices.push(
        baseIndex, baseIndex + 1, baseIndex + 3,
        baseIndex + 1, baseIndex + 2, baseIndex + 3
      );
    };
    
    for (let by = 0; by < blockHeight; by++) {
      for (let bx = 0; bx < blockWidth; bx++) {
        const h00 = map.getBlockHeight(bx, by);
        const h10 = map.getBlockHeight(bx + 1, by);
        const h11 = map.getBlockHeight(bx + 1, by + 1);
        const h01 = map.getBlockHeight(bx, by + 1);
        
        const t00 = map.getBlockTexture(bx, by);
        
        const x0 = worldOffsetX + bx * blockSize;
        const x1 = x0 + blockSize;
        const z0 = worldOffsetY - by * blockSize;
        const z1 = z0 - blockSize;
        
        const y00 = -(h00 * roughLevel);
        const y10 = -(h10 * roughLevel);
        const y11 = -(h11 * roughLevel);
        const y01 = -(h01 * roughLevel);
        
        // Wall color (slightly darker than surface)
        const wallColor = new THREE.Color(0x5C4033);
        
        // Check each edge for height differences
        // Top edge (facing -Z)
        if (Math.abs(y00 - y01) > 0.1 || by === 0) {
          const maxY = Math.max(y00, y01);
          const minY = Math.min(y00, y01) - blockSize * 0.5;
          addWallFace(x0, z0, y00, minY, x0, z1, y01, minY, wallColor);
        }
        
        // Right edge (facing +X)
        if (Math.abs(y10 - y11) > 0.1 || bx === blockWidth - 1) {
          const maxY = Math.max(y10, y11);
          const minY = Math.max(y10, y11) - blockSize * 0.5;
          addWallFace(x1, z0, y10, minY, x1, z1, y11, minY, wallColor);
        }
      }
    }
    
    if (vertices.length === 0) return null;
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      metalness: 0.05,
      flatShading: true,
      side: THREE.DoubleSide
    });
    
    this.geometry = geometry;
    this.material = material;
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'walls';
    
    return this.mesh;
  }
  
  dispose(): void {
    this.geometry?.dispose();
    this.material?.dispose();
    this.mesh = null;
  }
}
