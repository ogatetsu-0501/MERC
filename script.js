/************************************************************
 * 1) 祈り計算:
 *    - 現在GPが変わったらギルド出撃側にも即時反映
 *    - 祈りコンボ計算
 ************************************************************/

// 応援コンボを保持するためのオブジェクト
const ouenComboMap = { g1: 0, g2: 0, g3: 0, g4: 0 };

/**
 * すべての「ギルド現在GP」(祈り計算用)のoninputを設定し、
 * 入力時にギルド情報の現在GP (gp-gX) へ反映
 */
window.addEventListener("DOMContentLoaded", () => {
  // Guild1
  const g1cur = document.getElementById("g1-currentGP");
  if (g1cur) {
    g1cur.addEventListener("input", () => {
      document.getElementById("gp-g1").value = g1cur.value;
    });
  }
  // Guild2
  const g2cur = document.getElementById("g2-currentGP");
  if (g2cur) {
    g2cur.addEventListener("input", () => {
      document.getElementById("gp-g2").value = g2cur.value;
    });
  }
  // Guild3
  const g3cur = document.getElementById("g3-currentGP");
  if (g3cur) {
    g3cur.addEventListener("input", () => {
      document.getElementById("gp-g3").value = g3cur.value;
    });
  }
  // Guild4
  const g4cur = document.getElementById("g4-currentGP");
  if (g4cur) {
    g4cur.addEventListener("input", () => {
      document.getElementById("gp-g4").value = g4cur.value;
    });
  }
});

/** 「祈り計算」ボタン */
function calculateAll() {
  calcInori("g1");
  calcInori("g2");
  calcInori("g3");
  calcInori("g4");
}

/**
 * ギルドごとの祈り計算
 */
function calcInori(gid) {
  const currentGP = +document.getElementById(`${gid}-currentGP`).value;
  const inoriVal = +document.getElementById(`${gid}-inori`).value;
  const ouenType = document.getElementById(`${gid}-ouenType`).value;
  const deSyutsuGp = +document.getElementById(`${gid}-deSyutsuGp`).value;

  // 応援タイプ
  let ouenGP, ouenCombo;
  if (ouenType === "1combo") {
    ouenGP = 501000;
    ouenCombo = 1;
  } else {
    ouenGP = 1000500;
    ouenCombo = 1000;
  }

  // 祈りGP = 現在GP - 応援GP - 出撃獲得GP
  const prayerGP = currentGP - ouenGP - deSyutsuGp;

  // 祈り値から コンボ算出
  const memberCombo = inoriVal / 5;
  const leaderCombo = inoriVal / 6.5;

  // GP祈りコンボ数
  let currentCombo = ouenCombo;
  let total = 0;
  while (true) {
    const add = 400 * (1 + 0.002 * currentCombo);
    if (total + add > prayerGP) {
      break;
    }
    total += add;
    currentCombo++;
  }
  const gpInoriCombo = Math.max(0, currentCombo - 1 - ouenCombo);

  // 表示
  document.getElementById(`${gid}-result`).style.display = "block";
  document.getElementById(`${gid}-prayerGP`).textContent = `祈りGP: ${
    prayerGP < 0 ? prayerGP + " (マイナス!?)" : prayerGP
  }`;
  document.getElementById(
    `${gid}-memberCombo`
  ).textContent = `メンバーコンボ数: ${memberCombo.toFixed(2)}`;
  document.getElementById(
    `${gid}-gpInoriCombo`
  ).textContent = `GP祈りコンボ数: ${gpInoriCombo}`;
  document.getElementById(
    `${gid}-leaderCombo`
  ).textContent = `リーダーコンボ数: ${leaderCombo.toFixed(2)}`;

  // 祈りコンボ入力欄を初期化
  const inoriInputEl = document.getElementById(`${gid}-inoriInput`);
  inoriInputEl.value = gpInoriCombo;

  // 応援コンボを覚えておく
  ouenComboMap[gid] = ouenCombo;

  // 最終コンボ = 応援コンボ + 祈りコンボ
  const finalComboNum = ouenCombo + gpInoriCombo;
  document.getElementById(`${gid}-finalCombo`).textContent = finalComboNum;

  // 上部ギルド情報「最終コンボ数」に反映
  const comboBox = document.getElementById(`combo-${gid}`);
  if (comboBox) {
    comboBox.value = finalComboNum;
  }

  // 祈りコンボ入力が変わったら再計算
  inoriInputEl.oninput = function () {
    const changedVal = +inoriInputEl.value;
    const newFinal = ouenComboMap[gid] + changedVal;
    document.getElementById(`${gid}-finalCombo`).textContent = newFinal;
    if (comboBox) {
      comboBox.value = newFinal;
    }
  };
}

/************************************************************
 * 2) ギルド出撃タイムライン・最終計算
 ************************************************************/

// ギルドごとの出撃カウンター
const commandCounter = { g1: 1, g2: 1, g3: 1, g4: 1 };

// ギルド色
const guildColorClass = {
  g1: "guild1",
  g2: "guild2",
  g3: "guild3",
  g4: "guild4",
};

// 出撃コマンドペア一覧
const commandPairs = [];
// 出撃中計算を一時保持
const pendingActions = {};

// ドラッグ用
let dragSrcEl = null;

/** DOMContentLoadedで出撃追加ボタンにリスナー */
window.addEventListener("DOMContentLoaded", () => {
  const addBtn = document.getElementById("addAttackBtn");
  if (addBtn) {
    addBtn.addEventListener("click", onAddAttack);
  }
});

/** 出撃コマンド追加 */
function onAddAttack(e) {
  e.preventDefault();
  const guild = document.getElementById("selectGuild").value;
  const role = document.getElementById("selectRole").value;

  const checks = document.querySelectorAll(".chk-target");
  let targets = [];
  for (let c of checks) {
    if (c.checked) {
      targets.push(c.value);
    }
  }
  targets = targets.filter((t) => t !== guild);
  if (targets.length > 3) {
    alert("ターゲットは最大3つまで。");
    return;
  }
  if (targets.length === 0) {
    alert("ターゲットが選択されていません。");
    return;
  }

  const timeB = +document.getElementById("tbAttack").value || 0;

  const curCount = commandCounter[guild];
  const pairId = guild + "_" + curCount;
  commandCounter[guild] = curCount + 1;

  const startId = pairId + "_start";
  const endId = pairId + "_end";

  commandPairs.push({
    pairId,
    guild,
    role,
    targets,
    timeBonus: timeB,
    startCmdId: startId,
    endCmdId: endId,
  });

  addCommandCard(
    startId,
    guild,
    `出撃 (${role === "leader" ? "リーダー" : "メンバー"}) [${pairId}]`,
    guildColorClass[guild]
  );
  addCommandCard(
    endId,
    guild,
    `終了 (${role === "leader" ? "リーダー" : "メンバー"}) [${pairId}]`,
    guildColorClass[guild]
  );

  for (let c of checks) {
    c.checked = false;
  }
  document.getElementById("tbAttack").value = 0;
}

/** カード生成 */
function addCommandCard(cmdId, guild, label, cssClass) {
  const list = document.getElementById("commandList");
  if (!list) return;

  const li = document.createElement("li");
  li.id = cmdId;
  li.className = "command-item " + cssClass;
  li.draggable = true;

  const sp = document.createElement("span");
  sp.className = "command-label";
  sp.textContent = `Guild${guild.slice(1)} ${label}`;
  li.appendChild(sp);

  li.addEventListener("dragstart", handleDragStart);
  li.addEventListener("dragover", handleDragOver);
  li.addEventListener("dragleave", handleDragLeave);
  li.addEventListener("drop", handleDrop);
  li.addEventListener("dragend", handleDragEnd);

  list.appendChild(li);
}

/** D&D */
function handleDragStart(e) {
  dragSrcEl = this;
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/html", this.innerHTML);
}
function handleDragOver(e) {
  if (e.preventDefault) e.preventDefault();
  return false;
}
function handleDragLeave(e) {}
function handleDrop(e) {
  if (e.stopPropagation) e.stopPropagation();
  if (dragSrcEl !== this) {
    const list = this.parentNode;
    const from = Array.prototype.indexOf.call(list.children, dragSrcEl);
    const to = Array.prototype.indexOf.call(list.children, this);
    if (from < to) {
      list.insertBefore(dragSrcEl, this.nextSibling);
    } else {
      list.insertBefore(dragSrcEl, this);
    }
  }
  return false;
}
function handleDragEnd(e) {}

/** 最終計算 */
function calculateFinal() {
  const gp = {
    g1: +document.getElementById("gp-g1").value,
    g2: +document.getElementById("gp-g2").value,
    g3: +document.getElementById("gp-g3").value,
    g4: +document.getElementById("gp-g4").value,
    gate: +document.getElementById("gp-gate").value,
  };
  const combo = {
    g1: +document.getElementById("combo-g1").value,
    g2: +document.getElementById("combo-g2").value,
    g3: +document.getElementById("combo-g3").value,
    g4: +document.getElementById("combo-g4").value,
    gate: +document.getElementById("combo-gate").value,
  };

  for (const k in pendingActions) {
    delete pendingActions[k];
  }

  console.log("=== 最終計算開始 ===");
  console.log(
    `初期GP => G1:${gp.g1}/G2:${gp.g2}/G3:${gp.g3}/G4:${gp.g4}/Gate:${gp.gate}`
  );

  const list = document.getElementById("commandList");
  if (!list) return;
  const items = list.querySelectorAll("li");

  items.forEach((li) => {
    const cmdId = li.id;
    const pairId = cmdId.replace("_start", "").replace("_end", "");
    const pairData = commandPairs.find((p) => p.pairId === pairId);
    if (!pairData) return;

    const isStart = cmdId.endsWith("_start");
    const isEnd = cmdId.endsWith("_end");
    const guild = pairData.guild;
    const role = pairData.role;
    const targets = pairData.targets;
    const timeB = pairData.timeBonus || 0;

    if (isStart) {
      const rate = role === "leader" ? 0.025 : 0.01;
      let totalSoudatsu = 0;
      let detailSoudatsu = {};

      console.log(
        `[出撃:${cmdId}] pairId:${pairId}, Guild:${guild}, role:${role}, timeBonus:${timeB}%`
      );

      targets.forEach((t) => {
        if (gp[t] !== undefined && t !== guild) {
          const d = Math.floor(gp[t] * rate);
          detailSoudatsu[t] = d;
          totalSoudatsu += d;
        }
      });
      const base = 4000 * (1 + 0.002 * combo[guild]);
      const gain = (base + totalSoudatsu) * (1 + timeB / 100);
      const floorGain = Math.floor(gain);

      pendingActions[pairId] = {
        detailSoudatsu,
        totalSoudatsu,
        gain: floorGain,
      };
      console.log(`  => 争奪GP:${totalSoudatsu}, 獲得GP:${floorGain}`);
    } else if (isEnd) {
      const pa = pendingActions[pairId];
      if (pa) {
        console.log(`[終了:${cmdId}] pairId:${pairId}, Guild:${guild}`);
        console.log(
          `  反映前 => G1:${gp.g1}/G2:${gp.g2}/G3:${gp.g3}/G4:${gp.g4}/Gate:${gp.gate}`
        );

        for (const t in pa.detailSoudatsu) {
          if (t !== "gate" && t !== guild) {
            gp[t] -= pa.detailSoudatsu[t];
            if (gp[t] < 0) gp[t] = 0;
          }
        }
        gp[guild] += pa.gain;

        console.log(
          `  反映後 => G1:${gp.g1}/G2:${gp.g2}/G3:${gp.g3}/G4:${gp.g4}/Gate:${gp.gate}`
        );
        delete pendingActions[pairId];
      }
    }
  });

  // 表示
  document.getElementById("result-g1").textContent = gp.g1;
  document.getElementById("result-g2").textContent = gp.g2;
  document.getElementById("result-g3").textContent = gp.g3;
  document.getElementById("result-g4").textContent = gp.g4;
  document.getElementById("result-gate").textContent = gp.gate;
}
