export interface Point {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  type: 'plant' | 'zombie' | 'projectile' | 'particle';
  subType?: string;
  color: string;
}

export interface GameState {
  player: Entity;
  enemies: Entity[];
  projectiles: Entity[];
  particles: Entity[];
  score: number;
  wave: number;
  isPlaying: boolean;
  gameOver: boolean;
  health: number;
}

export enum GameActionType {
  MOVE_PLAYER,
  SPAWN_ENEMY,
  SHOOT,
  UPDATE,
  RESET,
  SET_PLAYING
}

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}
