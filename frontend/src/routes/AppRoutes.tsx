import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { TournamentsPage } from '../pages/TournamentsPage';
import { AddTournamentPage } from '../pages/AddTournamentPage';
import { EditTournamentPage } from '../pages/EditTournamentPage';
import { AdminUsersPage } from '../pages/AdminUsersPage';
import { useAuth } from '../context/AuthContext';

const PrivateRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const AdminRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'admin') {
    return <Navigate to="/tournaments" replace />;
  }

  return children;
};

export const AppRoutes: React.FC = () => {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/tournaments" replace /> : <LoginPage />}
      />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/tournaments"
        element={
          <PrivateRoute>
            <TournamentsPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/tournaments/new"
        element={
          <AdminRoute>
            <AddTournamentPage />
          </AdminRoute>
        }
      />
      <Route
        path="/tournaments/:id/edit"
        element={
          <AdminRoute>
            <EditTournamentPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <AdminRoute>
            <AdminUsersPage />
          </AdminRoute>
        }
      />
      <Route path="*" element={<Navigate to="/tournaments" replace />} />
    </Routes>
  );
};

