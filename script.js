/************************************************************
 * 0) グローバル変数・定数
 ************************************************************/

/** ギルド別色  */
const guildColorClass = {
  g1: "guild1",
  g2: "guild2",
  g3: "guild3",
  g4: "guild4",
};

/** 上部4ギルドの祈り計算 + ゲート計算用 */
const ouenComboMap = { g1: 0, g2: 0, g3: 0, g4: 0 };
const gpInoriComboMap = { g1: 0, g2: 0, g3: 0, g4: 0 };

/** コマンドリストデータ */
const commandListData = [];
/** 出撃コマンド連番 */
const commandCounter = { g1: 1, g2: 1, g3: 1, g4: 1 };
/** 出撃コマンドの pending (start⇒end) */
const pendingActions = {};
/** D&D用 */
let dragSrcEl = null;

/************************************************************
 * 1) ページロード
 ************************************************************/
window.addEventListener("DOMContentLoaded", () => {
  // 上部4ギルド：祈り計算
  ["g1", "g2", "g3", "g4"].forEach((gid) => {
    document
      .getElementById(`${gid}-currentGP`)
      .addEventListener("input", () => calcInori(gid));
    document
      .getElementById(`${gid}-inori`)
      .addEventListener("input", () => calcInori(gid));
    document
      .getElementById(`${gid}-ouenType`)
      .addEventListener("change", () => calcInori(gid));
    document
      .getElementById(`${gid}-deSyutsuGp`)
      .addEventListener("input", () => calcInori(gid));
  });

  // コマンドシステム初期化
  initCommandSystem();

  // 初期計算 (4ギルド)
  calcInori("g1");
  calcInori("g2");
  calcInori("g3");
  calcInori("g4");

  // 出撃コマンド: 自ギルドターゲット無効化
  document
    .getElementById("selectGuild")
    .addEventListener("change", disableSelfGuildTarget);
  disableSelfGuildTarget();

  // ★ 追加: ゲートサイズ変更で再計算
  const gateSizeSel = document.getElementById("gateSizeSelect");
  gateSizeSel.addEventListener("change", () => {
    calcGate();
    recalcBattle();
  });
});

/************************************************************
 * 2) 上部：各ギルド祈り計算 => ゲート計算 => 再計算
 ************************************************************/
/** 自ギルドターゲット選択不可 */
function disableSelfGuildTarget() {
  const sel = document.getElementById("selectGuild").value; // "g1" etc
  const cbs = document.querySelectorAll(".chk-target");
  cbs.forEach((cb) => {
    if (cb.value === sel) {
      cb.disabled = true;
      cb.checked = false;
    } else {
      cb.disabled = false;
    }
  });
}

/** 1ギルドの祈り計算 */
function calcInori(gid) {
  const curGP = +document.getElementById(`${gid}-currentGP`).value;
  const inori = +document.getElementById(`${gid}-inori`).value;
  const ouenVal = document.getElementById(`${gid}-ouenType`).value;
  const deSyGp = +document.getElementById(`${gid}-deSyutsuGp`).value;

  // 応援GP/応援コンボ
  let ouenGP, ouenCombo;
  if (ouenVal === "1combo") {
    ouenGP = 501000;
    ouenCombo = 1;
  } else {
    ouenGP = 1000500;
    ouenCombo = 1000;
  }
  const prayerGP = curGP - ouenGP - deSyGp;

  // メンバー/リーダーコンボ
  const memberC = inori / 5;
  const leaderC = inori / 6.5;

  // GP祈りコンボ数 => 400*(1+ 0.002* c)
  let cCombo = ouenCombo;
  let total = 0;
  while (true) {
    const add = 400 * (1 + 0.002 * cCombo);
    if (total + add > prayerGP) break;
    total += add;
    cCombo++;
  }
  const gpInori = Math.max(0, cCombo - 1 - ouenCombo);

  // 上部表示
  document.getElementById(`${gid}-result`).style.display = "block";
  document.getElementById(`${gid}-prayerGP`).textContent = `祈りGP: ${
    prayerGP < 0 ? prayerGP + "(マイナス)" : prayerGP
  }`;
  document.getElementById(
    `${gid}-memberCombo`
  ).textContent = `メンバーコンボ数: ${memberC.toFixed(2)}`;
  document.getElementById(
    `${gid}-leaderCombo`
  ).textContent = `リーダーコンボ数: ${leaderC.toFixed(2)}`;
  document.getElementById(
    `${gid}-gpInoriCombo`
  ).textContent = `GP祈りコンボ数: ${gpInori}`;

  // 祈りコンボ入力 => ユーザ手動調整
  const inoriInputEl = document.getElementById(`${gid}-inoriInput`);
  inoriInputEl.value = gpInori;
  gpInoriComboMap[gid] = gpInori;

  // 最終コンボ数=応援コンボ+gpInori
  const finalC = ouenCombo + gpInori;
  document.getElementById(`${gid}-finalCombo`).textContent = finalC;

  // 下部表示(表示のみ)
  document.getElementById(`display-${gid}-gp`).textContent = curGP.toString();
  document.getElementById(`display-${gid}-combo`).textContent =
    finalC.toString();

  inoriInputEl.oninput = function () {
    const changed = +inoriInputEl.value;
    gpInoriComboMap[gid] = changed;
    const newF = ouenCombo + changed;
    document.getElementById(`${gid}-finalCombo`).textContent = newF;
    document.getElementById(`display-${gid}-combo`).textContent =
      newF.toString();
    calcGate();
    recalcBattle();
  };

  calcGate();
  recalcBattle();
}

/** ゲート計算 => ゲートサイズ率をかける */
function calcGate() {
  // 1) ゲートの生GP計算
  let rawGateCombo = 0;
  ["g1", "g2", "g3", "g4"].forEach((g) => {
    rawGateCombo += gpInoriComboMap[g];
  });
  let rawGateGP = 0;
  for (let c = 1; c < rawGateCombo; c++) {
    const add = 400 * (1 + 0.002 * c);
    rawGateGP += add;
  }
  rawGateGP = Math.floor(rawGateGP);

  // 2) ゲートサイズ選択を取得
  const gateSizeSel = document.getElementById("gateSizeSelect");
  const gateRate = parseFloat(gateSizeSel.value) || 1; // default=1

  // 3) Gate GP = raw * gateRate
  const finalGateGP = Math.floor(rawGateGP * gateRate);

  // 表示
  document.getElementById("display-gate-combo").textContent =
    rawGateCombo.toString();
  document.getElementById("display-gate-gp").textContent =
    finalGateGP.toString();
}

/************************************************************
 * 3) コマンド追加フォーム(出撃 or 祈り) & タイムライン
 ************************************************************/
function initCommandSystem() {
  const cmdTypeSel = document.getElementById("cmdTypeSelect");
  const attackForm = document.getElementById("attackForm");
  const inoriForm = document.getElementById("inoriForm");

  cmdTypeSel.addEventListener("change", () => {
    const v = cmdTypeSel.value;
    if (v === "attack") {
      attackForm.style.display = "";
      inoriForm.style.display = "none";
    } else {
      attackForm.style.display = "none";
      inoriForm.style.display = "";
      calcInoriCommandForm(); // 祈り用フォーム計算
    }
  });

  // 祈りフォーム
  document
    .getElementById("inoriGuild")
    .addEventListener("change", calcInoriCommandForm);
  document
    .getElementById("inoriValue")
    .addEventListener("input", calcInoriCommandForm);
  document
    .getElementById("inoriFinalCombo")
    .addEventListener("input", () => {});

  // 追加ボタン
  document
    .getElementById("addCommandBtn")
    .addEventListener("click", onAddCommand);
}

/** 祈りコマンドフォーム計算 */
function calcInoriCommandForm() {
  const guild = document.getElementById("inoriGuild").value;
  const val = +document.getElementById("inoriValue").value || 0;
  const memC = val / 5;
  const leadC = val / 6.5;

  document.getElementById(
    "inoriMemberCombo"
  ).textContent = `メンバーコンボ数: ${memC.toFixed(2)}`;
  document.getElementById(
    "inoriLeaderCombo"
  ).textContent = `リーダーコンボ数: ${leadC.toFixed(2)}`;

  const base =
    +document.getElementById(`display-${guild}-combo`).textContent || 0;
  const memGP = loopInoriGP_command(base, memC);
  const leadGP = loopInoriGP_command(base, leadC);
  // "コンボ数" => (memC+ leadC)/2
  const avgC = Math.floor((memC + leadC) / 2);
  document.getElementById("inoriFinalCombo").value = avgC;
}

/** 祈りコマンドフォーム計算用 => 0.2 */
function loopInoriGP_command(base, c) {
  let sum = 0;
  const loopCount = Math.floor(c);
  for (let i = 0; i < loopCount; i++) {
    const cc = base + i;
    const add = 400 * (1 + 0.2 * cc);
    sum += add;
  }
  return sum;
}

/** コマンド追加 */
function onAddCommand(e) {
  e.preventDefault();
  const cmdType = document.getElementById("cmdTypeSelect").value;

  if (cmdType === "attack") {
    // 出撃
    const guild = document.getElementById("selectGuild").value;
    const role = document.getElementById("selectRole").value;

    const cbs = document.querySelectorAll(".chk-target");
    let targets = [];
    cbs.forEach((cb) => {
      if (cb.checked) targets.push(cb.value);
    });
    targets = targets.filter((t) => t !== guild);
    if (targets.length > 3) {
      alert("ターゲットは3つまで");
      return;
    }
    if (targets.length === 0) {
      alert("ターゲットなし");
      return;
    }
    const timeB = +document.getElementById("tbAttack").value || 0;

    const cnt = commandCounter[guild];
    const pairId = `${guild}_${cnt}`;
    commandCounter[guild] = cnt + 1;

    const startId = pairId + "_start";
    const endId = pairId + "_end";

    commandListData.push({
      type: "attack",
      pairId,
      guild,
      role,
      targets,
      timeBonus: timeB,
      startId,
      endId,
      disputeGP: 0,
    });

    addCommandCard(
      startId,
      `Guild${guild.slice(1)} 出撃(${role}) [${pairId}]`,
      guildColorClass[guild]
    );
    addCommandCard(
      endId,
      `Guild${guild.slice(1)} 終了(${role}) [${pairId}]`,
      guildColorClass[guild]
    );

    cbs.forEach((cb) => {
      cb.checked = false;
    });
    document.getElementById("tbAttack").value = "0";
  } else {
    // 祈り
    const guild = document.getElementById("inoriGuild").value;
    const val = +document.getElementById("inoriValue").value || 0;
    const finalC = +document.getElementById("inoriFinalCombo").value || 0;

    const cnt = commandCounter[guild];
    const pairId = `${guild}_${cnt}`;
    commandCounter[guild] = cnt + 1;

    const cmdId = pairId + "_inori";
    commandListData.push({
      type: "inori",
      pairId,
      guild,
      prayerValue: val,
      finalCombo: finalC,
      calculatedGP: 0,
      cmdId,
    });

    addCommandCard(
      cmdId,
      `Guild${guild.slice(1)} 祈り [${pairId}]`,
      guildColorClass[guild]
    );
  }

  setTimeout(() => recalcBattle(), 100);
}

/************************************************************
 * 4) カード生成(×ボタン) + titleツールチップ + D&D
 ************************************************************/
function addCommandCard(cmdId, label, cssClass) {
  const ul = document.getElementById("commandList");
  if (!ul) return;

  const li = document.createElement("li");
  li.id = cmdId;
  li.className = "command-item " + cssClass;
  li.draggable = true;

  const sp = document.createElement("span");
  sp.className = "command-label";
  sp.textContent = label;
  li.appendChild(sp);

  // (×)ボタン
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  closeBtn.style.marginLeft = "8px";
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    removeCommandCard(cmdId);
  });
  li.appendChild(closeBtn);

  // マウスオーバー => title更新
  li.addEventListener("mouseover", () => updateCardTitle(cmdId, li));

  // D&D
  li.addEventListener("dragstart", handleDragStart);
  li.addEventListener("dragover", handleDragOver);
  li.addEventListener("dragleave", handleDragLeave);
  li.addEventListener("drop", handleDrop);
  li.addEventListener("dragend", handleDragEnd);

  ul.appendChild(li);
}

/** カード削除 */
function removeCommandCard(cmdId) {
  const data = findCmdDataById(cmdId);
  if (!data) return;

  if (data.type === "attack") {
    // 出撃 => start/end ペア削除
    removeCardDomIfExist(data.startId);
    removeCardDomIfExist(data.endId);
    const idx = commandListData.findIndex(
      (d) => d.type === "attack" && d.pairId === data.pairId
    );
    if (idx >= 0) commandListData.splice(idx, 1);
  } else if (data.type === "inori") {
    // 祈り => 1枚
    removeCardDomIfExist(data.cmdId);
    const idx = commandListData.findIndex(
      (d) => d.type === "inori" && d.pairId === data.pairId
    );
    if (idx >= 0) commandListData.splice(idx, 1);
  }

  recalcBattle();
}
function findCmdDataById(cmdId) {
  return commandListData.find(
    (d) =>
      (d.type === "attack" && (d.startId === cmdId || d.endId === cmdId)) ||
      (d.type === "inori" && d.cmdId === cmdId)
  );
}
function removeCardDomIfExist(cId) {
  const li = document.getElementById(cId);
  if (li && li.parentNode) {
    li.parentNode.removeChild(li);
  }
}

/** カードのtitleを更新 */
function updateCardTitle(cmdId, liElem) {
  const data = findCmdDataById(cmdId);
  if (!data) {
    liElem.title = "";
    return;
  }
  if (data.type === "attack") {
    // 出撃 => ロール, ターゲット, timeBonus, 争奪GP
    const r = data.role;
    const t = (data.targets || []).join(",");
    const b = data.timeBonus || 0;
    const g = data.disputeGP || 0;
    liElem.title = `ロール:${r}\nターゲット:${t}\nタイムボーナス:${b}%\n争奪GP:${g}`;
  } else if (data.type === "inori") {
    // 祈り => 祈り値, コンボ数, 獲得GP = calculatedGP
    const v = data.prayerValue || 0;
    const c = data.finalCombo || 0;
    const g = data.calculatedGP || 0;
    liElem.title = `祈り値:${v}\nコンボ数:${c}\n獲得GP:${g}`;
  }
}

/************************************************************
 * 5) 出撃計算 (タイムライン):
 *   attack: start => pending, end => 反映 & コンボ+1
 *   inori: ratio補正 => guild & gate
 ************************************************************/
function recalcBattle() {
  // 下部"表示のみ" => gp, combo
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

  // pending初期化
  for (const k in pendingActions) {
    delete pendingActions[k];
  }

  const ul = document.getElementById("commandList");
  const items = ul.querySelectorAll("li");
  items.forEach((li) => {
    const cId = li.id;
    const data = findCmdDataById(cId);
    if (!data) return;

    if (data.type === "attack") {
      if (cId.endsWith("_start")) {
        // start => 争奪GP
        const role = data.role;
        const g = data.guild;
        const tb = data.timeBonus || 0;
        const targets = data.targets || [];
        const rate = role === "leader" ? 0.025 : 0.01;
        let totalS = 0;
        let detailS = {};
        targets.forEach((t) => {
          if (gp[t] !== undefined && t !== g) {
            const d = Math.floor(gp[t] * rate);
            detailS[t] = d;
            totalS += d;
          }
        });
        const base = 4000 * (1 + 0.002 * combo[g]);
        const gain = (base + totalS) * (1 + tb / 100);
        const floorG = Math.floor(gain);

        pendingActions[data.pairId] = {
          detailSoudatsu: detailS,
          totalSoudatsu: totalS,
          gain: floorG,
        };
        data.disputeGP = totalS; // ツールチップ用
      } else if (cId.endsWith("_end")) {
        // end => 反映 & +1
        const pa = pendingActions[data.pairId];
        if (pa) {
          const g = data.guild;
          for (const t in pa.detailSoudatsu) {
            if (t !== "gate" && t !== g) {
              gp[t] -= pa.detailSoudatsu[t];
              if (gp[t] < 0) gp[t] = 0;
            }
          }
          gp[g] += pa.gain;
          combo[g]++;
          document.getElementById(`display-${g}-combo`).textContent = combo[g];
          delete pendingActions[data.pairId];
        }
      }
    } else if (data.type === "inori") {
      // ratio補正 => guild & gate
      const g = data.guild;
      const val = data.prayerValue || 0;
      const finalC = data.finalCombo || 0;

      const memC = val / 5;
      const leadC = val / 6.5;
      let ratio = 0;
      if (Math.abs(leadC - memC) < 0.000001) {
        ratio = 0;
      } else {
        ratio = (finalC - memC) / (leadC - memC);
      }

      // guild side
      const memGP_g = loopInoriGP_timeline(combo[g], memC);
      const leadGP_g = loopInoriGP_timeline(combo[g], leadC);
      let actualGP = memGP_g + ratio * (leadGP_g - memGP_g);
      actualGP = Math.floor(actualGP);

      // gate side
      const memGP_gate = loopInoriGP_timeline(combo.gate, memC);
      const leadGP_gate = loopInoriGP_timeline(combo.gate, leadC);
      let actualGP_gate = memGP_gate + ratio * (leadGP_gate - memGP_gate);
      actualGP_gate = Math.floor(actualGP_gate);

      // ★ ゲートサイズ反映 => "gateSizeSelect" 参照
      const gateSizeSel = document.getElementById("gateSizeSelect");
      const gateRate = parseFloat(gateSizeSel.value) || 1;

      // add to guild & gate
      combo[g] += finalC;
      gp[g] += actualGP;

      combo.gate += finalC;
      // gate GP => actualGP_gate * gateRate
      const scaledGateGP = Math.floor(actualGP_gate * gateRate);
      gp.gate += scaledGateGP;

      data.calculatedGP = actualGP; // ツールチップ表示
    }
  });

  // 結果表示
  document.getElementById("result-g1").textContent = gp.g1;
  document.getElementById("result-g2").textContent = gp.g2;
  document.getElementById("result-g3").textContent = gp.g3;
  document.getElementById("result-g4").textContent = gp.g4;
  document.getElementById("result-gate").textContent = gp.gate;
}

/** 祈りコマンド => ループGP => 400*(1+0.2*( baseCombo+i )) */
function loopInoriGP_timeline(baseC, c) {
  const loopCount = Math.floor(c);
  let sum = 0;
  for (let i = 0; i < loopCount; i++) {
    const cc = baseC + i;
    const add = 400 * (1 + 0.2 * cc);
    sum += add;
  }
  return sum;
}

/************************************************************
 * 6) D&D処理 (handleDragStart等)
 ************************************************************/
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
