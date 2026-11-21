// Cookie helper utilities for browser & mobile cookie management

export function setCookie(name: string, value: string, days?: number): void {
  let expires = '';
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    expires = '; expires=' + date.toUTCString();
  }
  const isSecure = window.location.protocol === 'https:' ? '; Secure' : '';
  const encodedValue = encodeURIComponent(value);
  document.cookie = `${name}=${encodedValue}${expires}; path=/; SameSite=Lax${isSecure}`;
}

export function getCookie(name: string): string | null {
  const nameEQ = name + '=';
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) {
      const raw = c.substring(nameEQ.length, c.length);
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }
  return null;
}

export function removeCookie(name: string): void {
  const isSecure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${isSecure}`;
}

export function clearAllCookies(): void {
  // Clear all cookies found in document.cookie
  const cookies = document.cookie.split(';');
  const isSecure = window.location.protocol === 'https:' ? '; Secure' : '';
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i];
    const eqPos = cookie.indexOf('=');
    const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
    if (name) {
      document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${isSecure}`;
    }
  }

  // Also clear known cookie names specifically to be 100% sure across paths/domains
  const knownKeys = ['menoufia_user', 'menoufia_remembered_code', 'menoufia_session'];
  knownKeys.forEach((key) => {
    document.cookie = `${key}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${isSecure}`;
  });

  // Also clear localStorage & sessionStorage
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    // ignore storage errors
  }
}
