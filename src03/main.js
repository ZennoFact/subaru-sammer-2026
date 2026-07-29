const img = document.getElementById('base-image');

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// 追加: プレビュー用の要素と色表示用の要素を取得
const srcPreview = document.getElementById('src-preview');
const srcRgbLabel = document.getElementById('src-rgb-label');
const srcHexLabel = document.getElementById('src-hex-label');
const dstPreview = document.getElementById('dst-preview');
const colorChooser = document.getElementById('color-chooser');
const dstHexLabel = document.getElementById('dst-hex-label');
const replaceBtn = document.getElementById('replace-btn');
const resetBtn = document.getElementById('reset-btn');

const imageUri = '../images/sample.jpg';

// 読み込んだ画像データを保持する変数（元の画像状態を消さないため）
let loadedImage = null;
// 置き換え元のRGB値を保持
let targetRGB = null;

img.addEventListener('load', () => {
  console.log('load event fired');

  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0, img.width, img.height);

  loadedImage = img; // 読み込んだ画像を保持

  setGrayScale(canvas);
});

img.src = imageUri;

function setGrayScale(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }

  ctx.putImageData(imageData, 0, 0);
}

img.addEventListener('dragover', (e) => {
  e.preventDefault();
});

img.addEventListener('drop', (e) => {
  e.preventDefault();

  const files = e.dataTransfer.files;

  if (files.length > 0 && files[0].type.startsWith('image/')) {
    const file = files[0];

    const reader = new FileReader();

    reader.onload = (event) => {
      img.src = event.target.result;
    };

    reader.readAsDataURL(file);
  }
});

// --- 2. スポイト（カラーピッカー）処理 ---
canvas.addEventListener('click', (e) => {
  if (!loadedImage) return;

  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width));
  const y = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height));

  // 1ピクセル分のデータを取得
  const pixel = ctx.getImageData(x, y, 1, 1).data;
  targetRGB = { r: pixel[0], g: pixel[1], b: pixel[2] };

  const hex = rgbToHex(targetRGB.r, targetRGB.g, targetRGB.b);

  // プレビュー＆ラベル更新
  srcPreview.style.backgroundColor = hex;
  srcRgbLabel.textContent = `RGB: (${targetRGB.r}, ${targetRGB.g}, ${targetRGB.b})`;
  srcHexLabel.textContent = `HEX: ${hex}`;
});

// --- 3. カラーチューザー変更時の連動 ---
colorChooser.addEventListener('input', (e) => {
  const hex = e.target.value;
  dstPreview.style.backgroundColor = hex;
  dstHexLabel.textContent = `HEX: ${hex}`;
});

replaceBtn.addEventListener('click', () => {
  if (!loadedImage || !targetRGB) {
    alert('画像と置き換え元の色（画像をクリック）を選択してください。');
    return;
  }

  // 新しい色のRGB値を取得
  const newColorHex = colorChooser.value;
  const newRGB = hexToRgb(newColorHex);

  // Canvas全体から ImageData（ピクセル配列）を取得
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data; // ここに [R, G, B, A, R, G, B, A, ...] と並んでいる

  // 全ピクセルをループ
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]; // Red
    const g = data[i + 1]; // Green
    const b = data[i + 2]; // Blue
    // data[i+3] は Alpha（透明度）

    // 現在のピクセルの色(r,g,b)が、ターゲットの色(targetRGB)と一致するかチェック
    if (r === targetRGB.r && g === targetRGB.g && b === targetRGB.b) {
      // 一致したら、そのピクセルの色を新しい色(newRGB)に書き換える
      data[i] = newRGB.r;
      data[i + 1] = newRGB.g;
      data[i + 2] = newRGB.b;
      // data[i+3] (透明度) はそのまま
    }
  }

  // 変更した ImageData を Canvas に戻して描画
  ctx.putImageData(imgData, 0, 0);
});

resetBtn.addEventListener('click', () => {
  drawOriginalImage(); // 元画像を再描画
});

// ヘルパー関数: RGBをHEXに変換
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

// ヘルパー関数: HEXをRGBに変換
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

// Canvasを描画する関数（元の画像データを描画）
function drawOriginalImage() {
  if (!loadedImage) return;
  canvas.width = loadedImage.naturalWidth;
  canvas.height = loadedImage.naturalHeight;
  ctx.drawImage(loadedImage, 0, 0);
}
