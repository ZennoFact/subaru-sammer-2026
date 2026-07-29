// HTML側で読み込まれた MediaPipe グローバルオブジェクトから抽出
const { FaceLandmarker, FilesetResolver } = globalThis.Vision || globalThis.TasksVision;

const img = document.getElementById('base-image');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const imageUri = '../images/sample.jpg';

let faceLandmarker = null;

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
    applyFaceMosaic();
  }
}

// 初期化を開始
initFaceLandmarker();

// 画像読み込み完了時の処理
img.addEventListener('load', () => {
  console.log('load event fired');

  const width = img.clientWidth || img.width;
  const height = img.clientHeight || img.height;

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);

  // 1. まず全体をグレースケール化
  setGrayScale(canvas);

  // 2. MediaPipeのロードが完了していれば顔認識・モザイクを実行
  if (faceLandmarker) {
    applyFaceMosaic();
  }
});

img.src = imageUri;

// グレースケール変換処理
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

// 顔認識を行ってモザイクをかける処理
function applyFaceMosaic() {
  // MediaPipe FaceLandmarker が初期化されていない場合は処理を中断
  if (!faceLandmarker) return;

  // canvasの内容を一旦ImageDataとして取得し、MediaPipeに渡すためのImageBitmapを作成
  const result = faceLandmarker.detect(img);

  // 顔ランドマークが検出された場合にモザイク処理を行う
  if (result.faceLandmarks && result.faceLandmarks.length > 0) {
    // 検出された各顔ランドマークに対してモザイク処理を適用
    for (const landmarks of result.faceLandmarks) {
      // ランドマークの座標をcanvasのピクセル座標に変換
      const xs = landmarks.map((lm) => lm.x * canvas.width);
      const ys = landmarks.map((lm) => lm.y * canvas.height);

      // ランドマークの最小・最大座標を取得して矩形領域を決定
      const minX = Math.max(0, Math.floor(Math.min(...xs)));
      const maxX = Math.min(canvas.width, Math.ceil(Math.max(...xs)));
      const minY = Math.max(0, Math.floor(Math.min(...ys)));
      const maxY = Math.min(canvas.height, Math.ceil(Math.max(...ys)));

      // 矩形領域の幅と高さを計算
      const width = maxX - minX;
      const height = maxY - minY;

      // モザイク処理を適用するための縮小・拡大描画
      if (width > 0 && height > 0) {
        const mosaicSize = 12; // モザイクの粗さ

        // 1. 縮小後の解像度（ピクセル数）を整数で計算（Math.ceilで少し大きめにして隙間を防ぐ）
        const sw = Math.max(1, Math.ceil(width / mosaicSize));
        const sh = Math.max(1, Math.ceil(height / mosaicSize));

        ctx.imageSmoothingEnabled = false;

        // 2. 縮小描画（一旦小さく描画）
        ctx.drawImage(canvas, minX, minY, width, height, minX, minY, sw, sh);

        // 3. 拡大描画（元のサイズにピッタリ引き伸ばす）
        ctx.drawImage(canvas, minX, minY, sw, sh, minX, minY, width, height);

        ctx.imageSmoothingEnabled = true;
      }
    }
  }
}

// ドラッグ＆ドロップ処理
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
