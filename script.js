/**

 * Game Arena Core Orchestration Blueprint

 * Architecture: Polyministic Strategy Pattern

 */

(() => {

  'use strict';


  /* ============================================================

     STORAGE LAYER (UNIFIED SCHEMA PROFILE)

     ============================================================ */

  const Storage = (() => {

    const STORAGE_KEY = 'game_arena_pro_v2';

    const DEFAULT = {

      settings: {

        activeGame: 'sliding',

        sliding: { size: 3, mode: 'Number', difficulty: 'Medium' },

        tictactoe: { difficulty: 'Medium', sign: 'X' },

        colorglass: { tubes: 4, layers: 4 }

      },

      analytics: {

        sliding: { totalWins: 0, totalMoves: 0, bestTime: null },

        tictactoe: { wins: 0, losses: 0, draws: 0 },

        colorglass: { puzzlesSolved: 0, bestMoves: null }

      }

    };

    let data = load();


    function load() {

      try {

        const raw = localStorage.getItem(STORAGE_KEY);

        if (!raw) return structuredClone(DEFAULT);

        return deepMerge(structuredClone(DEFAULT), JSON.parse(raw));

      } catch (e) {

        return structuredClone(DEFAULT);

      }

    }

    function save() {

      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    }

    function deepMerge(target, src) {

      for (const k of Object.keys(src || {})) {

        if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k])) {

          target[k] = deepMerge(target[k] || {}, src[k]);

        } else if (src[k] !== undefined) target[k] = src[k];

      }

      return target;

    }

    return {

      get: () => data,

      save,

      reset() { data = structuredClone(DEFAULT); save(); }

    };

  })();


  /* ============================================================

     CENTRAL SOUND MODULE PIPELINE

     ============================================================ */

  const Sound = (() => {

    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    function beep(freq, type, duration) {

      try {

        const osc = ctx.createOscillator();

        const gain = ctx.createGain();

        osc.type = type;

        osc.frequency.value = freq;

        gain.gain.setValueAtTime(0.1, ctx.currentTime);

        gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duration);

        osc.connect(gain);

        gain.connect(ctx.destination);

        osc.start();

        osc.stop(ctx.currentTime + duration);

      } catch (e) {}

    }

    return {

      click: () => beep(580, 'sine', 0.08),

      move:  () => beep(420, 'triangle', 0.12),

      win:   () => { beep(523, 'sine', 0.15); setTimeout(() => beep(659, 'sine', 0.15), 100); setTimeout(() => beep(783, 'sine', 0.3), 200); },

      err:   () => beep(180, 'sawtooth', 0.25)

    };

  })();


  /* ============================================================

     SUB-ENGINE SYSTEM MODULES

     ============================================================ */


  /**

   * ENGINE 1: SLIDING PUZZLE

   */

  const SlidingPuzzleEngine = {

    state: { size: 3, board: [], blank: 0, moves: 0, startTime: 0, active: false },

    renderConfig(container) {

      const config = Storage.get().settings.sliding;

      container.innerHTML = `

        <div class="setting-row">

          <label>Matrix Dimension</label>

          <div class="picker">

            <button class="picker-arrow" data-cfg="size" data-v="-1">‹</button>

            <span class="picker-value" id="val-cfg-size">${config.size} × ${config.size}</span>

            <button class="picker-arrow" data-cfg="size" data-v="1">›</button>

          </div>

        </div>

      `;

      container.querySelectorAll('.picker-arrow').forEach(btn => {

        btn.addEventListener('click', () => {

          let sizes = [3, 4, 5];

          let idx = sizes.indexOf(config.size);

          idx = (idx + parseInt(btn.dataset.v) + sizes.length) % sizes.length;

          config.size = sizes[idx];

          Storage.save();

          document.getElementById('val-cfg-size').textContent = `${config.size} × ${config.size}`;

        });

      });

    },

    initialize() {

      const config = Storage.get().settings.sliding;

      this.state.size = config.size;

      this.state.moves = 0;

      this.state.startTime = Date.now();

      this.state.active = true;

      

      const total = this.state.size * this.state.size;

      this.state.board = Array.from({ length: total }, (_, i) => (i + 1) % total);

      this.shuffle();

    },

    shuffle() {

      let n = this.state.size * this.state.size;

      for (let i = n - 1; i > 0; i--) {

        const j = Math.floor(Math.random() * (i + 1));

        [this.state.board[i], this.state.board[j]] = [this.state.board[j], this.state.board[i]];

      }

      this.state.blank = this.state.board.indexOf(0);

    },

    renderRuntime(boardEl, updateHUD) {

      const n = this.state.size;

      boardEl.style.gridTemplateColumns = `repeat(${n}, 1fr)`;

      boardEl.innerHTML = '';

      

      const rect = boardEl.getBoundingClientRect();

      const pad = 12;

      const cell = (rect.width - pad * 2) / n;


      document.getElementById('label-hud-metric-a').textContent = 'Moves';

      document.getElementById('label-hud-metric-b').textContent = 'Time';


      for (let i = 0; i < this.state.board.length; i++) {

        const val = this.state.board[i];

        if (val === 0) continue;

        const t = document.createElement('div');

        t.className = 'tile';

        t.textContent = val;

        t.style.width = `${cell - 6}px`;

        t.style.height = `${cell - 6}px`;

        

        const r = Math.floor(i / n), c = i % n;

        t.style.left = `${pad + c * cell + 3}px`;

        t.style.top = `${pad + r * cell + 3}px`;

        t.style.fontSize = `${cell * 0.35}px`;


        t.addEventListener('click', () => this.handleMove(i, boardEl, updateHUD));

        boardEl.appendChild(t);

      }

      updateHUD(this.state.moves, this.getElapsedString());

    },

    handleMove(idx, boardEl, updateHUD) {

      if (!this.state.active) return;

      const n = this.state.size;

      const b = this.state.blank;

      const r = Math.floor(idx / n), c = idx % n;

      const br = Math.floor(b / n), bc = b % n;


      if (Math.abs(r - br) + Math.abs(c - bc) === 1) {

        this.state.board[b] = this.state.board[idx];

        this.state.board[idx] = 0;

        this.state.blank = idx;

        this.state.moves++;

        Sound.move();

        this.renderRuntime(boardEl, updateHUD);


        if (this.checkWin()) {

          this.state.active = false;

          Sound.win();

          AppCore.triggerWinEvaluation({

            'Matrix Setup': `${n}×${n}`,

            'Total Steps': this.state.moves,

            'Duration': this.getElapsedString()

          }, () => {

            Storage.get().analytics.sliding.totalWins++;

            Storage.get().analytics.sliding.totalMoves += this.state.moves;

            Storage.save();

          });

        }

      } else {

        Sound.err();

      }

    },

    checkWin() {

      const total = this.state.size * this.state.size;

      for (let i = 0; i < total - 1; i++) {

        if (this.state.board[i] !== i + 1) return false;

      }

      return true;

    },

    getElapsedString() {

      const s = Math.floor((Date.now() - this.state.startTime) / 1000);

      return `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;

    },

    renderControls(container, boardEl, updateHUD) {

      container.innerHTML = `

        <button class="btn btn-ghost ctrl-btn" id="btn-puzzle-shuffle">Shuffle</button>

      `;

      document.getElementById('btn-puzzle-shuffle').addEventListener('click', () => {

        Sound.click();

        this.shuffle();

        this.renderRuntime(boardEl, updateHUD);

      });

    },

    heartbeat(updateHUD) {

      if (this.state.active) updateHUD(this.state.moves, this.getElapsedString());

    }

  };


  /**

   * ENGINE 2: TIC-TAC-TOE AI VARIANT

   */

  const TicTacToeEngine = {

    state: { grid: [], playerTurn: true, active: false, matchResult: '' },

    renderConfig(container) {

      const config = Storage.get().settings.tictactoe;

      container.innerHTML = `

        <div class="setting-row">

          <label>AI Complexity</label>

          <div class="picker">

            <button class="picker-arrow" data-cfg="diff" data-v="-1">‹</button>

            <span class="picker-value" id="val-ttt-diff">${config.difficulty}</span>

            <button class="picker-arrow" data-cfg="diff" data-v="1">›</button>

          </div>

        </div>

      `;

      container.querySelectorAll('.picker-arrow').forEach(btn => {

        btn.addEventListener('click', () => {

          let diffs = ['Easy', 'Medium', 'Expert (Minimax)'];

          let idx = diffs.indexOf(config.difficulty);

          if (idx === -1) idx = 1;

          idx = (idx + parseInt(btn.dataset.v) + diffs.length) % diffs.length;

          config.difficulty = diffs[idx];

          Storage.save();

          document.getElementById('val-ttt-diff').textContent = config.difficulty;

        });

      });

    },

    initialize() {

      this.state.grid = Array(9).fill('');

      this.state.playerTurn = true;

      this.state.active = true;

      this.state.matchResult = '';

    },

    renderRuntime(boardEl, updateHUD) {

      boardEl.style.gridTemplateColumns = 'none';

      boardEl.innerHTML = '<div class="ttt-grid"></div>';

      const gridContainer = boardEl.querySelector('.ttt-grid');

      

      document.getElementById('label-hud-metric-a').textContent = 'Side';

      document.getElementById('label-hud-metric-b').textContent = 'Status';


      for (let i = 0; i < 9; i++) {

        const cell = document.createElement('div');

        cell.className = 'ttt-cell';

        if (this.state.grid[i] !== '') {

          cell.classList.add(this.state.grid[i] === 'X' ? 'taken-x' : 'taken-o');

          cell.textContent = this.state.grid[i];

        }

        cell.addEventListener('click', () => this.handleCellSelection(i, boardEl, updateHUD));

        gridContainer.appendChild(cell);

      }

      updateHUD("Player (X)", this.state.playerTurn ? "Your Turn" : "AI Computing");

    },

    handleCellSelection(idx, boardEl, updateHUD) {

      if (!this.state.active || !this.state.playerTurn || this.state.grid[idx] !== '') {

        Sound.err();

        return;

      }

      this.state.grid[idx] = 'X';

      Sound.move();

      this.state.playerTurn = false;

      this.renderRuntime(boardEl, updateHUD);


      if (this.evaluateGridStates(boardEl, updateHUD)) return;


      setTimeout(() => {

        this.executeAIComputeOperation();

        Sound.move();

        this.state.playerTurn = true;

        this.renderRuntime(boardEl, updateHUD);

        this.evaluateGridStates(boardEl, updateHUD);

      }, 400);

    },

    executeAIComputeOperation() {

      const cfg = Storage.get().settings.tictactoe;

      let empty = this.state.grid.map((v, i) => v === '' ? i : null).filter(v => v !== null);

      if (empty.length === 0) return;


      if (cfg.difficulty.startsWith('Expert')) {

        let bestMove = this.runMinimax(this.state.grid, 'O').index;

        this.state.grid[bestMove] = 'O';

      } else {

        // Fallback or randomized algorithm weights

        let rand = empty[Math.floor(Math.random() * empty.length)];

        this.state.grid[rand] = 'O';

      }

    },

    runMinimax(newGrid, player) {

      let availSpots = newGrid.map((v, i) => v === '' ? i : null).filter(v => v !== null);


      if (this.checkWinPattern(newGrid, 'X')) return { score: -10 };

      if (this.checkWinPattern(newGrid, 'O')) return { score: 10 };

      if (availSpots.length === 0) return { score: 0 };


      let moves = [];

      for (let i = 0; i < availSpots.length; i++) {

        let move = {};

        move.index = availSpots[i];

        newGrid[availSpots[i]] = player;


        if (player === 'O') {

          let result = this.runMinimax(newGrid, 'X');

          move.score = result.score;

        } else {

          let result = this.runMinimax(newGrid, 'O');

          move.score = result.score;

        }


        newGrid[availSpots[i]] = '';

        moves.push(move);

      }


      let bestMove;

      if (player === 'O') {

        let bestScore = -10000;

        for (let i = 0; i < moves.length; i++) {

          if (moves[i].score > bestScore) {

            bestScore = moves[i].score;

            bestMove = i;

          }

        }

      } else {

        let bestScore = 10000;

        for (let i = 0; i < moves.length; i++) {

          if (moves[i].score < bestScore) {

            bestScore = moves[i].score;

            bestMove = i;

          }

        }

      }

      return moves[bestMove];

    },

    checkWinPattern(g, p) {

      return (

        (g[0]===p && g[1]===p && g[2]===p) || (g[3]===p && g[4]===p && g[5]===p) ||

        (g[6]===p && g[7]===p && g[8]===p) || (g[0]===p && g[3]===p && g[6]===p) ||

        (g[1]===p && g[4]===p && g[7]===p) || (g[2]===p && g[5]===p && g[8]===p) ||

        (g[0]===p && g[4]===p && g[8]===p) || (g[2]===p && g[4]===p && g[6]===p)

      );

    },

    evaluateGridStates(boardEl, updateHUD) {

      let xWin = this.checkWinPattern(this.state.grid, 'X');

      let oWin = this.checkWinPattern(this.state.grid, 'O');

      let tie = !this.state.grid.includes('');


      if (xWin || oWin || tie) {

        this.state.active = false;

        let msg = tie ? "Stalemate Deadlock" : (xWin ? "Player Defeated AI" : "AI Mastered Matrix");

        if (xWin) Sound.win(); else Sound.err();


        AppCore.triggerWinEvaluation({

          'Resolution': msg,

          'Opponent Model': Storage.get().settings.tictactoe.difficulty,

          'Grid Condition': tie ? 'Symmetric Fill' : 'Vector Match'

        }, () => {

          let t = Storage.get().analytics.tictactoe;

          if (xWin) t.wins++; else if (oWin) t.losses++; else t.draws++;

          Storage.save();

        });

        return true;

      }

      return false;

    },

    renderControls(container, boardEl, updateHUD) {

      container.innerHTML = `<button class="btn btn-ghost ctrl-btn" id="btn-ttt-clear">Purge Table</button>`;

      document.getElementById('btn-ttt-clear').addEventListener('click', () => {

        this.initialize();

        this.renderRuntime(boardEl, updateHUD);

      });

    },

    heartbeat() {}

  };


  /**

   * ENGINE 3: COLOR GLASS LIQUID SORT ENGINE

   */

  const ColorGlassEngine = {

    state: { tubes: [], maxLayers: 4, selectedTube: null, moves: 0, active: false },

    colors: ['#c0392b', '#2ecc71', '#3498db', '#f1c40f'], // Red, Green, Blue, Yellow

    renderConfig(container) {

      container.innerHTML = `

        <div class="setting-row">

          <label>Vial Distribution</label>

          <div class="picker">

            <span class="picker-value">4 Static Vials</span>

          </div>

        </div>

      `;

    },

    initialize() {

      this.state.maxLayers = 4;

      this.state.moves = 0;

      this.state.selectedTube = null;

      this.state.active = true;


      // 3 tubes populated with random blocks, 1 structural dump safety tube left open

      this.state.tubes = [

        ['#c0392b', '#2ecc71', '#3498db', '#f1c40f'],

        ['#3498db', '#f1c40f', '#c0392b', '#2ecc71'],

        ['#2ecc71', '#c0392b', '#f1c40f', '#3498db'],

        []

      ];

      this.shuffleLiquids();

    },

    shuffleLiquids() {

      // Valid structural seed mix routine via flat array permutations

      let pool = [];

      this.state.tubes.forEach(t => t.forEach(c => pool.push(c)));

      for (let i = pool.length - 1; i > 0; i--) {

        const j = Math.floor(Math.random() * (i + 1));

        [pool[i], pool[j]] = [pool[j], pool[i]];

      }

      this.state.tubes = [[], [], [], []];

      for (let i = 0; i < pool.length; i++) {

        let tubeIdx = Math.floor(i / 4);

        this.state.tubes[tubeIdx].push(pool[i]);

      }

    },

    renderRuntime(boardEl, updateHUD) {

      boardEl.style.gridTemplateColumns = 'none';

      boardEl.innerHTML = '<div class="fluid-stage-layout"></div>';

      const stage = boardEl.querySelector('.fluid-stage-layout');


      document.getElementById('label-hud-metric-a').textContent = 'Transfers';

      document.getElementById('label-hud-metric-b').textContent = 'Purity';


      for (let i = 0; i < this.state.tubes.length; i++) {

        const glass = document.createElement('div');

        glass.className = 'glass-container';

        if (this.state.selectedTube === i) glass.classList.add('selected');


        const layers = this.state.tubes[i];

        for (let j = 0; j < layers.length; j++) {

          const fl = document.createElement('div');

          fl.className = 'fluid-layer';

          fl.style.backgroundColor = layers[j];

          glass.appendChild(fl);

        }


        glass.addEventListener('click', () => this.handleVialClick(i, boardEl, updateHUD));

        stage.appendChild(glass);

      }

      updateHUD(this.state.moves, `${this.calculateSystemPurity()}%`);

    },

    handleVialClick(idx, boardEl, updateHUD) {

      if (!this.state.active) return;

      

      if (this.state.selectedTube === null) {

        if (this.state.tubes[idx].length === 0) { Sound.err(); return; }

        this.state.selectedTube = idx;

        Sound.click();

        this.renderRuntime(boardEl, updateHUD);

      } else {

        const source = this.state.selectedTube;

        const target = idx;

        this.state.selectedTube = null;


        if (source === target) {

          this.renderRuntime(boardEl, updateHUD);

          return;

        }


        if (this.validatePourOperation(source, target)) {

          const color = this.state.tubes[source].pop();

          this.state.tubes[target].push(color);

          this.state.moves++;

          Sound.move();

          this.renderRuntime(boardEl, updateHUD);


          if (this.checkWinCondition()) {

            this.state.active = false;

            Sound.win();

            AppCore.triggerWinEvaluation({

              'Sorting Cycles': this.state.moves,

              'Fluid Elements': '4 Isolate Nodes',

              'System State': 'Entropy Restored'

            }, () => {

              Storage.get().analytics.colorglass.puzzlesSolved++;

              Storage.save();

            });

          }

        } else {

          Sound.err();

          this.renderRuntime(boardEl, updateHUD);

        }

      }

    },

    validatePourOperation(src, dst) {

      const srcTube = this.state.tubes[src];

      const dstTube = this.state.tubes[dst];


      if (srcTube.length === 0) return false;

      if (dstTube.length >= this.state.maxLayers) return false;

      if (dstTube.length === 0) return true;


      const srcColor = srcTube[srcTube.length - 1];

      const dstColor = dstTube[dstTube.length - 1];

      return srcColor === dstColor;

    },

    calculateSystemPurity() {

      let clean = 0;

      this.state.tubes.forEach(t => {

        if (t.length === 0) { clean += 4; return; }

        const matched = t.filter(c => c === t[0]).length;

        if (matched === t.length) clean += matched;

      });

      return Math.round((clean / 16) * 100);

    },

    checkWinCondition() {

      return this.state.tubes.every(t => {

        if (t.length === 0) return true;

        if (t.length !== this.state.maxLayers) return false;

        return t.every(c => c === t[0]);

      });

    },

    renderControls(container, boardEl, updateHUD) {

      container.innerHTML = `<button class="btn btn-ghost ctrl-btn" id="btn-fluid-reset">Reset Elements</button>`;

      document.getElementById('btn-fluid-reset').addEventListener('click', () => {

        this.initialize();

        this.renderRuntime(boardEl, updateHUD);

      });

    },

    heartbeat() {}

  };


  /* Mapping Runtime Engines dynamically across references */

  const ENGINE_ROUTER = {

    sliding: SlidingPuzzleEngine,

    tictactoe: TicTacToeEngine,

    colorglass: ColorGlassEngine

  };


  /* ============================================================

     APPLICATION CORE ORCHESTRATION PIPELINE

     ============================================================ */

  const AppCore = (() => {

    const $ = sel => document.querySelector(sel);

    let activeEngine = null;

    let heartbeatInterval = null;


    function switchActiveScreen(targetId) {

      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

      $(`#${targetId}`).classList.add('active');

    }


    function syncDashboardMetrics() {

      const d = Storage.get().analytics;

      $('#dashboard-body').innerHTML = `

        <div class="stat-card">

          <h3>Sliding Puzzle Registry</h3>

          <div class="stat-grid">

            <div><span>Wins Compiled</span><strong>${d.sliding.totalWins}</strong></div>

            <div><span>Vector Operations</span><strong>${d.sliding.totalMoves}</strong></div>

          </div>

        </div>

        <div class="stat-card">

          <h3>Matrix Tic-Tac-Toe</h3>

          <div class="stat-grid">

            <div><span>Victories</span><strong>${d.tictactoe.wins}</strong></div>

            <div><span>AI System Violations</span><strong>${d.tictactoe.losses}</strong></div>

            <div><span>Draw Locks</span><strong>${d.tictactoe.draws}</strong></div>

          </div>

        </div>

        <div class="stat-card">

          <h3>Fluid Segregation Core</h3>

          <div class="stat-grid">

            <div><span>Tables Sorted</span><strong>${d.colorglass.puzzlesSolved}</strong></div>

          </div>

        </div>

      `;

    }


    return {

      init() {

        /* Setup Hub Grid selections */

        document.querySelectorAll('.game-card').forEach(card => {

          card.addEventListener('click', () => {

            Sound.click();

            document.querySelectorAll('.game-card').forEach(c => c.classList.remove('active'));

            card.classList.add('active');

            

            const gId = card.dataset.gameId;

            Storage.get().settings.activeGame = gId;

            Storage.save();

            

            activeEngine = ENGINE_ROUTER[gId];

            activeEngine.renderConfig($('#dynamic-settings-pane'));

          });

        });


        /* Initialize defaults */

        const initialGameId = Storage.get().settings.activeGame;

        const matchingCard = $(`.game-card[data-game-id="${initialGameId}"]`);

        if (matchingCard) matchingCard.click();


        /* Primary Action CTA System Initialization Trigger */

        $('#btn-initialize-game').addEventListener('click', () => {

          Sound.click();

          activeEngine = ENGINE_ROUTER[Storage.get().settings.activeGame];

          activeEngine.initialize();

          

          switchActiveScreen('screen-game');

          

          const updateHUD = (valA, valB) => {

            $('#val-hud-metric-a').textContent = valA;

            $('#val-hud-metric-b').textContent = valB;

          };


          setTimeout(() => {

            activeEngine.renderRuntime($('#board'), updateHUD);

            activeEngine.renderControls($('#dynamic-game-controls'), $('#board'), updateHUD);

            

            clearInterval(heartbeatInterval);

            heartbeatInterval = setInterval(() => activeEngine.heartbeat(updateHUD), 1000);

          }, 100);

        });


        /* View State Navigation Handlers */

        $('#btn-abort-game').addEventListener('click', () => {

          Sound.click();

          clearInterval(heartbeatInterval);

          switchActiveScreen('screen-hub');

        });


        $('#btn-halt-runtime').addEventListener('click', () => {

          Sound.click();

          $('#pause-overlay').classList.remove('hidden');

        });


        $('#btn-resume-runtime').addEventListener('click', () => {

          Sound.click();

          $('#pause-overlay').classList.add('hidden');

        });


        $('#btn-kill-runtime').addEventListener('click', () => {

          Sound.click();

          $('#pause-overlay').classList.add('hidden');

          clearInterval(heartbeatInterval);

          switchActiveScreen('screen-hub');

        });


        /* Results Screen Router Logic */

        $('#btn-result-hub').addEventListener('click', () => {

          Sound.click();

          switchActiveScreen('screen-hub');

        });


        $('#btn-result-cycle').addEventListener('click', () => {

          $('#btn-initialize-game').click();

        });


        /* Drawer Overlay Management */

        $('#open-info').addEventListener('click', () => {

          Sound.click();

          $('#info-panel').classList.add('open');

          $('#panel-backdrop').classList.add('show');

        });


        $('#open-dashboard').addEventListener('click', () => {

          Sound.click();

          syncDashboardMetrics();

          $('#dashboard-panel').classList.add('open');

          $('#panel-backdrop').classList.add('show');

        });


        document.querySelectorAll('[data-close-panel]').forEach(btn => {

          btn.addEventListener('click', () => {

            Sound.click();

            $('.side-panel.open')?.classList.remove('open');

            $('#panel-backdrop').classList.remove('show');

          });

        });


        /* Direct data structure actions */

        $('#btn-reset-data').addEventListener('click', () => {

          Storage.reset();

          location.reload();

        });


        /* Fade-out Loader overlay execution gate */

        setTimeout(() => {

          $('#loading-screen').classList.add('hidden');

          $('#app').classList.remove('hidden');

        }, 500);

      },

      triggerWinEvaluation(metricsMap, analyticsCallback) {

        if (analyticsCallback) analyticsCallback();

        

        const grid = $('#result-metrics-grid');

        grid.innerHTML = '';

        for (const [key, val] of Object.entries(metricsMap)) {

          const block = document.createElement('div');

          block.innerHTML = `<span>${key}</span><strong>${val}</strong>`;

          grid.appendChild(block);

        }

        

        clearInterval(heartbeatInterval);

        switchActiveScreen('screen-result');

      }

    };

  })();


  document.addEventListener('DOMContentLoaded', AppCore.init);

})();


```
