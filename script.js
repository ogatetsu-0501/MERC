/************************************************************
 * (A) 祈り計算 + ゲート計算
 ************************************************************/

// 応援コンボ(1 or 1000)
const ouenComboMap = { g1: 0, g2: 0, g3: 0, g4: 0 };
// 各ギルドのGP祈りコンボ数(ユーザが inoriInput を調整可)
const gpInoriComboMap = { g1: 0, g2: 0, g3: 0, g4: 0 };

window.addEventListener("DOMContentLoaded", () => {
  // 各ギルドの祈り入力にイベントを付与
  ["g1", "g2", "g3", "g4"].forEach((gid) => {
    const curGp = document.getElementById(`${gid}-currentGP`);
    const inori = document.getElementById(`${gid}-inori`);
    const ouenSel = document.getElementById(`${gid}-ouenType`);
    const deSyGp = document.getElementById(`${gid}-deSyutsuGp`);

    if (curGp) curGp.addEventListener("input", () => calcInori(gid));
    if (inori) inori.addEventListener("input", () => calcInori(gid));
    if (ouenSel) ouenSel.addEventListener("change", () => calcInori(gid));
    if (deSyGp) deSyGp.addEventListener("input", () => calcInori(gid));
  });

  // 出撃コマンドシステム初期化
  initGuildBattleSystem();

  // 最初に一度呼び出し
  calcInori("g1");
  calcInori("g2");
  calcInori("g3");
  calcInori("g4");

  // ギルド選択変更で自ギルドターゲット無効化
  const selGuild = document.getElementById("selectGuild");
  if (selGuild) {
    selGuild.addEventListener("change", disableSelfGuildTarget);
    disableSelfGuildTarget();
  }
});

/** ギルド選択 => 自ギルドターゲットを選べないようにする */
function disableSelfGuildTarget() {
  const selectedGuild = document.getElementById("selectGuild").value; // "g1","g2",...
  const checks = document.querySelectorAll(".chk-target");
  checks.forEach((chk) => {
    if (chk.value === selectedGuild) {
      chk.disabled = true;
      chk.checked = false; // 必要ならチェック外す
    } else {
      chk.disabled = false;
    }
  });
}

/** 1ギルド分の祈り計算 => ゲート計算 & 出撃計算 */
function calcInori(gid) {
  const curGP = +document.getElementById(`${gid}-currentGP`).value;
  const inori = +document.getElementById(`${gid}-inori`).value;
  const ouenVal = document.getElementById(`${gid}-ouenType`).value; // "1combo" or "normal"
  const deGp = +document.getElementById(`${gid}-deSyutsuGp`).value;

  // 応援タイプ
  let ouenGP, ouenCombo;
  if (ouenVal === "1combo") {
    ouenGP = 501000;
    ouenCombo = 1;
  } else {
    ouenGP = 1000500;
    ouenCombo = 1000;
  }
  ouenComboMap[gid] = ouenCombo;

  // 祈りGP
  const prayerGP = curGP - ouenGP - deGp;
  // メンバー＆リーダーコンボ
  const memberCombo = inori / 5;
  const leaderCombo = inori / 6.5;

  // GP祈りコンボ数（標準）
  let cCombo = ouenCombo;
  let total = 0;
  while (true) {
    const add = 400 * (1 + 0.002 * cCombo);
    if (total + add > prayerGP) break;
    total += add;
    cCombo++;
  }
  const defaultGpInori = Math.max(0, cCombo - 1 - ouenCombo);

  // 表示
  document.getElementById(`${gid}-result`).style.display = "block";
  document.getElementById(`${gid}-prayerGP`).textContent = `祈りGP: ${
    prayerGP < 0 ? prayerGP + " (マイナス!?)" : prayerGP
  }`;
  document.getElementById(
    `${gid}-memberCombo`
  ).textContent = `メンバーコンボ数: ${memberCombo.toFixed(2)}`;
  document.getElementById(
    `${gid}-leaderCombo`
  ).textContent = `リーダーコンボ数: ${leaderCombo.toFixed(2)}`;
  document.getElementById(
    `${gid}-gpInoriCombo`
  ).textContent = `GP祈りコンボ数: ${defaultGpInori}`;

  // inoriInputにデフォ値をセット
  const inoriInputEl = document.getElementById(`${gid}-inoriInput`);
  inoriInputEl.value = defaultGpInori;
  gpInoriComboMap[gid] = defaultGpInori;

  // 最終コンボ数
  let finalC = ouenCombo + defaultGpInori;
  document.getElementById(`${gid}-finalCombo`).textContent = finalC;

  // 下部ギルド情報に反映
  document.getElementById(`display-${gid}-gp`).textContent = curGP.toString();
  document.getElementById(`display-${gid}-combo`).textContent =
    finalC.toString();

  // ユーザが 祈りコンボ入力を上書き => リアルタイム再計算
  inoriInputEl.oninput = function () {
    const changedVal = +inoriInputEl.value;
    gpInoriComboMap[gid] = changedVal;

    const newFinal = ouenComboMap[gid] + changedVal;
    document.getElementById(`${gid}-finalCombo`).textContent = newFinal;
    document.getElementById(`display-${gid}-combo`).textContent =
      newFinal.toString();

    // Gate & 出撃再計算
    calcGate();
    recalcBattle();
  };

  // ゲート計算 + 出撃計算
  calcGate();
  recalcBattle();
}

/** ゲート計算: Gate最終コンボ数=4ギルド合計, GateGP=初期コンボ=1~(gateCombo-1)回 */
function calcGate() {
  let gateCombo = 0;
  ["g1", "g2", "g3", "g4"].forEach((gid) => {
    gateCombo += gpInoriComboMap[gid];
  });

  let gateGP = 0;
  for (let c = 1; c < gateCombo; c++) {
    const add = 400 * (1 + 0.002 * c);
    gateGP += add;
  }
  gateGP = Math.floor(gateGP);

  // 下部表示に反映
  document.getElementById("display-gate-combo").textContent =
    gateCombo.toString();
  document.getElementById("display-gate-gp").textContent = gateGP.toString();
}

/************************************************************
 * (B) 出撃コマンド
 ************************************************************/

// ★ guildColorClass をここで定義 ★
const guildColorClass = {
  g1: "guild1",
  g2: "guild2",
  g3: "guild3",
  g4: "guild4",
};

const commandCounter = { g1: 1, g2: 1, g3: 1, g4: 1 };
const commandPairs = [];
const pendingActions = {};
let dragSrcEl = null;

/** 出撃システム初期化 */
function initGuildBattleSystem() {
  const addBtn = document.getElementById("addAttackBtn");
  if (addBtn) {
    addBtn.addEventListener("click", (e) => {
      e.preventDefault();
      onAddAttack();
      setTimeout(() => recalcBattle(), 100);
    });
  }
}

/** 出撃コマンド追加 */
function onAddAttack() {
  const guild = document.getElementById("selectGuild").value;
  const role = document.getElementById("selectRole").value;

  const checks = document.querySelectorAll(".chk-target");
  let targets = [];
  checks.forEach((c) => {
    if (c.checked) targets.push(c.value);
  });
  // 念のため自ギルド除外
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

  const cnt = commandCounter[guild];
  const pairId = guild + "_" + cnt;
  commandCounter[guild] = cnt + 1;

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

  // guildColorClass が定義されていればここで使える
  addCommandCard(
    startId,
    guild,
    `出撃(${role === "leader" ? "リーダー" : "メンバー"}) [${pairId}]`,
    guildColorClass[guild]
  );
  addCommandCard(
    endId,
    guild,
    `終了(${role === "leader" ? "リーダー" : "メンバー"}) [${pairId}]`,
    guildColorClass[guild]
  );

  checks.forEach((c) => {
    c.checked = false;
  });
  document.getElementById("tbAttack").value = "0";
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
function handleDragEnd(e) {
  recalcBattle();
}

/** 出撃計算 */
function recalcBattle() {
  // pendingActionsリセット
  for (const k in pendingActions) {
    delete pendingActions[k];
  }

  // 下部ギルド情報(表示のみ) => gp/combo取得
  const gp = {
    g1: +document.getElementById("display-g1-gp").textContent || 0,
    g2: +document.getElementById("display-g2-gp").textContent || 0,
    g3: +document.getElementById("display-g3-gp").textContent || 0,
    g4: +document.getElementById("display-g4-gp").textContent || 0,
    gate: +document.getElementById("display-gate-gp").textContent || 0,
  };
  const combo = {
    g1: +document.getElementById("display-g1-combo").textContent || 0,
    g2: +document.getElementById("display-g2-combo").textContent || 0,
    g3: +document.getElementById("display-g3-combo").textContent || 0,
    g4: +document.getElementById("display-g4-combo").textContent || 0,
    gate: +document.getElementById("display-gate-combo").textContent || 0,
  };

  // タイムライン順に処理
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
      // 出撃
      const rate = role === "leader" ? 0.025 : 0.01;
      let totalSoudatsu = 0;
      let detailSoudatsu = {};
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
    } else if (isEnd) {
      // 終了 => GP反映
      const pa = pendingActions[pairId];
      if (pa) {
        // ゲート, 自分は減算しない
        for (const t in pa.detailSoudatsu) {
          if (t !== "gate" && t !== guild) {
            gp[t] -= pa.detailSoudatsu[t];
            if (gp[t] < 0) gp[t] = 0;
          }
        }
        gp[guild] += pa.gain;
        delete pendingActions[pairId];
      }
    }
  });

  // 結果表示
  document.getElementById("result-g1").textContent = gp.g1;
  document.getElementById("result-g2").textContent = gp.g2;
  document.getElementById("result-g3").textContent = gp.g3;
  document.getElementById("result-g4").textContent = gp.g4;
  document.getElementById("result-gate").textContent = gp.gate;
}
