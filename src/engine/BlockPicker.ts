import * as THREE from 'three';

export interface BlockHit {
  bx: number;
  by: number;
  point: THREE.Vector3;
  normal: THREE.Vector3;
}

export class BlockPicker {
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private highlightMesh: THREE.Mesh | null = null;
  private highlightGeometry: THREE.BoxGeometry | null = null;
  private highlightMaterial: THREE.MeshBasicMaterial | null = null;
  
  getMousePosition(): THREE.Vector2 {
    return this.mouse.clone();
  }

  constructor(private scene: THREE.Scene, private camera: THREE.PerspectiveCamera) {
    // Create highlight mesh
    this.highlightGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.highlightMaterial = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.3,
      depthTest: false
    });
    this.highlightMesh = new THREE.Mesh(this.highlightGeometry, this.highlightMaterial);
    this.highlightMesh.visible = false;
    this.highlightMesh.renderOrder = 999;
    this.scene.add(this.highlightMesh);
  }
  
  updateMouse(clientX: number, clientY: number, canvas: HTMLCanvasElement): void {
    const rect = canvas.getBoundingClientRect();
    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }
  
  pick(terrainMesh: THREE.Mesh): BlockHit | null {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    const intersects = this.raycaster.intersectObject(terrainMesh);
    if (intersects.length === 0) return null;
    
    const hit = intersects[0];
    const point = hit.point;
    
    // Convert world position to block coordinates
    // This is a simplified version - the actual game uses Map3D_WorldToBlockPos
    const terrain = terrainMesh.geometry;
    const positions = terrain.getAttribute('position');
    
    if (!positions) return null;
    
    // Find the closest block center
    let closestDist = Infinity;
    let closestBlock: BlockHit | null = null;
    
    // Get face index from the intersection
    const faceIndex = hit.faceIndex || 0;
    const triangleIndex = Math.floor(faceIndex / 2);
    
    // Each block has 2 triangles, so triangleIndex = blockIndex
    // But we need to convert blockIndex to bx, by
    // This requires knowing the terrain dimensions
    
    // For now, use a simpler approach: approximate from world position
    // We know the terrain is centered at origin with blockSize=40
    const blockSize = 40;
    const bx = Math.floor((point.x + 800) / blockSize);
    const by = Math.floor((800 - point.z) / blockSize);
    
    return {
      bx: Math.max(0, bx),
      by: Math.max(0, by),
      point: point.clone(),
      normal: hit.face?.normal?.clone() || new THREE.Vector3(0, 1, 0)
    };
  }
  
  showHighlight(bx: number, by: number, blockSize: number = 40): void {
    if (!this.highlightMesh) return;
    
    const worldOffsetX = -((39) * blockSize * 0.5);
    const worldOffsetY = (39) * blockSize * 0.5;
    
    const x = worldOffsetX + bx * blockSize + blockSize * 0.5;
    const z = worldOffsetY - by * blockSize - blockSize * 0.5;
    
    this.highlightMesh.position.set(x, 0, z);
    this.highlightMesh.scale.set(blockSize, blockSize, blockSize);
    this.highlightMesh.visible = true;
  }
  
  hideHighlight(): void {
    if (this.highlightMesh) {
      this.highlightMesh.visible = false;
    }
  }
  
  dispose(): void {
    this.highlightGeometry?.dispose();
    this.highlightMaterial?.dispose();
    if (this.highlightMesh) {
      this.scene.remove(this.highlightMesh);
    }
  }
}
