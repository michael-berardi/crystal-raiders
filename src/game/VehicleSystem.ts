import * as THREE from 'three';
import { GameState, SurfaceType } from './GameState';

export interface Vehicle {
  id: string;
  type: string;
  x: number;
  y: number;
  z: number;
  health: number;
  maxHealth: number;
  selected: boolean;
  task: string | null;
  speed: number;
  capacity: number;
  cargo: { ore: number; crystals: number };
}

export class VehicleSystem {
  private gameState: GameState;
  private scene: THREE.Scene;
  private vehicleMeshes = new Map<string, THREE.Group>();
  private selectionRings = new Map<string, THREE.Mesh>();
  
  constructor(gameState: GameState, scene: THREE.Scene) {
    this.gameState = gameState;
    this.scene = scene;
  }
  
  spawnVehicle(type: string, bx: number, by: number): Vehicle | null {
    const block = this.gameState.blocks[by]?.[bx];
    if (!block || block.surfaceType !== SurfaceType.Floor) return null;
    
    const vehicle: Vehicle = {
      id: `vehicle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      x: bx,
      y: by,
      z: 0,
      health: 100,
      maxHealth: 100,
      selected: false,
      task: null,
      speed: type === 'hover_scout' ? 4 : type === 'loader_dozer' ? 1.5 : 2,
      capacity: type === 'loader_dozer' ? 10 : 0,
      cargo: { ore: 0, crystals: 0 }
    };
    
    this.createVehicleMesh(vehicle);
    return vehicle;
  }
  
  private createVehicleMesh(vehicle: Vehicle): void {
    const group = new THREE.Group();
    group.name = `vehicle_${vehicle.id}`;
    
    const worldPos = this.blockToWorld(vehicle.x, vehicle.y);
    
    if (vehicle.type === 'hover_scout') {
      // Fast reconnaissance vehicle
      const bodyGeo = new THREE.BoxGeometry(12, 6, 18);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4488FF });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 5;
      body.castShadow = true;
      group.add(body);
      
      // Hover effect rings
      const ringGeo = new THREE.TorusGeometry(6, 1, 8, 16);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x00FFFF, transparent: true, opacity: 0.5 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 2;
      group.add(ring);
    } else if (vehicle.type === 'loader_dozer') {
      // Slow mining vehicle
      const bodyGeo = new THREE.BoxGeometry(16, 10, 20);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0xFF8800 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 7;
      body.castShadow = true;
      group.add(body);
      
      // Drill arm
      const armGeo = new THREE.BoxGeometry(4, 8, 12);
      const armMat = new THREE.MeshStandardMaterial({ color: 0x666666 });
      const arm = new THREE.Mesh(armGeo, armMat);
      arm.position.set(0, 10, 12);
      group.add(arm);
    } else {
      // Default vehicle
      const bodyGeo = new THREE.BoxGeometry(14, 8, 16);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 6;
      group.add(body);
    }
    
    // Selection ring
    const ringGeo = new THREE.RingGeometry(10, 12, 16);
    const ringMat = new THREE.MeshBasicMaterial({ 
      color: 0x00FF00, 
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.5;
    ring.visible = false;
    group.add(ring);
    this.selectionRings.set(vehicle.id, ring);
    
    // Health bar
    const healthBgGeo = new THREE.BoxGeometry(16, 1, 1);
    const healthBgMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
    const healthBg = new THREE.Mesh(healthBgGeo, healthBgMat);
    healthBg.position.y = 16;
    group.add(healthBg);
    
    const healthFgGeo = new THREE.BoxGeometry(16, 1, 1.1);
    const healthFgMat = new THREE.MeshBasicMaterial({ color: 0x00FF00 });
    const healthFg = new THREE.Mesh(healthFgGeo, healthFgMat);
    healthFg.position.y = 16;
    healthFg.name = 'healthBar';
    group.add(healthFg);
    
    group.position.set(worldPos.x, worldPos.y + 5, worldPos.z);
    this.scene.add(group);
    this.vehicleMeshes.set(vehicle.id, group);
  }
  
  private blockToWorld(bx: number, by: number): { x: number; y: number; z: number } {
    const blockSize = 40;
    const width = this.gameState.blocks[0]?.length || 40;
    const height = this.gameState.blocks.length || 40;
    const worldOffsetX = -((width - 1) * blockSize * 0.5);
    const worldOffsetY = (height - 1) * blockSize * 0.5;
    
    return {
      x: worldOffsetX + bx * blockSize + blockSize * 0.5,
      y: -(this.gameState.blocks[by]?.[bx]?.height || 0) * 8,
      z: worldOffsetY - by * blockSize - blockSize * 0.5
    };
  }
  
  update(deltaTime: number): void {
    // Update vehicle visuals (health bars, selection rings)
    for (const [vehicleId, mesh] of this.vehicleMeshes) {
      // Update health bar
      const healthBar = mesh.getObjectByName('healthBar') as THREE.Mesh;
      if (healthBar) {
        // This would need actual vehicle health data
      }
    }
  }
  
  removeVehicle(vehicleId: string): void {
    const mesh = this.vehicleMeshes.get(vehicleId);
    if (mesh) {
      this.scene.remove(mesh);
      this.vehicleMeshes.delete(vehicleId);
    }
    this.selectionRings.delete(vehicleId);
  }
  
  dispose(): void {
    for (const [id, mesh] of this.vehicleMeshes) {
      this.scene.remove(mesh);
    }
    this.vehicleMeshes.clear();
    this.selectionRings.clear();
  }
}
