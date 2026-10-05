import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { 
  Calendar, Plus, Trash2, Edit3, Search, Filter, 
  Sparkles, Flag, Gift, Building2, Star, CheckCircle, 
  Clock, XCircle, Info, ChevronRight, AlertCircle
} from 'lucide-react';
import HorizontalLoader from '../../../core/components/HorizontalLoader';
import useEscapeClose from '../../../core/hooks/useEscapeClose';

export default function HolidayManagementPanel({ isAdmin }) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [deletingHoliday, setDeletingHoliday] = useState(null);

  // Form State
  const [form, setForm] = useState({
    name: '',
    date: '',
    holiday_type: 'national_holiday',
    description: '',
    is_half_day: false
  });

  useEscapeClose(() => setShowAddModal(false), showAddModal);
  useEscapeClose(() => setEditingHoliday(null), !!editingHoliday);
  useEscapeClose(() => setDeletingHoliday(null), !!deletingHoliday);

  const parseResJson = async (res) => {
    if (!res.ok) {
      let msg = 'Request failed';
      try {
        const data = await res.json();
        msg = data.detail || msg;
      } catch {
        try {
          const text = await res.text();
          msg = text || res.statusText || msg;
        } catch {
          msg = res.statusText || msg;
        }
      }
      throw new Error(msg);
    }
    return res.json();
  };

  const fetchHolidays = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance/holidays?year=${selectedYear}`, {
        credentials: 'include'
      });
      const data = await parseResJson(res);
      setHolidays(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e.message || 'Failed to fetch company holidays');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, [selectedYear]);

  const handleCreateHoliday = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.date) {
      toast.error('Please provide a holiday name and date.');
      return;
    }

    try {
      const res = await fetch('/api/attendance/holidays', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      await parseResJson(res);

      toast.success(`Holiday "${form.name}" created!`);
      setShowAddModal(false);
      setForm({
        name: '',
        date: '',
        holiday_type: 'national_holiday',
        description: '',
        is_half_day: false
      });
      fetchHolidays();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleUpdateHoliday = async (e) => {
    e.preventDefault();
    if (!editingHoliday || !form.name.trim() || !form.date) return;

    try {
      const res = await fetch(`/api/attendance/holidays/${editingHoliday.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      await parseResJson(res);

      toast.success(`Holiday "${form.name}" updated!`);
      setEditingHoliday(null);
      fetchHolidays();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleDeleteHoliday = async () => {
    if (!deletingHoliday) return;

    try {
      const res = await fetch(`/api/attendance/holidays/${deletingHoliday.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      await parseResJson(res);

      toast.success('Holiday deleted.');
      setDeletingHoliday(null);
      fetchHolidays();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const openEditModal = (h) => {
    setEditingHoliday(h);
    setForm({
      name: h.name,
      date: h.date,
      holiday_type: h.holiday_type || 'regular_holiday',
      description: h.description || '',
      is_half_day: !!h.is_half_day
    });
  };

  const openAddModal = () => {
    setForm({
      name: '',
      date: `${selectedYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`,
      holiday_type: 'national_holiday',
      description: '',
      is_half_day: false
    });
    setShowAddModal(true);
  };

  // Helper for type badges & styling
  const getTypeConfig = (type) => {
    switch (type) {
      case 'national_holiday':
        return {
          label: 'National Holiday',
          icon: Flag,
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          badgeColor: '#10B981'
        };
      case 'regular_holiday':
      case 'company_holiday':
      case 'festival':
        return {
          label: 'Regular Holiday',
          icon: Calendar,
          bg: 'bg-purple-50 text-purple-700 border-purple-200',
          badgeColor: '#8B5CF6'
        };
      case 'restricted_holiday':
      case 'optional_holiday':
        return {
          label: 'Restricted Holiday',
          icon: Star,
          bg: 'bg-blue-50 text-blue-700 border-blue-200',
          badgeColor: '#3B82F6'
        };
      default:
        return {
          label: 'Regular Holiday',
          icon: Calendar,
          bg: 'bg-gray-50 text-gray-700 border-gray-200',
          badgeColor: '#6B7280'
        };
    }
  };

  // Filtered Holidays
  const filteredHolidays = holidays.filter((h) => {
    const matchesSearch =
      (h.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (h.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesType = true;
    if (typeFilter === 'national_holiday') {
      matchesType = h.holiday_type === 'national_holiday';
    } else if (typeFilter === 'regular_holiday') {
      matchesType = h.holiday_type === 'regular_holiday' || h.holiday_type === 'company_holiday' || h.holiday_type === 'festival';
    } else if (typeFilter === 'restricted_holiday') {
      matchesType = h.holiday_type === 'restricted_holiday' || h.holiday_type === 'optional_holiday';
    }
    return matchesSearch && matchesType;
  });

  // Calculate Next Upcoming Holiday
  const todayStr = new Date().toISOString().split('T')[0];
  const upcomingHolidays = holidays
    .filter((h) => h.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date));
  const nextHoliday = upcomingHolidays.length > 0 ? upcomingHolidays[0] : null;

  let daysUntilNext = null;
  if (nextHoliday) {
    const diff = new Date(nextHoliday.date) - new Date(new Date().setHours(0, 0, 0, 0));
    daysUntilNext = Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  // Group holidays by month
  const groupedByMonth = filteredHolidays.reduce((acc, h) => {
    const monthIndex = new Date(h.date).getMonth();
    const monthName = new Date(h.date).toLocaleString('default', { month: 'long' });
    if (!acc[monthIndex]) {
      acc[monthIndex] = { monthName, items: [] };
    }
    acc[monthIndex].items.push(h);
    return acc;
  }, {});

  const months = Object.keys(groupedByMonth).sort((a, b) => Number(a) - Number(b));

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* ── TOP BANNER & SUMMARY ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Holidays Card */}
        <div className="bg-white border border-[#ebe4ff] rounded-[2rem] p-6 shadow-[0_10px_40px_rgba(180,140,255,0.08)] flex items-center justify-between relative overflow-hidden">
          <div className="relative z-10">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8b8ba3] block mb-1">
              Total Declared Holidays ({selectedYear})
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-black font-display">{holidays.length}</span>
              <span className="text-xs text-gray-500 font-medium">Days</span>
            </div>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
            <Calendar size={28} />
          </div>
        </div>

        {/* Next Holiday Card */}
        <div className="md:col-span-2 bg-gradient-to-r from-[#faf5ff] to-[#f3e8ff] border border-[#e9d5ff] rounded-[2rem] p-6 shadow-[0_10px_40px_rgba(180,140,255,0.08)] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
          <div className="relative z-10 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-700 bg-purple-100 px-3 py-1 rounded-full border border-purple-200">
                Next Upcoming Holiday
              </span>
              {daysUntilNext !== null && (
                <span className="text-xs font-bold text-purple-900">
                  {daysUntilNext === 0
                    ? 'Happening Today'
                    : daysUntilNext === 1
                    ? 'Tomorrow'
                    : `in ${daysUntilNext} days`}
                </span>
              )}
            </div>
            {nextHoliday ? (
              <div>
                <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">
                  {nextHoliday.name}
                  {nextHoliday.is_half_day && (
                    <span className="ml-2 text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">
                      Half Day
                    </span>
                  )}
                </h3>
                <p className="text-xs text-gray-600 font-medium mt-0.5">
                  {new Date(nextHoliday.date).toLocaleDateString('en-GB', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                  {nextHoliday.description && ` • ${nextHoliday.description}`}
                </p>
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">No more upcoming holidays recorded for this year.</p>
            )}
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/80 text-purple-600 flex items-center justify-center shadow-sm border border-purple-200 shrink-0">
            <Sparkles size={24} />
          </div>
        </div>
      </div>

      {/* ── CONTROLS & ACTIONS ── */}
      <div className="bg-white border border-[#ebe4ff] rounded-[2rem] p-6 shadow-[0_10px_40px_rgba(180,140,255,0.08)] flex flex-wrap justify-between items-center gap-4">
        {/* Left: Year & Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Year Selector */}
          <div className="flex items-center gap-2 bg-[#faf7ff] border border-[#ebe4ff] px-3 py-1.5 rounded-xl">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#8b8ba3]">Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-xs font-black text-black outline-none cursor-pointer"
            >
              {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1 bg-[#faf7ff] border border-[#ebe4ff] p-1 rounded-xl">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'national_holiday', label: 'National Holidays' },
              { id: 'regular_holiday', label: 'Regular Holidays' },
              { id: 'restricted_holiday', label: 'Restricted Holidays' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTypeFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  typeFilter === tab.id
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-black hover:bg-purple-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search holidays..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#faf7ff] border border-[#ebe4ff] pl-8 pr-4 py-2 rounded-xl text-xs text-black outline-none focus:border-purple-400 w-48 transition-all"
            />
          </div>
        </div>

        {/* Right: Add Holiday Button (HR/Admin only) */}
        {isAdmin && (
          <div className="flex items-center gap-3">
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#c084fc] to-[#8b5cf6] text-white text-xs font-bold tracking-wide hover:opacity-95 shadow-md shadow-purple-200 transition-all"
            >
              <Plus size={16} /> Add Holiday
            </button>
          </div>
        )}
      </div>

      {/* ── HOLIDAYS LIST / CALENDAR ── */}
      {loading ? (
        <HorizontalLoader label="Loading company holiday calendar..." />
      ) : filteredHolidays.length === 0 ? (
        <div className="bg-white border border-[#ebe4ff] rounded-[2rem] p-16 text-center shadow-[0_10px_40px_rgba(180,140,255,0.08)]">
          <Calendar size={48} className="mx-auto text-gray-300 mb-3" />
          <h3 className="text-base font-bold text-gray-700">No holidays declared for {selectedYear}</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            {isAdmin
              ? 'Click "Add Holiday" above to declare national holidays, festivals, and company off-days.'
              : 'No company holidays have been scheduled for this timeframe yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {months.map((mIdx) => {
            const group = groupedByMonth[mIdx];
            return (
              <div key={mIdx} className="space-y-3">
                <div className="flex items-center gap-3 px-2">
                  <h4 className="text-xs font-black uppercase tracking-[0.25em] text-purple-700">
                    {group.monthName} {selectedYear}
                  </h4>
                  <div className="h-px bg-purple-100 flex-1" />
                  <span className="text-[10px] font-bold text-gray-400">
                    {group.items.length} {group.items.length === 1 ? 'Holiday' : 'Holidays'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.items.map((holiday) => {
                    const cfg = getTypeConfig(holiday.holiday_type);
                    const TypeIcon = cfg.icon;
                    const dateObj = new Date(holiday.date);
                    const isPast = holiday.date < todayStr;

                    return (
                      <div
                        key={holiday.id}
                        className={`bg-white border rounded-[1.75rem] p-5 shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden flex flex-col justify-between ${
                          isPast ? 'border-gray-200 opacity-75' : 'border-[#ebe4ff]'
                        }`}
                      >
                        <div>
                          {/* Top: Date & Type */}
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl font-black text-black font-display">
                                {dateObj.getDate()}
                              </span>
                              <div className="leading-tight">
                                <span className="text-[10px] font-bold text-gray-500 uppercase block">
                                  {dateObj.toLocaleString('default', { weekday: 'short' })}
                                </span>
                                <span className="text-[9px] text-gray-400 font-mono">
                                  {holiday.date}
                                </span>
                              </div>
                            </div>

                            <span
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${cfg.bg}`}
                            >
                              <TypeIcon size={10} />
                              {cfg.label}
                            </span>
                          </div>

                          {/* Holiday Name & Description */}
                          <h5 className="text-sm font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                            {holiday.name}
                            {holiday.is_half_day && (
                              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                0.5 Day
                              </span>
                            )}
                          </h5>

                          {holiday.description ? (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                              {holiday.description}
                            </p>
                          ) : (
                            <p className="text-xs text-gray-400 italic mt-1">Official Company Holiday</p>
                          )}
                        </div>

                        {/* Bottom: Admin Actions */}
                        {isAdmin && (
                          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                            <span className="text-[9px] text-gray-400">
                              {isPast ? 'Passed' : 'Upcoming'}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openEditModal(holiday)}
                                className="p-1.5 rounded-lg text-gray-500 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                                title="Edit Holiday"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                onClick={() => setDeletingHoliday(holiday)}
                                className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Delete Holiday"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── CREATE / ADD HOLIDAY MODAL ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4 overflow-y-auto">
          <form
            onSubmit={handleCreateHoliday}
            className="bg-white border border-[#ebe4ff] rounded-[2rem] p-6 sm:p-8 w-full max-w-md space-y-5 shadow-2xl relative overflow-hidden"
          >
            <div>
              <h3 className="text-lg font-black text-black tracking-tight flex items-center gap-2">
                <Plus size={20} className="text-purple-600" />
                Add Company Holiday
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Declare a new holiday for all employees across the organization.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-purple-700 mb-1.5 block">
                  Holiday Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Diwali, Independence Day, Annual Off"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-[#faf7ff] border border-[#ebe4ff] text-black text-xs px-4 py-3 rounded-xl focus:outline-none focus:border-purple-400 font-semibold transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-purple-700 mb-1.5 block">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full bg-[#faf7ff] border border-[#ebe4ff] text-black text-xs px-3 py-3 rounded-xl focus:outline-none focus:border-purple-400 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-purple-700 mb-1.5 block">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.holiday_type}
                    onChange={(e) => setForm({ ...form, holiday_type: e.target.value })}
                    className="w-full bg-[#faf7ff] border border-[#ebe4ff] text-black text-xs px-3 py-3 rounded-xl focus:outline-none focus:border-purple-400 font-medium"
                  >
                    <option value="national_holiday">National Holiday</option>
                    <option value="regular_holiday">Regular Holiday</option>
                    <option value="restricted_holiday">Restricted Holiday</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-purple-700 mb-1.5 block">
                  Description / Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional context or notes regarding the holiday..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full bg-[#faf7ff] border border-[#ebe4ff] text-black text-xs px-4 py-2.5 rounded-xl focus:outline-none focus:border-purple-400 resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="is_half_day"
                  checked={form.is_half_day}
                  onChange={(e) => setForm({ ...form, is_half_day: e.target.checked })}
                  className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
                />
                <label htmlFor="is_half_day" className="text-xs font-semibold text-gray-700 cursor-pointer">
                  Mark as Half-Day Holiday (0.5 working day)
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold uppercase tracking-wider hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#c084fc] to-[#8b5cf6] text-white text-xs font-bold uppercase tracking-wider hover:opacity-95 shadow-md shadow-purple-200 transition-all"
              >
                Save Holiday
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── EDIT HOLIDAY MODAL ── */}
      {editingHoliday && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4 overflow-y-auto">
          <form
            onSubmit={handleUpdateHoliday}
            className="bg-white border border-[#ebe4ff] rounded-[2rem] p-6 sm:p-8 w-full max-w-md space-y-5 shadow-2xl relative overflow-hidden"
          >
            <div>
              <h3 className="text-lg font-black text-black tracking-tight flex items-center gap-2">
                <Edit3 size={20} className="text-purple-600" />
                Edit Company Holiday
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Update details for "{editingHoliday.name}".
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-purple-700 mb-1.5 block">
                  Holiday Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-[#faf7ff] border border-[#ebe4ff] text-black text-xs px-4 py-3 rounded-xl focus:outline-none focus:border-purple-400 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-purple-700 mb-1.5 block">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full bg-[#faf7ff] border border-[#ebe4ff] text-black text-xs px-3 py-3 rounded-xl focus:outline-none focus:border-purple-400 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-purple-700 mb-1.5 block">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.holiday_type}
                    onChange={(e) => setForm({ ...form, holiday_type: e.target.value })}
                    className="w-full bg-[#faf7ff] border border-[#ebe4ff] text-black text-xs px-3 py-3 rounded-xl focus:outline-none focus:border-purple-400 font-medium"
                  >
                    <option value="national_holiday">National Holiday</option>
                    <option value="regular_holiday">Regular Holiday</option>
                    <option value="restricted_holiday">Restricted Holiday</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-purple-700 mb-1.5 block">
                  Description / Notes
                </label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full bg-[#faf7ff] border border-[#ebe4ff] text-black text-xs px-4 py-2.5 rounded-xl focus:outline-none focus:border-purple-400 resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="edit_is_half_day"
                  checked={form.is_half_day}
                  onChange={(e) => setForm({ ...form, is_half_day: e.target.checked })}
                  className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
                />
                <label htmlFor="edit_is_half_day" className="text-xs font-semibold text-gray-700 cursor-pointer">
                  Mark as Half-Day Holiday (0.5 working day)
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setEditingHoliday(null)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold uppercase tracking-wider hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#c084fc] to-[#8b5cf6] text-white text-xs font-bold uppercase tracking-wider hover:opacity-95 shadow-md shadow-purple-200 transition-all"
              >
                Update Holiday
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {deletingHoliday && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4">
          <div className="bg-white border border-[#ebe4ff] rounded-[2rem] p-6 sm:p-8 w-full max-w-sm space-y-5 shadow-2xl relative text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-100">
              <Trash2 size={28} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-gray-900">Delete Holiday?</h3>
              <p className="text-xs text-gray-500 mt-1">
                Are you sure you want to remove <strong>"{deletingHoliday.name}"</strong> ({deletingHoliday.date})? This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingHoliday(null)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold uppercase tracking-wider hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteHoliday}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-red-700 shadow-md shadow-red-200 transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
