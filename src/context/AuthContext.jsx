import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import { getDocument, getCollection, updateDocument } from '../firebase/db';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser]     = useState(null);
  const [role, setRole]                   = useState(null);
  const [userName, setUserName]           = useState('');
  const [gymId, setGymId]                 = useState(null);
  const [activeGymId, setActiveGymId]     = useState(null);
  const [gymData, setGymData]             = useState(null);
  const [gymIds, setGymIds]               = useState([]);
  const [gymBranches, setGymBranches]     = useState([]);
  const [isSuperAdmin, setIsSuperAdmin]   = useState(false);
  const [loading, setLoading]             = useState(true);
  const [inactiveGymError, setInactiveGymError] = useState(false);
  const [gymBlockReason, setGymBlockReason] = useState(null);
  const [impersonatedGymId, setImpersonatedGymId]         = useState(null);
  const [impersonatedGymData, setImpersonatedGymData]     = useState(null);
  const [impersonatedBranches, setImpersonatedBranches]   = useState([]);

  const enterGym = (gym) => {
    setImpersonatedGymId(gym.id);
    setImpersonatedGymData(gym);
    setImpersonatedBranches([gym]);
    // Async: load all branches belonging to this gym's owner
    if (gym.ownerEmail) {
      getCollection('users', [{ field: 'email', op: '==', value: gym.ownerEmail }])
        .then(async (ownerUsers) => {
          if (!ownerUsers.length) return;
          const ownerUser = ownerUsers[0];
          const allGymIds = (ownerUser.gymIds?.length > 0)
            ? ownerUser.gymIds
            : (ownerUser.gymId ? [ownerUser.gymId] : []);
          if (allGymIds.length <= 1) return;
          const branchDocs = await Promise.all(allGymIds.map(id => getDocument('gyms', id)));
          const branches = allGymIds.map((id, i) => {
            const doc = branchDocs[i];
            return doc ? { id, ...doc } : null;
          }).filter(Boolean);
          if (branches.length > 1) setImpersonatedBranches(branches);
        })
        .catch(() => {});
    }
  };

  const exitGym = () => {
    setImpersonatedGymId(null);
    setImpersonatedGymData(null);
    setImpersonatedBranches([]);
  };

  const switchImpersonatedBranch = (newGymId) => {
    const branch = impersonatedBranches.find(b => b.id === newGymId);
    if (branch) {
      setImpersonatedGymId(branch.id);
      setImpersonatedGymData(branch);
    }
  };

  const updateGymData = (partial) => {
    if (impersonatedGymId) {
      setImpersonatedGymData(prev => ({ ...prev, ...partial }));
    } else {
      setGymData(prev => ({ ...prev, ...partial }));
    }
  };

  // Switches the active branch and reloads the page so all data re-fetches cleanly.
  const switchBranch = (newGymId) => {
    if (!gymIds.includes(newGymId)) return;
    if (newGymId === activeGymId) return;
    if (currentUser) {
      localStorage.setItem(`activeBranch_${currentUser.uid}`, newGymId);
    }
    window.location.href = '/';
  };

  // Called after a new branch is created in Settings to update context without reload.
  const addBranch = (newGymId, newGymName) => {
    setGymIds(prev => [...prev, newGymId]);
    setGymBranches(prev => [...prev, { id: newGymId, name: newGymName }]);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userDoc = await getDocument('users', user.uid);
          if (!userDoc || userDoc.role === 'deleted') {
            setInactiveGymError(true);
            await signOut(auth);
            return;
          }
          const userRole = userDoc.role || 'admin';

          if (userRole === 'superadmin') {
            setRole('superadmin');
            setIsSuperAdmin(true);
            setGymId(null);
            setActiveGymId(null);
            setGymIds([]);
            setGymBranches([]);
            setGymData(null);
            setUserName(userDoc?.name || 'Super Admin');
          } else {
            const primaryGymId = userDoc?.gymId || null;
            // gymIds array: use stored array or fall back to single primary gym.
            // This means existing gyms automatically work as a single branch.
            const allGymIds = (userDoc?.gymIds && userDoc.gymIds.length > 0)
              ? userDoc.gymIds
              : (primaryGymId ? [primaryGymId] : []);

            setGymId(primaryGymId);
            setGymIds(allGymIds);

            // Restore last-used branch from localStorage
            const saved = localStorage.getItem(`activeBranch_${user.uid}`);
            const resolvedActiveId = (saved && allGymIds.includes(saved))
              ? saved
              : (allGymIds[0] || null);

            setActiveGymId(resolvedActiveId);

            if (allGymIds.length > 0) {
              // Fetch all branch gym docs in parallel (1 read for single-branch, N for multi)
              const branchDocs = await Promise.all(allGymIds.map(id => getDocument('gyms', id)));

              const branches = branchDocs.map((g, i) => ({
                id: allGymIds[i],
                name: g?.name || `Branch ${i + 1}`,
              }));
              setGymBranches(branches);

              // Set gymData for the active branch
              const activeIdx = allGymIds.indexOf(resolvedActiveId);
              const activeGym = activeIdx >= 0 ? branchDocs[activeIdx] : branchDocs[0];

              if (!activeGym || activeGym.isActive === false) {
                setGymBlockReason('inactive');
                setInactiveGymError(true);
                await signOut(auth);
                return;
              }

              // Enforce plan access dates
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              if (activeGym.planStartDate) {
                const start = new Date(activeGym.planStartDate);
                start.setHours(0, 0, 0, 0);
                if (today < start) {
                  setGymBlockReason('plan_not_started');
                  setInactiveGymError(true);
                  await signOut(auth);
                  return;
                }
              }
              if (activeGym.planEndDate) {
                const end = new Date(activeGym.planEndDate);
                end.setHours(23, 59, 59, 999);
                if (today > end) {
                  setGymBlockReason('plan_expired');
                  setInactiveGymError(true);
                  await signOut(auth);
                  return;
                }
              }

              setGymData(activeGym);
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
        setActiveGymId(null);
        setGymIds([]);
        setGymBranches([]);
        setGymData(null);
        setIsSuperAdmin(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = (email, password) => {
    setInactiveGymError(false);
    setGymBlockReason(null);
    return signInWithEmailAndPassword(auth, email, password);
  };

  const logout = () => signOut(auth);

  const isImpersonating = !!impersonatedGymId;

  return (
    <AuthContext.Provider value={{
      currentUser, role, userName,
      gymId: impersonatedGymId ?? activeGymId,
      gymData: impersonatedGymData ?? gymData,
      gymIds,
      gymBranches,
      isSuperAdmin,
      inactiveGymError,
      gymBlockReason,
      isImpersonating,
      impersonatedBranches,
      enterGym, exitGym, updateGymData,
      switchBranch, addBranch, switchImpersonatedBranch,
      login, logout,
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
