import { createContext, PropsWithChildren, useContext, useState } from "react";

import * as api from "./api";
import { AuthPayload, UserProfile } from "./types";

interface SessionContextValue {
  token: string | null;
  user: UserProfile | null;
  login: (email: string, password: string) => Promise<void>;
  authenticate: (auth: AuthPayload) => void;
  updateUser: (patch: Partial<UserProfile>) => void;
  logout: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);

  async function handleLogin(email: string, password: string) {
    const auth = await api.login(email, password);
    handleAuthenticate(auth);
  }

  function handleAuthenticate(auth: AuthPayload) {
    setToken(auth.access_token);
    setUser(auth.user);
  }

  function updateUser(patch: Partial<UserProfile>) {
    setUser((current) => (current ? { ...current, ...patch } : current));
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return (
    <SessionContext.Provider
      value={{
        token,
        user,
        login: handleLogin,
        authenticate: handleAuthenticate,
        updateUser,
        logout
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession debe usarse dentro de SessionProvider");
  }
  return context;
}
