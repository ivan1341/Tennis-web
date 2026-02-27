import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  createAdminUser,
  getAdminUsers,
  resetUserPassword,
  updateAdminUser,
  type AdminUser
} from '../services/adminUserService';

export const AdminUsersPage: React.FC = () => {
  const { user, token, logout } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
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

  const handleCreateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!token) {
      setError('Sesión inválida. Inicia sesión nuevamente.');
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
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingUserId(null);
    setEditPassword('');
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

      setSuccess('Usuario actualizado correctamente');
      closeModal();
      await loadUsers();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-left">
          <h1>Administrar usuarios</h1>
        </div>
        <div className="app-header-right">
          {user && (
            <>
              <span className="user-label">
                {user.name} ({user.role === 'admin' ? 'Admin' : 'Usuario'})
              </span>
              <button className="secondary-btn" onClick={logout}>
                Cerrar sesión
              </button>
            </>
          )}
        </div>
      </header>

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
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
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
                  onChange={(e) => setEditPhone(e.target.value)}
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

