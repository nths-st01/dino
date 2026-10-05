(() => {
  "use strict";

  const WORLD_WIDTH = 960;
  const WORLD_HEIGHT = 540;
  const GROUND_Y = 430;
  const PLAYER_X = 142;
  const STORAGE_KEY = "moss-and-spark-best";
  const canvas = document.querySelector("#game-canvas");
  const context = canvas.getContext("2d");
  const overlay = document.querySelector("#game-overlay");
  const overlayKicker = document.querySelector("#overlay-kicker");
  const overlayTitle = document.querySelector("#overlay-title");
  const overlayCopy = document.querySelector("#overlay-copy");
  const actionButton = document.querySelector("#action-button");
  const buttonLabel = document.querySelector("#button-label");
  const scoreValue = document.querySelector("#score-value");
  const coinValue = document.querySelector("#coin-value");
  const bestValue = document.querySelector("#best-value");
  const magnetStatus = document.querySelector("#magnet-status");
  const shieldStatus = document.querySelector("#shield-status");
  const announcer = document.querySelector("#announcer");

  const player = { x: PLAYER_X, y: GROUND_Y - 58, width: 48, height: 58, velocityY: 0, grounded: true, jumpCount: 0, runTime: 0 };
  let obstacles = [];
  let coins = [];
  let powerUps = [];
  let particles = [];
  let clouds = [];
  let scenery = [];
  let state = "ready";
  let score = 0;
  let coinCount = 0;
  let magnetTime = 0;
  let shieldCharges = 0;
  let shieldInvulnerability = 0;
  let bestScore = readBestScore();
  let elapsed = 0;
  let worldSpeed = 350;
  let obstacleTimer = 1.1;
  let coinTimer = 0.9;
  let powerUpTimer = 6;
  let lastFrame = 0;
  let animationTime = 0;
  let audioContext = null;

  function readBestScore() {
    try {
      const savedScore = Number(localStorage.getItem(STORAGE_KEY));
      return Number.isFinite(savedScore) && savedScore > 0 ? Math.floor(savedScore) : 0;
    } catch {
      return 0;
    }
  }

  function saveBestScore() {
    try {
      localStorage.setItem(STORAGE_KEY, String(bestScore));
    } catch {
      // The game remains playable when browser storage is unavailable.
    }
  }

  function resizeCanvas() {
    const bounds = canvas.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(bounds.width * pixelRatio);
    canvas.height = Math.round(bounds.width * (WORLD_HEIGHT / WORLD_WIDTH) * pixelRatio);
    context.setTransform(canvas.width / WORLD_WIDTH, 0, 0, canvas.height / WORLD_HEIGHT, 0, 0);
    draw();
  }

  function createScenery() {
    clouds = [
      { x: 92, y: 106, scale: 1.05, speed: 12 },
      { x: 402, y: 76, scale: 0.72, speed: 8 },
      { x: 755, y: 132, scale: 0.9, speed: 10 }
    ];
    scenery = Array.from({ length: 9 }, (_, index) => ({
      x: index * 142 + 35,
      y: GROUND_Y - 22 - Math.random() * 27,
      width: 18 + Math.random() * 21,
      height: 25 + Math.random() * 34,
      color: index % 2 === 0 ? "#4a9880" : "#367e70"
    }));
  }

  function unlockAudio() {
    if (!audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioContext = new AudioContextClass();
    }
    if (audioContext?.state === "suspended") audioContext.resume();
  }

  function playTone(frequency, duration, type = "sine", volume = 0.045, endFrequency = frequency) {
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  function startGame() {
    unlockAudio();
    obstacles = [];
    coins = [];
    powerUps = [];
    particles = [];
    score = 0;
    coinCount = 0;
    magnetTime = 0;
    shieldCharges = 0;
    shieldInvulnerability = 0;
    elapsed = 0;
    worldSpeed = 350;
    obstacleTimer = 1.05;
    coinTimer = 0.75;
    powerUpTimer = 6;
    player.y = GROUND_Y - player.height;
    player.velocityY = 0;
    player.grounded = true;
    player.jumpCount = 0;
    player.runTime = 0;
    state = "running";
    overlay.classList.add("is-hidden");
    updateHud();
    announcer.textContent = "遊戲開始。跳過障礙並收集金幣。";
    playTone(420, 0.12, "triangle", 0.04, 650);
  }

  function endGame() {
    if (state !== "running") return;
    state = "over";
    bestScore = Math.max(bestScore, score);
    saveBestScore();
    updateHud();
    overlayKicker.textContent = "這趟旅程先到這裡";
    overlayTitle.textContent = "GAME OVER";
    overlayCopy.innerHTML = `分數 ${formatScore(score)} <span aria-hidden="true">·</span> 金幣 ${coinCount} <span aria-hidden="true">·</span> 最高分 ${formatScore(bestScore)}<br>按 SPACE 重新開始`;
    buttonLabel.textContent = "再跑一次";
    overlay.classList.remove("is-hidden");
    announcer.textContent = `遊戲結束，分數 ${score}，金幣 ${coinCount}，最高分 ${bestScore}。`;
    playTone(210, 0.3, "sawtooth", 0.035, 75);
  }

  function formatScore(value) {
    return String(value).padStart(5, "0");
  }

  function updateHud() {
    scoreValue.textContent = formatScore(score);
    coinValue.textContent = String(coinCount);
    bestValue.textContent = formatScore(bestScore);
    magnetStatus.textContent = magnetTime > 0 ? `磁鐵 · ${magnetTime.toFixed(1)} 秒` : "磁鐵 · 未啟用";
    magnetStatus.classList.toggle("is-active", magnetTime > 0);
    shieldStatus.textContent = shieldCharges > 0 ? "護盾 · 可抵擋" : shieldInvulnerability > 0 ? "護盾 · 保護中" : "護盾 · 未持有";
    shieldStatus.classList.toggle("is-ready", shieldCharges > 0 || shieldInvulnerability > 0);
  }

  function jump() {
    if (state !== "running" || player.jumpCount >= 2) return;
    player.jumpCount += 1;
    player.velocityY = player.jumpCount === 1 ? -710 : -650;
    player.grounded = false;
    playTone(player.jumpCount === 1 ? 300 : 440, 0.13, "sine", 0.035, player.jumpCount === 1 ? 520 : 680);
  }

  function handleAction() {
    if (state === "running") jump();
    else startGame();
  }

  function spawnObstacle() {
    const difficulty = Math.min(1, elapsed / 70);
    const availableTypes = ["stump", "spire"];
    if (elapsed > 12) availableTypes.push("drone");
    const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
    const obstacle = type === "stump"
      ? { type, x: WORLD_WIDTH + 40, y: GROUND_Y - 43, width: 43, height: 43 }
      : type === "spire"
        ? { type, x: WORLD_WIDTH + 40, y: GROUND_Y - 75, width: 34, height: 75 }
        : { type, x: WORLD_WIDTH + 40, y: GROUND_Y - 117, width: 54, height: 29, baseY: GROUND_Y - 117, phase: Math.random() * Math.PI * 2 };
    obstacles.push(obstacle);
    obstacleTimer = Math.max(0.92, 1.52 - difficulty * 0.43) * (0.88 + Math.random() * 0.32);
  }

  function spawnCoin() {
    const heights = [GROUND_Y - 78, GROUND_Y - 145, GROUND_Y - 210];
    const chosenHeight = heights[Math.floor(Math.random() * heights.length)];
    const x = WORLD_WIDTH + 45;
    const overlapsHazard = obstacles.some((obstacle) =>
      obstacle.x > WORLD_WIDTH - 180 && Math.abs(obstacle.x - x) < obstacle.width + 125
    );
    if (!overlapsHazard) {
      const count = Math.random() < 0.28 ? 3 : 1;
      for (let index = 0; index < count; index += 1) {
        coins.push({ x: x + index * 39, y: chosenHeight, width: 25, height: 25, rotation: Math.random() * Math.PI, phase: Math.random() * Math.PI * 2, collected: false });
      }
    }
    coinTimer = 1.05 + Math.random() * 1.1;
  }

  function spawnPowerUp() {
    const spawnX = WORLD_WIDTH + 45;
    const blockedByHazard = obstacles.some((obstacle) =>
      obstacle.x > WORLD_WIDTH - 180 && obstacle.x < spawnX + 80
    );
    const blockedByCoin = coins.some((coin) => coin.x > WORLD_WIDTH - 70 && coin.x < spawnX + 80);
    if (!blockedByHazard && !blockedByCoin) {
      const type = Math.random() < 0.55 ? "magnet" : "shield";
      powerUps.push({ type, x: spawnX, y: GROUND_Y - (type === "magnet" ? 145 : 95), width: 34, height: 34, phase: Math.random() * Math.PI * 2 });
    }
    powerUpTimer = 8 + Math.random() * 7;
  }

  function checkPowerUpCollision(runner, powerUp) {
    return runner.x + 7 < powerUp.x + powerUp.width - 3
      && runner.x + runner.width - 7 > powerUp.x + 3
      && runner.y + 6 < powerUp.y + powerUp.height - 3
      && runner.y + runner.height - 6 > powerUp.y + 3;
  }

  function collectPowerUp(powerUp) {
    if (powerUp.type === "magnet") {
      magnetTime = 8;
      playTone(620, 0.18, "triangle", 0.045, 980);
      announcer.textContent = "磁鐵啟動，金幣會被吸引過來。";
    } else {
      shieldCharges = 1;
      shieldInvulnerability = 0;
      playTone(380, 0.2, "sine", 0.045, 760);
      announcer.textContent = "護盾已就緒，可抵擋一次障礙。";
    }
    for (let index = 0; index < 10; index += 1) {
      const angle = (Math.PI * 2 * index) / 10;
      particles.push({ x: powerUp.x + powerUp.width / 2, y: powerUp.y + powerUp.height / 2, velocityX: Math.cos(angle) * 85, velocityY: Math.sin(angle) * 85 - 25, life: 0.5, maxLife: 0.5, color: powerUp.type === "magnet" ? "#f2c14e" : "#83c8f0" });
    }
    updateHud();
  }

  function checkCollision(first, second) {
    const insetX = first === player ? 7 : 2;
    const insetY = first === player ? 6 : 2;
    return first.x + insetX < second.x + second.width - 2
      && first.x + first.width - insetX > second.x + 2
      && first.y + insetY < second.y + second.height - 2
      && first.y + first.height - insetY > second.y + 2;
  }

  function checkCoinCollision(runner, coin) {
    const padding = 5;
    return runner.x + padding < coin.x + coin.width - padding
      && runner.x + runner.width - padding > coin.x + padding
      && runner.y + padding < coin.y + coin.height - padding
      && runner.y + runner.height - padding > coin.y + padding;
  }

  function collectCoin(coin) {
    coin.collected = true;
    coinCount += 1;
    score += 10;
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8;
      particles.push({ x: coin.x + coin.width / 2, y: coin.y + coin.height / 2, velocityX: Math.cos(angle) * (45 + Math.random() * 75), velocityY: Math.sin(angle) * (45 + Math.random() * 75) - 30, life: 0.42, maxLife: 0.42, color: index % 2 ? "#fff3a0" : "#ffb843" });
    }
    updateHud();
    playTone(730, 0.12, "sine", 0.045, 1120);
  }

  function update(deltaTime) {
    animationTime += deltaTime;
    updateScenery(deltaTime);
    updateParticles(deltaTime);
    if (state !== "running") return;

    elapsed += deltaTime;
    worldSpeed = Math.min(620, 350 + elapsed * 5.2);
    score = Math.floor(elapsed * 10) + coinCount * 10;
    obstacleTimer -= deltaTime;
    coinTimer -= deltaTime;
    powerUpTimer -= deltaTime;
    if (obstacleTimer <= 0) spawnObstacle();
    if (coinTimer <= 0) spawnCoin();
    if (powerUpTimer <= 0) spawnPowerUp();
    magnetTime = Math.max(0, magnetTime - deltaTime);
    shieldInvulnerability = Math.max(0, shieldInvulnerability - deltaTime);

    player.runTime += deltaTime * (worldSpeed / 115);
    player.velocityY += 1900 * deltaTime;
    player.y += player.velocityY * deltaTime;
    if (player.y + player.height >= GROUND_Y) {
      player.y = GROUND_Y - player.height;
      player.velocityY = 0;
      player.grounded = true;
      player.jumpCount = 0;
    }

    obstacles.forEach((obstacle) => {
      obstacle.x -= worldSpeed * deltaTime;
      if (obstacle.type === "drone") obstacle.y = obstacle.baseY + Math.sin(animationTime * 3 + obstacle.phase) * 15;
      if (checkCollision(player, obstacle)) {
        if (shieldInvulnerability > 0) {
          obstacle.passed = true;
        } else if (shieldCharges > 0) {
          shieldCharges -= 1;
          shieldInvulnerability = 0.85;
          obstacle.passed = true;
          for (let index = 0; index < 12; index += 1) {
            const angle = (Math.PI * 2 * index) / 12;
            particles.push({ x: player.x + player.width / 2, y: player.y + player.height / 2, velocityX: Math.cos(angle) * 105, velocityY: Math.sin(angle) * 105, life: 0.45, maxLife: 0.45, color: "#83c8f0" });
          }
          playTone(500, 0.2, "triangle", 0.05, 220);
        } else {
          endGame();
        }
      }
    });
    obstacles = obstacles.filter((obstacle) => !obstacle.passed && obstacle.x + obstacle.width > -20);

    powerUps.forEach((powerUp) => {
      powerUp.x -= worldSpeed * deltaTime;
      powerUp.phase += deltaTime * 3;
      if (!powerUp.collected && checkPowerUpCollision(player, powerUp)) {
        powerUp.collected = true;
        collectPowerUp(powerUp);
      }
    });
    powerUps = powerUps.filter((powerUp) => !powerUp.collected && powerUp.x + powerUp.width > -20);

    coins.forEach((coin) => {
      coin.x -= worldSpeed * deltaTime;
      coin.rotation += deltaTime * 4.2;
      coin.phase += deltaTime * 4;
      const distanceToPlayer = coin.x - player.x;
      if (magnetTime > 0 && distanceToPlayer > 0 && distanceToPlayer < 240) {
        const targetY = player.y + player.height / 2 - coin.height / 2;
        coin.y += (targetY - coin.y) * Math.min(1, deltaTime * 3.5);
        coin.x -= Math.min(260 * deltaTime, Math.max(0, distanceToPlayer - 45) * deltaTime * 1.8);
      }
      if (!coin.collected && checkCoinCollision(player, coin)) collectCoin(coin);
    });
    coins = coins.filter((coin) => !coin.collected && coin.x + coin.width > -20);
    updateHud();
  }

  function updateScenery(deltaTime) {
    clouds.forEach((cloud) => {
      cloud.x -= deltaTime * (state === "running" ? worldSpeed * 0.12 : 15) * (cloud.speed / 10);
      if (cloud.x < -100) cloud.x = WORLD_WIDTH + 75;
    });
    scenery.forEach((tree) => {
      tree.x -= deltaTime * (state === "running" ? worldSpeed * 0.28 : 28);
      if (tree.x + tree.width < 0) {
        tree.x = WORLD_WIDTH + Math.random() * 160;
        tree.height = 25 + Math.random() * 34;
      }
    });
  }

  function updateParticles(deltaTime) {
    particles.forEach((particle) => {
      particle.life -= deltaTime;
      particle.x += particle.velocityX * deltaTime;
      particle.y += particle.velocityY * deltaTime;
      particle.velocityY += 230 * deltaTime;
    });
    particles = particles.filter((particle) => particle.life > 0);
  }

  function draw() {
    context.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    drawBackground();
    drawClouds();
    drawHills();
    drawGround();
    drawScenery();
    drawCoins();
    drawPowerUps();
    drawObstacles();
    drawPlayer();
    drawParticles();
  }

  function drawBackground() {
    const sky = context.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
    sky.addColorStop(0, "#a9e4d1");
    sky.addColorStop(0.72, "#d7f0d1");
    sky.addColorStop(1, "#edf0bd");
    context.fillStyle = sky;
    context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    context.fillStyle = "#ffe38c";
    context.beginPath();
    context.arc(790, 153, 49, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#fff1b6";
    context.beginPath();
    context.arc(790, 153, 61 + Math.sin(animationTime * 1.2) * 3, 0, Math.PI * 2);
    context.globalAlpha = 0.2;
    context.fill();
    context.globalAlpha = 1;
  }

  function drawClouds() {
    clouds.forEach((cloud) => {
      context.save();
      context.translate(cloud.x, cloud.y);
      context.scale(cloud.scale, cloud.scale);
      context.fillStyle = "#f5fff0d9";
      context.beginPath();
      context.arc(0, 12, 19, Math.PI, 0);
      context.arc(20, 1, 25, Math.PI, 0);
      context.arc(47, 12, 17, Math.PI, 0);
      context.lineTo(64, 22);
      context.lineTo(-19, 22);
      context.closePath();
      context.fill();
      context.restore();
    });
  }

  function drawHills() {
    context.fillStyle = "#86c8a7";
    context.beginPath();
    context.moveTo(0, 342);
    context.quadraticCurveTo(140, 229, 290, 345);
    context.quadraticCurveTo(445, 245, 600, 345);
    context.quadraticCurveTo(790, 232, 960, 341);
    context.lineTo(960, GROUND_Y);
    context.lineTo(0, GROUND_Y);
    context.fill();
    context.fillStyle = "#62aa8c";
    context.beginPath();
    context.moveTo(0, 386);
    context.quadraticCurveTo(205, 292, 406, 389);
    context.quadraticCurveTo(654, 286, 960, 388);
    context.lineTo(960, GROUND_Y);
    context.lineTo(0, GROUND_Y);
    context.fill();
  }

  function drawGround() {
    context.fillStyle = "#245c4c";
    context.fillRect(0, GROUND_Y, WORLD_WIDTH, WORLD_HEIGHT - GROUND_Y);
    context.fillStyle = "#c6f074";
    context.fillRect(0, GROUND_Y, WORLD_WIDTH, 7);
    context.fillStyle = "#36745d";
    for (let x = -20; x < WORLD_WIDTH + 40; x += 47) {
      const offset = state === "running" ? (animationTime * worldSpeed * 0.72) % 47 : 0;
      context.fillRect(x - offset, GROUND_Y + 28, 20, 3);
    }
  }

  function drawScenery() {
    scenery.forEach((tree) => {
      context.fillStyle = tree.color;
      context.beginPath();
      context.moveTo(tree.x + tree.width / 2, tree.y - tree.height);
      context.lineTo(tree.x + tree.width, tree.y);
      context.lineTo(tree.x, tree.y);
      context.closePath();
      context.fill();
      context.fillStyle = "#d8efac";
      context.fillRect(tree.x + tree.width / 2 - 2, tree.y - tree.height * 0.52, 4, 4);
    });
  }

  function drawPlayer() {
    const bounce = player.grounded && state === "running" ? Math.abs(Math.sin(player.runTime * 9)) * 3 : 0;
    const x = player.x;
    const y = player.y + bounce;
    context.save();
    context.translate(x, y);
    if (shieldCharges > 0 || shieldInvulnerability > 0) {
      context.globalAlpha = shieldCharges > 0 ? 0.68 : 0.45 + Math.sin(animationTime * 24) * 0.18;
      context.strokeStyle = "#b6e8ff";
      context.lineWidth = 4;
      context.shadowColor = "#6fc9ff";
      context.shadowBlur = 16;
      context.beginPath();
      context.ellipse(24, 28, 34, 39, 0, 0, Math.PI * 2);
      context.stroke();
      context.shadowBlur = 0;
      context.globalAlpha = 1;
    }
    context.fillStyle = "#173c37";
    context.beginPath();
    context.ellipse(24, 57, 23, 4, 0, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#ff795e";
    context.beginPath();
    context.roundRect(3, 8, 43, 43, 13);
    context.fill();
    context.fillStyle = "#e5ac93";
    context.beginPath();
    context.roundRect(8, 3, 34, 44, 13);
    context.fill();

    context.fillStyle = "#d5fff0";
    context.beginPath();
    context.roundRect(13, 17, 24, 16, 7);
    context.fill();
    context.fillStyle = "#174b44";
    context.beginPath();
    context.arc(20, 24, 2.4, 0, Math.PI * 2);
    context.arc(30, 24, 2.4, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#174b44";
    context.lineWidth = 1.7;
    context.beginPath();
    context.moveTo(21, 29);
    context.quadraticCurveTo(25, 33, 29, 29);
    context.stroke();

    context.strokeStyle = "#174b44";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(25, 3);
    context.lineTo(25, -3);
    context.stroke();
    context.fillStyle = "#c6f074";
    context.beginPath();
    context.arc(25, -5, 4, 0, Math.PI * 2);
    context.fill();

    const step = player.grounded && state === "running" ? Math.sin(player.runTime * 9) * 5 : 0;
    context.strokeStyle = "#173c37";
    context.lineWidth = 5;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(17, 48);
    context.lineTo(16 - step, 55);
    context.moveTo(33, 48);
    context.lineTo(34 + step, 55);
    context.stroke();
    context.restore();
  }

  function drawObstacles() {
    obstacles.forEach((obstacle) => {
      if (obstacle.type === "stump") {
        context.fillStyle = "#a84f42";
        context.beginPath();
        context.roundRect(obstacle.x, obstacle.y + 7, obstacle.width, obstacle.height - 7, 8);
        context.fill();
        context.fillStyle = "#e2815c";
        context.beginPath();
        context.ellipse(obstacle.x + obstacle.width / 2, obstacle.y + 9, obstacle.width / 2, 9, 0, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "#75453c";
        context.fillRect(obstacle.x + 9, obstacle.y + 24, 7, 4);
        context.fillRect(obstacle.x + 28, obstacle.y + 24, 7, 4);
      } else if (obstacle.type === "spire") {
        context.fillStyle = "#6b648e";
        context.beginPath();
        context.roundRect(obstacle.x + 3, obstacle.y + 13, obstacle.width - 6, obstacle.height - 13, 8);
        context.fill();
        context.fillStyle = "#9487b4";
        context.beginPath();
        context.moveTo(obstacle.x, obstacle.y + 15);
        context.lineTo(obstacle.x + obstacle.width / 2, obstacle.y);
        context.lineTo(obstacle.x + obstacle.width, obstacle.y + 15);
        context.closePath();
        context.fill();
        context.fillStyle = "#c6f074";
        context.beginPath();
        context.arc(obstacle.x + obstacle.width / 2, obstacle.y + 31, 3, 0, Math.PI * 2);
        context.fill();
      } else {
        context.fillStyle = "#244a65";
        context.beginPath();
        context.roundRect(obstacle.x, obstacle.y + 4, obstacle.width, 22, 11);
        context.fill();
        context.fillStyle = "#ff795e";
        context.beginPath();
        context.arc(obstacle.x + 37, obstacle.y + 15, 4, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = "#244a65";
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(obstacle.x + 9, obstacle.y + 5);
        context.lineTo(obstacle.x + 3, obstacle.y - 5);
        context.moveTo(obstacle.x + 45, obstacle.y + 5);
        context.lineTo(obstacle.x + 51, obstacle.y - 5);
        context.stroke();
      }
    });
  }

  function drawCoins() {
    coins.forEach((coin) => {
      const floatOffset = Math.sin(coin.phase) * 5;
      const squash = 0.34 + Math.abs(Math.cos(coin.rotation)) * 0.66;
      context.save();
      context.translate(coin.x + coin.width / 2, coin.y + coin.height / 2 + floatOffset);
      context.scale(squash, 1);
      context.shadowColor = "#ffbd43";
      context.shadowBlur = 12 + Math.sin(coin.phase * 2) * 3;
      context.fillStyle = "#ffca53";
      context.beginPath();
      context.arc(0, 0, 11, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
      context.strokeStyle = "#fff1a5";
      context.lineWidth = 2;
      context.stroke();
      context.fillStyle = "#c17a20";
      context.font = "bold 13px Georgia";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText("✦", 0, 1);
      context.restore();
    });
  }

  function drawPowerUps() {
    powerUps.forEach((powerUp) => {
      const bob = Math.sin(powerUp.phase) * 5;
      context.save();
      context.translate(powerUp.x + powerUp.width / 2, powerUp.y + powerUp.height / 2 + bob);
      context.rotate(Math.sin(powerUp.phase * 0.5) * 0.08);
      context.shadowColor = powerUp.type === "magnet" ? "#f2c14e" : "#72caff";
      context.shadowBlur = 16;
      context.fillStyle = powerUp.type === "magnet" ? "#eaa944" : "#4b9bd0";
      context.beginPath();
      context.arc(0, 0, 16, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
      context.strokeStyle = "#fff9e8";
      context.lineWidth = 3.5;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.beginPath();
      if (powerUp.type === "magnet") {
        context.moveTo(-6, -8);
        context.lineTo(-6, 2);
        context.quadraticCurveTo(-6, 9, 0, 9);
        context.quadraticCurveTo(6, 9, 6, 2);
        context.lineTo(6, -8);
      } else {
        context.moveTo(0, -10);
        context.lineTo(8, -6);
        context.lineTo(7, 3);
        context.quadraticCurveTo(5, 8, 0, 11);
        context.quadraticCurveTo(-5, 8, -7, 3);
        context.lineTo(-8, -6);
        context.closePath();
      }
      context.stroke();
      if (powerUp.type === "magnet") {
        context.strokeStyle = "#ff7967";
        context.beginPath();
        context.moveTo(-9, -8);
        context.lineTo(-3, -8);
        context.moveTo(3, -8);
        context.lineTo(9, -8);
        context.stroke();
      }
      context.restore();
    });
  }

  function drawParticles() {
    particles.forEach((particle) => {
      context.globalAlpha = particle.life / particle.maxLife;
      context.fillStyle = particle.color;
      context.beginPath();
      context.arc(particle.x, particle.y, 3.5 * (particle.life / particle.maxLife), 0, Math.PI * 2);
      context.fill();
    });
    context.globalAlpha = 1;
  }

  function frame(timestamp) {
    const deltaTime = Math.min((timestamp - (lastFrame || timestamp)) / 1000, 0.033);
    lastFrame = timestamp;
    update(deltaTime);
    draw();
    window.requestAnimationFrame(frame);
  }

  actionButton.addEventListener("click", startGame);
  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    handleAction();
  });
  window.addEventListener("keydown", (event) => {
    if (event.code === "Space" || event.code === "ArrowUp") {
      event.preventDefault();
      handleAction();
    }
  });
  window.addEventListener("resize", resizeCanvas);

  createScenery();
  updateHud();
  resizeCanvas();
  window.requestAnimationFrame(frame);
})();