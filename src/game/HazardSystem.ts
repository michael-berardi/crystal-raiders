import * as THREE from 'three';
import { GameState, SurfaceType, Block } from './GameState';

export interface FallingRock {
  mesh: THREE.Mesh;
  bx: number;
  by: number;
  velocity: number;
  active: boolean;
}

export interface Monster {
  id: string;
  mesh: THREE.Group;
  bx: number;
  by: number;
  health: number;
  type: 'slug' | 'scorpion' | 'bat';
  active: boolean;
  timer: number;
}

export class HazardSystem {
  private gameState: GameState;
  private scene: THREE.Scene;
  private rocks: FallingRock[] = [];
  private monsters: Monster[] = [];
  private rockFallTimer = 0;
  private readonly ROCK_FALL_INTERVAL = 15.0; // Rock fall every 15 seconds
  private readonly MONSTER_SPAWN_INTERVAL = 30.0;
  private monsterTimer = 0;
  private onDamage: ((damage: number) => void) | null = null;
  
  constructor(gameState: GameState, scene: THREE.Scene) {
    this.gameState = gameState;
    this.scene = scene;
  }
  
  setDamageCallback(callback: (damage: number) => void): void {
    this.onDamage = callback;
  }
  
  update(deltaTime: number): void {
    this.updateRocks(deltaTime);
    this.updateMonsters(deltaTime);
    
    // Random rock falls
    this.rockFallTimer += deltaTime;
    if (this.rockFallTimer >= this.ROCK_FALL_INTERVAL) {
      this.rockFallTimer = 0;
      this.triggerRandomRockFall();
    }
    
    // Monster spawning
    this.monsterTimer += deltaTime;
    if (this.monsterTimer >= this.MONSTER_SPAWN_INTERVAL) {
      this.monsterTimer = 0;
      this.spawnMonster();
    }
  }
  
  private updateRocks(deltaTime: number): void {
    for (const rock of this.rocks) {
      if (!rock.active) continue;
      
      rock.velocity += 9.8 * deltaTime; // Gravity
      rock.mesh.position.y -= rock.velocity * deltaTime * 10;
      
      // Check if hit ground
      const groundY = -(this.gameState.blocks[rock.by]?.[rock.bx]?.height || 0) * 8;
      if (rock.mesh.position.y <= groundY) {
        rock.mesh.position.y = groundY;
        rock.active = false;
        
        // Damage nearby units
        for (const unit of this.gameState.units) {
          const dx = unit.x - rock.bx;
          const dy = unit.y - rock.by;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 2) {
            unit.health -= 20;
            if (this.onDamage) this.onDamage(20);
          }
        }
        
        // Remove after a delay
        setTimeout(() => {
          this.scene.remove(rock.mesh);
          rock.mesh.geometry.dispose();
          (rock.mesh.material as THREE.Material).dispose();
        }, 2000);
      }
      
      // Rotate while falling
      rock.mesh.rotation.x += deltaTime * 2;
      rock.mesh.rotation.z += deltaTime * 1.5;
    }
    
    // Clean up inactive rocks
    this.rocks = this.rocks.filter(r => r.active);
  }
  
  private updateMonsters(deltaTime: number): void {
    for (const monster of this.monsters) {
      if (!monster.active) continue;
      
      monster.timer += deltaTime;
      
      // Simple AI: move toward nearest unit
      let nearestUnit = null;
      let nearestDist = Infinity;
      
      for (const unit of this.gameState.units) {
        const dx = unit.x - monster.bx;
        const dy = unit.y - monster.by;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestUnit = unit;
        }
      }
      
      if (nearestUnit && nearestDist < 10) {
        // Move toward unit
        const speed = 1.5 * deltaTime;
        const dx = nearestUnit.x - monster.bx;
        const dy = nearestUnit.y - monster.by;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 0) {
          monster.bx += (dx / dist) * speed;
          monster.by += (dy / dist) * speed;
          
          const worldPos = this.blockToWorld(
            Math.round(monster.bx),
            Math.round(monster.by)
          );
          monster.mesh.position.x = worldPos.x;
          monster.mesh.position.z = worldPos.z;
          monster.mesh.position.y = worldPos.y + 5;
          monster.mesh.rotation.y = Math.atan2(dx, dy);
        }
        
        // Attack if close
        if (nearestDist < 1.5) {
          nearestUnit.health -= 10 * deltaTime;
          if (this.onDamage) this.onDamage(10 * deltaTime);
        }
      }
      
      // Bob animation
      monster.mesh.position.y += Math.sin(monster.timer * 3) * 0.5 * deltaTime;
    }
    
    // Clean up dead monsters
    for (let i = this.monsters.length - 1; i >= 0; i--) {
      if (this.monsters[i].health <= 0) {
        this.scene.remove(this.monsters[i].mesh);
        this.monsters.splice(i, 1);
      }
    }
  }
  
  triggerRandomRockFall(): void {
    // Find a ceiling block (high height adjacent to floor)
    const candidates: Block[] = [];
    
    for (let by = 1; by < this.gameState.blocks.length - 1; by++) {
      for (let bx = 1; bx < this.gameState.blocks[0].length - 1; bx++) {
        const block = this.gameState.blocks[by][bx];
        if (block.height > 10) {
          // Check if any neighbor is walkable
          const neighbors = [
            this.gameState.blocks[by-1]?.[bx],
            this.gameState.blocks[by+1]?.[bx],
            this.gameState.blocks[by]?.[bx-1],
            this.gameState.blocks[by]?.[bx+1]
          ];
          if (neighbors.some(n => n && n.surfaceType === SurfaceType.Floor)) {
            candidates.push(block);
          }
        }
      }
    }
    
    if (candidates.length === 0) return;
    
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    this.spawnRock(target.bx, target.by);
  }
  
  spawnRock(bx: number, by: number): void {
    const geometry = new THREE.DodecahedronGeometry(8, 0);
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x8B7355,
      roughness: 0.9
    });
    const mesh = new THREE.Mesh(geometry, material);
    
    const worldPos = this.blockToWorld(bx, by);
    mesh.position.set(worldPos.x, worldPos.y + 50, worldPos.z);
    mesh.castShadow = true;
    
    this.scene.add(mesh);
    
    this.rocks.push({
      mesh,
      bx,
      by,
      velocity: 0,
      active: true
    });
  }
  
  spawnMonster(type: 'slug' | 'scorpion' | 'bat' = 'slug'): void {
    // Find a floor block far from center
    const cx = Math.floor(this.gameState.blocks[0].length / 2);
    const cy = Math.floor(this.gameState.blocks.length / 2);
    
    const candidates: Block[] = [];
    for (let by = 0; by < this.gameState.blocks.length; by++) {
      for (let bx = 0; bx < this.gameState.blocks[0].length; bx++) {
        const block = this.gameState.blocks[by][bx];
        const dist = Math.abs(bx - cx) + Math.abs(by - cy);
        if (block.surfaceType === SurfaceType.Floor && dist > 8) {
          candidates.push(block);
        }
      }
    }
    
    if (candidates.length === 0) return;
    
    const spawnBlock = candidates[Math.floor(Math.random() * candidates.length)];
    
    const group = new THREE.Group();
    
    // Body
    const bodyGeo = new THREE.BoxGeometry(8, 6, 12);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8B00FF });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 3;
    group.add(body);
    
    // Eyes
    const eyeGeo = new THREE.SphereGeometry(1.5, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xFF0000 });
    const eye1 = new THREE.Mesh(eyeGeo, eyeMat);
    eye1.position.set(-2, 5, 5);
    group.add(eye1);
    const eye2 = new THREE.Mesh(eyeGeo, eyeMat);
    eye2.position.set(2, 5, 5);
    group.add(eye2);
    
    const worldPos = this.blockToWorld(spawnBlock.bx, spawnBlock.by);
    group.position.set(worldPos.x, worldPos.y + 5, worldPos.z);
    
    this.scene.add(group);
    
    this.monsters.push({
      id: `monster_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      mesh: group,
      bx: spawnBlock.bx,
      by: spawnBlock.by,
      health: 50,
      type,
      active: true,
      timer: 0
    });
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
  
  dispose(): void {
    for (const rock of this.rocks) {
      this.scene.remove(rock.mesh);
      rock.mesh.geometry.dispose();
      (rock.mesh.material as THREE.Material).dispose();
    }
    this.rocks = [];
    
    for (const monster of this.monsters) {
      this.scene.remove(monster.mesh);
    }
    this.monsters = [];
  }
}
