const {GoogleGenAI} = require('@google/genai')
const ai = new GoogleGenAI(process.env.GOOGLE_API_KEY);

module.exports = ai