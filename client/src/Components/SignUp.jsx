import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    try {
      // Send POST request to backend to create a new user
      const response = await axios.post('http://localhost:4000/api/auth/signup', { email, password });


      // Store JWT token in localStorage
      localStorage.setItem('token', response.data.token);

      // Redirect to home page after successful signup
      navigate('/');
    } catch (err) {
      // Handle errors from backend (e.g., user already exists, invalid input)
      setError(err.response?.data?.msg || 'Something went wrong during signup');
    }
  };

  return (
    <div className="auth-container">
      <div className="glass-panel">
        <h2 className="premium-title">Join Watch Party</h2>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-group">
            <label htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="input-group">
            <label htmlFor="signup-password">Password</label>
            <input
              id="signup-password"
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="submit-group">
            <button type="submit" className="premium-btn">Sign Up</button>
          </div>
        </form>

        {/* Show error message if there's any issue during signup */}
        {error && <div className="error-message">{error}</div>}
      </div>
    </div>
  );
}

export default SignUp;
