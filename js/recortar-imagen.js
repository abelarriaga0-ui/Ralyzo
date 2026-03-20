const imageInput = document.getElementById("imageInput");
const xInput = document.getElementById("xInput");
const yInput = document.getElementById("yInput");
const widthInput = document.getElementById("widthInput");
const heightInput = document.getElementById("heightInput");
const runBtn = document.getElementById("runBtn");
const statusText = document.getElementById("status");
const resultSection = document.getElementById("resultSection");
const originalPreview = document.getElementById("originalPreview");
const resultPreview = document.getElementById("resultPreview");
const originalMeta = document.getElementById("originalMeta");
const resultMeta = document.getElementById("resultMeta");
const downloadLink = document.getElementById("downloadLink");

function formatBytes(bytes){
  if(bytes < 1024) return bytes + " B";
  if(bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function loadImage(file){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = ()=>{
      const img = new Image();
      img.onload = ()=> resolve({img,dataUrl:reader.result});
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function runTool(){
  const file = imageInput.files[0];

  if(!file){
    alert("Selecciona una imagen.");
    return;
  }

  runBtn.disabled = true;
  statusText.textContent = "Recortando imagen...";

  try{
    const {img,dataUrl} = await loadImage(file);

    originalPreview.src = dataUrl;
    originalMeta.innerHTML = `
      Nombre: ${file.name}<br>
      Tamaño: ${formatBytes(file.size)}<br>
      Resolución: ${img.width} × ${img.height}
    `;

    const x = parseInt(xInput.value) || 0;
    const y = parseInt(yInput.value) || 0;
    const cropWidth = parseInt(widthInput.value) || Math.min(300, img.width);
    const cropHeight = parseInt(heightInput.value) || Math.min(300, img.height);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = cropWidth;
    canvas.height = cropHeight;

    ctx.drawImage(
      img,
      x, y, cropWidth, cropHeight,
      0, 0, cropWidth, cropHeight
    );

    canvas.toBlob((blob)=>{
      const url = URL.createObjectURL(blob);

      resultPreview.src = url;
      resultMeta.innerHTML = `
        Tamaño: ${formatBytes(blob.size)}<br>
        Recorte: ${cropWidth} × ${cropHeight}<br>
        Inicio: X ${x}, Y ${y}
      `;

      downloadLink.href = url;
      downloadLink.download = "ralyzo-recortada.png";
      downloadLink.textContent = "Descargar imagen";

      resultSection.style.display = "grid";
      statusText.textContent = "Imagen recortada.";
      runBtn.disabled = false;
    },"image/png");
  }catch(e){
    statusText.textContent = "Error al recortar la imagen.";
    runBtn.disabled = false;
  }
}

runBtn.addEventListener("click", runTool);
