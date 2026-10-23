// セトリA・Bを1枚のPNGにする
// app.jsの後に読み込む

(() => {
  let currentImageUrl = null;

  const button = document.querySelector("#create-image-button");
  const status = document.querySelector("#image-status");
  const result = document.querySelector("#image-result");
  const preview = document.querySelector("#image-preview");
  const download = document.querySelector("#image-download");

  const FONT =
    '"Yu Gothic", "Hiragino Kaku Gothic ProN", ' +
    '"Meiryo", sans-serif';

  const SHORT_SINGERS = {
    miku: "ミク",
    rin: "リン",
    len: "レン",
    luka: "ルカ",
    meiko: "MEIKO",
    kaito: "KAITO"
  };

  function showStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  }

  function setFont(ctx, size, bold = false) {
    ctx.font = `${bold ? "700" : "400"} ${size}px ${FONT}`;
  }

  // 指定幅を超えるところで折り返す
  function wrapText(ctx, text, maxWidth) {
    const lines = [];
    let line = "";

    for (const character of String(text)) {
      if (character === "\n") {
        lines.push(line);
        line = "";
        continue;
      }

      const next = line + character;

      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line);
        line = character;
      } else {
        line = next;
      }
    }

    lines.push(line);
    return lines;
  }

  function drawLines(ctx, lines, x, y, lineHeight) {
    lines.forEach((line, index) => {
      ctx.fillText(line, x, y + index * lineHeight);
    });
  }

  function toPngBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error(
            "PNGを生成できませんでした。画像が大きすぎる可能性があります。"
          ));
        }
      }, "image/png");
    });
  }

  // 画像用に、現在のセトリの情報を取り出す
  function getExportRows(name) {
    return state.setlists[name].map((id, index) => {
      if (!id) {
        return {
          number: index + 1,
          title: "— 未選択 —",
          unitName: "",
          color: "#cbd2df",
          singers: [],
          empty: true
        };
      }

      const song = songById.get(id);

      if (!song) {
        throw new Error(
          `セトリ${name}の${index + 1}曲目の楽曲情報がありません。`
        );
      }

      const unit = UNITS[song.unit];

      return {
        number: index + 1,
        title: song.title,
        unitName: unit.name,
        color: unit.color,
        singers: [...getSingers(id)],
        empty: false
      };
    });
  }

  function getCounts(rows) {
    const counts = Object.fromEntries(
      Object.keys(SHORT_SINGERS).map(id => [id, 0])
    );

    for (const row of rows) {
      for (const singer of row.singers) {
        counts[singer] += 1;
      }
    }

    return counts;
  }

  async function createSetlistImage() {
    button.disabled = true;
    showStatus("画像を作成しています…");

    try {
      // フォントの読み込み完了を待つ
      if (document.fonts) {
        await document.fonts.ready;
      }

      const title =
        document.querySelector("#image-title").value.trim() ||
        "プロセカ セットリスト予想";

      const rowsA = getExportRows("A");
      const rowsB = getExportRows("B");

      if (
        !rowsA.some(row => !row.empty) &&
        !rowsB.some(row => !row.empty)
      ) {
        throw new Error(
          "セトリAまたはBに、少なくとも1曲を配置してください。"
        );
      }

      // 画像サイズと余白
      const WIDTH = 1600;
      const MARGIN = 48;
      const GAP = 32;
      const COLUMN_WIDTH = (WIDTH - MARGIN * 2 - GAP) / 2;
      const TEXT_WIDTH = COLUMN_WIDTH - 104;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("このブラウザでは画像を作成できません。");
      }

      // 曲ごとに必要な高さを計算
      function prepareRow(row) {
        setFont(ctx, 28, true);
        row.titleLines = wrapText(ctx, row.title, TEXT_WIDTH);

        setFont(ctx, 18);

        const singerNames = row.singers
          .map(id => SHORT_SINGERS[id])
          .join("・") || "なし";

        const metadata = row.empty
          ? "曲が選択されていません"
          : `${row.unitName} / VS：${singerNames}`;

        row.metaLines = wrapText(ctx, metadata, TEXT_WIDTH);

        row.height = Math.max(
          104,
          20 +
          row.titleLines.length * 36 +
          8 +
          row.metaLines.length * 26 +
          18
        );

        return row;
      }

      rowsA.forEach(prepareRow);
      rowsB.forEach(prepareRow);

      setFont(ctx, 42, true);
      const titleLines = wrapText(ctx, title, WIDTH - MARGIN * 2);

      const headingY = 48 + titleLines.length * 56 + 24;
      const rowsY = headingY + 80;

      // 同じ曲番号はA・Bで高さをそろえる
      const rowCount = Math.max(rowsA.length, rowsB.length);
      const rowHeights = [];

      for (let index = 0; index < rowCount; index++) {
        rowHeights.push(Math.max(
          rowsA[index]?.height || 104,
          rowsB[index]?.height || 104
        ));
      }

      const rowsHeight = rowHeights.reduce(
        (total, height) => total + height + 10,
        0
      );

      const summaryY = rowsY + rowsHeight + 22;
      const HEIGHT = Math.ceil(summaryY + 206);

      // 極端に大きな画像による失敗を避ける
      if (HEIGHT > 12000) {
        throw new Error(
          "画像が縦に長すぎます。" +
          "不要な空欄の枠を削除してから再度作成してください。"
        );
      }

      canvas.width = WIDTH;
      canvas.height = HEIGHT;

      // サイズ設定で描画設定が初期化されるので、ここで設定
      ctx.textBaseline = "top";

      ctx.fillStyle = "#f4f6fa";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.fillStyle = "#202638";
      setFont(ctx, 42, true);
      drawLines(ctx, titleLines, MARGIN, 48, 56);

      function drawColumn(rows, name, x) {
        const songCount = rows.filter(row => !row.empty).length;

        ctx.fillStyle = "#202638";
        ctx.fillRect(x, headingY, COLUMN_WIDTH, 62);

        ctx.fillStyle = "#ffffff";
        setFont(ctx, 30, true);
        ctx.fillText(`SETLIST ${name}`, x + 20, headingY + 14);

        setFont(ctx, 20);
        ctx.textAlign = "right";
        ctx.fillText(
          `${songCount}曲 / ${rows.length}枠`,
          x + COLUMN_WIDTH - 20,
          headingY + 20
        );
        ctx.textAlign = "left";

        let y = rowsY;

        rowHeights.forEach((height, index) => {
          const row = rows[index];

          if (row) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(x, y, COLUMN_WIDTH, height);

            ctx.fillStyle = row.color;
            ctx.fillRect(x, y, 8, height);

            ctx.fillStyle = "#697386";
            setFont(ctx, 22, true);
            ctx.fillText(
              String(row.number).padStart(2, "0"),
              x + 22,
              y + 22
            );

            const textX = x + 78;

            ctx.fillStyle = row.empty ? "#8b94a5" : "#202638";
            setFont(ctx, 28, true);
            drawLines(ctx, row.titleLines, textX, y + 20, 36);

            const metadataY =
              y + 20 + row.titleLines.length * 36 + 8;

            ctx.fillStyle = "#626b80";
            setFont(ctx, 18);
            drawLines(ctx, row.metaLines, textX, metadataY, 26);
          }

          y += height + 10;
        });

        // VS集計
        const counts = getCounts(rows);

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x, summaryY, COLUMN_WIDTH, 144);

        ctx.fillStyle = "#202638";
        setFont(ctx, 23, true);
        ctx.fillText("VS登場回数", x + 20, summaryY + 16);

        const singerIds = Object.keys(SHORT_SINGERS);
        const cellWidth = (COLUMN_WIDTH - 40) / 3;

        setFont(ctx, 22);

        singerIds.forEach((id, index) => {
          const cellX = x + 20 + (index % 3) * cellWidth;
          const cellY = summaryY + 58 + Math.floor(index / 3) * 36;

          ctx.fillText(
            `${SHORT_SINGERS[id]}  ${counts[id]}回`,
            cellX,
            cellY
          );
        });
      }

      drawColumn(rowsA, "A", MARGIN);
      drawColumn(rowsB, "B", MARGIN + COLUMN_WIDTH + GAP);

      ctx.fillStyle = "#626b80";
      setFont(ctx, 18);
      ctx.fillText(
        "プロセカ セトリメーカー",
        MARGIN,
        HEIGHT - 36
      );

      const blob = await toPngBlob(canvas);
      const nextUrl = URL.createObjectURL(blob);
      const previousUrl = currentImageUrl;

      preview.src = nextUrl;
      download.href = nextUrl;
      download.download = "proseka-setlists-A-B.png";

      currentImageUrl = nextUrl;
      result.hidden = false;

      // 作り直したときに、前の画像のメモリを解放
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
      }

      showStatus(
        `画像を作成しました（${WIDTH} × ${HEIGHT}px）。` +
        "プレビューを確認して「PNG画像を保存」を押してください。"
      );
    } catch (error) {
      showStatus(
        `画像を作成できませんでした：${error.message}` +
        (currentImageUrl ? " 表示中の画像は前回作成したものです。" : ""),
        true
      );
    } finally {
      button.disabled = false;
    }
  }

  button.addEventListener("click", createSetlistImage);
})();