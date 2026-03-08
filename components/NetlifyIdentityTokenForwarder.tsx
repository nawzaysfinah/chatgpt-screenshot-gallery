"use client";

import { useEffect } from "react";

const TOKEN_KEYS = [
  "invite_token",
  "confirmation_token",
  "recovery_token",
  "email_change_token",
] as const;

function hasAnyToken(search: URLSearchParams): boolean {
  return TOKEN_KEYS.some((key) => Boolean(search.get(key)));
}

export default function NetlifyIdentityTokenForwarder() {
  useEffect(() => {
    const currentPath = window.location.pathname;
    if (currentPath.startsWith("/admin")) {
      return;
    }

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const queryParams = new URLSearchParams(window.location.search);

    if (!hasAnyToken(hashParams) && !hasAnyToken(queryParams)) {
      return;
    }

    // Netlify invite/confirmation links can land outside /admin.
    // Redirect to /admin while preserving token params.
    const suffix = `${window.location.search}${window.location.hash}`;
    window.location.replace(`/admin/${suffix}`);
  }, []);

  return null;
}
