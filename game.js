const GRAVITY = 0.2;
const FLAP_FORCE = -4.8;
const PIPE_SPEED = 1.5;
const PIPE_SPAWN_INTERVAL = 4000; 
const PIPE_GAP = 200; 
const MAX_VELOCITY = 7;

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.width = 320;
    this.canvas.height = 480;
    
    this.currentRating = 0;
    this.setupRatingSystem();
    this.setupSettingsSystem();
    this.setupGamepad();
    
    this.CLASSIC_MODE = {
      GRAVITY: 0.25,
      FLAP_FORCE: -4.6,
      PIPE_SPEED: 2.5,
      PIPE_SPAWN_INTERVAL: 1500,
      PIPE_GAP: 125,
      MAX_VELOCITY: 8
    };

    this.EASY_MODE = {
      GRAVITY: 0.2,
      FLAP_FORCE: -4.8,
      PIPE_SPEED: 1.5,
      PIPE_SPAWN_INTERVAL: 4000,
      PIPE_GAP: 200,
      MAX_VELOCITY: 7
    };

    this.CHALLENGE_MODE = {
      GRAVITY: this.CLASSIC_MODE.GRAVITY,
      FLAP_FORCE: this.CLASSIC_MODE.FLAP_FORCE,
      PIPE_SPEED: 0, // Will be randomly set
      PIPE_SPAWN_INTERVAL: this.CLASSIC_MODE.PIPE_SPAWN_INTERVAL,
      PIPE_GAP: 0, // Will be randomly set
      MAX_VELOCITY: this.CLASSIC_MODE.MAX_VELOCITY,
      TARGET_SCORE: 0
    };

    this.isClassicMode = false;
    this.isChallengeMode = false;
    this.currentConfig = this.isClassicMode ? this.CLASSIC_MODE : this.EASY_MODE;
    
    const savedSkin = localStorage.getItem('selectedBirdSkin');
    this.selectedSkin = savedSkin === 'yellow' ? savedSkin : 'yellow';
    
    this.birdSkins = {};
    
    this.init();
  }

  async init() {
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('get-ready').classList.add('hidden');
    document.getElementById('game-over').classList.add('hidden');
    
    await this.loadAssets();
    
    this.currentBird = this.birdSkins[this.selectedSkin];
    
    document.getElementById('loading-screen').classList.add('hidden');
    
    const hasLiked = await this.checkProjectLike();
    if (!hasLiked && this.selectedSkin !== 'yellow') {
      this.selectedSkin = 'yellow';
      localStorage.setItem('selectedBirdSkin', 'yellow');
    }
    
    document.getElementById('title-screen').classList.remove('hidden');
    
    this.setupEventListeners();
    this.reset();
    this.draw();
  }

  async loadAssets() {
    const totalAssets = 18; 
    let loadedAssets = 0;
    const progressBar = document.getElementById('loading-progress');

    const updateProgress = () => {
      loadedAssets++;
      const progress = (loadedAssets / totalAssets) * 100;
      progressBar.style.width = `${progress}%`;
    };

    const loadImage = src => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          updateProgress();
          resolve(img);
        };
        img.onerror = reject;
        img.src = src;
      });
    };

    const recolorImage = (img, color) => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      // Draw original image
      ctx.drawImage(img, 0, 0);
      
      // Apply color overlay
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Restore blend mode
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(img, 0, 0);
      
      const newImg = new Image();
      newImg.src = canvas.toDataURL();
      return newImg;
    };

    const loadAudio = src => {
      return new Promise((resolve, reject) => {
        const audio = new Audio(src);
        audio.oncanplaythrough = () => {
          updateProgress();
          resolve(audio);
        };
        audio.onerror = reject;
        audio.src = src;
      });
    };

    this.assets = {
      birds: {
        yellow: await loadImage('bird.png'),
        blue: await loadImage('bird_2.png'),
        red: await loadImage('bird_3.png'),
        brother: await loadImage('brother_bird.png')
      },
      pipeTop: await loadImage('pipe_top.png'),
      pipeBottom: await loadImage('pipe_bottom.png'),
      ground: await loadImage('ground.png'),
      bg1: await loadImage('bg_1.png'),
      bg2: await loadImage('bg_2.png'),
      medals: {
        bronze: await loadImage('medal_1.png'),
        silver: await loadImage('medal_2.png'),
        gold: await loadImage('medal_3.png'),
        platinum: await loadImage('medal_4.png')
      },
      sounds: {
        flap: await loadAudio('sfx_flap.mp3'),
        die: await loadAudio('sfx_die.mp3'),
        point: await loadAudio('sfx_point.mp3'),
        hit: await loadAudio('sfx_hit.wav') 
      }
    };

    const pipeTop = this.assets.pipeTop;
    const pipeBottom = this.assets.pipeBottom;
    
    this.assets.pipes = {
      green: {
        top: pipeTop,
        bottom: pipeBottom
      },
      blue: {
        top: recolorImage(pipeTop, '#0066ff'), 
        bottom: recolorImage(pipeBottom, '#0066ff')
      },
      purple: {
        top: recolorImage(pipeTop, '#9900ff'), 
        bottom: recolorImage(pipeBottom, '#9900ff')
      },
      yellow: {
        top: recolorImage(pipeTop, '#ffcc00'), 
        bottom: recolorImage(pipeBottom, '#ffcc00')
      },
      red: {
        top: recolorImage(pipeTop, '#ff3300'), 
        bottom: recolorImage(pipeBottom, '#ff3300')
      }
    };

    this.selectedPipeColor = localStorage.getItem('selectedPipeColor') || 'green';

    this.assets.sounds.flapPool = [
      this.assets.sounds.flap,
      new Audio('sfx_flap.mp3'),
      new Audio('sfx_flap.mp3')
    ];
    this.assets.sounds.pointPool = [
      this.assets.sounds.point,
      new Audio('sfx_point.mp3'),
      new Audio('sfx_point.mp3')
    ];
    this.flapIndex = 0;
    this.pointIndex = 0;
    
    this.birdSkins = {
      yellow: this.assets.birds.yellow,
      blue: this.assets.birds.blue,
      red: this.assets.birds.red,
      brother: this.assets.birds.brother
    };
  }

  async checkProjectLike() {
    try {
      const currentProject = await window.websim.getCurrentProject();
      const user = await window.websim.getUser();
      
      if (!user) return false;

      const response = await fetch(`/api/v1/project/${currentProject.id}/like`);
      const data = await response.json();
      return !!data.like;
    } catch (err) {
      console.error('Error checking project like:', err);
      return false;
    }
  }

  playSound(soundType) {
    if (!this.assets?.sounds) return;

    switch (soundType) {
      case 'flap':
        this.assets.sounds.flapPool[this.flapIndex].currentTime = 0;
        this.assets.sounds.flapPool[this.flapIndex].play();
        this.flapIndex = (this.flapIndex + 1) % this.assets.sounds.flapPool.length;
        break;
      case 'die':
        this.assets.sounds.die.currentTime = 0;
        this.assets.sounds.die.play();
        break;
      case 'point':
        this.assets.sounds.pointPool[this.pointIndex].currentTime = 0;
        this.assets.sounds.pointPool[this.pointIndex].play();
        this.pointIndex = (this.pointIndex + 1) % this.assets.sounds.pointPool.length;
        break;
      case 'hit':
        this.assets.sounds.hit.currentTime = 0;
        this.assets.sounds.hit.play();
        break;
    }
  }

  setupEventListeners() {
    document.getElementById('rate-btn').addEventListener('click', () => {
      document.getElementById('rating-modal').classList.remove('hidden');
      this.currentRating = 0;
      document.querySelectorAll('.star').forEach(star => {
        star.querySelector('.star-svg').classList.remove('active');
      });
    });

    document.getElementById('start-btn').addEventListener('click', () => {
      document.getElementById('title-screen').classList.add('hidden');
      document.getElementById('get-ready').classList.remove('hidden');
      this.reset();
      this.draw();
    });

    document.getElementById('replay-btn').addEventListener('click', () => {
      document.getElementById('game-over').classList.add('hidden');
      document.getElementById('get-ready').classList.remove('hidden');
      this.reset();
      this.draw();
    });

    document.getElementById('menu-btn').addEventListener('click', () => {
      document.getElementById('game-over').classList.add('hidden');
      document.getElementById('title-screen').classList.remove('hidden');
      this.reset();
      this.draw();
    });

    document.getElementById('get-ready').addEventListener('click', () => {
      this.startFromReady();
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        if (!this.gameStarted && !this.gameOver) {
          this.startFromReady();
        } else if (this.gameStarted) {
          this.flap();
        }
      }
    });

    this.canvas.addEventListener('click', () => {
      if (this.gameStarted) {
        this.flap();
      }
    });

    document.getElementById('share-btn').addEventListener('click', () => {
      this.shareScore();
    });

    const instructionsDiv = document.querySelector('.instructions');
    const controllerInstruction = document.createElement('div');
    controllerInstruction.className = 'instruction';
    controllerInstruction.innerHTML = `
      <div class="control-key">CONTROLLER</div>
      <div class="control-desc">Any button to make the bird fly</div>
    `;
    instructionsDiv.appendChild(controllerInstruction);
  }

  startFromReady() {
    document.getElementById('get-ready').classList.add('hidden');
    this.start();
  }

  reset() {
    if (this.isChallengeMode) {
      this.CHALLENGE_MODE.TARGET_SCORE = Math.floor(Math.random() * 21) + 10;
      // Random pipe gap between 110 and 180 pixels
      this.CHALLENGE_MODE.PIPE_GAP = Math.floor(Math.random() * 71) + 110;
      // Random pipe speed between 2.0 and 3.5
      this.CHALLENGE_MODE.PIPE_SPEED = 2.0 + (Math.random() * 1.5);
      this.currentConfig = this.CHALLENGE_MODE;
    } else {
      this.currentConfig = this.isClassicMode ? this.CLASSIC_MODE : this.EASY_MODE;
    }
    
    this.bird = {
      x: 60,
      y: this.canvas.height / 2,
      velocity: 0,
      width: 34,
      height: 24,
      rotation: 0 
    };

    this.pipes = [];
    this.groundPos = 0;
    this.bgPos = 0;
    this.score = 0;
    this.gameStarted = true;
    this.gameOver = false;
    this.showGameOverScreen = false;
    this.lastTimestamp = null;
    this.selectedBg = Math.random() < 0.5 ? this.assets.bg1 : this.assets.bg2;
    
    if(this.pipeInterval) {
      clearInterval(this.pipeInterval);
    }
  }

  start() {
    this.gameStarted = true;
    this.lastTimestamp = null;
    this.spawnPipe();
    requestAnimationFrame(ts => this.gameLoop(ts));
    this.pipeInterval = setInterval(() => this.spawnPipe(), this.currentConfig.PIPE_SPAWN_INTERVAL);
  }

  flap() {
    if (!this.gameOver) {
      if (this.bird.velocity > -2) {
        this.bird.velocity = this.currentConfig.FLAP_FORCE;
        this.playSound('flap');
      }
    }
  }

  spawnPipe() {
    const minHeight = 80;  
    const maxHeight = this.canvas.height - this.currentConfig.PIPE_GAP - minHeight - 100;
    const height = Math.random() * (maxHeight - minHeight) + minHeight;

    this.pipes.push({
      x: this.canvas.width,
      topHeight: height,
      passed: false
    });
  }

  checkCollision(pipe) {
    const hitboxPadding = 5;
    return (
      (this.bird.x + this.bird.width - hitboxPadding > pipe.x &&
       this.bird.x + hitboxPadding < pipe.x + 52 &&
       this.bird.y + hitboxPadding < pipe.topHeight) ||
      (this.bird.x + this.bird.width - hitboxPadding > pipe.x &&
       this.bird.x + hitboxPadding < pipe.x + 52 &&
       this.bird.y + this.bird.height - hitboxPadding > pipe.topHeight + this.currentConfig.PIPE_GAP)
    );
  }

  getMedalForScore(score) {
    if (score >= 40) return this.assets.medals.platinum;
    if (score >= 30) return this.assets.medals.gold;
    if (score >= 20) return this.assets.medals.silver;
    if (score >= 10) return this.assets.medals.bronze;
    return null;
  }

  triggerDeath(hitPipe = false) {
    if (!this.gameOver) {
      this.gameOver = true;
      this.bird.rotation = Math.PI / 2;
      if (hitPipe) {
        this.playSound('hit');
        setTimeout(() => this.playSound('die'), 500);
      } else {
        this.playSound('hit');
      }
      clearInterval(this.pipeInterval);
    }
  }

  update(dt = 1) {
    if (!this.gameStarted) return;

    this.bird.velocity += this.currentConfig.GRAVITY * dt;
    this.bird.velocity = Math.min(this.bird.velocity, this.currentConfig.MAX_VELOCITY);
    if (!this.gameOver && this.bird.velocity > 0) {
      this.bird.velocity *= Math.pow(0.99, dt);
    }
    this.bird.y += this.bird.velocity * dt;

    if (!this.gameOver) {
      this.pipes.forEach(pipe => {
        pipe.x -= this.currentConfig.PIPE_SPEED * dt;

        if (!pipe.passed && pipe.x + 52 < this.bird.x) {
          pipe.passed = true;
          this.score++;
          this.playSound('point');
        }

        if (this.checkCollision(pipe)) {
          this.triggerDeath(true); // Pass true to indicate pipe collision
        }
      });
      this.pipes = this.pipes.filter(pipe => pipe.x > -52);

      this.groundPos = (this.groundPos - this.currentConfig.PIPE_SPEED * dt) % 14;
      if (this.groundPos > 0) this.groundPos -= 14;
      this.bgPos = (this.bgPos - (this.currentConfig.PIPE_SPEED/2) * dt) % this.canvas.width;
      if (this.bgPos > 0) this.bgPos -= this.canvas.width;
    }

    if (!this.gameOver && this.isChallengeMode) {
      if (this.score >= this.CHALLENGE_MODE.TARGET_SCORE) {
        this.showChallengeComplete();
        this.triggerDeath(false); // Pass false since not hitting a pipe
      }
    }

    if (this.bird.y + this.bird.height >= this.canvas.height - 102) {
      if (!this.gameOver) {
        this.triggerDeath(false); // Pass false since hitting ground
      }
      this.bird.y = this.canvas.height - 102 - this.bird.height;
      if (this.gameOver && !this.showGameOverScreen) {
        this.showGameOverOverlay();
      }
    }
  }

  showGameOverOverlay() {
    const gameOverEl = document.getElementById('game-over');
    gameOverEl.classList.remove('hidden');

    const bestScore = localStorage.getItem('bestScore') || 0;
    if (this.score > bestScore) {
      localStorage.setItem('bestScore', this.score);
    }

    gameOverEl.querySelector('.score').textContent = this.score;
    gameOverEl.querySelector('.best').textContent = Math.max(bestScore, this.score);

    const medalImg = this.getMedalForScore(this.score);
    const medalElement = gameOverEl.querySelector('.medal');
    if (medalImg) {
      medalElement.style.backgroundImage = `url(${medalImg.src})`;
      medalElement.style.backgroundSize = 'contain';
      medalElement.style.backgroundRepeat = 'no-repeat';
      medalElement.style.backgroundPosition = 'center';
      medalElement.style.display = 'block';
    } else {
      medalElement.style.display = 'none';
    }

    this.showGameOverScreen = true;
  }

  showChallengeComplete() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="how-to-play-modal">
        <h2>Challenge Complete!</h2>
        <p>You reached the target score of ${this.CHALLENGE_MODE.TARGET_SCORE}!</p>
        <button class="close-btn">Close</button>
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('.close-btn').onclick = () => modal.remove();
  }

  draw() {
    if (!this.assets) return;
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = 0; i <= 1; i++) {
      this.ctx.drawImage(
        this.selectedBg,
        this.bgPos + i * this.canvas.width,
        0,
        this.canvas.width,
        this.canvas.height
      );
    }

    this.pipes.forEach(pipe => {
      this.ctx.drawImage(
        this.assets.pipes[this.selectedPipeColor].top,
        pipe.x,
        pipe.topHeight - 320,
        52,
        320
      );
      this.ctx.drawImage(
        this.assets.pipes[this.selectedPipeColor].bottom,
        pipe.x,
        pipe.topHeight + this.currentConfig.PIPE_GAP,
        52,
        320
      );
    });

    for (let i = 0; i < Math.ceil(this.canvas.width / 14) + 1; i++) {
      this.ctx.drawImage(
        this.assets.ground,
        Math.floor(this.groundPos) + i * 14,
        this.canvas.height - 100,
        14,
        100
      );
    }

    this.ctx.save();
    this.ctx.translate(
      this.bird.x + this.bird.width / 2,
      this.bird.y + this.bird.height / 2
    );
    if (this.gameOver) {
      this.ctx.rotate(this.bird.rotation);
    } else {
      this.ctx.rotate(Math.min(Math.max(this.bird.velocity * 0.1, -0.5), 0.5));
    }
    this.ctx.drawImage(
      this.currentBird,
      -this.bird.width / 2,
      -this.bird.height / 2,
      this.bird.width,
      this.bird.height
    );
    this.ctx.restore();

    if (this.gameStarted && !this.gameOver) {
      this.ctx.fillStyle = 'white';
      this.ctx.font = '30px FlappyBird';
      this.ctx.textAlign = 'center';
      
      this.ctx.strokeStyle = 'black';
      this.ctx.lineWidth = 3;
      this.ctx.strokeText(this.score, this.canvas.width / 2, 50);
      this.ctx.fillText(this.score, this.canvas.width / 2, 50);

      if (this.isChallengeMode) {
        this.ctx.font = '20px FlappyBird';
        const targetText = `Target: ${this.CHALLENGE_MODE.TARGET_SCORE}`;
        this.ctx.strokeText(targetText, this.canvas.width / 2, 80);
        this.ctx.fillText(targetText, this.canvas.width / 2, 80);
      }
    }
  }

  setupGamepad() {
    this.gamepadButtonPressed = false;
    
    window.addEventListener("gamepadconnected", (e) => {
      console.log("Gamepad connected:", e.gamepad);
    });
    
    window.addEventListener("gamepaddisconnected", (e) => {
      console.log("Gamepad disconnected:", e.gamepad);
    });
  }

  checkGamepadInput() {
    const gamepads = navigator.getGamepads();
    if (!gamepads) return;

    for (const gamepad of gamepads) {
      if (!gamepad) continue;

      const buttonsToCheck = [0, 1, 2, 3, 6, 7]; 
      const anyButtonPressed = buttonsToCheck.some(index => gamepad.buttons[index].pressed);

      if (gamepad.buttons[12]?.pressed) {
        anyButtonPressed = true;
      }

      if (anyButtonPressed && !this.gamepadButtonPressed) {
        this.gamepadButtonPressed = true;
        if (!this.gameStarted && !this.gameOver) {
          this.startFromReady();
        } else if (this.gameStarted) {
          this.flap();
        }
      } else if (!anyButtonPressed) {
        this.gamepadButtonPressed = false;
      }
    }
  }

  gameLoop(timestamp) {
    if (!this.lastTimestamp) {
      this.lastTimestamp = timestamp;
    }
    const dt = (timestamp - this.lastTimestamp) / (1000 / 60); 
    this.lastTimestamp = timestamp;
    
    this.checkGamepadInput();
    
    this.update(dt);
    this.draw();
    if (!this.showGameOverScreen) {
      requestAnimationFrame(ts => this.gameLoop(ts));
    }
  }

  async shareScore() {
    const gameLink = 'https://websim.ai/@BenjaminGamimg/flappybird/';
    const text = `I scored ${this.score} points in Flappy Bird! Can you beat my score? Play here: ${gameLink}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Flappy Bird Score',
          text: text,
          url: gameLink
        });
      } catch (err) {
        this.copyToClipboard(text);
      }
    } else {
      this.copyToClipboard(text);
    }
  }

  copyToClipboard(text) {
    const input = document.createElement('textarea');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    
    alert('Score copied to clipboard!');
  }

  setupRatingSystem() {
    const modal = document.getElementById('rating-modal');
    const stars = document.querySelectorAll('.star');
    const submitBtn = document.getElementById('submit-rating');
    const cancelBtn = document.getElementById('cancel-rating');

    document.getElementById('rate-btn').addEventListener('click', () => {
      modal.classList.remove('hidden');
      this.currentRating = 0;
      stars.forEach(star => {
        star.querySelector('.star-svg').classList.remove('active');
      });
    });

    stars.forEach(star => {
      star.addEventListener('click', (e) => {
        const rating = parseInt(star.dataset.rating);
        this.currentRating = rating;
        
        stars.forEach(s => {
          const starSvg = s.querySelector('.star-svg');
          if (parseInt(s.dataset.rating) <= rating) {
            starSvg.classList.add('active');
          } else {
            starSvg.classList.remove('active');
          }
        });
      });

      star.addEventListener('mouseover', (e) => {
        const rating = parseInt(star.dataset.rating);
        stars.forEach(s => {
          const starSvg = s.querySelector('.star-svg');
          if (parseInt(s.dataset.rating) <= rating) {
            starSvg.classList.add('active');
          } else {
            starSvg.classList.remove('active');
          }
        });
      });

      star.addEventListener('mouseout', (e) => {
        stars.forEach(s => {
          const starSvg = s.querySelector('.star-svg');
          if (parseInt(s.dataset.rating) <= this.currentRating) {
            starSvg.classList.add('active');
          } else {
            starSvg.classList.remove('active');
          }
        });
      });
    });

    submitBtn.addEventListener('click', () => {
      if (this.currentRating > 0) {
        this.submitRating(this.currentRating);
        modal.classList.add('hidden');
      } else {
        alert('Please select a rating before submitting!');
      }
    });

    cancelBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
  }

  submitRating(rating) {
    const ratings = JSON.parse(localStorage.getItem('flappyBirdRatings') || '[]');
    ratings.push(rating);
    localStorage.setItem('flappyBirdRatings', JSON.stringify(ratings));

    const average = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    
    alert(`Thank you for rating! The average rating is ${average.toFixed(1)} stars.`);

    console.log(`User submitted rating: ${rating} stars`);
  }

  setupSettingsSystem() {
    const settingsBtn = document.getElementById('settings-btn');
    const settingsMenu = document.getElementById('settings-menu');
    const settingsBackBtn = document.getElementById('settings-back-btn');
    
    settingsBtn.addEventListener('click', () => {
      document.getElementById('title-screen').classList.add('hidden');
      settingsMenu.classList.remove('hidden');
    });

    settingsBackBtn.addEventListener('click', () => {
      settingsMenu.classList.add('hidden');
      document.getElementById('title-screen').classList.remove('hidden');
    });

    const howToPlayBtn = document.getElementById('how-to-play-btn');
    const howToPlayModal = document.getElementById('how-to-play-modal');
    const howToPlayCloseBtn = document.getElementById('how-to-play-close-btn');

    howToPlayBtn.addEventListener('click', () => {
      howToPlayModal.classList.remove('hidden');
    });

    howToPlayCloseBtn.addEventListener('click', () => {
      howToPlayModal.classList.add('hidden');
    });

    howToPlayModal.addEventListener('click', (e) => {
      if (e.target === howToPlayModal) {
        howToPlayModal.classList.add('hidden');
      }
    });

    const creditsBtn = document.getElementById('credits-btn');
    const creditsModal = document.getElementById('credits-modal');
    const creditsCloseBtn = document.getElementById('credits-close-btn');

    creditsBtn.addEventListener('click', () => {
      creditsModal.classList.remove('hidden');
    });

    creditsCloseBtn.addEventListener('click', () => {
      creditsModal.classList.add('hidden');
    });

    creditsModal.addEventListener('click', (e) => {
      if (e.target === creditsModal) {
        creditsModal.classList.add('hidden');
      }
    });

    const changelogBtn = document.getElementById('changelog-btn');
    const changelogModal = document.getElementById('changelog-modal');
    const changelogCloseBtn = document.getElementById('changelog-close-btn');

    changelogBtn.addEventListener('click', () => {
      changelogModal.classList.remove('hidden');
    });

    changelogCloseBtn.addEventListener('click', () => {
      changelogModal.classList.add('hidden');
    });

    changelogModal.addEventListener('click', (e) => {
      if (e.target === changelogModal) {
        changelogModal.classList.add('hidden');
      }
    });

    const birdSkins = document.createElement('div');
    birdSkins.className = 'bird-skins';
    
    const skinTitle = document.createElement('h3');
    skinTitle.textContent = 'Bird Skin';
    birdSkins.appendChild(skinTitle);

    const skinOptions = document.createElement('div');
    skinOptions.className = 'skin-options';

    const skins = [
      { id: 'yellow', src: 'bird.png', locked: false },
      { id: 'blue', src: 'bird_2.png', locked: true },
      { id: 'red', src: 'bird_3.png', locked: true },
      { id: 'brother', src: 'brother_bird.png', locked: true }
    ];

    const updateSkinLockStatus = async () => {
      const hasLiked = await this.checkProjectLike();
      const options = document.querySelectorAll('.skin-option');
      
      options.forEach((option, index) => {
        if (index > 0) { 
          const lockIcon = option.querySelector('.lock-icon');
          if (hasLiked) {
            option.classList.remove('locked');
            if (lockIcon) lockIcon.remove();
          } else {
            option.classList.add('locked');
            if (!lockIcon) {
              const lock = document.createElement('div');
              lock.className = 'lock-icon';
              lock.innerHTML = '🔒';
              option.appendChild(lock);
            }
            if (this.selectedSkin === option.getAttribute('data-skin')) {
              this.selectedSkin = 'yellow';
              this.currentBird = this.birdSkins['yellow'];
              localStorage.setItem('selectedBirdSkin', 'yellow');
              document.querySelectorAll('.skin-option').forEach(opt => opt.classList.remove('selected'));
              document.querySelector('.skin-option[data-skin="yellow"]').classList.add('selected');
            }
          }
        }
      });
    };

    skins.forEach(skin => {
      const option = document.createElement('div');
      option.className = `skin-option ${this.selectedSkin === skin.id ? 'selected' : ''} ${skin.locked ? 'locked' : ''}`;
      option.setAttribute('data-skin', skin.id);
      
      const img = document.createElement('img');
      img.src = skin.src;
      img.alt = `${skin.id} bird`;
      
      option.appendChild(img);

      if (skin.locked) {
        const lock = document.createElement('div');
        lock.className = 'lock-icon';
        lock.innerHTML = '🔒';
        option.appendChild(lock);
      }

      skinOptions.appendChild(option);

      option.addEventListener('click', async () => {
        const hasLiked = await this.checkProjectLike();
        if (skin.locked && !hasLiked) {
          alert('Like the game to unlock additional bird skins!');
          return;
        }

        document.querySelectorAll('.skin-option').forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        this.selectedSkin = skin.id;
        this.currentBird = this.birdSkins[skin.id];
        localStorage.setItem('selectedBirdSkin', skin.id);
      });
    });

    birdSkins.appendChild(skinOptions);
    const suggestionText = document.createElement('p');
    suggestionText.style.color = 'white';
    suggestionText.style.fontFamily = 'FlappyBird, Arial, sans-serif';
    suggestionText.style.fontSize = '14px';
    suggestionText.style.textAlign = 'center';
    suggestionText.style.marginTop = '10px';
    suggestionText.style.textShadow = '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000';
    suggestionText.textContent = 'Comment what skins you want, and (maybe) I\'ll add them...';
    birdSkins.appendChild(suggestionText);

    settingsMenu.insertBefore(birdSkins, settingsBackBtn);

    updateSkinLockStatus();

    settingsBtn.addEventListener('click', () => {
      updateSkinLockStatus();
    });

    let skinCheckInterval;
    settingsBtn.addEventListener('click', () => {
      updateSkinLockStatus();
      skinCheckInterval = setInterval(updateSkinLockStatus, 2000); 
    });

    settingsBackBtn.addEventListener('click', () => {
      clearInterval(skinCheckInterval);
      settingsMenu.classList.add('hidden');
      document.getElementById('title-screen').classList.remove('hidden');
    });

    const difficultyToggle = document.createElement('div');
    difficultyToggle.className = 'difficulty-toggle';
    
    const label = document.createElement('span');
    label.className = 'difficulty-label';
    label.textContent = 'Classic Mode';

    const toggleSwitch = document.createElement('label');
    toggleSwitch.className = 'toggle-switch';
    
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = false; 
    
    const slider = document.createElement('span');
    slider.className = 'toggle-slider';

    toggleSwitch.appendChild(input);
    toggleSwitch.appendChild(slider);
    difficultyToggle.appendChild(label);
    difficultyToggle.appendChild(toggleSwitch);

    settingsMenu.insertBefore(difficultyToggle, birdSkins);

    const challengeToggle = document.createElement('div');
    challengeToggle.className = 'difficulty-toggle';
    
    const challengeLabel = document.createElement('span');
    challengeLabel.className = 'difficulty-label';
    challengeLabel.textContent = 'Challenge Mode';

    const challengeToggleSwitch = document.createElement('label');
    challengeToggleSwitch.className = 'toggle-switch';
    
    const challengeInput = document.createElement('input');
    challengeInput.type = 'checkbox';
    challengeInput.checked = false;
    
    const challengeSlider = document.createElement('span');
    challengeSlider.className = 'toggle-slider';

    challengeToggleSwitch.appendChild(challengeInput);
    challengeToggleSwitch.appendChild(challengeSlider);
    challengeToggle.appendChild(challengeLabel);
    challengeToggle.appendChild(challengeToggleSwitch);

    settingsMenu.insertBefore(challengeToggle, birdSkins);

    challengeInput.addEventListener('change', (e) => {
      if (e.target.checked) {
        input.checked = true; 
        this.isClassicMode = true;
        this.isChallengeMode = true;
      } else {
        this.isChallengeMode = false;
      }
      this.reset();
    });

    input.addEventListener('change', (e) => {
      if (!e.target.checked && challengeInput.checked) {
        challengeInput.checked = false; 
        this.isChallengeMode = false;
      }
      this.isClassicMode = e.target.checked;
      this.reset();
    });

    const pipeColors = document.createElement('div');
    pipeColors.className = 'pipe-colors';
    
    const pipeTitle = document.createElement('h3');
    pipeTitle.textContent = 'Pipe Color';
    pipeColors.appendChild(pipeTitle);

    const colorOptions = document.createElement('div');
    colorOptions.className = 'color-options';

    const colors = [
      { id: 'green', name: 'Green', locked: false },
      { id: 'blue', name: 'Blue', locked: true },
      { id: 'purple', name: 'Purple', locked: true },
      { id: 'yellow', name: 'Yellow', locked: true },
      { id: 'red', name: 'Red', locked: true }
    ];

    const updateColorLockStatus = async () => {
      const hasLiked = await this.checkProjectLike();
      const options = document.querySelectorAll('.color-option');
      
      options.forEach((option, index) => {
        if (index > 0) { 
          const lockIcon = option.querySelector('.lock-icon');
          if (hasLiked) {
            option.classList.remove('locked');
            if (lockIcon) lockIcon.remove();
          } else {
            option.classList.add('locked');
            if (!lockIcon) {
              const lock = document.createElement('div');
              lock.className = 'lock-icon';
              lock.innerHTML = '🔒';
              option.appendChild(lock);
            }
            if (this.selectedPipeColor === option.getAttribute('data-color')) {
              this.selectedPipeColor = 'green';
              localStorage.setItem('selectedPipeColor', 'green');
              document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
              document.querySelector('.color-option[data-color="green"]').classList.add('selected');
            }
          }
        }
      });
    };

    colors.forEach(color => {
      const option = document.createElement('div');
      option.className = `color-option ${this.selectedPipeColor === color.id ? 'selected' : ''} ${color.locked ? 'locked' : ''}`;
      option.setAttribute('data-color', color.id);
      option.style.backgroundColor = color.id;
      
      if (color.locked) {
        const lock = document.createElement('div');
        lock.className = 'lock-icon';
        lock.innerHTML = '🔒';
        option.appendChild(lock);
      }

      colorOptions.appendChild(option);

      option.addEventListener('click', async () => {
        const hasLiked = await this.checkProjectLike();
        if (color.locked && !hasLiked) {
          alert('Like the game to unlock additional pipe colors!');
          return;
        }

        document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        this.selectedPipeColor = color.id;
        localStorage.setItem('selectedPipeColor', color.id);
      });
    });

    pipeColors.appendChild(colorOptions);
    settingsMenu.insertBefore(pipeColors, settingsBackBtn);

    updateColorLockStatus();
    setInterval(updateColorLockStatus, 2000);
  }

}

window.addEventListener('load', () => {
  new Game(); 
});