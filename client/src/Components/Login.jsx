import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [is2FA, setIs2FA] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('http://localhost:4000/api/auth/login', { email, password });
      if (response.data.require2FA) {
        setIs2FA(true);
      }
    } catch (err) {
      setError(err.response?.data?.msg || 'Invalid credentials');
    }
    setLoading(false);
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    setError(null);

    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('http://localhost:4000/api/auth/verify-login', { email, otp });
      localStorage.setItem('token', response.data.token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.msg || 'Invalid OTP');
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="glass-panel">
        <h2 className="premium-title">{is2FA ? "Verify OTP" : "Welcome Back"}</h2>
        
        {!is2FA ? (
          <form onSubmit={handleLoginSubmit} className="auth-form">
            <div className="input-group">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="auth-extras">
              <Link to="/forgot-password" className="auth-link forgot-password">Forgot Password?</Link>
            </div>

            <div className="submit-group">
              <button type="submit" className="premium-btn" disabled={loading}>
                {loading ? "Authenticating..." : "Login"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerify2FA} className="auth-form">
            <p style={{ color: '#e0e0e0', textAlign: 'center', marginBottom: '15px' }}>
              We've sent a 6-digit OTP to your email.
            </p>
            <div className="input-group">
              <label htmlFor="login-otp">OTP</label>
              <input
                id="login-otp"
                type="text"
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                maxLength={6}
              />
            </div>
            <div className="submit-group">
              <button type="submit" className="premium-btn" disabled={loading}>
                {loading ? "Verifying..." : "Verify & Login"}
              </button>
            </div>
          </form>
        )}

        {error && <div className="error-message">{error}</div>}

        {!is2FA && (
          <div className="auth-footer">
            <p>Don&apos;t have an account? <Link to="/signup" className="auth-link bold-link">Sign Up</Link></p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Login;

