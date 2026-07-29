// scriptタグに書いていた処理をこちらに移動
const img = document.getElementById('base-image');

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const imageUri = '../images/sample.jpg'; // 画像のURLを指定

// ベースになる画像をcanvasに描画;

// img.onload = () => {
//   console.log('onload fired');
//   canvas.width = img.width;
//   canvas.height = img.height;
//   ctx.drawImage(img, 0, 0, img.width, img.height);
// };

// こっちがおすすめ。複数登録できるのが嬉しい
img.addEventListener('load', () => {
  console.log('load event fired');
  // 画像が読み込まれた後にcanvasに描画する
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0, img.width, img.height);

  // キャンバスの画像をグレースケールに
  setGrayScale(canvas);
});

img.src = imageUri;

// グレースケールにする関数。引数のあるなし，どう判断する？
// function setGrayScale() {
//   const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
//   const data = imageData.data;

//   for (let i = 0; i < data.length; i += 4) {
//     const r = data[i];
//     const g = data[i + 1];
//     const b = data[i + 2];
//     const gray = 0.299 * r + 0.587 * g + 0.114 * b;

//     data[i] = gray; // 赤
//     data[i + 1] = gray; // 緑
//     data[i + 2] = gray; // 青
//   }

//   ctx.putImageData(imageData, 0, 0);
// }

function setGrayScale(canvas) {
  const ctx = canvas.getContext('2d');
  // canvasの画像データを取得
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  // RGBAの配列を取得(red, green, blue, alphaの順番で並んでいる)
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    // RGBAの配列から赤の値、緑の値、青の値を取得
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // グレースケールの計算・単純平均では問題ない画像と問題ありの画像が出てくる。イタリア国旗とかヤバいも
    // const gray = (r + g + b) / 3; // 単純平均

    // グレースケールの値を計算　人の目は緑に対する感度が非常に高い，次いで赤，青は低いので，それぞれの係数をかけて加算する
    // 0.2126 + 0.7152 + 0.0722 = 1 (100%) になるようにしている
    // Webディスプレイ向け（sRGB）で使われているRec.709規格の計算式がこれ
    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    // RGBAの配列にグレースケールの値を代入
    data[i] = gray; // 赤
    data[i + 1] = gray; // 緑
    data[i + 2] = gray; // 青
  }

  ctx.putImageData(imageData, 0, 0);
}

// ドラッグ中にブラウザでファイルが開くのを防ぐために、dragoverイベントをキャンセルする
img.addEventListener('dragover', (e) => {
  e.preventDefault();
});

// ドロップされた画像ファイルを読み込む
img.addEventListener('drop', (e) => {
  // ブラウザでファイルが開くのを防ぐ
  e.preventDefault();

  // ドロップされたファイルを取得
  const files = e.dataTransfer.files;

  // ファイルが存在し、それが画像ファイルか確認
  if (files.length > 0 && files[0].type.startsWith('image/')) {
    const file = files[0];

    // FileReader を使って画像を Data URL に変換
    const reader = new FileReader();

    // これは複数のイベントを登録する必要もないのでこのような形に
    reader.onload = (event) => {
      // 読み込みが完了したら img の src を更新
      img.src = event.target.result;
    };

    // 画像ファイルを読み込む
    reader.readAsDataURL(file);
  }
});
