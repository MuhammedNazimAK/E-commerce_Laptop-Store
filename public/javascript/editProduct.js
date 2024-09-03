function gatherProductData() {
    const fields = ['name', 'brand', 'description', 'processor', 'ram', 'storage', 'graphicsCard', 'color', 'regularPrice', 'salesPrice', 'stockAvailability'];

    const basicInformation = {};
    const technicalSpecification = {};
    const designAndBuild = {};
    const pricingAndAvailability = {};
    const categories = Array.from(document.querySelectorAll('input[name="categories"]:checked')).map(checkbox => checkbox.value);
    console.log("selected categories", categories);

    for (const field of fields) {
        const element = document.getElementById(`product_${field}`);
        if (element) {
            switch (field) {
                case 'name':
                case 'brand':
                case 'description':
                    basicInformation[field] = element.value;
                    break;
                case 'processor':
                case 'ram':
                case 'storage':
                case 'graphicsCard':
                    technicalSpecification[field] = element.value;
                    break;
                case 'color':
                    designAndBuild[field] = element.value;
                    break;
                case 'regularPrice':
                case 'salesPrice':
                case 'stockAvailability':
                    pricingAndAvailability[field] = parseFloat(element.value) || 0;
                    break;
            }
        } else {
            console.error(`Element with id "product_${field}" not found.`);
        }
    }

    return {
        basicInformation,
        technicalSpecification,
        designAndBuild,
        pricingAndAvailability,
        categories,
    };
}

let originalImageBlobs = [];

async function prepareFormData() {
    const productData = gatherProductData();
    const formData = new FormData();
  
    formData.append('productId', document.getElementById('update').dataset.productId);
    formData.append('productData', JSON.stringify(productData));
  
    formData.append('categories', JSON.stringify(productData.categories));
  
    // Append images
    if (originalImageBlobs.length > 0) {
        originalImageBlobs.forEach((blob, index) => {
            const file = blob.file instanceof File ? blob.file : new File([blob.file], `image_${index}.jpg`, { type: 'image/jpeg' });
            formData.append('images', file);
        });
    } else {
        console.log('No images to append.');
    }

    //append existing images
    const existingImages = document.querySelectorAll('.existing-image');
    const existingImageUrls = Array.from(existingImages).map(image => image.dataset.imgSrc);
    formData.append('existingImages', JSON.stringify(existingImageUrls));

    return formData;
  };


  let isUpdating = false;

// Handle form update button click
async function handleUpdateClick(event) {
    const productId = event.target.dataset.productId;

    if (isUpdating) {
        return;
    } 

    isUpdating = true;

    try {
        const updateData = await prepareFormData();

        const response = await axios.put(`/admin/editProduct/${productId}`, updateData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });

        if (response.data.success) {
            showSuccessMessage('Product updated successfully.');
            console.log('Product updated successfully:', response.data);
        } else {
            showErrorMessage(response.data.message || 'There was an error updating the product.');
        }
    } catch (error) {
        showErrorMessage('There was an error updating the product.', error);
    } finally {
        isUpdating = false;
    }
}

function showSuccessMessage(message) {
    Swal.fire({
        title: 'Success!',
        text: message,
        icon: 'success'
    });
}

function showErrorMessage(message, error) {
    console.error('Error:', error);
    Swal.fire({
        title: 'Error!',
        text: message,
        icon: 'error'
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const imageInput = document.getElementById("fileAccess");
    const imagePreview = document.getElementById("imagePreview");
    const imageToCrop = document.getElementById("imageToCrop");
    const cropAndSave = document.getElementById("cropAndSave");
    const cropperModalElement = document.getElementById("cropperModal");
    const formSubmitButton = document.getElementById("update");
    console.log( "formSubmitButton", formSubmitButton );
    const fileAccessError = document.getElementById("fileAccessError");
    
    let cropper; // hold the Cropper.js instance
    let currentImage;

    // Function to validate if the file is an image
    function isImageFile(file) {
        return file && file.type.startsWith('image/');
    }

    imageInput.addEventListener("change", (event) => {
        const files = event.target.files;

        // Clear previous file access errors
        fileAccessError.textContent = '';

        Array.from(files).forEach((file) => {
            if (!isImageFile(file)) {
                fileAccessError.textContent = 'Only image files are allowed.';
                return;
            }

            const reader = new FileReader();

            reader.onload = (e) => {
                const img = document.createElement("img");
                img.src = e.target.result;
                img.classList.add("img-thumbnail");
                img.dataset.originalSrc = e.target.result;
                img.dataset.index = originalImageBlobs.length;
                img.dataset.cropped = 'false';
                img.classList.add('preview-image');

                const removeButton = document.createElement("button");
                removeButton.textContent = "Remove";
                removeButton.classList.add("btn", "btn-danger", "btn-sm", "delete-btn");
                removeButton.dataset.imgSrc = e.target.result;
                removeButton.dataset.index = originalImageBlobs.length;

                const container = document.createElement("div");
                container.classList.add("img-container");
                container.appendChild(img);
                container.appendChild(removeButton);
                imagePreview.appendChild(container);

                originalImageBlobs.push({ src: e.target.result, file });
            };

            reader.readAsDataURL(file);
        });
    });

    // Function to remove an image
    function removeImage(index) {
        const containers = document.querySelectorAll(".img-container");
        if (containers[index]) {
            containers[index].remove();
            originalImageBlobs.splice(index, 1);
            updateFileInput();
        }
    }

    // Event delegation for remove buttons
    imagePreview.addEventListener("click", (event) => {
        if (event.target.classList.contains("delete-btn")) {
            const index = event.target.dataset.index;
            removeImage(index);
        }
    });

    // Update file input with the current images
    function updateFileInput() {
        const dataTransfer = new DataTransfer();
        originalImageBlobs.forEach(blob => {
            const file = blob.file instanceof File ? blob.file : new File([blob.file], 'image/jpg', { type: 'image/jpeg' });
            dataTransfer.items.add(file);
        });
        imageInput.files = dataTransfer.files;
    }

    // Handle image cropping and saving
    cropAndSave.addEventListener("click", () => {
        if (cropper) {
            cropper.getCroppedCanvas().toBlob((blob) => {
                const reader = new FileReader();
                reader.onloadend = () => {

                // Always save the original source if it's not already saved
                if (!currentImage.dataset.originalSrc) {
                    currentImage.dataset.originalSrc = currentImage.src;
                }

                // Update the image with the new cropped version
                currentImage.src = reader.result;
                currentImage.dataset.imgSrc = reader.result;
                currentImage.dataset.cropped = 'true';
                
                // Update the blob in originalImageBlobs
                const index = parseInt(currentImage.dataset.index);
                originalImageBlobs[index] = { 
                    src: reader.result, 
                    file: blob, 
                    originalSrc: currentImage.dataset.originalSrc 
                };
                
                $(cropperModalElement).modal('hide');
                updateFileInput(); // Update the file input after cropping
            };
            reader.readAsDataURL(blob);
            });
        }
    });    

    // Open cropper modal and initialize Cropper.js
    imagePreview.addEventListener("click", (event) => {
        if (event.target.classList.contains("img-thumbnail")) {
            currentImage = event.target;

            console.log("currentImage", currentImage);
            console.log('data attributes', currentImage.dataset);

            let imgSrc;
            if (currentImage.dataset.originalSrc) {
                // Always use the original source for editing
                imgSrc = currentImage.dataset.originalSrc;
            } else {
                // Fallback to the current src or data-img-src if original is not available
                imgSrc = currentImage.dataset.imgSrc || currentImage.src;
            }

        console.log('image source for cropper', imgSrc);

        if (!imgSrc) {
            console.error('No image source found for cropper.');
            return;
        }

        imageToCrop.src = imgSrc;

            imageToCrop.onload = () => {
            $(cropperModalElement).modal('show');
            };  
        }
    });

    // Initialize cropper.js on modal show
    $(cropperModalElement).on('shown.bs.modal', () => {
        try {
            console.log("imageToCrop", imageToCrop);
        cropper = new Cropper(imageToCrop, {
            aspectRatio: 4 / 3,
            viewMode: 2,
            autoCropArea: 1,
            preview: ".cropper-preview",
            ready() {
                console.log("cropper ready");
                cropper.reset();
            },
        });
    } catch (error) {
        console.error("Error initializing cropper:", error);
    }
});

    // Destroy cropper instance on modal hide
    $(cropperModalElement).on('hidden.bs.modal', () => {
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }
    });

});
