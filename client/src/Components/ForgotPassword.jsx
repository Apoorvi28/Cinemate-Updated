import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState(1);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSendOtp = async (e) => {
    e.preventDefault();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await axios.post('http://localhost:4000/api/auth/forgot-password', { email });
      setMessage(response.data.msg || "OTP sent to your email!");
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to send OTP. Please check the email.');
    }
    setLoading(false);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (!otp || otp.length !== 6) {
      setError('Please enter the 6-digit OTP');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await axios.post('http://localhost:4000/api/auth/reset-password', { email, otp, newPassword });
      setMessage(response.data.msg || "Password reset successful!");
      // Redirect to login after a short delay
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.msg || 'Invalid OTP or failed to reset password.');
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="glass-panel">
        <h2 className="premium-title">{step === 1 ? "Reset Password" : "Verify OTP"}</h2>
        
        {step === 1 && (
          <form onSubmit={handleSendOtp} className="auth-form">
            <div className="input-group">
              <label htmlFor="reset-email">Email</label>
              <input
                id="reset-email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="submit-group">
              <button type="submit" className="premium-btn" disabled={loading}>
                {loading ? "Sending..." : "Send OTP"}
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleResetPassword} className="auth-form">
            <div className="input-group">
              <label htmlFor="otp-input">OTP</label>
              <input
                id="otp-input"
                type="text"
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                maxLength={6}
              />
            </div>
            <div className="input-group">
              <label htmlFor="new-password">New Pass</label>
              <input
                id="new-password"
                type="password"
                placeholder="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="submit-group">
              <button type="submit" className="premium-btn" disabled={loading}>
                {loading ? "Resetting..." : "Reset Password"}
              </button>
            </div>
          </form>
        )}

        {message && <div style={{marginTop: '15px', color: '#4caf50', background: 'rgba(76, 175, 80, 0.1)', padding: '10px', borderRadius: '5px', textAlign: 'center', width: '100%', border: '1px solid rgba(76, 175, 80, 0.3)'}}>{message}</div>}
        {error && <div className="error-message">{error}</div>}
        
        <div className="auth-footer" style={{marginTop: '20px'}}>
          <p><span className="auth-link bold-link" style={{cursor: 'pointer'}} onClick={() => navigate('/login')}>Back to Login</span></p>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
