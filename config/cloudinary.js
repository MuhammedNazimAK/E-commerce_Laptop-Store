const cloudinary = require('cloudinary').v2;
const fs = require('fs');
require('dotenv').config();


cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});


const uploadVideos = async (videos) => {
  if (!videos || videos.length === 0) {
    throw new Error('No valid videos provided for upload');
  }

  const uploadPromises = videos.map(async (video) => {
    if (!video || !video.path || !fs.existsSync(video.path)) {
      console.error('Invalid video:', video);
      return null;
    }

    try {
      const result = await cloudinary.uploader.upload(video.path, { resource_type: 'video' });
      return result.secure_url;
    } catch (error) {
      console.error('Error during video upload:', error);
      return null;
    }
  });

  const results = await Promise.allSettled(uploadPromises);
  const fulfilledResults = results.filter((result) => result.value !== null);
  const successfulUploads = fulfilledResults.map((result) => result.value);

  if (successfulUploads.length === 0) {
    throw new Error('No videos were uploaded successfully');
  }

  return successfulUploads;
};


const uploadImages = async (images) => {
  try {
  if (!images || images.length === 0) {
    throw new Error('No valid images provided for upload');
  }

  const uploadPromises = images.map(async (image) => {
    if (!image || !image.tempFilePath || !fs.existsSync(image.tempFilePath)) {
      console.error('Invalid image:', image);
      return null;
    }

    try {
      const result = await cloudinary.uploader.upload(image.tempFilePath, {
         resource_type: 'auto',
         quality: 'auto:best',
         fetch_format: 'auto',
         flags: 'preserve_transparency',
        });
      return result.secure_url;
    } catch (error) {
      console.error('Error during image upload:', image.name, error, error.stack);
      return null;
    }
  });

  const results = await Promise.all(uploadPromises);
  console.log('Upload results from cloudinary:', results);
  const successfulUploads = results.filter(result => result !== null);

  if (successfulUploads.length === 0) {
    throw new Error('No images were uploaded successfully');
  }

  return successfulUploads;
} catch (error) {
  console.error('Error uploading images:', error);
  throw error;
 }
};


module.exports = { uploadImages, uploadVideos, cloudinary };