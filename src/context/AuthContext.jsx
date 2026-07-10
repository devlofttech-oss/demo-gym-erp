import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import { getDocument } from '../firebase/db';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser]     = useState(null);
  const [role, setRole]                   = useState(null);
  const [userName, setUserName]           = useState('');
  const [gymId, setGymId]                 = useState(null);
  const [gymData, setGymData]             = useState(null);
  const [isSuperAdmin, setIsSuperAdmin]   = useState(false);
  const [loading, setLoading]             = useState(true);
  const [inactiveGymError, setInactiveGymError] = useState(false);
  const [impersonatedGymId, setImpersonatedGymId]     = useState(null);
  const [impersonatedGymData, setImpersonatedGymData] = useState(null);

  const enterGym = (gym) => {
    setImpersonatedGymId(gym.id);
    setImpersonatedGymData(gym);
  };

  const exitGym = () => {
    setImpersonatedGymId(null);
    setImpersonatedGymData(null);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userDoc = await getDocument('users', user.uid);
          const userRole = userDoc?.role || 'admin';

          if (userRole === 'superadmin') {
            setRole('superadmin');
            setIsSuperAdmin(true);
            setGymId(null);
            setGymData(null);
            setUserName(userDoc?.name || 'Super Admin');
          } else {
            const gId = userDoc?.gymId || null;
            setGymId(gId);

            if (gId) {
              const gym = await getDocument('gyms', gId);
              if (!gym || gym.isActive === false) {
                setInactiveGymError(true);
                await signOut(auth);
                return;
              }
              setGymData(gym);
              setInactiveGymError(false);
            }

            setRole(userRole);
            setUserName(userDoc?.name || user.displayName || user.email?.split('@')[0] || '');
            setIsSuperAdmin(false);
          }
        } catch {
          setRole('admin');
          setUserName(user.displayName || user.email?.split('@')[0] || '');
        }
      } else {
        setRole(null);
        setUserName('');
        setGymId(null);
        setGymData(null);
        setIsSuperAdmin(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = (email, password) => {
    setInactiveGymError(false);
    return signInWithEmailAndPassword(auth, email, password);
  };

  const logout = () => signOut(auth);

  const isImpersonating = !!impersonatedGymId;

  return (
    <AuthContext.Provider value={{
      currentUser, role, userName,
      gymId: impersonatedGymId ?? gymId,
      gymData: impersonatedGymData ?? gymData,
      isSuperAdmin,
      inactiveGymError,
      isImpersonating,
      enterGym, exitGym,
      login, logout,
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
