import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import { getDocument } from '../firebase/db';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [role, setRole] = useState(null);
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userDoc = await getDocument('users', user.uid);
          setRole(userDoc?.role || 'admin');
          setUserName(userDoc?.name || user.displayName || user.email?.split('@')[0] || '');
        } catch {
          setRole('admin');
          setUserName(user.displayName || user.email?.split('@')[0] || '');
        }
      } else {
        setRole(null);
        setUserName('');
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ currentUser, role, userName, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
