const imageInput = document.getElementById("imageInput");
const qualitySelect = document.getElementById("quality");
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

function canvasToBlob(canvas, quality){
return new Promise((resolve)=>{
canvas.toBlob((blob)=>resolve(blob),"image/jpeg",quality);
});
}

async function runTool(){

const file = imageInput.files[0];

if(!file){
alert("Selecciona una imagen primero.");
return;
}

runBtn.disabled = true;
statusText.textContent = "Procesando imagen...";

try{

const quality = parseFloat(qualitySelect.value);

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

const blob = await canvasToBlob(canvas, quality);

const url = URL.createObjectURL(blob);

resultPreview.src = url;

const reduction = ((1 - (blob.size / file.size)) * 100).toFixed(1);

resultMeta.innerHTML = `
Tamaño: ${formatBytes(blob.size)}<br>
Resolución: ${img.width} × ${img.height}<br>
Reducción: ${reduction > 0 ? reduction : 0}%
`;

downloadLink.href = url;
downloadLink.download = "ralyzo-comprimida.jpg";
downloadLink.textContent = "Descargar imagen";

resultSection.style.display = "grid";

statusText.textContent = "Compresión completada.";

}catch(e){

statusText.textContent = "Error al procesar la imagen.";

}finally{

runBtn.disabled = false;

}

}

runBtn.addEventListener("click", runTool);
