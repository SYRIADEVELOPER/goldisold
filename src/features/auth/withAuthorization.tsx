import React from 'react';
import { useAuthStore } from './store';
import { Navigate } from 'react-router-dom';

type Role = 'user' | 'moderator' | 'admin';

export const withAuthorization = (Component: React.ComponentType, allowedRoles: Role[]) => {
  return (props: any) => {
    const { user, role, isLoading } = useAuthStore();

    if (isLoading) {
      return <div>Loading...</div>; // Or a spinner component
    }

    if (!user || !role || !allowedRoles.includes(role)) {
      return <Navigate to="/" replace />;
    }

    return <Component {...props} />;
  };
};
