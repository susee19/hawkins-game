
import React, { useState, useEffect, useRef } from 'react';

const GRID_SIZE = 5;
const START_HEALTH = 150;
const VECNA_START = 5;
const UPSIDE_DOWN_DMG = 15;

const generateGrid = () => {
  const blocks = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      blocks.push({ x, y });
    }
  }
  
  const possibleExits = blocks.filter(b => !(b.x === 0 && b.y === 4));
  const exitBlock = possibleExits[Math.floor(Math.random() * possibleExits.length)];

  const grid = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    const row = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      const isStart = x === 0 && y === 4;
      const isExit = x === exitBlock.x && y === exitBlock.y;
      
      row.push({
        id: `${x}-${y}`,
        x, y,
        isUnlocked: isStart,
        isExit,
        type: isStart ? 'real' : (Math.random() > 0.65 ? 'upside' : 'real'),
        req: Math.floor(Math.random() * 10) + 1
      });
    }
    grid.push(row);
  }
  return grid;
};

export default function App() {
  const [grid, setGrid] = useState(generateGrid);
  const [playerPos, setPlayerPos] = useState({ x: 0, y: 4 });
  const [playerHp, setPlayerHp] = useState(START_HEALTH);
  const [vecnaHp, setVecnaHp] = useState(VECNA_START);
  const [gameState, setGameState] = useState('idle'); 
  const [message, setMessage] = useState('Enter the Grid. Click adjacent blocks to roll.');
  const [pulse, setPulse] = useState(false);
  
  const audioCtxRef = useRef(null);

  const initAudio = () => {
    if (!audioCtxRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const playTick = () => {
    if (!audioCtxRef.current) return;
    try {
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(90, ctx.currentTime); 
      osc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch(e) { console.error("Audio block", e) }
  };


  useEffect(() => {
    let interval;
    if (gameState === 'playing') {
      interval = setInterval(() => {
        setVecnaHp(prev => prev + 1);
        setPulse(true);
        playTick();
        setTimeout(() => setPulse(false), 150);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameState]);

  const handleBlockClick = (x, y) => {
    if (gameState === 'won' || gameState === 'lost') return;
    initAudio();

  
    const isAdjacent = (Math.abs(x - playerPos.x) === 1 && y === playerPos.y) || 
                       (Math.abs(y - playerPos.y) === 1 && x === playerPos.x);
                       
    if (!isAdjacent) {
      if (x === playerPos.x && y === playerPos.y) {
         setMessage("You are already standing here.");
      } else {
         setMessage("You can only move to adjacent connecting blocks.");
      }
      return;
    }

    const clickedBlock = grid[y][x];


    if (clickedBlock.isUnlocked) {
      setPlayerPos({ x, y });
      setMessage("You moved to a previously explored zone.");
      if (gameState === 'idle') setGameState('playing');
      return;
    }

    if (gameState === 'idle') setGameState('playing');


    const roll = Math.floor(Math.random() * 10) + 1;
    
    if (roll >= clickedBlock.req) {
      let newHp = playerHp;
      let msg = `Rolled a ${roll} (needed ${clickedBlock.req}). Unlocked!`;
      
      if (clickedBlock.type === 'upside') {
        newHp -= UPSIDE_DOWN_DMG;
        msg += ` You stepped into the Upside Down. -${UPSIDE_DOWN_DMG} HP.`;
      } else {
        msg += ` It's the Real World. Safe.`;
      }
      
      const newGrid = [...grid];
      newGrid[y][x] = { ...clickedBlock, isUnlocked: true };
      setGrid(newGrid);
      setPlayerPos({ x, y });
      setPlayerHp(newHp);
      
      // End game validations
      if (clickedBlock.isExit) {
        if (newHp > vecnaHp) {
          setGameState('won');
        } else {
          setGameState('lost');
        }
      } else if (newHp <= 0) {
          setGameState('lost');
      }
      
      setMessage(msg);
      
    } else {
      setMessage(`Rolled a ${roll} (needed ${clickedBlock.req}). Move failed.`);
    }
  };

  const resetGame = () => {
    setGrid(generateGrid());
    setPlayerPos({ x: 0, y: 4 });
    setPlayerHp(START_HEALTH);
    setVecnaHp(VECNA_START);
    setGameState('idle');
    setMessage('Enter the Grid. Click adjacent blocks to roll.');
  };

  return (
    <div className="app-container">
      <h1 className="title">HELLFIRE CAMPAIGN</h1>
      
      <div className="hud">
        <div className="stat-box">
          <span>PLAYER HP</span>
          <div className="health">{playerHp}</div>
        </div>
        
        <div className="stat-box">
          <span>VECNA HP</span>
          <div className={`vecna ${pulse ? 'pulse' : ''}`}>{vecnaHp}</div>
        </div>
      </div>

      <div className="message-box">{message}</div>

      <div className="grid-board">
        {grid.map((row, y) => 
          row.map((block, x) => (
            <div 
              key={block.id} 
              className={`block ${block.isUnlocked ? 'unlocked' : 'hidden'} 
                         ${block.isUnlocked ? block.type : ''} 
                         ${block.isUnlocked && block.isExit ? 'exit' : ''}`}
              onClick={() => handleBlockClick(x, y)}
            >
              {!block.isUnlocked && <span className="req-number">{block.req}</span>}
              {playerPos.x === x && playerPos.y === y && <div className="player"></div>}
            </div>
          ))
        )}
      </div>

      {gameState !== 'idle' && gameState !== 'playing' && (
        <div className="modal-overlay">
          <div className={`modal ${gameState}`}>
            <h2>{gameState === 'won' ? 'GATE CLOSED' : 'HAWKINS FALLS'}</h2>
            <p>Your HP: {playerHp}</p>
            <p>Vecna's HP: {vecnaHp}</p>
            <button onClick={resetGame}>PLAY AGAIN</button>
          </div>
        </div>
      )}
    </div>
  );
}