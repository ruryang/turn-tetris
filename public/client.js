const socket = io();

let state = null;

let joined = false;

let turnCooldown = false;

let isAdmin = false;

let adminCooldown = false;

// ========================
// SANITIZE
// ========================

function sanitize(str) {

  return String(str || "")
    .replace(/[<>&"'`]/g, "");
}

// ========================
// ELEMENT
// ========================

const turnTop =
  document.getElementById("turnTop");

// ========================
// ADMIN PANEL
// ========================

function createAdminPanel() {

  const panel =
    document.createElement("div");

  panel.id =
    "adminPanel";

  panel.style.display =
    "none";

  panel.style.position =
    "fixed";

  panel.style.top =
    "50%";

  panel.style.left =
    "50%";

  panel.style.transform =
    "translate(-50%, -50%)";

  panel.style.background =
    "rgba(0,0,0,0.95)";

  panel.style.padding =
    "30px";

  panel.style.borderRadius =
    "20px";

  panel.style.zIndex =
    "9999";

  panel.style.boxShadow =
    "0 0 40px rgba(0,255,204,0.4)";

  panel.innerHTML = `

    <div style="
      font-size:28px;
      font-weight:bold;
      margin-bottom:20px;
      color:#00ffcc;
    ">
      ADMIN PANEL
    </div>

    <div style="
      display:flex;
      flex-direction:column;
      gap:12px;
    ">

      <button onclick="adminEndGame()">
        강제 종료
      </button>

      <button onclick="adminKick('A')">
        A 추방
      </button>

      <button onclick="adminKick('B')">
        B 추방
      </button>

      <button onclick="adminNextTurn()">
        턴 넘기기
      </button>

    </div>
  `;

  document.body.appendChild(
    panel
  );
}

createAdminPanel();

// ========================
// ADMIN HOTKEY
// ========================

window.addEventListener(
  "keydown",

  (e) => {

    if (

      e.shiftKey &&

      e.key.toLowerCase() ===
      "a"

    ) {

      if (isAdmin) {

        toggleAdminPanel();

        return;
      }

      const password =
        prompt(
          "ADMIN PASSWORD"
        );

      if (!password) return;

      socket.emit(
        "adminLogin",
        password
      );
    }

    if (
      e.key === "Escape"
    ) {

      closeAdminPanel();
    }
  }
);

// ========================
// ADMIN PANEL CONTROL
// ========================

function toggleAdminPanel() {

  const panel =
    document.getElementById(
      "adminPanel"
    );

  if (
    panel.style.display ===
    "none"
  ) {

    panel.style.display =
      "block";

  } else {

    panel.style.display =
      "none";
  }
}

function closeAdminPanel() {

  const panel =
    document.getElementById(
      "adminPanel"
    );

  panel.style.display =
    "none";
}

// ========================
// ADMIN ACTION
// ========================

window.adminEndGame =
  () => {

    if (adminCooldown)
      return;

    adminCooldown = true;

    socket.emit(
      "adminEndGame"
    );

    setTimeout(() => {

      adminCooldown = false;

    }, 1000);
  };

window.adminKick =
  (slot) => {

    if (adminCooldown)
      return;

    adminCooldown = true;

    socket.emit(
      "adminKickSlot",
      slot
    );

    setTimeout(() => {

      adminCooldown = false;

    }, 1000);
  };

window.adminNextTurn =
  () => {

    if (adminCooldown)
      return;

    adminCooldown = true;

    socket.emit(
      "adminNextTurn"
    );

    setTimeout(() => {

      adminCooldown = false;

    }, 500);
  };

// ========================
// ADMIN RESULT
// ========================

socket.on(
  "adminSuccess",

  () => {

    isAdmin = true;

    alert(
      "관리자 로그인 성공"
    );

    toggleAdminPanel();
  }
);

socket.on(
  "adminGameEnded",

  () => {

    alert(
      "관리자가 게임을 종료했습니다."
    );
  }
);

// ========================
// RANK COLOR
// ========================

function getRankClass(rank) {

  rank = String(rank || "")
    .toLowerCase();

  switch (rank) {

    case "x+":
      return "rank-xplus";

    case "x":
      return "rank-x";

    case "u":
      return "rank-u";

    case "ss":
      return "rank-ss";

    case "s+":
      return "rank-splus";

    case "s":
      return "rank-s";

    case "a+":
      return "rank-aplus";

    case "a":
      return "rank-a";

    case "a-": 
      return "rank-aminus";

    case "b+":
      return "rank-bplus";

    case "b":
      return "rank-b";

    case "b-": 
      return "rank-bminus";

    case "c+":
      return "rank-cplus";
    case "c":
      return "rank-c";
    case "c-":
      return "rank-cminus";

    case "d+":
      return "rank-dplus";
    case "d":
      return "rank-d";

    case "z":
      return "rank-z";

    case "unranked":
      return "rank-unranked";

    default:
      return "rank-default";
  }
}

// ========================
// FIND USER
// ========================

function findUserById(id) {

  if (!state) return null;

  return state.users.find(
    (u) => u.id === id
  );
}

// ========================
// SAFE AVATAR
// ========================

function getAvatar(user) {

  if (!user) {
    return "default.png";
  }

  if (!user.avatar) {
    return "default.png";
  }

  return user.avatar;
}

// ========================
// USER HTML
// ========================

function createUserHTML(user) {

  if (!user) {

    return `
      <div class="empty-slot">
        EMPTY
      </div>
    `;
  }

  const rankClass =
    getRankClass(user.rank);

  return `

    <div class="user-display">

      <img
        class="avatar"
        src="${getAvatar(user)}"
        onerror="this.src='default.png'"
      >

      <div class="user-info">

        <div class="user-name">
          ${sanitize(user.name)}
        </div>

        <div class="
          rank
          ${rankClass}
        ">
          [${sanitize(
            user.rank || "UNRANKED"
          )}]
        </div>

      </div>

    </div>
  `;
}

// ========================
// JOIN
// ========================

window.join = () => {

  const name =

    document
      .getElementById("nameInput")
      .value
      .trim();

  if (!name) {

    alert("닉네임 입력");

    return;
  }

  if (name.length > 20) {

    alert(
      "닉네임이 너무 깁니다."
    );

    return;
  }

  const valid =
    /^[a-zA-Z0-9_]+$/;

  if (!valid.test(name)) {

    alert(
      "영문, 숫자, _ 만 가능합니다."
    );

    return;
  }

  socket.emit("join", {
    name
  });
};

// ========================
// SLOT
// ========================

window.takeOrLeave = (slot) => {

  if (!state) return;

  if (
    state.slots[slot] === socket.id
  ) {

    socket.emit("leaveSlot");

  } else {

    socket.emit(
      "takeSlot",
      slot
    );
  }
};

// ========================
// READY
// ========================

window.toggleReady = () => {

  if (!state) return;

  socket.emit(
    "toggleReady"
  );
};

// ========================
// TURN
// ========================

window.turn = () => {

  if (!state) return;

  if (
    state.phase !== "PLAYING"
  ) return;

  if (turnCooldown) return;

  const isMyTurn =

    (
      state.currentPlayer === "A" &&
      state.slots.A === socket.id
    ) ||

    (
      state.currentPlayer === "B" &&
      state.slots.B === socket.id
    );

  if (!isMyTurn) return;

  turnCooldown = true;

  socket.emit("toggleTurn");

  setTimeout(() => {

    turnCooldown = false;

  }, 200);
};

// ========================
// JOIN SUCCESS
// ========================

socket.on(
  "joinSuccess",

  () => {

    joined = true;

    document
      .getElementById("joinScreen")
      .style.display = "none";

    document
      .getElementById("lobby")
      .style.display = "block";
  }
);

// ========================
// JOIN FAIL
// ========================

socket.on(
  "joinFail",

  (msg) => {

    alert(
      sanitize(
        msg ||
        "존재하지 않는 TETR.IO 유저입니다."
      )
    );
  }
);

// ========================
// UPDATE
// ========================

socket.on(
  "update",

  (data) => {

    state = data;

    if (!joined) return;

    document
      .getElementById("lobby")
      .style.display =

      data.phase === "LOBBY"
        ? "block"
        : "none";

    document
      .getElementById("game")
      .style.display =

      data.phase === "PLAYING"
        ? "block"
        : "none";

    document
      .getElementById("userList")
      .innerHTML =

      data.users.map((u) => {

        return `

          <div class="user-list-item">

            <img
              class="mini-avatar"
              src="${getAvatar(u)}"
              onerror="this.src='default.png'"
            >

            <span>
              ${sanitize(u.name)}
            </span>

            <span class="
              rank
              ${getRankClass(u.rank)}
            ">
              [${sanitize(
                u.rank || "UNRANKED"
              )}]
            </span>

          </div>
        `;

      }).join("");

    const userA =
      findUserById(data.slots.A);

    const userB =
      findUserById(data.slots.B);

    document
      .getElementById("slotA")
      .innerHTML =
      createUserHTML(userA);

    document
      .getElementById("slotB")
      .innerHTML =
      createUserHTML(userB);

    const cardA =
      document.getElementById("cardA");

    const cardB =
      document.getElementById("cardB");

    cardA.classList.remove("ready");
    cardB.classList.remove("ready");

    if (data.ready.A) {
      cardA.classList.add("ready");
    }

    if (data.ready.B) {
      cardB.classList.add("ready");
    }

    document
      .getElementById("status")
      .textContent =

      `A: ${
        data.ready.A
          ? "READY"
          : "WAIT"
      } | B: ${
        data.ready.B
          ? "READY"
          : "WAIT"
      }`;

    const spectators =

      data.users.length -

      (data.slots.A ? 1 : 0) -

      (data.slots.B ? 1 : 0);

    document
      .getElementById("spectatorInfo")
      .textContent =

      `SPECTATORS: ${spectators}`;
  }
);

// ========================
// GAME LOOP
// ========================

setInterval(() => {

  if (!state) return;

  if (
    state.phase !== "PLAYING"
  ) return;

  const sideA =
    document.getElementById("sideA");

  const sideB =
    document.getElementById("sideB");

  const timerEl =
    document.getElementById("timer");

  const userA =
    findUserById(state.slots.A);

  const userB =
    findUserById(state.slots.B);

  document
    .getElementById("nameA")
    .textContent =

    userA
      ? sanitize(userA.name)
      : "-";

  document
    .getElementById("nameB")
    .textContent =

    userB
      ? sanitize(userB.name)
      : "-";

  document
    .getElementById("avatarA")
    .src =
      getAvatar(userA);

  document
    .getElementById("avatarB")
    .src =
      getAvatar(userB);

  const currentName =

    state.currentPlayer === "A"
      ? userA?.name
      : userB?.name;

  document
    .getElementById("turn")
    .textContent =

    "TURN: " +
    sanitize(currentName);

  turnTop.textContent =
    sanitize(currentName)
    + " TURN";

  const timeLeft =
    Math.ceil(

      state.turnTime[
        state.currentPlayer
      ]

    );

  timerEl.textContent =
    timeLeft;

  timerEl.classList.remove(
    "danger-timer"
  );

  sideA.classList.remove(
    "active-player",
    "danger-player"
  );

  sideB.classList.remove(
    "active-player",
    "danger-player"
  );

  if (
    state.currentPlayer === "A"
  ) {

    sideA.classList.add(
      "active-player"
    );

  } else {

    sideB.classList.add(
      "active-player"
    );
  }

  if (timeLeft <= 10) {

    timerEl.classList.add(
      "danger-timer"
    );

    if (
      state.currentPlayer === "A"
    ) {

      sideA.classList.add(
        "danger-player"
      );

    } else {

      sideB.classList.add(
        "danger-player"
      );
    }
  }

  document
    .getElementById("totalA")
    .textContent =

    Math.ceil(
      state.totalTime.A
    );

  document
    .getElementById("totalB")
    .textContent =

    Math.ceil(
      state.totalTime.B
    );

  const max = 1200;

  document
    .getElementById("hpA")
    .style.width =

    (
      state.totalTime.A
      / max
    ) * 100 + "%";

  document
    .getElementById("hpB")
    .style.width =

    (
      state.totalTime.B
      / max
    ) * 100 + "%";

}, 100);

// ========================
// RESULT
// ========================

socket.on(
  "timeout",

  (player) => {

    alert(
      sanitize(player) +
      " 턴 시간 패배!"
    );
  }
);

socket.on(
  "gameOver",

  (player) => {

    alert(
      sanitize(player) +
      " 총 시간 패배!"
    );
  }
);