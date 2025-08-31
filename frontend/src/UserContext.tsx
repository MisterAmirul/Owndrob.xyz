import React, { createContext, useContext, useState, useEffect } from "react";

type UserObject = {
  public_key?: string;
  [key: string]: any;
};

type UserType = {
  user: UserObject | null;
  login: (userData: UserObject) => void;
  logout: () => void;
};

const defaultContext: UserType = {
  user: null,
  login: () => {},
  logout: () => {},
};

const UserContext = createContext<UserType>(defaultContext);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserObject | null>(null);

  // Fetch user info from backend using session cookie
  useEffect(() => {
    async function fetchUser() {
      const res = await fetch('http://localhost:3001/api/session-user', {
        credentials: 'include', // send cookies
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
      }
    }
    fetchUser();
  }, []);

  const login = (userData: UserObject) => setUser(userData);
  const logout = () => {
    setUser(null);
    // Optionally, call backend to clear session cookie
    fetch('http://localhost:3001/api/logout', { method: 'POST', credentials: 'include' });
  };

  return (
    <UserContext.Provider value={{ user, login, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}