const CustomError = require('../../errors')

// validation for service providers
const serviceProviderErrorLogs = ({ documents, profession, bio, experience, pricing, portfolio, profileImage, phone }) => {
  // check for verification documents 
  if (!documents || Object.keys(documents).length < 2) {
    throw new CustomError.BadRequestError(`Attach important verification documents`);
  }

  // check for profession 
  if (!profession) {
    throw new CustomError.BadRequestError(`Profession/Skill needs to be specified`);
  }

  // service description 
  if (!bio) {
    throw new CustomError.BadRequestError(`Overall service description is required`);
  }

  // check for experience
  if (!experience) {
    throw new CustomError.BadRequestError(`Experience level is required`);
  }

  // check for pricing 
  if (!pricing || !pricing.sessionRate) {
    throw new CustomError.BadRequestError(`Pricing per session needs to be specified`);
  }


  // check for portfolio 
  if (!portfolio || portfolio.length < 1) {
    throw new CustomError.BadRequestError(`Attach portfolio to show work experience`);
  }

  // check for profile image
  if (!profileImage) {
    throw new CustomError.BadRequestError(`Profile image is required`);
  }

  // check for phone number 
  if (!phone) {
    throw new CustomError.BadRequestError(`Phone number is required`);
  }
};


module.exports = {
    serviceProviderErrorLogs
}
