const imageInput = document.getElementById("imageInput");
const rotateLeftBtn = document.getElementById("rotateLeftBtn");
const rotateRightBtn = document.getElementById("rotateRightBtn");
const statusText = document.getElementById("status");
const resultSection = document.getElementById("resultSection");
const originalPreview = document.getElementById("originalPreview");
const resultPreview = document.getElementById("resultPreview");
const downloadLink = document.getElementById("downloadLink");

let currentImage = null;
let currentFileName = "imagen-girada.png";
let currentRotation = 0;

imageInput.addEventListener("change", function () {
  const file = imageInput.files[0];

  if (!file) {
    currentImage = null;
    originalPreview.src = "";
    resultPreview.src = "";
    resultSection.style.display = "none";
    statusText.textContent = "";
    return;
  }

  currentFileName = file.name.replace(/\.[^/.]+$/, "") + "-girada.png";

  const reader = new FileReader();

  reader.onload = function (event) {
    const img = new Image();

    img.onload = function () {
      currentImage = img;
      currentRotation = 0;

      originalPreview.src = img.src;
      resultPreview.src = img.src;
      downloadLink.href = img.src;
      downloadLink.download = currentFileName;

      resultSection.style.display = "grid";
      statusText.textContent = "Imagen cargada. Ahora puedes girarla.";
    };

    img.src = event.target.result;
  };

  reader.readAsDataURL(file);
});

rotateLeftBtn.addEventListener("click", function () {
  rotateImage(-90);
});

rotateRightBtn.addEventListener("click", function () {
  rotateImage(90);
});

function rotateImage(degrees) {
  if (!currentImage) {
    statusText.textContent = "Primero selecciona una imagen.";
    return;
  }

  currentRotation = (currentRotation + degrees) % 360;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const normalizedRotation = ((currentRotation % 360) + 360) % 360;

  if (normalizedRotation === 90 || normalizedRotation === 270) {
    canvas.width = currentImage.height;
    canvas.height = currentImage.width;
  } else {
    canvas.width = currentImage.width;
    canvas.height = currentImage.height;
  }

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((normalizedRotation * Math.PI) / 180);
  ctx.drawImage(currentImage, -currentImage.width / 2, -currentImage.height / 2);

  const rotatedUrl = canvas.toDataURL("image/png");

  resultPreview.src = rotatedUrl;
  downloadLink.href = rotatedUrl;
  downloadLink.download = currentFileName;

  resultSection.style.display = "grid";
  statusText.textContent = "Imagen girada correctamente.";
}
