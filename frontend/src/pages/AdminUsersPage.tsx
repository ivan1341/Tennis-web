import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  assignUserToTournaments,
  createAdminUser,
  getAdminUsers,
  resetUserPassword,
  updateAdminUser,
  type AdminUser
} from '../services/adminUserService';
import { getTournaments, type Tournament } from '../services/tournamentService';
import { AppHeader } from '../components/AppHeader';

export const AdminUsersPage: React.FC = () => {
  const { token } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'user'>('user');
  const [editPassword, setEditPassword] = useState('');
  const [assignTournamentIds, setAssignTournamentIds] = useState<number[]>([]);
  const [assignGroupNumber, setAssignGroupNumber] = useState(1);

  const sanitizePhone = (value: string): string => value.replace(/\D/g, '').slice(0, 10);
  const isValidPhone = (value: string): boolean => /^\d{1,10}$/.test(value);

  const loadUsers = async () => {
    if (!token) {
      setError('Sesión inválida. Inicia sesión nuevamente.');
      return;
    }

    setLoadingUsers(true);
    try {
      const list = await getAdminUsers(token);
      setUsers(list);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const loadTournaments = async () => {
      try {
        const list = await getTournaments();
        setTournaments(list);
      } catch {
        // ignore tournaments errors here; main feedback goes in save action
      }
    };
    void loadTournaments();
  }, []);

  const handleCreateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!token) {
      setError('Sesión inválida. Inicia sesión nuevamente.');
      return;
    }
    if (!isValidPhone(phone)) {
      setError('El teléfono debe contener solo números y máximo 10 dígitos.');
      return;
    }

    try {
      await createAdminUser({ name, phone, password, role }, token);
      setName('');
      setPhone('');
      setPassword('');
      setRole('user');
      setSuccess('Usuario creado correctamente');
      await loadUsers();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const openEditModal = (selectedUser: AdminUser) => {
    setEditingUserId(selectedUser.id);
    setEditName(selectedUser.name);
    setEditPhone(selectedUser.phone);
    setEditRole(selectedUser.role);
    setEditPassword('');
    setAssignTournamentIds([]);
    setAssignGroupNumber(1);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingUserId(null);
    setEditPassword('');
    setAssignTournamentIds([]);
    setAssignGroupNumber(1);
  };

  const handleSaveUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!token) {
      setError('Sesión inválida. Inicia sesión nuevamente.');
      return;
    }

    if (!editingUserId) {
      setError('Usuario inválido');
      return;
    }
    if (!isValidPhone(editPhone)) {
      setError('El teléfono debe contener solo números y máximo 10 dígitos.');
      return;
    }

    try {
      await updateAdminUser(
        {
          id: editingUserId,
          name: editName,
          phone: editPhone,
          role: editRole
        },
        token
      );

      if (editPassword.trim() !== '') {
        await resetUserPassword(editingUserId, editPassword, token);
      }

      if (assignTournamentIds.length > 0) {
        await assignUserToTournaments(editingUserId, assignTournamentIds, assignGroupNumber, token);
      }

      setSuccess('Usuario actualizado correctamente');
      closeModal();
      await loadUsers();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="app-shell">
      <AppHeader title="Administrar usuarios" />

      <main className="app-main admin-users-layout">
        <section className="card">
          <h2>Crear usuario</h2>
          <form onSubmit={handleCreateUser}>
            <label>
              Nombre completo
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label>
              Teléfono
              <input
                type="tel"
                value={phone}
                inputMode="numeric"
                maxLength={10}
                onChange={(e) => setPhone(sanitizePhone(e.target.value))}
                required
              />
            </label>
            <label>
              Contraseña
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <label>
              Rol
              <select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'user')}>
                <option value="user">Usuario</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <button type="submit" className="primary-btn">
              Crear usuario
            </button>
          </form>
        </section>

        <section className="card admin-users-table-card">
          <h2>Listado de usuarios</h2>
          {loadingUsers ? (
            <p>Cargando usuarios...</p>
          ) : (
            <div className="admin-users-table-wrapper">
              <table className="admin-users-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Teléfono</th>
                    <th>Rol</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{item.name}</td>
                      <td>{item.phone}</td>
                      <td>{item.role}</td>
                      <td>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => openEditModal(item)}
                          aria-label={`Editar usuario ${item.name}`}
                          title="Editar usuario"
                        >
                          ✏
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="muted">
            <Link to="/tournaments">Volver a torneos</Link>
          </p>
        </section>

        {error && <p className="error-text">{error}</p>}
        {success && <p className="success-text">{success}</p>}
      </main>

      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-card card" onClick={(e) => e.stopPropagation()}>
            <h2>Editar usuario</h2>
            <form onSubmit={handleSaveUser}>
              <label>
                Nombre completo
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </label>

              <label>
                Teléfono
                <input
                  type="tel"
                  value={editPhone}
                  inputMode="numeric"
                  maxLength={10}
                  onChange={(e) => setEditPhone(sanitizePhone(e.target.value))}
                  required
                />
              </label>

              <label>
                Rol
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as 'admin' | 'user')}
                  required
                >
                  <option value="user">Usuario</option>
                  <option value="admin">Admin</option>
                </select>
              </label>

              <label>
                Nueva contraseña (opcional)
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Solo si deseas resetearla"
                />
              </label>

              <label>
                Torneos a asignar (opcional)
                <select
                  multiple
                  value={assignTournamentIds.map(String)}
                  onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions).map((opt) => Number(opt.value));
                    setAssignTournamentIds(values);
                  }}
                >
                  {tournaments.map((tournament) => (
                    <option key={tournament.id} value={tournament.id}>
                      {tournament.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Grupo para asignación
                <input
                  type="number"
                  min={1}
                  value={assignGroupNumber}
                  onChange={(e) => setAssignGroupNumber(Number(e.target.value))}
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={closeModal}>
                  Cancelar
                </button>
                <button type="submit" className="primary-btn">
                  Guardar cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

