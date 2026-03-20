const imageInput = document.getElementById("imageInput");
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
    alert("Selecciona un archivo JPG o JPEG.");
    return;
  }

  runBtn.disabled = true;
  statusText.textContent = "Convirtiendo imagen...";

  try{
    const {img,dataUrl} = await loadImage(file);

    originalPreview.src = dataUrl;

    originalMeta.innerHTML = `
      Nombre: ${file.name}<br>
      Tamaño: ${formatBytes(file.size)}<br>
      Resolución: ${img.width} × ${img.height}
    `;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = img.width;
    canvas.height = img.height;

    ctx.drawImage(img,0,0);

    canvas.toBlob((blob)=>{
      const url = URL.createObjectURL(blob);

      resultPreview.src = url;

      resultMeta.innerHTML = `
        Tamaño: ${formatBytes(blob.size)}<br>
        Resolución: ${img.width} × ${img.height}<br>
        Formato: PNG
      `;

      downloadLink.href = url;
      downloadLink.download = "ralyzo-convertida.png";
      downloadLink.textContent = "Descargar PNG";

      resultSection.style.display = "grid";
      statusText.textContent = "Conversión completada.";
      runBtn.disabled = false;

    },"image/png");

  }catch(e){
    statusText.textContent = "Error al convertir la imagen.";
    runBtn.disabled = false;
  }
}

runBtn.addEventListener("click", runTool);
