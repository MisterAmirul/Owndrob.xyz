import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { UserProvider } from './UserContext';
import UserHeader from './components/UserHeader';
import OathSignup from './pages/oath';
import Dashboard from './pages/dashboard';
import Craft from './pages/craft';
import Preview from './pages/preview';
import LiveQuery from './pages/livequery';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Signup page WITHOUT user context or header */}
        <Route
          path="/"
          element={<OathSignup />}
        />
        {/* Signin page WITHOUT user context or header */}
        <Route
          path="/signin"
          element={<OathSignup />}
        />
        {/* Dashboard WITH user context and header */}
        <Route
          path="/dashboard"
          element={
            <UserProvider>
              <UserHeader />
              <Dashboard />
            </UserProvider>
          }
        />
        {/* Craft WITH user context and header */}
        <Route
          path="/craft"
          element={
            <UserProvider>
              <UserHeader />
              <Craft />
            </UserProvider>
          }
        />
        <Route
          path="/livequery"
          element={
            <UserProvider>
              <UserHeader />
              <LiveQuery />
            </UserProvider>
          }
        />
        {/* Preview WITHOUT user context or header */}
        <Route path="/preview" element={<Preview />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;