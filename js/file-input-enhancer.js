(function () {
  const imageInput = document.getElementById("imageInput");
  const dropOverlay = document.getElementById("dropOverlay");

  if (!imageInput || !dropOverlay) return;

  let dragCounter = 0;

  function isImageFile(file) {
    return file && file.type && file.type.startsWith("image/");
  }

  function assignFileToInput(file) {
    if (!file || !isImageFile(file)) return false;

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    imageInput.files = dataTransfer.files;

    imageInput.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function getImageFileFromDataTransfer(dataTransfer) {
    if (!dataTransfer) return null;

    const files = dataTransfer.files;
    if (files && files.length) {
      for (const file of files) {
        if (isImageFile(file)) return file;
      }
    }

    return null;
  }

  document.addEventListener("dragenter", function (e) {
    e.preventDefault();
    dragCounter++;
    dropOverlay.classList.add("active");
  });

  document.addEventListener("dragover", function (e) {
    e.preventDefault();
  });

  document.addEventListener("dragleave", function (e) {
    e.preventDefault();
    dragCounter--;

    if (dragCounter <= 0) {
      dragCounter = 0;
      dropOverlay.classList.remove("active");
    }
  });

  document.addEventListener("drop", function (e) {
    e.preventDefault();
    dragCounter = 0;
    dropOverlay.classList.remove("active");

    const file = getImageFileFromDataTransfer(e.dataTransfer);

    if (!file) {
      alert("Suelta una imagen válida.");
      return;
    }

    assignFileToInput(file);
  });

  document.addEventListener("paste", function (e) {
    const items = e.clipboardData && e.clipboardData.items
      ? Array.from(e.clipboardData.items)
      : [];

    const imageItem = items.find(item => item.type && item.type.startsWith("image/"));

    if (!imageItem) return;

    const file = imageItem.getAsFile();

    if (!file) return;

    e.preventDefault();
    assignFileToInput(file);
  });
})();
