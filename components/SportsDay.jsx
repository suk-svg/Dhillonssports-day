import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, Trophy, Calendar, Activity, Plus, 
  Trash2, ChevronRight, ArrowLeft, Save, Award,
  CheckCircle, Clock, Settings, AlertCircle, Loader
} from 'lucide-react';

// --- MOCK DATA BASED ON SPREADSHEETS ---
const DEFAULT_TEAMS = [
  { id: 'T001', name: 'Red Dragons', color: 'bg-red-500' },
  { id: 'T002', name: 'Blue Falcons', color: 'bg-blue-500' },
  { id: 'T003', name: 'Green Titans', color: 'bg-green-500' },
  { id: 'T004', name: 'Yellow Jackets', color: 'bg-yellow-500' },
];

const DEFAULT_EVENTS = [
  { id: 'EVT001', name: 'Sprint', type: 'Age Category', usesTime: true, usesPlace: true, bracketKey: 'age' },
  { id: 'EVT002', name: 'Egg and Spoon', type: 'Age Category', usesTime: false, usesPlace: true, bracketKey: 'age' },
  { id: 'EVT003', name: 'Sack Race', type: 'Age Category', usesTime: false, usesPlace: true, bracketKey: 'age' },
  { id: 'EVT004', name: 'Relay', type: 'Randomised Teams', usesTime: false, usesPlace: true, bracketKey: null },
  { id: 'EVT007', name: 'Bench Press Challenge', type: 'Gender / Bodyweight Rule', usesTime: false, usesPlace: false, usesReps: true, bracketKey: 'benchPress' },
  { id: 'EVT008', name: 'Sumo Wrestling', type: 'Weight Category', usesTime: false, usesPlace: true, bracketKey: 'sumo' },
];

const INITIAL_PARTICIPANTS = [
  { id: 'P001', name: 'Suk Dhillon', age: 42, gender: 'male', weight: 110, teamId: 'T001' },
  { id: 'P002', name: 'Aman', age: 43, gender: 'female', weight: 70, teamId: 'T002' },
  { id: 'P003', name: 'Leo', age: 12, gender: 'male', weight: 45, teamId: 'T003' },
  { id: 'P004', name: 'Maya', age: 10, gender: 'female', weight: 35, teamId: 'T004' },
];

const INITIAL_BRACKETS = {
  age: [
    { id: 'b_a1', label: 'Junior', range: '7-10' },
    { id: 'b_a2', label: 'Youth', range: '11-15' },
    { id: 'b_a3', label: 'Open Adult', range: '16-39' },
    { id: 'b_a4', label: 'Masters', range: '40+' }
  ],
  benchPress: [
    { id: 'b_b1', label: 'Regular Gym Goer', range: '50% body weight' },
    { id: 'b_b2', label: 'Occasional Gym Goer', range: '33% body weight' },
    { id: 'b_b3', label: 'Not Been Gym This Year', range: '25% body weight' }
  ],
  sumo: [
    { id: 'b_s1', label: 'Lightweight', range: 'Under 70kg' },
    { id: 'b_s2', label: 'Middleweight', range: '70-84.9kg' },
    { id: 'b_s3', label: 'Heavyweight', range: '85-99.9kg' },
    { id: 'b_s4', label: 'Super Heavyweight', range: '100kg+' }
  ]
};

// Scoring from settings: 1st=10, 2nd=8, 3rd=6, 4th=4, 5th=2
const SCORING_SYSTEM = { 1: 10, 2: 8, 3: 6, 4: 4, 5: 2 };

// --- STORAGE UTILITIES ---
const STORAGE_KEY = 'sportsDayData_2026';

const loadFromStorage = () => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Error loading from storage:', error);
    return null;
  }
};

const saveToStorage = (data) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving to storage:', error);
  }
};

// --- VALIDATION UTILITIES ---
const validateParticipant = (participant) => {
  const errors = [];
  if (!participant.name || participant.name.trim() === '') errors.push('Name is required');
  if (!participant.age || participant.age < 1 || participant.age > 120) errors.push('Age must be between 1-120');
  if (participant.weight && (participant.weight < 0 || participant.weight > 500)) errors.push('Weight must be between 0-500kg');
  return errors;
};

// --- BRACKET MATCHING UTILITIES ---
const getAgeBracket = (age, brackets) => {
  if (!brackets.age) return null;
  
  for (let bracket of brackets.age) {
    const range = bracket.range;
    
    // Handle "40+" format
    if (range.includes('+')) {
      const threshold = parseInt(range);
      if (age >= threshold) return bracket;
    }
    // Handle "7-10" format
    else if (range.includes('-')) {
      const [min, max] = range.split('-').map(Number);
      if (age >= min && age <= max) return bracket;
    }
  }
  return null;
};

const getWeightBracket = (weight, brackets) => {
  if (!brackets.sumo) return null;
  
  for (let bracket of brackets.sumo) {
    const range = bracket.range;
    
    if (range.includes('Under')) {
      const threshold = parseInt(range);
      if (weight < threshold) return bracket;
    } else if (range.includes('+')) {
      const threshold = parseInt(range);
      if (weight >= threshold) return bracket;
    } else if (range.includes('-')) {
      const [min, max] = range.split('-').map(n => parseFloat(n));
      if (weight >= min && weight <= max) return bracket;
    }
  }
  return null;
};

const isParticipantEligible = (participant, event, brackets) => {
  // No bracket filtering for randomized team events
  if (!event.bracketKey) return true;
  
  if (event.bracketKey === 'age') {
    return getAgeBracket(participant.age, brackets) !== null;
  }
  if (event.bracketKey === 'sumo') {
    return getWeightBracket(participant.weight, brackets) !== null;
  }
  if (event.bracketKey === 'benchPress') {
    return true;
  }
  
  return true;
};

export default function SportsDay() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [hydrated, setHydrated] = useState(false);
  
  // App State
  const [teams] = useState(DEFAULT_TEAMS);
  const [events] = useState(DEFAULT_EVENTS);
  const [participants, setParticipants] = useState(INITIAL_PARTICIPANTS);
  const [brackets, setBrackets] = useState(INITIAL_BRACKETS);
  const [heats, setHeats] = useState([]);
  const [entries, setEntries] = useState([]);

  // Navigation state
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedHeat, setSelectedHeat] = useState(null);

  // Helper to generate IDs
  const generateId = (prefix) => `${prefix}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

  // --- LOAD DATA FROM STORAGE ON MOUNT ---
  useEffect(() => {
    setHydrated(true);
    const stored = loadFromStorage();
    if (stored) {
      if (stored.participants) setParticipants(stored.participants);
      if (stored.brackets) setBrackets(stored.brackets);
      if (stored.heats) setHeats(stored.heats);
      if (stored.entries) setEntries(stored.entries);
    }
  }, []);

  // --- SAVE TO STORAGE WHENEVER DATA CHANGES ---
  useEffect(() => {
    if (!hydrated) return;
    
    const timer = setTimeout(() => {
      setIsSaving(true);
      saveToStorage({ participants, brackets, heats, entries });
      setSaveMessage('Changes saved');
      setTimeout(() => setSaveMessage(''), 2000);
      setIsSaving(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [participants, brackets, heats, entries, hydrated]);

  // --- DERIVED STATE / CALCS ---
  const leaderboard = useMemo(() => {
    const scores = {};
    teams.forEach(t => scores[t.id] = { ...t, totalPoints: 0 });
    
    entries.forEach(entry => {
      if (entry.points && scores[entry.teamId]) {
        scores[entry.teamId].totalPoints += entry.points;
      }
    });

    return Object.values(scores).sort((a, b) => b.totalPoints - a.totalPoints);
  }, [entries, teams]);

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-gray-600">Loading Sports Day...</p>
        </div>
      </div>
    );
  }

  // --- RENDERERS ---
  const renderTabNavigation = () => (
    <nav className="bg-white shadow-sm mb-6 border-b">
      <div className="max-w-7xl mx-auto px-4 flex space-x-8 overflow-x-auto">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: Activity },
          { id: 'participants', label: 'Participants', icon: Users },
          { id: 'events', label: 'Events & Heats', icon: Calendar },
          { id: 'brackets', label: 'Brackets & Rules', icon: Settings },
          { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setSelectedEvent(null);
              setSelectedHeat(null);
            }}
            className={`flex items-center px-3 py-4 border-b-2 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <tab.icon className="w-4 h-4 mr-2" />
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <header className="bg-slate-900 text-white p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Award className="w-8 h-8 text-yellow-400" />
            <h1 className="text-xl font-bold">Dhillons Sports Day 2026</h1>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            {isSaving && <Loader className="w-4 h-4 animate-spin text-gray-400" />}
            {saveMessage && <span className="text-green-400">{saveMessage}</span>}
          </div>
        </div>
      </header>

      {renderTabNavigation()}

      <main className="max-w-7xl mx-auto px-4 pb-12">
        {activeTab === 'dashboard' && (
          <Dashboard 
            participants={participants} 
            events={events} 
            heats={heats} 
            leaderboard={leaderboard} 
            setActiveTab={setActiveTab}
          />
        )}
        
        {activeTab === 'participants' && (
          <ParticipantManager 
            participants={participants} 
            setParticipants={setParticipants} 
            teams={teams}
            generateId={generateId}
          />
        )}

        {activeTab === 'events' && !selectedEvent && (
          <EventList 
            events={events} 
            heats={heats}
            onSelectEvent={setSelectedEvent}
          />
        )}

        {activeTab === 'events' && selectedEvent && !selectedHeat && (
          <HeatManager 
            event={selectedEvent}
            heats={heats.filter(h => h.eventId === selectedEvent.id)}
            setHeats={setHeats}
            onBack={() => setSelectedEvent(null)}
            onSelectHeat={setSelectedHeat}
            generateId={generateId}
          />
        )}

        {activeTab === 'events' && selectedEvent && selectedHeat && (
          <HeatDetail 
            event={selectedEvent}
            heat={selectedHeat}
            entries={entries.filter(e => e.heatId === selectedHeat.id)}
            setEntries={setEntries}
            participants={participants}
            teams={teams}
            brackets={brackets}
            onBack={() => setSelectedHeat(null)}
            generateId={generateId}
          />
        )}

        {activeTab === 'brackets' && (
          <BracketManager 
            brackets={brackets}
            setBrackets={setBrackets}
            generateId={generateId}
          />
        )}

        {activeTab === 'leaderboard' && (
          <Leaderboard leaderboard={leaderboard} />
        )}
      </main>
    </div>
  );
}

// ==========================================
// SUB-COMPONENTS
// ==========================================

function Dashboard({ participants, events, heats, leaderboard, setActiveTab }) {
  const topTeam = leaderboard[0];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Participants</p>
            <p className="text-2xl font-bold">{participants.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Events</p>
            <p className="text-2xl font-bold">{events.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-purple-100 text-purple-600 rounded-full">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Heats</p>
            <p className="text-2xl font-bold">{heats.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-yellow-100 text-yellow-600 rounded-full">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Current Leader</p>
            <p className="text-lg font-bold truncate">
              {topTeam?.totalPoints > 0 ? topTeam.name : 'No points yet'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <button 
              onClick={() => setActiveTab('participants')}
              className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg font-medium transition-colors"
            >
              + Register New Participant
            </button>
            <button 
              onClick={() => setActiveTab('events')}
              className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg font-medium transition-colors"
            >
              ↳ Manage Heats & Finals
            </button>
            <button 
              onClick={() => setActiveTab('leaderboard')}
              className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg font-medium transition-colors"
            >
              <Trophy className="w-4 h-4 inline mr-2 text-yellow-500"/>
              View Live Leaderboard
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold mb-4">Top Teams Preview</h2>
          <div className="space-y-4">
            {leaderboard.slice(0, 3).map((team, idx) => (
              <div key={team.id} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${team.color}`}>
                    {idx + 1}
                  </span>
                  <span className="font-medium">{team.name}</span>
                </div>
                <span className="font-bold text-gray-600">{team.totalPoints} pts</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ParticipantManager({ participants, setParticipants, teams, generateId }) {
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ name: '', age: '', gender: 'male', weight: '', teamId: teams[0].id });
  const [errors, setErrors] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const newParticipant = {
      name: formData.name,
      age: parseInt(formData.age),
      gender: formData.gender,
      weight: parseFloat(formData.weight) || 0,
      teamId: formData.teamId
    };

    const validationErrors = validateParticipant(newParticipant);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setParticipants([...participants, { ...newParticipant, id: generateId('P') }]);
    setIsAdding(false);
    setFormData({ name: '', age: '', gender: 'male', weight: '', teamId: teams[0].id });
    setErrors([]);
  };

  const deleteParticipant = (id) => {
    setParticipants(participants.filter(p => p.id !== id));
    setDeleteConfirm(null);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Participants Database</h2>
        <button 
          onClick={() => {
            setIsAdding(!isAdding);
            setErrors([]);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700 transition-colors"
        >
          {isAdding ? 'Cancel' : <><Plus className="w-4 h-4 mr-2" /> Add Participant</>}
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-200">
          {errors.length > 0 && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">
                {errors.map((err, i) => <div key={i}>• {err}</div>)}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input 
                required 
                type="text" 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                placeholder="e.g., John Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Age *</label>
              <input 
                required 
                type="number" 
                min="1"
                max="120"
                value={formData.age} 
                onChange={e => setFormData({...formData, age: e.target.value})} 
                className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                placeholder="1-120"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select 
                value={formData.gender} 
                onChange={e => setFormData({...formData, gender: e.target.value})} 
                className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
              <input 
                type="number" 
                min="0"
                max="500"
                step="0.1"
                value={formData.weight} 
                onChange={e => setFormData({...formData, weight: e.target.value})} 
                className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                placeholder="0-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Team Assignment</label>
              <select 
                value={formData.teamId} 
                onChange={e => setFormData({...formData, teamId: e.target.value})} 
                className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              >
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <button 
            type="submit" 
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Participant
          </button>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {participants.map(p => {
              const team = teams.find(t => t.id === p.teamId);
              return (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{p.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {p.age} yrs • {p.gender} {p.weight ? `• ${p.weight}kg` : ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${team?.color || 'bg-gray-500'}`}>
                      {team?.name || 'Unassigned'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {deleteConfirm === p.id ? (
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={() => deleteParticipant(p.id)} 
                          className="text-red-600 hover:text-red-900 font-medium text-xs"
                        >
                          Confirm
                        </button>
                        <button 
                          onClick={() => setDeleteConfirm(null)} 
                          className="text-gray-600 hover:text-gray-900 font-medium text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setDeleteConfirm(p.id)} 
                        className="text-red-600 hover:text-red-900"
                        title="Delete participant"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {participants.length === 0 && (
              <tr>
                <td colSpan="4" className="px-6 py-8 text-center text-gray-500">No participants found. Add some to get started.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EventList({ events, heats, onSelectEvent }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
      <h2 className="text-xl font-bold mb-6">Events Schedule</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {events.map(event => {
          const eventHeats = heats.filter(h => h.eventId === event.id);
          return (
            <div 
              key={event.id} 
              onClick={() => onSelectEvent(event)}
              className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:shadow-md cursor-pointer transition-all group"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg text-gray-900 group-hover:text-blue-600">{event.name}</h3>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
              </div>
              <p className="text-sm text-gray-500 mb-4">{event.type}</p>
              
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">
                  {eventHeats.length} {eventHeats.length === 1 ? 'Heat' : 'Heats'}
                </span>
                {event.usesPlace && <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded">Placements</span>}
                {event.usesTime && <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded">Times</span>}
                {event.usesReps && <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded">Reps</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HeatManager({ event, heats, setHeats, onBack, onSelectHeat, generateId }) {
  const eventHeats = heats.filter(h => h.eventId === event.id);

  const createHeat = (round) => {
    const heatNumber = eventHeats.filter(h => h.round === round).length + 1;
    const newHeat = {
      id: generateId('H'),
      eventId: event.id,
      round: round,
      heatNumber: heatNumber,
      status: 'Open'
    };
    setHeats(prev => [...prev, newHeat]);
  };

  const deleteHeat = (heatId) => {
    setHeats(prev => prev.filter(h => h.id !== heatId));
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
      <button onClick={onBack} className="flex items-center text-blue-600 hover:text-blue-800 mb-6 font-medium text-sm">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Events
      </button>

      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl font-bold">{event.name}</h2>
          <p className="text-gray-500">{event.type} • Manage Heats & Finals</p>
        </div>
        <div className="flex space-x-2">
          <button 
            onClick={() => createHeat('Heat')} 
            className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg font-medium hover:bg-blue-100 transition-colors flex items-center text-sm"
          >
            <Plus className="w-4 h-4 mr-1" /> Add Heat
          </button>
          <button 
            onClick={() => createHeat('Final')} 
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center text-sm"
          >
            <Plus className="w-4 h-4 mr-1" /> Add Final
          </button>
        </div>
      </div>

      {eventHeats.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <p className="text-gray-500 mb-2">No heats created yet.</p>
          <p className="text-sm text-gray-400">Create a heat to start adding participants and logging results.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {eventHeats.map(heat => (
            <div 
              key={heat.id} 
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors group"
            >
              <div 
                className="flex items-center space-x-4 flex-1 cursor-pointer"
                onClick={() => onSelectHeat(heat)}
              >
                <div className={`p-2 rounded-lg text-white font-bold text-sm ${heat.round === 'Final' ? 'bg-indigo-500' : 'bg-blue-500'}`}>
                  {heat.round.charAt(0)}{heat.heatNumber}
                </div>
                <div>
                  <h4 className="font-bold">{heat.round} {heat.heatNumber}</h4>
                  <p className="text-sm text-gray-500">Status: {heat.status}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteHeat(heat.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-800 transition-opacity"
                  title="Delete heat"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HeatDetail({ event, heat, entries, setEntries, participants, teams, brackets, onBack, generateId }) {
  const [selectedParticipantId, setSelectedParticipantId] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Filter eligible and available participants
  const eligibleParticipants = participants.filter(p => 
    isParticipantEligible(p, event, brackets)
  );

  const availableParticipants = eligibleParticipants.filter(
    p => !entries.find(e => e.participantId === p.id && e.heatId === heat.id)
  );

  const addParticipantToHeat = () => {
    if (!selectedParticipantId) return;
    const p = participants.find(p => p.id === selectedParticipantId);
    
    const newEntry = {
      id: generateId('ENT'),
      heatId: heat.id,
      participantId: p.id,
      teamId: p.teamId,
      place: '',
      score: '',
      points: 0,
      status: 'pending'
    };
    
    setEntries(prev => [...prev, newEntry]);
    setSelectedParticipantId('');
  };

  const removeEntry = (entryId) => {
    setEntries(prev => prev.filter(e => e.id !== entryId));
    setDeleteConfirm(null);
  };

  const updateResult = (entryId, field, value) => {
    setEntries(prev => prev.map(entry => {
      if (entry.id !== entryId) return entry;
      
      const updated = { ...entry, [field]: value };
      
      if (field === 'place' && value) {
        const placeNum = parseInt(value);
        updated.points = SCORING_SYSTEM[placeNum] || 0;
        updated.status = 'completed';
      }

      if (field === 'status' && (value === 'dnf' || value === 'dq')) {
        updated.place = '';
        updated.points = 0;
      }

      return updated;
    }));
  };

  const heatEntries = entries;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
      <button onClick={onBack} className="flex items-center text-blue-600 hover:text-blue-800 mb-6 font-medium text-sm">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to {event.name} Heats
      </button>

      <div className="mb-8 border-b pb-6">
        <div className="flex items-center space-x-3 mb-2">
          <h2 className="text-2xl font-bold">{event.name}</h2>
          <span className={`px-3 py-1 rounded-full text-sm font-bold text-white ${heat.round === 'Final' ? 'bg-indigo-500' : 'bg-blue-500'}`}>
            {heat.round} {heat.heatNumber}
          </span>
        </div>
        <p className="text-gray-500">Add participants to this heat and record their results.</p>
      </div>

      {availableParticipants.length === 0 && heatEntries.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-6 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-700">
            <strong>No eligible participants.</strong> Check your brackets and ensure participants meet the eligibility criteria for {event.name}.
          </div>
        </div>
      )}

      {availableParticipants.length > 0 && (
        <div className="flex items-center space-x-2 mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
          <select 
            value={selectedParticipantId} 
            onChange={(e) => setSelectedParticipantId(e.target.value)}
            className="flex-1 border-gray-300 rounded-md shadow-sm p-2 border focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          >
            <option value="">-- Select Participant to Add --</option>
            {availableParticipants.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} ({teams.find(t=>t.id===p.teamId)?.name}) • Age {p.age}{p.weight ? ` • ${p.weight}kg` : ''}
              </option>
            ))}
          </select>
          <button 
            onClick={addParticipantToHeat}
            disabled={!selectedParticipantId}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
          >
            Add to Heat
          </button>
        </div>
      )}

      {heatEntries.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No participants in this heat yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Participant</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Team</th>
                {event.usesTime && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>}
                {event.usesReps && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reps</th>}
                {event.usesPlace && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Place</th>}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Points</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {heatEntries.map(entry => {
                const participant = participants.find(p => p.id === entry.participantId);
                const team = teams.find(t => t.id === entry.teamId);
                
                return (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap font-medium text-gray-900">
                      {participant?.name || 'Unknown'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 rounded text-xs font-bold text-white ${team?.color}`}>
                        {team?.name.substring(0,3).toUpperCase()}
                      </span>
                    </td>
                    
                    {event.usesTime && (
                      <td className="px-4 py-4 whitespace-nowrap">
                        <input 
                          type="text" 
                          placeholder="e.g. 12.5s"
                          value={entry.score}
                          onChange={(e) => updateResult(entry.id, 'score', e.target.value)}
                          disabled={entry.status === 'dnf' || entry.status === 'dq'}
                          className="w-24 border-gray-300 rounded p-1 border text-sm disabled:bg-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </td>
                    )}

                    {event.usesReps && (
                      <td className="px-4 py-4 whitespace-nowrap">
                        <input 
                          type="number" 
                          placeholder="Reps"
                          value={entry.score}
                          onChange={(e) => updateResult(entry.id, 'score', e.target.value)}
                          disabled={entry.status === 'dnf' || entry.status === 'dq'}
                          className="w-20 border-gray-300 rounded p-1 border text-sm disabled:bg-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </td>
                    )}

                    {event.usesPlace && (
                      <td className="px-4 py-4 whitespace-nowrap">
                        <select 
                          value={entry.place}
                          onChange={(e) => updateResult(entry.id, 'place', e.target.value)}
                          disabled={entry.status === 'dnf' || entry.status === 'dq'}
                          className="border-gray-300 rounded p-1 border text-sm w-20 disabled:bg-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        >
                          <option value="">-</option>
                          {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </td>
                    )}

                    <td className="px-4 py-4 whitespace-nowrap">
                      <select 
                        value={entry.status}
                        onChange={(e) => updateResult(entry.id, 'status', e.target.value)}
                        className={`border-gray-300 rounded p-1 border text-xs w-24 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none ${
                          entry.status === 'dnf' ? 'bg-orange-50' :
                          entry.status === 'dq' ? 'bg-red-50' :
                          entry.status === 'completed' ? 'bg-green-50' : ''
                        }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="completed">Completed</option>
                        <option value="dnf">DNF</option>
                        <option value="dq">DQ</option>
                      </select>
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap">
                      {entry.points > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-bold bg-green-100 text-green-800">
                          +{entry.points} pts
                        </span>
                      ) : entry.status === 'dnf' || entry.status === 'dq' ? (
                        <span className="text-gray-400 text-sm">—</span>
                      ) : (
                        <span className="text-gray-400 text-sm">0 pts</span>
                      )}
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {deleteConfirm === entry.id ? (
                        <div className="flex items-center space-x-1">
                          <button 
                            onClick={() => removeEntry(entry.id)} 
                            className="text-red-600 hover:text-red-900 font-medium text-xs"
                          >
                            Confirm
                          </button>
                          <button 
                            onClick={() => setDeleteConfirm(null)} 
                            className="text-gray-600 hover:text-gray-900 font-medium text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setDeleteConfirm(entry.id)} 
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      
      {heatEntries.length > 0 && (
        <div className="mt-6 flex justify-between items-center">
          <div className="text-sm text-gray-500 flex items-center">
            <CheckCircle className="w-4 h-4 mr-1 text-green-500" />
            Results auto-save and update the leaderboard instantly.
          </div>
          <div className="text-xs text-gray-500">
            {heatEntries.filter(e => e.status === 'completed' || e.status === 'dnf' || e.status === 'dq').length} of {heatEntries.length} participants recorded
          </div>
        </div>
      )}
    </div>
  );
}

function Leaderboard({ leaderboard }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-center space-x-3 mb-8">
        <Trophy className="w-8 h-8 text-yellow-500" />
        <h2 className="text-3xl font-black text-gray-900 uppercase tracking-wide">Live Leaderboard</h2>
      </div>

      <div className="space-y-4">
        {leaderboard.map((team, index) => (
          <div 
            key={team.id} 
            className={`relative overflow-hidden rounded-xl border p-6 flex items-center justify-between ${
              index === 0 ? 'border-yellow-400 shadow-md bg-yellow-50' : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-center space-x-6">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-black shadow-inner
                ${index === 0 ? 'bg-yellow-400 text-yellow-900' : 
                  index === 1 ? 'bg-gray-300 text-gray-800' : 
                  index === 2 ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-500'}`}
              >
                #{index + 1}
              </div>
              
              <div className="flex items-center space-x-3">
                <div className={`w-4 h-4 rounded-full ${team.color}`}></div>
                <h3 className="text-xl font-bold text-gray-900">{team.name}</h3>
              </div>
            </div>

            <div className="text-right">
              <p className="text-3xl font-black text-gray-900">
                {team.totalPoints}
              </p>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Points</p>
            </div>

            {index === 0 && (
              <div className="absolute -right-4 -top-4 opacity-10">
                <Trophy className="w-32 h-32 text-yellow-600" />
              </div>
            )}
          </div>
        ))}
      </div>
      
      <div className="mt-8 bg-gray-50 p-4 rounded-lg text-sm text-gray-600 border border-gray-200">
        <strong>Scoring Rules:</strong> 1st place = 10 pts, 2nd = 8 pts, 3rd = 6 pts, 4th = 4 pts, 5th = 2 pts. Points are automatically calculated as results are entered in Heats & Finals. DNF/DQ entries do not earn points.
      </div>
    </div>
  );
}

function BracketManager({ brackets, setBrackets, generateId }) {
  const updateBracket = (category, id, field, value) => {
    setBrackets(prev => ({
      ...prev,
      [category]: prev[category].map(b => b.id === id ? { ...b, [field]: value } : b)
    }));
  };

  const addBracket = (category) => {
    setBrackets(prev => ({
      ...prev,
      [category]: [...prev[category], { id: generateId('BRK'), label: '', range: '' }]
    }));
  };

  const removeBracket = (category, id) => {
    setBrackets(prev => ({
      ...prev,
      [category]: prev[category].filter(b => b.id !== id)
    }));
  };

  const sections = [
    { key: 'age', title: 'Age Brackets', desc: 'Used for Sprint, Egg & Spoon, and Sack Race', placeholder: 'e.g., 7-10 or 40+' },
    { key: 'benchPress', title: 'Bench Press Rules', desc: 'Handicap rules based on gym experience', placeholder: 'e.g., 50% body weight' },
    { key: 'sumo', title: 'Sumo Weight Brackets', desc: 'Weight classes for Sumo Wrestling', placeholder: 'e.g., Under 70kg' },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <div className="flex items-center space-x-3 mb-2">
          <Settings className="w-8 h-8 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Brackets & Rules Management</h2>
        </div>
        <p className="text-gray-500">Adjust the categorisation rules for events. These brackets help organise heats fairly and filter eligible participants.</p>
      </div>

      {sections.map(section => (
        <div key={section.key} className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-4 border-b pb-4">
            <div>
              <h3 className="text-xl font-bold">{section.title}</h3>
              <p className="text-sm text-gray-500">{section.desc}</p>
            </div>
            <button 
              onClick={() => addBracket(section.key)}
              className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg font-medium hover:bg-blue-100 transition-colors text-sm flex items-center"
            >
              <Plus className="w-4 h-4 mr-1" /> Add Rule
            </button>
          </div>

          <div className="space-y-3">
            {brackets[section.key].map((bracket, index) => (
              <div key={bracket.id} className="flex items-center space-x-3 bg-gray-50 p-3 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                <span className="font-bold text-gray-400 w-6">{index + 1}.</span>
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Category Name (e.g. Junior)"
                    value={bracket.label}
                    onChange={(e) => updateBracket(section.key, bracket.id, 'label', e.target.value)}
                    className="w-full border-gray-300 rounded p-2 border text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder={section.placeholder}
                    value={bracket.range}
                    onChange={(e) => updateBracket(section.key, bracket.id, 'range', e.target.value)}
                    className="w-full border-gray-300 rounded p-2 border text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
                <button 
                  onClick={() => removeBracket(section.key, bracket.id)}
                  className="p-2 text-red-500 hover:text-red-700 bg-white border border-gray-200 rounded-md hover:bg-red-50 transition-colors"
                  title="Remove Rule"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {brackets[section.key].length === 0 && (
              <p className="text-gray-500 text-sm italic py-2">No brackets defined. Click 'Add Rule' to create one.</p>
            )}
          </div>
        </div>
      ))}

      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-sm text-blue-700">
        <strong>💡 Tip:</strong> Bracket changes affect which participants are eligible for age/weight-based events. Changes apply immediately when adding participants to heats.
      </div>
    </div>
  );
}
