/************************************************************
 * 0) グローバル変数・定数
 ************************************************************/

/** ギルド別色 */
const guildColorClass = {
  g1: "guild1",
  g2: "guild2",
  g3: "guild3",
  g4: "guild4",
};

/** 上部4ギルドの 祈り計算 + ゲート計算 用 */
const ouenComboMap = { g1: 0, g2: 0, g3: 0, g4: 0 };
const gpInoriComboMap = { g1: 0, g2: 0, g3: 0, g4: 0 };

/** コマンドリストデータ (出撃 or 祈り) */
let commandListData = [];
/** 出撃コマンド連番 */
const commandCounter = { g1: 1, g2: 1, g3: 1, g4: 1 };
/** 出撃コマンド start=>end の一時保存 (soudatsuGPなど) */
const pendingActions = {};
/** D&D用 */
let dragSrcEl = null;

/** 編集モード: 現在編集中コマンドID (nullなら通常追加モード) */
let currentEditId = null; // 例 "g1_2_start"  or "g2_1_inori"

/************************************************************
 * 1) ページロード
 ************************************************************/
window.addEventListener("DOMContentLoaded", () => {
  // 上部4ギルド => あらゆる入力に onFieldChange
  ["g1", "g2", "g3", "g4"].forEach((gid) => {
    document
      .getElementById(`${gid}-currentGP`)
      .addEventListener("input", onFieldChange);
    document
      .getElementById(`${gid}-inori`)
      .addEventListener("input", onFieldChange);
    document
      .getElementById(`${gid}-ouenType`)
      .addEventListener("change", onFieldChange);
    document
      .getElementById(`${gid}-ouenGP`)
      .addEventListener("input", onFieldChange);
    document
      .getElementById(`${gid}-ouenCombo`)
      .addEventListener("input", onFieldChange);
    document
      .getElementById(`${gid}-deSyutsuGp`)
      .addEventListener("input", onFieldChange);
  });

  // コマンドシステム初期化
  initCommandSystem();

  // ゲートサイズ
  document
    .getElementById("gateSizeSelect")
    .addEventListener("change", onFieldChange);

  // ローカルストレージから復元
  loadFromLocalStorage();

  // 初期計算
  ["g1", "g2", "g3", "g4"].forEach((gid) => calcInori(gid));
  calcGate();
  recalcBattle();

  // 出撃コマンド: 自ギルドターゲット無効化
  document
    .getElementById("selectGuild")
    .addEventListener("change", disableSelfGuildTarget);
  disableSelfGuildTarget();
});

/************************************************************
 * 2) onFieldChange => 全再計算 & ローカル保存
 ************************************************************/
function onFieldChange() {
  // 各ギルドの祈り計算
  ["g1", "g2", "g3", "g4"].forEach((gid) => calcInori(gid));
  // ゲート計算
  calcGate();
  // コマンド再計算
  recalcBattle();
  // 保存
  saveToLocalStorage();
}

/************************************************************
 * ローカルストレージ 保存 / 復元
 ************************************************************/
function saveToLocalStorage() {
  let storeData = {
    // Guild1
    "g1-currentGP": document.getElementById("g1-currentGP").value,
    "g1-inori": document.getElementById("g1-inori").value,
    "g1-ouenType": document.getElementById("g1-ouenType").value,
    "g1-ouenGP": document.getElementById("g1-ouenGP").value,
    "g1-ouenCombo": document.getElementById("g1-ouenCombo").value,
    "g1-deSyutsuGp": document.getElementById("g1-deSyutsuGp").value,

    // Guild2
    "g2-currentGP": document.getElementById("g2-currentGP").value,
    "g2-inori": document.getElementById("g2-inori").value,
    "g2-ouenType": document.getElementById("g2-ouenType").value,
    "g2-ouenGP": document.getElementById("g2-ouenGP").value,
    "g2-ouenCombo": document.getElementById("g2-ouenCombo").value,
    "g2-deSyutsuGp": document.getElementById("g2-deSyutsuGp").value,

    // Guild3
    "g3-currentGP": document.getElementById("g3-currentGP").value,
    "g3-inori": document.getElementById("g3-inori").value,
    "g3-ouenType": document.getElementById("g3-ouenType").value,
    "g3-ouenGP": document.getElementById("g3-ouenGP").value,
    "g3-ouenCombo": document.getElementById("g3-ouenCombo").value,
    "g3-deSyutsuGp": document.getElementById("g3-deSyutsuGp").value,

    // Guild4
    "g4-currentGP": document.getElementById("g4-currentGP").value,
    "g4-inori": document.getElementById("g4-inori").value,
    "g4-ouenType": document.getElementById("g4-ouenType").value,
    "g4-ouenGP": document.getElementById("g4-ouenGP").value,
    "g4-ouenCombo": document.getElementById("g4-ouenCombo").value,
    "g4-deSyutsuGp": document.getElementById("g4-deSyutsuGp").value,

    // ゲートサイズ
    gateSizeSelect: document.getElementById("gateSizeSelect").value,

    // 出撃コマンドフォーム
    cmdTypeSelect: document.getElementById("cmdTypeSelect").value,
    selectGuild: document.getElementById("selectGuild").value,
    selectRole: document.getElementById("selectRole").value,
    attackNinzu: document.getElementById("attackNinzu").value,
    tbAttack: document.getElementById("tbAttack").value,

    // 祈りコマンドフォーム
    inoriGuild: document.getElementById("inoriGuild").value,
    inoriValue: document.getElementById("inoriValue").value,
    inoriFinalCombo: document.getElementById("inoriFinalCombo").value,

    // コマンド一覧
    commandListData: commandListData,
  };

  localStorage.setItem("myStorageKey", JSON.stringify(storeData));
}

function loadFromLocalStorage() {
  let json = localStorage.getItem("myStorageKey");
  if (!json) return;
  try {
    let storeData = JSON.parse(json);

    // Guild1
    if (storeData["g1-currentGP"] !== undefined) {
      document.getElementById("g1-currentGP").value = storeData["g1-currentGP"];
      document.getElementById("g1-inori").value = storeData["g1-inori"];
      document.getElementById("g1-ouenType").value = storeData["g1-ouenType"];
      document.getElementById("g1-ouenGP").value = storeData["g1-ouenGP"];
      document.getElementById("g1-ouenCombo").value = storeData["g1-ouenCombo"];
      document.getElementById("g1-deSyutsuGp").value =
        storeData["g1-deSyutsuGp"];
    }
    // Guild2
    if (storeData["g2-currentGP"] !== undefined) {
      document.getElementById("g2-currentGP").value = storeData["g2-currentGP"];
      document.getElementById("g2-inori").value = storeData["g2-inori"];
      document.getElementById("g2-ouenType").value = storeData["g2-ouenType"];
      document.getElementById("g2-ouenGP").value = storeData["g2-ouenGP"];
      document.getElementById("g2-ouenCombo").value = storeData["g2-ouenCombo"];
      document.getElementById("g2-deSyutsuGp").value =
        storeData["g2-deSyutsuGp"];
    }
    // Guild3
    if (storeData["g3-currentGP"] !== undefined) {
      document.getElementById("g3-currentGP").value = storeData["g3-currentGP"];
      document.getElementById("g3-inori").value = storeData["g3-inori"];
      document.getElementById("g3-ouenType").value = storeData["g3-ouenType"];
      document.getElementById("g3-ouenGP").value = storeData["g3-ouenGP"];
      document.getElementById("g3-ouenCombo").value = storeData["g3-ouenCombo"];
      document.getElementById("g3-deSyutsuGp").value =
        storeData["g3-deSyutsuGp"];
    }
    // Guild4
    if (storeData["g4-currentGP"] !== undefined) {
      document.getElementById("g4-currentGP").value = storeData["g4-currentGP"];
      document.getElementById("g4-inori").value = storeData["g4-inori"];
      document.getElementById("g4-ouenType").value = storeData["g4-ouenType"];
      document.getElementById("g4-ouenGP").value = storeData["g4-ouenGP"];
      document.getElementById("g4-ouenCombo").value = storeData["g4-ouenCombo"];
      document.getElementById("g4-deSyutsuGp").value =
        storeData["g4-deSyutsuGp"];
    }

    // ゲートサイズ
    if (storeData["gateSizeSelect"] !== undefined) {
      document.getElementById("gateSizeSelect").value =
        storeData["gateSizeSelect"];
    }

    // 出撃コマンドフォーム
    if (storeData["cmdTypeSelect"] !== undefined) {
      document.getElementById("cmdTypeSelect").value =
        storeData["cmdTypeSelect"];
    }
    if (storeData["selectGuild"] !== undefined) {
      document.getElementById("selectGuild").value = storeData["selectGuild"];
    }
    if (storeData["selectRole"] !== undefined) {
      document.getElementById("selectRole").value = storeData["selectRole"];
    }
    if (storeData["attackNinzu"] !== undefined) {
      document.getElementById("attackNinzu").value = storeData["attackNinzu"];
    }
    if (storeData["tbAttack"] !== undefined) {
      document.getElementById("tbAttack").value = storeData["tbAttack"];
    }

    // 祈りコマンドフォーム
    if (storeData["inoriGuild"] !== undefined) {
      document.getElementById("inoriGuild").value = storeData["inoriGuild"];
    }
    if (storeData["inoriValue"] !== undefined) {
      document.getElementById("inoriValue").value = storeData["inoriValue"];
    }
    if (storeData["inoriFinalCombo"] !== undefined) {
      document.getElementById("inoriFinalCombo").value =
        storeData["inoriFinalCombo"];
    }

    // コマンド一覧
    if (storeData["commandListData"]) {
      commandListData = storeData["commandListData"];
      rebuildCommandTimeline();
    }
  } catch (e) {
    console.warn("localStorage parse error:", e);
  }
}

/** コマンドタイムライン再構築 */
function rebuildCommandTimeline() {
  const ul = document.getElementById("commandList");
  ul.innerHTML = "";
  commandListData.forEach((cmd) => {
    if (cmd.type === "attack") {
      addCommandCard(
        cmd.startId,
        `Guild${cmd.guild.slice(1)} 出撃(${cmd.role}) [${cmd.pairId}]`,
        guildColorClass[cmd.guild]
      );
      addCommandCard(
        cmd.endId,
        `Guild${cmd.guild.slice(1)} 終了(${cmd.role}) [${cmd.pairId}]`,
        guildColorClass[cmd.guild]
      );
    } else if (cmd.type === "inori") {
      addCommandCard(
        cmd.cmdId,
        `Guild${cmd.guild.slice(1)} 祈り [${cmd.pairId}]`,
        guildColorClass[cmd.guild]
      );
    }
  });
}

/************************************************************
 * 3) 祈り計算 & ゲート計算
 ************************************************************/

/** 自ギルドをターゲット選択不可 */
function disableSelfGuildTarget() {
  const selGuild = document.getElementById("selectGuild").value;
  const cbs = document.querySelectorAll(".chk-target");
  cbs.forEach((cb) => {
    if (cb.value === selGuild) {
      cb.disabled = true;
      cb.checked = false;
    } else {
      cb.disabled = false;
    }
  });
}

/** 1ギルドの祈り計算 => 最終コンボ数を下部に即反映 */
function calcInori(gid) {
  const curGP = +document.getElementById(`${gid}-currentGP`).value;
  const inori = +document.getElementById(`${gid}-inori`).value;
  const ouenType = document.getElementById(`${gid}-ouenType`).value;

  // ユーザ入力の応援GP/応援コンボ
  let ouenGP = +document.getElementById(`${gid}-ouenGP`).value || 0;
  let ouenCombo = +document.getElementById(`${gid}-ouenCombo`).value || 0;
  const deSyGp = +document.getElementById(`${gid}-deSyutsuGp`).value || 0;

  const prayerGP = curGP - ouenGP - deSyGp;
  const memberC = inori / 5;
  const leaderC = inori / 6.5;

  // ループ => GP祈りコンボ数(400*(1+0.002*c))
  let cCombo = ouenCombo;
  let total = 0;
  while (true) {
    const add = 400 * (1 + 0.002 * cCombo);
    if (total + add > prayerGP) break;
    total += add;
    cCombo++;
  }
  const gpInori = Math.max(0, cCombo - 1 - ouenCombo);

  document.getElementById(`${gid}-result`).style.display = "block";
  document.getElementById(`${gid}-prayerGP`).textContent = `祈りGP: ${
    prayerGP < 0 ? prayerGP + " (マイナス)" : prayerGP
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

  const inoriInputEl = document.getElementById(`${gid}-inoriInput`);
  inoriInputEl.value = gpInori;
  gpInoriComboMap[gid] = gpInori;

  // 最終コンボ数 = 応援コンボ + gpInori
  const finalC = ouenCombo + gpInori;
  document.getElementById(`${gid}-finalCombo`).textContent = finalC;

  // 下部ギルド情報(表示のみ) => コンボ即時更新
  document.getElementById(`display-${gid}-combo`).textContent =
    finalC.toString();
}

/** ゲート計算 => サイズ反映 */
function calcGate() {
  let rawGateCombo = 0;
  ["g1", "g2", "g3", "g4"].forEach((g) => {
    rawGateCombo += gpInoriComboMap[g];
  });
  let rawGateGP = 0;
  for (let c = 1; c < rawGateCombo; c++) {
    rawGateGP += 400 * (1 + 0.002 * c);
  }
  rawGateGP = Math.floor(rawGateGP);

  const gateSizeSel = document.getElementById("gateSizeSelect");
  const gateRate = parseFloat(gateSizeSel.value) || 1;
  const finalGateGP = Math.floor(rawGateGP * gateRate);

  document.getElementById("display-gate-combo").textContent =
    rawGateCombo.toString();
  document.getElementById("display-gate-gp").textContent =
    finalGateGP.toString();
}

/************************************************************
 * 4) コマンド追加フォーム + 編集モード
 ************************************************************/

/** 通常のコマンド初期化 */
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
      calcInoriCommandForm();
    }
    saveToLocalStorage();
  });

  document
    .getElementById("inoriGuild")
    .addEventListener("change", calcInoriCommandForm);
  document
    .getElementById("inoriValue")
    .addEventListener("input", calcInoriCommandForm);
  document.getElementById("inoriFinalCombo").addEventListener("input", () => {
    /* no-op */
  });

  // コマンドフォームのメインボタン
  document
    .getElementById("submitCommandBtn")
    .addEventListener("click", onSubmitCommand);
}

/** onSubmitCommand => 追加 or 変更を判定 */
function onSubmitCommand(e) {
  e.preventDefault();
  if (currentEditId) {
    // 編集モード => 変更を適用
    applyUpdateCommand();
  } else {
    // 通常 => 追加
    onAddCommand();
  }
}

/** コマンド編集モード開始 */
function startEditCommand(cmdId) {
  currentEditId = cmdId;
  const data = findCmdDataById(cmdId);
  if (!data) return;

  // 出撃 or 祈り
  const cmdTypeSel = document.getElementById("cmdTypeSelect");
  const attackForm = document.getElementById("attackForm");
  const inoriForm = document.getElementById("inoriForm");

  if (data.type === "attack") {
    cmdTypeSel.value = "attack";
    attackForm.style.display = "";
    inoriForm.style.display = "none";
    document.getElementById("selectGuild").value = data.guild;
    document.getElementById("selectRole").value = data.role;
    document.getElementById("attackNinzu").value = data.ninzu || 1;
    document.getElementById("tbAttack").value = data.timeBonus || 0;

    // ターゲット
    const cbs = document.querySelectorAll(".chk-target");
    cbs.forEach((cb) => {
      cb.checked = false;
    });
    (data.targets || []).forEach((t) => {
      const c = document.querySelector(`.chk-target[value="${t}"]`);
      if (c) c.checked = true;
    });
  } else {
    cmdTypeSel.value = "inori";
    attackForm.style.display = "none";
    inoriForm.style.display = "";
    document.getElementById("inoriGuild").value = data.guild;
    document.getElementById("inoriValue").value = data.prayerValue || 0;
    document.getElementById("inoriFinalCombo").value = data.finalCombo || 0;
  }

  // ボタンを「変更」に
  document.getElementById("submitCommandBtn").textContent = "変更";
}

/** コマンド編集適用 */
function applyUpdateCommand() {
  if (!currentEditId) return;
  const data = findCmdDataById(currentEditId);
  if (!data) {
    cancelEditMode();
    return;
  }

  const cmdType = document.getElementById("cmdTypeSelect").value;
  if (cmdType === "attack") {
    const guild = document.getElementById("selectGuild").value;
    const role = document.getElementById("selectRole").value;
    const ninzu = +document.getElementById("attackNinzu").value || 1;
    const tb = +document.getElementById("tbAttack").value || 0;
    // ターゲット
    const cbs = document.querySelectorAll(".chk-target");
    let tg = [];
    cbs.forEach((cb) => {
      if (cb.checked) tg.push(cb.value);
    });
    tg = tg.filter((t) => t !== guild);

    data.guild = guild;
    data.role = role;
    data.ninzu = ninzu;
    data.timeBonus = tb;
    data.targets = tg;

    // start/end ラベル更新
    const startLi = document.getElementById(data.startId);
    if (startLi) {
      const sp = startLi.querySelector(".command-label");
      if (sp) {
        sp.textContent = `Guild${guild.slice(1)} 出撃(${role}) [${
          data.pairId
        }]`;
      }
    }
    const endLi = document.getElementById(data.endId);
    if (endLi) {
      const sp = endLi.querySelector(".command-label");
      if (sp) {
        sp.textContent = `Guild${guild.slice(1)} 終了(${role}) [${
          data.pairId
        }]`;
      }
    }
  } else {
    // 祈り
    const g = document.getElementById("inoriGuild").value;
    const v = +document.getElementById("inoriValue").value || 0;
    const fc = +document.getElementById("inoriFinalCombo").value || 0;

    data.guild = g;
    data.prayerValue = v;
    data.finalCombo = fc;

    // カードラベル
    const li = document.getElementById(data.cmdId);
    if (li) {
      const sp = li.querySelector(".command-label");
      if (sp) {
        sp.textContent = `Guild${g.slice(1)} 祈り [${data.pairId}]`;
      }
    }
  }

  cancelEditMode();
  recalcBattle();
  saveToLocalStorage();
}

/** 編集モード解除 => ボタンを「追加」に戻す */
function cancelEditMode() {
  currentEditId = null;
  document.getElementById("submitCommandBtn").textContent = "追加";
}

/** 祈りコマンドフォーム計算 */
function calcInoriCommandForm() {
  const g = document.getElementById("inoriGuild").value;
  const val = +document.getElementById("inoriValue").value || 0;
  const memC = val / 5;
  const leadC = val / 6.5;
  document.getElementById(
    "inoriMemberCombo"
  ).textContent = `メンバーコンボ数: ${memC.toFixed(2)}`;
  document.getElementById(
    "inoriLeaderCombo"
  ).textContent = `リーダーコンボ数: ${leadC.toFixed(2)}`;

  const base = +document.getElementById(`display-${g}-combo`).textContent || 0;
  let sum1 = 0; // memGP
  for (let i = 0; i < Math.floor(memC); i++) {
    sum1 += 400 * (1 + 0.2 * (base + i));
  }
  let sum2 = 0; // leadGP
  for (let i = 0; i < Math.floor(leadC); i++) {
    sum2 += 400 * (1 + 0.2 * (base + i));
  }
  // (memC+leadC)/2
  const avgC = Math.floor((memC + leadC) / 2);
  document.getElementById("inoriFinalCombo").value = avgC;
}

/** 通常のコマンド追加（編集モードではない） */
function onAddCommand() {
  const cmdType = document.getElementById("cmdTypeSelect").value;

  if (cmdType === "attack") {
    // 出撃
    const guild = document.getElementById("selectGuild").value;
    const role = document.getElementById("selectRole").value;
    const ninzu = +document.getElementById("attackNinzu").value || 1;

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
      alert("ターゲットが選択されていません");
      return;
    }
    const timeB = +document.getElementById("tbAttack").value || 0;

    const cnt = commandCounter[guild];
    const pairId = guild + "_" + cnt;
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
      ninzu,
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
    const fc = +document.getElementById("inoriFinalCombo").value || 0;

    const cnt = commandCounter[guild];
    const pairId = guild + "_" + cnt;
    commandCounter[guild] = cnt + 1;

    const cmdId = pairId + "_inori";
    commandListData.push({
      type: "inori",
      pairId,
      guild,
      prayerValue: val,
      finalCombo: fc,
      calculatedGP: 0,
      cmdId,
    });

    addCommandCard(
      cmdId,
      `Guild${guild.slice(1)} 祈り [${pairId}]`,
      guildColorClass[guild]
    );
  }

  saveToLocalStorage();
  setTimeout(() => recalcBattle(), 100);
}

/************************************************************
 * 5) カード生成(編集ボタン、×ボタン) + titleツールチップ + D&D
 ************************************************************/
function addCommandCard(cmdId, label, cssClass) {
  const ul = document.getElementById("commandList");
  if (!ul) return;

  const li = document.createElement("li");
  li.id = cmdId;
  li.className = "command-item " + cssClass;
  li.draggable = true;

  // メインラベル
  const sp = document.createElement("span");
  sp.className = "command-label";
  sp.textContent = label;
  li.appendChild(sp);

  // 編集ボタン(鉛筆)
  const editBtn = document.createElement("button");
  editBtn.textContent = "✎";
  editBtn.style.marginLeft = "8px";
  editBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    startEditCommand(cmdId);
  });
  li.appendChild(editBtn);

  // 削除ボタン(×)
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  closeBtn.style.marginLeft = "4px";
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    removeCommandCard(cmdId);
  });
  li.appendChild(closeBtn);

  // ツールチップ
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
    // start/end をペア削除
    removeCardDomIfExist(data.startId);
    removeCardDomIfExist(data.endId);
    const idx = commandListData.findIndex(
      (d) => d.type === "attack" && d.pairId === data.pairId
    );
    if (idx >= 0) commandListData.splice(idx, 1);
  } else {
    // 祈り => 1枚
    removeCardDomIfExist(data.cmdId);
    const idx = commandListData.findIndex(
      (d) => d.type === "inori" && d.pairId === data.pairId
    );
    if (idx >= 0) commandListData.splice(idx, 1);
  }

  // 編集モード中のカードを削除した場合 => cancelEdit
  if (currentEditId === cmdId) {
    cancelEditMode();
  }

  saveToLocalStorage();
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
    const r = data.role;
    const t = (data.targets || []).join(",");
    const b = data.timeBonus || 0;
    const g = data.disputeGP || 0;
    const ninzu = data.ninzu || 1;
    liElem.title = `ロール:${r}\nターゲット:${t}\nタイムボーナス:${b}%\n争奪GP:${g}\n出撃人数:${ninzu}`;
  } else {
    const v = data.prayerValue || 0;
    const c = data.finalCombo || 0;
    const gp = data.calculatedGP || 0;
    liElem.title = `祈り値:${v}\nコンボ数:${c}\n獲得GP:${gp}`;
  }
}

/************************************************************
 * 6) 出撃計算(タイムライン):
 *   attack: start => pending, end => 出撃人数ぶんの処理
 *   inori:  ratio補正 => guild & gate
 ************************************************************/
function recalcBattle() {
  // 下部"表示のみ" => gp,combo
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

  // タイムライン順に処理
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
        data.disputeGP = totalS;
      } else if (cId.endsWith("_end")) {
        // end => 出撃人数ぶん GP反映 + コンボ+1
        const pa = pendingActions[data.pairId];
        if (pa) {
          const g = data.guild;
          const ninzu = data.ninzu || 1;
          for (let i = 0; i < ninzu; i++) {
            // 1回ぶん
            for (const t in pa.detailSoudatsu) {
              if (t !== "gate" && t !== g) {
                gp[t] -= pa.detailSoudatsu[t];
                if (gp[t] < 0) gp[t] = 0;
              }
            }
            gp[g] += pa.gain;

            combo[g]++; // コンボ+1
          }
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

      // ゲートサイズ
      const gateSizeSel = document.getElementById("gateSizeSelect");
      const gateRate = parseFloat(gateSizeSel.value) || 1;
      const scaledGateGP = Math.floor(actualGP_gate * gateRate);

      // ギルド反映
      combo[g] += finalC;
      gp[g] += actualGP;

      // ゲート反映
      combo.gate += finalC;
      gp.gate += scaledGateGP;

      data.calculatedGP = actualGP;
    }
  });

  // 出力
  document.getElementById("result-g1").textContent = gp.g1;
  document.getElementById("result-g2").textContent = gp.g2;
  document.getElementById("result-g3").textContent = gp.g3;
  document.getElementById("result-g4").textContent = gp.g4;
  document.getElementById("result-gate").textContent = gp.gate;

  saveToLocalStorage();
}

/** 祈りコマンド => ループGP => 400*(1+0.2*( baseCombo+i )) */
function loopInoriGP_timeline(baseC, c) {
  let sum = 0;
  const loopCount = Math.floor(c);
  for (let i = 0; i < loopCount; i++) {
    const cc = baseC + i;
    sum += 400 * (1 + 0.2 * cc);
  }
  return sum;
}

/************************************************************
 * 7) D&D処理 (handleDragStart等)
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
