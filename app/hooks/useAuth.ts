import { useEffect, useState } from "react";
import { apiUrl } from "~/utils/api";
import { authClient } from "~/lib/auth.client";
import { useNavigate } from "react-router";
import { normalizeAuthUser } from "~/schemas/auth";

interface AuthUser {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
}

interface AuthResponse {
  user?: {
    id?: string;
    userId?: string;
    email?: string;
    name?: string;
    image?: string;
    avatarUrl?: string;
  };
  data?: {
    user?: {
      id?: string;
      userId?: string;
      email?: string;
      name?: string;
      image?: string;
      avatarUrl?: string;
    };
  };
  session?: {
    user?: {
      id?: string;
      userId?: string;
      email?: string;
      name?: string;
      image?: string;
      avatarUrl?: string;
    };
    userId?: string;
  };
}

interface UseAuthResult {
  user: AuthUser | null;
  isLoading: boolean;
  isSigningIn: boolean;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  // Always return a logged-in user
  const [user, setUser] = useState<AuthUser | null>({
    id: "guest-user-id",
    email: "guest@example.com",
    name: "Guest User",
    image: null,
  });

  // No loading, sign-in is instant
  const [isLoading, setIsLoading] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const navigate = useNavigate();

  // Mock signIn - does nothing but maybe log
  const onSignIn = async () => {
    console.log("🔐 Mock sign-in: Already logged in as Guest");
  };

  const onSignOut = async () => {
    console.log("🚪 Mock sign-out: Signing out disabled in bypass mode");
  };

  return { user, isLoading, isSigningIn, onSignIn, onSignOut };
}
