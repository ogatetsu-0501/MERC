/************************************************************
 * (A) 祈り計算 + ゲート計算
 ************************************************************/

// 応援コンボ(1 or 1000)
const ouenComboMap = { g1: 0, g2: 0, g3: 0, g4: 0 };
// 各ギルドのGP祈りコンボ数(ユーザーが inoriInput を調整できる)
const gpInoriComboMap = { g1: 0, g2: 0, g3: 0, g4: 0 };

// ページロード時の初期化
window.addEventListener("DOMContentLoaded", () => {
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

  initGuildBattleSystem();

  // 初期計算
  calcInori("g1");
  calcInori("g2");
  calcInori("g3");
  calcInori("g4");

  // ギルド選択変化時に「自ギルド」ターゲットを無効化
  const selGuild = document.getElementById("selectGuild");
  if (selGuild) {
    selGuild.addEventListener("change", disableSelfGuildTarget);
    disableSelfGuildTarget();
  }
});

/**
 * 自ギルドはターゲット選択できないようにする
 */
function disableSelfGuildTarget() {
  const selectedGuild = document.getElementById("selectGuild").value; // "g1","g2",...
  const checks = document.querySelectorAll(".chk-target");
  checks.forEach((chk) => {
    if (chk.value === selectedGuild) {
      chk.disabled = true;
      chk.checked = false;
    } else {
      chk.disabled = false;
    }
  });
}

/**
 * 1ギルド分の祈り計算 => ゲート計算 & 出撃計算
 */
function calcInori(gid) {
  const curGP = +document.getElementById(`${gid}-currentGP`).value;
  const inori = +document.getElementById(`${gid}-inori`).value;
  const ouenVal = document.getElementById(`${gid}-ouenType`).value;
  const deGp = +document.getElementById(`${gid}-deSyutsuGp`).value;

  // 応援タイプ => 応援GP/応援コンボ
  let ouenGP, ouenCombo;
  if (ouenVal === "1combo") {
    ouenGP = 501000;
    ouenCombo = 1;
  } else {
    ouenGP = 1000500;
    ouenCombo = 1000;
  }

  // 祈りGP
  const prayerGP = curGP - ouenGP - deGp;
  const memberCombo = inori / 5;
  const leaderCombo = inori / 6.5;

  // ループでGP祈りコンボ数
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

  // ユーザ入力欄にデフォ値
  const inoriInputEl = document.getElementById(`${gid}-inoriInput`);
  inoriInputEl.value = defaultGpInori;
  gpInoriComboMap[gid] = defaultGpInori;

  // 応援コンボ記録 (出撃計算用には必要があれば追加)
  // ...
  // 最終コンボ数
  let finalC = ouenCombo + defaultGpInori;
  document.getElementById(`${gid}-finalCombo`).textContent = finalC;

  // 下部ギルド情報(表示のみ)
  document.getElementById(`display-${gid}-gp`).textContent = curGP.toString();
  document.getElementById(`display-${gid}-combo`).textContent =
    finalC.toString();

  // 祈りコンボ入力 => リアルタイム再計算
  inoriInputEl.oninput = function () {
    const changedVal = +inoriInputEl.value;
    gpInoriComboMap[gid] = changedVal;
    const newFinal = ouenCombo + changedVal;
    document.getElementById(`${gid}-finalCombo`).textContent = newFinal;
    document.getElementById(`display-${gid}-combo`).textContent =
      newFinal.toString();

    // ゲート再計算 + 出撃再計算
    calcGate();
    recalcBattle();
  };

  // ゲート & 出撃再計算
  calcGate();
  recalcBattle();
}

/**
 * ゲート自動計算
 * Gate最終コンボ数 = 4ギルドの gpInoriComboMap 合計
 * Gate GP = 初期コンボ=1～(gateCombo-1)回 => 400*(1+0.002*c) 加算
 */
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

  document.getElementById("display-gate-gp").textContent = gateGP.toString();
  document.getElementById("display-gate-combo").textContent =
    gateCombo.toString();
}

/************************************************************
 * (B) 出撃コマンドロジック + 「終了でコンボ数+1」変更
 ************************************************************/

// ★ ギルドカラー定義
const guildColorClass = {
  g1: "guild1",
  g2: "guild2",
  g3: "guild3",
  g4: "guild4",
};
// 出撃コマンド連番
const commandCounter = { g1: 1, g2: 1, g3: 1, g4: 1 };
// 登録したコマンド情報
const commandPairs = [];
// 出撃用の一時保持
const pendingActions = {};
let dragSrcEl = null;

function initGuildBattleSystem() {
  const addBtn = document.getElementById("addAttackBtn");
  if (addBtn) {
    addBtn.addEventListener("click", (e) => {
      e.preventDefault();
      onAddAttack();
      // 追加後に再計算
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
  // 自ギルドは除外 (安全策)
  targets = targets.filter((t) => t !== guild);
  if (targets.length > 3) {
    alert("ターゲットは最大3つまでです。");
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

/** コマンドカード生成 */
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

/** D&Dイベント */
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

/**
 * 出撃計算:
 *  => 「終了」時にギルドのコンボ数を+1
 *  => 以降の計算で新しいコンボ数を使用
 */
function recalcBattle() {
  // 1) pendingActionsリセット
  for (const k in pendingActions) {
    delete pendingActions[k];
  }

  // 2) 下部ギルド情報(表示のみ)から 「現在GP」「最終コンボ数」取得
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

  // 3) タイムライン順に「start => end」を処理
  const list = document.getElementById("commandList");
  if (!list) return;
  const items = list.querySelectorAll("li");

  items.forEach((li) => {
    const cmdId = li.id; // ex "g1_1_start"
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
      // 出撃(計算のみ)
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
      // 終了 => GP反映 & コンボ+1
      const pa = pendingActions[pairId];
      if (pa) {
        // 争奪GP反映
        for (const t in pa.detailSoudatsu) {
          if (t !== "gate" && t !== guild) {
            gp[t] -= pa.detailSoudatsu[t];
            if (gp[t] < 0) gp[t] = 0;
          }
        }
        gp[guild] += pa.gain;
        // ここでコンボ+1
        combo[guild]++;
        // 下部表示にも反映
        document.getElementById(`display-${guild}-combo`).textContent =
          combo[guild];

        delete pendingActions[pairId];
      }
    }
  });

  // 4) 出撃結果を表示
  document.getElementById("result-g1").textContent = gp.g1;
  document.getElementById("result-g2").textContent = gp.g2;
  document.getElementById("result-g3").textContent = gp.g3;
  document.getElementById("result-g4").textContent = gp.g4;
  document.getElementById("result-gate").textContent = gp.gate;
}
