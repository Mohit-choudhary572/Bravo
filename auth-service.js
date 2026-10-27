/**
 * AFOS - Adaptive Farm Operations System
 * Authentication Service Module
 * 
 * Supports Firebase Authentication (Email/Password & Google Sign-In)
 * with a resilient Local Sandbox / Guest mode for offline or unconfigured states.
 */

class AuthService {
  constructor() {
    this.auth = window.firebase ? firebase.auth() : null;
    this.currentUser = null;
    this.listeners = [];
    this.guestStorageKey = 'afos_guest_user_session';

    this.init();
  }

  init() {
    if (this.auth) {
      this.auth.onAuthStateChanged((user) => {
        if (user) {
          this.currentUser = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            photoURL: user.photoURL,
            isAnonymous: user.isAnonymous
          };
          this.clearGuestSession();
        } else {
          // Check for active guest session
          this.currentUser = this.getGuestSession();
        }
        this.notifyListeners(this.currentUser);
      });
    } else {
      // Local mode fallback
      this.currentUser = this.getGuestSession();
      this.notifyListeners(this.currentUser);
    }
  }

  /**
   * Subscribe to authentication state changes.
   * @param {Function} callback 
   */
  onAuthStateChanged(callback) {
    if (typeof callback === 'function') {
      this.listeners.push(callback);
      // Immediately invoke with current state
      callback(this.currentUser);
    }
  }

  notifyListeners(user) {
    this.listeners.forEach((cb) => {
      try {
        cb(user);
      } catch (e) {
        console.error('[AFOS Auth] Listener error:', e);
      }
    });
  }

  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Sign in with Email and Password.
   */
  async signIn(email, password) {
    if (!email || !password) {
      throw new Error('Please enter both email and password.');
    }

    if (this.auth) {
      try {
        const credential = await this.auth.signInWithEmailAndPassword(email, password);
        return credential.user;
      } catch (err) {
        throw new Error(this.formatAuthError(err));
      }
    } else {
      // Fallback local auth simulation
      const user = {
        uid: 'local-user-' + btoa(email).slice(0, 8),
        email,
        displayName: email.split('@')[0],
        photoURL: null,
        isGuest: false
      };
      this.saveGuestSession(user);
      this.currentUser = user;
      this.notifyListeners(user);
      return user;
    }
  }

  /**
   * Register a new farmer account with Email, Password & Name.
   */
  async register(email, password, displayName) {
    if (!email || !password) {
      throw new Error('Email and password are required.');
    }
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    if (this.auth) {
      try {
        const credential = await this.auth.createUserWithEmailAndPassword(email, password);
        if (displayName && credential.user) {
          await credential.user.updateProfile({ displayName });
        }
        return credential.user;
      } catch (err) {
        throw new Error(this.formatAuthError(err));
      }
    } else {
      const user = {
        uid: 'local-user-' + Date.now(),
        email,
        displayName: displayName || email.split('@')[0],
        photoURL: null,
        isGuest: false
      };
      this.saveGuestSession(user);
      this.currentUser = user;
      this.notifyListeners(user);
      return user;
    }
  }

  /**
   * Google One-Click Sign In via popup.
   */
  async signInWithGoogle() {
    if (!this.auth) {
      return this.continueAsGuest('Google Demo Farmer');
    }

    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      const result = await this.auth.signInWithPopup(provider);
      return result.user;
    } catch (err) {
      throw new Error(this.formatAuthError(err));
    }
  }

  /**
   * Demo / Guest access for farmers exploring without registration.
   */
  continueAsGuest(name = 'Guest Farmer') {
    const guestUser = {
      uid: 'guest-' + Math.random().toString(36).substr(2, 9),
      email: 'farmer@afos-demo.internal',
      displayName: name,
      photoURL: null,
      isGuest: true
    };
    this.saveGuestSession(guestUser);
    this.currentUser = guestUser;
    this.notifyListeners(guestUser);
    return guestUser;
  }

  /**
   * Sign out current user.
   */
  async signOut() {
    if (this.auth) {
      await this.auth.signOut();
    }
    this.clearGuestSession();
    this.currentUser = null;
    this.notifyListeners(null);
  }

  // --- Guest Session Storage Helpers ---
  getGuestSession() {
    try {
      const raw = localStorage.getItem(this.guestStorageKey);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  saveGuestSession(user) {
    try {
      localStorage.setItem(this.guestStorageKey, JSON.stringify(user));
    } catch (_) {}
  }

  clearGuestSession() {
    try {
      localStorage.removeItem(this.guestStorageKey);
    } catch (_) {}
  }

  formatAuthError(err) {
    if (!err) return 'Authentication failed.';
    switch (err.code) {
      case 'auth/user-not-found':
        return 'No farmer account found with this email.';
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Incorrect password or email credentials.';
      case 'auth/email-already-in-use':
        return 'This email is already registered. Please sign in instead.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/weak-password':
        return 'Password is too weak. Please use at least 6 characters.';
      case 'auth/popup-closed-by-user':
        return 'Google sign-in popup was closed before completion.';
      case 'auth/popup-blocked':
        return 'Sign-in popup was blocked by your browser. Please allow popups for this site.';
      default:
        return err.message || 'Authentication error occurred.';
    }
  }
}

// Global auth service instance
window.authService = new AuthService();
