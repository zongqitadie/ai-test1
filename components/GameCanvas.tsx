import React, { useRef, useEffect, useState } from 'react';
import { Entity, GameState, Point } from '../types';
import { analyzeBattlefield } from '../services/geminiService';

interface GameCanvasProps {
  handPos: Point | null;
  isPlaying: boolean;
  onGameOver: (score: number) => void;
  onLog: (msg: string) => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ handPos, isPlaying, onGameOver, onLog }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const gameStateRef = useRef<GameState>({
    player: { id: 'p1', x: 0, y: 0, width: 40, height: 40, vx: 0, vy: 0, hp: 100, maxHp: 100, type: 'plant', color: '#00ff9d' },
    enemies: [],
    projectiles: [],
    particles: [],
    score: 0,
    wave: 1,
    isPlaying: false,
    gameOver: false,
    health: 100
  });

  const lastShotTime = useRef<number>(0);
  const spawnTimer = useRef<number>(0);
  const [analyzing, setAnalyzing] = useState(false);

  // Initialize game state on start
  useEffect(() => {
    if (isPlaying && gameStateRef.current.gameOver) {
      // Reset
      gameStateRef.current = {
        player: gameStateRef.current.player,
        enemies: [],
        projectiles: [],
        particles: [],
        score: 0,
        wave: 1,
        isPlaying: true,
        gameOver: false,
        health: 100
      };
      onLog("SYSTEM: TACTICAL SIMULATION INITIALIZED.");
    }
    gameStateRef.current.isPlaying = isPlaying;
  }, [isPlaying, onLog]);

  // Update Player Position from Hand
  useEffect(() => {
    if (handPos && canvasRef.current) {
      const { width, height } = canvasRef.current;
      // Interpolate for smoothness
      const targetX = handPos.x * width;
      const targetY = handPos.y * height;
      
      const player = gameStateRef.current.player;
      player.x += (targetX - player.x) * 0.2;
      player.y += (targetY - player.y) * 0.2;
      
      // Clamp
      player.x = Math.max(20, Math.min(width - 20, player.x));
      player.y = Math.max(20, Math.min(height - 20, player.y));
    }
  }, [handPos]);

  // Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle resizing
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const spawnEnemy = () => {
      const y = Math.random() * (canvas.height - 50) + 25;
      const type = Math.random() > 0.8 ? 'tank' : 'drone';
      gameStateRef.current.enemies.push({
        id: Math.random().toString(),
        x: canvas.width + 50,
        y,
        width: type === 'tank' ? 50 : 30,
        height: type === 'tank' ? 50 : 30,
        vx: -(Math.random() * 2 + 1 + gameStateRef.current.wave * 0.2),
        vy: type === 'drone' ? Math.sin(Date.now() / 500) * 2 : 0,
        hp: type === 'tank' ? 3 : 1,
        maxHp: type === 'tank' ? 3 : 1,
        type: 'zombie',
        subType: type,
        color: type === 'tank' ? '#ff0055' : '#bf00ff'
      });
    };

    const update = (time: number) => {
      const state = gameStateRef.current;
      if (!state.isPlaying || state.gameOver) {
        draw(ctx, state);
        requestRef.current = requestAnimationFrame(update);
        return;
      }

      // Spawning
      spawnTimer.current++;
      if (spawnTimer.current > Math.max(30, 100 - state.wave * 5)) {
        spawnEnemy();
        spawnTimer.current = 0;
      }

      // Shooting (Auto-fire)
      if (time - lastShotTime.current > 200) {
         state.projectiles.push({
           id: Math.random().toString(),
           x: state.player.x + 20,
           y: state.player.y,
           width: 15,
           height: 4,
           vx: 15,
           vy: 0,
           hp: 1,
           maxHp: 1,
           type: 'projectile',
           color: '#00ffff'
         });
         lastShotTime.current = time;
      }

      // Move Projectiles
      state.projectiles.forEach(p => {
        p.x += p.vx;
      });
      state.projectiles = state.projectiles.filter(p => p.x < canvas.width);

      // Move Enemies
      state.enemies.forEach(e => {
        e.x += e.vx;
        if (e.subType === 'drone') {
          e.y += Math.sin(time / 200) * 1;
        }
      });

      // Collisions
      // Projectile vs Enemy
      state.projectiles.forEach(p => {
        state.enemies.forEach(e => {
          if (Math.abs(p.x - e.x) < (p.width + e.width)/2 && Math.abs(p.y - e.y) < (p.height + e.height)/2) {
             e.hp--;
             p.hp = 0; // Destroy projectile
             // Add particles
             for(let i=0; i<5; i++) {
               state.particles.push({
                 id: Math.random().toString(),
                 x: e.x, y: e.y, width: 2, height: 2,
                 vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10,
                 hp: 20, maxHp: 20, type: 'particle', color: e.color
               });
             }
          }
        });
      });

      // Cleanup dead entities
      state.projectiles = state.projectiles.filter(p => p.hp > 0);
      const deadEnemies = state.enemies.filter(e => e.hp <= 0);
      deadEnemies.forEach(() => state.score += 10);
      state.enemies = state.enemies.filter(e => e.hp > 0);

      // Enemy vs Player (Base Damage)
      state.enemies.forEach(e => {
        if (e.x < 0) {
          state.health -= 10;
          e.hp = 0; // Remove enemy
          onLog("ALERT: PERIMETER BREACHED");
        }
        // Direct collision
        if (Math.abs(e.x - state.player.x) < 30 && Math.abs(e.y - state.player.y) < 30) {
          state.health -= 5;
          e.hp = 0;
          // Shake effect could go here
        }
      });
      state.enemies = state.enemies.filter(e => e.hp > 0);

      // Particles
      state.particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.hp--;
      });
      state.particles = state.particles.filter(p => p.hp > 0);

      // Difficulty
      if (state.score > state.wave * 100) {
        state.wave++;
        onLog(`SYSTEM: WAVE ${state.wave} INCOMING`);
      }

      // Game Over
      if (state.health <= 0) {
        state.gameOver = true;
        state.isPlaying = false;
        onGameOver(state.score);
      }

      draw(ctx, state);
      requestRef.current = requestAnimationFrame(update);
    };

    const draw = (ctx: CanvasRenderingContext2D, state: GameState) => {
      // Clear
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'; // Trails
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Grid (Sci-fi floor)
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < canvas.width; i += 100) {
        ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height);
      }
      for (let i = 0; i < canvas.height; i += 100) {
        ctx.moveTo(0, i); ctx.lineTo(canvas.width, i);
      }
      ctx.stroke();

      // Draw Player
      ctx.save();
      ctx.translate(state.player.x, state.player.y);
      ctx.shadowBlur = 15;
      ctx.shadowColor = state.player.color;
      ctx.fillStyle = state.player.color;
      // Draw a "Plant" turret shape
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(25, 0); // Barrel
      ctx.stroke();
      // Ring
      ctx.strokeStyle = state.player.color;
      ctx.beginPath();
      ctx.arc(0, 0, 25, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Draw Enemies
      state.enemies.forEach(e => {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.shadowBlur = 10;
        ctx.shadowColor = e.color;
        ctx.fillStyle = e.color;
        if (e.subType === 'drone') {
          // Triangle
          ctx.beginPath();
          ctx.moveTo(-15, -15);
          ctx.lineTo(15, 0);
          ctx.lineTo(-15, 15);
          ctx.fill();
        } else {
          // Blocky Robot
          ctx.fillRect(-20, -20, 40, 40);
          // Eyes
          ctx.fillStyle = '#fff';
          ctx.fillRect(-10, -5, 5, 5);
          ctx.fillRect(-10, 5, 5, 5);
        }
        ctx.restore();
      });

      // Draw Projectiles
      state.projectiles.forEach(p => {
        ctx.save();
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        ctx.fillRect(p.x, p.y - 2, p.width, p.height);
        ctx.restore();
      });

       // Draw Particles
       state.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.hp / 20;
        ctx.fillRect(p.x, p.y, p.width, p.height);
        ctx.globalAlpha = 1;
      });

      // HUD
      // Health Bar
      ctx.fillStyle = '#333';
      ctx.fillRect(20, 20, 200, 20);
      ctx.fillStyle = state.health > 30 ? '#00ff9d' : '#ff0055';
      ctx.fillRect(20, 20, 2 * state.health, 20);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(20, 20, 200, 20);
      
      // Text
      ctx.font = '20px "Share Tech Mono"';
      ctx.fillStyle = '#00f0ff';
      ctx.fillText(`WAVE: ${state.wave}`, 240, 38);
      ctx.fillText(`SCORE: ${state.score}`, 350, 38);

      if (state.gameOver) {
         ctx.fillStyle = 'rgba(0,0,0,0.7)';
         ctx.fillRect(0, 0, canvas.width, canvas.height);
         ctx.fillStyle = '#ff0055';
         ctx.font = '60px Orbitron';
         ctx.textAlign = 'center';
         ctx.fillText("SYSTEM FAILURE", canvas.width/2, canvas.height/2);
         ctx.fillStyle = '#fff';
         ctx.font = '30px "Share Tech Mono"';
         ctx.fillText("Mission Failed", canvas.width/2, canvas.height/2 + 50);
      }
    };

    requestRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(requestRef.current);
  }, [onGameOver, onLog]);

  // Expose Scan Function
  useEffect(() => {
    const handleScan = async () => {
       if (!analyzing && isPlaying && !gameStateRef.current.gameOver && canvasRef.current) {
          setAnalyzing(true);
          onLog("SCANNING BATTLEFIELD...");
          const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.5);
          const report = await analyzeBattlefield(dataUrl);
          onLog(`AI: ${report}`);
          setAnalyzing(false);
       }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') handleScan();
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [analyzing, isPlaying, onLog]);

  return <canvas ref={canvasRef} className="block w-full h-full" />;
};

export default GameCanvas;
