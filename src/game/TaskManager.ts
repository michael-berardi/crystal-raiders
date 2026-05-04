export enum TaskType {
  MOVE = 'move',
  DRILL = 'drill',
  COLLECT = 'collect',
  BUILD = 'build',
  REINFORCE = 'reinforce',
  IDLE = 'idle'
}

export interface Task {
  id: string;
  type: TaskType;
  targetX: number;
  targetY: number;
  targetBlockX?: number;
  targetBlockY?: number;
  priority: number; // Higher = more urgent
  assignedUnitId: string | null;
  completed: boolean;
  progress: number; // 0-1
  resourceType?: 'ore' | 'crystal';
}

export class TaskManager {
  private tasks: Task[] = [];
  private taskIdCounter = 0;

  createTask(type: TaskType, targetX: number, targetY: number, options: {
    targetBlockX?: number;
    targetBlockY?: number;
    priority?: number;
    resourceType?: 'ore' | 'crystal';
  } = {}): Task {
    const task: Task = {
      id: `task_${++this.taskIdCounter}`,
      type,
      targetX,
      targetY,
      targetBlockX: options.targetBlockX,
      targetBlockY: options.targetBlockY,
      priority: options.priority || 1,
      assignedUnitId: null,
      completed: false,
      progress: 0,
      resourceType: options.resourceType
    };
    this.tasks.push(task);
    return task;
  }

  getUnassignedTasks(): Task[] {
    return this.tasks.filter(t => !t.assignedUnitId && !t.completed);
  }

  getTaskForUnit(unitId: string): Task | undefined {
    return this.tasks.find(t => t.assignedUnitId === unitId && !t.completed);
  }

  assignTask(taskId: string, unitId: string): boolean {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task || task.assignedUnitId || task.completed) return false;
    task.assignedUnitId = unitId;
    return true;
  }

  completeTask(taskId: string): void {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      task.completed = true;
      task.progress = 1;
    }
  }

  updateTaskProgress(taskId: string, progress: number): void {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      task.progress = Math.min(1, Math.max(0, progress));
    }
  }

  removeTask(taskId: string): void {
    this.tasks = this.tasks.filter(t => t.id !== taskId);
  }

  getAllTasks(): Task[] {
    return this.tasks;
  }

  clearCompletedTasks(): void {
    this.tasks = this.tasks.filter(t => !t.completed);
  }
}
