import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

function Home() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [roomInput, setRoomInput] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setIsLoggedIn(false); // Not logged in, so show login/signup buttons
    } else {
      setIsLoggedIn(true); // Logged in, show logout button
    }
  }, []);

  const handleCreateRoom = () => {
    const roomId = uuidv4();
    navigate(`/room/${roomId}`);
  };

  const handleJoinRoom = () => {
    let roomId = roomInput.trim();
    if (roomId.includes("/room/")) {
      roomId = roomId.split("/room/")[1]; // Extract ID from full link
    }
    if (roomId && roomId.length > 5) {
      navigate(`/room/${roomId}`);
    } else {
      alert("Please enter a valid Room ID or full room link.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsLoggedIn(false); // Set logged in state to false
    navigate("/login"); // Navigate to login page
  };

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>Welcome to Watch Party 🎬</h1>

      {isLoggedIn ? (
        <>
          <button onClick={handleCreateRoom} style={{ margin: "10px" }}>
            Create Room
          </button>
          <div style={{ marginTop: "30px" }}>
            <input
              type="text"
              placeholder="Enter Room ID or Link"
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value)}
              style={{
                padding: "10px",
                width: "300px",
                marginBottom: "10px",
              }}
            />
            <br />
            <button onClick={handleJoinRoom}>Join Room</button>
          </div>

          <div style={{ marginTop: "30px" }}>
            <button onClick={handleLogout} style={{ margin: "10px" }}>
              Logout
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ marginTop: "30px" }}>
            <Link to="/signup">
              <button style={{ margin: "10px" }}>Sign Up</button>
            </Link>
            <Link to="/login">
              <button style={{ margin: "10px" }}>Login</button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export default Home;
