const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();

const server =
  http.createServer(app);

const io =
  new Server(server);

// ========================
// SOCKET
// ========================

io.engine.opts.pingTimeout =
  60000;

io.engine.opts.pingInterval =
  25000;

// ========================
// STATIC
// ========================

app.use(
  express.static("public")
);

// ========================
// ADMIN
// ========================

const ADMIN_PASSWORD =
  "1234";

// TETR.IO 내부 ID
// fetchTetrioUser().id 기준

const ADMIN_IDS = [

  "6458c7de54481fd487d8b478"

];

// ========================
// RANK TURN TIME
// ========================

const rankTurnTime = {

  "X+": 30,
  X: 30,

  U: 30,

  SS: 60,

  "S+": 60,
  S: 60,
  "S-": 60,

  "A+": 120,
  A: 120,
  "A-": 120,

  "B+": 120,
  B: 120,
  "B-": 120,

  "C+": 120,
  C: 120,
  "C-": 120,

  "D+": 120,
  D: 120,
  "D-": 120,

  UNRANKED: 120
};

// ========================
// RANK TOTAL TIME
// ========================

const rankTotalTime = {

  "X+": 300,
  X: 300,

  U: 360,

  SS: 480,

  "S+": 540,
  S: 540,
  "S-": 540,

  "A+": 720,
  A: 720,
  "A-": 720,

  "B+": 840,
  B: 840,
  "B-": 840,

  "C+": 960,
  C: 960,
  "C-": 960,

  "D+": 1080,
  D: 1080,
  "D-": 1080,

  UNRANKED: 1200
};

// ========================
// GET TIME
// ========================

function getTurnTime(rank) {

  return (
    rankTurnTime[rank] ||
    120
  );
}

function getTotalTime(rank) {

  return (
    rankTotalTime[rank] ||
    1200
  );
}

// ========================
// STATE
// ========================

function createState(
  oldUsers = []
) {

  return {

    users: oldUsers,

    slots: {
      A: null,
      B: null
    },

    ready: {
      A: false,
      B: false
    },

    totalTime: {
      A: 0,
      B: 0
    },

    turnTime: {
      A: 0,
      B: 0
    },

    currentPlayer: "A",

    phase: "LOBBY",

    lastUpdate:
      Date.now()
  };
}

let gameState =
  createState();

// ========================
// RESET PLAYERS
// ========================

function clearPlayers() {

  for (
    let [id, socket]
    of io.of("/").sockets
  ) {

    socket.player = null;
  }
}

// ========================
// FIND USER
// ========================

function findUserBySocket(
  socketId
) {

  return gameState.users.find(
    (u) => u.id === socketId
  );
}

// ========================
// FETCH TETRIO USER
// ========================

async function fetchTetrioUser(
  username
) {

  try {

    const lower =
      username
        .trim()
        .toLowerCase();

    // USER API

    const userResponse =
      await fetch(
        `https://ch.tetr.io/api/users/${lower}`
      );

    const userJson =
      await userResponse.json();

    if (
      !userJson.success
    ) {

      return null;
    }

    const user =
      userJson.data;

    // LEAGUE API

    let leagueRank =
      "UNRANKED";

    try {

      const leagueResponse =
        await fetch(
          `https://ch.tetr.io/api/users/${lower}/summaries/league`
        );

      const leagueJson =
        await leagueResponse.json();

      if (
        leagueJson.success &&
        leagueJson.data
      ) {

        const rank =
          leagueJson
            .data
            .rank;

        if (
          rank &&
          rank !== "z"
        ) {

          leagueRank =
            rank.toUpperCase();
        }
      }

    } catch (err) {

      console.log(
        "league api fail"
      );
    }

    // AVATAR

    let avatar =
      "https://tetr.io/res/avatar.png";

    if (
      user.avatar_revision
    ) {

      avatar =
        `https://tetr.io/user-content/avatars/${user._id}.jpg?rv=${user.avatar_revision}`;
    }

    return {

      tetrioId:
        user._id,

      name:
        user.username,

      rank:
        leagueRank,

      avatar
    };

  } catch (err) {

    console.error(err);

    return null;
  }
}

// ========================
// CONNECTION
// ========================

io.on(
  "connection",

  (socket) => {

    socket.isAdmin =
      false;

    socket.emit(
      "update",
      gameState
    );

    // ========================
    // JOIN
    // ========================

    socket.on(
      "join",

      async ({ name }) => {

        const already =
          gameState.users.find(
            (u) =>
              u.name
                .toLowerCase() ===
              name
                .toLowerCase()
          );

        if (already) {

          socket.emit(
            "joinFail",
            "이미 접속중인 유저입니다."
          );

          return;
        }

        const tetrioUser =
          await fetchTetrioUser(
            name
          );

        if (
          !tetrioUser
        ) {

          socket.emit(
            "joinFail",
            "존재하지 않는 TETR.IO 유저입니다."
          );

          return;
        }

        // 저장

        socket.name =
          tetrioUser.name;

        socket.tetrioId =
          tetrioUser.tetrioId;

        gameState.users.push({

          id: socket.id,

          tetrioId:
            tetrioUser.tetrioId,

          name:
            tetrioUser.name,

          rank:
            tetrioUser.rank,

          avatar:
            tetrioUser.avatar
        });

        socket.emit(
          "joinSuccess"
        );

        io.emit(
          "update",
          gameState
        );
      }
    );

    // ========================
    // ADMIN LOGIN
    // ========================

    socket.on(
      "adminLogin",

      (password) => {

        const allowed =

          ADMIN_IDS.includes(
            socket.tetrioId
          );

        if (
          allowed &&
          password ===
          ADMIN_PASSWORD
        ) {

          socket.isAdmin =
            true;

          socket.emit(
            "adminSuccess"
          );

          console.log(
            socket.name +
            " admin login"
          );
        }
      }
    );

    // ========================
    // TAKE SLOT
    // ========================

    socket.on(
      "takeSlot",

      (slot) => {

        if (
          socket.player
        ) return;

        if (
          !gameState
            .slots[slot]
        ) {

          gameState
            .slots[slot] =
              socket.id;

          socket.player =
            slot;
        }

        io.emit(
          "update",
          gameState
        );
      }
    );

    // ========================
    // LEAVE SLOT
    // ========================

    socket.on(
      "leaveSlot",

      () => {

        if (
          !socket.player
        ) return;

        const p =
          socket.player;

        gameState
          .slots[p] =
            null;

        gameState
          .ready[p] =
            false;

        socket.player =
          null;

        io.emit(
          "update",
          gameState
        );
      }
    );

    // ========================
    // READY
    // ========================

    socket.on(
      "toggleReady",

      () => {

        if (
          !socket.player
        ) return;

        const p =
          socket.player;

        gameState
          .ready[p] =

          !gameState
            .ready[p];

        // START

        if (

          gameState.ready.A &&

          gameState.ready.B

        ) {

          const userA =
            findUserBySocket(
              gameState.slots.A
            );

          const userB =
            findUserBySocket(
              gameState.slots.B
            );

          // TOTAL

          gameState.totalTime.A =
            getTotalTime(
              userA?.rank
            );

          gameState.totalTime.B =
            getTotalTime(
              userB?.rank
            );

          // TURN

          gameState.turnTime.A =
            getTurnTime(
              userA?.rank
            );

          gameState.turnTime.B =
            getTurnTime(
              userB?.rank
            );

          gameState.currentPlayer =
            "A";

          gameState.phase =
            "PLAYING";

          gameState.lastUpdate =
            Date.now();
        }

        io.emit(
          "update",
          gameState
        );
      }
    );

    // ========================
    // TURN
    // ========================

    socket.on(
      "toggleTurn",

      () => {

        if (
          gameState.phase !==
          "PLAYING"
        ) return;

        if (
          socket.player !==
          gameState.currentPlayer
        ) return;

        gameState.currentPlayer =

          gameState
            .currentPlayer ===
          "A"

            ? "B"

            : "A";

        const currentUser =
          findUserBySocket(

            gameState.slots[
              gameState
                .currentPlayer
            ]
          );

        gameState.turnTime[
          gameState.currentPlayer
        ] =
          getTurnTime(
            currentUser?.rank
          );

        gameState.lastUpdate =
          Date.now();

        io.emit(
          "update",
          gameState
        );
      }
    );

    // ========================
    // ADMIN END GAME
    // ========================

    socket.on(
      "adminEndGame",

      () => {

        if (
          !socket.isAdmin
        ) return;

        const users =
          gameState.users;

        clearPlayers();

        gameState =
          createState(users);

        io.emit(
          "adminGameEnded"
        );

        io.emit(
          "update",
          gameState
        );

        console.log(
          socket.name +
          " force ended game"
        );
      }
    );

    // ========================
    // ADMIN KICK SLOT
    // ========================

    socket.on(
      "adminKickSlot",

      (slot) => {

        if (
          !socket.isAdmin
        ) return;

        const targetId =
          gameState.slots[slot];

        if (!targetId) return;

        const target =
          io.sockets.sockets.get(
            targetId
          );

        if (!target) return;

        target.player =
          null;

        gameState.slots[slot] =
          null;

        gameState.ready[slot] =
          false;

        io.emit(
          "update",
          gameState
        );

        console.log(
          socket.name +
          " kicked slot " +
          slot
        );
      }
    );

    // ========================
    // ADMIN NEXT TURN
    // ========================

    socket.on(
      "adminNextTurn",

      () => {

        if (
          !socket.isAdmin
        ) return;

        if (
          gameState.phase !==
          "PLAYING"
        ) return;

        gameState.currentPlayer =

          gameState
            .currentPlayer ===
          "A"

            ? "B"

            : "A";

        const currentUser =
          findUserBySocket(

            gameState.slots[
              gameState
                .currentPlayer
            ]
          );

        gameState.turnTime[
          gameState.currentPlayer
        ] =
          getTurnTime(
            currentUser?.rank
          );

        gameState.lastUpdate =
          Date.now();

        io.emit(
          "update",
          gameState
        );
      }
    );

    // ========================
    // DISCONNECT
    // ========================

    socket.on(
      "disconnect",

      () => {

        gameState.users =

          gameState.users.filter(
            (u) =>
              u.id !==
              socket.id
          );

        if (
          socket.player
        ) {

          gameState.slots[
            socket.player
          ] = null;

          gameState.ready[
            socket.player
          ] = false;
        }

        io.emit(
          "update",
          gameState
        );
      }
    );
  }
);

// ========================
// TIMER
// ========================

setInterval(() => {

  if (
    gameState.phase !==
    "PLAYING"
  ) return;

  const now =
    Date.now();

  const delta =

    (
      now -
      gameState.lastUpdate
    ) / 1000;

  gameState.lastUpdate =
    now;

  const current =
    gameState.currentPlayer;

  // TURN

  gameState.turnTime[
    current
  ] -= delta;

  // TOTAL

  gameState.totalTime[
    current
  ] -= delta;

  // TURN LOSE

  if (
    gameState.turnTime[
      current
    ] <= 0
  ) {

    const loser =
      current;

    const users =
      gameState.users;

    clearPlayers();

    gameState =
      createState(users);

    io.emit(
      "timeout",
      loser
    );

    io.emit(
      "update",
      gameState
    );

    return;
  }

  // TOTAL LOSE

  if (

    gameState.totalTime[
      current
    ] <= 0

  ) {

    const loser =
      current;

    const users =
      gameState.users;

    clearPlayers();

    gameState =
      createState(users);

    io.emit(
      "gameOver",
      loser
    );

    io.emit(
      "update",
      gameState
    );

    return;
  }

  io.emit(
    "update",
    gameState
  );

}, 100);

// ========================
// START
// ========================

const PORT =
  process.env.PORT || 3000;

server.listen(
  PORT,

  () => {

    console.log(
      `server running on ${PORT}`
    );
  }
);