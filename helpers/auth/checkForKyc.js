const axios = require('axios');
const sharp = require('sharp');
const path = require('path');
const faceapi = require('face-api.js');
const canvas = require('canvas');
const { Canvas, Image, ImageData } = canvas;

// Patch face-api.js to work with Node.js
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

let modelsLoaded = false;

// Load tinyFaceDetector models instead of ssdMobilenetv1
async function loadModels() {
  if (modelsLoaded) return;
  const modelsPath = path.join(__dirname, '../../models');
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromDisk(modelsPath),
    faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath),
    faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath)
  ]);
  modelsLoaded = true;
  console.log("✅ TinyFaceDetector models loaded");
}

// Download image as buffer
async function downloadImage(url) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 8000,
      maxContentLength: 3 * 1024 * 1024 // 3MB limit
    });
    return Buffer.from(response.data);
  } catch (err) {
    throw new Error(`Failed to download image: ${url} → ${err.message}`);
  }
}

// Resize & compress for efficiency
async function preprocessImage(imageBuffer) {
  return sharp(imageBuffer)
    .resize(320, 320, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 75 })
    .toBuffer();
}

// Extract face descriptor using TinyFaceDetector
async function extractFaceDescriptor(imageBuffer) {
  try {
    const img = await canvas.loadImage(
      `data:image/jpeg;base64,${imageBuffer.toString('base64')}`
    );

    const detection = await faceapi
      .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({
        inputSize: 320,   // smaller inputSize = faster, but less accurate
        scoreThreshold: 0.5
      }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      throw new Error('No face detected');
    }

    return detection.descriptor;
  } catch (err) {
    throw new Error(`Face extraction failed: ${err.message}`);
  }
}

// Compare ID vs Selfie
async function checkForKyc(governmentIdUrl, liveSelfieUrl) {
  try {
    await loadModels();

    if (!governmentIdUrl || !liveSelfieUrl) {
      return { isMatch: false, similarity: 0, error: 'Both URLs are required' };
    }

    // Download + preprocess in parallel
    const [processedId, processedSelfie] = await Promise.all([
      downloadImage(governmentIdUrl).then(preprocessImage),
      downloadImage(liveSelfieUrl).then(preprocessImage)
    ]);

    // Extract descriptors
    const [idDescriptor, selfieDescriptor] = await Promise.all([
      extractFaceDescriptor(processedId),
      extractFaceDescriptor(processedSelfie)
    ]);

    // Compare faces
    const distance = faceapi.euclideanDistance(idDescriptor, selfieDescriptor);
    const similarity = +(1 - distance).toFixed(4);
    const isMatch = similarity >= 0.6;

    return { isMatch, similarity };
  } catch (error) {
    console.error('❌ KYC Error:', error.message);
    return { isMatch: false, similarity: 0, error: error.message };
  }
}

module.exports = { checkForKyc, loadModels };

