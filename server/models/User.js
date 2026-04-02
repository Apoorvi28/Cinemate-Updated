const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  resetOtp: { type: String },
  resetOtpExpiry: { type: Date },
  loginOtp: { type: String },
  loginOtpExpiry: { type: Date }
});

module.exports = mongoose.model('User', UserSchema);
