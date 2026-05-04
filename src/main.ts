import { CrystalRaiders } from './game/CrystalRaiders';
import { LEVELS } from './assets/levels';

const game = new CrystalRaiders();
Object.defineProperty(window, '__game', {
  value: game,
  writable: true,
  configurable: true
});

async function init() {
  const container = document.getElementById('game-container');

  if (!container) {
    console.error('Game container not found');
    return;
  }

  await game.initialize(container);

  const menu = document.createElement('div');
  menu.id = 'game-menu';
  menu.style.cssText = `
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.9);
    z-index: 100;
    gap: 20px;
  `;

  const title = document.createElement('h1');
  title.textContent = 'CRYSTAL RAIDERS';
  title.style.cssText = 'color: #06b6d4; font-family: monospace; font-size: 42px; margin: 0;';
  menu.appendChild(title);

  const subtitle = document.createElement('p');
  subtitle.textContent = 'STAGE SELECT';
  subtitle.style.cssText = 'color: #888; font-family: monospace; font-size: 18px; margin: 0 0 20px 0;';
  menu.appendChild(subtitle);

  for (let i = 0; i < LEVELS.length; i++) {
    const level = LEVELS[i];
    const btn = document.createElement('button');
    btn.style.cssText = `
      padding: 20px 40px;
      background: #1a1a2e;
      color: #fff;
      border: 2px solid #06b6d4;
      border-radius: 8px;
      cursor: pointer;
      font-family: monospace;
      font-size: 16px;
      min-width: 400px;
      text-align: left;
      transition: all 0.2s;
    `;
    btn.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size: 20px; font-weight: bold; color: #06b6d4;">${level.name}</span>
        <span style="font-size: 12px; color: #888;">${level.width}x${level.height}</span>
      </div>
      <div style="font-size: 12px; color: #888; margin-top: 8px;">${level.description}</div>
      <div style="font-size: 11px; color: #666; margin-top: 4px;">
        Goal: ${level.crystalsNeeded} crystals | Time: ${Math.floor(level.timeLimit / 60)}min | Units: ${level.startingUnits}
      </div>
    `;
    btn.onmouseenter = () => { btn.style.background = '#0f172a'; btn.style.borderColor = '#0ea5e9'; };
    btn.onmouseleave = () => { btn.style.background = '#1a1a2e'; btn.style.borderColor = '#06b6d4'; };
    btn.onclick = () => {
      game.loadLevelByIndex(i);
      game.start();
      menu.style.display = 'none';
    };
    menu.appendChild(btn);
  }

  document.body.appendChild(menu);

  console.log('Crystal Raiders ready.');
}

init().catch(console.error);
