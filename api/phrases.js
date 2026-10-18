const { DATA } = require('../lib/quiz-core');

module.exports = (req, res) => {
  res.status(200).json({
    languages: DATA.languages,
    features: {
      aiQuiz: Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY),
      whisper: Boolean(process.env.OPENAI_API_KEY),
    },
  });
};
