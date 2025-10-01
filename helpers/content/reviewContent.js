const ai = require('../../configs/geminiConfig')
const CustomError = require('../../errors')

const contentReview = async(content) => {

    // validate input
    if (!content || typeof content !== 'string') {
        throw new CustomError.BadRequestError('Content is required')
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length === 0) {
        throw new CustomError.BadRequestError('Content cannot be empty')
    }

    // generate content review
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analyze the following content for appropriateness in an enterprise application context.
        
        Content to review:
        """
        ${trimmedContent}
        """

        Check for:
        - Offensive language or hate speech
        - Inappropriate or explicit content
        - Spam or malicious content
        - Professional tone violations

        Respond ONLY with valid JSON in this exact format:
        {
          "suitable": true,
          "reason": ""
        }

        If unsuitable, set "suitable" to false and provide a brief reason (max 100 characters).`,
          config: {
            systemInstruction: "You are a content moderation system for enterprise applications. Analyze content objectively and return only valid JSON responses.",
            responseMimeType: "application/json"
          },
        });

        // parse the response
        const resultText = response.text;
        const result = JSON.parse(resultText);
        return result
}


module.exports = contentReview