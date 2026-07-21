
import React, { useState } from 'react';

export default function App() {
  const [gameState, setGameState] = useState('input'); // 'input' or 'result'
  const [scores, setScores] = useState({ human: 0, bot: 0 });
  const [userNumber, setUserNumber] = useState('');
  
  const [roundData, setRoundData] = useState({
    humanNum: 0,
    botNum: 0,
    average: 0,
    target: 0,
    winner: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    
    const humanInput = parseInt(userNumber, 10);
    if (isNaN(humanInput) || humanInput < 0 || humanInput > 100) return;

   
    const botInput = Math.floor(Math.random() * 101);


    const avg = (humanInput + botInput) / 2;
    const targetNum = Number((avg * 0.8).toFixed(2)); 


    const humanDiff = Math.abs(humanInput - targetNum);
    const botDiff = Math.abs(botInput - targetNum);

    let roundWinner = '';
    if (humanDiff < botDiff) {
      roundWinner = 'Human';
      setScores(prev => ({ ...prev, human: prev.human + 1 }));
    } else if (botDiff < humanDiff) {
      roundWinner = 'King of Diamonds';
      setScores(prev => ({ ...prev, bot: prev.bot + 1 }));
    } else {
      roundWinner = 'Draw'; 
    }

    setRoundData({
      humanNum: humanInput,
      botNum: botInput,
      average: avg,
      target: targetNum,
      winner: roundWinner
    });

    setGameState('result');
  };

  const nextRound = () => {
    setUserNumber('');
    setGameState('input');
  };

  return (
    <div className="app-container">
      <div className="card">
        <h1 className="title">Beauty Contest</h1>
        <div className="subtitle">King of Diamonds</div>

        <div className="score-board">
          <div className="score-box" style={{ alignItems: 'flex-start' }}>
            <span className="score-label">Human (You)</span>
            <span className="score-value">{scores.human}</span>
          </div>
          <div className="score-box" style={{ alignItems: 'flex-end' }}>
            <span className="score-label">The King</span>
            <span className="score-value">{scores.bot}</span>
          </div>
        </div>

        {gameState === 'input' ? (
          <form onSubmit={handleSubmit}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '10px' }}>
              Choose a whole number between 0 and 100.<br/>
              Target is 0.8 × the average of both numbers.
            </p>
            <div className="input-group">
              <input
                type="number"
                className="number-input"
                min="0"
                max="100"
                step="1"
                required
                autoFocus
                value={userNumber}
                onChange={(e) => setUserNumber(e.target.value)}
                placeholder="0"
              />
            </div>
            <button type="submit" className="btn">Lock In</button>
          </form>
        ) : (
          <div>
            <div className="winner-text">
              {roundData.winner === 'Human' && 'You survived the round.'}
              {roundData.winner === 'King of Diamonds' && 'The King claims victory.'}
              {roundData.winner === 'Draw' && 'A perfect equilibrium. Draw.'}
            </div>

            <div className="results-grid">
              <div className="stat-box">
                <div className="stat-label">Your Choice</div>
                <div className="stat-val">{roundData.humanNum}</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">King's Choice</div>
                <div className="stat-val">{roundData.botNum}</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Average</div>
                <div className="stat-val">{roundData.average}</div>
              </div>
              <div className="stat-box highlight">
                <div className="stat-label">Spider Number (Target)</div>
                <div className="stat-val">{roundData.target}</div>
              </div>
            </div>

            <button onClick={nextRound} className="btn">Next Round</button>
          </div>
        )}
      </div>
    </div>
  );
}