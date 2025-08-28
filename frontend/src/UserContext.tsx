import React, { createContext, useContext, useState, useEffect } from "react";

type UserType = {
  user: any;
  login: (userData: any) => void;
  logout: () => void;
};

const defaultContext: UserType = {
  user: null,
  login: () => {},
  logout: () => {},
};

const UserContext = createContext<UserType>(defaultContext);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem("userSession");
    if (stored) setUser(JSON.parse(stored));
  }, []);

  useEffect(() => {
    if (user) localStorage.setItem("userSession", JSON.stringify(user));
    else localStorage.removeItem("userSession");
  }, [user]);

  const login = (userData: any) => setUser(userData);
  const logout = () => setUser(null);

  return (
    <UserContext.Provider value={{ user, login, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}