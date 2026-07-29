const { FaceLandmarker, FilesetResolver } = globalThis.Vision || globalThis.TasksVision;

const img = document.getElementById('base-image');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const imageUri = '../images/sample.jpg';

let faceLandmarker = null;

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
    // applyFaceMosaic();
    applyFaceNegativePositive();
  }
}

// 初期化を開始
initFaceLandmarker();

img.addEventListener('load', () => {
  console.log('load event fired');

  const width = img.clientWidth || img.width;
  const height = img.clientHeight || img.height;

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);

  // 1. まず全体をグレースケール化
  // setGrayScale(canvas);

  // 2. MediaPipeのロードが完了していれば顔認識・ネガポジ変換を実行
  if (faceLandmarker) {
    // applyFaceMosaic();
    applyFaceNegativePositive();
  }
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

function applyFaceMosaic() {
  if (!faceLandmarker) return;

  const result = faceLandmarker.detect(img);

  if (result.faceLandmarks && result.faceLandmarks.length > 0) {
    for (const landmarks of result.faceLandmarks) {
      // 顔の矩形情報は，他の処理でも使うので関数として切り出す
      const { minX, minY, width, height } = getFaceRectangles(landmarks);

      if (width > 0 && height > 0) {
        const mosaicSize = 12; // モザイクの粗さ

        // 1. 縮小後の解像度（ピクセル数）を整数で計算（Math.ceilで少し大きめにして隙間を防ぐ）
        const sw = Math.max(1, Math.ceil(width / mosaicSize));
        const sh = Math.max(1, Math.ceil(height / mosaicSize));

        // 処理の修正（バグを無くしたい）
        // 一時的な小サイズキャンバス（メモリ上）を作成し，上書きによる不慮の事故を減らしたい。
        const offscreen = document.createElement('canvas');
        offscreen.width = sw;
        offscreen.height = sh;
        const offCtx = offscreen.getContext('2d');

        // SmoothEnabledをfalseにしてモザイク処理を行う(ドット感を維持したい)
        offCtx.imageSmoothingEnabled = false;
        ctx.imageSmoothingEnabled = false;

        // 2. 縮小描画（一旦小さく描画）
        offCtx.drawImage(canvas, minX, minY, width, height, 0, 0, sw, sh);

        // 3. 拡大描画（元のサイズにピッタリ引き伸ばす）
        ctx.drawImage(offscreen, 0, 0, sw, sh, minX, minY, width, height);

        // 元のキャンバスのSmoothEnabledを元に戻す
        ctx.imageSmoothingEnabled = true;
      }
    }
  }
}

// 顔の矩形情報を返す処理
function getFaceRectangles(landmarks) {
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

  return { minX, minY, width, height };
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

// 顔領域だけをネガポジ変換する処理
function applyFaceNegativePositive() {
  if (!faceLandmarker) return;

  const result = faceLandmarker.detect(img);

  if (result.faceLandmarks && result.faceLandmarks.length > 0) {
    for (const landmarks of result.faceLandmarks) {
      // 切り出した顔領域の矩形情報を取得する関数をここでも使用する
      const { minX, minY, width, height } = getFaceRectangles(landmarks);

      if (width > 0 && height > 0) {
        // gpu -> cpu
        const imageData = ctx.getImageData(minX, minY, width, height);
        const data = imageData.data;

        // ネガポジ変換の処理　Maxの値255から各色の値を引くことで反転させる
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 255 - data[i]; // Red
          data[i + 1] = 255 - data[i + 1]; // Green
          data[i + 2] = 255 - data[i + 2]; // Blue
        }

        // gpu -> cpu
        // ピクセル単位で直接計算・加工したいからputImageDataを使う。drawImageだとアンチエイリアスがかかってしまうので、ピクセル単位での加工ができない。
        ctx.putImageData(imageData, minX, minY);
      }
    }
  }
}
