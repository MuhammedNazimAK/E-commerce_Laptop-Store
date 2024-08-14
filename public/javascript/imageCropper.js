function initImageCropper(imageCropperModal) {
    let cropper;
    let selectedImageElement;
    let orginalImageData;

    const handleImageClick = (img) => {
        const modalBody = imageCropperModal._element.querySelector('.modal-body');
        modalBody.innerHTML = '';

        const imageToCrop = document.createElement('img');
        modalBody.appendChild(imageToCrop);

        if (!orginalImageData) {
            orginalImageData = img.src;
        }
        imageToCrop.src = orginalImageData;

        imageCropperModal.show();
        selectedImageElement = img;

        if (cropper) {
            cropper.destroy();
        }

        cropper = new Cropper(imageToCrop, {
            aspectRatio: NaN,
            viewMode: 1,
        });
    };

    const handleCropSave = (cropSaveButton) => {
        cropSaveButton.addEventListener('click', () => {
            if (cropper && selectedImageElement) {
                const croppedCanvas = cropper.getCroppedCanvas({
                     width: 200,
                      height: 200,
                      fillColor: '#fff',
                 });
                const croppedImage = croppedCanvas.toDataURL('image/jpeg');
                selectedImageElement.src = croppedImage;
                imageCropperModal.hide();
                cropper.destroy();
                selectedImageElement = null;
            }
        });
    };

    imageCropperModal._element.addEventListener('hidden.bs.modal', () => {
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }
        selectedImageElement = null;
    });

    return { cropper, handleImageClick, handleCropSave };
}
