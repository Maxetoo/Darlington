import {
    pipeline
} from '@xenova/transformers';

export async function getEmbedding(text) {
    try {
        const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        const output = await extractor(text, {
            pooling: 'mean',
            normalize: true
        });
        return output.data;
    } catch (error) {
        console.error('Error in getEmbedding:', error);
        throw error;
    }
}