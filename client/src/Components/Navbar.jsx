// Navbar.jsx
import { Link, useLocation, useNavigate } from 'react-router-dom';

function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const isRoom = location.pathname.startsWith('/room/');

  return (
    <nav style={{ 
      display: "flex", 
      justifyContent: "space-between", 
      alignItems: "center", 
      padding: "10px 20px", 
      backgroundColor: "#333", 
      color: "white" 
    }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        {isRoom && (
          <button 
            onClick={() => navigate('/')} 
            style={{ 
              marginRight: "15px", 
              padding: "6px 12px", 
              cursor: "pointer", 
              backgroundColor: "#e50914", 
              color: "white", 
              border: "none", 
              borderRadius: "4px",
              fontWeight: "bold"
            }}
          >
            ← Back
          </button>
        )}
        <h2>Cinemate</h2> {/* Logo or name */}
      </div>
      <div>
        {/* <Link to="/" style={{ color: "white", marginRight: "15px", textDecoration: "none" }}>
          Home
        </Link>
        <Link to="/create-room" style={{ color: "white", textDecoration: "none" }}>
          Create Room
        </Link> */}
      </div>
    </nav>
  );
}

export default Navbar;
