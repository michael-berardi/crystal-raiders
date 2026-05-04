import { AssetManager } from '../assets/AssetManager';
import { GameRenderer } from '../engine/GameRenderer';
import { TerrainRenderer } from '../engine/TerrainRenderer';
import { BlockPicker } from '../engine/BlockPicker';
import { WallRenderer } from '../engine/WallRenderer';
import { LevelLoader, LevelData } from '../engine/LevelLoader';
import { GameState } from './GameState';
import * as THREE from 'three';

export class CrystalRaiders {
  private assets: AssetManager;
  private renderer: GameRenderer | null = null;
  private terrainRenderer: TerrainRenderer | null = null;
  private wallRenderer: WallRenderer | null = null;
  private blockPicker: BlockPicker | null = null;
  private levelLoader: LevelLoader;
  private gameState: GameState;
  private currentLevel: LevelData | null = null;
  private isRunning = false;
  private animationFrameId = 0;
  private terrainMesh: THREE.Mesh | null = null;
  private wallMesh: THREE.Mesh | null = null;
  
  constructor() {
    this.assets = new AssetManager();
    this.levelLoader = new LevelLoader(this.assets);
    this.gameState = new GameState();
  }
  
  async initialize(container: HTMLElement): Promise<void> {
    this.renderer = new GameRenderer(container);
    this.terrainRenderer = new TerrainRenderer();
    this.wallRenderer = new WallRenderer();
    this.blockPicker = new BlockPicker(this.renderer.scene, this.renderer.camera);
    
    this.setupInputHandlers();
    this.createUI();
    
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
    });
    
    canvas.addEventListener('click', (e) => {
      if (this.terrainMesh) {
        const hit = this.blockPicker!.pick(this.terrainMesh);
        if (hit) {
          console.log(`Clicked block: ${hit.bx}, ${hit.by}`);
          // TODO: Issue command to selected units
        }
      }
    });
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
    
    // Resource panel
    const resources = document.createElement('div');
    resources.id = 'resources-panel';
    resources.style.cssText = `
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(0,0,0,0.7);
      color: #fff;
      padding: 15px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 14px;
      min-width: 150px;
    `;
    resources.innerHTML = `
      <div style="color:#06b6d4;font-weight:bold;margin-bottom:10px;">RESOURCES</div>
      <div>Ore: <span id="ore-count">0</span></div>
      <div>Crystals: <span id="crystal-count">0</span></div>
      <div>Minifigures: <span id="minifig-count">0</span></div>
    `;
    ui.appendChild(resources);
    
    // Info panel
    const info = document.createElement('div');
    info.id = 'info-panel';
    info.style.cssText = `
      position: absolute;
      bottom: 20px;
      left: 20px;
      background: rgba(0,0,0,0.7);
      color: #fff;
      padding: 15px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      display: none;
    `;
    info.innerHTML = `
      <div style="color:#06b6d4;font-weight:bold;margin-bottom:5px;">BLOCK INFO</div>
      <div>Position: <span id="block-pos">-</span></div>
      <div>Height: <span id="block-height">-</span></div>
      <div>Type: <span id="block-type">-</span></div>
    `;
    ui.appendChild(info);
    
    document.body.appendChild(ui);
  }
  
  updateUI(): void {
    const oreEl = document.getElementById('ore-count');
    const crystalEl = document.getElementById('crystal-count');
    const minifigEl = document.getElementById('minifig-count');
    
    if (oreEl) oreEl.textContent = String(this.gameState.resources.ore);
    if (crystalEl) crystalEl.textContent = String(this.gameState.resources.crystals);
    if (minifigEl) minifigEl.textContent = String(this.gameState.resources.minifigures);
    
    // Update block info
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
      if (typeEl) typeEl.textContent = block ? String(block.surfaceType) : '-';
    } else if (infoPanel) {
      infoPanel.style.display = 'none';
    }
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
    
    // Initialize game state blocks
    this.gameState.initializeBlocks(
      level.terrainMAP.dimensions.width,
      level.terrainMAP.dimensions.height
    );
    
    // Copy terrain data to game state
    for (let by = 0; by < level.terrainMAP.dimensions.height; by++) {
      for (let bx = 0; bx < level.terrainMAP.dimensions.width; bx++) {
        this.gameState.setBlockHeight(bx, by, level.terrainMAP.getBlockHeight(bx, by));
        this.gameState.setBlockTexture(bx, by, level.terrainMAP.getBlockTexture(bx, by));
      }
    }
    
    if (this.terrainRenderer) {
      this.terrainMesh = this.terrainRenderer.createTerrain(level.terrainMAP, { 
        blockSize: level.blockSize, 
        roughLevel: 8 
      });
      this.renderer.scene.add(this.terrainMesh);
    }
    
    if (this.wallRenderer) {
      this.wallMesh = this.wallRenderer.createWalls(level.terrainMAP, {
        blockSize: level.blockSize,
        roughLevel: 8
      });
      if (this.wallMesh) {
        this.renderer.scene.add(this.wallMesh);
      }
    }
    
    console.log(`Level loaded: ${levelName} (${level.terrainMAP.dimensions.width}x${level.terrainMAP.dimensions.height})`);
    return true;
  }
  
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
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
    
    this.updateUI();
    this.renderer?.render();
    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  };
  
  dispose(): void {
    this.stop();
    this.blockPicker?.dispose();
    this.terrainRenderer?.dispose();
    this.renderer?.dispose();
  }
}
