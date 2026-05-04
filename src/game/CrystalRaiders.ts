import { AssetManager } from '../assets/AssetManager';
import { GameRenderer } from '../engine/GameRenderer';
import { TerrainRenderer } from '../engine/TerrainRenderer';
import { BlockPicker } from '../engine/BlockPicker';
import { WallRenderer } from '../engine/WallRenderer';
import { LevelLoader, LevelData } from '../engine/LevelLoader';
import { GameState, GameStateImpl, SurfaceType, Unit } from './GameState';
import { UnitController } from './UnitController';
import { TaskManager } from './TaskManager';
import { UnitAI } from './UnitAI';
import { BuildingSystem, BuildingType } from './BuildingSystem';
import { HazardSystem } from './HazardSystem';
import { SoundSystem } from './SoundSystem';
import { createTestMap } from '../assets/test-map';
import { LEVELS, createLevelMap, LevelConfig } from '../assets/levels';
import { MAPFile } from '../assets/map';
import * as THREE from 'three';

export class CrystalRaiders {
  private assets: AssetManager;
  private renderer: GameRenderer | null = null;
  private terrainRenderer: TerrainRenderer | null = null;
  private wallRenderer: WallRenderer | null = null;
  private blockPicker: BlockPicker | null = null;
  private levelLoader: LevelLoader;
  private gameState: GameState;
  private taskManager: TaskManager;
  private unitController: UnitController | null = null;
  private unitAI: UnitAI | null = null;
  private buildingSystem: BuildingSystem | null = null;
  private hazardSystem: HazardSystem | null = null;
  private soundSystem: SoundSystem | null = null;
  private currentLevel: LevelData | null = null;
  private isRunning = false;
  private animationFrameId = 0;
  private lastTime = 0;
  private terrainMesh: THREE.Mesh | null = null;
  private wallMesh: THREE.Mesh | null = null;
  
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };
  private dragEnd = { x: 0, y: 0 };
  private selectionBox: HTMLDivElement | null = null;
  private currentTool: 'select' | 'drill' | 'path' | 'build' = 'select';
  private autoAIEnabled = true;
  private buildingTypeToPlace: BuildingType = BuildingType.TOOL_STORE;
  
  constructor() {
    this.assets = new AssetManager();
    this.levelLoader = new LevelLoader(this.assets);
    this.gameState = new GameStateImpl();
    this.taskManager = new TaskManager();
  }
  
  async initialize(container: HTMLElement): Promise<void> {
    this.renderer = new GameRenderer(container);
    this.terrainRenderer = new TerrainRenderer();
    this.wallRenderer = new WallRenderer();
    this.blockPicker = new BlockPicker(this.renderer.scene, this.renderer.camera);
    this.unitController = new UnitController(this.gameState, this.taskManager, this.renderer.scene);
    
    this.unitController.setResourceCallback((type, amount) => {
      if (type === 'ore') {
        this.gameState.resources.ore += amount;
      } else if (type === 'crystal') {
        this.gameState.resources.crystals += amount;
      }
    });
    
    this.unitAI = new UnitAI(this.gameState, this.taskManager, this.unitController);
    this.buildingSystem = new BuildingSystem(this.gameState, this.renderer.scene);
    this.buildingSystem.setSpawnCallback((bx, by) => {
      this.unitController?.spawnUnit('raider', bx, by);
      this.gameState.resources.minifigures++;
      this.soundSystem?.play('select');
    });
    this.hazardSystem = new HazardSystem(this.gameState, this.renderer.scene);
    this.soundSystem = new SoundSystem();
    this.soundSystem.initialize();
    
    this.setupInputHandlers();
    this.createUI();
    this.createToolbar();
    this.createBuildingPanel();
    this.createRestartButton();
    
    console.log('Crystal Raiders engine initialized');
  }
  
  private setupInputHandlers(): void {
    if (!this.renderer || !this.blockPicker) return;
    
    const canvas = this.renderer.renderer.domElement;
    
    canvas.addEventListener('mousemove', (e) => {
      this.blockPicker!.updateMouse(e.clientX, e.clientY, canvas);
      if (this.terrainMesh) {
        const hit = this.blockPicker!.pick(this.terrainMesh);
        if (hit) {
          this.gameState.hoveredBlock = { bx: hit.bx, by: hit.by };
          this.blockPicker!.showHighlight(hit.bx, hit.by);
        } else {
          this.gameState.hoveredBlock = null;
          this.blockPicker!.hideHighlight();
        }
      }
      
      if (this.isDragging && this.selectionBox) {
        this.dragEnd = { x: e.clientX, y: e.clientY };
        this.updateSelectionBox();
      }
    });
    
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.isDragging = true;
        this.dragStart = { x: e.clientX, y: e.clientY };
        this.dragEnd = { x: e.clientX, y: e.clientY };
        this.createSelectionBox();
      }
    });
    
    canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0 && this.isDragging) {
        this.isDragging = false;
        
        const dx = Math.abs(e.clientX - this.dragStart.x);
        const dy = Math.abs(e.clientY - this.dragStart.y);
        
        if (dx < 5 && dy < 5) {
          this.handleClick(e);
        } else {
          this.selectUnitsInArea();
        }
        
        this.removeSelectionBox();
      }
    });
    
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }
  
  private handleClick(e: MouseEvent): void {
    if (!this.terrainMesh || !this.blockPicker || !this.renderer) return;
    
    // Update mouse position for this click
    const canvas = this.renderer.renderer.domElement;
    this.blockPicker.updateMouse(e.clientX, e.clientY, canvas);
    
    // First, try to pick a unit mesh
    const clickedUnit = this.pickUnitMesh();
    const selectedUnits = this.gameState.getSelectedUnits();
    
    if (this.currentTool === 'select') {
      if (clickedUnit) {
        this.gameState.selectUnit(clickedUnit.id);
        this.soundSystem?.play('select');
        return;
      }
      
      // If no unit clicked but units selected, move them to terrain
      const hit = this.blockPicker.pick(this.terrainMesh);
      if (hit && selectedUnits.length > 0) {
        const unitIds = selectedUnits.map(u => u.id);
        this.unitController?.commandMove(unitIds, hit.bx, hit.by);
        this.soundSystem?.play('select');
      }
    } else if (this.currentTool === 'drill') {
      const hit = this.blockPicker.pick(this.terrainMesh);
      if (!hit) return;
      const block = this.gameState.blocks[hit.by]?.[hit.bx];
      if (block && (block.surfaceType >= 1 && block.surfaceType <= 5)) {
        if (selectedUnits.length > 0) {
          const unitIds = selectedUnits.map(u => u.id);
          this.unitController?.commandDrill(unitIds, hit.bx, hit.by);
          this.soundSystem?.play('drill');
        }
      }
    } else if (this.currentTool === 'path') {
      const hit = this.blockPicker.pick(this.terrainMesh);
      if (!hit) return;
      const block = this.gameState.blocks[hit.by]?.[hit.bx];
      if (block && block.surfaceType === SurfaceType.Floor) {
        block.texture = 0x60;
        this.gameState.terrainDirty = true;
        this.soundSystem?.play('build');
      }
    } else if (this.currentTool === 'build') {
      const hit = this.blockPicker.pick(this.terrainMesh);
      if (!hit) return;
      const block = this.gameState.blocks[hit.by]?.[hit.bx];
      if (block && block.surfaceType === SurfaceType.Floor) {
        const result = this.buildingSystem?.placeBuilding(hit.bx, hit.by, this.buildingTypeToPlace);
        if (result) {
          this.soundSystem?.play('build');
          this.gameState.terrainDirty = true;
        }
      }
    }
  }
  
  private pickUnitMesh(): Unit | null {
    if (!this.renderer || !this.blockPicker) return null;
    
    // First try exact mesh raycast
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(this.blockPicker.getMousePosition(), this.renderer.camera);
    
    const unitMeshes: THREE.Mesh[] = [];
    for (const unit of this.gameState.units) {
      const mesh = this.unitController?.getUnitMesh(unit.id);
      if (mesh) {
        mesh.traverse(child => {
          if ((child as THREE.Mesh).isMesh) {
            (child as THREE.Mesh).userData.unitId = unit.id;
            unitMeshes.push(child as THREE.Mesh);
          }
        });
      }
    }
    
    if (unitMeshes.length > 0) {
      const intersects = raycaster.intersectObjects(unitMeshes, false);
      if (intersects.length > 0) {
        const unitId = intersects[0].object.userData.unitId;
        return this.gameState.units.find(u => u.id === unitId) || null;
      }
    }
    
    // Fallback: check if click is near any unit's screen position
    const mouse = this.blockPicker.getMousePosition();
    for (const unit of this.gameState.units) {
      const mesh = this.unitController?.getUnitMesh(unit.id);
      if (!mesh) continue;
      
      const vec = new THREE.Vector3();
      vec.copy(mesh.position);
      vec.project(this.renderer.camera);
      
      const screenX = (vec.x * 0.5 + 0.5) * this.renderer.renderer.domElement.width;
      const screenY = (-vec.y * 0.5 + 0.5) * this.renderer.renderer.domElement.height;
      
      const dx = screenX - ((mouse.x + 1) * 0.5 * this.renderer.renderer.domElement.width);
      const dy = screenY - ((-mouse.y + 1) * 0.5 * this.renderer.renderer.domElement.height);
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 40) { // 40 pixel radius
        return unit;
      }
    }
    
    return null;
  }
  
  private createSelectionBox(): void {
    this.selectionBox = document.createElement('div');
    this.selectionBox.style.cssText = `
      position: fixed;
      border: 2px solid #00FF00;
      background: rgba(0, 255, 0, 0.1);
      pointer-events: none;
      z-index: 100;
    `;
    document.body.appendChild(this.selectionBox);
  }
  
  private updateSelectionBox(): void {
    if (!this.selectionBox) return;
    const left = Math.min(this.dragStart.x, this.dragEnd.x);
    const top = Math.min(this.dragStart.y, this.dragEnd.y);
    const width = Math.abs(this.dragEnd.x - this.dragStart.x);
    const height = Math.abs(this.dragEnd.y - this.dragStart.y);
    this.selectionBox.style.left = `${left}px`;
    this.selectionBox.style.top = `${top}px`;
    this.selectionBox.style.width = `${width}px`;
    this.selectionBox.style.height = `${height}px`;
  }
  
  private removeSelectionBox(): void {
    if (this.selectionBox) {
      document.body.removeChild(this.selectionBox);
      this.selectionBox = null;
    }
  }
  
  private selectUnitsInArea(): void {
    // TODO: Proper frustum selection
  }
  
  private createToolbar(): void {
    const toolbar = document.createElement('div');
    toolbar.id = 'game-toolbar';
    toolbar.style.cssText = `
      position: absolute;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 10px;
      background: rgba(0,0,0,0.8);
      padding: 10px;
      border-radius: 8px;
      z-index: 60;
      pointer-events: auto;
    `;
    
    const tools = [
      { id: 'select', icon: '👆', label: 'Select' },
      { id: 'drill', icon: '⛏️', label: 'Drill' },
      { id: 'path', icon: '🛤️', label: 'Power Path' },
      { id: 'build', icon: '🏗️', label: 'Build' }
    ];
    
    for (const tool of tools) {
      const btn = document.createElement('button');
      btn.style.cssText = `
        background: #333;
        color: white;
        border: 2px solid #555;
        border-radius: 4px;
        padding: 8px 16px;
        cursor: pointer;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 5px;
      `;
      btn.innerHTML = `${tool.icon} ${tool.label}`;
      btn.addEventListener('click', () => {
        this.currentTool = tool.id as 'select' | 'drill' | 'build';
        toolbar.querySelectorAll('button').forEach(b => {
          (b as HTMLElement).style.background = '#333';
          (b as HTMLElement).style.borderColor = '#555';
        });
        btn.style.background = '#06b6d4';
        btn.style.borderColor = '#06b6d4';
        
        // Show/hide building panel
        const panel = document.getElementById('building-panel');
        if (panel) {
          panel.style.display = tool.id === 'build' ? 'block' : 'none';
        }
      });
      if (tool.id === 'select') {
        btn.style.background = '#06b6d4';
        btn.style.borderColor = '#06b6d4';
      }
      toolbar.appendChild(btn);
    }
    
    // Auto-AI toggle
    const aiBtn = document.createElement('button');
    aiBtn.style.cssText = `
      background: #06b6d4;
      color: white;
      border: 2px solid #06b6d4;
      border-radius: 4px;
      padding: 8px 16px;
      cursor: pointer;
      font-size: 14px;
    `;
    aiBtn.textContent = '🤖 Auto AI: ON';
    aiBtn.addEventListener('click', () => {
      this.autoAIEnabled = !this.autoAIEnabled;
      aiBtn.textContent = this.autoAIEnabled ? '🤖 Auto AI: ON' : '🤖 Auto AI: OFF';
      aiBtn.style.background = this.autoAIEnabled ? '#06b6d4' : '#333';
      aiBtn.style.borderColor = this.autoAIEnabled ? '#06b6d4' : '#555';
    });
    toolbar.appendChild(aiBtn);
    
    document.body.appendChild(toolbar);
  }
  
  private createBuildingPanel(): void {
    const panel = document.createElement('div');
    panel.id = 'building-panel';
    panel.style.cssText = `
      position: absolute;
      top: 50%;
      right: 20px;
      transform: translateY(-50%);
      background: rgba(0,0,0,0.8);
      color: #fff;
      padding: 15px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      min-width: 180px;
      border: 1px solid #333;
      display: none;
      z-index: 60;
      pointer-events: auto;
    `;
    
    panel.innerHTML = `<div style="color:#06b6d4;font-weight:bold;margin-bottom:10px;">BUILDINGS</div>`;
    
    const buildings = [
      { type: BuildingType.TOOL_STORE, name: 'Tool Store', cost: 'Free' },
      { type: BuildingType.TELEPORT_PAD, name: 'Teleport Pad', cost: 'Free' },
      { type: BuildingType.POWER_STATION, name: 'Power Station', cost: '10 Ore, 1 Crystal' },
      { type: BuildingType.SUPPORT_STATION, name: 'Support Station', cost: '15 Ore, 2 Crystals' },
      { type: BuildingType.GEODOME, name: 'Geo-Dome', cost: '20 Ore, 3 Crystals' },
      { type: BuildingType.REFINERY, name: 'Refinery', cost: '15 Ore, 1 Crystal' },
      { type: BuildingType.SUPER_TELEPORT, name: 'Super Teleport', cost: '30 Ore, 5 Crystals' }
    ];
    
    for (const b of buildings) {
      const btn = document.createElement('button');
      btn.style.cssText = `
        display: block;
        width: 100%;
        background: #333;
        color: white;
        border: 1px solid #555;
        border-radius: 4px;
        padding: 8px;
        margin: 5px 0;
        cursor: pointer;
        font-size: 12px;
        text-align: left;
      `;
      btn.innerHTML = `<div style="font-weight:bold">${b.name}</div><div style="color:#888;font-size:10px">${b.cost}</div>`;
      btn.addEventListener('click', () => {
        this.buildingTypeToPlace = b.type;
        this.currentTool = 'build';
        // Show panel when build is selected
        const panel = document.getElementById('building-panel');
        if (panel) panel.style.display = 'block';
        // Update toolbar
        const toolbar = document.getElementById('game-toolbar');
        if (toolbar) {
          toolbar.querySelectorAll('button').forEach((btn, idx) => {
            if (idx < 3) {
              (btn as HTMLElement).style.background = '#333';
              (btn as HTMLElement).style.borderColor = '#555';
            }
          });
        }
      });
      panel.appendChild(btn);
    }
    
    document.body.appendChild(panel);
  }
  
  private createRestartButton(): void {
    const btn = document.createElement('button');
    btn.id = 'restart-btn';
    btn.style.cssText = `
      position: absolute;
      bottom: 20px;
      right: 20px;
      background: #FF4444;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 12px 24px;
      cursor: pointer;
      font-family: monospace;
      font-size: 14px;
      font-weight: bold;
      z-index: 70;
      display: none;
    `;
    btn.textContent = '🔄 Restart Mission';
    btn.addEventListener('click', () => {
      this.restart();
    });
    document.body.appendChild(btn);

    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.id = 'save-btn';
    saveBtn.style.cssText = `
      position: absolute;
      bottom: 20px;
      right: 180px;
      background: #06b6d4;
      color: #0f172a;
      border: none;
      border-radius: 8px;
      padding: 12px 24px;
      cursor: pointer;
      font-family: monospace;
      font-size: 14px;
      font-weight: bold;
      z-index: 70;
    `;
    saveBtn.textContent = '💾 Save';
    saveBtn.addEventListener('click', () => {
      this.saveGame();
    });
    document.body.appendChild(saveBtn);
  }

  saveGame(): void {
    const saveData = {
      blocks: this.gameState.blocks,
      units: this.gameState.units.map(u => ({
        id: u.id, type: u.type, x: u.x, y: u.y, z: u.z,
        health: u.health, maxHealth: u.maxHealth, selected: u.selected
      })),
      buildings: this.gameState.buildings,
      resources: this.gameState.resources,
      objectives: this.gameState.objectives,
      timestamp: Date.now()
    };
    localStorage.setItem('crystal_raiders_save', JSON.stringify(saveData));
    alert('Game saved!');
  }

  loadSave(): boolean {
    // TODO: Implement proper save loading with mesh recreation
    return false;
  }
  
  restart(): void {
    // Hide overlay
    const overlay = document.getElementById('game-state-overlay');
    if (overlay) overlay.style.display = 'none';
    
    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) restartBtn.style.display = 'none';
    
    // Clear units
    for (const unit of [...this.gameState.units]) {
      this.unitController?.removeUnit(unit.id);
    }
    
    // Clear buildings
    this.buildingSystem?.dispose();
    this.gameState.buildings = [];
    
    // Clear hazards
    this.hazardSystem?.dispose();
    
    // Reset resources
    this.gameState.resources = { ore: 0, crystals: 0, studs: 0, minifigures: 0 };
    
    // Reload map
    this.loadTestMap();
    
    // Play sound
    this.soundSystem?.play('select');
  }
  
  private createUI(): void {
    const ui = document.createElement('div');
    ui.id = 'game-ui';
    ui.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 50;
    `;
    
    const resources = document.createElement('div');
    resources.id = 'resources-panel';
    resources.style.cssText = `
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(0,0,0,0.8);
      color: #fff;
      padding: 15px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 14px;
      min-width: 180px;
      border: 1px solid #333;
    `;
    resources.innerHTML = `
      <div style="color:#06b6d4;font-weight:bold;margin-bottom:10px;font-size:16px;">RESOURCES</div>
      <div style="margin:5px 0;">⛏️ Ore: <span id="ore-count" style="color:#FF8800">0</span></div>
      <div style="margin:5px 0;">💎 Crystals: <span id="crystal-count" style="color:#00FF88">0</span>/<span id="crystal-goal">0</span></div>
      <div style="margin:5px 0;">👷 Minifigures: <span id="minifig-count">0</span></div>
    `;
    ui.appendChild(resources);
    
    const objectives = document.createElement('div');
    objectives.id = 'objectives-panel';
    objectives.style.cssText = `
      position: absolute;
      top: 20px;
      left: 20px;
      background: rgba(0,0,0,0.8);
      color: #fff;
      padding: 15px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      min-width: 200px;
      border: 1px solid #333;
    `;
    objectives.innerHTML = `
      <div style="color:#FFD700;font-weight:bold;margin-bottom:10px;font-size:14px;">OBJECTIVES</div>
      <div id="objectives-list"></div>
    `;
    ui.appendChild(objectives);
    
    const info = document.createElement('div');
    info.id = 'info-panel';
    info.style.cssText = `
      position: absolute;
      bottom: 20px;
      left: 20px;
      background: rgba(0,0,0,0.8);
      color: #fff;
      padding: 15px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      display: none;
      border: 1px solid #333;
    `;
    info.innerHTML = `
      <div style="color:#06b6d4;font-weight:bold;margin-bottom:5px;">BLOCK INFO</div>
      <div>Position: <span id="block-pos">-</span></div>
      <div>Height: <span id="block-height">-</span></div>
      <div>Type: <span id="block-type">-</span></div>
    `;
    ui.appendChild(info);
    
    const stateOverlay = document.createElement('div');
    stateOverlay.id = 'game-state-overlay';
    stateOverlay.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0,0,0,0.9);
      color: #fff;
      padding: 40px;
      border-radius: 12px;
      font-family: monospace;
      font-size: 24px;
      text-align: center;
      display: none;
      z-index: 200;
      border: 2px solid #06b6d4;
    `;
    ui.appendChild(stateOverlay);
    
    document.body.appendChild(ui);
  }
  
  updateUI(): void {
    const oreEl = document.getElementById('ore-count');
    const crystalEl = document.getElementById('crystal-count');
    const crystalGoalEl = document.getElementById('crystal-goal');
    const minifigEl = document.getElementById('minifig-count');
    
    if (oreEl) oreEl.textContent = String(this.gameState.resources.ore);
    if (crystalEl) crystalEl.textContent = String(this.gameState.resources.crystals);
    if (crystalGoalEl) crystalGoalEl.textContent = String(this.gameState.objectives.crystalsNeeded);
    if (minifigEl) minifigEl.textContent = String(this.gameState.resources.minifigures);
    
    const infoPanel = document.getElementById('info-panel');
    if (this.gameState.hoveredBlock && infoPanel) {
      infoPanel.style.display = 'block';
      const { bx, by } = this.gameState.hoveredBlock;
      const block = this.gameState.blocks[by]?.[bx];
      
      const posEl = document.getElementById('block-pos');
      const heightEl = document.getElementById('block-height');
      const typeEl = document.getElementById('block-type');
      
      if (posEl) posEl.textContent = `${bx}, ${by}`;
      if (heightEl) heightEl.textContent = block ? String(block.height) : '-';
      if (typeEl) typeEl.textContent = block ? this.getSurfaceTypeName(block.surfaceType) : '-';
    } else if (infoPanel) {
      infoPanel.style.display = 'none';
    }
    
    this.updateObjectives();
  }
  
  private getSurfaceTypeName(type: number): string {
    const names: Record<number, string> = {
      0: 'Floor',
      1: 'Soil Wall',
      2: 'Loose Rock',
      3: 'Medium Rock',
      4: 'Hard Rock',
      5: 'Immovable',
      0x20: 'Crystal Seam',
      0x40: 'Ore Seam'
    };
    return names[type] || `Unknown(${type})`;
  }
  
  private updateObjectives(): void {
    const list = document.getElementById('objectives-list');
    if (!list) return;
    
    const { crystalsNeeded, crystalsCollected, timeLimit, timeElapsed, completed } = this.gameState.objectives;
    
    let html = '';
    html += `<div style="margin:3px 0;">${crystalsCollected >= crystalsNeeded ? '✅' : '⬜'} Collect ${crystalsNeeded} crystals (${crystalsCollected}/${crystalsNeeded})</div>`;
    
    if (timeLimit > 0) {
      const timeLeft = Math.max(0, timeLimit - timeElapsed);
      const mins = Math.floor(timeLeft / 60);
      const secs = Math.floor(timeLeft % 60);
      html += `<div style="margin:3px 0;color:${timeLeft < 60 ? '#FF4444' : '#fff'}">⏱️ Time: ${mins}:${secs.toString().padStart(2, '0')}</div>`;
    }
    
    list.innerHTML = html;
    
    if (!completed) {
      if (crystalsCollected >= crystalsNeeded) {
        this.showGameState('MISSION COMPLETE!', '#00FF88');
        this.gameState.objectives.completed = true;
        this.soundSystem?.play('win');
        const restartBtn = document.getElementById('restart-btn');
        if (restartBtn) restartBtn.style.display = 'block';
      } else if (timeLimit > 0 && timeElapsed >= timeLimit) {
        this.showGameState('MISSION FAILED - Time Expired', '#FF4444');
        this.gameState.objectives.completed = true;
        this.soundSystem?.play('lose');
        const restartBtn = document.getElementById('restart-btn');
        if (restartBtn) restartBtn.style.display = 'block';
      }
    }
  }
  
  private showGameState(message: string, color: string): void {
    const overlay = document.getElementById('game-state-overlay');
    if (overlay) {
      overlay.textContent = message;
      overlay.style.color = color;
      overlay.style.display = 'block';
    }
  }
  
  loadTestMap(): void {
    this.loadLevelByConfig(LEVELS[0]);
  }

  loadLevelByConfig(config: LevelConfig): void {
    const map = createLevelMap(config);
    this.loadMapData(map, config);
  }

  loadLevelByIndex(index: number): void {
    if (index < 0 || index >= LEVELS.length) {
      console.error(`Invalid level index: ${index}`);
      return;
    }
    this.loadLevelByConfig(LEVELS[index]);
  }
  
  private loadMapData(map: MAPFile, config?: LevelConfig): void {
    if (!this.renderer) return;

    // Clear old meshes
    if (this.terrainMesh) {
      this.renderer.scene.remove(this.terrainMesh);
      this.terrainMesh = null;
    }
    if (this.wallMesh) {
      this.renderer.scene.remove(this.wallMesh);
      this.wallMesh = null;
    }

    // Clear old units and buildings
    for (const unit of [...this.gameState.units]) {
      this.unitController?.removeUnit(unit.id);
    }
    this.buildingSystem?.dispose();
    this.gameState.buildings = [];

    const width = map.dimensions.width;
    const height = map.dimensions.height;
    this.gameState.initializeBlocks(width, height);

    for (let by = 0; by < height; by++) {
      for (let bx = 0; bx < width; bx++) {
        this.gameState.setBlockHeight(bx, by, map.getBlockHeight(bx, by));
        this.gameState.setBlockTexture(bx, by, map.getBlockTexture(bx, by));

        const tex = map.getBlockTexture(bx, by);
        const block = this.gameState.blocks[by][bx];
        if ((tex & 0xF0) === 0x10 || (tex >= 1 && tex <= 5)) {
          block.surfaceType = tex as SurfaceType;
        } else if ((tex & 0xF0) === 0x20) {
          block.surfaceType = SurfaceType.CrystalSeam;
        } else if ((tex & 0xF0) === 0x40) {
          block.surfaceType = SurfaceType.OreSeam;
        } else if ((tex & 0xF0) === 0x70) {
          block.surfaceType = SurfaceType.Lava;
          block.texture = tex;
        } else {
          block.surfaceType = SurfaceType.Floor;
        }
      }
    }

    if (this.terrainRenderer) {
      this.terrainMesh = this.terrainRenderer.createTerrain(map, { blockSize: 40, roughLevel: 8 });
      this.renderer.scene.add(this.terrainMesh);
    }

    if (this.wallRenderer) {
      this.wallMesh = this.wallRenderer.createWalls(map, { blockSize: 40, roughLevel: 8 });
      if (this.wallMesh) {
        this.renderer.scene.add(this.wallMesh);
      }
    }

    this.unitController?.setBlocks(this.gameState.blocks);

    const levelConfig = config || LEVELS[0];
    this.spawnInitialUnits(levelConfig.startingUnits);
    this.placeStartingBuildings();

    this.gameState.objectives = {
      crystalsNeeded: levelConfig.crystalsNeeded,
      crystalsCollected: 0,
      timeLimit: levelConfig.timeLimit,
      timeElapsed: 0,
      completed: false
    };

    // Reset resources
    this.gameState.resources = { ore: 0, crystals: 0, studs: 0, minifigures: levelConfig.startingUnits };

    // Show tutorial
    this.showTutorial(levelConfig.name);

    console.log(`Level loaded: ${levelConfig.name} (${width}x${height})`);
  }

  private showTutorial(levelName: string): void {
    const overlay = document.createElement('div');
    overlay.id = 'tutorial-overlay';
    overlay.style.cssText = `
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0,0,0,0.9);
      color: #fff;
      padding: 30px;
      border-radius: 12px;
      border: 2px solid #06b6d4;
      font-family: monospace;
      font-size: 14px;
      max-width: 500px;
      z-index: 150;
      pointer-events: auto;
    `;

    const tutorials: Record<string, string> = {
      'Tutorial': `
        <h2 style="color:#06b6d4;margin-top:0">Tutorial</h2>
        <p><b>Goal:</b> Collect 5 energy crystals</p>
        <p><b>Controls:</b></p>
        <ul>
          <li>Click a unit to select it</li>
          <li>Click ground to move</li>
          <li>Select Drill tool, click wall to drill</li>
          <li>Crystal seams (green) give crystals</li>
          <li>Ore seams (orange) give ore</li>
        </ul>
        <p>Auto-AI is ON - units find tasks automatically!</p>
      `,
      'Driller Night!': `
        <h2 style="color:#06b6d4;margin-top:0">Driller Night!</h2>
        <p><b>Goal:</b> Collect 10 crystals</p>
        <p>Build a Support Station to heal your raiders!</p>
        <p>Use the Build tool to place buildings.</p>
      `,
      'Hot Stuff': `
        <h2 style="color:#06b6d4;margin-top:0">Hot Stuff</h2>
        <p><b>Goal:</b> Collect 15 crystals</p>
        <p><b>WARNING:</b> Lava will damage your raiders!</p>
        <p>Avoid the red lava zones.</p>
      `
    };

    overlay.innerHTML = (tutorials[levelName] || tutorials['Tutorial']) + `
      <button id="tutorial-close" style="
        margin-top: 15px;
        padding: 10px 30px;
        background: #06b6d4;
        color: #0f172a;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: bold;
        font-family: monospace;
      ">START MISSION</button>
    `;

    document.body.appendChild(overlay);

    const closeBtn = document.getElementById('tutorial-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        overlay.remove();
      });
    }

    // Auto-close after 10 seconds
    setTimeout(() => {
      overlay.remove();
    }, 10000);
  }
  
  private spawnInitialUnits(count?: number): void {
    const cx = Math.floor(this.gameState.blocks[0].length / 2);
    const cy = Math.floor(this.gameState.blocks.length / 2);
    const numUnits = count || 3;

    for (let i = 0; i < numUnits; i++) {
      const bx = cx + (i % 3) - 1;
      const by = cy + Math.floor(i / 3);
      this.unitController?.spawnUnit('raider', bx, by);
    }

    this.gameState.resources.minifigures = numUnits;
  }

  private placeStartingBuildings(): void {
    const cx = Math.floor(this.gameState.blocks[0].length / 2);
    const cy = Math.floor(this.gameState.blocks.length / 2);

    // Place Tool Store
    this.buildingSystem?.placeBuilding(cx - 2, cy - 2, BuildingType.TOOL_STORE);

    // Place Teleport Pad
    this.buildingSystem?.placeBuilding(cx + 2, cy - 2, BuildingType.TELEPORT_PAD);
  }
  
  private refreshTerrain(): void {
    // TODO: In-place geometry updates
  }
  
  async loadGameFiles(fileList: FileList): Promise<void> {
    console.log(`Loading ${fileList.length} files...`);
    
    const wadFiles: File[] = [];
    const looseFiles: File[] = [];
    
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (file.name.toLowerCase().endsWith('.wad')) {
        wadFiles.push(file);
      } else {
        looseFiles.push(file);
      }
    }
    
    for (const file of wadFiles) {
      try {
        const buffer = await file.arrayBuffer();
        await this.assets.loadWAD(buffer);
        console.log(`Loaded WAD: ${file.name}`);
      } catch (err) {
        console.error(`Failed to load WAD ${file.name}:`, err);
      }
    }
    
    for (const file of looseFiles) {
      try {
        const buffer = await file.arrayBuffer();
        this.assets.addLooseFile(file.name, buffer);
      } catch (err) {
        console.error(`Failed to load ${file.name}:`, err);
      }
    }
    
    console.log(`Loaded ${wadFiles.length} WADs and ${looseFiles.length} loose files`);
  }
  
  async loadLevel(levelName: string): Promise<boolean> {
    if (!this.renderer) {
      console.error('Engine not initialized');
      return false;
    }
    
    if (this.terrainRenderer) {
      this.terrainRenderer.dispose();
    }
    if (this.wallRenderer) {
      this.wallRenderer.dispose();
    }
    if (this.terrainMesh) {
      this.renderer.scene.remove(this.terrainMesh);
      this.terrainMesh = null;
    }
    if (this.wallMesh) {
      this.renderer.scene.remove(this.wallMesh);
      this.wallMesh = null;
    }
    
    const level = await this.levelLoader.loadLevel(levelName);
    if (!level) {
      console.error(`Failed to load level: ${levelName}`);
      return false;
    }
    
    this.currentLevel = level;
    this.loadMapData(level.terrainMAP);
    
    console.log(`Level loaded: ${levelName} (${level.terrainMAP.dimensions.width}x${level.terrainMAP.dimensions.height})`);
    return true;
  }
  
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.gameLoop();
  }
  
  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }
  
  private gameLoop = (): void => {
    if (!this.isRunning) return;
    
    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;
    
    this.update(deltaTime);
    this.updateUI();
    this.renderer?.render();
    
    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  };
  
  private update(deltaTime: number): void {
    this.unitController?.update(deltaTime);
    this.buildingSystem?.update(deltaTime);
    this.hazardSystem?.update(deltaTime);

    if (this.autoAIEnabled) {
      this.unitAI?.update(deltaTime);
    }
    
    if (!this.gameState.objectives.completed && this.gameState.objectives.timeLimit > 0) {
      this.gameState.objectives.timeElapsed += deltaTime;
    }
    
    this.gameState.objectives.crystalsCollected = this.gameState.resources.crystals;
    
    this.taskManager.clearCompletedTasks();

    // Update terrain meshes only when blocks changed
    if (this.gameState.terrainDirty) {
      this.terrainRenderer?.updateFromGameState(this.gameState);
      this.wallRenderer?.updateFromGameState(this.gameState);
      this.gameState.terrainDirty = false;
    }
  }
  
  dispose(): void {
    this.stop();
    this.blockPicker?.dispose();
    this.terrainRenderer?.dispose();
    this.renderer?.dispose();
  }
}
