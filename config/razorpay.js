const Razorpay = require('razorpay');

let instance = null;

const getRazorpayInstance = () => {
  if (!instance) {
    const key_id = process.env.RAZORPAY_KEY_ID || 'rzp_test_RAGPlatform2026';
    const key_secret = process.env.RAZORPAY_KEY_SECRET || 'rzp_secret_RAGPlatformSecret2026';

    instance = new Razorpay({
      key_id,
      key_secret,
    });
  }
  return instance;
};

module.exports = { getRazorpayInstance };
