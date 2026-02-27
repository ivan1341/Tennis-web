import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getTournamentById, type Tournament } from '../services/tournamentService';

interface GroupData {
  name: string;
  players: string[];
}

const buildGroups = (tournament: Tournament): GroupData[] => {
  const groupsCount = Math.max(1, tournament.groups_count || 1);
  const playersPerGroup = Math.max(
    2,
    Math.ceil((tournament.participants_count || groupsCount * 2) / groupsCount)
  );

  return Array.from({ length: groupsCount }, (_, groupIndex) => ({
    name: `Grupo ${groupIndex + 1}`,
    players: Array.from({ length: playersPerGroup }, () => 'Por definir')
  }));
};

export const TournamentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const tournamentId = useMemo(() => Number(id), [id]);
  const { user, logout } = useAuth();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRound, setSelectedRound] = useState<number>(1);

  useEffect(() => {
    const load = async () => {
      if (Number.isNaN(tournamentId) || tournamentId <= 0) {
        setError('ID de torneo inválido');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await getTournamentById(tournamentId);
        if (!data) {
          setError('Torneo no encontrado');
          setTournament(null);
          return;
        }
        setTournament(data);
        setSelectedRound(1);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [tournamentId]);

  if (loading) {
    return (
      <div className="app-shell">
        <main className="app-main">
          <p>Cargando detalle del torneo...</p>
        </main>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="app-shell">
        <main className="app-main">
          <p className="error-text">{error ?? 'No se pudo cargar el torneo'}</p>
          <Link to="/tournaments">Volver a torneos</Link>
        </main>
      </div>
    );
  }

  const groups = buildGroups(tournament);
  const roundsCount = Math.max(1, tournament.rounds_count || 1);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-left">
          <h1>{tournament.name}</h1>
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

      <main className="app-main tournament-detail-main">
        <section className="card tournament-detail-hero">
          <h2>{tournament.name}</h2>
          <p className="tournament-dates">
            {tournament.start_date} - {tournament.end_date}
          </p>
          <div className="tournament-meta">
            <div>
              <span className="meta-label">Participantes</span>
              <span className="meta-value">{tournament.participants_count}</span>
            </div>
            <div>
              <span className="meta-label">Grupos</span>
              <span className="meta-value">{tournament.groups_count}</span>
            </div>
            <div>
              <span className="meta-label">Rondas</span>
              <span className="meta-value">{tournament.rounds_count}</span>
            </div>
          </div>
          <div className="round-selector">
            <label htmlFor="round-select">Ronda</label>
            <select
              id="round-select"
              value={selectedRound}
              onChange={(event) => setSelectedRound(Number(event.target.value))}
            >
              {Array.from({ length: roundsCount }, (_, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {idx + 1}
                </option>
              ))}
            </select>
          </div>
        </section>

        <h3 className="round-title">Round {selectedRound}</h3>

        {groups.map((group) => (
          <section key={group.name} className="card detail-group-card">
            <h3>{group.name}</h3>
            <div className="detail-table-wrapper">
              <table className="detail-round-table">
                <thead>
                  <tr>
                    <th>Jugadora</th>
                    {group.players.map((_, idx) => (
                      <th key={`head-player-${idx}`}>Por definir</th>
                    ))}
                    <th>PG</th>
                    <th>PP</th>
                    <th>PTS</th>
                    <th>PJ</th>
                    <th>S</th>
                    <th>J</th>
                  </tr>
                </thead>
                <tbody>
                  {group.players.map((player, rowIdx) => (
                    <tr key={`row-${group.name}-${rowIdx}`}>
                      <td>{player}</td>
                      {group.players.map((_, colIdx) => (
                        <td key={`cell-${group.name}-${rowIdx}-${colIdx}`}>
                          {rowIdx === colIdx ? '-' : 'Por definir'}
                        </td>
                      ))}
                      <td>0</td>
                      <td>0</td>
                      <td>0</td>
                      <td>0</td>
                      <td>0</td>
                      <td>0</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        <p className="muted">
          <Link to="/tournaments">Volver a torneos</Link>
        </p>
      </main>
    </div>
  );
};

