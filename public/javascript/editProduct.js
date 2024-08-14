// cropper is assgned a value in the initImageCropper function
async function handleProductImages(files) {
    const formData = new FormData();
    const files = [...event.target.files];

        files.forEach((file, index) => {
        if (typeof cropper !== 'undefined' && cropper) {
            const canvas = cropper.getCroppedCanvas();
            if (canvas) {
                canvas.toBlob(async (blob) => {
                    formData.append(`images`, blob, `image_${index}.jpg`);
                }, 'image/jpeg');
            } else {
                formData.append('images', file);
            }
        } else {
            formData.append('images', file);
        }
    });

    return formData;
}
  

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

    console.log("categories", categories);
    return {
        basicInformation,
        technicalSpecification,
        designAndBuild,
        pricingAndAvailability,
        categories,
    };
}

async function prepareFormData() {
    const productData = gatherProductData();
    const formData = new FormData();
  
    formData.append('productId', document.getElementById('update').dataset.productId);
    formData.append('productData', JSON.stringify(productData));
  
    Object.entries(productData.basicInformation).forEach(([key, value]) => {
      formData.append(`basicInformation[${key}]`, value);
    });
  
    Object.entries(productData.technicalSpecification).forEach(([key, value]) => {
      formData.append(`technicalSpecification[${key}]`, value);
    });
  
    Object.entries(productData.designAndBuild).forEach(([key, value]) => {
      formData.append(`designAndBuild[${key}]`, value);
    });
  
    Object.entries(productData.pricingAndAvailability).forEach(([key, value]) => {
      formData.append(`pricingAndAvailability[${key}]`, Number(value));
    });
  
    formData.append('categories', JSON.stringify(productData.categories));
  
    // Append images
    const processedImages = await handleProductImages(document.getElementById('product_images').files);
    processedImages.forEach((file, index) => {
    formData.append(`images`, file, file.name);
    });
    return formData;
  };

let isUpdating = false;

async function handleUpdateClick(event) {
    event.preventDefault();

    if (isUpdating) {
        return;
    }

    isUpdating = true;

    try {
        const updateData = await prepareFormData();

        for (let [key, value] of updateData.entries()) {
            console.log(key, value);
          }


        const response = await axios.put(`/admin/editProduct/${document.getElementById('update').dataset.productId}`, updateData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });

        console.log("response:", response);

        if (response.data.success) {
            showSuccessMessage('Product updated successfully.');
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

document.addEventListener('DOMContentLoaded', () => {
    const updateButton = document.getElementById('update');
    if (!updateButton) {
        console.error('Update button not found.');
        return;
    }
    
    const productId = updateButton.dataset.productId;
    console.log('Product ID:', productId);
  
    updateButton.addEventListener('click', handleUpdateClick);


    const imageCropperModal = new bootstrap.Modal(document.getElementById('image-cropper-modal'), {});

    const deleteButtons = document.querySelectorAll('.delete-btn');
        
    const imageInput = document.getElementById('product_images');
    const imagePreviewContainer = document.getElementById('image-preview');
    const imageToCrop = document.getElementById('cropper-image');
    const cropSaveButton = document.getElementById('crop-image');

    if (imageCropperModal && imageCropperModal._element) {
        const { cropper, handleImageClick, handleCropSave } = initImageCropper(imageCropperModal);
        handleCropSave(cropSaveButton);

        imagePreviewContainer.addEventListener('click', (event) => {
            if (event.target.matches('img')) {
                handleImageClick(event.target);
            }
        });
    }

    const createDeleteButton = (imageContainer) => {
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.classList.add('btn', 'btn-danger', 'btn-sm');
        deleteButton.style.position = 'absolute';
        deleteButton.style.top = '10px';
        deleteButton.style.right = '10px';
        deleteButton.style.zIndex = '1000';

        deleteButton.addEventListener('click', (event) => {
            event.stopPropagation();
            imageContainer.remove();
        });

        return deleteButton;
    };

    const reader = new FileReader();
    reader.onload = function (e) {
        const img = document.createElement('img');
        img.src = e.target.result;
        img.classList.add('img-thumbnail');
        img.style.cursor = 'pointer';

        const imageContainer = document.createElement('div');
        imageContainer.classList.add('img-container');
        imageContainer.appendChild(img);

        const deleteButton = createDeleteButton(imageContainer);
        imageContainer.appendChild(deleteButton);

        imagePreviewContainer.appendChild(imageContainer);
    };

    imageInput.addEventListener('change', (event) => {
        const files = [...event.target.files];
        handleProductImages(files)
            .then(() => {
                console.log('All images have been uploaded.');
            })
            .catch((error) => {
                console.error('Error:', error);
                Swal.fire({
                    title: "Error!",
                    text: "There was an error uploading the images.",
                    icon: "error"
                });
            });
        handleFiles(files);
    });

    const handleFiles = async (files) => {
        files.forEach(file => reader.readAsDataURL(file));
    }

    deleteButtons.forEach((button) => {
        button.addEventListener('click', async (event) => {
            event.preventDefault();
            const index = event.target.dataset.index;
            const confirmed = await confirmDelete();

            if (confirmed) {
                await deleteImage(index);

                event.target.parentElement.remove();
            }
        });
    });

    const confirmDelete = () => {
        return new Promise((resolve) => {
            Swal.fire({
                title: 'Are you sure?',
                text: "You won't be able to revert this!",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Yes, delete it!'
            }).then((result) => {
                if (result.isConfirmed) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
        });
    };

    const deleteImage = async (index) => {
        try {
            const response = await axios.delete(`/admin/deleteImage/${document.getElementById('update').dataset.productId}/${index}`);
            data = response.data;
            console.log(data);

            if (response.data.success) {
                Swal.fire({
                    title: "Success!",
                    text: "Image deleted successfully.",
                    icon: "success"
                });
            } else {
                Swal.fire({
                    title: "Error!",
                    text: response.data.message || "There was an error deleting the image.",
                    icon: "error"
                });
            }
        } catch (error) {
            console.error('Error:', error);
            Swal.fire({
                title: "Error!",
                text: "There was an error deleting the image.",
                icon: "error"
            });
        };
    }
});
