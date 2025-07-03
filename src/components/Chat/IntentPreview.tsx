import React, { useEffect, useState } from 'react';
import { Target, X, MapPin, DollarSign, Clock, Check, Edit3, Globe } from 'lucide-react';
import { useStore } from '@nanostores/react';
import { currentLanguage } from '../../lib/store';

interface IntentPreviewProps {
  title: string;
  description: string;
  category: string;
  requiredSkills: string[];
  location: { city: string; country: string };
  budget?: string;
  timeline?: string;
  priority: string;
  onConfirm: (updatedData: any) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function IntentPreview({ 
  title, 
  description, 
  category,
  requiredSkills, 
  location, 
  budget,
  timeline,
  priority,
  onConfirm, 
  onCancel, 
  isLoading = false 
}: IntentPreviewProps) {
  const language = useStore(currentLanguage);

  // Editable state
  const [editableTitle, setEditableTitle] = useState(title);
  const [editableDescription, setEditableDescription] = useState(description);
  const [editableCategory, setEditableCategory] = useState(category);
  const [editableSkills, setEditableSkills] = useState(requiredSkills);
  const [editableCity, setEditableCity] = useState('Rio de Janeiro'); // Default to Rio for the example
  const [editableCountry, setEditableCountry] = useState('BR');
  const [editableBudget, setEditableBudget] = useState(budget || '');
  const [editableTimeline, setEditableTimeline] = useState(timeline || '');
  const [editablePriority, setEditablePriority] = useState(priority);

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
      requiredSkills: editableSkills,
      location: { city: editableCity, country: editableCountry },
      budget: parseBudget(editableBudget),
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
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-400 focus:bg-white/15 transition-all"
                >
                  <option value="Travel">Travel</option>
                  <option value="Design">Design</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Technology">Technology</option>
                  <option value="Business">Business</option>
                  <option value="General">General</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  {texts.priorityLabel}
                </label>
                <select
                  value={editablePriority}
                  onChange={(e) => setEditablePriority(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-400 focus:bg-white/15 transition-all"
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