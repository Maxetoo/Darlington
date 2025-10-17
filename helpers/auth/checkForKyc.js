// const axios = require('axios');
// const sharp = require('sharp');
// const path = require('path');
// const faceapi = require('face-api.js');
// const canvas = require('canvas');
// const { Canvas, Image, ImageData } = canvas;

// // Patch face-api.js to work with Node.js
// faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

// let modelsLoaded = false;

// // Load tinyFaceDetector models instead of ssdMobilenetv1
// async function loadModels() {
//   if (modelsLoaded) return;
//   const modelsPath = path.join(__dirname, '../../models');
//   await Promise.all([
//     faceapi.nets.tinyFaceDetector.loadFromDisk(modelsPath),
//     faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath),
//     faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath)
//   ]);
//   modelsLoaded = true;
//   console.log("✅ TinyFaceDetector models loaded");
// }

// // Download image as buffer
// async function downloadImage(url) {
//   try {
//     const response = await axios.get(url, {
//       responseType: 'arraybuffer',
//       timeout: 8000,
//       maxContentLength: 3 * 1024 * 1024 // 3MB limit
//     });
//     return Buffer.from(response.data);
//   } catch (err) {
//     throw new Error(`Failed to download image: ${url} → ${err.message}`);
//   }
// }

// // Resize & compress for efficiency
// async function preprocessImage(imageBuffer) {
//   return sharp(imageBuffer)
//     .resize(320, 320, { fit: 'inside', withoutEnlargement: true })
//     .jpeg({ quality: 75 })
//     .toBuffer();
// }

// // Extract face descriptor using TinyFaceDetector
// async function extractFaceDescriptor(imageBuffer) {
//   try {
//     const img = await canvas.loadImage(
//       `data:image/jpeg;base64,${imageBuffer.toString('base64')}`
//     );

//     const detection = await faceapi
//       .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({
//         inputSize: 320,   // smaller inputSize = faster, but less accurate
//         scoreThreshold: 0.5
//       }))
//       .withFaceLandmarks()
//       .withFaceDescriptor();

//     if (!detection) {
//       throw new Error('No face detected');
//     }

//     return detection.descriptor;
//   } catch (err) {
//     throw new Error(`Face extraction failed: ${err.message}`);
//   }
// }

// // Compare ID vs Selfie
// async function checkForKyc(governmentIdUrl, liveSelfieUrl) {
//   try {
//     await loadModels();

//     if (!governmentIdUrl || !liveSelfieUrl) {
//       return { isMatch: false, similarity: 0, error: 'Both URLs are required' };
//     }

//     // Download + preprocess in parallel
//     const [processedId, processedSelfie] = await Promise.all([
//       downloadImage(governmentIdUrl).then(preprocessImage),
//       downloadImage(liveSelfieUrl).then(preprocessImage)
//     ]);

//     // Extract descriptors
//     const [idDescriptor, selfieDescriptor] = await Promise.all([
//       extractFaceDescriptor(processedId),
//       extractFaceDescriptor(processedSelfie)
//     ]);

//     // Compare faces
//     const distance = faceapi.euclideanDistance(idDescriptor, selfieDescriptor);
//     const similarity = +(1 - distance).toFixed(4);
//     const isMatch = similarity >= 0.6;

//     return { isMatch, similarity };
//   } catch (error) {
//     console.error('❌ KYC Error:', error.message);
//     return { isMatch: false, similarity: 0, error: error.message };
//   }
// }

// module.exports = { checkForKyc, loadModels };


// const diditApi = require('../../configs/diditConfig');
// const CustomError = require('../../errors');

// const checkForKyc = async (governmentId, liveSelfie) => {
//   try {
//     if (!governmentId || !liveSelfie) {
//       throw new CustomError.BadRequestError('Government ID and live selfie are required for KYC');
//     }

//     // Create verification request
//     const response = await diditApi.post('/v1/verifications', {
//       type: 'identity',
//       documents: {
//         governmentId: governmentId,
//         selfie: liveSelfie
//       },
//       settings: {
//         faceMatch: true,
//         documentValidation: true,
//         livenessCheck: true
//       }
//     });

//     return {
//       verificationId: response.data.id,
//       status: response.data.status,
//       isMatch: response.data.status === 'approved',
//       details: response.data
//     };

//   } catch (error) {
//     console.error('Didit KYC Error:', error.response?.data || error.message);
    
//     if (error.response?.status === 400) {
//       throw new CustomError.BadRequestError('Invalid documents provided for verification');
//     }
    
//     if (error.response?.status === 401) {
//       throw new CustomError.UnauthorizedError('KYC service authentication failed');
//     }

//     throw new CustomError.BadRequestError('KYC verification failed. Please try again.');
//   }
// };

// const getVerificationStatus = async (verificationId) => {
//   try {
//     const response = await diditApi.get(`/v1/verifications/${verificationId}`);
    
//     return {
//       status: response.data.status,
//       isApproved: response.data.status === 'approved',
//       details: response.data
//     };
//   } catch (error) {
//     console.error('Get verification status error:', error.message);
//     throw new CustomError.BadRequestError('Failed to retrieve verification status');
//   }
// };

// module.exports = { checkForKyc, getVerificationStatus };


const diditApi = require('../../configs/diditConfig');
const CustomError = require('../../errors');
const fs = require('fs').promises;
const FormData = require('form-data');

const checkForKyc = async (governmentIdFile, liveSelfieFile) => {
  let governmentIdPath = null;
  let selfiePath = null;

  try {
    if (!governmentIdFile || !liveSelfieFile) {
      throw new CustomError.BadRequestError('Government ID and live selfie files are required for KYC');
    }

    // Get file paths from uploaded files
    governmentIdPath = governmentIdFile.tempFilePath;
    selfiePath = liveSelfieFile.tempFilePath;

    // Read files as buffers
    const governmentIdBuffer = await fs.readFile(governmentIdPath);
    const selfieBuffer = await fs.readFile(selfiePath);

    // Create form data for multipart upload
    const formData = new FormData();
    formData.append('governmentId', governmentIdBuffer, {
      filename: governmentIdFile.name,
      contentType: governmentIdFile.mimetype
    });
    formData.append('selfie', selfieBuffer, {
      filename: liveSelfieFile.name,
      contentType: liveSelfieFile.mimetype
    });
    formData.append('settings', JSON.stringify({
      faceMatch: true,
      documentValidation: true,
      livenessCheck: true
    }));

    // Send to Didit API
    const response = await diditApi.post('/v1/verifications', formData, {
      headers: {
        ...formData.getHeaders()
      }
    });

    return {
      verificationId: response.data.id,
      status: response.data.status,
      isMatch: response.data.status === 'approved',
      details: response.data
    };

  } catch (error) {
    console.error('Didit KYC Error:', error.response?.data || error.message);
    
    if (error.response?.status === 400) {
      throw new CustomError.BadRequestError('Invalid documents provided for verification');
    }
    
    if (error.response?.status === 401) {
      throw new CustomError.UnauthorizedError('KYC service authentication failed');
    }

    throw new CustomError.BadRequestError('KYC verification failed. Please try again.');
  } finally {
    // CRITICAL: Delete temporary files immediately after processing
    try {
      if (governmentIdPath) {
        await fs.unlink(governmentIdPath);
        console.log('✓ Government ID file deleted from temp storage');
      }
      if (selfiePath) {
        await fs.unlink(selfiePath);
        console.log('✓ Selfie file deleted from temp storage');
      }
    } catch (cleanupError) {
      console.error('Error deleting temp files:', cleanupError.message);
    }
  }
};

const getVerificationStatus = async (verificationId) => {
  try {
    const response = await diditApi.get(`/v1/verifications/${verificationId}`);
    
    return {
      status: response.data.status,
      isApproved: response.data.status === 'approved',
      details: response.data
    };
  } catch (error) {
    console.error('Get verification status error:', error.message);
    throw new CustomError.BadRequestError('Failed to retrieve verification status');
  }
};

module.exports = { checkForKyc, getVerificationStatus };

