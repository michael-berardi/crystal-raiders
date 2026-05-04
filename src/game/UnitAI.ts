import { GameState, SurfaceType, Block } from './GameState';
import { UnitController } from './UnitController';
import { TaskManager, TaskType } from './TaskManager';

export class UnitAI {
  private gameState: GameState;
  private taskManager: TaskManager;
  private unitController: UnitController;
  private thinkTimer = 0;
  private readonly THINK_INTERVAL = 2.0; // Think every 2 seconds
  
  constructor(
    gameState: GameState,
    taskManager: TaskManager,
    unitController: UnitController
  ) {
    this.gameState = gameState;
    this.taskManager = taskManager;
    this.unitController = unitController;
  }
  
  update(deltaTime: number): void {
    this.thinkTimer += deltaTime;
    if (this.thinkTimer < this.THINK_INTERVAL) return;
    this.thinkTimer = 0;
    
    for (const unit of this.gameState.units) {
      const hasTask = this.taskManager.getTaskForUnit(unit.id);
      if (hasTask) continue; // Already has a task
      
      this.findTaskForUnit(unit.id);
    }
  }
  
  private findTaskForUnit(unitId: string): void {
    const unit = this.gameState.units.find(u => u.id === unitId);
    if (!unit) return;
    
    // Priority 1: Drill crystal seams
    const crystalSeam = this.findNearestBlock(
      unit.x, unit.y,
      b => b.surfaceType === SurfaceType.CrystalSeam
    );
    if (crystalSeam) {
      this.unitController.commandDrill([unitId], crystalSeam.bx, crystalSeam.by);
      return;
    }
    
    // Priority 2: Drill ore seams
    const oreSeam = this.findNearestBlock(
      unit.x, unit.y,
      b => b.surfaceType === SurfaceType.OreSeam
    );
    if (oreSeam) {
      this.unitController.commandDrill([unitId], oreSeam.bx, oreSeam.by);
      return;
    }
    
    // Priority 3: Drill any drillable wall
    const drillableWall = this.findNearestBlock(
      unit.x, unit.y,
      b => b.surfaceType >= SurfaceType.WallSoil && 
           b.surfaceType <= SurfaceType.WallHard
    );
    if (drillableWall) {
      this.unitController.commandDrill([unitId], drillableWall.bx, drillableWall.by);
      return;
    }
    
    // Priority 4: Clear rubble (floor with high height)
    const rubble = this.findNearestBlock(
      unit.x, unit.y,
      b => b.surfaceType === SurfaceType.Floor && b.height > 5
    );
    if (rubble) {
      // TODO: Implement clear rubble task
    }
  }
  
  private findNearestBlock(
    fromX: number, fromY: number,
    predicate: (block: Block) => boolean
  ): Block | null {
    let nearest: Block | null = null;
    let nearestDist = Infinity;
    
    for (let by = 0; by < this.gameState.blocks.length; by++) {
      for (let bx = 0; bx < this.gameState.blocks[0].length; bx++) {
        const block = this.gameState.blocks[by][bx];
        if (!predicate(block)) continue;
        
        // Check if already assigned
        const tasks = this.taskManager.getAllTasks();
        const alreadyAssigned = tasks.some(t => 
          !t.completed && 
          t.targetBlockX === bx && 
          t.targetBlockY === by
        );
        if (alreadyAssigned) continue;
        
        const dist = Math.abs(bx - fromX) + Math.abs(by - fromY);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = block;
        }
      }
    }
    
    return nearest;
  }
  
  // Find all drillable walls and assign them to idle units
  assignTasksToIdleUnits(): void {
    const idleUnits = this.gameState.units.filter(u => !u.task);
    if (idleUnits.length === 0) return;
    
    // Find all unassigned drillable targets
    const targets: Block[] = [];
    for (let by = 0; by < this.gameState.blocks.length; by++) {
      for (let bx = 0; bx < this.gameState.blocks[0].length; bx++) {
        const block = this.gameState.blocks[by][bx];
        if (block.surfaceType === SurfaceType.CrystalSeam ||
            block.surfaceType === SurfaceType.OreSeam ||
            (block.surfaceType >= SurfaceType.WallSoil && 
             block.surfaceType <= SurfaceType.WallHard)) {
          
          const tasks = this.taskManager.getAllTasks();
          const alreadyAssigned = tasks.some(t => 
            !t.completed && 
            t.targetBlockX === bx && 
            t.targetBlockY === by
          );
          if (!alreadyAssigned) {
            targets.push(block);
          }
        }
      }
    }
    
    // Sort targets by value (crystals > ore > walls)
    targets.sort((a, b) => {
      const valueA = a.surfaceType === SurfaceType.CrystalSeam ? 3 : 
                     a.surfaceType === SurfaceType.OreSeam ? 2 : 1;
      const valueB = b.surfaceType === SurfaceType.CrystalSeam ? 3 : 
                     b.surfaceType === SurfaceType.OreSeam ? 2 : 1;
      return valueB - valueA;
    });
    
    // Assign to idle units
    for (let i = 0; i < Math.min(idleUnits.length, targets.length); i++) {
      const unit = idleUnits[i];
      const target = targets[i];
      this.unitController.commandDrill([unit.id], target.bx, target.by);
    }
  }
}
