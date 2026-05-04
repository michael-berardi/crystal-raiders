import { CrystalRaiders } from './game/CrystalRaiders';
import { createTestMap } from './assets/test-map';
import { TerrainRenderer } from './engine/TerrainRenderer';
import { GameRenderer } from './engine/GameRenderer';

const game = new CrystalRaiders();

async function init() {
  const container = document.getElementById('game-container');
  const fileInput = document.getElementById('game-files') as HTMLInputElement;
  
  if (!container) {
    console.error('Game container not found');
    return;
  }
  
  await game.initialize(container);
  
  // Add a "Load Test Map" button
  const controls = document.createElement('div');
  controls.style.cssText = 'position:absolute;top:20px;left:20px;z-index:100;display:flex;gap:10px;';
  
  const testBtn = document.createElement('button');
  testBtn.textContent = 'Load Test Map';
  testBtn.style.cssText = 'padding:10px 20px;background:#06b6d4;color:#0f172a;border:none;border-radius:8px;cursor:pointer;font-weight:bold;';
  testBtn.onclick = () => loadTestMap();
  controls.appendChild(testBtn);
  
  const fileLabel = document.createElement('label');
  fileLabel.textContent = 'Or select Rock Raiders Data folder:';
  fileLabel.style.cssText = 'color:#fff;padding:10px;';
  controls.appendChild(fileLabel);
  
  document.body.appendChild(controls);
  
  // Handle file selection
  fileInput?.addEventListener('change', async (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (!files || files.length === 0) return;
    
    await game.loadGameFiles(files);
    
    // Try to load a default level
    const levelNames = ['tuto', 'level01', 'level02', 'level1', 'level2'];
    
    for (const levelName of levelNames) {
      const success = await game.loadLevel(levelName);
      if (success) {
        game.start();
        controls.style.display = 'none';
        break;
      }
    }
  });
  
  async function loadTestMap() {
    // Create a test map directly
    const testMap = createTestMap(40, 40);
    
    // Access the renderer internals to create terrain
    // This is a bit hacky for the test mode
    const renderer = (game as any).renderer as GameRenderer;
    const terrainRenderer = new TerrainRenderer();
    const terrainMesh = terrainRenderer.createTerrain(testMap, { blockSize: 40, roughLevel: 8 });
    renderer.scene.add(terrainMesh);
    
    // Center camera on terrain
    renderer.camera.position.set(400, 600, 400);
    renderer.camera.lookAt(0, 0, 0);
    
    game.start();
    controls.style.display = 'none';
    
    console.log('Test map loaded');
  }
  
  console.log('Crystal Raiders ready. Click "Load Test Map" or select game files.');
}

init().catch(console.error);
