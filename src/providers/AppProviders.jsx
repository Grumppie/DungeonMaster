import { ClerkProvider, useAuth } from "@clerk/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim?.() ?? "";
const convexUrl = import.meta.env.VITE_CONVEX_URL?.trim?.() ?? "";
const clerkJwtTemplate = import.meta.env.VITE_CLERK_JWT_TEMPLATE?.trim() || "convex";
const clerkIssuerDomain = import.meta.env.VITE_CLERK_ISSUER_OVERRIDE?.trim?.()
  || import.meta.env.VITE_CLERK_JWT_ISSUER_DOMAIN?.trim?.()
  || "";

const convexClient = convexUrl ? new ConvexReactClient(convexUrl) : null;
const AuthDebugContext = createContext(null);

function decodeJwtPayload(token) {
  if (!token) {
    return null;
  }

  try {
    const [, payload] = token.split(".");
    if (!payload) {
      return null;
    }
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(window.atob(padded));
  } catch {
    return null;
  }
}

export function useAuthDebug() {
  return useContext(AuthDebugContext);
}

function ConvexAuthBridge({ children }) {
  const { isLoaded, isSignedIn, getToken, orgId, orgRole, sessionClaims } = useAuth();
  const [isConvexAuthenticated, setIsConvexAuthenticated] = useState(null);
  const [debugState, setDebugState] = useState({
    tokenSource: "unknown",
    expectedIssuer: clerkIssuerDomain,
    sessionAud: null,
    tokenIss: null,
    tokenAud: null,
    tokenAzp: null,
    authError: null,
  });

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }) => {
      try {
        const useSessionToken = sessionClaims?.aud === "convex";
        const token = useSessionToken
          ? await getToken({
              skipCache: forceRefreshToken,
            })
          : await getToken({
              template: clerkJwtTemplate,
              skipCache: forceRefreshToken,
            });
        const decoded = decodeJwtPayload(token);
        setDebugState({
          tokenSource: useSessionToken ? "session" : `template:${clerkJwtTemplate}`,
          expectedIssuer: clerkIssuerDomain,
          sessionAud: sessionClaims?.aud ?? null,
          tokenIss: decoded?.iss ?? null,
          tokenAud: decoded?.aud ?? null,
          tokenAzp: decoded?.azp ?? null,
          authError: null,
        });

        return token;
      } catch (error) {
        console.error("[Auth] Failed to get Clerk token for Convex.", {
          template: clerkJwtTemplate,
          audience: sessionClaims?.aud,
          error,
        });
        setDebugState((current) => ({
          ...current,
          expectedIssuer: clerkIssuerDomain,
          sessionAud: sessionClaims?.aud ?? null,
          authError: String(error),
        }));
        return null;
      }
    },
    [getToken, orgId, orgRole, sessionClaims?.aud],
  );

  useEffect(() => {
    if (!convexClient) {
      return;
    }

    if (!isLoaded || !isSignedIn) {
      convexClient.clearAuth();
      setIsConvexAuthenticated(false);
      setDebugState((current) => ({
        ...current,
        tokenSource: "signed-out",
        authError: null,
      }));
      return;
    }

    convexClient.setAuth(fetchAccessToken, (backendReportsIsAuthenticated) => {
      setIsConvexAuthenticated(backendReportsIsAuthenticated);
    });

    return () => {
      convexClient.clearAuth();
      setIsConvexAuthenticated(null);
    };
  }, [fetchAccessToken, isLoaded, isSignedIn]);

  const value = useMemo(
    () => ({
      isLoading: !isLoaded || isConvexAuthenticated === null,
      isAuthenticated: Boolean(isSignedIn && isConvexAuthenticated),
      fetchAccessToken,
    }),
    [fetchAccessToken, isConvexAuthenticated, isLoaded, isSignedIn],
  );

  return (
    <AuthDebugContext.Provider value={debugState}>
      <ConvexProviderWithAuth client={convexClient} useAuth={() => value}>
        {children}
      </ConvexProviderWithAuth>
    </AuthDebugContext.Provider>
  );
}

export function AppProviders({ children }) {
  if (!clerkPublishableKey) {
    return <AuthDebugContext.Provider value={null}>{children}</AuthDebugContext.Provider>;
  }

  return (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      {convexClient ? (
        <ConvexAuthBridge>
          {children}
        </ConvexAuthBridge>
      ) : (
        children
      )}
    </ClerkProvider>
  );
}
