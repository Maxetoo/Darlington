const ai = require('../configs/geminiConfig.js')

const getEmbedding = async(text) => {
    const response = await ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents: text,
    });

    return response.embeddings[0].values
}

module.exports = {
    getEmbedding
}  