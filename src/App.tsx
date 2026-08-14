import React, { useEffect, useState, useRef } from 'react';
import { supabase, Participant } from './supabase';
import { Trash2, UserPlus, RotateCcw, Database, UserX, UserCheck, Sparkles } from 'lucide-react';

const DEFAULT_MEMBERS = [
  'Juan Muñoz',
  'Juan Salas',
  'Abraham',
  'Nikol',
  'Cristhian',
  'Miguel',
  'John',
  'Andy',
  'Wes',
  'George',
  'Matt',
  'Amellia',
];

export function App() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [customUrl, setCustomUrl] = useState(localStorage.getItem('SUPABASE_URL') || '');
  const [customKey, setCustomKey] = useState(localStorage.getItem('SUPABASE_ANON_KEY') || '');

  const isResettingRef = useRef(false);

  // Fetch participants (READ ONLY - no race conditions)
  const fetchParticipants = async () => {
    if (isResettingRef.current) return;

    if (!supabase) {
      const local = localStorage.getItem('local_participants');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          setParticipants(parsed || []);
        } catch {
          setParticipants([]);
        }
      } else {
        const initial: Participant[] = DEFAULT_MEMBERS.map((name, i) => ({
          id: 'local_' + (Date.now() + i),
          name,
          has_spoken: false,
          is_absent: false,
        }));
        setParticipants(initial);
        localStorage.setItem('local_participants', JSON.stringify(initial));
      }
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error && data) {
      setParticipants(data);
    }
    setLoading(false);
  };

  // Seed default members if explicitly requested or empty initial setup
  const seedDefaults = async () => {
    if (!supabase) {
      const initial: Participant[] = DEFAULT_MEMBERS.map((name, i) => ({
        id: 'local_' + (Date.now() + i),
        name,
        has_spoken: false,
        is_absent: false,
      }));
      setParticipants(initial);
      localStorage.setItem('local_participants', JSON.stringify(initial));
      return;
    }

    const rows = DEFAULT_MEMBERS.map((name) => ({
      name,
      has_spoken: false,
      is_absent: false,
    }));
    await supabase.from('participants').insert(rows);
    fetchParticipants();
  };

  // Subscribe to real-time updates
  useEffect(() => {
    fetchParticipants();

    if (!supabase) return;

    const channel = supabase
      .channel('participants_realtime_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants' },
        () => {
          if (!isResettingRef.current) {
            fetchParticipants();
          }
        }
      )
      .subscribe();

    return () => {
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  // Save local fallback helper
  const saveLocal = (updated: Participant[]) => {
    setParticipants(updated);
    localStorage.setItem('local_participants', JSON.stringify(updated));
  };

  // Add participant
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;

    if (!supabase) {
      const newItem: Participant = {
        id: 'local_' + Date.now(),
        name,
        has_spoken: false,
        is_absent: false,
      };
      saveLocal([...participants, newItem]);
      setNewName('');
      return;
    }

    const { error } = await supabase
      .from('participants')
      .insert([{ name, has_spoken: false, is_absent: false }]);

    if (!error) {
      setNewName('');
      fetchParticipants();
    }
  };

  // Toggle spoken
  const toggleSpoken = async (p: Participant) => {
    if (p.is_absent) return;
    const nextVal = !p.has_spoken;

    // Optimistic UI update
    setParticipants((prev) =>
      prev.map((item) => (item.id === p.id ? { ...item, has_spoken: nextVal } : item))
    );

    if (!supabase) {
      const updated = participants.map((item) =>
        item.id === p.id ? { ...item, has_spoken: nextVal } : item
      );
      saveLocal(updated);
      return;
    }

    await supabase
      .from('participants')
      .update({ has_spoken: nextVal })
      .eq('id', p.id);
  };

  // Toggle absent
  const toggleAbsent = async (p: Participant, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextVal = !p.is_absent;

    setParticipants((prev) =>
      prev.map((item) =>
        item.id === p.id
          ? { ...item, is_absent: nextVal, has_spoken: nextVal ? false : item.has_spoken }
          : item
      )
    );

    if (!supabase) {
      const updated = participants.map((item) =>
        item.id === p.id
          ? { ...item, is_absent: nextVal, has_spoken: nextVal ? false : item.has_spoken }
          : item
      );
      saveLocal(updated);
      return;
    }

    await supabase
      .from('participants')
      .update({ is_absent: nextVal, has_spoken: nextVal ? false : p.has_spoken })
      .eq('id', p.id);
  };

  // Delete participant
  const handleDelete = async (p: Participant, e: React.MouseEvent) => {
    e.stopPropagation();
    setParticipants((prev) => prev.filter((item) => item.id !== p.id));

    if (!supabase) {
      const updated = participants.filter((item) => item.id !== p.id);
      saveLocal(updated);
      return;
    }

    await supabase.from('participants').delete().eq('id', p.id);
  };

  // Reset daily cleanly without duplicates
  const handleReset = async () => {
    if (isResettingRef.current) return;
    isResettingRef.current = true;
    setIsResetting(true);

    const defaultList: Participant[] = DEFAULT_MEMBERS.map((name, i) => ({
      id: 'default_' + (Date.now() + i),
      name,
      has_spoken: false,
      is_absent: false,
    }));

    // Optimistic UI update immediately
    setParticipants(defaultList);

    if (!supabase) {
      localStorage.setItem('local_participants', JSON.stringify(defaultList));
      isResettingRef.current = false;
      setIsResetting(false);
      return;
    }

    try {
      // 1. Get all current row IDs
      const { data: existing } = await supabase.from('participants').select('id');
      
      // 2. Delete existing rows
      if (existing && existing.length > 0) {
        const ids = existing.map((r) => r.id);
        await supabase.from('participants').delete().in('id', ids);
      }

      // 3. Insert the 12 clean default members
      const rows = DEFAULT_MEMBERS.map((name) => ({
        name,
        has_spoken: false,
        is_absent: false,
      }));
      await supabase.from('participants').insert(rows);

      // 4. Reload clean list from Supabase
      const { data: fresh } = await supabase
        .from('participants')
        .select('*')
        .order('created_at', { ascending: true });

      if (fresh) {
        setParticipants(fresh);
      }
    } catch (err) {
      console.error('Error during reset:', err);
    } finally {
      isResettingRef.current = false;
      setIsResetting(false);
    }
  };

  // Save custom Supabase config
  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('SUPABASE_URL', customUrl.trim());
    localStorage.setItem('SUPABASE_ANON_KEY', customKey.trim());
    window.location.reload();
  };

  const activeParticipants = participants.filter((p) => !p.is_absent);
  const spokenCount = activeParticipants.filter((p) => p.has_spoken).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex justify-center p-4 sm:p-8">
      <div className="w-full max-w-lg flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Daily Standup</h1>
            <p className="text-sm text-slate-500">
              {activeParticipants.length === 0
                ? 'No participants yet'
                : `${spokenCount} of ${activeParticipants.length} spoke`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              disabled={isResetting}
              className="flex items-center gap-1 text-sm bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-50 text-slate-700 font-medium px-3 py-1.5 rounded-lg shadow-xs transition cursor-pointer"
              title="Reset all checkboxes and restore default team"
            >
              <RotateCcw size={14} className={isResetting ? 'animate-spin' : ''} />
              <span>{isResetting ? 'Resetting...' : 'Reset'}</span>
            </button>
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              title="Supabase Settings"
            >
              <Database size={18} />
            </button>
          </div>
        </div>

        {/* Supabase Connection Bar / Modal */}
        {showConfig && (
          <form
            onSubmit={handleSaveConfig}
            className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col gap-3 text-sm text-emerald-950"
          >
            <div className="flex justify-between items-center font-semibold">
              <span>Supabase Connection</span>
              <button
                type="button"
                onClick={() => setShowConfig(false)}
                className="text-xs text-emerald-700 underline cursor-pointer"
              >
                Close
              </button>
            </div>
            <p className="text-xs text-emerald-800">
              Paste your Supabase URL & Publishable Key below for instant real-time sync across everyone’s screens.
            </p>
            <input
              type="text"
              placeholder="Supabase Project URL (https://xyz.supabase.co)"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              className="bg-white border border-emerald-300 rounded px-2.5 py-1.5 text-xs text-slate-900"
              required
            />
            <input
              type="password"
              placeholder="Supabase Publishable / Anon Key"
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
              className="bg-white border border-emerald-300 rounded px-2.5 py-1.5 text-xs text-slate-900"
              required
            />
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1.5 rounded text-xs transition cursor-pointer"
            >
              Save & Connect
            </button>
          </form>
        )}

        {/* Add Participant Input */}
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            placeholder="Add participant name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 bg-white border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3.5 py-2 text-sm outline-hidden shadow-xs"
          />
          <button
            type="submit"
            disabled={!newName.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm flex items-center gap-1.5 shadow-xs transition cursor-pointer"
          >
            <UserPlus size={16} />
            <span>Add</span>
          </button>
        </form>

        {/* Participants List */}
        <div className="flex flex-col gap-2.5 transition-all duration-300">
          {loading ? (
            <div className="text-center py-8 text-sm text-slate-400">Loading standup...</div>
          ) : participants.length === 0 ? (
            <div className="text-center py-10 bg-white border border-dashed border-slate-300 rounded-xl text-slate-500 text-sm flex flex-col items-center gap-3">
              <span>No participants yet.</span>
              <button
                onClick={seedDefaults}
                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-3 py-1.5 rounded-lg transition cursor-pointer"
              >
                <Sparkles size={14} /> Add Default Team Members
              </button>
            </div>
          ) : (
            [...participants]
              .sort((a, b) => {
                // 1. Absent to the very bottom
                if (a.is_absent !== b.is_absent) return a.is_absent ? 1 : -1;
                // 2. Spoken to the bottom of active participants
                if (a.has_spoken !== b.has_spoken) return a.has_spoken ? 1 : -1;
                // 3. Stable order
                return (a.created_at || a.id).localeCompare(b.created_at || b.id);
              })
              .map((p) => (
                <div
                  key={p.id}
                  onClick={() => toggleSpoken(p)}
                  className={`group flex items-center justify-between p-3.5 rounded-xl border transition-all duration-300 ease-out select-none cursor-pointer transform active:scale-[0.99] ${
                    p.is_absent
                      ? 'bg-slate-100/70 border-slate-200 opacity-50 translate-y-0.5'
                      : p.has_spoken
                      ? 'bg-emerald-50/80 border-emerald-200/80 text-emerald-950 translate-y-0.5 shadow-2xs'
                      : 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-sm text-slate-900 shadow-xs'
                  }`}
                >
                  {/* Left side: Checkbox + Name */}
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all duration-200 ${
                        p.has_spoken
                          ? 'bg-emerald-600 border-emerald-600 scale-105 shadow-xs'
                          : 'border-slate-300 bg-white group-hover:border-emerald-400'
                      }`}
                    >
                      {p.has_spoken && (
                        <svg
                          className="w-3.5 h-3.5 text-white animate-in zoom-in-75 duration-200"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="3"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>

                    <span
                      className={`text-sm font-medium transition-all duration-200 ${
                        p.is_absent
                          ? 'line-through text-slate-400'
                          : p.has_spoken
                          ? 'text-emerald-900/80 font-normal line-through decoration-emerald-500/50'
                          : 'text-slate-800 font-medium'
                      }`}
                    >
                      {p.name}
                    </span>
                  </div>

                  {/* Right side: Absent button + Delete button */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => toggleAbsent(p, e)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all duration-150 cursor-pointer ${
                        p.is_absent
                          ? 'bg-slate-200 hover:bg-slate-300 text-slate-800 shadow-2xs'
                          : 'bg-slate-100/80 hover:bg-slate-200 text-slate-600'
                      }`}
                      title={p.is_absent ? 'Mark Present' : 'Mark Absent'}
                    >
                      {p.is_absent ? (
                        <span className="flex items-center gap-1">
                          <UserCheck size={13} /> Present
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <UserX size={13} /> Absent
                        </span>
                      )}
                    </button>

                    <button
                      onClick={(e) => handleDelete(p, e)}
                      className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 transition rounded-md cursor-pointer"
                      title="Remove participant"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
