// HTML側で読み込まれた MediaPipe グローバルオブジェクトから抽出
const { FaceLandmarker, FilesetResolver } = globalThis.Vision || globalThis.TasksVision;

const img = document.getElementById('base-image');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const imageUri = '../images/sample.jpg';

let faceLandmarker = null;

// CORS対策
img.crossOrigin = 'anonymous';

// 1. MediaPipe FaceLandmarker の初期化関数
async function initFaceLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
  );

  faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
      delegate: 'GPU',
    },
    runningMode: 'IMAGE',
    numFaces: 5,
  });

  if (img.complete && img.naturalWidth !== 0) {
    applyPurikuraEffect(canvas);
  }
}

// 初期化を開始
initFaceLandmarker();

// 画像読み込み完了時の処理
img.addEventListener('load', () => {
  console.log('load event fired');

  const width = img.naturalWidth || img.clientWidth || img.width;
  const height = img.naturalHeight || img.clientHeight || img.height;

  canvas.width = width;
  canvas.height = height;

  canvas.style.width = `${img.clientWidth || width}px`;
  canvas.style.height = `${img.clientHeight || height}px`;

  ctx.drawImage(img, 0, 0, width, height);

  if (faceLandmarker) {
    applyPurikuraEffect(canvas);
  }
});

img.src = imageUri;

// =================================================================
// ★プリクラ風加工メイン処理
// =================================================================
function applyPurikuraEffect(canvas) {
  if (!faceLandmarker) return;

  const ctx = canvas.getContext('2d');

  // 1. ベース画像を再描画
  const width = canvas.width;
  const height = canvas.height;
  ctx.drawImage(img, 0, 0, width, height);

  // 2. 顔ランドマークの検出
  const result = faceLandmarker.detect(img);

  if (result.faceLandmarks && result.faceLandmarks.length > 0) {
    for (const landmarks of result.faceLandmarks) {
      // 2-1. 顔領域のピクセル色情報を直接いじる（自然な美白処理）
      adjustSkinPixelsDirectly(landmarks);

      // 2-2. ★【修正】目の輪郭自体を大きく拡張してはみ出させて描画する
      enlargeEyesByLandmarkOutline(landmarks);

      // 2-3. 薄いフワフワチーク
      drawCheeks(landmarks);
    }
  }

  // 3. プリクラ風落書き
  drawPurikuraDoodles();
}

// ------------------------------------
// ピクセル色情報をいじって肌色を明るく・色白補正する
// ------------------------------------
function adjustSkinPixelsDirectly(landmarks) {
  const xs = landmarks.map((lm) => lm.x * canvas.width);
  const ys = landmarks.map((lm) => lm.y * canvas.height);

  const minX = Math.max(0, Math.floor(Math.min(...xs)));
  const maxX = Math.min(canvas.width, Math.ceil(Math.max(...xs)));
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxY = Math.min(canvas.height, Math.ceil(Math.max(...ys)));

  const width = maxX - minX;
  const height = maxY - minY;

  if (width <= 0 || height <= 0) return;

  const imageData = ctx.getImageData(minX, minY, width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    if (r > 60 && g > 40 && b > 20 && r > g && r > b) {
      r = Math.min(255, Math.pow(r / 255, 0.82) * 255 + 12);
      g = Math.min(255, Math.pow(g / 255, 0.82) * 255 + 12);
      b = Math.min(255, Math.pow(b / 255, 0.82) * 255 + 15);

      g = Math.min(255, g * 1.03);
      b = Math.min(255, b * 1.05);

      data[i] = Math.floor(r);
      data[i + 1] = Math.floor(g);
      data[i + 2] = Math.floor(b);
    }
  }

  ctx.putImageData(imageData, minX, minY);
}

// ------------------------------------
// ★【修正】目の輪郭自体を「拡大した形状」にして貼り付ける処理
// ------------------------------------
function enlargeEyesByLandmarkOutline(landmarks) {
  // MediaPipe FaceMesh の左右の目の輪郭インデックス
  const leftEyeIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
  const rightEyeIndices = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];

  const leftCenterLm = landmarks[468] || landmarks[159];
  const rightCenterLm = landmarks[473] || landmarks[386];

  const eyes = [
    {
      indices: leftEyeIndices,
      center: { x: leftCenterLm.x * canvas.width, y: leftCenterLm.y * canvas.height },
    },
    {
      indices: rightEyeIndices,
      center: { x: rightCenterLm.x * canvas.width, y: rightCenterLm.y * canvas.height },
    },
  ];

  const scaleX = 1.5; // 横1.5倍
  const scaleY = 2.5; // 縦2.0倍

  // 一時処理用Offscreen Canvasを作成（元の目をキレイに退避させて拡大するため）
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(canvas, 0, 0);

  eyes.forEach((eye) => {
    ctx.save();

    // 1. 目の中心軸を基準にして、描画クリッピングパス自体を「拡大（Scale）」する
    ctx.beginPath();
    eye.indices.forEach((idx, i) => {
      const lm = landmarks[idx];
      if (lm) {
        // 元の座標
        const origX = lm.x * canvas.width;
        const origY = lm.y * canvas.height;

        // 中心点（eye.center）から見て 1.5倍（横）・2.0倍（縦）に拡張した輪郭座標を計算
        const scaledX = eye.center.x + (origX - eye.center.x) * scaleX;
        const scaledY = eye.center.y + (origY - eye.center.y) * scaleY;

        if (i === 0) ctx.moveTo(scaledX, scaledY);
        else ctx.lineTo(scaledX, scaledY);
      }
    });
    ctx.closePath();

    // ★拡大した輪郭の内側をクリッピングマスクに指定！
    ctx.clip();

    // 2. 拡大したマスクに合わせて、元の目画像も同様に拡大して描画する
    ctx.translate(eye.center.x, eye.center.y);
    ctx.scale(scaleX, scaleY);
    ctx.translate(-eye.center.x, -eye.center.y);

    // 一時保管していた元画像を重ね描き
    ctx.drawImage(tempCanvas, 0, 0);

    ctx.restore();
  });
}

// ------------------------------------
// 薄いフワフワチーク
// ------------------------------------
function drawCheeks(landmarks) {
  const leftCheekLm = landmarks[205] || landmarks[50];
  const rightCheekLm = landmarks[425] || landmarks[280];

  const leftCheek = {
    x: leftCheekLm.x * canvas.width,
    y: leftCheekLm.y * canvas.height,
  };
  const rightCheek = {
    x: rightCheekLm.x * canvas.width,
    y: rightCheekLm.y * canvas.height,
  };

  const faceWidth = (Math.max(...landmarks.map((l) => l.x)) - Math.min(...landmarks.map((l) => l.x))) * canvas.width;
  const cheekRadius = Math.max(25, faceWidth * 0.18);

  [leftCheek, rightCheek].forEach((cheek) => {
    ctx.save();
    const gradient = ctx.createRadialGradient(cheek.x, cheek.y, 0, cheek.x, cheek.y, cheekRadius);
    gradient.addColorStop(0, 'rgba(255, 120, 190, 0.25)');
    gradient.addColorStop(0.5, 'rgba(255, 190, 200, 0.1)');
    gradient.addColorStop(1, 'rgba(255, 190, 200, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cheek.x, cheek.y, cheekRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

// ------------------------------------
// プリクラ風のスタンプ＆文字落書き
// ------------------------------------
function drawPurikuraDoodles() {
  ctx.save();

  const fontSize = Math.max(24, Math.floor(canvas.width * 0.06));
  ctx.font = `bold ${fontSize}px sans-serif`;

  drawStrokedText('盛れ，た？', canvas.width * 0.08, canvas.height * 0.12, '#FF1493', '#FFFFFF');
  drawStrokedText('♡ KCG 2026 ♡', 5, canvas.height * 0.9, '#00BFFF', '#FFFFFF');

  ctx.restore();
}

function drawStrokedText(text, x, y, fillColor, strokeColor) {
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = strokeColor;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fillColor;
  ctx.fillText(text, x, y);
}

function drawStar(cx, cy, radius, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    ctx.lineTo(
      Math.cos(((18 + i * 72) * Math.PI) / 180) * radius + cx,
      -Math.sin(((18 + i * 72) * Math.PI) / 180) * radius + cy,
    );
    ctx.lineTo(
      Math.cos(((54 + i * 72) * Math.PI) / 180) * (radius / 2) + cx,
      -Math.sin(((54 + i * 72) * Math.PI) / 180) * (radius / 2) + cy,
    );
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ------------------------------------
// ドラッグ＆ドロップ処理
// ------------------------------------
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
