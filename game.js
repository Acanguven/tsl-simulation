const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const fieldScale = 1.1; // Scale the field to 75%
const playerSize = 20 * fieldScale;
const ballSize = 10 * fieldScale;
const playerSpeed = 2 * fieldScale; // Speed for Fenerbahçe players
const galatasaraySpeed = playerSpeed / 2; // Speed for Galatasaray players (4x slower)
const minDistance = 200 * fieldScale; // Minimum distance AI players should keep from each other
const cohesionStrength = 0.005;
const fieldWidth = 3000 * fieldScale;
const fieldHeight = 1000 * fieldScale;
const goalWidth = 200 * fieldScale;
const goalHeight = 100 * fieldScale;
const goalDistance = fieldWidth / 2 - 500 * fieldScale; // Distance from the center to each goal

let players = [];
let ball = { x: 0, y: 0, dx: 0, dy: 0, controlledBy: null };
let keysPressed = {};
let scores = { blue: 0, red: 0 };
let cardBanner = { visible: false, text: "", timer: 0 };

const fenerbahcePlayerNames = [
  "Altay Bayındır",
  "Serdar Aziz",
  "Attila Szalai",
  "Bright Osayi-Samuel",
  "Ferdi Kadıoğlu",
  "Miha Zajc",
  "Willian Arão",
  "Lincoln Henrique",
  "Enner Valencia",
  "Arda Güler", // Arda Güler is the controlled player initially
  "Michy Batshuayi",
];

const galatasarayPlayerNames = [
  "Fernando Muslera",
  "Victor Nelsson",
  "Abdülkerim Bardakcı",
  "Sacha Boey",
  "Patrick van Aanholt",
  "Lucas Torreira",
  "Sérgio Oliveira",
  "Kerem Aktürkoğlu",
  "Dries Mertens",
  "Mauro Icardi",
  "Yunus Akgün",
];

function createTeam(color, startX, startY, formation, playerNames) {
  let playerNumber = 1;
  const spacingX = 200 * fieldScale;
  const spacingY = 150 * fieldScale;
  for (let i = 0; i < formation.length; i++) {
    for (let j = 0; j < formation[i]; j++) {
      players.push({
        x: startX + i * spacingX,
        y: startY + j * spacingY,
        color: color,
        isControlled:
          color === "blue" && playerNames[playerNumber - 1] === "Arda Güler", // Arda Güler is controlled by the user initially
        aiControlled: color === "red", // Only Galatasaray players are AI-controlled
        number: playerNumber++, // Assign a number to each player
        name: playerNames[playerNumber - 2], // Assign names to players
        yellowCard: false, // Track yellow card status
        startingX: startX + i * spacingX,
        startingY: startY + j * spacingY,
      });
    }
  }
}

function drawKeysTutorial() {
  ctx.translate(0, 50);
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(10, 10, 220, 150); // Background for the tutorial
  ctx.fillStyle = "white";
  ctx.font = "16px Arial";
  ctx.textAlign = "left";
  ctx.fillText("Controls:", 20, 35);
  ctx.fillText("Move Up: Arrow Up", 20, 55);
  ctx.fillText("Move Down: Arrow Down", 20, 75);
  ctx.fillText("Move Left: Arrow Left", 20, 95);
  ctx.fillText("Move Right: Arrow Right", 20, 115);
  ctx.fillText("Shoot: Spacebar", 20, 135);
  ctx.translate(0, 0);
}

function createSpeakWithCancel() {
  let lastText = "";

  // Function to handle text-to-speech with cancellation logic
  function speak(text) {
    if ("speechSynthesis" in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      // Only speak if the text has changed
      if (text !== lastText) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.5; // Set the speech rate (1 is the default)
        window.speechSynthesis.speak(utterance);
        lastText = text;
      }
    } else {
      console.warn("Text-to-speech is not supported in this browser.");
    }
  }

  return speak;
}

const speak = createSpeakWithCancel();

function resetPositions(start) {
  if (start) {
    players = [];
    const midX = 0; // Middle of the field on the X-axis
    const leftSideX = midX - 800 * fieldScale; // Starting position for Fenerbahçe players on the left side
    const rightSideX = midX + 800 * fieldScale; // Starting position for Galatasaray players on the right side
    const midY = -fieldHeight / 4; // Vertical center of the field

    createTeam("blue", leftSideX, midY, [3, 3, 3, 2], fenerbahcePlayerNames); // Fenerbahçe
    createTeam("red", rightSideX, midY, [3, 5, 2], galatasarayPlayerNames); // Galatasaray
    speak("Game started. Fenerbahçe versus Galatasaray.");
  } else {
    players.forEach((player) => {
      player.x = player.startingX;
      player.y = player.startingY;
    });
  }

  resetBall();
}

// 4-4-2 formation and initial setup
resetPositions(true);

document.addEventListener("keydown", function (event) {
  keysPressed[event.code] = true;
});

document.addEventListener("keyup", function (event) {
  keysPressed[event.code] = false;
});

function handleInput() {
  const controlledPlayer = players.find((player) => player.isControlled);

  // Variables to track movement direction
  let moveX = 0;
  let moveY = 0;

  // Update the player's position based on input
  if (keysPressed["ArrowUp"]) {
    controlledPlayer.y -= playerSpeed;
    moveY = -1;
  }
  if (keysPressed["ArrowDown"]) {
    controlledPlayer.y += playerSpeed;
    moveY = 1;
  }
  if (keysPressed["ArrowLeft"]) {
    controlledPlayer.x -= playerSpeed;
    moveX = -1;
  }
  if (keysPressed["ArrowRight"]) {
    controlledPlayer.x += playerSpeed;
    moveX = 1;
  }

  // Calculate the direction based on the last movement
  let angle = Math.atan2(moveY, moveX);

  // Check for collision with the ball and control it
  if (
    Math.hypot(ball.x - controlledPlayer.x, ball.y - controlledPlayer.y) <
    playerSize + ballSize
  ) {
    ball.controlledBy = controlledPlayer;
    speak(`${controlledPlayer.name} is running with the ball.`);
  }

  // If the ball is controlled by a player, move it with the player
  if (ball.controlledBy) {
    if (moveX !== 0 || moveY !== 0) {
      // Move the ball to be at the edge of the player's circle in the direction of movement
      ball.x = controlledPlayer.x + (playerSize + ballSize) * Math.cos(angle);
      ball.y = controlledPlayer.y + (playerSize + ballSize) * Math.sin(angle);
    }

    // Shoot the ball when space is pressed
    if (keysPressed["Space"]) {
      ball.dx = (ball.x - controlledPlayer.x) * 0.5;
      ball.dy = (ball.y - controlledPlayer.y) * 0.5;
      ball.controlledBy = null; // Release control of the ball
      speak(`${controlledPlayer.name} shoots!`);
    }
  }
}

function updateAI() {
  players.forEach((player) => {
    if (player.aiControlled) {
      // Move towards the ball
      const angle = Math.atan2(ball.y - player.y, ball.x - player.x);
      let newX = player.x + Math.cos(angle) * galatasaraySpeed;
      let newY = player.y + Math.sin(angle) * galatasaraySpeed;

      // Check for collision with the ball
      if (
        Math.hypot(ball.x - player.x, ball.y - player.y) <
        playerSize + ballSize
      ) {
        ball.controlledBy = player;

        // Shoot towards Fenerbahçe goal
        const shootAngle = Math.atan2(0 - player.y, -goalDistance - player.x); // Fenerbahçe goal is at (-goalDistance, 0)
        ball.dx = Math.cos(shootAngle) * 5;
        ball.dy = Math.sin(shootAngle) * 5;
        ball.controlledBy = null; // Release control of the ball after shooting
        speak(`${player.name} shoots towards the goal!`);
      }

      // Adjust position to maintain minimum distance from other AI players
      players.forEach((otherPlayer) => {
        if (otherPlayer !== player && otherPlayer.aiControlled) {
          const distance = Math.hypot(
            newX - otherPlayer.x,
            newY - otherPlayer.y
          );
          if (distance < minDistance) {
            const avoidAngle = Math.atan2(
              newY - otherPlayer.y,
              newX - otherPlayer.x
            );
            newX +=
              Math.cos(avoidAngle) *
              (minDistance - distance) *
              cohesionStrength;
            newY +=
              Math.sin(avoidAngle) *
              (minDistance - distance) *
              cohesionStrength;
          }
        }
      });

      player.x = newX;
      player.y = newY;
    } else if (player.color === "blue" && !player.isControlled) {
      // Move towards the ball
      const angle = Math.atan2(ball.y - player.y, ball.x - player.x);
      let newX = player.x + Math.cos(angle) * (Math.random() * playerSpeed);
      let newY = player.y + Math.sin(angle) * (Math.random() * playerSpeed);

      // Maintain a minimum distance from the ball
      const ballDistance = Math.hypot(ball.x - player.x, ball.y - player.y);
      if (ballDistance < minDistance) {
        const avoidAngle = Math.atan2(player.y - ball.y, player.x - ball.x);
        newX +=
          Math.cos(avoidAngle) *
          (minDistance - ballDistance) *
          cohesionStrength;
        newY +=
          Math.sin(avoidAngle) *
          (minDistance - ballDistance) *
          cohesionStrength;
      }

      // Maintain a minimum distance from other Fenerbahçe players
      players.forEach((otherPlayer) => {
        if (otherPlayer !== player && otherPlayer.color === "blue") {
          const distance = Math.hypot(
            newX - otherPlayer.x,
            newY - otherPlayer.y
          );
          if (distance < minDistance) {
            const avoidAngle = Math.atan2(
              newY - otherPlayer.y,
              newX - otherPlayer.x
            );
            newX +=
              Math.cos(avoidAngle) *
              (minDistance - distance) *
              cohesionStrength;
            newY +=
              Math.sin(avoidAngle) *
              (minDistance - distance) *
              cohesionStrength;
          }
        }
      });

      player.x = newX;
      player.y = newY;
    }
  });
}

function checkBallCollisionWithPlayers() {
  players.forEach((player) => {
    if (
      player.color === "blue" && // Only Fenerbahçe players
      Math.hypot(ball.x - player.x, ball.y - player.y) < playerSize + ballSize
    ) {
      players.forEach((p) => (p.isControlled = false)); // Unset all controlled flags
      player.isControlled = true; // Set the touched player as controlled
      speak(`${player.name} is now controlling the ball.`);
    }
  });
}

function drawPlayer(player) {
  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.arc(player.x, player.y, playerSize, 0, Math.PI * 2);
  ctx.fill();

  // Draw player number
  ctx.fillStyle = "white";
  ctx.font = "14px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(player.number, player.x, player.y);

  // Draw yellow card indicator if applicable
  if (player.yellowCard) {
    ctx.fillStyle = "yellow";
    ctx.beginPath();
    ctx.arc(
      player.x + playerSize / 2,
      player.y - playerSize / 2,
      5,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  // Draw player name
  ctx.fillStyle = "white";
  ctx.font = "10px Arial";
  ctx.textAlign = "center";
  ctx.fillText(player.name, player.x, player.y + playerSize + 12);

  // Draw white border around the controlled player
  if (player.isControlled) {
    ctx.strokeStyle = "white";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x, player.y, playerSize + 3, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawBall() {
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ballSize, 0, Math.PI * 2);
  ctx.fill();
}

function drawGoals() {
  ctx.fillStyle = "blue";
  ctx.fillRect(-goalDistance, -goalHeight / 2, 10, goalHeight); // Left goal post
  ctx.fillStyle = "red";
  ctx.fillRect(goalDistance, -goalHeight / 2, 10, goalHeight); // Right goal post
}

function updateBall() {
  if (!ball.controlledBy) {
    ball.x += ball.dx;
    ball.y += ball.dy;

    ball.dx *= 0.98; // Friction slows the ball down over time
    ball.dy *= 0.98;

    checkBallCollisionWithPlayers(); // Check for ball collision with players

    // Check for goals
    if (
      ball.x < -goalDistance &&
      ball.y > -goalHeight / 2 &&
      ball.y < goalHeight / 2
    ) {
      scores.red++;
      speak("Goal for Galatasaray!"); // Announce the goal
      resetPositions(false); // Reset positions after a goal
    } else if (
      ball.x > goalDistance &&
      ball.y > -goalHeight / 2 &&
      ball.y < goalHeight / 2
    ) {
      scores.blue++;
      speak("Goal for Fenerbahçe!"); // Announce the goal
      resetPositions(false); // Reset positions after a goal
    }
  }
}

function resetBall() {
  ball.x = 0;
  ball.y = 0;
  ball.dx = 0;
  ball.dy = 0;
  ball.controlledBy = null;
}

function drawScores() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(0, 0, canvas.width, 50);
  ctx.fillRect(0, 0, canvas.width, 50);
  ctx.fillStyle = "yellow";
  ctx.font = "30px Arial";
  ctx.textAlign = "center";
  ctx.fillText(
    `Fenerbahçe: ${scores.blue} - Galatasaray: ${scores.red}`,
    canvas.width / 2,
    35
  );
}

function drawField() {
  const controlledPlayer = players.find((player) => player.isControlled);

  // Center the camera on the controlled player
  ctx.setTransform(
    1,
    0,
    0,
    1,
    -controlledPlayer.x + canvas.width / 2,
    -controlledPlayer.y + canvas.height / 2
  );

  // Clear and fill the canvas (no limits, so we just clear the visible area)
  ctx.clearRect(
    controlledPlayer.x - canvas.width / 2,
    controlledPlayer.y - canvas.height / 2,
    canvas.width,
    canvas.height
  );
  ctx.fillStyle = "#006400";
  ctx.fillRect(
    controlledPlayer.x - canvas.width / 2,
    controlledPlayer.y - canvas.height / 2,
    canvas.width,
    canvas.height
  );

  drawGoals();
  players.forEach(drawPlayer);
  drawBall();

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function showCardBanner(player, cardType) {
  console.log("Showing card banner");
  cardBanner.text = `${player.number} ${player.name} - ${cardType} Card`;
  cardBanner.visible = true;
  cardBanner.timer = 120; // Banner visible for 2 seconds (60 fps * 2)
  speak(`${player.name} has received a ${cardType} card.`);
}

function assignCard() {
  const eligiblePlayers = players.filter(
    (player) => player.color === "blue" && !player.isControlled
  );

  if (eligiblePlayers.length === 0) {
    // Only the controlled player is left
    const controlledPlayer = players.find((player) => player.isControlled);
    if (controlledPlayer.yellowCard) {
      showCardBanner(controlledPlayer, "Red");
      removePlayer(controlledPlayer);
      endGame();
    } else {
      controlledPlayer.yellowCard = true;
      showCardBanner(controlledPlayer, "Yellow");
    }
  } else {
    const randomPlayer =
      eligiblePlayers[Math.floor(Math.random() * eligiblePlayers.length)];
    if (randomPlayer.yellowCard) {
      showCardBanner(randomPlayer, "Red");
      removePlayer(randomPlayer);
    } else {
      randomPlayer.yellowCard = true;
      showCardBanner(randomPlayer, "Yellow");
    }
  }
}

function removePlayer(player) {
  const index = players.indexOf(player);
  if (index > -1) {
    players.splice(index, 1);
  }
}

function endGame() {
  setTimeout(() => {
    speak("Galatasaray wins the game!");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "white";
    ctx.font = "50px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Galatasaray wins", canvas.width / 2, canvas.height / 2);
  }, 2000); // Display the banner for 2 seconds before showing the end game message
}

function gameLoop() {
  handleInput();
  updateAI();
  updateBall();
  drawField();
  drawScores();
  drawKeysTutorial();

  if (cardBanner.visible) {
    console.log(canvas.height);
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, canvas.height - 100, canvas.width, 50);
    ctx.fillStyle = "yellow";
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    ctx.fillText(cardBanner.text, canvas.width / 2, canvas.height - 75);
    cardBanner.timer--;

    if (cardBanner.timer <= 0) {
      cardBanner.visible = false;
    }
  }

  requestAnimationFrame(gameLoop);
}

setInterval(assignCard, 5000); // Assign a card every 5 seconds
gameLoop();
