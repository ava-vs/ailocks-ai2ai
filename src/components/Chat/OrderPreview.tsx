import React, { useEffect, useState, useRef } from 'react';
import { Package, X, Plus, Trash2 } from 'lucide-react';
import { useStore } from '@nanostores/react';
import { currentLanguage } from '../../lib/store';

interface Milestone {
  id: number;
  description: string;
  amount: number;
  deadline: string; // Keep as string for input compatibility
}

interface OrderPreviewProps {
  title: string;
  description: string;
  milestones: Omit<Milestone, 'id'>[];
  amount: number;
  currency: string;
  onConfirm: (updatedData: any) => void;
  onCancel: () => void;
  onDataChange: (updatedData: any) => void;
  isLoading?: boolean;
}

export default function OrderPreview({ 
  title, 
  description, 
  milestones,
  amount,
  currency,
  onConfirm, 
  onCancel, 
  onDataChange,
  isLoading = false 
}: OrderPreviewProps) {
  const language = useStore(currentLanguage);

  const [editableTitle, setEditableTitle] = useState('');
  const [editableDescription, setEditableDescription] = useState('');
  const [editableMilestones, setEditableMilestones] = useState<Milestone[]>([]);
  const [editableAmount, setEditableAmount] = useState(0);
  const [editableCurrency, setEditableCurrency] = useState('USD');

  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      console.log('OrderPreview LOADING DATA:', { title, description, milestones, amount, currency });
      setEditableTitle(title || '');
      setEditableDescription(description || '');
      setEditableMilestones(milestones.map((m, i) => ({ ...m, id: i })) || []);
      setEditableAmount(amount || 0);
      setEditableCurrency(currency || 'USD');
      initialized.current = true;
    }
  }, [title, description, milestones, amount, currency]);

  useEffect(() => {
    const total = editableMilestones.reduce((sum, milestone) => sum + Number(milestone.amount || 0), 0);
    setEditableAmount(total);
  }, [editableMilestones]);

  useEffect(() => {
    const updatedData = {
      title: editableTitle,
      description: editableDescription,
      milestones: editableMilestones.map(({ id, ...rest }) => rest),
      amount: editableAmount,
      currency: editableCurrency,
    };
    onDataChange(updatedData);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editableTitle, editableDescription, editableMilestones, editableAmount, editableCurrency]);

  const handleConfirm = () => {
    const finalOrderData = {
      title: editableTitle,
      description: editableDescription,
      milestones: editableMilestones.map(({ id, ...rest }) => rest),
      amount: editableAmount,
      currency: editableCurrency,
    };
    onConfirm(finalOrderData);
  };

  const addMilestone = () => {
    setEditableMilestones([...editableMilestones, { id: Date.now(), description: '', amount: 0, deadline: '' }]);
  };

  const removeMilestone = (id: number) => {
    setEditableMilestones(editableMilestones.filter(m => m.id !== id));
  };

  const handleMilestoneChange = (index: number, field: 'description' | 'amount' | 'deadline', value: string | number) => {
    const newMilestones = [...editableMilestones];
    const milestoneToUpdate = { ...newMilestones[index] };

    if (field === 'amount') {
      // Ensure amount is always a number, defaulting to 0 if empty or invalid
      const numericValue = Number(value);
      (milestoneToUpdate as any)[field] = isNaN(numericValue) ? 0 : numericValue;
    } else {
      (milestoneToUpdate as any)[field] = value;
    }

    newMilestones[index] = milestoneToUpdate;
    setEditableMilestones(newMilestones);
  };

  const allTexts = {
    en: {
      title: 'Create Order Preview',
      subtitle: 'Review and edit the order details below, then click "Create Order" to proceed.',
      titleLabel: 'Order Title',
      descriptionLabel: 'Description',

      amountLabel: 'Total Amount',
      currencyLabel: 'Currency',
      milestonesLabel: 'Milestones',
      addMilestone: 'Add Milestone',
      milestoneHeader: 'Milestone',
      milestoneDescriptionPlaceholder: 'Milestone description',
      milestoneAmountPlaceholder: 'Amount',
      milestoneDeadlinePlaceholder: 'Deadline (e.g., 2 weeks)',
      createButton: 'Create Order',
      cancelButton: 'Cancel',
    },
    ru: {
      title: 'Предпросмотр заказа',
      subtitle: 'Проверьте и отредактируйте детали заказа ниже, затем нажмите «Создать заказ» для продолжения.',
      titleLabel: 'Название заказа',
      descriptionLabel: 'Описание',

      amountLabel: 'Общая сумма',
      currencyLabel: 'Валюта',
      milestonesLabel: 'Этапы',
      addMilestone: 'Добавить этап',
      milestoneHeader: 'Этап',
      milestoneDescriptionPlaceholder: 'Описание этапа',
      milestoneAmountPlaceholder: 'Сумма',
      milestoneDeadlinePlaceholder: 'Срок (например, 2 недели)',
      createButton: 'Создать заказ',
      cancelButton: 'Отмена',
    },
  };

  const texts = allTexts[language as keyof typeof allTexts] || allTexts.en;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-slate-800/95 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-indigo-600 p-0.5">
                    <div className="w-full h-full rounded-xl bg-slate-800/90 flex items-center justify-center">
                        <Package className="w-5 h-5 text-purple-400" />
                    </div>
                </div>
                <div>
                    <h3 className="text-xl font-semibold text-white">{texts.title}</h3>
                    <p className="text-sm text-white/60">{texts.subtitle}</p>
                </div>
            </div>
            <button onClick={onCancel} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <X className="w-5 h-5 text-white/60" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">{texts.titleLabel}</label>
              <input
                type="text"
                value={editableTitle}
                onChange={(e) => setEditableTitle(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-purple-400 focus:bg-white/15 transition-all"
                placeholder="Enter order title..."
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">{texts.descriptionLabel}</label>
              <textarea
                value={editableDescription}
                onChange={(e) => setEditableDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-purple-400 focus:bg-white/15 transition-all resize-none"
                placeholder="Describe the order..."
              />
            </div>


            {/* Milestones */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">{texts.milestonesLabel}</label>
              <div className="space-y-4">
                {editableMilestones.map((milestone, index) => (
                  <div key={milestone.id} className="p-4 bg-white/5 rounded-lg border border-white/10 space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-white/80 font-semibold">Milestone #{index + 1}</span>
                        <button onClick={() => removeMilestone(milestone.id)} className="p-1 hover:bg-red-500/20 rounded-md">
                            <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                    </div>
                    <input
                      type="text"
                      key={`desc-${milestone.id}`}
                      value={milestone.description}
                      onChange={(e) => handleMilestoneChange(index, 'description', e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={texts.milestoneDescriptionPlaceholder}
                    />
                    <div className="flex gap-4">
                      <input
                        type="number"
                        key={`amount-${milestone.id}`}
                        value={milestone.amount}
                        onChange={(e) => handleMilestoneChange(index, 'amount', e.target.value)}
                        className="w-1/2 bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={texts.milestoneAmountPlaceholder}
                      />
                      <input
                        type="text"
                        key={`deadline-${milestone.id}`}
                        value={milestone.deadline}
                        onChange={(e) => handleMilestoneChange(index, 'deadline', e.target.value)}
                        className="w-1/2 bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={texts.milestoneDeadlinePlaceholder}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={addMilestone} className="mt-4 flex items-center space-x-2 text-purple-400 hover:text-purple-300 transition-colors">
                <Plus className="w-4 h-4" />
                <span>{texts.addMilestone}</span>
              </button>
            </div>
          </div>

          <div className="flex justify-end space-x-4 mt-8">
            <button onClick={onCancel} className="px-6 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors">
              {texts.cancelButton}
            </button>
            <button onClick={handleConfirm} disabled={isLoading} className="px-6 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:bg-purple-800/50 transition-colors flex items-center">
              {isLoading ? 'Creating...' : texts.createButton}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
