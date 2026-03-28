import { useEffect, useState } from "react";

const SESSION_PAGES = ["runtime", "rules"];

export function useJoinCodeState() {
  const [joinCode, setJoinCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get("join") || "").trim().toUpperCase();
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    if (joinCode) {
      url.searchParams.set("join", joinCode);
    } else {
      url.searchParams.delete("join");
    }
    window.history.replaceState({}, "", url);
  }, [joinCode]);

  return [joinCode, setJoinCode];
}

export function useSessionPageState() {
  const [page, setPage] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = (params.get("page") || "").trim().toLowerCase();
    return SESSION_PAGES.includes(requested) ? requested : "runtime";
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    if (page && page !== "runtime") {
      url.searchParams.set("page", page);
    } else {
      url.searchParams.delete("page");
    }
    window.history.replaceState({}, "", url);
  }, [page]);

  return [page, setPage];
}
