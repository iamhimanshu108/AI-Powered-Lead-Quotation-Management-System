import { createContext, useContext, useMemo, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() =>
    JSON.parse(localStorage.getItem("lead-quotation-user") || "null"),
  );
  const [token, setToken] = useState(
    () => localStorage.getItem("lead-quotation-token") || "",
  );

  const login = ({ userData, accessToken }) => {
    setUser(userData);
    setToken(accessToken);
    localStorage.setItem("lead-quotation-user", JSON.stringify(userData));
    localStorage.setItem("lead-quotation-token", accessToken);
  };

  const logout = () => {
    setUser(null);
    setToken("");
    localStorage.removeItem("lead-quotation-user");
    localStorage.removeItem("lead-quotation-token");
  };

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user && token),
      login,
      logout,
    }),
    [user, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }

  return context;
}
