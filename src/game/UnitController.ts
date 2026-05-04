import * as THREE from 'three';
import { GameState, Unit, Block, SurfaceType } from './GameState';
import { Pathfinder } from './Pathfinder';
import { TaskManager, TaskType, Task } from './TaskManager';

const UNIT_SPEED = 2.0;
const DRILL_SPEED = 0.5;
const COLLECT_SPEED = 1.0;
const BUILD_SPEED = 0.3;

export class UnitController {
  private pathfinder = new Pathfinder();
  private taskManager: TaskManager;
  private gameState: GameState;
  private unitMeshes = new Map<string, THREE.Group>();
  private selectionRings = new Map<string, THREE.Mesh>();
  private scene: THREE.Scene;
  private onResourceCollected: ((type: 'ore' | 'crystal', amount: number) => void) | null = null;

  constructor(gameState: GameState, taskManager: TaskManager, scene: THREE.Scene) {
    this.gameState = gameState;
    this.taskManager = taskManager;
    this.scene = scene;
  }

  setResourceCallback(callback: (type: 'ore' | 'crystal', amount: number) => void): void {
    this.onResourceCollected = callback;
  }

  setBlocks(blocks: Block[][]): void {
    this.pathfinder.setBlocks(blocks);
  }

  spawnUnit(type: string, bx: number, by: number): Unit {
    const worldPos = this.blockToWorld(bx, by);
    const unit = this.gameState.spawnUnit(type, bx, by, worldPos.y);
    this.createUnitMesh(unit);
    return unit;
  }

  private createUnitMesh(unit: Unit): void {
    const group = new THREE.Group();
    group.name = `unit_${unit.id}`;

    // Body - orange suit
    const bodyGeo = new THREE.BoxGeometry(6, 12, 4);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xFF6B00 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 6;
    body.castShadow = true;
    group.add(body);

    // Head
    const headGeo = new THREE.BoxGeometry(5, 5, 5);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xFFDBAC });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 15;
    head.castShadow = true;
    group.add(head);

    // Helmet
    const helmetGeo = new THREE.BoxGeometry(6, 3, 6);
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0xFF6B00 });
    const helmet = new THREE.Mesh(helmetGeo, helmetMat);
    helmet.position.y = 17.5;
    group.add(helmet);

    // Health bar background
    const healthBgGeo = new THREE.BoxGeometry(10, 1, 1);
    const healthBgMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
    const healthBg = new THREE.Mesh(healthBgGeo, healthBgMat);
    healthBg.position.y = 21;
    group.add(healthBg);

    // Health bar foreground
    const healthFgGeo = new THREE.BoxGeometry(10, 1, 1.1);
    const healthFgMat = new THREE.MeshBasicMaterial({ color: 0x00FF00 });
    const healthFg = new THREE.Mesh(healthFgGeo, healthFgMat);
    healthFg.position.y = 21;
    healthFg.name = 'healthBar';
    group.add(healthFg);

    // Selection ring
    const ringGeo = new THREE.RingGeometry(5, 7, 16);
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
    this.selectionRings.set(unit.id, ring);

    const worldPos = this.blockToWorld(unit.x, unit.y);
    group.position.set(worldPos.x, worldPos.y + 12, worldPos.z);
    
    this.scene.add(group);
    this.unitMeshes.set(unit.id, group);
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
    for (let i = this.gameState.units.length - 1; i >= 0; i--) {
      const unit = this.gameState.units[i];
      if (unit.health <= 0) {
        this.killUnit(unit.id);
        continue;
      }
      this.updateUnit(unit, deltaTime);
    }
  }

  private updateUnit(unit: Unit, deltaTime: number): void {
    const mesh = this.unitMeshes.get(unit.id);
    if (!mesh) return;

    const ring = this.selectionRings.get(unit.id);
    if (ring) {
      ring.visible = unit.selected;
    }

    // Update health bar
    const healthBar = mesh.getObjectByName('healthBar') as THREE.Mesh;
    if (healthBar) {
      const healthPercent = unit.health / unit.maxHealth;
      healthBar.scale.x = Math.max(0.01, healthPercent);
      
      const material = healthBar.material as THREE.MeshBasicMaterial;
      if (healthPercent > 0.6) {
        material.color.setHex(0x00FF00);
      } else if (healthPercent > 0.3) {
        material.color.setHex(0xFFFF00);
      } else {
        material.color.setHex(0xFF0000);
      }
    }

    // Lava damage
    const currentBlock = this.gameState.blocks[Math.round(unit.y)]?.[Math.round(unit.x)];
    if (currentBlock && currentBlock.surfaceType === SurfaceType.Lava) {
      unit.health -= 20; // 20 damage per second on lava
    }

    const task = this.taskManager.getTaskForUnit(unit.id);

    if (!task) {
      this.findAutoTask(unit);
      return;
    }

    if (task.type === TaskType.MOVE) {
      this.processMoveTask(unit, task, mesh, deltaTime);
    } else if (task.type === TaskType.DRILL) {
      this.processDrillTask(unit, task, mesh, deltaTime);
    } else if (task.type === TaskType.COLLECT) {
      this.processCollectTask(unit, task, mesh, deltaTime);
    } else if (task.type === TaskType.BUILD) {
      this.processBuildTask(unit, task, mesh, deltaTime);
    }
  }

  private killUnit(unitId: string): void {
    const mesh = this.unitMeshes.get(unitId);
    if (mesh) {
      // Death animation - fall over
      mesh.rotation.z = Math.PI / 2;
      mesh.position.y -= 6;
      
      // Remove after delay
      setTimeout(() => {
        this.removeUnit(unitId);
      }, 2000);
    }
    
    this.gameState.resources.minifigures = Math.max(0, this.gameState.resources.minifigures - 1);
  }

  private processMoveTask(unit: Unit, task: Task, mesh: THREE.Group, deltaTime: number): void {
    const targetPos = this.blockToWorld(task.targetX, task.targetY);
    const dx = targetPos.x - mesh.position.x;
    const dz = targetPos.z - mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 2) {
      unit.x = task.targetX;
      unit.y = task.targetY;
      unit.task = null;
      this.taskManager.completeTask(task.id);
      return;
    }

    const moveDist = UNIT_SPEED * 40 * deltaTime;
    const ratio = Math.min(1, moveDist / dist);
    mesh.position.x += dx * ratio;
    mesh.position.z += dz * ratio;
    mesh.rotation.y = Math.atan2(dx, dz);

    const block = this.gameState.blocks[Math.round(unit.y)]?.[Math.round(unit.x)];
    if (block) {
      const groundY = -(block.height * 8);
      mesh.position.y = groundY + 12;
    }
  }

  private processDrillTask(unit: Unit, task: Task, mesh: THREE.Group, deltaTime: number): void {
    const targetBx = task.targetBlockX ?? task.targetX;
    const targetBy = task.targetBlockY ?? task.targetY;
    
    let adjacentX = targetBx;
    let adjacentY = targetBy;
    
    let found = false;
    for (let dy = -1; dy <= 1 && !found; dy++) {
      for (let dx = -1; dx <= 1 && !found; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = targetBx + dx;
        const ny = targetBy + dy;
        if (ny >= 0 && ny < this.gameState.blocks.length && 
            nx >= 0 && nx < this.gameState.blocks[0].length) {
          const block = this.gameState.blocks[ny][nx];
          if (block.surfaceType === SurfaceType.Floor) {
            adjacentX = nx;
            adjacentY = ny;
            found = true;
          }
        }
      }
    }

    const targetPos = this.blockToWorld(adjacentX, adjacentY);
    const dx = targetPos.x - mesh.position.x;
    const dz = targetPos.z - mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 3) {
      const moveDist = UNIT_SPEED * 40 * deltaTime;
      const ratio = Math.min(1, moveDist / dist);
      mesh.position.x += dx * ratio;
      mesh.position.z += dz * ratio;
      mesh.rotation.y = Math.atan2(dx, dz);
      return;
    }

    const wallPos = this.blockToWorld(targetBx, targetBy);
    mesh.rotation.y = Math.atan2(wallPos.x - mesh.position.x, wallPos.z - mesh.position.z);

    task.progress += DRILL_SPEED * deltaTime;
    mesh.position.y = targetPos.y + 12 + Math.sin(Date.now() * 0.02) * 1;

    if (task.progress >= 1) {
      const block = this.gameState.blocks[targetBy]?.[targetBx];
      if (block) {
        const wasCrystal = block.surfaceType === SurfaceType.CrystalSeam;
        const wasOre = block.surfaceType === SurfaceType.OreSeam;
        
        block.surfaceType = SurfaceType.Floor;
        block.texture = 0;
        block.height = Math.max(0, block.height - 2);
        this.gameState.terrainDirty = true;

        if (wasCrystal && this.onResourceCollected) {
          this.onResourceCollected('crystal', 1);
        } else if (wasOre && this.onResourceCollected) {
          this.onResourceCollected('ore', 2);
        }
      }

      this.taskManager.completeTask(task.id);
      unit.task = null;
    }
  }

  private processCollectTask(unit: Unit, task: Task, mesh: THREE.Group, deltaTime: number): void {
    task.progress += COLLECT_SPEED * deltaTime;
    if (task.progress >= 1) {
      if (task.resourceType && this.onResourceCollected) {
        this.onResourceCollected(task.resourceType, task.resourceType === 'crystal' ? 1 : 2);
      }
      unit.task = null;
      this.taskManager.completeTask(task.id);
    }
  }

  private processBuildTask(unit: Unit, task: Task, mesh: THREE.Group, deltaTime: number): void {
    const targetPos = this.blockToWorld(task.targetX, task.targetY);
    const dx = targetPos.x - mesh.position.x;
    const dz = targetPos.z - mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 3) {
      const moveDist = UNIT_SPEED * 40 * deltaTime;
      const ratio = Math.min(1, moveDist / dist);
      mesh.position.x += dx * ratio;
      mesh.position.z += dz * ratio;
      mesh.rotation.y = Math.atan2(dx, dz);
      return;
    }

    task.progress += BUILD_SPEED * deltaTime;
    if (task.progress >= 1) {
      const block = this.gameState.blocks[task.targetY]?.[task.targetX];
      if (block) {
        block.surfaceType = SurfaceType.Floor;
        block.texture = 0x60;
      }
      unit.task = null;
      this.taskManager.completeTask(task.id);
    }
  }

  private findAutoTask(unit: Unit): void {
    // TODO: Auto-find drillable walls nearby
  }

  commandMove(unitIds: string[], targetX: number, targetY: number): void {
    for (const unitId of unitIds) {
      const currentTask = this.taskManager.getTaskForUnit(unitId);
      if (currentTask) {
        this.taskManager.removeTask(currentTask.id);
      }

      const unit = this.gameState.units.find(u => u.id === unitId);
      if (!unit) continue;

      const path = this.pathfinder.findPath(unit.x, unit.y, targetX, targetY);
      if (path && path.length > 1) {
        const endPoint = path[path.length - 1];
        this.taskManager.createTask(TaskType.MOVE, endPoint.x, endPoint.y, {
          priority: 2
        });
        const tasks = this.taskManager.getAllTasks();
        const task = tasks[tasks.length - 1];
        this.taskManager.assignTask(task.id, unitId);
        unit.task = task.id;
      }
    }
  }

  commandDrill(unitIds: string[], bx: number, by: number): void {
    for (const unitId of unitIds) {
      const currentTask = this.taskManager.getTaskForUnit(unitId);
      if (currentTask) {
        this.taskManager.removeTask(currentTask.id);
      }

      const unit = this.gameState.units.find(u => u.id === unitId);
      if (!unit) continue;

      const path = this.pathfinder.findPath(unit.x, unit.y, bx, by);
      if (path && path.length > 0) {
        const adjacentPoint = path.length > 1 ? path[path.length - 2] : path[0];
        this.taskManager.createTask(TaskType.DRILL, adjacentPoint.x, adjacentPoint.y, {
          targetBlockX: bx,
          targetBlockY: by,
          priority: 3
        });
        const tasks = this.taskManager.getAllTasks();
        const task = tasks[tasks.length - 1];
        this.taskManager.assignTask(task.id, unitId);
        unit.task = task.id;
      }
    }
  }

  removeUnit(unitId: string): void {
    const mesh = this.unitMeshes.get(unitId);
    if (mesh) {
      this.scene.remove(mesh);
      this.unitMeshes.delete(unitId);
    }
    this.selectionRings.delete(unitId);
    this.gameState.units = this.gameState.units.filter(u => u.id !== unitId);
  }

  getUnitMesh(unitId: string): THREE.Group | undefined {
    return this.unitMeshes.get(unitId);
  }
}
