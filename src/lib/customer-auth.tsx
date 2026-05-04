import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Customer = {
  id: string;
  storeId: number;
  name: string;
  email: string;
  phone: string | null;
  provider: "email" | "google";
  googleId: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
};

type LoginInput = {
  email: string;
  password: string;
};

type RegisterInput = {
  name: string;
  email: string;
  phone: string;
  password: string;
};

type CustomerAuthContextValue = {
  customer: Customer | null;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<Customer>;
  register: (input: RegisterInput) => Promise<Customer>;
  googleLogin: (credential: string) => Promise<Customer>;
  logout: () => Promise<void>;
  refreshCustomer: () => Promise<Customer | null>;
};

const CustomerAuthContext = createContext<CustomerAuthContextValue | null>(null);

async function readApiError(response: Response) {
  try {
    const data = await response.json();
    return typeof data?.error === "string" ? data.error : "Ocurrio un error. Proba de nuevo.";
  } catch {
    return "Ocurrio un error. Proba de nuevo.";
  }
}

async function authRequest(path: string, body?: unknown) {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  if (!response.ok) throw new Error(await readApiError(response));
  return response.json() as Promise<{ customer: Customer | null }>;
}

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshCustomer = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await authRequest("/api/store/auth/me");
      setCustomer(data.customer);
      return data.customer;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCustomer().catch(() => {
      setCustomer(null);
      setIsLoading(false);
    });
  }, [refreshCustomer]);

  const login = useCallback(async (input: LoginInput) => {
    const data = await authRequest("/api/store/auth/login", input);
    if (!data.customer) throw new Error("No pudimos iniciar sesion.");
    setCustomer(data.customer);
    return data.customer;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const data = await authRequest("/api/store/auth/register", input);
    if (!data.customer) throw new Error("No pudimos crear la cuenta.");
    setCustomer(data.customer);
    return data.customer;
  }, []);

  const googleLogin = useCallback(async (credential: string) => {
    const data = await authRequest("/api/store/auth/google", { credential });
    if (!data.customer) throw new Error("No pudimos iniciar sesion con Google.");
    setCustomer(data.customer);
    return data.customer;
  }, []);

  const logout = useCallback(async () => {
    await authRequest("/api/store/auth/logout", {});
    setCustomer(null);
  }, []);

  const value = useMemo(
    () => ({ customer, isLoading, login, register, googleLogin, logout, refreshCustomer }),
    [customer, googleLogin, isLoading, login, logout, refreshCustomer, register],
  );

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
}

export function useCustomerAuth() {
  const value = useContext(CustomerAuthContext);
  if (!value) throw new Error("useCustomerAuth must be used inside CustomerAuthProvider");
  return value;
}
