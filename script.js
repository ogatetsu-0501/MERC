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

/** ギルド名 */
let guildNames = { g1: "Guild1", g2: "Guild2", g3: "Guild3", g4: "Guild4" };

/** 上部4ギルドの 祈り以外コンボ数(ouenCombo) + 祈りコンボ入力(gpInoriComboMap) 用 */
const ouenComboMap = { g1: 0, g2: 0, g3: 0, g4: 0 };
const gpInoriComboMap = { g1: 0, g2: 0, g3: 0, g4: 0 };

/** コマンドリストデータ (出撃 or 祈り or GP表示) */
let commandListData = [];
/** 出撃コマンド連番 */
const commandCounter = { g1: 1, g2: 1, g3: 1, g4: 1, gpDisplay: 1 };
/** 出撃コマンド start=>end の一時保存 (GP争奪用) */
const pendingActions = {};
/** D&D用 */
let dragSrcEl = null;

/** 編集モード: 現在編集中コマンドID (nullなら通常追加モード) */
let currentEditId = null;

/** Command Types */
const COMMAND_TYPES = ["attack", "inori", "gpDisplay"];

/************************************************************
 * 1) ページロード
 ************************************************************/
window.addEventListener("DOMContentLoaded", () => {
  // ギルド名入力欄のイベントリスナー設定
  ["g1", "g2", "g3", "g4"].forEach((gid) => {
    const nameInput = document.getElementById(`${gid}-name`);
    const displayName = document.getElementById(`${gid}-displayName`);
    const displayGPLabel = document.getElementById(`display-${gid}-name`);
    const displayComboLabel = document.getElementById(
      `display-${gid}-combo-label`
    );
    const displayCombo = document.getElementById(`display-${gid}-combo`);
    const displayGP = document.getElementById(`display-${gid}-gp`);

    if (
      nameInput &&
      displayName &&
      displayGPLabel &&
      displayComboLabel &&
      displayCombo &&
      displayGP
    ) {
      nameInput.addEventListener("input", () => {
        guildNames[gid] = nameInput.value.trim() || `Guild${gid.slice(1)}`;
        displayName.textContent = guildNames[gid];
        updateGuildDisplayLabels(gid);
        updateCommandGuildOptions();
        rebuildCommandTimeline(); // ギルド名変更を反映
        recalcBattle();
        saveToLocalStorage();
      });
    }
  });

  // ギルドごとの入力欄のイベントリスナー設定
  ["g1", "g2", "g3", "g4"].forEach((gid) => {
    const currentGP = document.getElementById(`${gid}-currentGP`);
    const inori = document.getElementById(`${gid}-inori`);
    const ouenType = document.getElementById(`${gid}-ouenType`);
    const ouenGP = document.getElementById(`${gid}-ouenGP`);
    const ouenCombo = document.getElementById(`${gid}-ouenCombo`);
    const deSyGp = document.getElementById(`${gid}-deSyutsuGp`);
    const inoriInput = document.getElementById(`${gid}-inoriInput`);
    const finalCombo = document.getElementById(`${gid}-finalCombo`);

    if (currentGP) currentGP.addEventListener("input", onFieldChange);
    if (inori) inori.addEventListener("input", onFieldChange);
    if (ouenType) ouenType.addEventListener("change", onFieldChange);
    if (ouenGP) ouenGP.addEventListener("input", onFieldChange);
    if (ouenCombo) ouenCombo.addEventListener("input", onFieldChange);
    if (deSyGp) deSyGp.addEventListener("input", onFieldChange);

    // 推定コンボ出力ボタン
    const estBtn = document.getElementById(`${gid}-estimateBtn`);
    if (estBtn) {
      estBtn.addEventListener("click", () => onEstimateCombo(gid));
    }

    // 祈りコンボ入力 => oninput(手動変更) で再計算
    if (inoriInput) {
      inoriInput.addEventListener("input", () => {
        const changed = +inoriInput.value || 0;
        gpInoriComboMap[gid] = changed;
        const ouenC = +document.getElementById(`${gid}-ouenCombo`).value || 0;
        const newF = ouenC + changed;
        document.getElementById(`${gid}-finalCombo`).textContent =
          newF.toString();
        document.getElementById(`display-${gid}-combo`).textContent =
          newF.toString();

        calcGate();
        recalcBattle();
        saveToLocalStorage();
      });
    }
  });

  // コマンドシステム初期化
  initCommandSystem();

  // GP表示コマンドフォームの初期化
  const gpDisplayForm = document.getElementById("gpDisplayForm");
  if (gpDisplayForm) {
    gpDisplayForm.style.display = "none"; // 初期は非表示
  }

  // ゲートサイズ変更 => onFieldChange
  const gateSizeSelect = document.getElementById("gateSizeSelect");
  if (gateSizeSelect) {
    gateSizeSelect.addEventListener("change", onFieldChange);
  }

  // ギルド名編集の初期設定
  initialSetupGuildNames();

  // ローカルストレージ => 復元
  loadFromLocalStorage();

  // 初期計算 (各ギルド & ゲート & 出撃計算)
  ["g1", "g2", "g3", "g4"].forEach((gid) => calcInori(gid));
  calcGate();
  recalcBattle();

  // 自ギルドターゲット無効化
  const selectGuildEl = document.getElementById("selectGuild");
  if (selectGuildEl) {
    selectGuildEl.addEventListener("change", disableSelfGuildTarget);
    disableSelfGuildTarget();
  }
});

/************************************************************
 * 2) onFieldChange => 全再計算 & 保存
 ************************************************************/
function onFieldChange() {
  ["g1", "g2", "g3", "g4"].forEach((gid) => calcInori(gid));
  calcGate();
  recalcBattle();
  saveToLocalStorage();
}

/************************************************************
 * 推定コンボ出力ボタン => onEstimateCombo
 ************************************************************/
function onEstimateCombo(gid) {
  const inoriVal = +document.getElementById(`${gid}-inori`).value || 0;
  const memberC = inoriVal / 5;
  const leaderC = inoriVal / 6.5;
  const ratioEl = document.getElementById(`${gid}-leaderRatio`);
  let ratio = 35;
  if (ratioEl) {
    ratio = +ratioEl.value || 35;
  }

  const est = leaderC + (memberC - leaderC) * (ratio / 100);
  const finalEst = Math.floor(est);

  // 祈りコンボ入力に出力 & gpInoriComboMap更新
  const inoriInputEl = document.getElementById(`${gid}-inoriInput`);
  if (inoriInputEl) {
    inoriInputEl.value = finalEst;
  }
  gpInoriComboMap[gid] = finalEst;

  // 祈り以外コンボ数 + finalEst => 最終コンボ
  const ouenC = +document.getElementById(`${gid}-ouenCombo`).value || 0;
  const newF = ouenC + finalEst;
  document.getElementById(`${gid}-finalCombo`).textContent = newF.toString();
  document.getElementById(`display-${gid}-combo`).textContent = newF.toString();

  calcGate();
  recalcBattle();
  saveToLocalStorage();
}

/************************************************************
 * 追加: rebuildCommandTimeline (ローカルストレージ復元で使用)
 ************************************************************/
function rebuildCommandTimeline() {
  const ul = document.getElementById("commandList");
  if (!ul) return;
  ul.innerHTML = "";
  commandListData.forEach((cmd) => {
    if (cmd.type === "attack") {
      addCommandCard(
        cmd.startId,
        `${guildNames[cmd.guild]} 出撃(${cmd.role}) [${cmd.pairId}]`,
        guildColorClass[cmd.guild]
      );
      addCommandCard(
        cmd.endId,
        `${guildNames[cmd.guild]} 終了(${cmd.role}) [${cmd.pairId}]`,
        guildColorClass[cmd.guild]
      );
    } else if (cmd.type === "inori") {
      addCommandCard(
        cmd.cmdId,
        `${guildNames[cmd.guild]} 祈り [${cmd.pairId}]`,
        guildColorClass[cmd.guild]
      );
    } else if (cmd.type === "gpDisplay") {
      addCommandCard(
        cmd.cmdId,
        `${cmd.title} [${cmd.pairId}]`,
        guildColorClass[cmd.guild] // 任意のギルド色を使用
      );
    }
  });
}

/************************************************************
 * ローカルストレージ 保存/復元
 ************************************************************/
function saveToLocalStorage() {
  let storeData = {
    // ギルド名
    "g1-name": document.getElementById("g1-name").value,
    "g2-name": document.getElementById("g2-name").value,
    "g3-name": document.getElementById("g3-name").value,
    "g4-name": document.getElementById("g4-name").value,

    // g1
    "g1-currentGP": document.getElementById("g1-currentGP").value,
    "g1-inori": document.getElementById("g1-inori").value,
    "g1-ouenType": document.getElementById("g1-ouenType").value,
    "g1-ouenGP": document.getElementById("g1-ouenGP").value,
    "g1-ouenCombo": document.getElementById("g1-ouenCombo").value,
    "g1-deSyutsuGp": document.getElementById("g1-deSyutsuGp").value,
    "g1-inoriInput": document.getElementById("g1-inoriInput").value,

    // g2
    "g2-currentGP": document.getElementById("g2-currentGP").value,
    "g2-inori": document.getElementById("g2-inori").value,
    "g2-ouenType": document.getElementById("g2-ouenType").value,
    "g2-ouenGP": document.getElementById("g2-ouenGP").value,
    "g2-ouenCombo": document.getElementById("g2-ouenCombo").value,
    "g2-deSyutsuGp": document.getElementById("g2-deSyutsuGp").value,
    "g2-inoriInput": document.getElementById("g2-inoriInput").value,

    // g3
    "g3-currentGP": document.getElementById("g3-currentGP").value,
    "g3-inori": document.getElementById("g3-inori").value,
    "g3-ouenType": document.getElementById("g3-ouenType").value,
    "g3-ouenGP": document.getElementById("g3-ouenGP").value,
    "g3-ouenCombo": document.getElementById("g3-ouenCombo").value,
    "g3-deSyutsuGp": document.getElementById("g3-deSyutsuGp").value,
    "g3-inoriInput": document.getElementById("g3-inoriInput").value,

    // g4
    "g4-currentGP": document.getElementById("g4-currentGP").value,
    "g4-inori": document.getElementById("g4-inori").value,
    "g4-ouenType": document.getElementById("g4-ouenType").value,
    "g4-ouenGP": document.getElementById("g4-ouenGP").value,
    "g4-ouenCombo": document.getElementById("g4-ouenCombo").value,
    "g4-deSyutsuGp": document.getElementById("g4-deSyutsuGp").value,
    "g4-inoriInput": document.getElementById("g4-inoriInput").value,

    // ゲートサイズ
    gateSizeSelect: document.getElementById("gateSizeSelect").value,

    // コマンドフォーム
    cmdTypeSelect: document.getElementById("cmdTypeSelect").value,
    selectGuild: document.getElementById("selectGuild").value,
    selectRole: document.getElementById("selectRole").value,
    attackNinzu: document.getElementById("attackNinzu").value,
    tbAttack: document.getElementById("tbAttack").value,

    // 祈りコマンドフォーム
    inoriGuild: document.getElementById("inoriGuild").value,
    inoriValue: document.getElementById("inoriValue").value,
    inoriFinalCombo: document.getElementById("inoriFinalCombo").value,

    // GP表示コマンドフォーム
    gpDisplayTitle: document.getElementById("gpDisplayTitle").value,

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

    // ギルド名の復元
    ["g1", "g2", "g3", "g4"].forEach((gid) => {
      if (storeData[`${gid}-name`] !== undefined) {
        document.getElementById(`${gid}-name`).value = storeData[`${gid}-name`];
        guildNames[gid] = storeData[`${gid}-name`] || `Guild${gid.slice(1)}`;
        // Update display name
        const displayName = document.getElementById(`${gid}-displayName`);
        if (displayName) displayName.textContent = guildNames[gid];
        // Update display labels
        updateGuildDisplayLabels(gid);
      }
    });

    // g1
    if (storeData["g1-currentGP"] !== undefined) {
      document.getElementById("g1-currentGP").value = storeData["g1-currentGP"];
      document.getElementById("g1-inori").value = storeData["g1-inori"];
      document.getElementById("g1-ouenType").value = storeData["g1-ouenType"];
      document.getElementById("g1-ouenGP").value = storeData["g1-ouenGP"];
      document.getElementById("g1-ouenCombo").value = storeData["g1-ouenCombo"];
      document.getElementById("g1-deSyutsuGp").value =
        storeData["g1-deSyutsuGp"];
      // 祈りコンボ入力 (手動入力欄)
      if (storeData["g1-inoriInput"] !== undefined) {
        document.getElementById("g1-inoriInput").value =
          storeData["g1-inoriInput"];
        gpInoriComboMap["g1"] = +storeData["g1-inoriInput"];
      }
    }
    // g2
    if (storeData["g2-currentGP"] !== undefined) {
      document.getElementById("g2-currentGP").value = storeData["g2-currentGP"];
      document.getElementById("g2-inori").value = storeData["g2-inori"];
      document.getElementById("g2-ouenType").value = storeData["g2-ouenType"];
      document.getElementById("g2-ouenGP").value = storeData["g2-ouenGP"];
      document.getElementById("g2-ouenCombo").value = storeData["g2-ouenCombo"];
      document.getElementById("g2-deSyutsuGp").value =
        storeData["g2-deSyutsuGp"];
      if (storeData["g2-inoriInput"] !== undefined) {
        document.getElementById("g2-inoriInput").value =
          storeData["g2-inoriInput"];
        gpInoriComboMap["g2"] = +storeData["g2-inoriInput"];
      }
    }
    // g3
    if (storeData["g3-currentGP"] !== undefined) {
      document.getElementById("g3-currentGP").value = storeData["g3-currentGP"];
      document.getElementById("g3-inori").value = storeData["g3-inori"];
      document.getElementById("g3-ouenType").value = storeData["g3-ouenType"];
      document.getElementById("g3-ouenGP").value = storeData["g3-ouenGP"];
      document.getElementById("g3-ouenCombo").value = storeData["g3-ouenCombo"];
      document.getElementById("g3-deSyutsuGp").value =
        storeData["g3-deSyutsuGp"];
      if (storeData["g3-inoriInput"] !== undefined) {
        document.getElementById("g3-inoriInput").value =
          storeData["g3-inoriInput"];
        gpInoriComboMap["g3"] = +storeData["g3-inoriInput"];
      }
    }
    // g4
    if (storeData["g4-currentGP"] !== undefined) {
      document.getElementById("g4-currentGP").value = storeData["g4-currentGP"];
      document.getElementById("g4-inori").value = storeData["g4-inori"];
      document.getElementById("g4-ouenType").value = storeData["g4-ouenType"];
      document.getElementById("g4-ouenGP").value = storeData["g4-ouenGP"];
      document.getElementById("g4-ouenCombo").value = storeData["g4-ouenCombo"];
      document.getElementById("g4-deSyutsuGp").value =
        storeData["g4-deSyutsuGp"];
      if (storeData["g4-inoriInput"] !== undefined) {
        document.getElementById("g4-inoriInput").value =
          storeData["g4-inoriInput"];
        gpInoriComboMap["g4"] = +storeData["g4-inoriInput"];
      }
    }

    // ゲートサイズ
    if (storeData["gateSizeSelect"] !== undefined) {
      document.getElementById("gateSizeSelect").value =
        storeData["gateSizeSelect"];
    }

    // コマンド追加フォーム
    if (storeData["cmdTypeSelect"] !== undefined) {
      document.getElementById("cmdTypeSelect").value =
        storeData["cmdTypeSelect"];
      // トリガーの表示切替
      const event = new Event("change");
      document.getElementById("cmdTypeSelect").dispatchEvent(event);
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

    // GP表示コマンドフォーム
    if (storeData["gpDisplayTitle"] !== undefined) {
      document.getElementById("gpDisplayTitle").value =
        storeData["gpDisplayTitle"];
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

/************************************************************
 * 3) 祈り計算 & ゲート計算
 ************************************************************/
function disableSelfGuildTarget() {
  const sel = document.getElementById("selectGuild").value;
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

/** 1ギルドの祈り計算 =>
 *  メンバー/リーダーコンボ数 & 祈りコンボ入力 & 最終コンボ を表示更新
 *  さらに "祈りGP"/"GP祈りコンボ数" をアコーディオンに複製
 */
function calcInori(gid) {
  const curGP = +document.getElementById(`${gid}-currentGP`).value || 0;
  const inoriVal = +document.getElementById(`${gid}-inori`).value || 0;
  const ouenGP = +document.getElementById(`${gid}-ouenGP`).value || 0;
  const ouenCombo = +document.getElementById(`${gid}-ouenCombo`).value || 0;
  const deSyGp = +document.getElementById(`${gid}-deSyutsuGp`).value || 0;

  const prayerGP = curGP - ouenGP - deSyGp;
  const memberC = inoriVal / 5;
  const leaderC = inoriVal / 6.5;

  // ループしてGP祈りコンボ数を算出
  let c = ouenCombo;
  let total = 0;
  while (true) {
    const add = 400 * (1 + 0.002 * c);
    if (total + add > prayerGP) break;
    total += add;
    c++;
  }
  const gpInori = Math.max(0, c - 1 - ouenCombo);

  // メンバーコンボ数 / リーダーコンボ数
  document.getElementById(
    `${gid}-memberCombo`
  ).textContent = `メンバーコンボ数: ${memberC.toFixed(2)}`;
  document.getElementById(
    `${gid}-leaderCombo`
  ).textContent = `リーダーコンボ数: ${leaderC.toFixed(2)}`;

  // 祈りコンボ入力
  const inoriInputEl = document.getElementById(`${gid}-inoriInput`);
  if (inoriInputEl) {
    inoriInputEl.value = gpInori;
  }
  gpInoriComboMap[gid] = gpInori;

  // 最終コンボ = (祈り以外コンボ数 + 祈りコンボ)
  const finalC = ouenCombo + gpInori;
  document.getElementById(`${gid}-finalCombo`).textContent = finalC.toString();

  // 下部ギルド情報(表示のみ)
  document.getElementById(`display-${gid}-gp`).textContent = curGP.toString();
  document.getElementById(`display-${gid}-combo`).textContent =
    finalC.toString();

  // アコーディオン(応援/出撃)に 祈りGP, GP祈りコンボ数 を複製
  const prayerGP_ouen = document.getElementById(`${gid}-prayerGP-accOuen`);
  if (prayerGP_ouen) {
    prayerGP_ouen.textContent =
      prayerGP < 0 ? `${prayerGP} (マイナス?)` : prayerGP;
  }
  const gpInori_ouen = document.getElementById(`${gid}-gpInoriCombo-accOuen`);
  if (gpInori_ouen) {
    gpInori_ouen.textContent = gpInori.toString();
  }
  const prayerGP_syut = document.getElementById(`${gid}-prayerGP-accSyutsu`);
  if (prayerGP_syut) {
    prayerGP_syut.textContent =
      prayerGP < 0 ? `${prayerGP} (マイナス?)` : prayerGP;
  }
  const gpInori_syut = document.getElementById(`${gid}-gpInoriCombo-accSyutsu`);
  if (gpInori_syut) {
    gpInori_syut.textContent = gpInori.toString();
  }
}

/** ゲート計算 => サイズ反映 */
function calcGate() {
  let totalCombo = 0;
  ["g1", "g2", "g3", "g4"].forEach((g) => {
    totalCombo += gpInoriComboMap[g];
  });
  let rawGateGP = 0;
  for (let c = 1; c < totalCombo; c++) {
    rawGateGP += 400 * (1 + 0.002 * c);
  }
  rawGateGP = Math.floor(rawGateGP);

  const gateSel = document.getElementById("gateSizeSelect");
  const rate = parseFloat(gateSel.value) || 1;
  const finalGateGP = Math.floor(rawGateGP * rate);

  document.getElementById("display-gate-combo").textContent =
    totalCombo.toString();
  document.getElementById("display-gate-gp").textContent =
    finalGateGP.toString();
}

/************************************************************
 * 4) コマンド追加フォーム + 編集モード
 ************************************************************/
function initCommandSystem() {
  const cmdTypeSel = document.getElementById("cmdTypeSelect");
  const attackForm = document.getElementById("attackForm");
  const inoriForm = document.getElementById("inoriForm");
  const gpDisplayForm = document.getElementById("gpDisplayForm"); // GP表示フォーム

  cmdTypeSel.addEventListener("change", () => {
    const v = cmdTypeSel.value;
    if (v === "attack") {
      attackForm.style.display = "";
      inoriForm.style.display = "none";
      if (gpDisplayForm) gpDisplayForm.style.display = "none";
    } else if (v === "inori") {
      attackForm.style.display = "none";
      inoriForm.style.display = "";
      if (gpDisplayForm) gpDisplayForm.style.display = "none";
      calcInoriCommandForm();
    } else if (v === "gpDisplay") {
      // GP表示フォームの表示
      attackForm.style.display = "none";
      inoriForm.style.display = "none";
      if (gpDisplayForm) gpDisplayForm.style.display = "";
    }
    saveToLocalStorage();
  });

  // 祈りコマンドフォーム
  const inoriGuildEl = document.getElementById("inoriGuild");
  if (inoriGuildEl) {
    inoriGuildEl.addEventListener("change", calcInoriCommandForm);
  }
  const inoriValueEl = document.getElementById("inoriValue");
  if (inoriValueEl) {
    inoriValueEl.addEventListener("input", calcInoriCommandForm);
  }
  const inoriFinalComboEl = document.getElementById("inoriFinalCombo");
  if (inoriFinalComboEl) {
    inoriFinalComboEl.addEventListener("input", () => {
      recalcBattle();
      saveToLocalStorage();
    });
  }

  // GP表示コマンドフォーム
  const gpDisplayTitleEl = document.getElementById("gpDisplayTitle");
  if (gpDisplayTitleEl) {
    gpDisplayTitleEl.addEventListener("input", calcGpDisplayForm);
  }

  // メインボタン (追加/変更兼用)
  document
    .getElementById("submitCommandBtn")
    .addEventListener("click", onSubmitCommand);
}

/** onSubmitCommand => 追加 or 変更 */
function onSubmitCommand(e) {
  e.preventDefault();
  if (currentEditId) {
    applyUpdateCommand(); // 編集適用
  } else {
    onAddCommand(); // 新規追加
  }
}

/** コマンド編集開始 */
function startEditCommand(cmdId) {
  currentEditId = cmdId;
  const data = findCmdDataById(cmdId);
  if (!data) return;

  const cmdTypeSel = document.getElementById("cmdTypeSelect");
  const attackForm = document.getElementById("attackForm");
  const inoriForm = document.getElementById("inoriForm");
  const gpDisplayForm = document.getElementById("gpDisplayForm"); // GP表示フォーム

  if (data.type === "attack") {
    cmdTypeSel.value = "attack";
    attackForm.style.display = "";
    inoriForm.style.display = "none";
    if (gpDisplayForm) gpDisplayForm.style.display = "none";

    document.getElementById("selectGuild").value = data.guild;
    disableSelfGuildTarget();
    document.getElementById("selectRole").value = data.role;
    document.getElementById("attackNinzu").value = data.ninzu || 1;
    document.getElementById("tbAttack").value = data.timeBonus || 0;

    // ターゲット
    const cbs = document.querySelectorAll(".chk-target");
    cbs.forEach((cb) => (cb.checked = false));
    (data.targets || []).forEach((t) => {
      const c = document.querySelector(`.chk-target[value="${t}"]`);
      if (c) c.checked = true;
    });
  } else if (data.type === "inori") {
    cmdTypeSel.value = "inori";
    attackForm.style.display = "none";
    inoriForm.style.display = "";
    if (gpDisplayForm) gpDisplayForm.style.display = "none";

    document.getElementById("inoriGuild").value = data.guild;
    document.getElementById("inoriValue").value = data.prayerValue || 0;
    document.getElementById("inoriFinalCombo").value = data.finalCombo || 0;
  } else if (data.type === "gpDisplay") {
    cmdTypeSel.value = "gpDisplay";
    attackForm.style.display = "none";
    inoriForm.style.display = "none";
    if (gpDisplayForm) gpDisplayForm.style.display = "";

    document.getElementById("gpDisplayTitle").value =
      data.title || "GP Display";
  }
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

  const cmdTypeSel = document.getElementById("cmdTypeSelect");
  const attackForm = document.getElementById("attackForm");
  const inoriForm = document.getElementById("inoriForm");
  const gpDisplayForm = document.getElementById("gpDisplayForm"); // GP表示フォーム

  const cmdType = cmdTypeSel.value;
  if (cmdType === "attack") {
    const guild = document.getElementById("selectGuild").value;
    const role = document.getElementById("selectRole").value;
    const ninzu = +document.getElementById("attackNinzu").value || 1;
    const tb = +document.getElementById("tbAttack").value || 0;

    const cbs = document.querySelectorAll(".chk-target");
    let tg = [];
    cbs.forEach((cb) => {
      if (cb.checked) tg.push(cb.value);
    });
    tg = tg.filter((x) => x !== guild);

    data.guild = guild;
    data.role = role;
    data.ninzu = ninzu;
    data.timeBonus = tb;
    data.targets = tg;

    // ラベル更新
    const sLi = document.getElementById(data.startId);
    if (sLi) {
      const sp = sLi.querySelector(".command-label");
      if (sp) {
        sp.textContent = `${guildNames[guild]} 出撃(${role}) [${data.pairId}]`;
      }
    }
    const eLi = document.getElementById(data.endId);
    if (eLi) {
      const sp = eLi.querySelector(".command-label");
      if (sp) {
        sp.textContent = `${guildNames[guild]} 終了(${role}) [${data.pairId}]`;
      }
    }
  } else if (cmdType === "inori") {
    const g = document.getElementById("inoriGuild").value;
    const val = +document.getElementById("inoriValue").value || 0;
    const fc = +document.getElementById("inoriFinalCombo").value || 0;
    data.guild = g;
    data.prayerValue = val;
    data.finalCombo = fc;

    const li = document.getElementById(data.cmdId);
    if (li) {
      const sp = li.querySelector(".command-label");
      if (sp) {
        sp.textContent = `${guildNames[g]} 祈り [${data.pairId}]`;
      }
    }
  } else if (cmdType === "gpDisplay") {
    const title =
      document.getElementById("gpDisplayTitle").value.trim() || "GP Display";
    data.title = title;

    const li = document.getElementById(data.cmdId);
    if (li) {
      const sp = li.querySelector(".command-label");
      if (sp) {
        sp.textContent = `${title} [${data.pairId}]`;
      }
    }
  }
  cancelEditMode();
  recalcBattle();
  saveToLocalStorage();
}

/** 編集モード解除 */
function cancelEditMode() {
  currentEditId = null;
  document.getElementById("submitCommandBtn").textContent = "追加";
}

/** 祈りコマンドフォーム 計算 (メンバー/リーダーコンボ数) */
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
  let sum1 = 0;
  for (let i = 0; i < Math.floor(memC); i++) {
    sum1 += 400 * (1 + 0.2 * (base + i));
  }
  let sum2 = 0;
  for (let i = 0; i < Math.floor(leadC); i++) {
    sum2 += 400 * (1 + 0.2 * (base + i));
  }
  const avgC = Math.floor((memC + leadC) / 2);
  document.getElementById("inoriFinalCombo").value = avgC;
}

/** GP表示コマンドフォーム 計算 */
function calcGpDisplayForm() {
  // ここでは特に計算は必要ない場合が多いですが、
  // 必要に応じてフォームの検証や動的計算を追加できます。
}

/** コマンド追加 (出撃 or 祈り or GP表示) */
function onAddCommand() {
  const t = document.getElementById("cmdTypeSelect").value;
  if (t === "attack") {
    const guild = document.getElementById("selectGuild").value;
    const role = document.getElementById("selectRole").value;
    const ninzu = +document.getElementById("attackNinzu").value || 1;

    const cbs = document.querySelectorAll(".chk-target");
    let tg = [];
    cbs.forEach((cb) => {
      if (cb.checked) tg.push(cb.value);
    });
    tg = tg.filter((x) => x !== guild);
    if (tg.length > 3) {
      alert("ターゲットは最大3つまで");
      return;
    }
    if (tg.length === 0) {
      alert("ターゲットが選択されていません");
      return;
    }
    const tb = +document.getElementById("tbAttack").value || 0;

    const cnt = commandCounter[guild] || 1;
    const pairId = guild + "_" + cnt;
    commandCounter[guild] = cnt + 1;

    const sId = pairId + "_start";
    const eId = pairId + "_end";
    commandListData.push({
      type: "attack",
      pairId,
      guild,
      role,
      targets: tg,
      timeBonus: tb,
      startId: sId,
      endId: eId,
      disputeGP: 0,
      ninzu,
    });
    addCommandCard(
      sId,
      `${guildNames[guild]} 出撃(${role}) [${pairId}]`,
      guildColorClass[guild]
    );
    addCommandCard(
      eId,
      `${guildNames[guild]} 終了(${role}) [${pairId}]`,
      guildColorClass[guild]
    );
    cbs.forEach((cb) => (cb.checked = false));
    document.getElementById("tbAttack").value = "0";
  } else if (t === "inori") {
    const guild = document.getElementById("inoriGuild").value;
    const val = +document.getElementById("inoriValue").value || 0;
    const fc = +document.getElementById("inoriFinalCombo").value || 0;

    const cnt = commandCounter[guild] || 1;
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
      `${guildNames[guild]} 祈り [${pairId}]`,
      guildColorClass[guild]
    );
  } else if (t === "gpDisplay") {
    // GP表示コマンドの追加
    const title =
      document.getElementById("gpDisplayTitle").value.trim() || "GP Display";

    const cnt = commandCounter["gpDisplay"] || 1;
    const pairId = `gpDisplay_${cnt}`;
    commandCounter["gpDisplay"] = cnt + 1;

    const cmdId = pairId + "_gpDisplay";
    commandListData.push({
      type: "gpDisplay",
      pairId,
      guild: "g1", // 任意のギルド色を使用
      title,
      cmdId,
    });
    addCommandCard(
      cmdId,
      `${title} [${pairId}]`,
      guildColorClass["g1"] // GP表示コマンドにデフォルトの色を適用
    );
  }

  saveToLocalStorage();
  setTimeout(() => recalcBattle(), 100);
}

/************************************************************
 * 5) カード生成 + D&D
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
  const delBtn = document.createElement("button");
  delBtn.textContent = "×";
  delBtn.style.marginLeft = "4px";
  delBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    removeCommandCard(cmdId);
  });
  li.appendChild(delBtn);

  // マウスオーバー => ツールチップ更新
  li.addEventListener("mouseover", () => updateCardTitle(cmdId, li));

  // D&D
  li.addEventListener("dragstart", handleDragStart);
  li.addEventListener("dragover", handleDragOver);
  li.addEventListener("dragleave", handleDragLeave);
  li.addEventListener("drop", handleDrop);
  li.addEventListener("dragend", handleDragEnd);

  ul.appendChild(li);
}

function removeCommandCard(cmdId) {
  const data = findCmdDataById(cmdId);
  if (!data) return;

  if (data.type === "attack") {
    removeCardDomIfExist(data.startId);
    removeCardDomIfExist(data.endId);
    const idx = commandListData.findIndex(
      (d) => d.type === "attack" && d.pairId === data.pairId
    );
    if (idx >= 0) commandListData.splice(idx, 1);
  } else if (data.type === "inori") {
    removeCardDomIfExist(data.cmdId);
    const idx = commandListData.findIndex(
      (d) => d.type === "inori" && d.pairId === data.pairId
    );
    if (idx >= 0) commandListData.splice(idx, 1);
  } else if (data.type === "gpDisplay") {
    // GP表示コマンドの削除
    removeCardDomIfExist(data.cmdId);
    const idx = commandListData.findIndex(
      (d) => d.type === "gpDisplay" && d.pairId === d.pairId
    );
    if (idx >= 0) commandListData.splice(idx, 1);
  }

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
      (d.type === "inori" && d.cmdId === cmdId) ||
      (d.type === "gpDisplay" && d.cmdId === cmdId)
  );
}

function removeCardDomIfExist(cId) {
  const li = document.getElementById(cId);
  if (li && li.parentNode) {
    li.parentNode.removeChild(li);
  }
}

/** カードtitle更新 */
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
    liElem.title = `ロール: ${r}\nターゲット: ${t}\nタイムボーナス: ${b}%\n争奪GP: ${g}\n出撃人数: ${ninzu}`;
  } else if (data.type === "inori") {
    const v = data.prayerValue || 0;
    const c = data.finalCombo || 0;
    const gp = data.calculatedGP || 0;
    liElem.title = `祈り値: ${v}\nコンボ数: ${c}\n獲得GP: ${gp}`;
  } else if (data.type === "gpDisplay") {
    const t = data.title || "GP Display";
    liElem.title = `タイトル: ${t}\n現在のGPを表示します。`;
  }
}

/************************************************************
 * 6) 出撃計算(タイムライン) + コンソール出力
 ************************************************************/
function recalcBattle() {
  console.log("=== recalcBattle start ===");

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
  console.log(
    "初期GP:",
    JSON.stringify(gp),
    "初期Combo:",
    JSON.stringify(combo)
  );

  // pending初期化
  for (const k in pendingActions) {
    delete pendingActions[k];
  }

  // GP表示リストのクリア
  const gpDisplayList = document.getElementById("gpDisplayList");
  if (gpDisplayList) {
    gpDisplayList.innerHTML = "";
  }

  const items = document.getElementById("commandList").querySelectorAll("li");
  items.forEach((li) => {
    const cmdId = li.id;
    const data = findCmdDataById(cmdId);
    if (!data) {
      console.log(`  [${cmdId}] data not found`);
      return;
    }
    if (data.type === "attack") {
      const isStart = cmdId.endsWith("_start");
      const isEnd = cmdId.endsWith("_end");
      if (isStart) {
        const role = data.role;
        const g = data.guild;
        const tb = data.timeBonus || 0;
        const t = data.targets || [];
        const rate = role === "leader" ? 0.025 : 0.01;

        console.log(
          `  [${cmdId}] start ATTACK: guild=${g}, role=${role}, combo=${combo[g]}, timeBonus=${tb}%`
        );
        let totalS = 0;
        let detailS = {};
        t.forEach((x) => {
          if (gp[x] !== undefined && x !== g) {
            const d = Math.floor(gp[x] * rate);
            detailS[x] = d;
            totalS += d;
            console.log(`    - Target: ${x} => partialSoudatsu: ${d}`);
          }
        });
        console.log(
          `    => totalSoudatsu=${totalS}, base=4000*(1+0.002*${combo[g]})`
        );
        const base = 4000 * (1 + 0.002 * combo[g]);
        const gain = (base + totalS) * (1 + tb / 100);
        const floorG = Math.floor(gain);
        console.log(`    => gain=${floorG}`);

        pendingActions[data.pairId] = {
          detailSoudatsu: detailS,
          totalSoudatsu: totalS,
          gain: floorG,
        };
        data.disputeGP = totalS;
      } else if (isEnd) {
        const pa = pendingActions[data.pairId];
        if (pa) {
          const g = data.guild;
          const ninzu = data.ninzu || 1;
          console.log(
            `  [${cmdId}] end ATTACK: guild=${g}, ninzu=${ninzu}, pendingGain=${pa.gain}`
          );
          for (let i = 0; i < ninzu; i++) {
            console.log(
              `    => iteration ${
                i + 1
              }/${ninzu} => before GP: ${JSON.stringify(
                gp
              )} combo: ${JSON.stringify(combo)}`
            );
            for (const x in pa.detailSoudatsu) {
              if (x !== "gate" && x !== g) {
                gp[x] -= pa.detailSoudatsu[x];
                if (gp[x] < 0) gp[x] = 0;
              }
            }
            gp[g] += pa.gain;
            combo[g]++;
            console.log(
              `    => after iteration => GP: ${JSON.stringify(
                gp
              )}, combo: ${JSON.stringify(combo)}`
            );
          }
          delete pendingActions[data.pairId];
        }
      }
    } else if (data.type === "inori") {
      console.log(
        `  [${cmdId}] INORI: guild=${data.guild}, finalCombo=${data.finalCombo}`
      );
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
      const memGP_g = loopInoriGP_timeline(combo[g], memC);
      const leadGP_g = loopInoriGP_timeline(combo[g], leadC);
      let actualGP = memGP_g + ratio * (leadGP_g - memGP_g);
      actualGP = Math.floor(actualGP);

      const memGP_gate = loopInoriGP_timeline(combo.gate, memC);
      const leadGP_gate = loopInoriGP_timeline(combo.gate, leadC);
      let actualGP_gate = memGP_gate + ratio * (leadGP_gate - memGP_gate);
      actualGP_gate = Math.floor(actualGP_gate);

      const rate =
        parseFloat(document.getElementById("gateSizeSelect").value) || 1;
      const scaledGateGP = Math.floor(actualGP_gate * rate);

      console.log(
        `    => guild side => memGP=${memGP_g}, leadGP=${leadGP_g}, finalGP=${actualGP}`
      );
      console.log(
        `    => gate side => memGP=${memGP_gate}, leadGP=${leadGP_gate}, finalGP=${actualGP_gate}, scaled=${scaledGateGP}`
      );

      combo[g] += finalC;
      gp[g] += actualGP;
      combo.gate += finalC;
      gp.gate += scaledGateGP;

      data.calculatedGP = actualGP;
      console.log(
        `    => after => GP: ${JSON.stringify(gp)}, COMBO: ${JSON.stringify(
          combo
        )}`
      );
    } else if (data.type === "gpDisplay") {
      // GP表示コマンドの処理
      console.log(
        `  [${cmdId}] GP表示: title=${data.title}, pairId=${data.pairId}`
      );

      const title = data.title || "GP Display";

      // 現在のGP情報を取得
      const currentGPs = {
        gate: gp.gate,
        g1: gp.g1,
        g2: gp.g2,
        g3: gp.g3,
        g4: gp.g4,
      };

      // GP表示リストに追加
      const gpDisplayList = document.getElementById("gpDisplayList");
      if (gpDisplayList) {
        const gpDisplayItem = document.createElement("div");
        gpDisplayItem.className = "gp-display-item";
        gpDisplayItem.innerHTML = `
          <strong>${title} [${data.pairId}]</strong><br>
          <ul>
            <li>ゲートGP: ${currentGPs.gate}</li>
            <li>${guildNames.g1} GP: ${currentGPs.g1}</li>
            <li>${guildNames.g2} GP: ${currentGPs.g2}</li>
            <li>${guildNames.g3} GP: ${currentGPs.g3}</li>
            <li>${guildNames.g4} GP: ${currentGPs.g4}</li>
          </ul>
        `;
        gpDisplayList.appendChild(gpDisplayItem);
      }
    }
  });

  console.log("=== recalcBattle end => finalGP:", gp, " finalCombo:", combo);

  // 最終GP表示
  document.getElementById("result-g1").textContent = gp.g1;
  document.getElementById("result-g2").textContent = gp.g2;
  document.getElementById("result-g3").textContent = gp.g3;
  document.getElementById("result-g4").textContent = gp.g4;
  document.getElementById("result-gate").textContent = gp.gate;

  saveToLocalStorage();
}

/** 祈り => ループGP => 400*(1+0.2*(baseCombo+i)) */
function loopInoriGP_timeline(baseC, loopLen) {
  let sum = 0;
  const n = Math.floor(loopLen);
  for (let i = 0; i < n; i++) {
    const cc = baseC + i;
    sum += 400 * (1 + 0.2 * cc);
  }
  return Math.floor(sum);
}

/************************************************************
 * 7) D&D 処理
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

/************************************************************
 * 8) ギルド表示ラベル更新
 ************************************************************/
function updateGuildDisplayLabels(gid) {
  // ギルド情報(表示のみ)のラベル更新
  const displayNameLabel = document.getElementById(`display-${gid}-name`);
  if (displayNameLabel) {
    displayNameLabel.textContent = `${guildNames[gid]} GP:`;
  }
  const displayComboLabel = document.getElementById(
    `display-${gid}-combo-label`
  );
  if (displayComboLabel) {
    displayComboLabel.textContent = `${guildNames[gid]} Combo:`;
  }

  // ギルドタイムラインに既に存在するコマンドラベルも更新されます
  // 既にギルド名を参照しているため、既存のコマンドカードは自動的に新しいギルド名を使用します
}

/************************************************************
 * 9) ギルド選択リストのオプション更新
 ************************************************************/
function updateCommandGuildOptions() {
  const guildSelects = [
    document.getElementById("selectGuild"),
    document.getElementById("inoriGuild"),
    // GP Display Commandはギルドを選択しないため含めない
  ];

  guildSelects.forEach((select) => {
    if (select) {
      // Clear existing options
      while (select.firstChild) {
        select.removeChild(select.firstChild);
      }
      // Add updated options
      ["g1", "g2", "g3", "g4"].forEach((gid) => {
        const option = document.createElement("option");
        option.value = gid;
        option.textContent = guildNames[gid];
        select.appendChild(option);
      });
    }
  });
}

/************************************************************
 * 10) ギルド名変更時にコマンド追加フォームのターゲット更新
 ************************************************************/
function rebuildCommandTargets() {
  const targetSection = document.querySelector("#attackForm div.targets");
  if (targetSection) {
    targetSection.innerHTML = `
      <label><input type="checkbox" class="chk-target" value="gate">Gate</label><br/>
      <label><input type="checkbox" class="chk-target" value="g1">${guildNames.g1}</label><br/>
      <label><input type="checkbox" class="chk-target" value="g2">${guildNames.g2}</label><br/>
      <label><input type="checkbox" class="chk-target" value="g3">${guildNames.g3}</label><br/>
      <label><input type="checkbox" class="chk-target" value="g4">${guildNames.g4}</label>
    `;
  }
}

/************************************************************
 * 11) ギルド名変更時にコマンド追加フォームのターゲット更新
 ************************************************************/
function updateCommandGuildSections() {
  // Update command addition targets
  rebuildCommandTargets();
}

/************************************************************
 * 12) コマンド追加フォームのターゲット更新をギルド名変更時に呼び出す
 ************************************************************/
function handleGuildNameChange(gid) {
  updateGuildDisplayLabels(gid);
  updateCommandGuildOptions();
  updateCommandGuildSections();
  rebuildCommandTimeline();
  recalcBattle();
  saveToLocalStorage();
}

/************************************************************
 * 13) ギルド名編集時にコマンド追加フォームのターゲット更新を呼び出す
 ************************************************************/
function initialSetupGuildNames() {
  ["g1", "g2", "g3", "g4"].forEach((gid) => {
    const nameInput = document.getElementById(`${gid}-name`);
    if (nameInput) {
      nameInput.addEventListener("input", () => {
        handleGuildNameChange(gid);
      });
    }
  });
}

/************************************************************
 * 14) ギルド情報(表示のみ)のタイトル更新 (例: ギルド情報 -> ギルドステータス)
 ************************************************************/
function updateGuildInfoTitle() {
  const titleEl = document.getElementById("display-guildInfo-title");
  if (titleEl) {
    titleEl.textContent = "ギルド情報 (表示のみ)";
  }
}

/************************************************************
 * 15) 初期設定: ギルド名リスト更新
 ************************************************************/
function initialSetup() {
  updateGuildDisplayLabels("g1");
  updateGuildDisplayLabels("g2");
  updateGuildDisplayLabels("g3");
  updateGuildDisplayLabels("g4");
  updateCommandGuildOptions();
  rebuildCommandTargets();
  updateGuildInfoTitle();
}

initialSetup();
