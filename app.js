const UNITS = {
  ln: {
    name: "Leo/need",
    color: "#4455DD"
  },
  mmj: {
    name: "MORE MORE JUMP！",
    color: "#88DD44"
  },
  vbs: {
    name: "Vivid BAD SQUAD",
    color: "#EE1166"
  },
  wxs: {
    name: "ワンダーランズ×ショウタイム",
    color: "#FF9900"
  },
  n25: {
    name: "25時、ナイトコードで。",
    color: "#884499"
  },
  vs: {
    name: "バーチャル・シンガー",
    color: "#33AA99"
  },
  other: {
    name: "混合・その他",
    color: "#667085"
  }
};

const CATEGORIES = {
  commissioned_debut: "書き下ろし・初披露",
  commissioned_revival: "書き下ろし・復刻",
  cover_debut: "カバー・初披露",
  cover_revival: "カバー・復刻",
  world_link: "WL曲",
  other: "その他"
};

const SINGERS = {
  miku: "初音ミク",
  rin: "鏡音リン",
  len: "鏡音レン",
  luka: "巡音ルカ",
  meiko: "MEIKO",
  kaito: "KAITO"
};

// 楽曲データに入力ミスがないか確認する
function validateSongs(songs) {
  if (!Array.isArray(songs)) {
    throw new Error("songs.jsのsongsが配列になっていません。");
  }

  const usedIds = new Set();

  songs.forEach((song, index) => {
    const position = `${index + 1}曲目`;

    if (!song || typeof song !== "object") {
      throw new Error(`${position}のデータ形式が正しくありません。`);
    }

    if (typeof song.id !== "string" || !song.id.trim()) {
      throw new Error(`${position}のidを入力してください。`);
    }

    if (usedIds.has(song.id)) {
      throw new Error(`id「${song.id}」が重複しています。`);
    }

    usedIds.add(song.id);

    if (typeof song.title !== "string" || !song.title.trim()) {
      throw new Error(`${position}の曲名を入力してください。`);
    }

    if (!Object.hasOwn(UNITS, song.unit)) {
      throw new Error(`「${song.title}」のunitが正しくありません。`);
    }

    if (!Object.hasOwn(CATEGORIES, song.category)) {
      throw new Error(`「${song.title}」のcategoryが正しくありません。`);
    }

    if (!Array.isArray(song.virtualSingers)) {
      throw new Error(
        `「${song.title}」のvirtualSingersを配列にしてください。`
      );
    }

    for (const singer of song.virtualSingers) {
      if (!Object.hasOwn(SINGERS, singer)) {
        throw new Error(
          `「${song.title}」の歌唱VS「${singer}」が正しくありません。`
        );
      }
    }

    if (new Set(song.virtualSingers).size !== song.virtualSingers.length) {
      throw new Error(`「${song.title}」で同じVSが重複しています。`);
    }
  });
}

// 指定した文章を持つHTML要素を作る
function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
}

// ===== 手順2：候補曲とセトリの管理 =====

let songs = [];
let songById = new Map();

// 画面の現在の状態
const state = {
  selectedIds: new Set(),

  setlists: {
    A: Array(24).fill(null),
    B: Array(24).fill(null)
  },

  // 曲ごとに変更した歌唱VS
  singerOverrides: {},

  filters: {
    unit: "",
    category: "",
    query: "",
    selectedOnly: false
  }
};

// 歌唱VSを取得する
// 変更済みなら変更後の情報、未変更なら元の情報を使う
function getSingers(id) {
  return state.singerOverrides[id]
    ?? songById.get(id).virtualSingers;
}

function getSingerText(id) {
  return getSingers(id)
    .map(singer => SINGERS[singer])
    .join("・") || "なし";
}

// 指定した曲の並びから、VSの回数を数える
function countSingers(ids) {
  const counts = Object.fromEntries(
    Object.keys(SINGERS).map(id => [id, 0])
  );

  for (const id of ids) {
    if (!id) continue;

    for (const singer of getSingers(id)) {
      counts[singer] += 1;
    }
  }

  return counts;
}

// ボタンを作る共通処理
function makeButton(text, action, disabled = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.disabled = disabled;
  button.addEventListener("click", action);
  return button;
}

// プルダウンの選択肢を追加する
function appendOption(select, value, text) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = text;
  select.append(option);
}

// 曲が使われている位置を調べる
function findUsages(id) {
  const usages = [];

  for (const name of ["A", "B"]) {
    state.setlists[name].forEach((songId, index) => {
      if (songId === id) {
        usages.push(`${name}の${index + 1}曲目`);
      }
    });
  }

  return usages;
}

// 候補曲の選択・解除
function changeCandidate(id, checked) {
  if (checked) {
    state.selectedIds.add(id);
  } else {
    const usages = findUsages(id);

    if (usages.length > 0) {
      const accepted = window.confirm(
        `この曲は ${usages.join("、")} で使用中です。\n` +
        "候補から外し、該当するセトリの枠を空欄にしますか？"
      );

      if (!accepted) {
        renderAll();
        return;
      }
    }

    state.selectedIds.delete(id);

    for (const name of ["A", "B"]) {
      state.setlists[name] = state.setlists[name].map(
        songId => songId === id ? null : songId
      );
    }
  }

  renderAll();
}

// VS集計表を表示する
function renderSummary() {
  const root = document.querySelector("#summary");
  const table = document.createElement("table");
  table.className = "count-table";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  for (const label of ["対象", "曲数", ...Object.values(SINGERS)]) {
    const th = createTextElement("th", "", label);
    th.scope = "col";
    headerRow.append(th);
  }

  thead.append(headerRow);

  const tbody = document.createElement("tbody");

  const groups = [
    ["候補曲", [...state.selectedIds]],
    ["セトリA", state.setlists.A],
    ["セトリB", state.setlists.B]
  ];

  for (const [label, ids] of groups) {
    const tr = document.createElement("tr");
    const heading = createTextElement("th", "", label);
    heading.scope = "row";
    tr.append(heading);

    tr.append(
      createTextElement("td", "", ids.filter(Boolean).length)
    );

    const counts = countSingers(ids);

    for (const singer of Object.keys(SINGERS)) {
      tr.append(createTextElement("td", "", counts[singer]));
    }

    tbody.append(tr);
  }

  table.append(thead, tbody);
  root.replaceChildren(table);
}

// 曲ごとのカードを作る
function createSongCard(song) {
  const unit = UNITS[song.unit];
  const selected = state.selectedIds.has(song.id);

  const card = document.createElement("article");
  card.className = "song-card";
  card.classList.toggle("is-selected", selected);
  card.style.setProperty("--unit-color", unit.color);

  const singerText = createTextElement(
    "p",
    "song-singers",
    `歌唱VS：${getSingerText(song.id)}`
  );

  card.append(
    createTextElement("p", "song-unit", unit.name),
    createTextElement("h3", "song-title", song.title),
    createTextElement(
      "p",
      "song-category",
      CATEGORIES[song.category]
    ),
    singerText
  );

  // 候補にするチェックボックス
  const candidateLabel = document.createElement("label");
  candidateLabel.className = "check-label candidate-control";

  const candidateCheckbox = document.createElement("input");
  candidateCheckbox.type = "checkbox";
  candidateCheckbox.checked = selected;

  candidateCheckbox.addEventListener("change", () => {
    changeCandidate(song.id, candidateCheckbox.checked);
  });

  candidateLabel.append(
    candidateCheckbox,
    document.createTextNode("候補曲にする")
  );

  card.append(candidateLabel);

  // セトリでの使用状況
  const usages = findUsages(song.id);

  card.append(
    createTextElement(
      "p",
      "usage",
      usages.length > 0
        ? `使用中：${usages.join("、")}`
        : "セトリでは未使用"
    )
  );

  // 歌唱VSの変更欄
  const details = document.createElement("details");
  details.className = "singer-editor";

  details.append(
    createTextElement("summary", "", "歌唱VSを変更")
  );

  const options = document.createElement("div");
  options.className = "singer-options";

  const boxes = new Map();

  for (const [singerId, singerName] of Object.entries(SINGERS)) {
    const label = document.createElement("label");
    label.className = "check-label";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = getSingers(song.id).includes(singerId);

    boxes.set(singerId, checkbox);

    checkbox.addEventListener("change", () => {
      state.singerOverrides[song.id] = [...boxes]
        .filter(([, box]) => box.checked)
        .map(([id]) => id);

      singerText.textContent =
        `歌唱VS：${getSingerText(song.id)}`;

      // 編集欄を閉じないよう、必要な箇所だけ更新
      renderSummary();
      renderSetlist("A");
      renderSetlist("B");

      saveState();
    });

    label.append(
      checkbox,
      document.createTextNode(singerName)
    );

    options.append(label);
  }

  details.append(options);

  details.append(
    makeButton("元の歌唱VSに戻す", () => {
      delete state.singerOverrides[song.id];

      for (const [id, box] of boxes) {
        box.checked = getSingers(song.id).includes(id);
      }

      singerText.textContent =
        `歌唱VS：${getSingerText(song.id)}`;

      renderSummary();
      renderSetlist("A");
      renderSetlist("B");

      saveState();
    })
  );

  details.append(
    createTextElement(
      "p",
      "helper",
      "変更は、この曲の候補集計・A・Bすべてに反映されます。"
    )
  );

  card.append(details);

  return card;
}

// 絞り込みを反映して曲一覧を表示する
function renderSongs() {
  const filters = state.filters;
  const query = filters.query.trim().toLocaleLowerCase();

  const visibleSongs = songs.filter(song => {
    if (filters.unit && song.unit !== filters.unit) {
      return false;
    }

    if (filters.category && song.category !== filters.category) {
      return false;
    }

    if (
      query &&
      !song.title.toLocaleLowerCase().includes(query)
    ) {
      return false;
    }

    if (
      filters.selectedOnly &&
      !state.selectedIds.has(song.id)
    ) {
      return false;
    }

    return true;
  });

  document.querySelector("#song-count").textContent =
    `登録 ${songs.length}曲 / 表示 ${visibleSongs.length}曲` +
    ` / 候補 ${state.selectedIds.size}曲`;

  const root = document.querySelector("#song-list");

  if (visibleSongs.length === 0) {
    root.replaceChildren(
      createTextElement(
        "p",
        "helper",
        "条件に一致する曲がありません。"
      )
    );
    return;
  }

  root.replaceChildren(...visibleSongs.map(createSongCard));
}

// セトリ内の曲を上下に移動する
function moveSlot(name, index, direction) {
  const slots = state.setlists[name];
  const target = index + direction;

  if (target < 0 || target >= slots.length) return;

  [slots[index], slots[target]] =
    [slots[target], slots[index]];

  renderAll();
}

// 曲番号の枠そのものを削除する
function deleteSlot(name, index) {
  const id = state.setlists[name][index];

  if (id) {
    const title = songById.get(id).title;

    const accepted = window.confirm(
      `セトリ${name}の${index + 1}曲目「${title}」の枠を削除し、` +
      "後ろの曲を前に詰めますか？"
    );

    if (!accepted) return;
  }

  state.setlists[name].splice(index, 1);
  renderAll();
}

// セトリAまたはBを表示する
function renderSetlist(name) {
  const root = document.querySelector(`#setlist-${name}`);
  const slots = state.setlists[name];

  // セトリ内での使用回数
  const frequency = new Map();

  for (const id of slots) {
    if (!id) continue;
    frequency.set(id, (frequency.get(id) ?? 0) + 1);
  }

  const candidateSongs = songs.filter(
    song => state.selectedIds.has(song.id)
  );

  const fragment = document.createDocumentFragment();

  fragment.append(
    createTextElement(
      "p",
      "helper",
      `${slots.filter(Boolean).length}曲配置 / ${slots.length}枠`
    )
  );

  slots.forEach((id, index) => {
    const song = id ? songById.get(id) : null;
    const duplicate = id && frequency.get(id) > 1;

    const row = document.createElement("div");
    row.className = "setlist-row";
    row.classList.toggle("is-duplicate", Boolean(duplicate));

    row.style.setProperty(
      "--unit-color",
      song ? UNITS[song.unit].color : "#d5d9e2"
    );

    const selectId = `slot-${name}-${index}`;

    const label = createTextElement(
      "label",
      "slot-label",
      `${index + 1}曲目`
    );
    label.htmlFor = selectId;

    const select = document.createElement("select");
    select.id = selectId;

    appendOption(select, "", "— 空欄 —");

    for (const candidate of candidateSongs) {
      const alreadyUsed =
        (frequency.get(candidate.id) ?? 0) > 0;

      appendOption(
        select,
        candidate.id,
        `${candidate.title} / ${UNITS[candidate.unit].name}` +
        (alreadyUsed ? "［使用中］" : "")
      );
    }

    select.value = id ?? "";

    select.addEventListener("change", () => {
      state.setlists[name][index] = select.value || null;
      renderAll();
    });

    row.append(label, select);

    if (song) {
      row.append(
        createTextElement(
          "p",
          "slot-info",
          `${CATEGORIES[song.category]} / ` +
          `歌唱VS：${getSingerText(id)}`
        )
      );
    }

    if (duplicate) {
      row.append(
        createTextElement(
          "p",
          "duplicate-warning",
          `同じ曲がセトリ${name}内で${frequency.get(id)}回使われています。`
        )
      );
    }

    const actions = document.createElement("div");
    actions.className = "row-actions";

    actions.append(
      makeButton(
        "↑ 上へ",
        () => moveSlot(name, index, -1),
        index === 0
      ),
      makeButton(
        "↓ 下へ",
        () => moveSlot(name, index, 1),
        index === slots.length - 1
      ),
      makeButton(
        "空欄にする",
        () => {
          state.setlists[name][index] = null;
          renderAll();
        },
        !id
      ),
      makeButton(
        "枠を削除",
        () => deleteSlot(name, index)
      )
    );

    row.append(actions);
    fragment.append(row);
  });

  const addButton = makeButton("＋ 末尾に枠を追加", () => {
    state.setlists[name].push(null);
    renderAll();
  });

  addButton.className = "add-slot";
  fragment.append(addButton);

  root.replaceChildren(fragment);
}

// 全体を更新する
function renderAll() {
  renderSummary();
  renderSongs();
  renderSetlist("A");
  renderSetlist("B");

  saveState();
}

// 絞り込み欄を準備する
function initializeFilters() {
  const unitFilter = document.querySelector("#unit-filter");
  const categoryFilter = document.querySelector("#category-filter");
  const search = document.querySelector("#song-search");
  const selectedOnly = document.querySelector("#selected-only");

  appendOption(unitFilter, "", "すべてのユニット");

  for (const [id, unit] of Object.entries(UNITS)) {
    appendOption(unitFilter, id, unit.name);
  }

  appendOption(categoryFilter, "", "すべての区分");

  for (const [id, name] of Object.entries(CATEGORIES)) {
    appendOption(categoryFilter, id, name);
  }

  unitFilter.addEventListener("change", () => {
    state.filters.unit = unitFilter.value;
    renderSongs();
  });

  categoryFilter.addEventListener("change", () => {
    state.filters.category = categoryFilter.value;
    renderSongs();
  });

  search.addEventListener("input", () => {
    state.filters.query = search.value;
    renderSongs();
  });

  selectedOnly.addEventListener("change", () => {
    state.filters.selectedOnly = selectedOnly.checked;
    renderSongs();
  });
}

// 起動処理
function initialize() {
  const errorMessage = document.querySelector("#error-message");

  try {
    const catalog = window.SEKALIVE_CATALOG;

    if (!catalog) {
      throw new Error(
        "楽曲データを読み込めません。songs.jsを確認してください。"
      );
    }

    validateSongs(catalog.songs);

    songs = catalog.songs;
    songById = new Map(songs.map(song => [song.id, song]));

    initializeFilters();
    initializePersistence();
    renderAll();
  } catch (error) {
    document.querySelector("#song-count").textContent =
      "読み込みエラー";

    errorMessage.textContent = error.message;
    errorMessage.hidden = false;
  }
}

// ===== 手順3：保存・復元 =====

// サイトのパスごとに保存先を分ける
const STORAGE_KEY =
  "proseka-setlist:v1:" +
  location.pathname.replace(/index\.html$/, "");

const SAVE_FORMAT = "proseka-setlist";
const SAVE_VERSION = 1;

// 復元処理が終わるまで、自動保存を停止する
let autoSaveEnabled = false;

// HTMLを直接開いている場合は、自動保存を使用しない
function canUseAutoSave() {
  return ["http:", "https:"].includes(location.protocol);
}

function showSaveStatus(message, isError = false) {
  const element = document.querySelector("#save-status");
  element.textContent = message;
  element.classList.toggle("is-error", isError);
}

// 保存用のデータを作る
function createSaveData() {
  // 選択した曲の歌唱VSも保存する。
  // 後日マスターの歌唱VSが変わっても、保存時の編成を維持する。
  const singerIds = new Set([
    ...state.selectedIds,
    ...Object.keys(state.singerOverrides)
  ]);

  const singerOverrides = Object.fromEntries(
    [...singerIds].map(id => [id, [...getSingers(id)]])
  );

  return {
    format: SAVE_FORMAT,
    schemaVersion: SAVE_VERSION,
    catalogVersion: window.SEKALIVE_CATALOG.version,
    savedAt: new Date().toISOString(),

    selectedIds: [...state.selectedIds],

    setlists: {
      A: [...state.setlists.A],
      B: [...state.setlists.B]
    },

    singerOverrides
  };
}

// 読み込むデータを検証する。
// 検証が終わるまで、現在の作業内容は変更しない。
function validateSaveData(data) {
  function fail(message) {
    throw new Error(message);
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    fail("保存ファイルの形式が正しくありません。");
  }

  if (data.format !== SAVE_FORMAT) {
    fail("このアプリの保存ファイルではありません。");
  }

  if (data.schemaVersion !== SAVE_VERSION) {
    fail("このバージョンでは読み込めない保存ファイルです。");
  }

  if (
    !Array.isArray(data.selectedIds) ||
    !data.selectedIds.every(id => typeof id === "string")
  ) {
    fail("候補曲のデータが正しくありません。");
  }

  const selectedIds = new Set(data.selectedIds);

  if (selectedIds.size !== data.selectedIds.length) {
    fail("候補曲のIDが重複しています。");
  }

  for (const id of selectedIds) {
    if (!songById.has(id)) {
      fail(
        `楽曲ID「${id}」が現在のsongs.jsにありません。` +
        "楽曲データをそろえてから読み込んでください。"
      );
    }
  }

  if (
    !data.setlists ||
    typeof data.setlists !== "object" ||
    Array.isArray(data.setlists)
  ) {
    fail("セトリのデータがありません。");
  }

  const setlists = {};

  for (const name of ["A", "B"]) {
    const slots = data.setlists[name];

    if (!Array.isArray(slots)) {
      fail(`セトリ${name}の形式が正しくありません。`);
    }

    for (const id of slots) {
      if (id !== null && !selectedIds.has(id)) {
        fail(`セトリ${name}に、候補にない曲が含まれています。`);
      }
    }

    setlists[name] = [...slots];
  }

  const overrides = data.singerOverrides;

  if (
    !overrides ||
    typeof overrides !== "object" ||
    Array.isArray(overrides)
  ) {
    fail("歌唱VSのデータが正しくありません。");
  }

  const checkedOverrides = [];

  for (const [id, singers] of Object.entries(overrides)) {
    if (!songById.has(id)) {
      fail(`歌唱VSの設定に、未登録の楽曲ID「${id}」があります。`);
    }

    if (
      !Array.isArray(singers) ||
      !singers.every(
        singer =>
          typeof singer === "string" &&
          Object.hasOwn(SINGERS, singer)
      )
    ) {
      fail(`楽曲ID「${id}」の歌唱VSが正しくありません。`);
    }

    if (new Set(singers).size !== singers.length) {
      fail(`楽曲ID「${id}」の歌唱VSが重複しています。`);
    }

    checkedOverrides.push([id, [...singers]]);
  }

  for (const id of selectedIds) {
    if (!Object.hasOwn(overrides, id)) {
      fail(`楽曲ID「${id}」の歌唱VS情報がありません。`);
    }
  }

  return {
    selectedIds,
    setlists,
    singerOverrides: Object.fromEntries(checkedOverrides)
  };
}

// 検証済みのデータを画面の状態に反映する
function applySaveData(checked) {
  state.selectedIds = checked.selectedIds;
  state.setlists = checked.setlists;
  state.singerOverrides = checked.singerOverrides;
}

// ブラウザに保存する
function saveState() {
  if (!autoSaveEnabled) return;

  try {
    const data = createSaveData();

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(data)
    );

    const time = new Date().toLocaleTimeString("ja-JP");

    showSaveStatus(
      `このブラウザに保存済み（${time}）`
    );
  } catch (error) {
    showSaveStatus(
      "自動保存に失敗しました。" +
      "「保存ファイルを書き出す」でバックアップしてください。",
      true
    );
  }
}

// 起動時に前回の内容を復元する
function restoreState() {
  if (!canUseAutoSave()) {
    showSaveStatus(
      "HTMLを直接開いているため、自動保存は停止中です。" +
      "ファイルの書き出し・読み込みは使えます。" +
      "自動保存は公開後のURLで確認してください。"
    );
    return;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (raw !== null) {
      const checked = validateSaveData(JSON.parse(raw));
      applySaveData(checked);
    }

    autoSaveEnabled = true;
  } catch (error) {
    // 復元に失敗したデータを空の状態で上書きしない
    autoSaveEnabled = false;

    showSaveStatus(
      `前回の保存内容を復元できませんでした：${error.message} ` +
      "既存の保存データは上書きしていません。" +
      "楽曲データを確認するか、保存ファイルを読み込んでください。",
      true
    );
  }
}

// JSONファイルとして書き出す
function exportSaveFile() {
  try {
    const text = JSON.stringify(createSaveData(), null, 2);

    const blob = new Blob(
      [text],
      { type: "application/json;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    const stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-");

    link.href = url;
    link.download = `proseka-setlist-${stamp}.json`;

    document.body.append(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch (error) {
    window.alert(`書き出しに失敗しました：${error.message}`);
  }
}

// 保存ファイルを読み込む
async function importSaveFile(event) {
  const input = event.target;
  const file = input.files[0];

  if (!file) return;

  try {
    // 誤って巨大なファイルを選んだ場合を防ぐ
    if (file.size > 2 * 1024 * 1024) {
      throw new Error("2MB以下の保存ファイルを選んでください。");
    }

    const text = await file.text();
    const checked = validateSaveData(JSON.parse(text));

    const accepted = window.confirm(
      "現在の候補曲・セトリA/B・歌唱VSの変更を、" +
      "この保存ファイルの内容で置き換えますか？\n" +
      "残したい場合は、先にキャンセルして書き出してください。"
    );

    if (!accepted) return;

    applySaveData(checked);
    autoSaveEnabled = canUseAutoSave();
    renderAll();

    if (!autoSaveEnabled) {
      showSaveStatus(
        "ファイルを読み込みました。" +
        "HTMLを直接開いているため、自動保存は停止中です。"
      );
    }
  } catch (error) {
    window.alert(
      `読み込めませんでした：${error.message}\n` +
      "現在の作業内容は変更していません。"
    );
  } finally {
    // 同じファイルを続けて選べるようにする
    input.value = "";
  }
}

// 新しく作り直す
function resetProject() {
  const accepted = window.confirm(
    "候補曲・セトリA/B・歌唱VSの変更をすべて初期化しますか？\n" +
    "自動保存の内容も置き換わります。" +
    "残したい場合は先に保存ファイルを書き出してください。"
  );

  if (!accepted) return;

  state.selectedIds = new Set();

  state.setlists = {
    A: Array(24).fill(null),
    B: Array(24).fill(null)
  };

  state.singerOverrides = {};

  // 絞り込みも初期状態に戻す
  state.filters = {
    unit: "",
    category: "",
    query: "",
    selectedOnly: false
  };

  document.querySelector("#unit-filter").value = "";
  document.querySelector("#category-filter").value = "";
  document.querySelector("#song-search").value = "";
  document.querySelector("#selected-only").checked = false;

  autoSaveEnabled = canUseAutoSave();
  renderAll();

  if (!autoSaveEnabled) {
    showSaveStatus(
      "選択内容を初期化しました。" +
      "HTMLを直接開いているため、自動保存は停止中です。"
    );
  }
}

// 保存ボタンなどの準備
function initializePersistence() {
  document.querySelector("#export-button")
    .addEventListener("click", exportSaveFile);

  document.querySelector("#import-button")
    .addEventListener("click", () => {
      document.querySelector("#import-file").click();
    });

  document.querySelector("#import-file")
    .addEventListener("change", importSaveFile);

  document.querySelector("#reset-button")
    .addEventListener("click", resetProject);

  restoreState();
}

initialize();