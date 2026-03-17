'use client';

import { useMemo } from 'react';
import { useFirebase, useAuthUser } from '@/firebase/provider';
import { doc } from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useMemoFirebase } from '@/firebase/hooks/use-memo-firebase';

export function useUser() {
  const { user, isUserLoading, userError } = useAuthUser();
  const { firestore } = useFirebase();

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const { data: profile, isLoading: isProfileLoading, error: profileError } = useDoc(userDocRef);

  const mergedUser = useMemo(() => {
    if (!user) return null;
    return {
      ...user,
      profile: profile || null,
    };
  }, [user, profile]);

  return {
    user: mergedUser,
    isUserLoading: isUserLoading || isProfileLoading,
    userError: userError || profileError,
  };
}
