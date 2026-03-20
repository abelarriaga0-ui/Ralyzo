const imageInput = document.getElementById("imageInput");
const angleSelect = document.getElementById("angleSelect");
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
  statusText.textContent = "Girando imagen...";

  try{
    const {img,dataUrl} = await loadImage(file);
    const angle = parseInt(angleSelect.value);

    originalPreview.src = dataUrl;
    originalMeta.innerHTML = `
      Nombre: ${file.name}<br>
      Tamaño: ${formatBytes(file.size)}<br>
      Resolución: ${img.width} × ${img.height}
    `;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if(angle === 90 || angle === 270){
      canvas.width = img.height;
      canvas.height = img.width;
    }else{
      canvas.width = img.width;
      canvas.height = img.height;
    }

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(angle * Math.PI / 180);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);

    canvas.toBlob((blob)=>{
      const url = URL.createObjectURL(blob);

      resultPreview.src = url;
      resultMeta.innerHTML = `
        Tamaño: ${formatBytes(blob.size)}<br>
        Ángulo: ${angle}°<br>
        Resolución: ${canvas.width} × ${canvas.height}
      `;

      downloadLink.href = url;
      downloadLink.download = "ralyzo-girada.png";
      downloadLink.textContent = "Descargar imagen";

      resultSection.style.display = "grid";
      statusText.textContent = "Imagen girada.";
      runBtn.disabled = false;
    },"image/png");
  }catch(e){
    statusText.textContent = "Error al girar la imagen.";
    runBtn.disabled = false;
  }
}

runBtn.addEventListener("click", runTool);
