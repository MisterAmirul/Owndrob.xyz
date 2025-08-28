import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { UserProvider } from './UserContext';
import UserHeader from './components/UserHeader';
import OathSignup from './pages/oath';
import Craft from './pages/craft';
import Preview from './pages/preview';

function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <UserHeader />
        <Routes>
          <Route path="/" element={<OathSignup />} />
          <Route path="/signin" element={<OathSignup />} />
          <Route path="/craft" element={<Craft />} />
          <Route path="/preview" element={<Preview />} />
        </Routes>
      </BrowserRouter>
    </UserProvider>
  );
}

export default App;