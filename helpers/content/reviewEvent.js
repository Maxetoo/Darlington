const ai = require('../../configs/geminiConfig')
const CustomError = require('../../errors')

const verifyEvent = async (eventTitle) => {
  // validate input
  if (!eventTitle || typeof eventTitle !== 'string') {
    throw new CustomError.BadRequestError('Event name or description is required')
  }

  const trimmedEvent = eventTitle.trim()
  if (trimmedEvent.length === 0) {
    throw new CustomError.BadRequestError('Event title cannot be empty')
  }

  // ask Gemini to perform a web search on the event
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Perform a web search and verify if the following event actually exists and is legitimate:
    """
    ${trimmedEvent}
    """

    Your task:
    - Search online for this event name, location, or context.
    - Check if it appears on reputable sources (official websites, ticket platforms, event listings, or news).
    - Detect if there are any signs of scam, phishing, or fake events.
    - Determine if the event date is upcoming, ongoing, or already ended.

    Respond ONLY with valid JSON in this format:
    {
      "legitimate": true,
      "reason": "",
      "sources": ["source1", "source2"]
    }

    If the event seems suspicious or unverifiable, set "legitimate" to false and give a short reason (max 100 characters).
    Include any reliable URLs or platform names in "sources".`,
    config: {
      systemInstruction: "You are a fact-checking AI verifying real-world event legitimacy through online search.",
      responseMimeType: "application/json",
      webSearch: true // ensures Gemini uses the web to verify
    },
  })

  // parse response
  const resultText = response.text
  const result = JSON.parse(resultText)

  return result
}

module.exports = verifyEvent
