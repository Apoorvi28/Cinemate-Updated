// App.js
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./Components/Home"; // Check if Home component exists in the src folder
import Room from "./Components/Room"; // Check if Room component exists in the src folder
import SignUp from "./Components/SignUp"; // Check if SignUp component exists in src/components folder
import Login from './Components/Login'; // Check if Login component exists in src/components folder
import ForgotPassword from "./Components/ForgotPassword";
import Navbar from './Components/Navbar';

function App() {
  return (
    <BrowserRouter>
    <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:id" element={<Room />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
