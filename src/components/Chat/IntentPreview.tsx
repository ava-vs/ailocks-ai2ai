import React, { useEffect, useState, useRef } from 'react';
import { Target, X, MapPin, DollarSign, Clock, Check, Edit3, Globe } from 'lucide-react';
import { useStore } from '@nanostores/react';
import { currentLanguage } from '../../lib/store';

interface IntentPreviewProps {
  title: string;
  description: string;
  category: string;
  // Make skills optional since it might be missing
  requiredSkills?: string[];
  skills?: string[];
  location?: { city: string; country: string };
  budget?: string;
  timeline?: string;
  priority: string;
  onConfirm: (updatedData: any) => void;
  onCancel: () => void;
  onDataChange: (updatedData: any) => void;
  isLoading?: boolean;
}

export default function IntentPreview({ 
  title, 
  description, 
  category,
  skills,
  requiredSkills,
  location, 
  budget,
  timeline,
  priority,
  onConfirm, 
  onCancel, 
  onDataChange,
  isLoading = false 
}: IntentPreviewProps) {
  const language = useStore(currentLanguage);

  const [editableTitle, setEditableTitle] = useState('');
  const [editableDescription, setEditableDescription] = useState('');
  const [editableCategory, setEditableCategory] = useState('General');
  const [editableSkills, setEditableSkills] = useState<string[]>([]);
  const [editableCity, setEditableCity] = useState('');
  const [editableCountry, setEditableCountry] = useState('');
  const [editableBudget, setEditableBudget] = useState('');
  const [editableTimeline, setEditableTimeline] = useState('');
  const [editablePriority, setEditablePriority] = useState('medium');
  
  // Track if initial props have been applied
  const initialized = useRef(false);
  // Snapshot of current local state to compare with new props
  const snapshotRef = useRef<any>(null);

  useEffect(() => {
    // Build props object for comparison
    const propsObj = { title, description, category, requiredSkills, skills, location, budget, timeline, priority };

    // Determine if props differ from current local snapshot
    const propsDifferFromLocal = JSON.stringify(snapshotRef.current) !== JSON.stringify(propsObj);

    if (!initialized.current || propsDifferFromLocal) {
      // Log all received data
      console.log('IntentPreview LOADING DATA:', { 
        title, description, category, 
        requiredSkills, skills,
        location, budget, timeline, priority
      });
      setEditableTitle(title || 'Нет заголовка'); 
      setEditableDescription(description || 'Нет описания');
      setEditableCategory(category || 'General');
      // Skills - always ensure array
      const skillsArray = Array.isArray(requiredSkills) && requiredSkills.length > 0 ? 
        requiredSkills : Array.isArray(skills) && skills.length > 0 ? 
        skills : ['Technology'];
      setEditableSkills(skillsArray);
      // Location
      if (location) {
        setEditableCity(location.city || '');
        setEditableCountry(location.country || '');
      } else {
        setEditableCity('');
        setEditableCountry('');
      }
      setEditableBudget(budget || '');
      setEditableTimeline(timeline || 'Не определено');
      setEditablePriority(priority || 'medium');
      initialized.current = true;
      // Update snapshot to new props
      snapshotRef.current = propsObj;
      console.log('IntentPreview DATA LOADED', { 
        editableTitle: title, editableDescription: description, editableCategory: category, 
        skillsArray, location, budget, timeline, priority 
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, category, requiredSkills, skills, location, budget, timeline, priority]);

  // Update parent on any local field change
  useEffect(() => {
    const updatedData = {
      title: editableTitle,
      description: editableDescription,
      category: editableCategory,
      skills: editableSkills,
      requiredSkills: editableSkills, // duplicate for compatibility
      location: { city: editableCity, country: editableCountry },
      budget: editableBudget,
      timeline: editableTimeline,
      priority: editablePriority
    };
    onDataChange(updatedData);

    // Also update snapshot so re-renders with same values won't trigger re-initialization
    snapshotRef.current = {
      title: editableTitle,
      description: editableDescription,
      category: editableCategory,
      requiredSkills: editableSkills,
      skills: editableSkills,
      location: { city: editableCity, country: editableCountry },
      budget: editableBudget,
      timeline: editableTimeline,
      priority: editablePriority
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editableTitle, editableDescription, editableCategory, editableSkills, 
     editableCity, editableCountry, editableBudget, editableTimeline, editablePriority]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onCancel]);

  const getTexts = () => {
    const texts: Record<string, any> = {
      en: {
        title: 'Create Intent Preview',
        subtitle: 'Review and edit the details below, then click "Create Intent" to publish your collaboration opportunity.',
        titleLabel: 'Title',
        categoryLabel: 'Category',
        descriptionLabel: 'Description',
        locationLabel: 'Location',
        priorityLabel: 'Priority',
        skillsLabel: 'Required Skills',
        budgetLabel: 'Budget (Optional)',
        timelineLabel: 'Timeline (Optional)',
        createButton: 'Create Intent',
        cancelButton: 'Cancel',
        cityPlaceholder: 'City',
        countryPlaceholder: 'Country',
        budgetPlaceholder: 'e.g., $1000-5000',
        timelinePlaceholder: 'e.g., 2-4 weeks'
      },
      ru: {
        title: 'Предпросмотр Интента',
        subtitle: 'Проверьте и отредактируйте детали ниже, затем нажмите "Создать Интент" чтобы опубликовать возможность для сотрудничества.',
        titleLabel: 'Заголовок',
        categoryLabel: 'Категория',
        descriptionLabel: 'Описание',
        locationLabel: 'Локация',
        priorityLabel: 'Приоритет',
        skillsLabel: 'Необходимые навыки',
        budgetLabel: 'Бюджет (Опционально)',
        timelineLabel: 'Временные рамки (Опционально)',
        createButton: 'Создать Интент',
        cancelButton: 'Отмена',
        cityPlaceholder: 'Город',
        countryPlaceholder: 'Страна',
        budgetPlaceholder: 'например, $1000-5000',
        timelinePlaceholder: 'например, 2-4 недели'
      }
    };
    return texts[language] || texts.en;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-400 bg-red-500/20 border-red-500/30';
      case 'high': return 'text-orange-400 bg-orange-500/20 border-orange-500/30';
      case 'medium': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      case 'low': return 'text-green-400 bg-green-500/20 border-green-500/30';
      default: return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
    }
  };

  const parseBudget = (budgetStr: string): number | null => {
    if (!budgetStr) return null;
    // Extracts the first number from a string like "$1000-5000" or "1000"
    const match = budgetStr.match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
  };

  const handleConfirm = () => {
    const updatedData = {
      title: editableTitle,
      description: editableDescription,
      category: editableCategory,
      skills: editableSkills,
      location: { city: editableCity, country: editableCountry },
      budget: editableBudget,
      timeline: editableTimeline,
      priority: editablePriority
    };
    onConfirm(updatedData);
  };

  const addSkill = (skill: string) => {
    if (skill.trim() && !editableSkills.includes(skill.trim())) {
      setEditableSkills([...editableSkills, skill.trim()]);
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setEditableSkills(editableSkills.filter(skill => skill !== skillToRemove));
  };

  const texts = getTexts();

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-slate-800/95 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 p-0.5">
                <div className="w-full h-full rounded-xl bg-slate-800/90 flex items-center justify-center">
                  <Target className="w-5 h-5 text-blue-400" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">{texts.title}</h3>
                <p className="text-sm text-white/60">{texts.subtitle}</p>
              </div>
            </div>
            <button 
              onClick={onCancel}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white/60" />
            </button>
          </div>

          {/* Form Fields */}
          <div className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                {texts.titleLabel}
              </label>
              <input
                type="text"
                value={editableTitle}
                onChange={(e) => setEditableTitle(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-400 focus:bg-white/15 transition-all"
                placeholder="Enter intent title..."
              />
            </div>

            {/* Category & Priority Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  {texts.categoryLabel}
                </label>
                <select
                  value={editableCategory}
                  onChange={(e) => setEditableCategory(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-400 focus:bg-slate-600 transition-all"
                  style={{ color: '#ffffff', backgroundColor: '#334155' }}
                >
                  <option value="Travel" className="bg-slate-700 text-white">Travel</option>
                  <option value="Design" className="bg-slate-700 text-white">Design</option>
                  <option value="Marketing" className="bg-slate-700 text-white">Marketing</option>
                  <option value="Technology" className="bg-slate-700 text-white">Technology</option>
                  <option value="Business" className="bg-slate-700 text-white">Business</option>
                  <option value="General" className="bg-slate-700 text-white">General</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  {texts.priorityLabel}
                </label>
                <select
                  value={editablePriority}
                  onChange={(e) => setEditablePriority(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-400 focus:bg-white/15 transition-all"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                {texts.descriptionLabel}
              </label>
              <textarea
                value={editableDescription}
                onChange={(e) => setEditableDescription(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-400 focus:bg-white/15 transition-all resize-none"
                placeholder="Describe your collaboration opportunity..."
              />
            </div>

            {/* Location Row */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                <MapPin className="w-4 h-4 inline mr-1" />
                {texts.locationLabel}
              </label>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  value={editableCity}
                  onChange={(e) => setEditableCity(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-400 focus:bg-white/15 transition-all"
                  placeholder={texts.cityPlaceholder}
                />
                <input
                  type="text"
                  value={editableCountry}
                  onChange={(e) => setEditableCountry(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-400 focus:bg-white/15 transition-all"
                  placeholder={texts.countryPlaceholder}
                />
              </div>
            </div>

            {/* Budget & Timeline Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  <DollarSign className="w-4 h-4 inline mr-1" />
                  {texts.budgetLabel}
                </label>
                <input
                  type="text"
                  value={editableBudget}
                  onChange={(e) => setEditableBudget(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-400 focus:bg-white/15 transition-all"
                  placeholder={texts.budgetPlaceholder}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  <Clock className="w-4 h-4 inline mr-1" />
                  {texts.timelineLabel}
                </label>
                <input
                  type="text"
                  value={editableTimeline}
                  onChange={(e) => setEditableTimeline(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-400 focus:bg-white/15 transition-all"
                  placeholder={texts.timelinePlaceholder}
                />
              </div>
            </div>

            {/* Skills */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                {texts.skillsLabel}
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {editableSkills.map((skill, index) => (
                  <span 
                    key={index}
                    className="inline-flex items-center gap-1 bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full text-sm border border-purple-500/30"
                  >
                    {skill}
                    <button
                      onClick={() => removeSkill(skill)}
                      className="ml-1 hover:text-purple-300 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                placeholder="Add a skill and press Enter..."
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-400 focus:bg-white/15 transition-all"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSkill(e.currentTarget.value);
                    e.currentTarget.value = '';
                  }
                }}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 mt-8">
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {texts.cancelButton}
            </button>
            <button 
              onClick={handleConfirm}
              disabled={isLoading || !editableTitle.trim() || !editableDescription.trim()}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg transition-all shadow-lg hover:shadow-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  {texts.createButton}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}