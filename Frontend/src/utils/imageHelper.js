/**
 * Optimizes a Cloudinary image URL by inserting transformation parameters.
 * If the URL is not a Cloudinary URL, it is returned unchanged.
 * 
 * @param {string} url - The original image URL.
 * @param {number} width - Target width.
 * @param {number} height - Target height (only used if square is true).
 * @param {boolean} square - Whether to crop into a square with face detection.
 * @returns {string} The optimized image URL.
 */
export const getOptimizedCloudinaryUrl = (url, width = 150, height = 150, square = true) => {
  if (!url || typeof url !== 'string') return url;

  if (url.includes('res.cloudinary.com')) {
    const uploadIndex = url.indexOf('/upload/');
    if (uploadIndex !== -1) {
      const beforeUpload = url.substring(0, uploadIndex + 8); // includes '/upload/'
      const afterUpload = url.substring(uploadIndex + 8);
      
      // transformations:
      // w_<width>, h_<height>: Resize
      // c_fill: Crop to fill width and height
      // g_face: Focus face (excellent for user profiles/avatars)
      // q_auto: Automatic quality (compresses file size while maintaining good detail)
      // f_auto: Automatic format (uses WebP or other modern formats if supported)
      const transformations = square 
        ? `w_${width},h_${height},c_fill,g_face,q_auto,f_auto/`
        : `w_${width},q_auto,f_auto/`;
        
      return `${beforeUpload}${transformations}${afterUpload}`;
    }
  }
  return url;
};
