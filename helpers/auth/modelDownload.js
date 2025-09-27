const fs = require('fs');
const path = require('path');
const https = require('https');

// Create models directory in root
const modelsDir = path.join(process.cwd(), 'models');
if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
    console.log('Created models directory');
}

// Model files to download
const models = [
    {
        url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/ssd_mobilenetv1_model-weights_manifest.json',
        filename: 'ssd_mobilenetv1_model-weights_manifest.json'
    },
    {
        url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/ssd_mobilenetv1_model-shard1',
        filename: 'ssd_mobilenetv1_model-shard1'
    },
    {
        url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_landmark_68_model-weights_manifest.json',
        filename: 'face_landmark_68_model-weights_manifest.json'
    },
    {
        url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_landmark_68_model-shard1',
        filename: 'face_landmark_68_model-shard1'
    },
    {
        url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_recognition_model-weights_manifest.json',
        filename: 'face_recognition_model-weights_manifest.json'
    },
    {
        url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_recognition_model-shard1',
        filename: 'face_recognition_model-shard1'
    },
    {
        url: 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_recognition_model-shard2',
        filename: 'face_recognition_model-shard2'
    }
];

function downloadFile(url, filename) {
    return new Promise((resolve, reject) => {
        const filePath = path.join(modelsDir, filename);
        const file = fs.createWriteStream(filePath);
        
        console.log(`Downloading ${filename}...`);
        
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download ${filename}: HTTP ${response.statusCode}`));
                return;
            }
            
            response.pipe(file);
            
            file.on('finish', () => {
                file.close();
                console.log(`✓ Downloaded: ${filename}`);
                resolve();
            });
            
            file.on('error', (err) => {
                fs.unlink(filePath, () => {}); // Delete incomplete file
                reject(err);
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

async function downloadAllModels() {
    console.log('Starting download of face-api.js models...');
    console.log('Target directory:', modelsDir);
    
    try {
        for (let i = 0; i < models.length; i++) {
            const model = models[i];
            console.log(`\n[${i + 1}/${models.length}] ${model.filename}`);
            await downloadFile(model.url, model.filename);
        }
        
        console.log('\n🎉 All models downloaded successfully!');
        console.log('Models saved to:', modelsDir);
        console.log('\nFiles in models directory:');
        
        const files = fs.readdirSync(modelsDir);
        files.forEach(file => {
            const filePath = path.join(modelsDir, file);
            const stats = fs.statSync(filePath);
            console.log(`  - ${file} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        });
        
    } catch (error) {
        console.error('\n❌ Error downloading models:', error.message);
        process.exit(1);
    }
}

// Check if models already exist
const existingFiles = fs.existsSync(modelsDir) ? fs.readdirSync(modelsDir) : [];
if (existingFiles.length > 0) {
    console.log('Found existing files in models directory:');
    existingFiles.forEach(file => console.log(`  - ${file}`));
    console.log('\nThis will overwrite existing files. Continue? (Ctrl+C to cancel)');
    setTimeout(downloadAllModels, 2000);
} else {
    downloadAllModels();
}