const fs = require('fs').promises;
const imagekit = require('../configs/imageKitConfig')


const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword', 
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
];

const uploadFile = async (req, res) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ error: 'No files were uploaded.' });
    }

    const files = Array.isArray(req.files.file) ? req.files.file : [req.files.file];
    const uploadResults = [];

    for (const file of files) {
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        return res.status(400).json({ error: 'Only image, PDF, DOC, and DOCX files are allowed.' });
      }

      const fileBuffer = await fs.readFile(file.tempFilePath);

      const result = await imagekit.upload({
        file: fileBuffer.toString('base64'),
        fileName: file.name,
        folder: 'AURA'
      });

      uploadResults.push({
        url: result.url,
        fileId: result.fileId,
        fileName: result.name,
        type: file.mimetype
      });

      await fs.unlink(file.tempFilePath);
    }

    res.status(200).json({ success: true, files: uploadResults });
  } catch (error) {
    console.error('Upload error:', error.message);
    res.status(500).json({ error: 'File upload failed. ' + error.message });
  }
};

module.exports = {
  uploadFile
};